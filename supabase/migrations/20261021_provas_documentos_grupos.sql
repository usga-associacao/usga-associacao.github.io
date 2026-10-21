-- ============================================================
-- USGA - Provas por evento, documentos e inscrição de grupo
--
-- Executar uma única vez no SQL Editor do Supabase.
-- Corre dentro de uma transação: se algo falhar, nada fica aplicado.
--
-- Compatível com o site atual: a função criar_inscricao_com_pagamento
-- mantém a mesma assinatura, por isso o site que está online continua
-- a funcionar até o código novo ser publicado.
-- ============================================================

begin;

-- ── 1. Eventos: novos campos ────────────────────────────────

alter table public.eventos
  add column if not exists contribuicao_unidade     text,
  add column if not exists permite_multiplas_provas boolean not null default false;

-- Os eventos existentes mostravam o valor com o ícone de caminhada.
update public.eventos set contribuicao_unidade = 'caminhadas'
where contribuicao_unidade is null;

-- ── 2. Provas ────────────────────────────────────────────────

create table if not exists public.evento_provas (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  nome       text not null,
  descricao  text,
  valor      numeric(10,2) not null default 0 check (valor >= 0),
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evento_provas_evento_idx on public.evento_provas(evento_id);
drop trigger if exists evento_provas_set_updated_at on public.evento_provas;
create trigger evento_provas_set_updated_at before update on public.evento_provas
  for each row execute function public.set_updated_at();

-- Uma prova por cada evento existente, com o preço atual.
insert into public.evento_provas (evento_id, nome, valor, ordem)
select e.id, coalesce(nullif(trim(e.categoria), ''), 'Inscrição'), coalesce(e.preco, 0), 0
from public.eventos e
where not exists (select 1 from public.evento_provas p where p.evento_id = e.id);

-- ── 3. Documentos (informação e resultados) ──────────────────

create table if not exists public.evento_documentos (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  prova_id   uuid references public.evento_provas(id) on delete set null,  -- null = Geral
  seccao     text not null default 'informacao' check (seccao in ('informacao','resultados')),
  titulo     text not null,
  url        text not null,
  tipo       text not null default 'link' check (tipo in ('link','ficheiro')),
  ordem      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evento_documentos_evento_idx on public.evento_documentos(evento_id);
drop trigger if exists evento_documentos_set_updated_at on public.evento_documentos;
create trigger evento_documentos_set_updated_at before update on public.evento_documentos
  for each row execute function public.set_updated_at();

-- Copia os links de "Informação Adicional" (links_adicionais) para a nova tabela.
-- A coluna antiga fica intacta até o código novo estar publicado.
insert into public.evento_documentos (evento_id, seccao, titulo, url, tipo, ordem)
select e.id, 'informacao',
       coalesce(nullif(trim(l.item->>'titulo'), ''), trim(l.item->>'url')),
       trim(l.item->>'url'), 'link', l.ord::int
from public.eventos e
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(e.links_adicionais) = 'array' then e.links_adicionais else '[]'::jsonb end
) with ordinality as l(item, ord)
where coalesce(trim(l.item->>'url'), '') <> ''
  and not exists (select 1 from public.evento_documentos d where d.evento_id = e.id);

-- ── 4. Inscrições: prova e pagamento do grupo ────────────────

-- pagamento_id fica sem foreign key de propósito: pagamentos já tem uma FK
-- para inscricoes_evento e uma segunda relação tornaria ambíguos os embeds
-- "inscricoes_evento(...)" usados no admin (separadores Pagamentos e Financeiro).
alter table public.inscricoes_evento
  add column if not exists prova_id     uuid references public.evento_provas(id) on delete restrict,
  add column if not exists pagamento_id uuid;
create index if not exists inscricoes_evento_prova_idx     on public.inscricoes_evento(prova_id);
create index if not exists inscricoes_evento_pagamento_idx on public.inscricoes_evento(pagamento_id);

update public.inscricoes_evento i set prova_id = p.id
from (
  select distinct on (evento_id) id, evento_id
  from public.evento_provas
  order by evento_id, ordem, created_at
) p
where p.evento_id = i.evento_id and i.prova_id is null;

update public.inscricoes_evento i set pagamento_id = pg.id
from (
  select distinct on (inscricao_evento_id) id, inscricao_evento_id
  from public.pagamentos
  where inscricao_evento_id is not null
  order by inscricao_evento_id, created_at desc
) pg
where pg.inscricao_evento_id = i.id and i.pagamento_id is null;

-- A mesma pessoa pode agora estar em várias provas do mesmo evento
-- (quando o evento o permite), por isso a prova entra na regra de unicidade.
alter table public.inscricoes_evento drop constraint if exists inscricoes_evento_evento_id_email_nome_bi_key;
alter table public.inscricoes_evento drop constraint if exists inscricoes_evento_evento_id_email_nome_key;
alter table public.inscricoes_evento drop constraint if exists inscricoes_evento_evento_prova_email_nome_key;
alter table public.inscricoes_evento
  add constraint inscricoes_evento_evento_prova_email_nome_key unique (evento_id, prova_id, email, nome);

-- ── 5. Vista pública de inscritos (acrescenta a prova) ───────

create or replace view public.inscritos_publicos
with (security_invoker = false) as
select i.evento_id,
       i.nome,
       coalesce(i.pais, 'Portugal') as pais,
       i.equipa,
       i.dorsal,
       i.data_confirmacao,
       i.data_inscricao,
       case when i.estado = 'confirmada' and i.pagamento_estado = 'validado'
            then 'confirmada' else 'pendente' end as estado_publico,
       i.prova_id,
       pr.nome as prova_nome
from public.inscricoes_evento i
left join public.evento_provas pr on pr.id = i.prova_id
where i.estado <> all (array['rejeitada', 'cancelada']);

-- ── 6. RPC antiga: passa a preencher prova e pagamento ───────
-- Mesma assinatura e mesmo valor (eventos.preco) que a versão em produção.

create or replace function public.criar_inscricao_com_pagamento(
  p_evento_id uuid, p_nome text, p_email text,
  p_telefone text default null, p_nif text default null,
  p_bi text default null, p_data_nascimento date default null,
  p_sexo text default null, p_pais text default 'Portugal',
  p_equipa text default null, p_tamanho_tshirt text default null,
  p_localidade text default null, p_pedido_fatura boolean default false,
  p_seguro boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inscricao     public.inscricoes_evento;
  v_evento        public.eventos;
  v_valor         numeric(10,2);
  v_pagamento     public.pagamentos;
  v_utilizador_id uuid;
  v_prova_id      uuid;
  v_pagamento_id  uuid := gen_random_uuid();
begin
  select * into v_evento from public.eventos where id = p_evento_id;
  if not found then raise exception 'Evento não encontrado'; end if;
  if v_evento.estado != 'aberto' then raise exception 'Inscrições fechadas'; end if;

  v_valor := v_evento.preco;

  select id into v_prova_id from public.evento_provas
  where evento_id = p_evento_id order by ordem, created_at limit 1;
  if v_prova_id is null then
    insert into public.evento_provas (evento_id, nome, valor)
    values (p_evento_id, coalesce(nullif(trim(v_evento.categoria), ''), 'Inscrição'), coalesce(v_evento.preco, 0))
    returning id into v_prova_id;
  end if;

  v_utilizador_id := auth.uid();
  if v_utilizador_id is null and p_email is not null then
    select id into v_utilizador_id from public.utilizadores where lower(email) = lower(p_email) limit 1;
  end if;

  insert into public.inscricoes_evento
    (evento_id, prova_id, pagamento_id, utilizador_id, nome, email, telefone, nif, bi, data_nascimento,
     sexo, pais, equipa, tamanho_tshirt, localidade, seguro)
  values
    (p_evento_id, v_prova_id, v_pagamento_id, v_utilizador_id, p_nome, p_email, p_telefone, p_nif, p_bi, p_data_nascimento,
     p_sexo, p_pais, p_equipa, p_tamanho_tshirt, p_localidade, coalesce(p_seguro, false))
  returning * into v_inscricao;

  insert into public.pagamentos (id, tipo, utilizador_id, inscricao_evento_id, valor, referencia, pedido_fatura)
  values (v_pagamento_id, 'evento', v_utilizador_id, v_inscricao.id, v_valor,
          concat(v_inscricao.nome, ' - ', v_evento.titulo), coalesce(p_pedido_fatura, false))
  returning * into v_pagamento;

  return jsonb_build_object(
    'inscricao_id',    v_inscricao.id,
    'public_token',    v_inscricao.public_token,
    'pagamento_id',    v_pagamento.id,
    'pagamento_token', v_pagamento.public_token,
    'valor',           v_valor,
    'nome',            v_inscricao.nome,
    'evento_titulo',   v_evento.titulo
  );
end; $$;

-- ── 7. RPC nova: inscrição de grupo (1 a 5 participantes) ────
--
-- p_participantes: array JSON, um objeto por participante:
--   { "nome", "data_nascimento", "sexo", "pais", "localidade", "equipa",
--     "bi", "tamanho_tshirt", "email", "telefone", "seguro",
--     "provas": ["<uuid da prova>", ...] }
-- email/telefone do participante são opcionais (usa-se o contacto).
-- Cria uma inscrição por participante e prova, e um único pagamento com o total.

create or replace function public.criar_inscricao_grupo(
  p_evento_id     uuid,
  p_email         text,
  p_telefone      text,
  p_nif           text    default null,
  p_pedido_fatura boolean default false,
  p_participantes jsonb   default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_evento         public.eventos;
  v_prova          public.evento_provas;
  v_inscricao      public.inscricoes_evento;
  v_pagamento      public.pagamentos;
  v_part           jsonb;
  v_prova_id       uuid;
  v_utilizador_id  uuid;
  v_pagamento_id   uuid := gen_random_uuid();
  v_n_participantes integer;
  v_nome           text;
  v_email          text;
  v_total          numeric(10,2) := 0;
  v_ids            uuid[] := '{}';
  v_titular        public.inscricoes_evento;
begin
  select * into v_evento from public.eventos where id = p_evento_id;
  if not found then raise exception 'Evento não encontrado'; end if;
  if v_evento.estado <> 'aberto' then raise exception 'Inscrições fechadas'; end if;

  if coalesce(trim(p_email), '') = '' then raise exception 'O email de contacto é obrigatório'; end if;
  if jsonb_typeof(p_participantes) is distinct from 'array' then raise exception 'Lista de participantes inválida'; end if;
  v_n_participantes := jsonb_array_length(p_participantes);
  if v_n_participantes < 1 then raise exception 'Indique pelo menos um participante'; end if;
  if v_n_participantes > 5 then raise exception 'Máximo de 5 participantes por inscrição'; end if;

  v_utilizador_id := auth.uid();
  if v_utilizador_id is null then
    select id into v_utilizador_id from public.utilizadores where lower(email) = lower(trim(p_email)) limit 1;
  end if;

  for v_part in select value from jsonb_array_elements(p_participantes) loop
    v_nome  := trim(coalesce(v_part->>'nome', ''));
    v_email := coalesce(nullif(trim(v_part->>'email'), ''), trim(p_email));
    if v_nome = '' then raise exception 'O nome de cada participante é obrigatório'; end if;

    if jsonb_typeof(v_part->'provas') is distinct from 'array' then
      raise exception 'Escolha uma prova para %', v_nome;
    end if;
    if jsonb_array_length(v_part->'provas') = 0 then
      raise exception 'Escolha uma prova para %', v_nome;
    end if;

    if not v_evento.permite_multiplas_provas then
      if jsonb_array_length(v_part->'provas') > 1 then
        raise exception 'Neste evento cada participante só se pode inscrever numa prova';
      end if;
      if exists (
        select 1 from public.inscricoes_evento i
        where i.evento_id = p_evento_id
          and lower(i.email) = lower(v_email) and lower(i.nome) = lower(v_nome)
          and i.estado not in ('rejeitada', 'cancelada')
      ) then
        raise exception '% já está inscrito(a) neste evento', v_nome;
      end if;
    end if;

    for v_prova_id in select (value #>> '{}')::uuid from jsonb_array_elements(v_part->'provas') loop
      select * into v_prova from public.evento_provas where id = v_prova_id and evento_id = p_evento_id;
      if not found then raise exception 'Prova inválida para este evento'; end if;

      begin
        insert into public.inscricoes_evento
          (evento_id, prova_id, pagamento_id, utilizador_id, nome, email, telefone, nif, bi,
           data_nascimento, sexo, pais, equipa, tamanho_tshirt, localidade, seguro)
        values
          (p_evento_id, v_prova.id, v_pagamento_id, v_utilizador_id, v_nome, v_email,
           coalesce(nullif(trim(v_part->>'telefone'), ''), nullif(trim(p_telefone), '')),
           nullif(trim(p_nif), ''),
           nullif(trim(v_part->>'bi'), ''),
           nullif(v_part->>'data_nascimento', '')::date,
           nullif(v_part->>'sexo', ''),
           coalesce(nullif(trim(v_part->>'pais'), ''), 'Portugal'),
           nullif(trim(v_part->>'equipa'), ''),
           nullif(v_part->>'tamanho_tshirt', ''),
           nullif(trim(v_part->>'localidade'), ''),
           coalesce((v_part->>'seguro')::boolean, false))
        returning * into v_inscricao;
      exception when unique_violation then
        raise exception '% já está inscrito(a) na prova %', v_nome, v_prova.nome;
      end;

      v_ids   := v_ids || v_inscricao.id;
      v_total := v_total + v_prova.valor;
    end loop;
  end loop;

  select * into v_titular from public.inscricoes_evento where id = v_ids[1];

  insert into public.pagamentos (id, tipo, utilizador_id, inscricao_evento_id, valor, referencia, pedido_fatura)
  values (v_pagamento_id, 'evento', v_utilizador_id, v_titular.id, v_total,
          concat(v_titular.nome,
                 case when v_n_participantes > 1 then concat(' (+', v_n_participantes - 1, ')') end,
                 ' - ', v_evento.titulo),
          coalesce(p_pedido_fatura, false))
  returning * into v_pagamento;

  return jsonb_build_object(
    'inscricao_id',      v_titular.id,
    'inscricao_ids',     to_jsonb(v_ids),
    'public_token',      v_titular.public_token,
    'pagamento_id',      v_pagamento.id,
    'pagamento_token',   v_pagamento.public_token,
    'valor',             v_total,
    'num_participantes', v_n_participantes,
    'nome',              v_titular.nome,
    'evento_titulo',     v_evento.titulo
  );
end; $$;

-- ── 8. Participantes de um grupo (páginas de pagamento e estado) ──
-- Aceita o token do pagamento ou o token de qualquer inscrição do grupo.

create or replace function public.get_participantes_grupo(p_token uuid)
returns table (nome text, prova_nome text, prova_valor numeric, contribuicao_unidade text,
               estado text, pagamento_estado text, dorsal text, tamanho_tshirt text)
language sql stable security definer set search_path = public as $$
  with alvo as (
    select coalesce(
      (select p.id from public.pagamentos p where p.public_token = p_token),
      (select i.pagamento_id from public.inscricoes_evento i where i.public_token = p_token)
    ) as pagamento_id
  )
  select i.nome, pr.nome, pr.valor, e.contribuicao_unidade,
         i.estado, i.pagamento_estado, i.dorsal, i.tamanho_tshirt
  from alvo
  join public.inscricoes_evento i on i.pagamento_id = alvo.pagamento_id
  join public.eventos e on e.id = i.evento_id
  left join public.evento_provas pr on pr.id = i.prova_id
  order by i.data_inscricao, i.created_at;
$$;

-- ── 9. Pagamentos: aplicar a todo o grupo ────────────────────
-- Mesmas assinaturas e comportamento da versão em produção; a única
-- diferença é atualizar todas as inscrições ligadas ao pagamento.

create or replace function public.submeter_comprovativo_pagamento(
  p_pagamento_token uuid, p_comprovativo_url text, p_referencia text default null,
  p_metodo text default null, p_telefone_mbway text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pagamento public.pagamentos;
begin
  if p_metodo is not null and p_metodo not in ('transferencia','mbway','dinheiro','outro') then
    raise exception 'Método de pagamento inválido';
  end if;

  update public.pagamentos set
    comprovativo_url = nullif(trim(p_comprovativo_url), ''),
    referencia = coalesce(nullif(trim(p_referencia), ''), referencia),
    metodo = coalesce(p_metodo, metodo),
    telefone_mbway = nullif(trim(p_telefone_mbway), ''),
    estado = 'em_validacao'
  where public_token = p_pagamento_token
    and estado in ('pendente','em_validacao','rejeitado')
  returning * into v_pagamento;

  if not found then raise exception 'Pagamento não encontrado ou já validado'; end if;

  if v_pagamento.tipo = 'evento' and v_pagamento.inscricao_evento_id is not null then
    update public.inscricoes_evento set pagamento_estado = 'em_validacao'
    where (id = v_pagamento.inscricao_evento_id or pagamento_id = v_pagamento.id)
      and estado = 'aguardando_pagamento';
  end if;

  if v_pagamento.tipo = 'quota' and v_pagamento.quota_id is not null then
    update public.quotas set estado = 'pendente_validacao'
    where id = v_pagamento.quota_id
      and estado in ('por_pagar','pendente_validacao');
  end if;

  return jsonb_build_object('ok', true, 'pagamento_id', v_pagamento.id);
end; $$;

create or replace function public.validar_pagamento(
  p_pagamento_id uuid, p_dorsal text default null, p_observacoes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pagamento public.pagamentos;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  select * into v_pagamento from public.pagamentos where id = p_pagamento_id;
  if not found then raise exception 'Pagamento não encontrado'; end if;

  update public.pagamentos set
    estado = 'validado', validado_por = auth.uid(),
    validado_em = now(), observacoes_admin = p_observacoes
  where id = p_pagamento_id;

  if v_pagamento.tipo = 'evento' and v_pagamento.inscricao_evento_id is not null then
    -- p_dorsal só se aplica ao titular; os restantes recebem dorsal no separador Inscrições.
    update public.inscricoes_evento set
      estado = 'confirmada', pagamento_estado = 'validado',
      dorsal = case when id = v_pagamento.inscricao_evento_id then coalesce(p_dorsal, dorsal) else dorsal end,
      data_confirmacao = now()
    where id = v_pagamento.inscricao_evento_id or pagamento_id = v_pagamento.id;
  end if;

  if v_pagamento.tipo = 'quota' and v_pagamento.quota_id is not null then
    update public.quotas set
      estado = 'pago',
      data_pagamento = now()::date,
      data_expiracao = (now()::date + interval '1 year')::date
    where id = v_pagamento.quota_id;
  end if;

  insert into public.audit_logs (actor_id, acao, tabela, registo_id, detalhes)
  values (auth.uid(), 'validar_pagamento', 'pagamentos', p_pagamento_id,
    jsonb_build_object('tipo', v_pagamento.tipo, 'valor', v_pagamento.valor));

  return jsonb_build_object('ok', true, 'pagamento_id', p_pagamento_id);
end; $$;

create or replace function public.rejeitar_pagamento(
  p_pagamento_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pagamento public.pagamentos;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;

  select * into v_pagamento from public.pagamentos where id = p_pagamento_id;
  if not found then raise exception 'Pagamento não encontrado'; end if;

  update public.pagamentos set
    estado            = 'rejeitado',
    validado_por      = auth.uid(),
    validado_em       = now(),
    observacoes_admin = p_motivo
  where id = p_pagamento_id;

  if v_pagamento.tipo = 'evento' and v_pagamento.inscricao_evento_id is not null then
    update public.inscricoes_evento set
      estado           = 'rejeitada',
      pagamento_estado = 'rejeitado'
    where id = v_pagamento.inscricao_evento_id or pagamento_id = v_pagamento.id;
  end if;

  if v_pagamento.tipo = 'quota' and v_pagamento.quota_id is not null then
    update public.quotas set estado = 'cancelado'
    where id = v_pagamento.quota_id;
  end if;

  insert into public.audit_logs (actor_id, acao, tabela, registo_id, detalhes)
  values (auth.uid(), 'rejeitar_pagamento', 'pagamentos', p_pagamento_id,
    jsonb_build_object('motivo', p_motivo));

  return jsonb_build_object('ok', true);
end; $$;

-- ── 10. Eliminar inscrição sem perder o pagamento do grupo ───
-- Se a inscrição eliminada for a do titular, o pagamento passa para outro
-- membro do grupo (em vez de ser apagado em cascata). Se o pagamento ainda
-- estiver pendente, o total é recalculado com as inscrições que restam.

create or replace function public.eliminar_inscricao_evento(p_inscricao_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inscricao public.inscricoes_evento;
  v_pagamento public.pagamentos;
  v_outro_id  uuid;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;

  select * into v_inscricao from public.inscricoes_evento where id = p_inscricao_id;
  if not found then raise exception 'Inscrição não encontrada'; end if;

  if v_inscricao.pagamento_id is not null then
    select * into v_pagamento from public.pagamentos where id = v_inscricao.pagamento_id;
    if found and v_pagamento.inscricao_evento_id = p_inscricao_id then
      select id into v_outro_id from public.inscricoes_evento
      where pagamento_id = v_pagamento.id and id <> p_inscricao_id
      order by data_inscricao, created_at limit 1;
      if v_outro_id is not null then
        update public.pagamentos set inscricao_evento_id = v_outro_id where id = v_pagamento.id;
      end if;
    end if;
  end if;

  delete from public.inscricoes_evento where id = p_inscricao_id;

  if v_pagamento.id is not null and v_pagamento.estado = 'pendente' then
    update public.pagamentos p set valor = coalesce((
      select sum(pr.valor)
      from public.inscricoes_evento i
      join public.evento_provas pr on pr.id = i.prova_id
      where i.pagamento_id = p.id
    ), p.valor)
    where p.id = v_pagamento.id;
  end if;

  insert into public.audit_logs (actor_id, acao, tabela, registo_id)
  values (auth.uid(), 'eliminar_inscricao', 'inscricoes_evento', p_inscricao_id);

  return jsonb_build_object('ok', true);
end; $$;

-- ── 11. RLS e permissões ─────────────────────────────────────

alter table public.evento_provas     enable row level security;
alter table public.evento_documentos enable row level security;

-- Leitura pública segue a visibilidade do evento (a RLS de eventos aplica-se na subquery).
drop policy if exists "evento_provas_public_select" on public.evento_provas;
create policy "evento_provas_public_select" on public.evento_provas for select
  using (exists (select 1 from public.eventos e where e.id = evento_id));
drop policy if exists "evento_provas_admin_all" on public.evento_provas;
create policy "evento_provas_admin_all" on public.evento_provas for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "evento_documentos_public_select" on public.evento_documentos;
create policy "evento_documentos_public_select" on public.evento_documentos for select
  using (exists (select 1 from public.eventos e where e.id = evento_id));
drop policy if exists "evento_documentos_admin_all" on public.evento_documentos;
create policy "evento_documentos_admin_all" on public.evento_documentos for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.evento_provas     to anon, authenticated;
grant select on public.evento_documentos to anon, authenticated;
grant insert, update, delete on public.evento_provas     to authenticated;
grant insert, update, delete on public.evento_documentos to authenticated;
grant select on public.inscritos_publicos to anon, authenticated;

grant execute on function public.criar_inscricao_grupo(uuid, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function public.get_participantes_grupo(uuid)                                to anon, authenticated;

commit;
