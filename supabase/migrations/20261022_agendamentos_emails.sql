-- ============================================================
-- USGA - Agendamentos diários de emails (aniversários e quotas expiradas)
--
-- Corrige:
--   - notificar-quotas-expiradas-diario falhava todos os dias com
--     "invalid URL https://<PROJECT_REF>..." (ficou com os valores de exemplo);
--   - a chave secreta deixa de estar escrita no comando do agendamento:
--     passa a ser lida do Supabase Vault (segredo "cron_service_key").
--
-- ANTES de executar este ficheiro, criar o segredo no SQL Editor
-- (substituir pela chave secreta nova, Project Settings → API Keys):
--
--   select vault.create_secret('sb_secret_...', 'cron_service_key');
--
-- Para trocar a chave mais tarde basta atualizar o segredo; os
-- agendamentos não precisam de ser alterados:
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_service_key'),
--     'sb_secret_...'
--   );
-- ============================================================

begin;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'cron_service_key') then
    raise exception 'Falta o segredo cron_service_key no Vault. Ver as instruções no topo deste ficheiro.';
  end if;
end $$;

-- Usada por notificar-quotas-expiradas para não avisar duas vezes.
alter table public.quotas add column if not exists notificado_expirado_em timestamptz;

-- Remove os agendamentos antigos (o de quotas tinha o URL por preencher).
select cron.unschedule(jobid)
from cron.job
where jobname in ('notificar-aniversarios-diario', 'notificar-quotas-expiradas-diario');

-- 08:00 UTC = 08:00/09:00 em Portugal (inverno/verão).
select cron.schedule(
  'notificar-aniversarios-diario',
  '0 8 * * *',
  $cmd$
  select net.http_post(
    url := 'https://klgfzahyvngfgxzfninp.supabase.co/functions/v1/notificar-aniversarios',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

select cron.schedule(
  'notificar-quotas-expiradas-diario',
  '5 8 * * *',
  $cmd$
  select net.http_post(
    url := 'https://klgfzahyvngfgxzfninp.supabase.co/functions/v1/notificar-quotas-expiradas',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

commit;
