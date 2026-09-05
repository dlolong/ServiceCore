begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10540000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','command-owner@example.com','',now(),'{}','{}',now(),now()),
('10540000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','command-manager@example.com','',now(),'{}','{}',now(),now()),
('10540000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','command-advisor@example.com','',now(),'{}','{}',now(),now()),
('10540000-0000-4000-8000-000000000004','00000000-0000-0000-8000-000000000000','authenticated','authenticated','command-other@example.com','',now(),'{}','{}',now(),now());

insert into organizations(id,name,slug) values
('20540000-0000-4000-8000-000000000001','Command A','command-a'),
('20540000-0000-4000-8000-000000000002','Command B','command-b');
insert into organization_memberships(id,organization_id,user_id,role) values
('30540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','10540000-0000-4000-8000-000000000001','owner'),
('30540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','10540000-0000-4000-8000-000000000002','manager'),
('30540000-0000-4000-8000-000000000003','20540000-0000-4000-8000-000000000001','10540000-0000-4000-8000-000000000003','advisor'),
('30540000-0000-4000-8000-000000000004','20540000-0000-4000-8000-000000000002','10540000-0000-4000-8000-000000000004','owner');
insert into branches(id,organization_id,name,timezone,is_primary,is_active) values
('40540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','Manila','Asia/Manila',true,true),
('40540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','New York','America/New_York',false,true),
('40540000-0000-4000-8000-000000000003','20540000-0000-4000-8000-000000000002','Other','Asia/Manila',true,true),
('40540000-0000-4000-8000-000000000004','20540000-0000-4000-8000-000000000001','Inactive','Asia/Manila',false,false);
insert into membership_branch_assignments(membership_id,organization_id,branch_id) values
('30540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001');

insert into customers(id,organization_id,full_name) values
('50540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','Command Customer');
insert into vehicles(id,organization_id,customer_id,make,model) values
('60540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','50540000-0000-4000-8000-000000000001','Test','Vehicle');
insert into appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,expected_total_centavos) values
('70540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','50540000-0000-4000-8000-000000000001',null,'completed','internal',((current_timestamp at time zone 'Asia/Manila')::date+time '09:00') at time zone 'Asia/Manila',10000),
('70540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002','50540000-0000-4000-8000-000000000001',null,'confirmed','internal',((current_timestamp at time zone 'America/New_York')::date+time '09:00') at time zone 'America/New_York',5000),
('70540000-0000-4000-8000-000000000003','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','50540000-0000-4000-8000-000000000001',null,'confirmed','internal',(((current_timestamp at time zone 'Asia/Manila')::date-1)+time '09:00') at time zone 'Asia/Manila',5000);

insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,appointment_id,status) values
('80540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','50540000-0000-4000-8000-000000000001','60540000-0000-4000-8000-000000000001',null,'completed');
insert into invoices(id,organization_id,branch_id,job_order_id,invoice_number,status,customer_name_snapshot,vehicle_snapshot,subtotal_centavos,total_centavos,paid_centavos,balance_centavos) values
('90540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','80540000-0000-4000-8000-000000000001','CMD-001','issued','Command Customer','Test Vehicle',5000,5000,0,5000);

insert into payments(id,organization_id,branch_id,appointment_id,amount_centavos,method,status,paid_at) values
('a0540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','70540000-0000-4000-8000-000000000001',3000,'cash','paid',((current_timestamp at time zone 'Asia/Manila')::date+time '10:00') at time zone 'Asia/Manila'),
('a0540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001',null,1000,'cash','paid',((current_timestamp at time zone 'Asia/Manila')::date+time '11:00') at time zone 'Asia/Manila'),
('a0540000-0000-4000-8000-000000000003','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002',null,2000,'cash','paid',((current_timestamp at time zone 'America/New_York')::date+time '11:00') at time zone 'America/New_York'),
('a0540000-0000-4000-8000-000000000004','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001',null,9000,'cash','paid',(((current_timestamp at time zone 'Asia/Manila')::date-1)+time '11:00') at time zone 'Asia/Manila');

insert into inventory_items(id,organization_id,branch_id,name,unit,reorder_level) values
('b0540000-0000-4000-8000-000000000001','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','Low Item','unit',5),
('b0540000-0000-4000-8000-000000000002','20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002','Healthy Item','unit',1);
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta) values
('20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001','b0540000-0000-4000-8000-000000000001','opening',2),
('20540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002','b0540000-0000-4000-8000-000000000002','opening',4);

select plan(16);
select has_function('public','get_command_center_shared_metrics',array['uuid','uuid[]'],'shared metric RPC exists');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"10540000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select revenue_today_centavos from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])),4000::bigint,'revenue uses paid payments in branch local today');
select is((select appointments_today from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])),1::bigint,'appointments use Manila local today');
select is((select outstanding_centavos from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])),12000::bigint,'outstanding combines invoice and completed Appointment balances');
select is((select low_stock_count from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])),1::bigint,'low stock reuses inventory_stock semantics');
select is((select revenue_today_centavos from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000002']::uuid[])),2000::bigint,'New York branch uses its own local today');
select is((select appointments_today from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000002']::uuid[])),1::bigint,'New York appointments use its local today');
select is((select count(*) from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002']::uuid[]))::bigint,2::bigint,'owner can aggregate accessible branches');
select is((select sum(revenue_today_centavos) from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000002']::uuid[])),6000::numeric,'all-branch revenue has no cross-tenant data');

set local "request.jwt.claims"='{"sub":"10540000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])$$,'restricted manager can read assigned branch');
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000002']::uuid[])$$,'42501','Command Center branch scope unavailable','restricted manager cannot read another branch');

set local "request.jwt.claims"='{"sub":"10540000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])$$,'42501','Command Center access denied','advisor cannot read Owner Command Center finances');

set local "request.jwt.claims"='{"sub":"10540000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001']::uuid[])$$,'42501','Command Center access denied','another tenant cannot read Command Center metrics');

set local "request.jwt.claims"='{"sub":"10540000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000004']::uuid[])$$,'42501','Command Center branch scope unavailable','inactive branch is denied');
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001',array['40540000-0000-4000-8000-000000000001','40540000-0000-4000-8000-000000000001']::uuid[])$$,'42501','Command Center access denied','duplicate branch scope is rejected');
select throws_ok($$select * from get_command_center_shared_metrics('20540000-0000-4000-8000-000000000001','{}'::uuid[])$$,'42501','Command Center access denied','empty branch scope is rejected');

select * from finish();
rollback;
