-- ============================================================
-- USGA - Ajuste da regra que liga inscrições ao perfil do sócio
--
-- Executar depois de 20261023_inscricoes_perfil_socio.sql.
--
-- O diagnóstico mostrou que a regra anterior era demasiado estrita:
--   - nenhum sócio tem o CC na ficha (só existe nalguns pedidos de sócio);
--   - nas inscrições o nome vem muitas vezes completo ("Patrícia ... Oliveira")
--     e na ficha só o primeiro e último ("Patrícia Oliveira").
--
-- Nova regra: a inscrição fica no perfil do sócio quando
--   - o email é o mesmo, E
--   - o primeiro e o último nome são os mesmos, E
--   - o CC/BI é o mesmo, se o sócio tiver CC registado (ficha ou pedido de
--     sócio); se não tiver nenhum, basta o email e o nome.
--
-- As funções de inscrição já usam encontrar_socio_inscricao, por isso só
-- é preciso trocar esta função e recalcular as ligações.
-- ============================================================

begin;

create or replace function public.encontrar_socio_inscricao(p_email text, p_nome text, p_bi text)
returns uuid language sql stable security definer set search_path = public as $$
  with socio as (
    select
      u.id,
      public.normalizar_texto(concat_ws(' ', u.nome, u.apelido)) as nome_n,
      array_remove(
        array[public.normalizar_documento(u.cc)]
        || array(select public.normalizar_documento(ps.cc) from public.pedidos_socio ps where ps.utilizador_id = u.id),
        '') as documentos
    from public.utilizadores u
    where lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
  ),
  inscricao as (
    select public.normalizar_texto(p_nome) as nome_n,
           public.normalizar_documento(p_bi) as bi_n
  )
  select s.id
  from socio s, inscricao i
  where i.nome_n <> ''
    -- mesmo primeiro nome e mesmo último nome
    and split_part(i.nome_n, ' ', 1) = split_part(s.nome_n, ' ', 1)
    and regexp_replace(i.nome_n, '^.* ', '') = regexp_replace(s.nome_n, '^.* ', '')
    -- mesmo CC/BI, quando o sócio tem algum registado
    and (cardinality(s.documentos) = 0 or i.bi_n = any (s.documentos))
  limit 1;
$$;

revoke execute on function public.encontrar_socio_inscricao(text, text, text) from anon, authenticated;

-- Recalcula as ligações das inscrições existentes com a nova regra
-- (a ligação original continua guardada em backup_inscricoes_utilizador).
update public.inscricoes_evento i
set utilizador_id = public.encontrar_socio_inscricao(i.email, i.nome, i.bi)
where i.utilizador_id is distinct from public.encontrar_socio_inscricao(i.email, i.nome, i.bi);

update public.pagamentos p
set utilizador_id = i.utilizador_id
from public.inscricoes_evento i
where p.tipo = 'evento'
  and i.id = p.inscricao_evento_id
  and p.utilizador_id is distinct from i.utilizador_id;

commit;

-- Resultado: inscrições no perfil de cada sócio, antes (backup) e agora.
select
  concat_ws(' ', s.nome, s.apelido) as socio,
  count(*) filter (where b.utilizador_id = s.id) as antes,
  count(*) filter (where i.utilizador_id = s.id) as agora
from public.utilizadores s
join public.inscricoes_evento i on true
left join public.backup_inscricoes_utilizador b on b.inscricao_id = i.id
where b.utilizador_id = s.id or i.utilizador_id = s.id
group by s.id, s.nome, s.apelido
order by antes desc, socio;
