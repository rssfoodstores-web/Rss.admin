-- RSS WhatsApp audience snapshots and resumable campaign delivery.
create table if not exists public.whatsapp_audiences (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 120),
    source text not null check (source in ('database', 'upload')),
    filters jsonb not null default '{}'::jsonb,
    columns text[] not null,
    row_count integer not null default 0,
    consent_count integer not null default 0,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_audience_recipients (
    id uuid primary key default gen_random_uuid(),
    audience_id uuid not null references public.whatsapp_audiences(id) on delete cascade,
    phone text not null,
    consent boolean not null default false,
    profile_id uuid references public.profiles(id) on delete set null,
    contact_id uuid references public.whatsapp_contacts(id) on delete set null,
    fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(audience_id, phone)
);
create index if not exists whatsapp_audience_recipients_audience_idx on public.whatsapp_audience_recipients(audience_id, id);

create table if not exists public.whatsapp_campaign_recipients (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
    audience_recipient_id uuid references public.whatsapp_audience_recipients(id) on delete set null,
    phone text not null,
    contact_id uuid references public.whatsapp_contacts(id) on delete set null,
    fields jsonb not null,
    status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'skipped', 'uncertain')),
    error_message text,
    external_message_id text,
    attempts integer not null default 0,
    claimed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(campaign_id, phone)
);
create index if not exists whatsapp_campaign_recipients_queue_idx on public.whatsapp_campaign_recipients(status, campaign_id, created_at);
alter table public.whatsapp_campaigns add column if not exists audience_id uuid references public.whatsapp_audiences(id) on delete set null;
alter table public.whatsapp_campaigns add column if not exists skipped_count integer not null default 0;

alter table public.whatsapp_audiences enable row level security;
alter table public.whatsapp_audience_recipients enable row level security;
alter table public.whatsapp_campaign_recipients enable row level security;
revoke all on public.whatsapp_audiences, public.whatsapp_audience_recipients, public.whatsapp_campaign_recipients from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_audiences, public.whatsapp_audience_recipients, public.whatsapp_campaign_recipients to service_role;

create or replace function public.whatsapp_audience_phone(p_phone text)
returns text language sql immutable set search_path = ''
as $$
    select case
      when p_phone is null or regexp_replace(p_phone, '[^0-9]', '', 'g') = '' then ''
      when btrim(p_phone) like '+%' then '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
      when regexp_replace(p_phone, '[^0-9]', '', 'g') like '234%' then '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
      when regexp_replace(p_phone, '[^0-9]', '', 'g') like '0%' then '+234' || substr(regexp_replace(p_phone, '[^0-9]', '', 'g'), 2)
      when length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 10 then '+234' || regexp_replace(p_phone, '[^0-9]', '', 'g')
      else '+' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    end;
$$;

