begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('13000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','schedule-a@example.test','',now(),'{}','{}',now(),now()),
('13000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','schedule-b@example.test','',now(),'{}','{}',now(),now()),
('13000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','schedule-inactive@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values
('23000000-0000-4000-8000-000000000001','Schedule A','schedule-a'),
('23000000-0000-4000-8000-000000000002','Schedule B','schedule-b');
insert into organization_memberships(organization_id,user_id,role,is_active) values
('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','owner',true),
('23000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000002','owner',true),
('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','advisor',false);
insert into branches(id,organization_id,name,timezone,is_primary) values
('43000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','Schedule Branch A','Asia/Manila',true),
('43000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','Schedule Branch B','Asia/Manila',true);
insert into customers(id,organization_id,full_name) values
('53000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','Schedule Customer A'),
('53000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','Schedule Customer B');
insert into vehicles(id,organization_id,customer_id,make,model,vehicle_type) values
('63000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','Toyota','Vios','Sedan'),
('63000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002','Honda','City','Sedan');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values
('83000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','Core Schedule Service',30,25000);
insert into appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,starts_at) values
('93000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',null,'confirmed',now()+interval '1 day');

select plan(15);
select is((select is_nullable from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='vehicle_id'),'YES','appointment vehicle is nullable');
select ok(exists(select 1 from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.constraint_schema=tc.constraint_schema where tc.table_schema='public' and tc.table_name='appointments' and tc.constraint_type='FOREIGN KEY' and ccu.table_name='vehicles' and ccu.column_name='id'),'vehicle foreign key is preserved');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"13000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',array['83000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day')$$,'same-tenant automotive appointment is allowed');
select lives_ok($$select save_appointment(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',null,array['83000000-0000-4000-8000-000000000001'::uuid],now()+interval '2 days')$$,'core appointment without a vehicle is allowed');
select throws_ok($$select save_appointment_with_availability(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',null,array['83000000-0000-4000-8000-000000000001'::uuid],(select starts_at from appointments order by starts_at limit 1),null,null,false)$$,'P0001','Another appointment overlaps this time','authoritative persistence rejects overlap');
select lives_ok($$select save_appointment_with_availability(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',null,array['83000000-0000-4000-8000-000000000001'::uuid],(select starts_at from appointments order by starts_at limit 1),null,null,true)$$,'authorized overlap override persists');
select lives_ok($$select save_appointment_with_availability(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',null,array['83000000-0000-4000-8000-000000000001'::uuid],(select max(ends_at) from appointments),null,null,false)$$,'end-exclusive adjacent appointment persists');
select is((select count(*) from appointments where organization_id='23000000-0000-4000-8000-000000000001' and vehicle_id is null)::bigint,3::bigint,'no-vehicle appointments remain visible to their tenant');
select throws_ok($$select save_appointment(null,'43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000002',array['83000000-0000-4000-8000-000000000001'::uuid],now()+interval '3 days')$$,'P0001','Appointment organization mismatch','cross-tenant vehicle association is denied');
select is((select count(*) from appointments where organization_id='23000000-0000-4000-8000-000000000002')::bigint,0::bigint,'Org A cannot read Org B no-vehicle appointment');
select is_empty($$update appointments set customer_note='attack' where organization_id='23000000-0000-4000-8000-000000000002' returning 1$$,'Org A cannot update Org B no-vehicle appointment');
select throws_ok($$select enqueue_appointment((select id from appointments where organization_id='23000000-0000-4000-8000-000000000001' and vehicle_id is null limit 1))$$,'P0001','A vehicle is required to enter the automotive queue','no-vehicle appointment cannot enter automotive queue');
select is((select count(*) from appointment_directory where organization_id='23000000-0000-4000-8000-000000000001')::bigint,4::bigint,'appointment directory retains vehicle and no-vehicle appointments');

reset role;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"13000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*) from appointments)::bigint,0::bigint,'inactive membership cannot read appointments');
select is_empty($$update appointments set customer_note='blocked' where organization_id='23000000-0000-4000-8000-000000000001' returning 1$$,'inactive membership cannot update appointments');

select * from finish();
rollback;
