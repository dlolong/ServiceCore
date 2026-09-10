begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

select is(
  (select is_nullable from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='vehicle_id'),
  'YES', 'appointment storage permits Salon bookings without a vehicle'
);
select ok((select relrowsecurity from pg_class where oid='public.appointments'::regclass), 'appointment RLS remains enabled');
select ok((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.appointment_directory'::regclass), 'appointment directory enforces caller table permissions');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('10620000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salon-appointment-owner@example.test','',now(),'{}','{}',now(),now());
insert into public.profiles(id,full_name) values('10620000-0000-4000-8000-000000000001','Salon Appointment Owner') on conflict(id) do update set full_name=excluded.full_name;
insert into public.organizations(id,name,slug,industry) values('20620000-0000-4000-8000-000000000001','Salon Appointment Test','salon-appointment-test','salon');
insert into public.organization_memberships(id,organization_id,user_id,role)
values('30620000-0000-4000-8000-000000000001','20620000-0000-4000-8000-000000000001','10620000-0000-4000-8000-000000000001','owner');
insert into public.branches(id,organization_id,name,timezone,is_primary)
values('40620000-0000-4000-8000-000000000001','20620000-0000-4000-8000-000000000001','Salon Test Branch','Asia/Manila',true);
insert into public.customers(id,organization_id,full_name)
values('50620000-0000-4000-8000-000000000001','20620000-0000-4000-8000-000000000001','Salon Test Client');
insert into public.services(id,organization_id,name,duration_minutes,base_price_centavos)
values('60620000-0000-4000-8000-000000000001','20620000-0000-4000-8000-000000000001','Salon Test Treatment',30,10000);
insert into public.organization_staff_profiles(id,organization_id,full_name,is_active)
values('80620000-0000-4000-8000-000000000001','20620000-0000-4000-8000-000000000001','Salon Test Staff',true);

set local role authenticated;
set local "request.jwt.claims"='{"sub":"10620000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment_with_staff(null,'40620000-0000-4000-8000-000000000001','50620000-0000-4000-8000-000000000001',null,array['60620000-0000-4000-8000-000000000001'::uuid],now()+interval '10 days','{}','{}',null,null,false)$$,
  'Salon owner saves an appointment without a vehicle or staff');
select lives_ok($$select save_appointment_with_staff(null,'40620000-0000-4000-8000-000000000001','50620000-0000-4000-8000-000000000001',null,array['60620000-0000-4000-8000-000000000001'::uuid],now()+interval '11 days',array['80620000-0000-4000-8000-000000000001'::uuid],'{}',null,null,false)$$,
  'Salon owner saves an appointment with staff and no vehicle');
select is((select count(*) from appointments where organization_id='20620000-0000-4000-8000-000000000001' and vehicle_id is null),2::bigint,'both Salon bookings persist without a vehicle');
select is((select count(*) from appointment_staff_assignments where organization_id='20620000-0000-4000-8000-000000000001' and staff_profile_id='80620000-0000-4000-8000-000000000001'),1::bigint,'selected Staff assignment persists');
select is((select count(*) from appointments where organization_id='20620000-0000-4000-8000-000000000001' and expected_total_centavos=10000 and ends_at=starts_at+interval '30 minutes'),2::bigint,'Salon pricing and duration snapshots remain correct');
select is((select count(*) from appointment_directory where organization_id='20620000-0000-4000-8000-000000000001'),2::bigint,'vehicle-less Salon bookings remain visible in the directory');
set local "request.jwt.claims"='{"sub":"10620000-0000-4000-8000-000000000099","role":"authenticated"}';
select is((select count(*) from appointment_directory where organization_id='20620000-0000-4000-8000-000000000001'),0::bigint,'non-members cannot read the Salon appointment directory');
select * from finish();
rollback;
