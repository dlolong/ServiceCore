-- Durable automotive service history and maintenance projections.
-- Existing completed jobs are intentionally not backfilled by this migration.

-- Earlier outbox installations used an explicit estimate-only allowlist.
alter table public.notification_outbox drop constraint if exists notification_outbox_notification_type_check;
alter table public.notification_outbox add constraint notification_outbox_notification_type_check
  check (notification_type ~ '^[A-Z][A-Z0-9_]{2,80}$');
alter table public.notification_outbox drop constraint if exists notification_outbox_reference_type_check;
alter table public.notification_outbox add constraint notification_outbox_reference_type_check
  check (reference_type ~ '^[a-z][a-z0-9_]{2,80}$');
-- The outbox reference is intentionally polymorphic; domain tables own their
-- cancellation triggers and safe status RPCs.
alter table public.notification_outbox drop constraint if exists notification_outbox_reference_id_fkey;

create table public.vehicle_service_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  source_job_order_id uuid not null references public.job_orders(id) on delete restrict,
  job_number bigint,
  completed_at timestamptz not null,
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  total_centavos bigint not null check (total_centavos >= 0),
  branch_name_snapshot text not null,
  primary_technician_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_job_order_id)
);

create table public.vehicle_service_record_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_record_id uuid not null references public.vehicle_service_records(id) on delete cascade,
  source_job_order_item_id uuid not null references public.job_order_items(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  discount_centavos bigint not null check (discount_centavos >= 0),
  line_total_centavos bigint not null check (line_total_centavos >= 0),
  technician_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_job_order_item_id)
);

create table public.vehicle_maintenance_due (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  source_service_record_id uuid not null references public.vehicle_service_records(id) on delete restrict,
  source_job_order_id uuid not null references public.job_orders(id) on delete restrict,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active','satisfied','dismissed','superseded')),
  last_service_at timestamptz not null,
  last_service_odometer_km integer check (last_service_odometer_km is null or last_service_odometer_km >= 0),
  interval_months_snapshot integer check (interval_months_snapshot is null or interval_months_snapshot between 1 and 120),
  interval_km_snapshot integer check (interval_km_snapshot is null or interval_km_snapshot between 100 and 500000),
  reminder_lead_days_snapshot integer not null default 14 check (reminder_lead_days_snapshot between 0 and 365),
  next_due_at timestamptz,
  next_due_odometer_km integer check (next_due_odometer_km is null or next_due_odometer_km >= 0),
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id) on delete set null,
  dismiss_reason text check (dismiss_reason is null or char_length(dismiss_reason) <= 500),
  satisfied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_due_at is not null or next_due_odometer_km is not null)
);

create unique index vehicle_service_records_vehicle_job_idx on public.vehicle_service_records(organization_id,vehicle_id,source_job_order_id);
create index vehicle_service_records_vehicle_completed_idx on public.vehicle_service_records(vehicle_id,completed_at desc);
create index vehicle_service_record_items_record_idx on public.vehicle_service_record_items(service_record_id,created_at);
create unique index vehicle_maintenance_due_one_active_idx on public.vehicle_maintenance_due(organization_id,vehicle_id,service_id) where lifecycle_status='active';
create index vehicle_maintenance_due_branch_status_idx on public.vehicle_maintenance_due(branch_id,lifecycle_status,next_due_at);

create trigger vehicle_maintenance_due_updated_at before update on public.vehicle_maintenance_due
for each row execute function public.set_updated_at();

alter table public.vehicle_service_records enable row level security;
alter table public.vehicle_service_record_items enable row level security;
alter table public.vehicle_maintenance_due enable row level security;

create policy vehicle_service_records_select on public.vehicle_service_records for select to authenticated
using (public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create policy vehicle_service_record_items_select on public.vehicle_service_record_items for select to authenticated
using (public.is_org_member(organization_id) and exists (
  select 1 from public.vehicle_service_records record
  where record.id=service_record_id and public.can_access_branch(record.organization_id,record.branch_id)
));
create policy vehicle_maintenance_due_select on public.vehicle_maintenance_due for select to authenticated
using (public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));

