-- A newly queued campaign is manual-only until an admin explicitly starts automation.
alter table public.whatsapp_campaigns
  add column if not exists auto_send boolean not null default false;
