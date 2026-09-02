begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('19400000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','parts-a@example.com','',now(),'{}','{}',now(),now()),
('19400000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','parts-b@example.com','',now(),'{}','{}',now(),now()),
('19400000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','parts-restricted@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values
('29400000-0000-4000-8000-000000000001','Parts A','parts-a'),
('29400000-0000-4000-8000-000000000002','Parts B','parts-b');
insert into organization_memberships(organization_id,user_id,role) values
('29400000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000001','owner'),
('29400000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','owner'),
('29400000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000003','manager');
insert into branches(id,organization_id,name,timezone,is_primary) values
('49400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','Parts A Main','Asia/Manila',true),
('49400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000001','Parts A Restricted','Asia/Manila',false),
('49400000-0000-4000-8000-000000000003','29400000-0000-4000-8000-000000000002','Parts B Main','Asia/Manila',true);
insert into membership_branch_assignments(membership_id,organization_id,branch_id)
select id,organization_id,'49400000-0000-4000-8000-000000000002' from organization_memberships where user_id='19400000-0000-4000-8000-000000000003';
insert into customers(id,organization_id,full_name) values
('59400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','Parts Customer A'),
('59400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000002','Parts Customer B');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number) values
('69400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000001','Toyota','Vios','PRT-A'),
('69400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000002','59400000-0000-4000-8000-000000000002','Honda','City','PRT-B');
insert into service_categories(id,organization_id,name) values
('79400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','Parts Services');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values
('89400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','79400000-0000-4000-8000-000000000001','Configured Wrong-Branch Service',30,10000);
insert into inventory_items(id,organization_id,branch_id,sku,name,unit) values
('a9400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','PAD-A','Brake Pad','set'),
('a9400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000002','PAD-A2','Restricted Pad','set'),
('a9400000-0000-4000-8000-000000000003','29400000-0000-4000-8000-000000000002','49400000-0000-4000-8000-000000000003','PAD-B','Other Pad','set');
insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,idempotency_key) values
('29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001','opening',5,'parts-opening-a'),
('29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000002','a9400000-0000-4000-8000-000000000002','opening',5,'parts-opening-restricted'),
('29400000-0000-4000-8000-000000000002','49400000-0000-4000-8000-000000000003','a9400000-0000-4000-8000-000000000003','opening',5,'parts-opening-b');

insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status) values
('99400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000001','69400000-0000-4000-8000-000000000001',1,'approved'),
('99400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000001','69400000-0000-4000-8000-000000000001',2,'approved'),
('99400000-0000-4000-8000-000000000003','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000001','69400000-0000-4000-8000-000000000001',3,'approved'),
('99400000-0000-4000-8000-000000000005','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','59400000-0000-4000-8000-000000000001','69400000-0000-4000-8000-000000000001',5,'approved'),
('99400000-0000-4000-8000-000000000004','29400000-0000-4000-8000-000000000002','49400000-0000-4000-8000-000000000003','59400000-0000-4000-8000-000000000002','69400000-0000-4000-8000-000000000002',1,'approved');
insert into estimates(id,organization_id,branch_id,job_order_id,status,version,subtotal_centavos,total_centavos,authorized_total_centavos,approved_at) values
('b9400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000001','approved',1,30000,30000,30000,now()),
('b9400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000002','approved',1,30000,30000,30000,now()),
('b9400000-0000-4000-8000-000000000003','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000003','approved',1,10000,10000,10000,now()),
('b9400000-0000-4000-8000-000000000005','29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000005','approved',1,10000,10000,10000,now()),
('b9400000-0000-4000-8000-000000000004','29400000-0000-4000-8000-000000000002','49400000-0000-4000-8000-000000000003','99400000-0000-4000-8000-000000000004','approved',1,10000,10000,10000,now());
insert into estimate_items(id,estimate_id,organization_id,item_type,inventory_item_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos) values
('c9400000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001','29400000-0000-4000-8000-000000000001','part','a9400000-0000-4000-8000-000000000001','Brake Pad',3,10000,30000),
('c9400000-0000-4000-8000-000000000002','b9400000-0000-4000-8000-000000000002','29400000-0000-4000-8000-000000000001','part','a9400000-0000-4000-8000-000000000001','Brake Pad',3,10000,30000),
('c9400000-0000-4000-8000-000000000003','b9400000-0000-4000-8000-000000000003','29400000-0000-4000-8000-000000000001','part','a9400000-0000-4000-8000-000000000001','Brake Pad',1,10000,10000),
('c9400000-0000-4000-8000-000000000004','b9400000-0000-4000-8000-000000000004','29400000-0000-4000-8000-000000000002','part','a9400000-0000-4000-8000-000000000003','Other Pad',1,10000,10000);
insert into job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes) values
('d9400000-0000-4000-8000-000000000005','29400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000005','89400000-0000-4000-8000-000000000001','Wrong-Branch Service',1,10000,10000,30);
insert into service_consumables(id,organization_id,service_id,inventory_item_id,quantity) values
('e9400000-0000-4000-8000-000000000005','29400000-0000-4000-8000-000000000001','89400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000002',1);
insert into job_inspections(organization_id,job_order_id,exterior_notes,inspected_by)
values('29400000-0000-4000-8000-000000000001','99400000-0000-4000-8000-000000000001','Checked','19400000-0000-4000-8000-000000000001');