revoke all on public.vehicle_service_records,public.vehicle_service_record_items,public.vehicle_maintenance_due from public,anon,authenticated;
grant select on public.vehicle_service_records,public.vehicle_service_record_items,public.vehicle_maintenance_due to authenticated;
grant all on public.vehicle_service_records,public.vehicle_service_record_items,public.vehicle_maintenance_due to service_role;

create or replace view public.vehicle_service_history with (security_invoker=true) as
select record.organization_id,record.branch_id,record.vehicle_id,record.customer_id,
  record.source_job_order_id job_order_id,record.job_number,record.completed_at,
  record.odometer_km odometer_in_km,record.total_centavos,
  coalesce(jsonb_agg(jsonb_build_object(
    'name',item.service_name_snapshot,'quantity',item.quantity,'total_centavos',item.line_total_centavos
  ) order by item.created_at) filter (where item.id is not null),'[]'::jsonb) services
from public.vehicle_service_records record
left join public.vehicle_service_record_items item on item.service_record_id=record.id
group by record.id
union all
select job.organization_id,job.branch_id,job.vehicle_id,job.customer_id,job.id,job.job_number,job.completed_at,
  job.odometer_in_km,coalesce(invoice.total_centavos,job.actual_total_centavos),
  jsonb_agg(jsonb_build_object('name',item.service_name_snapshot,'quantity',item.quantity,
    'total_centavos',item.line_total_centavos) order by item.created_at)
from public.job_orders job
join public.job_order_items item on item.job_order_id=job.id and item.approval_status='approved'
left join public.invoices invoice on invoice.job_order_id=job.id and invoice.status<>'void'
where job.status='completed' and not exists (
  select 1 from public.vehicle_service_records record where record.source_job_order_id=job.id
)
group by job.id,invoice.total_centavos;
grant select on public.vehicle_service_history to authenticated;

create view public.vehicle_maintenance_directory with (security_invoker=true) as
select due.*,vehicle.customer_id,vehicle.make,vehicle.model,vehicle.plate_number,
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
  end due_status
from public.vehicle_maintenance_due due
join public.vehicles vehicle on vehicle.id=due.vehicle_id
join public.customers customer on customer.id=vehicle.customer_id
join public.services service on service.id=due.service_id
join public.branches branch on branch.id=due.branch_id;
grant select on public.vehicle_maintenance_directory to authenticated;