create or replace function public.whatsapp_audience_rows(p_filters jsonb default '{}'::jsonb)
returns table (
    row_key text, profile_id uuid, contact_id uuid, phone text, consent boolean,
    fields jsonb, total_count bigint, consent_count bigint
)
language sql stable security definer set search_path = ''
as $$
with candidates as (
  select
    'rss:' || p.id::text as row_key, p.id as profile_id, c.id as contact_id,
    public.whatsapp_audience_phone(coalesce(nullif(c.phone, ''), p.phone)) as phone,
    coalesce(c.opted_in and c.is_active, false) as consent,
    coalesce(p.full_name, '') as full_name,
    coalesce(c.email, u.email, '') as email,
    coalesce(o.id::text, '') as order_id,
    coalesce(o.status::text, '') as order_status,
    coalesce(p.state, '') as state,
    btrim(concat_ws(' ', p.house_number, p.street_address, p.address)) as address,
    coalesce(r.roles, array[]::text[]) as roles,
    case
      when u.raw_app_meta_data->>'creation_method' = 'admin_password_account' then 'admin'
      when u.raw_app_meta_data->>'provider' = 'google' or coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb) ? 'google' then 'google'
      when u.phone_confirmed_at is not null then 'phone'
      when u.email_confirmed_at is not null then 'email'
      else 'unknown'
    end as registration_method,
    case when u.raw_app_meta_data->>'creation_method' = 'admin_password_account' then 'admin' else 'rss' end as source
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.whatsapp_contacts c on c.profile_id = p.id
  left join lateral (select array_agg(ur.role::text order by ur.role) as roles from public.user_roles ur where ur.user_id = p.id) r on true
  left join lateral (select ord.id, ord.status from public.orders ord where ord.customer_id = p.id order by ord.created_at desc, ord.id desc limit 1) o on true
  union all
  select
    'dashboard:' || c.id::text, null::uuid, c.id,
    public.whatsapp_audience_phone(c.phone), c.opted_in and c.is_active,
    c.full_name, coalesce(c.email, ''), coalesce(c.custom_fields->>'order_number', ''),
    coalesce(c.custom_fields->>'order_status', ''), coalesce(c.custom_fields->>'state', ''),
    coalesce(c.custom_fields->>'address', ''), array['customer']::text[], 'unknown', 'dashboard'
  from public.whatsapp_contacts c where c.profile_id is null
), filtered as (
  select * from candidates x
  where (coalesce(p_filters->>'origin', 'all') = 'all' or x.source = p_filters->>'origin')
    and (coalesce(p_filters->>'registration', 'all') = 'all' or x.registration_method = p_filters->>'registration')
    and (jsonb_array_length(coalesce(p_filters->'roles', '[]'::jsonb)) = 0
       or exists(select 1 from jsonb_array_elements_text(p_filters->'roles') role where role.value = any(x.roles)))
    and (coalesce((p_filters->'requirements'->>'name')::boolean, false) = false or btrim(x.full_name) <> '')
    and (coalesce((p_filters->'requirements'->>'phone')::boolean, false) = false or x.phone ~ '^\+[1-9][0-9]{7,14}$')
    and (coalesce((p_filters->'requirements'->>'email')::boolean, false) = false or btrim(x.email) <> '')
    and (coalesce((p_filters->'requirements'->>'order')::boolean, false) = false or x.order_id <> '')
    and (coalesce((p_filters->'requirements'->>'consent')::boolean, false) = false or x.consent)
    and (
      btrim(coalesce(p_filters->>'search', '')) = ''
      or x.full_name ilike '%' || btrim(p_filters->>'search') || '%'
      or x.email ilike '%' || btrim(p_filters->>'search') || '%'
      or regexp_replace(x.phone, '[^0-9]', '', 'g') like '%' || regexp_replace(p_filters->>'search', '[^0-9]', '', 'g') || '%'
         and regexp_replace(p_filters->>'search', '[^0-9]', '', 'g') <> ''
    )
)
select x.row_key, x.profile_id, x.contact_id, x.phone, x.consent,
  jsonb_build_object(
    'full_name', x.full_name, 'phone', x.phone, 'email', x.email,
    'roles', array_to_string(x.roles, ', '), 'source',
      case x.source when 'rss' then 'Registered on RSS' when 'admin' then 'Added on Add User page' else 'Added in WhatsApp dashboard' end,
    'registration_method', x.registration_method, 'state', x.state, 'address', x.address,
    'order_number', case when x.order_id = '' then '' else 'RSS-' || upper(left(x.order_id, 8)) end,
    'order_status', x.order_status
  ) as fields,
  count(*) over() as total_count,
  count(*) filter (where x.consent) over() as consent_count
from filtered x order by x.row_key;
$$;

create or replace function public.whatsapp_save_database_audience(
    p_name text, p_filters jsonb, p_columns text[], p_actor uuid
) returns uuid language plpgsql set search_path = ''
as $$
declare v_id uuid;
begin
  if length(btrim(p_name)) not between 1 and 120 or cardinality(p_columns) < 1 then
    raise exception 'Name the audience and select at least one column.';
  end if;
  insert into public.whatsapp_audiences(name, source, filters, columns, created_by)
  values(btrim(p_name), 'database', p_filters, p_columns, p_actor) returning id into v_id;
  insert into public.whatsapp_audience_recipients(audience_id, phone, consent, profile_id, contact_id, fields)
  select distinct on (r.phone) v_id, r.phone, r.consent, r.profile_id, r.contact_id,
    (select jsonb_object_agg(k, coalesce(r.fields->k, '""'::jsonb)) from unnest(p_columns) k)
  from public.whatsapp_audience_rows(p_filters) r
  where r.phone ~ '^\+[1-9][0-9]{7,14}$'
  order by r.phone, r.consent desc, r.row_key;
  update public.whatsapp_audiences a set
    row_count = (select count(*) from public.whatsapp_audience_recipients where audience_id = v_id),
    consent_count = (select count(*) from public.whatsapp_audience_recipients where audience_id = v_id and consent)
  where a.id = v_id;
  return v_id;
end;
$$;

