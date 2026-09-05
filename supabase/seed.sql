-- Development-only KarKR fixture. It starts as a Core scheduling example and
-- is also attached to the fake multi-product owner below for local switching.
-- Never run this file against production.
insert into public.organizations(id,name,slug,industry) values
('de000000-0000-4000-8000-000000000001','KarKR Demo Auto Care','karkr-demo-auto-care','automotive')
on conflict(id) do update set name=excluded.name,slug=excluded.slug,industry=excluded.industry;
insert into public.branches(id,organization_id,name,timezone,is_primary) values
('de000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001','Demo Location','Asia/Manila',true)
on conflict(id) do nothing;
-- Fake contact matrix for operational Staff without system access.
insert into public.organization_staff_profiles(id,organization_id,full_name,email,mobile,job_function,specializations,is_active) values
('de300000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001','Alex Both','alex.both@example.test','+639171110001','Technician',array['Diagnostics'],true),
('de300000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000001','Mika Mobile',null,'+639171110002','Technician',array['Preventive Maintenance'],true),
('de300000-0000-4000-8000-000000000004','de000000-0000-4000-8000-000000000001','Emil Email','emil.email@example.test',null,'Service Advisor',array['Customer Care'],true)
on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,mobile=excluded.mobile,
  job_function=excluded.job_function,specializations=excluded.specializations,is_active=excluded.is_active;
insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id) values
('de300000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002'),
('de300000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002'),
('de300000-0000-4000-8000-000000000004','de000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000002')
on conflict do nothing;
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

select 'KarKR demo seed ready with one no-vehicle Core appointment fixture.' as message;

