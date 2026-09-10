-- Restore the 0029 directory contract after partial optional-vehicle upgrades.
-- Vehicle-less Salon appointments must remain searchable and visible.
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
join public.customers customer on customer.id = appointment.customer_id
left join public.vehicles vehicle on vehicle.id = appointment.vehicle_id
left join public.appointment_services item on item.appointment_id = appointment.id
group by appointment.id, customer.id, vehicle.id;

notify pgrst, 'reload schema';