select plan(53);
select has_table('public','inventory_reservations','core reservation ledger exists');
select has_table('public','inventory_reservation_operations','idempotency operation ledger exists');
select has_view('public','inventory_availability','derived availability view exists');
select has_table('public','vehicle_service_record_parts','consumed history snapshot exists');
select has_function('public','reserve_job_required_parts',array['uuid','text'],'Automotive reserve-all RPC exists');
select has_function('public','consume_job_part',array['uuid','uuid','numeric','text'],'Automotive consumption RPC exists');

set local role authenticated; set local "request.jwt.claims"='{"sub":"19400000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000001','reserve-job-one')$$,'full required reservation succeeds');
select is((select quantity_reserved from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),3.000::numeric,'reserved allocation is derived separately');
select is((select quantity_available from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),2.000::numeric,'available equals on hand minus reserved');
select is((select quantity_on_hand from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),5.000::numeric,'reservation does not change physical on hand');
select lives_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000001','reserve-job-one')$$,'reserve-all retry is idempotent');
select is((select count(*) from inventory_reservation_operations where idempotency_key like 'reserve-job-one:%')::bigint,1::bigint,'retry creates one reserve operation');
select throws_ok($$select reserve_job_part('99400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',1,'reserve-above-requirement')$$,'P0001','Reservation exceeds outstanding Job Order requirement','single-part reservation cannot exceed outstanding requirement');
select throws_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000002','reserve-job-two')$$,'P0001','Insufficient available stock','competing request cannot over-reserve final stock');
select lives_ok($$select reserve_job_part('99400000-0000-4000-8000-000000000002','a9400000-0000-4000-8000-000000000001',2,'partial-job-two')$$,'partial available quantity may be reserved explicitly');
select is((select quantity_available from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),0.000::numeric,'all physical stock is allocated');
select throws_ok($$select transition_job('99400000-0000-4000-8000-000000000002','start')$$,'P0001','Complete the vehicle inspection before work starts','inspection remains an independent blocker');
select lives_ok($$select transition_job('99400000-0000-4000-8000-000000000001','start')$$,'fully reserved authorized work starts');
select lives_ok($$select consume_job_part('99400000-0000-4000-8000-000000000001',(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),2,'consume-job-one')$$,'partial consumption succeeds');
select lives_ok($$select consume_job_part('99400000-0000-4000-8000-000000000001',(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),2,'consume-job-one')$$,'consumption retry is idempotent');
select is((select count(*) from inventory_movements where idempotency_key='reservation:consume-job-one')::bigint,1::bigint,'consumption retry creates one stock movement');
select is((select quantity_on_hand from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),3.000::numeric,'consumption reduces physical on hand');
select throws_ok($$select consume_job_part('99400000-0000-4000-8000-000000000001',(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),2,'consume-too-much')$$,'P0001','Consumption exceeds reserved quantity','over-consumption is rejected');
select lives_ok($$select release_job_part('99400000-0000-4000-8000-000000000001',(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),1,'release-job-one')$$,'unused reservation releases');
select is((select quantity_on_hand from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),3.000::numeric,'release does not increase physical stock');
select is((select quantity_available from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),1.000::numeric,'release restores only availability');
select throws_ok($$select reserve_job_part('99400000-0000-4000-8000-000000000002','a9400000-0000-4000-8000-000000000001',1,'partial-job-two')$$,'P0001','Idempotency key conflicts with another operation','conflicting retry cannot silently reserve a new quantity');
select throws_ok($$select record_inventory_movement('a9400000-0000-4000-8000-000000000001','usage',2,null,'manual-steal')$$,'P0001','Insufficient available stock','manual usage cannot consume another Job Order reservation');
select lives_ok($$select transition_job('99400000-0000-4000-8000-000000000002','cancel')$$,'cancellation releases outstanding reservations');
select is((select quantity_available from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),3.000::numeric,'cancel cleanup restores availability');
select is((select quantity_on_hand from inventory_availability where id='a9400000-0000-4000-8000-000000000001'),3.000::numeric,'cancel cleanup does not restore consumed physical stock');
select lives_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000003','reserve-job-three')$$,'third job reserves before revision');
select lives_ok($$select save_estimate_item('b9400000-0000-4000-8000-000000000003','c9400000-0000-4000-8000-000000000003','part','a9400000-0000-4000-8000-000000000001','Brake Pad',2,10000,0)$$,'estimate revision succeeds');
select is((select quantity_remaining from inventory_reservation_balances where reference_id='99400000-0000-4000-8000-000000000003'),0.000::numeric,'estimate revision releases stale reservation');
select lives_ok($$select record_estimate_authorization('b9400000-0000-4000-8000-000000000003','approve','in_person',null)$$,'revised estimate can be reauthorized');
select lives_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000003','reserve-job-three-cycle-two')$$,'same reservation row supports a new allocation cycle');
select lives_ok($$select save_estimate_item('b9400000-0000-4000-8000-000000000003','c9400000-0000-4000-8000-000000000003','part','a9400000-0000-4000-8000-000000000001','Brake Pad',1,10000,0)$$,'second same-version estimate revision releases again');
select is((select quantity_remaining from inventory_reservation_balances where reference_id='99400000-0000-4000-8000-000000000003'),0.000::numeric,'second allocation cycle is fully released');
select is((select count(*) from inventory_reservation_operations where reservation_id=(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000003') and operation_type='release')::bigint,2::bigint,'allocation generation gives repeated cleanup distinct idempotency keys');
select throws_ok($$select reserve_job_required_parts('99400000-0000-4000-8000-000000000005','wrong-branch-recipe')$$,'P0001','A required part is not available at this branch','cross-branch service consumable cannot be reserved');

reset role; update job_orders set status='completed',completed_at=now() where id='99400000-0000-4000-8000-000000000001';
set local role authenticated; set local "request.jwt.claims"='{"sub":"19400000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select quantity_consumed from vehicle_service_record_parts where source_inventory_reservation_id=(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001')),2.000::numeric,'Service History snapshots actual consumed quantity');
select is((select count(*) from vehicle_service_record_parts where quantity_consumed=0)::bigint,0::bigint,'unused reservations are excluded from Service History');
select throws_ok($$insert into inventory_reservations(organization_id,branch_id,inventory_item_id,reference_type,reference_id,quantity_reserved) values('29400000-0000-4000-8000-000000000001','49400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001','job_order',gen_random_uuid(),1)$$,'42501','permission denied for table inventory_reservations','direct reservation writes are denied');

