begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('11000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2a@example.com','',now(),'{}','{}',now(),now()),
 ('11000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2b@example.com','',now(),'{}','{}',now(),now()),
 ('11000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2staff@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,created_by) values
 ('21000000-0000-4000-8000-000000000001','Phase Two A','phase-two-a','11000000-0000-4000-8000-000000000001'),
 ('21000000-0000-4000-8000-000000000002','Phase Two B','phase-two-b','11000000-0000-4000-8000-000000000002');
insert into organization_subscriptions(organization_id,plan_id,status)values('21000000-0000-4000-8000-000000000001','multi_branch','active'),('21000000-0000-4000-8000-000000000002','multi_branch','active');
insert into organization_memberships(organization_id,user_id,role) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','owner'),
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','advisor'),
 ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,address_line,city,province,is_primary) values
 ('41000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','Branch A','1 A St','Calamba','Laguna',true),
 ('41000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','Branch B','1 B St','Makati','Metro Manila',true);
insert into customers(id,organization_id,full_name,phone,email) values
 ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','Customer A','09171234567','A@EXAMPLE.COM'),
 ('51000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','Customer B','09181234567','b@example.com');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number) values
 ('61000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Toyota','Vios','ABC-1234'),
 ('61000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002','Honda','City','XYZ 9876');

select plan(30);
select is((select phone_normalized from customers where id='51000000-0000-4000-8000-000000000001'),'+639171234567','PH phone is normalized by database');
select is((select email from customers where id='51000000-0000-4000-8000-000000000001'),'a@example.com','email is normalized by database');
select is((select plate_normalized from vehicles where id='61000000-0000-4000-8000-000000000001'),'ABC1234','plate is normalized by database');
select throws_ok($$insert into vehicles(organization_id,customer_id,make,model,plate_number) values('21000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Toyota','Vios','ABC 1234')$$,'23505',null,'active duplicate plate is rejected per tenant');
select lives_ok($$insert into vehicles(organization_id,customer_id,make,model,plate_number) values('21000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002','Toyota','Vios','ABC 1234')$$,'same plate is allowed in another tenant');
select throws_ok($$insert into vehicles(organization_id,customer_id,make,model) values('21000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','Bad','Link')$$,'P0001','Vehicle/customer organization mismatch','cross-tenant customer relationship is rejected');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from branches)::bigint,1::bigint,'Owner A sees one own branch');
select is((select count(*) from customers)::bigint,1::bigint,'Owner A sees one own customer');
select is((select count(*) from vehicles)::bigint,1::bigint,'Owner A sees one own vehicle');
select is((select count(*) from vehicle_directory)::bigint,1::bigint,'security-invoker vehicle directory preserves RLS');
select lives_ok($$insert into branches(organization_id,name,address_line,city,province) values('21000000-0000-4000-8000-000000000001','Branch A2','2 A St','Calamba','Laguna')$$,'owner creates own branch');
select lives_ok($$insert into customers(organization_id,full_name,phone) values('21000000-0000-4000-8000-000000000001','New Customer','09991234567')$$,'owner creates own customer');
select lives_ok($$insert into vehicles(organization_id,customer_id,make,model) values('21000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Mitsubishi','Montero')$$,'owner creates own vehicle');
select is_empty($$update branches set name='Attacked' where id='41000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot update Branch B');
select is_empty($$update customers set full_name='Attacked' where id='51000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot update Customer B');
select is_empty($$update vehicles set model='Attacked' where id='61000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot update Vehicle B');
select is_empty($$delete from branches where id='41000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot delete Branch B');
select is_empty($$delete from customers where id='51000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot delete Customer B');
select is_empty($$delete from vehicles where id='61000000-0000-4000-8000-000000000002' returning 1$$,'Owner A cannot delete Vehicle B');
select lives_ok($$select set_primary_branch((select id from branches where name='Branch A2'))$$,'owner can change own default branch');
select is((select count(*) from branches where is_primary)::bigint,1::bigint,'exactly one tenant-visible primary remains');
select throws_ok($$select set_primary_branch('41000000-0000-4000-8000-000000000002')$$,'42501','Branch not found','Owner A cannot manipulate Org B default branch');
select lives_ok($$select set_branch_active('41000000-0000-4000-8000-000000000001',false)$$,'non-primary branch can be deactivated');
select throws_ok($$select set_branch_active((select id from branches where is_primary),false)$$,'P0001','An organization must keep one active branch','last active branch cannot be deactivated');

set local "request.jwt.claims"='{"sub":"11000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$insert into customers(organization_id,full_name) values('21000000-0000-4000-8000-000000000001','Advisor Customer')$$,'advisor can create customers');
select is_empty($$update branches set phone='blocked' where organization_id='21000000-0000-4000-8000-000000000001' returning 1$$,'advisor cannot manage branches');

reset role; set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select * from customers$$,'42501',null,'anonymous customer access is denied');
select throws_ok($$select * from vehicles$$,'42501',null,'anonymous vehicle access is denied');
select throws_ok($$select * from branches$$,'42501',null,'anonymous branch access is denied');
select throws_ok($$select * from vehicle_directory$$,'42501',null,'anonymous vehicle directory access is denied');

select * from finish(); rollback;