-- Development-only Salon architecture fixture. Fake identities and records only.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('5a100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salon-owner@example.test','',now(),'{}','{}',now(),now()),
('5a100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salon-manager@example.test','',now(),'{}','{}',now(),now()),
('5a100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salon-staff@example.test','',now(),'{}','{}',now(),now())
on conflict(id) do nothing;
insert into public.profiles(id,full_name) values
('5a100000-0000-4000-8000-000000000001','Liza Ramos'),
('5a100000-0000-4000-8000-000000000002','Maria Santos'),
('5a100000-0000-4000-8000-000000000003','Ana Reyes')
on conflict(id) do update set full_name=excluded.full_name;
insert into public.organizations(id,name,slug,industry) values
('5a200000-0000-4000-8000-000000000001','Glow Beauty Lounge','glow-beauty-lounge','salon')
on conflict(id) do update set name=excluded.name,slug=excluded.slug,industry=excluded.industry;
insert into public.organization_subscriptions(organization_id,plan_id,status) values
('5a200000-0000-4000-8000-000000000001','business','active')
on conflict(organization_id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values
('5a300000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a100000-0000-4000-8000-000000000001','owner',true),
('5a300000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a100000-0000-4000-8000-000000000002','manager',true),
('5a300000-0000-4000-8000-000000000003','5a200000-0000-4000-8000-000000000001','5a100000-0000-4000-8000-000000000003','advisor',true)
on conflict(organization_id,user_id) do update set role=excluded.role,is_active=true;
-- The fake Salon owner belongs to both demo products so local organization
-- selection exercises a real membership-backed tenant change.
insert into public.organization_subscriptions(organization_id,plan_id,status) values
('de000000-0000-4000-8000-000000000001','business','active')
on conflict(organization_id) do nothing;
insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values
('de300000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000001','5a100000-0000-4000-8000-000000000001','owner',true)
on conflict(organization_id,user_id) do update set role=excluded.role,is_active=true;
insert into public.organization_staff_profiles(id,membership_id,organization_id,full_name,job_function,specializations) values
('5a300000-0000-4000-8000-000000000001','5a300000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','Liza Ramos','Salon Owner',array['Operations']),
('5a300000-0000-4000-8000-000000000002','5a300000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','Maria Santos','Senior Stylist',array['Hair Color','Haircut']),
('5a300000-0000-4000-8000-000000000003','5a300000-0000-4000-8000-000000000003','5a200000-0000-4000-8000-000000000001','Ana Reyes','Facialist',array['Classic Facial'])
on conflict(membership_id) do update set full_name=excluded.full_name,job_function=excluded.job_function,
  specializations=excluded.specializations;
insert into public.branches(id,organization_id,name,timezone,is_primary) values
('5a400000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','BGC Salon','Asia/Manila',true),
('5a400000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','Makati Salon','Asia/Manila',false)
on conflict(id) do nothing;
-- Neither-email-nor-mobile Salon Staff fixture, intentionally without login.
insert into public.organization_staff_profiles(id,organization_id,full_name,job_function,specializations,is_active) values
('5a300000-0000-4000-8000-000000000004','5a200000-0000-4000-8000-000000000001','Nina Cruz','Nail Technician',array['Manicure'],true)
on conflict(id) do update set full_name=excluded.full_name,job_function=excluded.job_function,
  specializations=excluded.specializations,is_active=excluded.is_active;
insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id) values
('5a300000-0000-4000-8000-000000000004','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001')
on conflict do nothing;
insert into public.customers(id,organization_id,full_name,phone,email) values
('5a500000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','Camille Dela Cruz','09170000001','camille@example.test'),
('5a500000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','Bianca Flores','09170000002','bianca@example.test')
on conflict(id) do nothing;
insert into public.service_categories(id,organization_id,name,sort_order) values
('5a600000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','Hair',1),
('5a600000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','Skin and Nails',2)
on conflict(id) do nothing;
insert into public.services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values
('5a700000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a600000-0000-4000-8000-000000000001','Haircut',60,65000),
('5a700000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a600000-0000-4000-8000-000000000001','Hair Color',120,250000),
('5a700000-0000-4000-8000-000000000003','5a200000-0000-4000-8000-000000000001','5a600000-0000-4000-8000-000000000002','Classic Facial',75,120000),
('5a700000-0000-4000-8000-000000000004','5a200000-0000-4000-8000-000000000001','5a600000-0000-4000-8000-000000000002','Manicure',45,45000)
on conflict(id) do nothing;
insert into public.scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity,is_active) values
('5a800000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','Styling Chair 1','station',1,true),
('5a800000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','Facial Room 1','room',1,true),
('5a800000-0000-4000-8000-000000000003','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000002','Nail Station 1','station',2,true)
on conflict(id) do nothing;
insert into public.appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note) values
('5a900000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a500000-0000-4000-8000-000000000001',null,'confirmed','internal',date_trunc('day',now())+interval '10 hours','Fake Salon appointment without a vehicle.'),
('5a900000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a500000-0000-4000-8000-000000000002',null,'requested','internal',date_trunc('day',now())+interval '13 hours',null),
('5a900000-0000-4000-8000-000000000003','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a500000-0000-4000-8000-000000000001',null,'checked_in','internal',date_trunc('day',now())+interval '15 hours','Waiting client fixture.'),
('5a900000-0000-4000-8000-000000000004','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a500000-0000-4000-8000-000000000002',null,'in_service','internal',date_trunc('day',now())+interval '16 hours','In-service fixture.'),
('5a900000-0000-4000-8000-000000000005','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a500000-0000-4000-8000-000000000001',null,'completed','internal',date_trunc('day',now())+interval '8 hours','Completed and paid fixture.')
on conflict(id) do nothing;
insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values
('5a900000-0000-4000-8000-000000000001','5a700000-0000-4000-8000-000000000002','Hair Color',250000,120),
('5a900000-0000-4000-8000-000000000002','5a700000-0000-4000-8000-000000000003','Classic Facial',120000,75),
('5a900000-0000-4000-8000-000000000003','5a700000-0000-4000-8000-000000000001','Haircut',65000,60),
('5a900000-0000-4000-8000-000000000004','5a700000-0000-4000-8000-000000000003','Classic Facial',120000,75),
('5a900000-0000-4000-8000-000000000005','5a700000-0000-4000-8000-000000000004','Manicure',45000,45)
on conflict(appointment_id,service_id) do nothing;
insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000001','5a300000-0000-4000-8000-000000000002'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000002','5a300000-0000-4000-8000-000000000003'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000003','5a300000-0000-4000-8000-000000000002'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000004','5a300000-0000-4000-8000-000000000003'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000005','5a300000-0000-4000-8000-000000000003')
on conflict(appointment_id,staff_profile_id) do nothing;
insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id) values
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000002','5a300000-0000-4000-8000-000000000004')
on conflict(appointment_id,staff_profile_id) do nothing;
insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id) values
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000001','5a800000-0000-4000-8000-000000000001'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000002','5a800000-0000-4000-8000-000000000002'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000003','5a800000-0000-4000-8000-000000000001'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000004','5a800000-0000-4000-8000-000000000002'),
('5a200000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000005','5a800000-0000-4000-8000-000000000003')
on conflict(appointment_id,resource_id) do nothing;
insert into public.payments(id,organization_id,branch_id,appointment_id,amount_centavos,method,status,reference,paid_at,notes) values
('5ab00000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000005',45000,'cash','paid','SALON-SEED-PAID',date_trunc('day',now())+interval '9 hours','Fake paid appointment'),
('5ab00000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5a900000-0000-4000-8000-000000000001',100000,'gcash','paid','SALON-SEED-PARTIAL',date_trunc('day',now())+interval '9 hours 30 minutes','Fake partial payment')
on conflict(id) do nothing;
insert into public.inventory_items(id,organization_id,branch_id,sku,name,unit,cost_centavos,sell_price_centavos,reorder_level,category) values
('5aa00000-0000-4000-8000-000000000001','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','SALON-SHAMPOO','Professional Shampoo','bottle',18000,35000,3,'Hair Care'),
('5aa00000-0000-4000-8000-000000000002','5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','SALON-SERUM','Facial Serum','bottle',42000,75000,2,'Skin Care')
on conflict(id) do nothing;
insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,idempotency_key,note) values
('5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5aa00000-0000-4000-8000-000000000001','opening',12,'salon-seed-shampoo','Fake local opening stock'),
('5a200000-0000-4000-8000-000000000001','5a400000-0000-4000-8000-000000000001','5aa00000-0000-4000-8000-000000000002','opening',8,'salon-seed-serum','Fake local opening stock')
on conflict(organization_id,idempotency_key) where idempotency_key is not null do nothing;

select 'Salon seed ready with linked and no-login Staff, two branches, clients, treatments, no-vehicle appointments, resources, products, and inventory.' as message;
