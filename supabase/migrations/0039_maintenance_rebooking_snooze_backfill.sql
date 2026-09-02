-- Automotive maintenance rebooking linkage, suppression, snooze, and safe
-- legacy backfill planning/apply boundaries. No backfill is run here.

-- Superseded by the organization-scoped dry-run/apply boundary below. Keep the
-- old function for migration compatibility but remove its operational grant.
revoke execute on function public.backfill_vehicle_service_records(integer) from service_role;

alter table public.vehicle_service_records
  add column source text not null default 'live' check (source in ('live','legacy_backfill')),
  add column backfilled_at timestamptz;

alter table public.vehicle_maintenance_due
  add column appointment_id uuid references public.appointments(id) on delete set null,
  add column snoozed_until timestamptz,
  add column snoozed_by uuid references auth.users(id) on delete set null,
  add column snooze_reason text check (snooze_reason is null or char_length(snooze_reason)<=500),
  add column notifications_enabled boolean not null default true,
  add column source text not null default 'live' check (source in ('live','legacy_backfill')),
  add column backfilled_at timestamptz;

create index vehicle_maintenance_due_appointment_idx on public.vehicle_maintenance_due(appointment_id)
  where appointment_id is not null;

create function public.is_maintenance_appointment_active(p_status public.appointment_status)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select p_status in ('requested','confirmed','checked_in','queued')
$$;

create function public.maintenance_reminder_eligibility(
  p_lifecycle_status text,p_vehicle_archived boolean,p_appointment_status public.appointment_status,
  p_snoozed_until timestamptz,p_notifications_enabled boolean,p_now timestamptz default now()
) returns text language sql stable set search_path=public,pg_temp as $$
  select case
    when p_lifecycle_status<>'active' then 'MAINTENANCE_COMPLETED'
    when p_vehicle_archived then 'VEHICLE_INACTIVE'
    when public.is_maintenance_appointment_active(p_appointment_status) then 'ACTIVE_RELATED_APPOINTMENT'
    when p_snoozed_until is not null and p_snoozed_until>p_now then 'SNOOZED'
    when not p_notifications_enabled then 'LEGACY_BACKFILL_NOT_ACTIVATED'
    else 'ELIGIBLE' end
$$;

create or replace view public.vehicle_maintenance_directory with (security_invoker=true) as
select
  due.id,due.organization_id,due.branch_id,due.vehicle_id,due.service_id,due.source_service_record_id,
  due.source_job_order_id,due.lifecycle_status,due.last_service_at,due.last_service_odometer_km,
  due.interval_months_snapshot,due.interval_km_snapshot,due.reminder_lead_days_snapshot,
  due.next_due_at,due.next_due_odometer_km,due.dismissed_at,due.dismissed_by,due.dismiss_reason,
  due.satisfied_at,due.created_at,due.updated_at,
  vehicle.customer_id,vehicle.make,vehicle.model,vehicle.plate_number,
  vehicle.odometer_km current_odometer_km,vehicle.is_archived vehicle_is_archived,
  customer.full_name customer_name,service.name service_name,branch.name branch_name,
  case
    when due.lifecycle_status<>'active' then due.lifecycle_status
    when (due.next_due_at is not null and due.next_due_at<now()-interval '1 day')
      or (due.next_due_odometer_km is not null and vehicle.odometer_km>due.next_due_odometer_km) then 'overdue'
    when (due.next_due_at is not null and due.next_due_at<=now())
      or (due.next_due_odometer_km is not null and vehicle.odometer_km>=due.next_due_odometer_km) then 'due'
    when due.next_due_at is not null and due.next_due_at<=now()+make_interval(days=>due.reminder_lead_days_snapshot) then 'due_soon'
    else 'upcoming'
  end due_status,
  due.appointment_id,due.snoozed_until,due.snoozed_by,due.snooze_reason,due.notifications_enabled,
  due.source,due.backfilled_at,appointment.status appointment_status,appointment.starts_at appointment_starts_at,
  public.maintenance_reminder_eligibility(due.lifecycle_status,vehicle.is_archived,appointment.status,
    due.snoozed_until,due.notifications_enabled,now()) reminder_eligibility
