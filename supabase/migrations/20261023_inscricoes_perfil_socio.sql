-- ============================================================
-- USGA - Inscrições só no perfil do próprio sócio
--
-- Antes: quem estava com sessão iniciada ficava ligado a TODAS as
-- inscrições que fazia (incluindo as de outras pessoas), por isso o
-- perfil mostrava eventos em que não participou.
--
-- Agora: cada inscrição só fica no perfil de um sócio quando o email,
-- o nome e o CC/BI da inscrição são os desse sócio. Numa inscrição de
-- grupo, cada participante é verificado separadamente.
--
-- Também corrige as inscrições que já existem. Antes de as alterar,
-- guarda a ligação antiga em public.backup_inscricoes_utilizador, para
-- se poder repor se for preciso (instruções no fim do ficheiro).
-- ============================================================

begin;

-- ── 1. Funções de comparação ─────────────────────────────────

-- Texto sem acentos, em minúsculas e com espaços simples ("José  Silva" = "jose silva").
create or replace function public.normalizar_texto(p_texto text)
returns text language sql immutable set search_path = public as $$
  select lower(regexp_replace(trim(translate(coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '\s+', ' ', 'g'));
$$;

-- Documento só com letras e números, em maiúsculas ("12345678 9zz1" = "123456789ZZ1").
create or replace function public.normalizar_documento(p_documento text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(coalesce(p_documento, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Sócio a quem pertence uma inscrição: mesmo email, mesmo nome (nome, ou
-- nome + apelido) e mesmo CC/BI (da ficha ou do pedido de sócio).
-- Devolve null se não houver correspondência.
create or replace function public.encontrar_socio_inscricao(p_email text, p_nome text, p_bi text)
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
  from public.utilizadores u
  where lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
    and public.normalizar_texto(p_nome) <> ''
    and public.normalizar_texto(p_nome) in (
      public.normalizar_texto(concat_ws(' ', u.nome, u.apelido)),
      public.normalizar_texto(u.nome)
    )
    and public.normalizar_documento(p_bi) <> ''
    and (
      public.normalizar_documento(u.cc) = public.normalizar_documento(p_bi)
      or exists (
        select 1 from public.pedidos_socio ps
        where ps.utilizador_id = u.id
          and public.normalizar_documento(ps.cc) = public.normalizar_documento(p_bi)
      )
    )
  limit 1;
$$;

revoke execute on function public.encontrar_socio_inscricao(text, text, text) from anon, authenticated;

-- ── 2. Funções de inscrição com a nova regra ─────────────────

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
  v_titular_utilizador uuid;
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

  for v_part in select value from jsonb_array_elements(p_participantes) loop
    v_nome  := trim(coalesce(v_part->>'nome', ''));
    v_email := coalesce(nullif(trim(v_part->>'email'), ''), trim(p_email));
    if v_nome = '' then raise exception 'O nome de cada participante é obrigatório'; end if;

    -- Só fica no perfil de um sócio a inscrição em que email, nome e CC são os dele
    -- (quem está com sessão pode estar a inscrever outras pessoas).
    v_utilizador_id := public.encontrar_socio_inscricao(v_email, v_nome, v_part->>'bi');
    if v_titular_utilizador is null and array_length(v_ids, 1) is null then
      v_titular_utilizador := v_utilizador_id;
    end if;

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
  values (v_pagamento_id, 'evento', v_titular_utilizador, v_titular.id, v_total,
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

-- Função antiga (já não é usada pelo site): mesma regra, por segurança.
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

  v_utilizador_id := public.encontrar_socio_inscricao(p_email, p_nome, p_bi);

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

-- ── 3. Corrigir as inscrições que já existem ─────────────────

create table if not exists public.backup_inscricoes_utilizador (
  inscricao_id  uuid primary key,
  utilizador_id uuid,
  guardado_em   timestamptz not null default now()
);
alter table public.backup_inscricoes_utilizador enable row level security;

insert into public.backup_inscricoes_utilizador (inscricao_id, utilizador_id)
select id, utilizador_id from public.inscricoes_evento
on conflict (inscricao_id) do nothing;

update public.inscricoes_evento i
set utilizador_id = public.encontrar_socio_inscricao(i.email, i.nome, i.bi)
where i.utilizador_id is distinct from public.encontrar_socio_inscricao(i.email, i.nome, i.bi);

-- O pagamento fica ligado ao sócio da inscrição titular (ou a ninguém).
update public.pagamentos p
set utilizador_id = i.utilizador_id
from public.inscricoes_evento i
where p.tipo = 'evento'
  and i.id = p.inscricao_evento_id
  and p.utilizador_id is distinct from i.utilizador_id;

commit;

-- ── Para repor as ligações antigas (só se for preciso) ───────
-- update public.inscricoes_evento i set utilizador_id = b.utilizador_id
-- from public.backup_inscricoes_utilizador b where b.inscricao_id = i.id;
