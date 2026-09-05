begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10550000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-owner@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-other@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-login@example.test','',now(),'{}','{}',now(),now()),
('10550000-0000-4000-8000-000000000005','00000000-0000-0000-8000-000000000000','authenticated','authenticated',null,'',now(),'{}','{}',now(),now());
insert into public.profiles(id,full_name) values
('10550000-0000-4000-8000-000000000001','Owner One'),
('10550000-0000-4000-8000-000000000002','Owner Two'),
('10550000-0000-4000-8000-000000000003','Login Staff')
on conflict(id) do update set full_name=excluded.full_name;
insert into public.organizations(id,name,slug,industry) values
('20550000-0000-4000-8000-000000000001','Staff A','staff-a','salon'),
('20550000-0000-4000-8000-000000000002','Staff B','staff-b','automotive');
insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values
('30550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','10550000-0000-4000-8000-000000000001','owner',true),
('30550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','10550000-0000-4000-8000-000000000002','owner',true);
update auth.users set email=null where id='10550000-0000-4000-8000-000000000001';
update public.profiles set full_name=null where id='10550000-0000-4000-8000-000000000001';
insert into public.branches(id,organization_id,name,timezone,is_primary) values
('40550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','A One','Asia/Manila',true),
('40550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000001','A Two','Asia/Manila',false),
('40550000-0000-4000-8000-000000000003','20550000-0000-4000-8000-000000000002','B One','Asia/Manila',true);
update public.branches set opening_hours='{"monday":{"open":"00:00","close":"23:59"},"tuesday":{"open":"00:00","close":"23:59"},"wednesday":{"open":"00:00","close":"23:59"},"thursday":{"open":"00:00","close":"23:59"},"friday":{"open":"00:00","close":"23:59"},"saturday":{"open":"00:00","close":"23:59"},"sunday":{"open":"00:00","close":"23:59"}}'::jsonb
where id='40550000-0000-4000-8000-000000000001';
insert into public.customers(id,organization_id,full_name) values
('50550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','Salon Client'),
('50550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','Auto Customer');
insert into public.services(id,organization_id,name,duration_minutes,base_price_centavos) values
('60550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000001','Haircut',30,50000),
('60550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','Inspection',30,50000);
insert into public.vehicles(id,organization_id,customer_id,make,model) values
('70550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','50550000-0000-4000-8000-000000000002','Test','Car');
insert into public.organization_staff_profiles(id,organization_id,full_name,job_function,is_active) values
('80550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','Offline Technician','Technician',true);
insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id) values
('80550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003');
insert into public.job_orders(id,organization_id,branch_id,customer_id,vehicle_id,status) values
('90550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003','50550000-0000-4000-8000-000000000002','70550000-0000-4000-8000-000000000001','queued');
insert into public.job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes) values
('a0550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','90550000-0000-4000-8000-000000000001','60550000-0000-4000-8000-000000000002','Inspection',1,50000,50000,30);
insert into public.job_inspections(organization_id,job_order_id,exterior_notes,inspected_by) values
('20550000-0000-4000-8000-000000000002','90550000-0000-4000-8000-000000000001','Ready','10550000-0000-4000-8000-000000000002');
insert into public.estimates(id,organization_id,branch_id,job_order_id,version,status,subtotal_centavos,total_centavos,authorized_total_centavos,approved_at) values
('b0550000-0000-4000-8000-000000000001','20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003','90550000-0000-4000-8000-000000000001',1,'approved',50000,50000,50000,now());

select plan(54);
select throws_ok(
  $$insert into public.organization_memberships(id,organization_id,user_id,role,is_active) values('30550000-0000-4000-8000-000000000005','20550000-0000-4000-8000-000000000001','10550000-0000-4000-8000-000000000005','technician',true)$$,
  'P0001','Staff full name is required',
  'linked Staff initialization rejects missing name and email instead of inventing a placeholder'
);
select is(
  (select id from public.organization_staff_profiles where membership_id='30550000-0000-4000-8000-000000000001'),
  '30550000-0000-4000-8000-000000000001'::uuid,
  'new linked Staff keeps id equal to membership id'
);

