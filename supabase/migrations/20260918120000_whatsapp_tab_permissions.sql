-- Mirror of the canonical migration in Rss.site.
do $$
declare
  previously_missing boolean;
begin
  select not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_access_grants'
      and column_name = 'can_view_home'
  ) into previously_missing;

  alter table public.whatsapp_access_grants
    add column if not exists can_view_home boolean not null default false,
    add column if not exists can_use_chat boolean not null default false,
    add column if not exists can_view_health boolean not null default false,
    add column if not exists can_use_builder boolean not null default false;

  if previously_missing then
    update public.whatsapp_access_grants
    set can_view_home = true,
        can_use_chat = true,
        can_view_health = true,
        can_use_builder = can_send_campaigns;
  end if;
end $$;
