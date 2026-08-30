-- Development-only core scheduling fixture. It has no user membership, cannot
-- be reached by authenticated tenants, and exists only to exercise nullable
-- appointment/vehicle queries in local development and database inspection.
-- Never run this file against production.
insert into public.organizations(id,name,slug) values
('de000000-0000-4000-8000-000000000001','Core Scheduling Demo','core-scheduling-demo')
on conflict(id) do nothing;
insert into public.branches(id,organization_id,name,timezone,is_primary) values
('de000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001','Demo Location','Asia/Manila',true)
on conflict(id) do nothing;
insert into public.customers(id,organization_id,full_name,notes) values
('de000000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000001','Core Appointment Guest','Fake local seed record without a vehicle.')
on conflict(id) do nothing;
insert into public.services(id,organization_id,name,duration_minutes,base_price_centavos) values
('de000000-0000-4000-8000-000000000004','de000000-0000-4000-8000-000000000001','General Consultation',30,25000)
on conflict(id) do nothing;
insert into public.appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note) values
('de000000-0000-4000-8000-000000000005','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000003',null,'requested','internal',date_trunc('day',now())+interval '1 day 10 hours','Core scheduling example: no automotive vehicle association.')
on conflict(id) do nothing;
insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values
('de000000-0000-4000-8000-000000000005','de000000-0000-4000-8000-000000000004','General Consultation',25000,30)
on conflict(appointment_id,service_id) do nothing;
insert into public.scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity,is_active) values
('de000000-0000-4000-8000-000000000006','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002','Wash Bay 1','bay',1,true),
('de000000-0000-4000-8000-000000000007','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002','Open Wash Area','station',3,true),
('de000000-0000-4000-8000-000000000008','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002','Retired Detailing Bay','bay',1,false)
on conflict(id) do nothing;
insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id) values
('de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000005','de000000-0000-4000-8000-000000000006')
on conflict(appointment_id,resource_id) do nothing;

select 'ServiceCore seed ready with one isolated no-vehicle core appointment.' as message;
