begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('16000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','advisor-owner@example.com','',now(),'{}','{}',now(),now()),
('16000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','advisor-cashier@example.com','',now(),'{}','{}',now(),now()),
('16000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','advisor-other@example.com','',now(),'{}','{}',now(),now()),
('16000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','advisor-restricted@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('26000000-0000-4000-8000-000000000001','Advisor A','advisor-a'),('26000000-0000-4000-8000-000000000002','Advisor B','advisor-b');
insert into organization_memberships(organization_id,user_id,role) values
('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','owner'),
('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000002','cashier'),
('26000000-0000-4000-8000-000000000002','16000000-0000-4000-8000-000000000003','owner'),
('26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000004','advisor');
insert into branches(id,organization_id,name,timezone,is_primary) values
('46000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Advisor A1','Asia/Manila',true),
('46000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000001','Advisor A2','Asia/Manila',false),
('46000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000002','Advisor B','Asia/Manila',true);
insert into membership_branch_assignments(membership_id,organization_id,branch_id) select id,organization_id,'46000000-0000-4000-8000-000000000002' from organization_memberships where user_id='16000000-0000-4000-8000-000000000004';
insert into customers(id,organization_id,full_name) values('56000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Advisor Customer'),('56000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','Other Customer');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number) values('66000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','Toyota','Vios','ADV001'),('66000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000002','Honda','City','ADV002');
insert into service_categories(id,organization_id,name) values('76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Advisor Service');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values('86000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','Brake Service',60,100000);
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status) values
('96000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001',1,'queued'),
('96000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000003','56000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000002',1,'queued');
insert into job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes) values('97000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001','Brake Service',1,100000,100000,60);
insert into job_inspections(organization_id,job_order_id,exterior_notes,inspected_by) values('26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','Checked','16000000-0000-4000-8000-000000000001');
insert into inventory_items(id,organization_id,branch_id,name,unit,sell_price_centavos) values
('a6000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','Brake Pad Set','set',50000),
('a6000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000002','Other Branch Pad','set',50000);
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,idempotency_key) values('26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','opening',1,'advisor-opening');

select plan(28);
select has_column('public','estimates','authorization_method','authorization method exists');
select has_column('public','estimates','authorized_total_centavos','authorized total snapshot exists');
select has_column('public','estimate_items','inventory_item_id','estimate part inventory link exists');

set local role authenticated; set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select create_estimate('96000000-0000-4000-8000-000000000001',0,0,'advisor estimate')$$,'estimate snapshots current work');
select lives_ok($$select save_estimate_item((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),null,'part','a6000000-0000-4000-8000-000000000001','Brake Pad Set',2,50000,0)$$,'part line links branch inventory');
select throws_ok($$select save_estimate_item((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),null,'part','a6000000-0000-4000-8000-000000000002','Other Branch Pad',1,50000,0)$$,'P0001','Select an active inventory item from this branch','another branch inventory cannot satisfy the estimate');
select is((select total_centavos from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),200000::bigint,'part line recalculates authoritative total');
select lives_ok($$select record_estimate_authorization((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),'approve','phone','customer approved')$$,'customer authorization recorded');
select is((select authorized_total_centavos from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),200000::bigint,'authorization snapshots estimate total');
select is((select status::text from job_orders where id='96000000-0000-4000-8000-000000000001'),'approved','authorization advances queued job');
select throws_ok($$select transition_job('96000000-0000-4000-8000-000000000001','start')$$,'P0001','Reserve all required parts before work starts','unreserved parts block work start');
select lives_ok($$select save_estimate_item((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),(select id from estimate_items where inventory_item_id='a6000000-0000-4000-8000-000000000001'),'part','a6000000-0000-4000-8000-000000000001','Brake Pad Set',1,50000,0)$$,'approved estimate can be revised safely');
select is((select status::text from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),'draft','material change invalidates authorization');
select is((select authorized_total_centavos from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),null::bigint,'authorization snapshot cleared');
select ok(exists(select 1 from audit_events where entity_id=(select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001') and event_type='estimate.authorization_invalidated'),'authorization invalidation audited');
select lives_ok($$select record_estimate_authorization((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),'approve','in_person',null)$$,'revised estimate reauthorized');
select lives_ok($$select reserve_job_required_parts('96000000-0000-4000-8000-000000000001','advisor-reserve-all')$$,'authorized required parts reserve before work');
select lives_ok($$select transition_job('96000000-0000-4000-8000-000000000001','start')$$,'approved work with ready parts starts');
select lives_ok($$select transition_job('96000000-0000-4000-8000-000000000001','quality_check')$$,'work enters QC');
select lives_ok($$select transition_job('96000000-0000-4000-8000-000000000001','ready')$$,'QC completes');
select lives_ok($$select issue_invoice('96000000-0000-4000-8000-000000000001',(select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),null)$$,'approved estimate issues invoice');
select throws_ok($$select transition_job('96000000-0000-4000-8000-000000000001','complete')$$,'P0001','Full payment is required before releasing the vehicle','unpaid balance blocks release');

set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select record_invoice_payment((select id from invoices where job_order_id='96000000-0000-4000-8000-000000000001'),50000,'cash',null,'deposit')$$,'cashier records partial payment');
select is((select balance_centavos from invoices where job_order_id='96000000-0000-4000-8000-000000000001'),100000::bigint,'partial payment leaves balance');
select lives_ok($$select record_invoice_payment((select id from invoices where job_order_id='96000000-0000-4000-8000-000000000001'),100000,'gcash','ADV-FINAL',null)$$,'cashier records final payment');

set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select transition_job('96000000-0000-4000-8000-000000000001','complete')$$,'fully paid QC-complete vehicle releases');

set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select record_estimate_authorization((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),'approve','phone',null)$$,'42501','Estimate not found','branch-restricted advisor cannot authorize another branch');

set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select record_estimate_authorization((select id from estimates where job_order_id='96000000-0000-4000-8000-000000000001'),'approve','phone',null)$$,'42501','Estimate not found','another tenant cannot authorize the estimate');

select * from finish(); rollback;
