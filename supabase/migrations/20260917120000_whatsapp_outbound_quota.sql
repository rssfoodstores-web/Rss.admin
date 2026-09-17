-- RSS's conservative account-wide safety cap. This is not Meta's live usage balance.
create table if not exists public.whatsapp_outbound_quota (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  reserved_at timestamptz not null default now()
);

create index if not exists whatsapp_outbound_quota_recent_idx
  on public.whatsapp_outbound_quota (reserved_at, phone);

alter table public.whatsapp_outbound_quota enable row level security;
revoke all on public.whatsapp_outbound_quota from public, anon, authenticated;
grant select, insert on public.whatsapp_outbound_quota to service_role;

-- Account for sends already logged by RSS before this guard was installed.
insert into public.whatsapp_outbound_quota (phone, reserved_at)
select distinct on (normalized.phone) normalized.phone, m.created_at
from public.whatsapp_messages m
left join public.whatsapp_contacts c on c.id = m.contact_id
cross join lateral (
  select public.whatsapp_audience_phone(coalesce(nullif(m.metadata->>'phone', ''), c.phone)) as phone
) normalized
where m.direction = 'outbound'
  and m.status in ('sent', 'delivered', 'read')
  and m.created_at > now() - interval '24 hours'
  and normalized.phone ~ '^\+[1-9][0-9]{7,14}$'
order by normalized.phone, m.created_at desc;

create or replace function public.whatsapp_outbound_quota_status()
returns table (used_count integer, next_available_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer, min(q.reserved_at) + interval '24 hours'
  from public.whatsapp_outbound_quota q
  where q.reserved_at > now() - interval '24 hours';
$$;

create or replace function public.whatsapp_reserve_outbound_recipient(p_phone text, p_limit integer default 250)
returns table (allowed boolean, used_count integer, next_available_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_used integer; v_next timestamptz; v_phone text;
begin
  v_phone := public.whatsapp_audience_phone(p_phone);
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid WhatsApp phone number.';
  end if;
  if p_limit < 1 or p_limit > 250 then
    raise exception 'RSS safety limit cannot exceed 250.';
  end if;

  -- Serialize reservations made by parallel chats and campaigns.
  perform pg_catalog.pg_advisory_xact_lock(148321, 1);
  select count(*)::integer, min(q.reserved_at) + interval '24 hours'
  into v_used, v_next
  from public.whatsapp_outbound_quota q
  where q.reserved_at > now() - interval '24 hours';

  -- Fail closed once the allowance is full, including repeat messages.
  if v_used >= p_limit then
    return query select false, v_used, v_next;
    return;
  end if;

  -- The cap is for unique recipients, not individual messages.
  if not exists (
    select 1 from public.whatsapp_outbound_quota q
    where q.phone = v_phone and q.reserved_at > now() - interval '24 hours'
  ) then
    insert into public.whatsapp_outbound_quota (phone) values (v_phone);
    v_used := v_used + 1;
    select min(q.reserved_at) + interval '24 hours' into v_next
    from public.whatsapp_outbound_quota q
    where q.reserved_at > now() - interval '24 hours';
  end if;
  return query select true, v_used, v_next;
end;
$$;

revoke all on function public.whatsapp_outbound_quota_status(),
  public.whatsapp_reserve_outbound_recipient(text, integer) from public, anon, authenticated;
grant execute on function public.whatsapp_outbound_quota_status(),
  public.whatsapp_reserve_outbound_recipient(text, integer) to service_role;