from public.vehicle_maintenance_due due
join public.vehicles vehicle on vehicle.id=due.vehicle_id
join public.customers customer on customer.id=vehicle.customer_id
join public.services service on service.id=due.service_id
join public.branches branch on branch.id=due.branch_id
left join public.appointments appointment on appointment.id=due.appointment_id;

create function public.get_active_maintenance_appointment(
  p_due_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[]
) returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due; appointment_row public.appointments;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_due_id;
  if due_row.id is null or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  if due_row.organization_id<>(select organization_id from public.branches where id=p_branch_id)
    or due_row.vehicle_id is distinct from p_vehicle_id
    or p_customer_id is distinct from (select customer_id from public.vehicles where id=due_row.vehicle_id and organization_id=due_row.organization_id)
    or not due_row.service_id=any(p_service_ids)
  then raise exception 'Appointment does not match this maintenance item' using errcode='42501'; end if;
  select * into appointment_row from public.appointments where id=due_row.appointment_id;
  if appointment_row.id is not null and public.is_maintenance_appointment_active(appointment_row.status) then return appointment_row.id; end if;
  return null;
end $$;
grant execute on function public.get_active_maintenance_appointment(uuid,uuid,uuid,uuid,uuid[]) to authenticated;
revoke execute on function public.get_active_maintenance_appointment(uuid,uuid,uuid,uuid,uuid[]) from public,anon;

create function public.save_maintenance_appointment(
  p_maintenance_due_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],
  p_starts_at timestamptz,p_staff_membership_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',
  p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due; linked public.appointments; saved_id uuid;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_maintenance_due_id for update;
  if due_row.id is null or due_row.lifecycle_status<>'active'
    or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  if due_row.organization_id<>(select organization_id from public.branches where id=p_branch_id)
    or due_row.vehicle_id is distinct from p_vehicle_id
    or p_customer_id is distinct from (select customer_id from public.vehicles where id=due_row.vehicle_id and organization_id=due_row.organization_id)
    or not due_row.service_id=any(p_service_ids)
  then raise exception 'Appointment does not match this maintenance item' using errcode='42501'; end if;

  select * into linked from public.appointments where id=due_row.appointment_id;
  if linked.id is not null and public.is_maintenance_appointment_active(linked.status) then return linked.id; end if;

  saved_id:=public.save_appointment_with_assignments(null,p_branch_id,p_customer_id,p_vehicle_id,p_service_ids,p_starts_at,
    p_staff_membership_ids,p_resource_ids,p_customer_note,p_internal_note,p_allow_conflict);
  update public.vehicle_maintenance_due set appointment_id=saved_id where id=due_row.id;
  update public.notification_outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
    eligibility_reason='ACTIVE_RELATED_APPOINTMENT'
    where reference_type='vehicle_maintenance_due' and reference_id=due_row.id and status in ('pending','processing');
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.appointment_linked',
    jsonb_build_object('appointment_id',saved_id));
  return saved_id;
end $$;
revoke all on function public.save_maintenance_appointment(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) from public,anon;
grant execute on function public.save_maintenance_appointment(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) to authenticated;

create function public.on_maintenance_appointment_status_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row record;
begin
  if old.status is not distinct from new.status then return new; end if;
  for due_row in select id,organization_id from public.vehicle_maintenance_due where appointment_id=new.id and lifecycle_status='active'
  loop
    if public.is_maintenance_appointment_active(old.status) and not public.is_maintenance_appointment_active(new.status) then
      insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.appointment_inactivated',
        jsonb_build_object('appointment_id',new.id,'appointment_status',new.status));
    elsif not public.is_maintenance_appointment_active(old.status) and public.is_maintenance_appointment_active(new.status) then
      update public.notification_outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
        eligibility_reason='ACTIVE_RELATED_APPOINTMENT'
        where reference_type='vehicle_maintenance_due' and reference_id=due_row.id and status in ('pending','processing');
    end if;
  end loop;
  return new;
end $$;
create trigger maintenance_appointment_status_changed after update of status on public.appointments
for each row execute function public.on_maintenance_appointment_status_changed();

