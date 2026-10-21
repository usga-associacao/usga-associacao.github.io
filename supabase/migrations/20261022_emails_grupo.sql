-- ============================================================
-- USGA - Emails automáticos em inscrições de grupo
--
-- Executar depois de 20261021_provas_documentos_grupos.sql.
-- Sem isto, uma família de 4 recebia 4 emails iguais.
-- ============================================================

begin;

-- Email "pendente": num grupo só a primeira inscrição criada dispara o email.
-- O email vai para o contacto e lista todo o grupo (ver função enviar-email).
create or replace function public.trg_email_inscricao_criada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pagamento_id is not null and exists (
    select 1 from public.inscricoes_evento i
    where i.pagamento_id = new.pagamento_id and i.id <> new.id
  ) then
    return new;
  end if;

  perform public.disparar_email_assincrono('pendente', new.id);
  return new;
end; $$;

-- Email "confirmada": quando o pagamento do grupo é validado, todas as
-- inscrições são confirmadas no mesmo instante. Envia-se um email por
-- endereço, dando preferência à inscrição do titular do pagamento.
-- Confirmações individuais (separador Inscrições) continuam a enviar o seu email.
create or replace function public.trg_email_inscricao_confirmada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_titular_id uuid;
begin
  if new.estado = 'confirmada' and (old.estado is distinct from 'confirmada') then
    if new.pagamento_id is not null then
      select inscricao_evento_id into v_titular_id from public.pagamentos where id = new.pagamento_id;

      if exists (
        select 1 from public.inscricoes_evento i
        where i.pagamento_id = new.pagamento_id and i.id <> new.id
          and lower(i.email) = lower(new.email)
          and i.estado = 'confirmada'
          and i.data_confirmacao is not distinct from new.data_confirmacao
          and (i.id is distinct from v_titular_id, i.id) < (new.id is distinct from v_titular_id, new.id)
      ) then
        return new;
      end if;
    end if;

    perform public.disparar_email_assincrono('confirmada', new.id);
  end if;
  return new;
end; $$;

commit;
