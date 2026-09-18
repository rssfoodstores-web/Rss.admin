-- Mirror of the canonical migration in Rss.site.
insert into public.whatsapp_contacts (full_name, phone, source, opted_in, is_active, last_message_at)
select distinct on (r.phone)
  coalesce(nullif(trim(r.fields ->> 'customer_name'), ''), r.phone),
  r.phone,
  'import',
  true,
  true,
  r.updated_at
from public.whatsapp_campaign_recipients r
where r.status = 'sent' and r.contact_id is null
order by r.phone, r.updated_at desc
on conflict (phone) do nothing;

update public.whatsapp_campaign_recipients r
set contact_id = c.id
from public.whatsapp_contacts c
where r.contact_id is null and r.phone = c.phone;

update public.whatsapp_messages m
set contact_id = c.id
from public.whatsapp_contacts c
where m.contact_id is null and m.metadata ->> 'phone' = c.phone;

create or replace function public.whatsapp_assign_conversation(
  p_contact_id uuid,
  p_assignee_id uuid,
  p_actor_id uuid,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.whatsapp_conversation_assignments
    (contact_id, assigned_to, assigned_at, status, updated_at)
  values
    (p_contact_id, p_assignee_id,
     case when p_assignee_id is null then null else now() end,
     'open', now())
  on conflict (contact_id) do update
  set assigned_to = excluded.assigned_to,
      assigned_at = excluded.assigned_at,
      updated_at = now()
  where public.whatsapp_conversation_assignments.assigned_to is null
     or public.whatsapp_conversation_assignments.assigned_to = p_actor_id
     or p_force;

  return found;
end;
$$;

revoke all on function public.whatsapp_assign_conversation(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.whatsapp_assign_conversation(uuid, uuid, uuid, boolean) to service_role;
