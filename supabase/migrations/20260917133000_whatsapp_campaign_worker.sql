alter table public.whatsapp_campaigns
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists last_worker_run_at timestamptz;

-- The scheduler only invokes the protected admin endpoint when both Vault values exist.
-- The same secret must be configured as CRON_SECRET on the admin deployment.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.whatsapp_dispatch_campaign_worker()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'rss_whatsapp_worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'rss_whatsapp_worker_secret';
  if v_url is null or v_secret is null or length(v_secret) < 32
     or v_url !~ '^https://[a-zA-Z0-9.-]+/api/jobs/whatsapp-campaigns$' then
    return;
  end if;
  perform net.http_get(
    url := v_url,
    headers := pg_catalog.jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.whatsapp_dispatch_campaign_worker() from public, anon, authenticated;

select cron.schedule(
  'rss-whatsapp-campaign-worker',
  '* * * * *',
  'select public.whatsapp_dispatch_campaign_worker();'
);
