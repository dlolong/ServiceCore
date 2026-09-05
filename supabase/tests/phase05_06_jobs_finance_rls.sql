begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('15000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-owner-a@example.com','',now(),'{}','{}',now(),now()),
('15000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-owner-b@example.com','',now(),'{}','{}',now(),now()),
('15000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-tech-a@example.com','',now(),'{}','{}',now(),now()),
('15000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-tech-other@example.com','',now(),'{}','{}',now(),now()),
('15000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-cashier-a@example.com','',now(),'{}','{}',now(),now()),
('15000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jobs-tech-branch@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('25000000-0000-4000-8000-000000000001','Jobs A','jobs-a'),('25000000-0000-4000-8000-000000000002','Jobs B','jobs-b');
update plans set limits=jsonb_set(limits,'{branches}','2'::jsonb) where id='free';
insert into organization_memberships(organization_id,user_id,role) values
('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001','owner'),('25000000-0000-4000-8000-000000000002','15000000-0000-4000-8000-000000000002','owner'),
('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000003','technician'),('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000004','technician'),
('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000005','cashier'),('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000006','technician');
insert into branches(id,organization_id,name,timezone,is_primary) values('45000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','Jobs Branch A','Asia/Manila',true),('45000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','Jobs Branch B','Asia/Manila',true);
insert into customers(id,organization_id,full_name) values('55000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','Customer A'),('55000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','Customer B');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number,vehicle_type) values('65000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001','Toyota','Fortuner','AAA111','SUV'),('65000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002','Honda','City','BBB222','Sedan');
insert into service_categories(id,organization_id,name) values('75000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','Detailing'),('75000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','Detailing');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values('85000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','Wash A',45,50000),('85000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000002','Wash B',45,90000);

select plan(53);
select has_table('public','job_inspections','inspection table exists');
select has_table('public','job_photos','job photos table exists');
select has_table('public','estimates','estimates table exists');
select has_table('public','invoices','invoices table exists');
select has_function('public','convert_queue_to_job',array['uuid'],'queue conversion RPC exists');
select has_function('public','assign_job',array['uuid','uuid','timestamp with time zone'],'assignment RPC exists');
select has_function('public','record_invoice_payment',array['uuid','bigint','payment_method','text','text'],'payment RPC exists');
select ok((select not public from storage.buckets where id='job-photos'),'job photo bucket is private');
select has_column('public','job_orders','technician_assigned_at','job assignment timestamp exists');
select has_column('public','job_order_items','technician_assigned_at','service assignment timestamp exists');

set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select * from job_orders$$,'42501',null,'anon cannot read jobs');
select throws_ok($$select * from estimates$$,'42501',null,'anon cannot read estimates');
select throws_ok($$select * from invoices$$,'42501',null,'anon cannot read invoices');
select throws_ok($$select * from payments$$,'42501',null,'anon cannot read payments');

