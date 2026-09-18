-- Mirror of the canonical migration in Rss.site.
create table if not exists public.whatsapp_inbound_receipts (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  outcome text not null check (outcome in ('received', 'ignored', 'stored', 'failed')),
  message_count integer not null default 0,
  error_code text,
  payload_keys text[] not null default '{}'
);

create index if not exists whatsapp_inbound_receipts_recent_idx
  on public.whatsapp_inbound_receipts (received_at desc);

alter table public.whatsapp_inbound_receipts enable row level security;
revoke all on public.whatsapp_inbound_receipts from anon, authenticated;
grant select, insert, update on public.whatsapp_inbound_receipts to service_role;
grant usage, select on sequence public.whatsapp_inbound_receipts_id_seq to service_role;