set local role authenticated;
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select save_organization_staff_profile('30550000-0000-4000-8000-000000000001','Owner','{}')$$,
  'P0001','Staff full name is required',
  'legacy Staff profile save rejects missing authoritative display name'
);
reset role;
update auth.users set email='staff-owner@example.test' where id='10550000-0000-4000-8000-000000000001';
update public.profiles set full_name='Owner One' where id='10550000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000001","role":"authenticated"}';
create temp table test_staff_ids(staff_id uuid);
select lives_ok($$insert into test_staff_ids select save_staff_profile(null,'20550000-0000-4000-8000-000000000001','No Login Staff',null,null,'Stylist',array['Haircut'],true,array['40550000-0000-4000-8000-000000000001'::uuid])$$,'owner creates Staff without login or contacts');
select is((select count(*) from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff' and membership_id is null and email is null and mobile is null)::bigint,1::bigint,'no-login Staff is independently persisted');
select is((select count(*) from staff_directory where organization_id='20550000-0000-4000-8000-000000000001' and full_name='No Login Staff')::bigint,1::bigint,'safe directory includes no-login Staff');
select is((select branch_ids from staff_directory where organization_id='20550000-0000-4000-8000-000000000001' and full_name='No Login Staff'),array['40550000-0000-4000-8000-000000000001'::uuid],'operational Staff branch scope is separate');
select is((select system_access_status from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),'none','no-login Staff reports no system access');
select is((select user_id from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),null::uuid,'no-login Staff exposes no auth user id');
select is((select role::text from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),null::text,'job function is not an authorization role');
select lives_ok($$select save_staff_profile(null,'20550000-0000-4000-8000-000000000001','Both Contact','Both@Example.Test','0917 111 0001',null,'{}',true,'{}')$$,'Staff may persist both contacts');
select lives_ok($$select save_staff_profile(null,'20550000-0000-4000-8000-000000000001','Mobile Only',null,'0917 111 0002',null,'{}',true,'{}')$$,'Staff may persist mobile only');
select lives_ok($$select save_staff_profile(null,'20550000-0000-4000-8000-000000000001','Email Only','EMAIL@EXAMPLE.TEST',null,null,'{}',true,'{}')$$,'Staff may persist email only');
select results_eq(
  $$select full_name,email,mobile from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name in('Both Contact','Email Only','Mobile Only','No Login Staff') order by full_name$$,
  $$values ('Both Contact'::text,'both@example.test'::text,'+639171110001'::text),('Email Only','email@example.test',null),('Mobile Only',null,'+639171110002'),('No Login Staff',null,null)$$,
  'database stores the both/mobile/email/neither matrix normalized'
);
select throws_ok($$select save_staff_profile(null,'20550000-0000-4000-8000-000000000002','Cross Tenant',null,null,null,'{}',true,'{}')$$,'42501','Staff management access required','cross-tenant Staff creation is denied');
select is((select count(*) from staff_directory where organization_id='20550000-0000-4000-8000-000000000002')::bigint,0::bigint,'Org A cannot read Org B Staff');
select throws_ok($$select save_staff_profile('30550000-0000-4000-8000-000000000002','20550000-0000-4000-8000-000000000002','Changed By Other Org',null,null,null,'{}',true,'{}')$$,'42501','Staff management access required','Org A cannot update Org B Staff');
select throws_ok($$select update_staff_profile_access('30550000-0000-4000-8000-000000000002','manager',true,'{}')$$,'42501','Staff member not found','Org A cannot attach access membership to Org B Staff');
select throws_ok($$select create_staff_profile_invitation('30550000-0000-4000-8000-000000000002','other-login@example.test','manager','{}',72)$$,'42501','Staff member not found','Org A cannot invite Org B Staff');
select throws_ok($$select save_staff_profile(null,'20550000-0000-4000-8000-000000000001','Bad Branch',null,null,null,'{}',true,array['40550000-0000-4000-8000-000000000003'::uuid])$$,'P0001','Invalid Staff branch','cross-tenant operational branch assignment is denied');
select lives_ok($$select save_staff_profile((select staff_id from staff_directory where full_name='No Login Staff'),'20550000-0000-4000-8000-000000000001','No Login Staff',null,null,'Stylist',array['Haircut'],false,array['40550000-0000-4000-8000-000000000001'::uuid])$$,'employment state changes without login access');
select is((select is_active from staff_directory where full_name='No Login Staff'),false,'operational Staff can be independently deactivated');
select lives_ok($$select save_staff_profile((select staff_id from staff_directory where full_name='No Login Staff'),'20550000-0000-4000-8000-000000000001','No Login Staff',null,null,'Stylist',array['Haircut'],true,array['40550000-0000-4000-8000-000000000001'::uuid])$$,'no-login Staff can be reactivated for scheduling');
select lives_ok($$select save_appointment_with_staff(null,'40550000-0000-4000-8000-000000000001','50550000-0000-4000-8000-000000000001',null,array['60550000-0000-4000-8000-000000000001'::uuid],now()+interval '10 days',array[(select staff_id from staff_directory where full_name='No Login Staff')],'{}',null,null,true)$$,'Core scheduling assigns no-login Staff');
select is((select count(*) from appointment_staff_assignments where staff_profile_id=(select staff_id from staff_directory where full_name='No Login Staff'))::bigint,1::bigint,'Appointment assignment stores canonical Staff ID');
select throws_ok($$select save_appointment_with_staff(null,'40550000-0000-4000-8000-000000000001','50550000-0000-4000-8000-000000000001',null,array['60550000-0000-4000-8000-000000000001'::uuid],now()+interval '11 days',array['80550000-0000-4000-8000-000000000001'::uuid],'{}',null,null,true)$$,'P0001','Staff member is not allowed at this branch','cross-tenant Staff cannot be scheduled');

create temp table test_staff_invite_token(token text);
select lives_ok($$insert into test_staff_invite_token select create_staff_profile_invitation((select staff_id from staff_directory where full_name='No Login Staff'),'staff-login@example.test','technician',array['40550000-0000-4000-8000-000000000002'::uuid],72)$$,'owner explicitly invites an existing Staff profile');
select is((select system_access_status from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),'pending','pending invitation is reported');
select is((select role::text from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),'technician','pending invitation role is projected');
select is((select access_branch_ids from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),array['40550000-0000-4000-8000-000000000002'::uuid],'pending invitation access branches are projected');

set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select accept_staff_invitation((select token from test_staff_invite_token))$$,'invited user links login to the existing operational Staff profile');
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select system_access_status from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),'active','linked Staff reports active system access');
select is((select count(*) from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff')::bigint,1::bigint,'profile-bound invitation never duplicates operational Staff');
select lives_ok($$select save_staff_profile((select staff_id from staff_directory where full_name='No Login Staff'),'20550000-0000-4000-8000-000000000001','No Login Staff','business-contact@example.test',null,'Stylist',array['Haircut'],true,array['40550000-0000-4000-8000-000000000001'::uuid])$$,'linked Staff business contact can be edited independently');
reset role;
select is((select email from auth.users where id='10550000-0000-4000-8000-000000000003'),'staff-login@example.test','editing Staff contact does not alter the Auth login email');
set local role authenticated;
select is((select email from list_staff_profiles('20550000-0000-4000-8000-000000000001') where full_name='No Login Staff'),'business-contact@example.test','linked Staff stores its independent business contact email');
set local role service_role;
select is((select count(*) from staff_profile_branch_assignments assignment join organization_staff_profiles staff on staff.id=assignment.staff_profile_id where staff.organization_id='20550000-0000-4000-8000-000000000001' and assignment.organization_id<>staff.organization_id)::bigint,0::bigint,'Staff branch relation preserves tenant integrity');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"10550000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select assign_job_staff('90550000-0000-4000-8000-000000000001','80550000-0000-4000-8000-000000000001',null)$$,'manager assigns no-login Staff to Automotive Job');
select is((select primary_technician_staff_id from job_orders where id='90550000-0000-4000-8000-000000000001'),'80550000-0000-4000-8000-000000000001'::uuid,'Job stores canonical Staff assignment');
select lives_ok($$select assign_job_item_staff('a0550000-0000-4000-8000-000000000001','80550000-0000-4000-8000-000000000001')$$,'manager assigns no-login Staff to Job item');
select is((select technician_staff_id from job_order_items where id='a0550000-0000-4000-8000-000000000001'),'80550000-0000-4000-8000-000000000001'::uuid,'Job item stores canonical Staff assignment');
select lives_ok($$select start_automotive_staff_work_session('90550000-0000-4000-8000-000000000001','80550000-0000-4000-8000-000000000001')$$,'manager records ready work for no-login Staff');
select ok((select technician_staff_id='80550000-0000-4000-8000-000000000001' and technician_user_id is null and technician_name_snapshot='Offline Technician' from automotive_job_order_work_sessions where job_order_id='90550000-0000-4000-8000-000000000001'),'work session preserves Staff identity/name without auth user');
select throws_ok($$select assign_job_staff('90550000-0000-4000-8000-000000000001',(select staff_id from test_staff_ids),null)$$,'42501','Technician is not available for this branch','cross-tenant Staff cannot be linked to Automotive Job');

reset role;
update public.job_orders
set primary_technician_staff_id = null,
    primary_technician_user_id = '10550000-0000-4000-8000-000000000002'
where id = '90550000-0000-4000-8000-000000000001';
select is(
  (select primary_technician_staff_id from public.job_orders where id = '90550000-0000-4000-8000-000000000001'),
  '30550000-0000-4000-8000-000000000002'::uuid,
  'legacy Job technician user writes resolve to canonical Staff identity'
);
insert into public.automotive_job_order_work_sessions(
  organization_id,branch_id,job_order_id,technician_user_id,
  technician_name_snapshot,created_by,status,started_at,ended_at,end_reason
) values (
  '20550000-0000-4000-8000-000000000002','40550000-0000-4000-8000-000000000003',
  '90550000-0000-4000-8000-000000000001','10550000-0000-4000-8000-000000000002',
  'Owner Two','10550000-0000-4000-8000-000000000002','completed',now(),now(),'stopped'
);
select is(
  (select technician_staff_id from public.automotive_job_order_work_sessions where technician_name_snapshot = 'Owner Two'),
  '30550000-0000-4000-8000-000000000002'::uuid,
  'legacy Work Session technician user writes resolve to canonical Staff identity'
);

set local role service_role;
select is(has_table_privilege('authenticated','public.organization_staff_profiles','INSERT'),false,'authenticated cannot insert Staff profile rows directly');
select is(has_table_privilege('authenticated','public.organization_staff_profiles','UPDATE'),false,'authenticated cannot update Staff profile rows directly');
select is(has_table_privilege('authenticated','public.organization_staff_profiles','DELETE'),false,'authenticated cannot delete Staff profile rows directly');
select is(has_table_privilege('authenticated','public.organization_staff_profiles','TRUNCATE'),false,'authenticated cannot truncate Staff profiles');
select is(has_table_privilege('authenticated','public.organization_staff_profiles','REFERENCES'),false,'authenticated cannot create references from Staff profiles');
select is(has_table_privilege('authenticated','public.organization_staff_profiles','TRIGGER'),false,'authenticated cannot create Staff profile triggers');
select is(has_column_privilege('authenticated','public.organization_staff_profiles','email','SELECT'),false,'authenticated directory reads cannot select Staff email');
select is(has_column_privilege('authenticated','public.organization_staff_profiles','mobile','SELECT'),false,'authenticated directory reads cannot select Staff mobile');

select * from finish();
rollback;