create function public.finalize_vehicle_service_record(p_job_order_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; record_id uuid; rule_row record;
begin
  select * into job_row from public.job_orders where id=p_job_order_id and status='completed' for update;
  if job_row.id is null then raise exception 'Completed job order not found'; end if;

  insert into public.vehicle_service_records(
    organization_id,branch_id,vehicle_id,customer_id,source_job_order_id,job_number,completed_at,
    odometer_km,total_centavos,branch_name_snapshot,primary_technician_user_id
  ) select job_row.organization_id,job_row.branch_id,job_row.vehicle_id,job_row.customer_id,job_row.id,
      job_row.job_number,job_row.completed_at,coalesce(job_row.odometer_out_km,job_row.odometer_in_km),
      job_row.actual_total_centavos,branch.name,job_row.primary_technician_user_id
    from public.branches branch where branch.id=job_row.branch_id
  on conflict(source_job_order_id) do nothing returning id into record_id;
  if record_id is null then select id into record_id from public.vehicle_service_records where source_job_order_id=job_row.id; return record_id; end if;

  insert into public.vehicle_service_record_items(
    organization_id,service_record_id,source_job_order_item_id,service_id,service_name_snapshot,
    quantity,unit_price_centavos,discount_centavos,line_total_centavos,technician_user_id
  ) select item.organization_id,record_id,item.id,item.service_id,item.service_name_snapshot,item.quantity,
      item.unit_price_centavos,item.discount_centavos,item.line_total_centavos,item.technician_user_id
    from public.job_order_items item where item.job_order_id=job_row.id and item.approval_status='approved'
  on conflict(source_job_order_item_id) do nothing;

  update public.vehicles set odometer_km=coalesce(greatest(odometer_km,coalesce(job_row.odometer_out_km,job_row.odometer_in_km)),coalesce(job_row.odometer_out_km,job_row.odometer_in_km)),updated_at=now()
    where id=job_row.vehicle_id and coalesce(job_row.odometer_out_km,job_row.odometer_in_km) is not null;

  for rule_row in
    select distinct rule.service_id,rule.interval_months,rule.interval_km,rule.lead_days
    from public.job_order_items item join public.maintenance_rules rule
      on rule.service_id=item.service_id and rule.organization_id=job_row.organization_id and rule.is_active
    where item.job_order_id=job_row.id and item.approval_status='approved'
  loop
    update public.vehicle_maintenance_due set lifecycle_status='satisfied',satisfied_at=job_row.completed_at
      where organization_id=job_row.organization_id and vehicle_id=job_row.vehicle_id
        and service_id=rule_row.service_id and lifecycle_status='active';
    insert into public.vehicle_maintenance_due(
      organization_id,branch_id,vehicle_id,service_id,source_service_record_id,source_job_order_id,
      last_service_at,last_service_odometer_km,interval_months_snapshot,interval_km_snapshot,
      reminder_lead_days_snapshot,next_due_at,next_due_odometer_km
    ) values(
      job_row.organization_id,job_row.branch_id,job_row.vehicle_id,rule_row.service_id,record_id,job_row.id,
      job_row.completed_at,coalesce(job_row.odometer_out_km,job_row.odometer_in_km),rule_row.interval_months,rule_row.interval_km,
      rule_row.lead_days,case when rule_row.interval_months is not null then job_row.completed_at+make_interval(months=>rule_row.interval_months) end,
      case when rule_row.interval_km is not null and coalesce(job_row.odometer_out_km,job_row.odometer_in_km) is not null then coalesce(job_row.odometer_out_km,job_row.odometer_in_km)+rule_row.interval_km end
    );
  end loop;

  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(job_row.organization_id,auth.uid(),'vehicle_service_record',record_id,'vehicle.service_history_created',jsonb_build_object('job_order_id',job_row.id,'vehicle_id',job_row.vehicle_id));
  return record_id;
end $$;
revoke all on function public.finalize_vehicle_service_record(uuid) from public,anon,authenticated;
grant execute on function public.finalize_vehicle_service_record(uuid) to service_role;

create function public.on_job_completed_record_service() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin if new.status='completed' and old.status is distinct from new.status then perform public.finalize_vehicle_service_record(new.id); end if; return new; end $$;
create trigger job_completion_service_history after update of status on public.job_orders
for each row execute function public.on_job_completed_record_service();

create function public.dismiss_vehicle_maintenance(p_due_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_due_id for update;
  if due_row.id is null or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id) then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  if due_row.lifecycle_status<>'active' then raise exception 'Maintenance item is no longer active'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Dismissal reason is required'; end if;
  update public.vehicle_maintenance_due set lifecycle_status='dismissed',dismissed_at=now(),dismissed_by=auth.uid(),dismiss_reason=left(trim(p_reason),500) where id=due_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'vehicle.maintenance_dismissed',jsonb_build_object('reason',left(trim(p_reason),500)));
end $$;
grant execute on function public.dismiss_vehicle_maintenance(uuid,text) to authenticated;

