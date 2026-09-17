-- Progress denominator must include skipped recipients as well as sendable recipients.
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
    btrim(p_name), p_template_id, p_audience_id, 'sending', p_mapping, v_total, v_total - v_ready,
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

update public.whatsapp_campaigns c set recipient_count = (
  select count(*) from public.whatsapp_campaign_recipients r where r.campaign_id = c.id
) where c.audience_id is not null;
