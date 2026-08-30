-- ServiceCore scheduling owns appointments; vehicle association is an optional
-- automotive extension. Existing appointment vehicle values are preserved.

alter table public.appointments
  alter column vehicle_id drop not null;

create or replace function public.enforce_appointment_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  branch_org uuid;
  customer_org uuid;
  vehicle_org uuid;
  vehicle_customer uuid;
begin
  select organization_id into branch_org from public.branches where id=new.branch_id;
  select organization_id into customer_org from public.customers where id=new.customer_id;

  if branch_org is null or customer_org is null
    or branch_org<>new.organization_id or customer_org<>new.organization_id then
    raise exception 'Appointment organization mismatch';
  end if;

  if new.vehicle_id is not null then
    select organization_id,customer_id into vehicle_org,vehicle_customer
    from public.vehicles where id=new.vehicle_id;
    if vehicle_org is null or vehicle_org<>new.organization_id then
      raise exception 'Appointment organization mismatch';
    end if;
    if vehicle_customer<>new.customer_id then
      raise exception 'Appointment vehicle/customer mismatch';
    end if;
  end if;

  return new;
end $$;

create or replace function public.snapshot_appointment_service()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; service_row public.services; vehicle_class text; configured_count integer; available boolean;
begin
  select * into appointment_row from public.appointments where id=new.appointment_id;
  select * into service_row from public.services where id=new.service_id;
  if appointment_row.id is null or service_row.id is null or appointment_row.organization_id<>service_row.organization_id or not service_row.is_active then raise exception 'Appointment service is unavailable'; end if;
  select count(*),coalesce(bool_or(branch_id=appointment_row.branch_id and is_available),false) into configured_count,available from public.service_branch_availability where service_id=new.service_id;
  if configured_count>0 and not available then raise exception 'Service is unavailable at this branch'; end if;
  if appointment_row.vehicle_id is not null then
    select lower(replace(coalesce(vehicle_type,'custom'),' ','_')) into vehicle_class from public.vehicles where id=appointment_row.vehicle_id;
  end if;
  new.service_name_snapshot:=service_row.name;
  new.unit_price_centavos:=public.resolve_service_price(new.service_id,appointment_row.branch_id,vehicle_class);
  new.duration_minutes:=service_row.duration_minutes;
  return new;
end $$;

create or replace view public.appointment_directory
with (security_invoker = true)
as
select
  appointment.id,
  appointment.organization_id,
  appointment.branch_id,
  appointment.status,
  appointment.starts_at,
  lower(concat_ws(' ', customer.full_name, customer.phone, customer.email,
    vehicle.make, vehicle.model, vehicle.plate_number,
    string_agg(item.service_name_snapshot, ' '))) as search_document
from public.appointments appointment
join public.customers customer on customer.id=appointment.customer_id
left join public.vehicles vehicle on vehicle.id=appointment.vehicle_id
left join public.appointment_services item on item.appointment_id=appointment.id
group by appointment.id,customer.id,vehicle.id;

create or replace function public.enqueue_appointment(p_appointment_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; branch_tz text; operational_date date; next_number integer; queue_id uuid;
begin
  select * into appointment_row from public.appointments where id=p_appointment_id for update;
  select timezone into branch_tz from public.branches where id=appointment_row.branch_id;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Appointment not found' using errcode='42501'; end if;
  if appointment_row.vehicle_id is null then raise exception 'A vehicle is required to enter the automotive queue'; end if;
  if appointment_row.status not in ('checked_in','confirmed') then raise exception 'Appointment must be confirmed or arrived'; end if;
  operational_date:=(now() at time zone branch_tz)::date;
  insert into public.queue_counters(branch_id,queue_date,last_number) values(appointment_row.branch_id,operational_date,1)
    on conflict(branch_id,queue_date) do update set last_number=public.queue_counters.last_number+1 returning last_number into next_number;
  insert into public.queue_entries(organization_id,branch_id,appointment_id,customer_id,vehicle_id,source,queue_date,queue_number,estimated_total_centavos,estimated_duration_minutes,created_by)
    values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,appointment_row.customer_id,appointment_row.vehicle_id,'appointment',operational_date,next_number,appointment_row.expected_total_centavos,appointment_row.expected_duration_minutes,auth.uid()) returning id into queue_id;
  update public.appointments set status='queued' where id=appointment_row.id;
  return queue_id;
end $$;

create or replace function public.convert_queue_to_job(p_queue_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.queue_entries; a public.appointments; created_id uuid; next_no bigint; yr integer;
begin
  select * into q from public.queue_entries where id=p_queue_id for update;
  if q.id is null or not public.has_org_role(q.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Queue entry not found' using errcode='42501'; end if;
  if q.vehicle_id is null then raise exception 'A vehicle is required to create an automotive job order'; end if;
  if q.status not in ('waiting','called','ready') then raise exception 'Queue entry cannot start a job'; end if;
  if exists(select 1 from public.job_orders where queue_entry_id=q.id) then raise exception 'Queue entry already has a job'; end if;
  select * into a from public.appointments where id=q.appointment_id;
  yr:=extract(year from now() at time zone 'Asia/Manila');
  insert into public.job_number_counters(branch_id,number_year,last_number) values(q.branch_id,yr,1)
    on conflict(branch_id,number_year) do update set last_number=public.job_number_counters.last_number+1 returning last_number into next_no;
  insert into public.job_orders(organization_id,branch_id,customer_id,vehicle_id,appointment_id,queue_entry_id,job_number,status,customer_concern,advisor_user_id,created_by)
  values(q.organization_id,q.branch_id,q.customer_id,q.vehicle_id,q.appointment_id,q.id,next_no,'queued',a.customer_note,auth.uid(),auth.uid()) returning id into created_id;
  insert into public.job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes)
  select q.organization_id,created_id,service_id,service_name_snapshot,1,unit_price_centavos,unit_price_centavos,duration_minutes from public.appointment_services where appointment_id=q.appointment_id;
  update public.queue_entries set status='converted_to_job' where id=q.id;
  return created_id;
end $$;