set local "request.jwt.claims"='{"sub":"19400000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select reserve_job_part('99400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',1,'tenant-attack')$$,'42501','Job not found','cross-tenant reservation denied');
select throws_ok($$select inventory_available_balance('a9400000-0000-4000-8000-000000000001')$$,'42501','Inventory item not found','balance helper does not disclose cross-tenant stock');
select throws_ok($$select inventory_item_balance('a9400000-0000-4000-8000-000000000001')$$,'42501','Inventory item not found','on-hand helper does not disclose cross-tenant stock');

set local "request.jwt.claims"='{"sub":"19400000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select reserve_job_part('99400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001',1,'branch-attack')$$,'42501','Job not found','branch-restricted advisor cannot reserve another branch stock');
select throws_ok($$select record_inventory_movement('a9400000-0000-4000-8000-000000000001','purchase',1,null,'branch-positive-attack')$$,'42501','Inventory item not found','branch-restricted advisor cannot add stock to another branch');
select throws_ok($$select transfer_inventory('a9400000-0000-4000-8000-000000000002','a9400000-0000-4000-8000-000000000001',1,null,'branch-transfer-attack')$$,'42501','Transfer not allowed','transfer requires access to both branches');
select is((select count(*) from inventory_reservations)::bigint,0::bigint,'RLS hides reservations outside assigned branch');

reset role;
select throws_ok($$insert into inventory_reservations(organization_id,branch_id,inventory_item_id,reference_type,reference_id,quantity_reserved) values('29400000-0000-4000-8000-000000000002','49400000-0000-4000-8000-000000000001','a9400000-0000-4000-8000-000000000001','job_order',gen_random_uuid(),1)$$,'P0001','Inventory reservation tenant mismatch','privileged malformed reservation is rejected');
select throws_ok($$insert into inventory_reservation_operations(organization_id,reservation_id,operation_type,quantity,idempotency_key) values('29400000-0000-4000-8000-000000000002',(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),'release',1,'malformed-operation')$$,'P0001','Inventory reservation operation tenant mismatch','privileged malformed operation is rejected');
select throws_ok($$insert into vehicle_service_record_parts(organization_id,service_record_id,source_inventory_reservation_id,inventory_item_id,part_name_snapshot,unit_snapshot,quantity_consumed) values('29400000-0000-4000-8000-000000000002',(select id from vehicle_service_records where source_job_order_id='99400000-0000-4000-8000-000000000001'),(select id from inventory_reservations where reference_id='99400000-0000-4000-8000-000000000001'),'a9400000-0000-4000-8000-000000000001','Malformed','unit',1)$$,'P0001','Service history part tenant mismatch','privileged malformed history snapshot is rejected');

select * from finish(); rollback;