create function public.backfill_vehicle_service_records(p_limit integer default 100) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare job_id uuid; processed integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required' using errcode='42501'; end if;
  if p_limit<1 or p_limit>1000 then raise exception 'Limit must be between 1 and 1000'; end if;
  for job_id in select job.id from public.job_orders job left join public.vehicle_service_records record on record.source_job_order_id=job.id
    where job.status='completed' and record.id is null order by job.completed_at limit p_limit
  loop perform public.finalize_vehicle_service_record(job_id); processed:=processed+1; end loop;
  return processed;
end $$;
revoke all on function public.backfill_vehicle_service_records(integer) from public,anon,authenticated;
grant execute on function public.backfill_vehicle_service_records(integer) to service_role;

create function public.cancel_vehicle_maintenance_notifications() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.lifecycle_status='active' and new.lifecycle_status<>'active' then
    update public.notification_outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
      eligibility_reason='MAINTENANCE_'||upper(new.lifecycle_status)
      where reference_type='vehicle_maintenance_due' and reference_id=new.id and status in ('pending','processing');
  end if;
  return new;
end $$;
create trigger vehicle_maintenance_notification_cancellation after update of lifecycle_status on public.vehicle_maintenance_due
for each row execute function public.cancel_vehicle_maintenance_notifications();

create function public.cancel_archived_vehicle_maintenance_notifications() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not old.is_archived and new.is_archived then
    update public.notification_outbox outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
      eligibility_reason='VEHICLE_ARCHIVED'
      from public.vehicle_maintenance_due due
      where due.vehicle_id=new.id and due.id=outbox.reference_id
        and outbox.reference_type='vehicle_maintenance_due' and outbox.status in ('pending','processing');
  end if;
  return new;
end $$;
create trigger archived_vehicle_maintenance_notification_cancellation after update of is_archived on public.vehicles
for each row execute function public.cancel_archived_vehicle_maintenance_notifications();

create function public.enqueue_due_vehicle_maintenance_reminders(p_limit integer default 100) returns integer
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
    where directory.lifecycle_status='active' and not directory.vehicle_is_archived
      and directory.due_status in ('due_soon','due','overdue')
    order by directory.next_due_at nulls last,directory.created_at
    limit p_limit
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
      'vehicle_maintenance_due',id,
      'vehicle-maintenance:'||id||':'||lower(reminder_stage)||':'||channel,
      case when eligibility_reason is null then 'pending' else 'cancelled' end,eligibility_reason
    from channels on conflict(deduplication_key) do nothing
    returning id,organization_id,channel,reference_id,status
  ), audited as (
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    select organization_id,null,'notification',id,'notification.requested',
      jsonb_build_object('notification_type','VEHICLE_MAINTENANCE_REMINDER','channel',channel,'maintenance_due_id',reference_id,'status',status)
    from inserted returning id
  ) select count(*) into inserted_count from inserted;
  return inserted_count;
end $$;
revoke all on function public.enqueue_due_vehicle_maintenance_reminders(integer) from public,anon,authenticated;
grant execute on function public.enqueue_due_vehicle_maintenance_reminders(integer) to service_role;

create function public.get_vehicle_maintenance_delivery_status(p_due_ids uuid[])
returns table(due_id uuid,channel text,status text,eligibility_reason text,sent_at timestamptz,failed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select distinct on (outbox.reference_id,outbox.channel) outbox.reference_id,outbox.channel,outbox.status,
    outbox.eligibility_reason,outbox.sent_at,outbox.failed_at
  from public.notification_outbox outbox
  join public.vehicle_maintenance_due due on due.id=outbox.reference_id and outbox.reference_type='vehicle_maintenance_due'
  where due.id=any(coalesce(p_due_ids,'{}'::uuid[])) and public.is_org_member(due.organization_id)
    and public.can_access_branch(due.organization_id,due.branch_id)
  order by outbox.reference_id,outbox.channel,outbox.created_at desc
$$;
revoke all on function public.get_vehicle_maintenance_delivery_status(uuid[]) from public,anon;
grant execute on function public.get_vehicle_maintenance_delivery_status(uuid[]) to authenticated;
