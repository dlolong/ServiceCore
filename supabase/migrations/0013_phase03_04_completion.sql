-- Search projections and add-on compatibility for the completed operations scope.

create or replace function public.enforce_appointment_add_on_compatibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_id uuid;
begin
  select parent_service_id into parent_id
  from public.services
  where id = new.service_id and is_add_on;

  if parent_id is not null and not exists (
    select 1 from public.appointment_services
    where appointment_id = new.appointment_id and service_id = parent_id
  ) then
    raise exception 'This add-on requires its compatible parent service';
  end if;
  return new;
end;
$$;

create constraint trigger appointment_add_on_compatibility
after insert or update of appointment_id, service_id on public.appointment_services
deferrable initially deferred
for each row execute function public.enforce_appointment_add_on_compatibility();

create view public.appointment_directory
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
join public.customers customer on customer.id = appointment.customer_id
join public.vehicles vehicle on vehicle.id = appointment.vehicle_id
left join public.appointment_services item on item.appointment_id = appointment.id
group by appointment.id, customer.id, vehicle.id;

create view public.queue_directory
with (security_invoker = true)
as
select
  entry.id,
  entry.organization_id,
  entry.branch_id,
  entry.queue_date,
  entry.queue_number,
  lower(concat_ws(' ', entry.queue_number::text, customer.full_name, customer.phone,
    vehicle.make, vehicle.model, vehicle.plate_number)) as search_document
from public.queue_entries entry
join public.customers customer on customer.id = entry.customer_id
join public.vehicles vehicle on vehicle.id = entry.vehicle_id;

grant select on public.appointment_directory, public.queue_directory to authenticated;