create function public.set_vehicle_maintenance_snooze(p_due_id uuid,p_snoozed_until timestamptz,p_reason text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_due_id for update;
  if due_row.id is null or due_row.lifecycle_status<>'active'
    or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  if p_snoozed_until is null or p_snoozed_until<=now() or p_snoozed_until>now()+interval '1 year'
  then raise exception 'Snooze until must be a future date within one year'; end if;
  if char_length(coalesce(p_reason,''))>500 then raise exception 'Snooze reason is too long'; end if;
  update public.vehicle_maintenance_due set snoozed_until=p_snoozed_until,snoozed_by=auth.uid(),
    snooze_reason=nullif(trim(coalesce(p_reason,'')),'') where id=due_row.id;
  update public.notification_outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
    eligibility_reason='MAINTENANCE_SNOOZED'
    where reference_type='vehicle_maintenance_due' and reference_id=due_row.id and status in ('pending','processing');
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.reminder_snoozed',
    jsonb_strip_nulls(jsonb_build_object('snoozed_until',p_snoozed_until,'reason',nullif(trim(coalesce(p_reason,'')),''))));
end $$;

create function public.resume_vehicle_maintenance_reminders(p_due_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_due_id for update;
  if due_row.id is null or due_row.lifecycle_status<>'active'
    or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  update public.vehicle_maintenance_due set snoozed_until=null,snoozed_by=null,snooze_reason=null where id=due_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.reminder_resumed','{}'::jsonb);
end $$;

create function public.activate_backfilled_maintenance_notifications(p_due_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_due_id for update;
  if due_row.id is null or due_row.source<>'legacy_backfill'
    or not public.has_org_role(due_row.organization_id,array['owner','manager']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Backfilled maintenance item not found' using errcode='42501'; end if;
  update public.vehicle_maintenance_due set notifications_enabled=true where id=due_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.backfill_notifications_activated','{}'::jsonb);
end $$;

grant execute on function public.set_vehicle_maintenance_snooze(uuid,timestamptz,text),
  public.resume_vehicle_maintenance_reminders(uuid),public.activate_backfilled_maintenance_notifications(uuid) to authenticated;
revoke execute on function public.set_vehicle_maintenance_snooze(uuid,timestamptz,text),
  public.resume_vehicle_maintenance_reminders(uuid),public.activate_backfilled_maintenance_notifications(uuid) from public,anon;

create function public.audit_vehicle_maintenance_satisfaction() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.lifecycle_status='active' and new.lifecycle_status='satisfied' then
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(new.organization_id,auth.uid(),'vehicle_maintenance_due',new.id,'maintenance.satisfied',
      jsonb_build_object('source_job_order_id',new.source_job_order_id,'service_id',new.service_id));
  end if;
  return new;
end $$;
create trigger vehicle_maintenance_satisfaction_audit after update of lifecycle_status on public.vehicle_maintenance_due
for each row execute function public.audit_vehicle_maintenance_satisfaction();

create or replace function public.enqueue_due_vehicle_maintenance_reminders(p_limit integer default 100) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_limit<1 or p_limit>500 then raise exception 'Limit must be between 1 and 500'; end if;
  with candidates as (
    select directory.*,
      case when directory.due_status='due_soon' then 'DUE_SOON'
        when directory.due_status='due' then 'DUE'
        when directory.due_status='overdue' then 'OVERDUE' end reminder_stage,
      organization.name business_name,branch.phone branch_phone,branch.email branch_email,
      customer.email customer_email,customer.phone customer_phone,
      preferences.email_opt_in,preferences.sms_opt_in
    from public.vehicle_maintenance_directory directory
    join public.organizations organization on organization.id=directory.organization_id
    join public.branches branch on branch.id=directory.branch_id and branch.is_active
    join public.customers customer on customer.id=directory.customer_id and not customer.is_archived
    left join public.customer_communication_preferences preferences
      on preferences.organization_id=directory.organization_id and preferences.customer_id=directory.customer_id
    where directory.lifecycle_status='active' and directory.reminder_eligibility='ELIGIBLE'
      and directory.due_status in ('due_soon','due','overdue')
    order by directory.next_due_at nulls last,directory.created_at limit p_limit
  ), channels as (
    select candidate.*,channel,
      case when channel='email' then case
        when nullif(trim(coalesce(customer_email,'')),'') is null then 'EMAIL_MISSING'
        when lower(trim(customer_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then 'EMAIL_INVALID'
        when not coalesce(email_opt_in,false) then 'EMAIL_OPTED_OUT' end
      else case
        when nullif(trim(coalesce(customer_phone,'')),'') is null then 'SMS_MISSING'
        when public.normalize_ph_mobile(customer_phone) is null then 'SMS_INVALID'
        when not coalesce(sms_opt_in,false) then 'SMS_OPTED_OUT' end end eligibility_reason,
      case when channel='email' then lower(trim(customer_email)) else public.normalize_ph_mobile(customer_phone) end recipient_address
    from candidates candidate cross join (values('email'),('sms')) selected(channel)
  ), inserted as (
    insert into public.notification_outbox(
      organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,
      template_key,payload,reference_type,reference_id,deduplication_key,status,eligibility_reason
    ) select organization_id,branch_id,customer_id,'VEHICLE_MAINTENANCE_REMINDER',channel,recipient_address,
      'vehicle-maintenance-'||lower(reminder_stage)||'-'||channel||'-v1',
      jsonb_build_object('businessName',business_name,'branchName',branch_name,'branchPhone',branch_phone,
        'branchEmail',branch_email,'customerName',customer_name,'vehicleLabel',trim(concat_ws(' ',make,model)),
        'plateNumber',plate_number,'serviceName',service_name,'lastServiceAt',last_service_at,
        'lastServiceOdometerKm',last_service_odometer_km,'nextDueAt',next_due_at,
        'nextDueOdometerKm',next_due_odometer_km,'stage',reminder_stage),
      'vehicle_maintenance_due',id,'vehicle-maintenance:'||id||':'||lower(reminder_stage)||':'||channel,
      case when eligibility_reason is null then 'pending' else 'cancelled' end,eligibility_reason
    from channels on conflict(deduplication_key) do update set
      status=case when excluded.eligibility_reason is null then 'pending' else 'cancelled' end,
      eligibility_reason=excluded.eligibility_reason,cancelled_at=case when excluded.eligibility_reason is null then null else now() end,
      available_at=now(),locked_at=null,locked_by=null
      where notification_outbox.status='cancelled'
        and notification_outbox.eligibility_reason in ('ACTIVE_RELATED_APPOINTMENT','MAINTENANCE_SNOOZED')
    returning id,organization_id,channel,reference_id,status
  ), audited as (
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    select organization_id,null,'notification',id,'notification.requested',
      jsonb_build_object('notification_type','VEHICLE_MAINTENANCE_REMINDER','channel',channel,'maintenance_due_id',reference_id,'status',status)
    from inserted returning id
  ) select count(*) into inserted_count from inserted;
  return inserted_count;
end $$;

create function public.plan_vehicle_service_backfill(p_organization_id uuid,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare details jsonb; summary jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_organization_id is null then raise exception 'Organization scope is required'; end if;
  if p_limit<1 or p_limit>500 then raise exception 'Limit must be between 1 and 500'; end if;
  with jobs as (
    select job.* from public.job_orders job where job.organization_id=p_organization_id and job.status='completed'
    order by job.completed_at nulls last,job.id limit p_limit
  ), planned as (
    select job.id job_order_id,job.organization_id,
      case when history.id is not null then 'SKIP_HISTORY_EXISTS'
        when job.vehicle_id is null or vehicle.id is null or customer.id is null or job.completed_at is null
          or not exists(select 1 from public.job_order_items item where item.job_order_id=job.id and item.approval_status='approved')
          then 'BLOCKED' else 'WOULD_CREATE_HISTORY' end history_action,
      array_remove(array[
        case when job.odometer_in_km is null and job.odometer_out_km is null then 'MISSING_ODOMETER' end,
        case when job.completed_at>now()+interval '1 day' then 'FUTURE_SERVICE_DATE' end,
        case when exists(select 1 from public.job_order_items item where item.job_order_id=job.id and item.approval_status='approved' and item.service_id is null) then 'UNRESOLVED_SERVICE' end,
        case when exists(select 1 from public.vehicle_maintenance_due due where due.vehicle_id=job.vehicle_id and due.lifecycle_status='active' group by due.service_id having count(*)>1) then 'MULTIPLE_ACTIVE_MAINTENANCE' end
      ],null) warnings,
      array_remove(array[
        case when job.vehicle_id is null or vehicle.id is null then 'INVALID_VEHICLE' end,
        case when customer.id is null then 'INVALID_CUSTOMER' end,
        case when vehicle.organization_id is distinct from job.organization_id or customer.organization_id is distinct from job.organization_id then 'CROSS_TENANT_INCONSISTENCY' end,
        case when job.completed_at is null then 'MISSING_COMPLETED_AT' end,
        case when not exists(select 1 from public.job_order_items item where item.job_order_id=job.id and item.approval_status='approved') then 'NO_APPROVED_WORK' end
      ],null) blockers,
      (select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_work.service_id,'action',
        case
          when not exists(select 1 from public.maintenance_rules eligible_rule
            where eligible_rule.organization_id=job.organization_id and eligible_rule.service_id=service_work.service_id
              and eligible_rule.is_active and (eligible_rule.interval_months is not null
                or coalesce(job.odometer_out_km,job.odometer_in_km) is not null)) then 'SKIP_MISSING_ODOMETER'
          when exists(select 1 from public.vehicle_maintenance_due due where due.vehicle_id=job.vehicle_id
            and due.service_id=service_work.service_id and due.lifecycle_status='active'
            and due.last_service_at>=job.completed_at) then 'SKIP_MAINTENANCE_EXISTS'
          else 'WOULD_CREATE_MAINTENANCE' end)), '[]'::jsonb)
       from (select distinct item.service_id from public.job_order_items item join public.maintenance_rules rule
         on rule.service_id=item.service_id and rule.organization_id=job.organization_id and rule.is_active
         where item.job_order_id=job.id and item.approval_status='approved' and item.service_id is not null) service_work) maintenance_actions
    from jobs job
    left join public.vehicle_service_records history on history.source_job_order_id=job.id
    left join public.vehicles vehicle on vehicle.id=job.vehicle_id
    left join public.customers customer on customer.id=job.customer_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('jobOrderId',job_order_id,'organizationId',organization_id,
    'historyAction',history_action,'maintenanceActions',maintenance_actions,'warnings',warnings,'blockers',blockers)
    order by job_order_id),'[]'::jsonb) into details from planned;
  select jsonb_build_object(
    'scanned',jsonb_array_length(details),
    'eligible',(select count(*) from jsonb_array_elements(details) row where row->>'historyAction'<>'BLOCKED'),
    'wouldCreateHistory',(select count(*) from jsonb_array_elements(details) row where row->>'historyAction'='WOULD_CREATE_HISTORY'),
    'alreadyBackfilled',(select count(*) from jsonb_array_elements(details) row where row->>'historyAction'='SKIP_HISTORY_EXISTS'),
    'wouldCreateMaintenance',(select count(*) from jsonb_array_elements(details) row,
      jsonb_array_elements(row->'maintenanceActions') action where action->>'action'='WOULD_CREATE_MAINTENANCE'),
    'existingMaintenance',(select count(*) from jsonb_array_elements(details) row,
      jsonb_array_elements(row->'maintenanceActions') action where action->>'action'='SKIP_MAINTENANCE_EXISTS'),
    'warnings',(select coalesce(sum(jsonb_array_length(row->'warnings')),0) from jsonb_array_elements(details) row),
    'blocked',(select count(*) from jsonb_array_elements(details) row where row->>'historyAction'='BLOCKED')
  ) into summary;
  return jsonb_build_object('summary',summary,'details',details,'policy',jsonb_build_object(
    'mode','dry-run','notifications','disabled-for-backfilled-projections','intervalSource','current-maintenance-rules'));
end $$;

create function public.backfill_one_vehicle_service_record(p_job_order_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; record_id uuid; rule_row record; active_due public.vehicle_maintenance_due;
  maintenance_created integer:=0; history_created boolean:=false;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  select * into job_row from public.job_orders where id=p_job_order_id and status='completed' for update;
  if job_row.id is null or job_row.vehicle_id is null or job_row.completed_at is null
    or not exists(select 1 from public.job_order_items item where item.job_order_id=job_row.id and item.approval_status='approved')
  then raise exception 'Historical Job Order is not eligible'; end if;
  if not exists(select 1 from public.vehicles vehicle where vehicle.id=job_row.vehicle_id and vehicle.organization_id=job_row.organization_id)
    or not exists(select 1 from public.customers customer where customer.id=job_row.customer_id and customer.organization_id=job_row.organization_id)
  then raise exception 'Historical Job Order has invalid tenant relationships'; end if;

  insert into public.vehicle_service_records(organization_id,branch_id,vehicle_id,customer_id,source_job_order_id,
    job_number,completed_at,odometer_km,total_centavos,branch_name_snapshot,primary_technician_user_id,source,backfilled_at)
  select job_row.organization_id,job_row.branch_id,job_row.vehicle_id,job_row.customer_id,job_row.id,job_row.job_number,
    job_row.completed_at,coalesce(job_row.odometer_out_km,job_row.odometer_in_km),job_row.actual_total_centavos,
    branch.name,job_row.primary_technician_user_id,'legacy_backfill',now()
  from public.branches branch where branch.id=job_row.branch_id
  on conflict(source_job_order_id) do nothing returning id into record_id;
  if record_id is null then
    select id into record_id from public.vehicle_service_records where source_job_order_id=job_row.id;
  else history_created:=true;
  end if;

  insert into public.vehicle_service_record_items(organization_id,service_record_id,source_job_order_item_id,service_id,
    service_name_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos,technician_user_id)
  select item.organization_id,record_id,item.id,item.service_id,item.service_name_snapshot,item.quantity,item.unit_price_centavos,
    item.discount_centavos,item.line_total_centavos,item.technician_user_id
  from public.job_order_items item where item.job_order_id=job_row.id and item.approval_status='approved'
  on conflict(source_job_order_item_id) do nothing;

  for rule_row in select distinct rule.service_id,rule.interval_months,rule.interval_km,rule.lead_days
    from public.job_order_items item join public.maintenance_rules rule
      on rule.service_id=item.service_id and rule.organization_id=job_row.organization_id and rule.is_active
    where item.job_order_id=job_row.id and item.approval_status='approved' and item.service_id is not null
      and not exists(select 1 from public.vehicle_service_record_items newer_item
        join public.vehicle_service_records newer on newer.id=newer_item.service_record_id
        where newer.vehicle_id=job_row.vehicle_id and newer_item.service_id=item.service_id and newer.completed_at>job_row.completed_at)
  loop
    -- A mileage-only rule cannot be projected without trustworthy historical mileage.
    if rule_row.interval_months is not null
      or (rule_row.interval_km is not null and coalesce(job_row.odometer_out_km,job_row.odometer_in_km) is not null)
    then
      select * into active_due from public.vehicle_maintenance_due due where due.organization_id=job_row.organization_id
        and due.vehicle_id=job_row.vehicle_id and due.service_id=rule_row.service_id and due.lifecycle_status='active'
        for update;
      if active_due.id is not null and active_due.last_service_at>=job_row.completed_at then continue; end if;
      if active_due.id is not null then
        update public.vehicle_maintenance_due set lifecycle_status='satisfied',satisfied_at=job_row.completed_at
          where id=active_due.id;
      end if;
      insert into public.vehicle_maintenance_due(organization_id,branch_id,vehicle_id,service_id,source_service_record_id,
        source_job_order_id,last_service_at,last_service_odometer_km,interval_months_snapshot,interval_km_snapshot,
        reminder_lead_days_snapshot,next_due_at,next_due_odometer_km,notifications_enabled,source,backfilled_at)
      values(job_row.organization_id,job_row.branch_id,job_row.vehicle_id,rule_row.service_id,record_id,job_row.id,
        job_row.completed_at,coalesce(job_row.odometer_out_km,job_row.odometer_in_km),rule_row.interval_months,rule_row.interval_km,
        rule_row.lead_days,case when rule_row.interval_months is not null then job_row.completed_at+make_interval(months=>rule_row.interval_months) end,
        case when rule_row.interval_km is not null and coalesce(job_row.odometer_out_km,job_row.odometer_in_km) is not null
          then coalesce(job_row.odometer_out_km,job_row.odometer_in_km)+rule_row.interval_km end,false,'legacy_backfill',now());
      maintenance_created:=maintenance_created+1;
    end if;
  end loop;
  if history_created or maintenance_created>0 then
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(job_row.organization_id,null,'vehicle_service_record',record_id,'maintenance.legacy_history_backfilled',
      jsonb_build_object('job_order_id',job_row.id,'history_created',history_created,'maintenance_created',maintenance_created));
  end if;
  return jsonb_build_object('jobOrderId',job_row.id,'history',case when history_created then 'CREATED' else 'SKIP_HISTORY_EXISTS' end,
    'maintenanceCreated',maintenance_created);
end $$;

create function public.apply_vehicle_service_backfill(p_organization_id uuid,p_limit integer default 100,p_report_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job_id uuid; result jsonb; details jsonb:='[]'::jsonb; created_count integer:=0; maintenance_count integer:=0; failed_count integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_organization_id is null then raise exception 'Organization scope is required'; end if;
  if p_limit<1 or p_limit>100 then raise exception 'Apply limit must be between 1 and 100'; end if;
  for job_id in select job.id from public.job_orders job left join public.vehicle_service_records history on history.source_job_order_id=job.id
    where job.organization_id=p_organization_id and job.status='completed' and (
      history.id is null or exists(
        select 1 from public.job_order_items item join public.maintenance_rules rule
          on rule.organization_id=job.organization_id and rule.service_id=item.service_id and rule.is_active
        where item.job_order_id=job.id and item.approval_status='approved'
          and (rule.interval_months is not null or coalesce(job.odometer_out_km,job.odometer_in_km) is not null)
          and not exists(select 1 from public.vehicle_service_record_items newer_item
            join public.vehicle_service_records newer on newer.id=newer_item.service_record_id
            where newer.vehicle_id=job.vehicle_id and newer_item.service_id=item.service_id and newer.completed_at>job.completed_at)
          and not exists(select 1 from public.vehicle_maintenance_due due where due.vehicle_id=job.vehicle_id
            and due.service_id=item.service_id and due.lifecycle_status='active' and due.last_service_at>=job.completed_at)
      ))
    order by job.completed_at nulls last,job.id limit p_limit
  loop
    begin
      result:=public.backfill_one_vehicle_service_record(job_id);details:=details||jsonb_build_array(result);
      if result->>'history'='CREATED' then created_count:=created_count+1; end if;
      maintenance_count:=maintenance_count+coalesce((result->>'maintenanceCreated')::integer,0);
    exception when others then
      failed_count:=failed_count+1;details:=details||jsonb_build_array(jsonb_build_object('jobOrderId',job_id,
        'history','FAILED','operation','HISTORY_AND_MAINTENANCE_BACKFILL','error',left(sqlerrm,300)));
    end;
  end loop;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(p_organization_id,null,'organization',p_organization_id,'maintenance.backfill_applied',jsonb_build_object(
    'report_id',p_report_id,'limit',p_limit,'history_created',created_count,'maintenance_created',maintenance_count,'failed',failed_count));
  return jsonb_build_object('reportId',p_report_id,'summary',jsonb_build_object('historyCreated',created_count,
    'maintenanceCreated',maintenance_count,'failed',failed_count),'details',details);
end $$;

revoke all on function public.plan_vehicle_service_backfill(uuid,integer),public.backfill_one_vehicle_service_record(uuid),
  public.apply_vehicle_service_backfill(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.plan_vehicle_service_backfill(uuid,integer),public.backfill_one_vehicle_service_record(uuid),
  public.apply_vehicle_service_backfill(uuid,integer,uuid) to service_role;
