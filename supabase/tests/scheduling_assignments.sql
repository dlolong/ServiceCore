begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('14000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','assign-owner-a@example.test','',now(),'{}','{}',now(),now()),
('14000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','assign-owner-b@example.test','',now(),'{}','{}',now(),now()),
('14000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','assign-staff-a@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('24000000-0000-4000-8000-000000000001','Assignment A','assignment-a'),('24000000-0000-4000-8000-000000000002','Assignment B','assignment-b');
insert into organization_memberships(id,organization_id,user_id,role) values
('34000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','owner'),
('34000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000002','14000000-0000-4000-8000-000000000002','owner'),
('34000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000003','advisor');
insert into branches(id,organization_id,name) values
('44000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','A One'),
('44000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','A Two'),
('44000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000002','B One');
insert into membership_branch_assignments(membership_id,organization_id,branch_id) values('34000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001');
insert into customers(id,organization_id,full_name) values('54000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','Assignment Customer');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values('84000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','Assignment Service',60,10000);
insert into scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity,is_active) values
('74000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','Bay One','bay',1,true),
('74000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','Open Area','station',3,true),
('74000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000003','Other Tenant Bay','bay',1,true),
('74000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','Inactive Bay','bay',1,false);

select plan(16);
select has_table('public','scheduling_resources','generic scheduling resources exist');
select has_table('public','appointment_staff_assignments','staff assignments exist');
select has_table('public','appointment_resource_assignments','resource assignments exist');
select col_has_check('public','scheduling_resources','capacity','resource capacity is constrained');
select col_has_check('public','appointment_resource_assignments','quantity','resource quantity is constrained');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"14000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from scheduling_resources)::bigint,3::bigint,'Org A cannot read Org B resources');
select lives_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],now()+interval '10 days',array['34000000-0000-4000-8000-000000000003'::uuid],array['74000000-0000-4000-8000-000000000001'::uuid],null,null,false)$$,'same-tenant staff and resource assignment succeeds');
select is((select count(*) from appointment_staff_assignments)::bigint,1::bigint,'staff assignment is visible to its tenant');
select is((select count(*) from appointment_resource_assignments)::bigint,1::bigint,'resource assignment is visible to its tenant');
select throws_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],now()+interval '11 days',array['34000000-0000-4000-8000-000000000002'::uuid],'{}',null,null,false)$$,'P0001','Staff member is not allowed at this branch','cross-tenant staff is rejected');
select throws_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],now()+interval '12 days','{}',array['74000000-0000-4000-8000-000000000003'::uuid],null,null,false)$$,'P0001','Scheduling resource is not available at this branch','cross-tenant resource is rejected');
select throws_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],now()+interval '13 days',array['34000000-0000-4000-8000-000000000003'::uuid],'{}',null,null,false)$$,'P0001','Staff member is not allowed at this branch','branch-ineligible staff is rejected');
select throws_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],now()+interval '14 days','{}',array['74000000-0000-4000-8000-000000000004'::uuid],null,null,false)$$,'P0001','Scheduling resource is not available at this branch','inactive resource is rejected');
select throws_ok($$select save_appointment_with_assignments(null,'44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',null,array['84000000-0000-4000-8000-000000000001'::uuid],(select starts_at from appointments where organization_id='24000000-0000-4000-8000-000000000001' limit 1),array['34000000-0000-4000-8000-000000000003'::uuid],array['74000000-0000-4000-8000-000000000001'::uuid],null,null,false)$$,'P0001','Another appointment overlaps this time','serialized write rejects conflicting assignment schedule');
select is_empty($$update scheduling_resources set name='attack' where organization_id='24000000-0000-4000-8000-000000000002' returning 1$$,'Org A cannot mutate Org B resources');
select throws_ok($$insert into appointment_resource_assignments(organization_id,appointment_id,resource_id) select organization_id,id,'74000000-0000-4000-8000-000000000001' from appointments limit 1$$,'42501','permission denied for table appointment_resource_assignments','assignment tables are RPC-only');

select * from finish();
rollback;