reset role; set local role authenticated; set local "request.jwt.claims"='{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment(null,'45000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001',array['85000000-0000-4000-8000-000000000001'::uuid],now()+interval '1 day')$$,'owner creates appointment');
select lives_ok($$select transition_appointment((select id from appointments),'confirm')$$,'appointment confirmed');
select lives_ok($$select enqueue_appointment((select id from appointments))$$,'appointment queued');
select lives_ok($$select convert_queue_to_job((select id from queue_entries))$$,'queue converts to job atomically');
select is((select count(*) from job_orders)::bigint,1::bigint,'one job created');
select is((select actual_total_centavos from job_orders),50000::bigint,'job total derived from snapshot');
select is((select status::text from queue_entries),'converted_to_job','queue marked converted');
select is((select convert_queue_to_job((select id from queue_entries))),(select id from job_orders),'queue conversion retry returns the existing job');
select lives_ok($$select assign_job((select id from job_orders),'15000000-0000-4000-8000-000000000003',now()+interval '2 hours')$$,'owner assigns technician');
select is((select primary_technician_user_id from job_orders),'15000000-0000-4000-8000-000000000003'::uuid,'assigned technician persisted');
reset role;
insert into branches(id,organization_id,name,timezone) values('45000000-0000-4000-8000-000000000003','25000000-0000-4000-8000-000000000001','Jobs Branch A2','Asia/Manila');
insert into membership_branch_assignments(membership_id,organization_id,branch_id) select id,organization_id,'45000000-0000-4000-8000-000000000003' from organization_memberships where user_id='15000000-0000-4000-8000-000000000006' and organization_id='25000000-0000-4000-8000-000000000001';
set local role authenticated; set local "request.jwt.claims"='{"sub":"15000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select assign_job((select id from job_orders),'15000000-0000-4000-8000-000000000006',null)$$,'42501','The assigned technician cannot access this branch','branch-restricted technician cannot be assigned to another branch');
select lives_ok($$select assign_job_item((select id from job_order_items limit 1),'15000000-0000-4000-8000-000000000003')$$,'owner assigns technician to service item');
select ok((select technician_assigned_at is not null from job_order_items where technician_user_id='15000000-0000-4000-8000-000000000003'),'service assignment is timestamped');
select lives_ok($$select add_job_service((select id from job_orders),'85000000-0000-4000-8000-000000000001',2,true,'extra work')$$,'advisor workflow proposes additional work');
select is((select count(*) from job_order_items where approval_status='proposed')::bigint,1::bigint,'additional work awaits approval');
select lives_ok($$select transition_job_service((select id from job_order_items where approval_status='proposed'),'approve')$$,'proposed work approved');
select is((select actual_total_centavos from job_orders),150000::bigint,'approved work recalculates authoritative total');
select lives_ok($$select create_estimate((select id from job_orders),10000,5000,'estimate')$$,'estimate snapshots approved work');
select is((select total_centavos from estimates),145000::bigint,'estimate total is authoritative');
select lives_ok($$select transition_estimate((select id from estimates),'approve','customer approved')$$,'estimate approval recorded');
insert into job_inspections(organization_id,job_order_id,exterior_notes,inspected_by) values('25000000-0000-4000-8000-000000000001',(select id from job_orders),'initial inspection','15000000-0000-4000-8000-000000000001');
select lives_ok($$select issue_invoice((select id from job_orders),(select id from estimates),'invoice')$$,'approved estimate becomes invoice');
select is((select total_centavos from invoices),145000::bigint,'invoice preserves estimate total');
select lives_ok($$select record_invoice_payment((select id from invoices),45000,'cash',null,'deposit')$$,'partial payment recorded');
select is((select status::text from invoices),'partially_paid','partial invoice status');
select throws_ok($$select record_invoice_payment((select id from invoices),100001,'cash',null,null)$$,'P0001','Invalid payment amount','overpayment rejected');
select lives_ok($$select record_invoice_payment((select id from invoices),100000,'card','CARD-1',null)$$,'remaining balance accepted');
select is((select status::text from invoices),'paid','invoice fully paid');
select lives_ok($$select reverse_payment((select id from payments where amount_centavos=100000),'refund','refund')$$,'payment refund restores balance');
select is((select balance_centavos from invoices),100000::bigint,'refund restores invoice balance');
select throws_ok($$select void_invoice((select id from invoices),'bad')$$,'P0001','Paid invoice cannot be voided','invoice with remaining paid amount cannot be voided');
select is((select count(*) from job_orders where organization_id='25000000-0000-4000-8000-000000000002')::bigint,0::bigint,'Owner A cannot read Org B jobs');

reset role; set local "request.jwt.claims"='{}'; insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,status) values('95000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000002','55000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000002','queued');
select throws_ok($$insert into estimates(organization_id,branch_id,job_order_id,subtotal_centavos,total_centavos) values('25000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002',1,1)$$,'P0001','Estimate tenant mismatch','cross-tenant estimate guard rejects mismatch');
select throws_ok($$insert into invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos) values((select id from invoices),'25000000-0000-4000-8000-000000000002','attack',1,1,1)$$,'P0001','Invoice item tenant mismatch','cross-tenant invoice item rejected');

set local role authenticated; set local "request.jwt.claims"='{"sub":"15000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select start_automotive_job_work_session((select id from job_orders where organization_id='25000000-0000-4000-8000-000000000001'),null)$$,'assigned technician starts job through canonical work tracking');
select lives_ok($$update job_inspections set exterior_notes='ok',inspected_by='15000000-0000-4000-8000-000000000003' where job_order_id=(select id from job_orders where organization_id='25000000-0000-4000-8000-000000000001')$$,'assigned technician records inspection');
select throws_ok($$insert into job_inspections(organization_id,job_order_id,exterior_notes) values('25000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','attack')$$,'P0001','Job child organization mismatch','technician cannot write Org B inspection');
select throws_ok($$select create_estimate((select id from job_orders where organization_id='25000000-0000-4000-8000-000000000001'),0,0,null)$$,'42501','Job not found','technician cannot create estimates');

reset role; set local role authenticated; set local "request.jwt.claims"='{"sub":"15000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select transition_job((select id from job_orders where organization_id='25000000-0000-4000-8000-000000000001'),'hold')$$,'42501','Job not assigned','unassigned technician cannot transition job');
select throws_ok($$insert into job_photos(organization_id,job_order_id,category,storage_path) values('25000000-0000-4000-8000-000000000001',(select id from job_orders where organization_id='25000000-0000-4000-8000-000000000001'),'before','blocked')$$,'42501',null,'unassigned technician cannot attach photo');

select * from finish(); rollback;
