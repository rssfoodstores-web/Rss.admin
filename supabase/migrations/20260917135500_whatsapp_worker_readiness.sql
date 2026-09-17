create or replace function public.whatsapp_campaign_scheduler_ready()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from cron.job j
    where j.jobname = 'rss-whatsapp-campaign-worker' and j.active
  ) and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'rss_whatsapp_worker_url'
      and s.decrypted_secret ~ '^https://[a-zA-Z0-9.-]+/api/jobs/whatsapp-campaigns$'
  ) and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'rss_whatsapp_worker_secret'
      and length(s.decrypted_secret) >= 32
  );
$$;

revoke all on function public.whatsapp_campaign_scheduler_ready() from public, anon, authenticated;
grant execute on function public.whatsapp_campaign_scheduler_ready() to service_role;