create or replace function public.whatsapp_claim_campaign_recipients(p_campaign_id uuid, p_limit integer default 100)
returns setof public.whatsapp_campaign_recipients
language plpgsql set search_path = ''
as $$
begin
  return query
  with claimed as (
    select r.id from public.whatsapp_campaign_recipients r
    join public.whatsapp_campaigns c on c.id = r.campaign_id
    where r.campaign_id = p_campaign_id and r.status = 'queued' and c.status = 'sending'
    order by r.created_at, r.id for update of r skip locked limit least(greatest(p_limit, 1), 100)
  )
  update public.whatsapp_campaign_recipients r
    set status = 'processing', claimed_at = now(), attempts = attempts + 1, updated_at = now()
  from claimed where r.id = claimed.id returning r.*;
end;
$$;

revoke all on function public.whatsapp_audience_phone(text),
  public.whatsapp_audience_rows(jsonb),
  public.whatsapp_save_database_audience(text,jsonb,text[],uuid),
  public.whatsapp_claim_campaign_recipients(uuid,integer) from public, anon, authenticated;
grant execute on function public.whatsapp_audience_phone(text),
  public.whatsapp_audience_rows(jsonb),
  public.whatsapp_save_database_audience(text,jsonb,text[],uuid),
  public.whatsapp_claim_campaign_recipients(uuid,integer) to service_role;

create or replace function public.whatsapp_audience_ready_count(
  p_audience_id uuid, p_variables jsonb, p_mapping jsonb
) returns integer language sql stable set search_path = ''
as $$
  select count(*)::integer from public.whatsapp_audience_recipients r
  where r.audience_id = p_audience_id and r.consent
    and not exists (
      select 1 from jsonb_array_elements(p_variables) v
      where coalesce(btrim(r.fields->>(p_mapping->>(v->>'name'))), '') = ''
    );
$$;

create or replace function public.whatsapp_prepare_campaign(
  p_audience_id uuid, p_template_id uuid, p_name text, p_mapping jsonb, p_actor uuid, p_request_key uuid
) returns uuid language plpgsql set search_path = ''
as $$
declare v_template public.whatsapp_templates%rowtype; v_campaign uuid; v_total integer; v_ready integer;
begin
  if length(btrim(p_name)) not between 1 and 120 then raise exception 'Name the campaign.'; end if;
  select * into v_template from public.whatsapp_templates where id = p_template_id and status = 'approved';
  if not found then raise exception 'Choose an approved template.'; end if;
  if not exists(select 1 from public.whatsapp_audiences where id = p_audience_id) then raise exception 'Audience not found.'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_template.variables) v
    where nullif(p_mapping->>(v->>'name'), '') is null
      or not (p_mapping->>(v->>'name')) = any(coalesce((select columns from public.whatsapp_audiences where id = p_audience_id), array[]::text[]))
  ) then raise exception 'Map every template variable to an included audience column.'; end if;
  select count(*) into v_total from public.whatsapp_audience_recipients where audience_id = p_audience_id;
  select public.whatsapp_audience_ready_count(p_audience_id, v_template.variables, p_mapping) into v_ready;
  if v_ready = 0 then raise exception 'No consented recipients have all required details.'; end if;
  insert into public.whatsapp_campaigns(
    name, template_id, audience_id, status, variable_defaults, recipient_count, skipped_count,
    created_by, approved_by, request_key
  ) values (
    btrim(p_name), p_template_id, p_audience_id, 'sending', p_mapping, v_ready, v_total - v_ready,
    p_actor, p_actor, p_request_key
  ) returning id into v_campaign;
  insert into public.whatsapp_campaign_recipients(
    campaign_id, audience_recipient_id, phone, contact_id, fields, status, error_message
  )
  select v_campaign, r.id, r.phone, r.contact_id, r.fields,
    case when r.consent and not exists (
      select 1 from jsonb_array_elements(v_template.variables) v
      where coalesce(btrim(r.fields->>(p_mapping->>(v->>'name'))), '') = ''
    ) then 'queued' else 'skipped' end,
    case when not r.consent then 'No WhatsApp consent'
      else 'Missing required template information' end
  from public.whatsapp_audience_recipients r where r.audience_id = p_audience_id;
  return v_campaign;
exception when unique_violation then
  select id into v_campaign from public.whatsapp_campaigns where request_key = p_request_key;
  if v_campaign is null then raise; end if;
  return v_campaign;
end;
$$;
alter table public.whatsapp_campaigns add column if not exists request_key uuid unique;
revoke all on function public.whatsapp_audience_ready_count(uuid,jsonb,jsonb),
  public.whatsapp_prepare_campaign(uuid,uuid,text,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_audience_ready_count(uuid,jsonb,jsonb),
  public.whatsapp_prepare_campaign(uuid,uuid,text,jsonb,uuid,uuid) to service_role;
