-- One-time, idempotent data repair for the verified import-default bug.
-- No messages are sent, no schema changes are made, and no automatic campaign is enabled.
-- Only automated imports created by an earlier send to this exact consented audience qualify.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $repair$
declare
  v_target uuid := 'fcc8a224-1ddd-4e60-aa9b-e70781d81d3a';
  v_audience uuid;
  v_contacts uuid[];
  v_requeued integer;
  v_corrected integer;
begin
  select audience_id into v_audience from public.whatsapp_campaigns
  where id=v_target and status='sending' and auto_send=false and sent_count=0
  for update;
  if v_audience is null then raise exception 'Target campaign changed; review before repairing.'; end if;
  perform 1 from public.whatsapp_campaigns where audience_id=v_audience order by id for update;
  if exists(select 1 from public.whatsapp_campaigns where audience_id=v_audience and auto_send)
    or exists(select 1 from public.whatsapp_campaign_recipients r join public.whatsapp_campaigns c on c.id=r.campaign_id
      where c.audience_id=v_audience and r.status='processing')
  then raise exception 'Audience is being processed; stop and review the repair.'; end if;

  select coalesce(array_agg(ct.id),array[]::uuid[]) into v_contacts
  from public.whatsapp_contacts ct
  where ct.source='import' and ct.created_by is null and ct.opted_in=false and ct.is_active
    and ct.custom_fields='{}'::jsonb
    and exists (
      select 1 from public.whatsapp_campaign_recipients old_r
      join public.whatsapp_campaigns old_c on old_c.id=old_r.campaign_id
      join public.whatsapp_audience_recipients ar on ar.id=old_r.audience_recipient_id
      join public.whatsapp_audiences a on a.id=ar.audience_id
      where old_r.phone=ct.phone and old_r.contact_id=ct.id and old_r.status='sent'
        and old_r.external_message_id is not null and old_c.status='completed'
        and old_c.audience_id=v_audience and a.id=v_audience and a.source='upload'
        and a.filters->>'consentAttested'='true' and ar.consent
        -- Worker created this contact during this successful send, not an admin edit.
        and ct.created_at >= old_c.created_at and ct.created_at <= old_r.updated_at
        and exists(select 1 from public.whatsapp_messages m
          where m.campaign_id=old_c.id and m.contact_id=ct.id
            and m.external_message_id=old_r.external_message_id and m.direction='outbound')
    )
    and not exists(select 1 from public.audit_logs log where log.action='save_whatsapp_contact'
      and (log.entity_id=ct.id or log.metadata->>'phone'=ct.phone));
  if cardinality(v_contacts)>191 then raise exception 'Unexpected candidate count.'; end if;

  update public.whatsapp_contacts ct
  set opted_in=true,
    custom_fields=jsonb_build_object('whatsapp_consent',jsonb_build_object(
      'source','saved_audience','audience_id',v_audience,'repair','20261016-import-default')),
    updated_at=now()
  where ct.id=any(v_contacts) and ct.opted_in=false and ct.is_active;
  get diagnostics v_corrected = row_count;

  insert into public.audit_logs(actor_role,action,entity_type,entity_id,metadata)
  select 'system','repair_whatsapp_import_consent','whatsapp_contact',ct.id,
    jsonb_build_object('previous_opted_in',false,'source','saved_audience','audience_id',v_audience,
      'reason','Automated import default contradicted existing attested audience consent')
  from public.whatsapp_contacts ct where ct.id=any(v_contacts);

  update public.whatsapp_campaign_recipients r
  set status='queued',error_message=null,claimed_at=null,updated_at=now()
  from public.whatsapp_contacts ct
  where r.campaign_id=v_target and r.phone=ct.phone and ct.id=any(v_contacts)
    and r.status='skipped' and r.external_message_id is null
    and r.error_message='Contact withdrew WhatsApp permission or became inactive.'
    and not exists(select 1 from public.whatsapp_messages m
      where m.campaign_id=v_target and m.direction='outbound'
        and (m.contact_id=ct.id or m.metadata->>'campaign_recipient_id'=r.id::text));
  get diagnostics v_requeued = row_count;
  if v_requeued>165 then raise exception 'Unexpected recovery count.'; end if;

  update public.whatsapp_campaigns
  set skipped_count=(select count(*) from public.whatsapp_campaign_recipients
      where campaign_id=v_target and status in ('skipped','uncertain')),
    updated_at=now()
  where id=v_target;
  if v_corrected>0 or v_requeued>0 then
    insert into public.audit_logs(actor_role,action,entity_type,entity_id,metadata)
    values('system','repair_whatsapp_campaign_import_defaults','whatsapp_campaign',v_target,
      jsonb_build_object('contacts_repaired',v_corrected,'recipients_requeued',v_requeued,
        'audience_id',v_audience,'auto_send',false));
  end if;
end;
$repair$;
commit;
select name,status,auto_send,sent_count,skipped_count,
  recipient_count-sent_count-failed_count-skipped_count as waiting
from public.whatsapp_campaigns where id='fcc8a224-1ddd-4e60-aa9b-e70781d81d3a';
