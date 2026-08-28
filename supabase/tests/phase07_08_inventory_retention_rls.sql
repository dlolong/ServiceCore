begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('17000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stock-owner-a@example.com','',now(),'{}','{}',now(),now()),
('17000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stock-owner-b@example.com','',now(),'{}','{}',now(),now()),
('17000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stock-tech-a@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('27000000-0000-4000-8000-000000000001','Stock A','stock-a'),('27000000-0000-4000-8000-000000000002','Stock B','stock-b');
insert into organization_memberships(organization_id,user_id,role) values('27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000001','owner'),('27000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000002','owner'),('27000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000003','technician');
insert into branches(id,organization_id,name,timezone,is_primary) values('47000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','Stock A Main','Asia/Manila',true),('47000000-0000-4000-8000-000000000003','27000000-0000-4000-8000-000000000001','Stock A Two','Asia/Manila',false),('47000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','Stock B Main','Asia/Manila',true);
insert into customers(id,organization_id,full_name,email) values('57000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','Retention A','a@example.com'),('57000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','Retention B','b@example.com');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number,odometer_km) values('67000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000001','Toyota','Fortuner','INV-A',11000),('67000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000002','Honda','City','INV-B',1000);
insert into service_categories(id,organization_id,name) values('77000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','Maintenance'),('77000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','Maintenance');
insert into services(id,organization_id,category_id,name,duration_minutes,base_price_centavos) values('87000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','Oil Change',60,300000),('87000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000002','Oil Change B',60,400000);
insert into inventory_items(id,organization_id,branch_id,sku,name,unit,cost_centavos,reorder_level) values
('a7000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','OIL-5W30','Oil Main','L',50000,5),
('a7000000-0000-4000-8000-000000000003','27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000003','OIL-5W30','Oil Branch Two','L',50000,5),
('a7000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000002','OIL-B','Oil B','L',60000,5);
insert into service_consumables(id,organization_id,service_id,inventory_item_id,quantity) values('b7000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001',4);
insert into maintenance_rules(id,organization_id,service_id,interval_months,interval_km,lead_days) values('c7000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001',6,5000,14);
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status,odometer_in_km,actual_total_centavos,completed_at) values
('d7000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000001',1,'completed',500,300000,now()-interval '7 months'),
('d7000000-0000-4000-8000-000000000003','27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000001',2,'ready_for_release',5500,300000,null),
('d7000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000002','57000000-0000-4000-8000-000000000002','67000000-0000-4000-8000-000000000002',1,'completed',1000,400000,now()-interval '1 month');
insert into job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,unit_price_centavos,line_total_centavos,duration_minutes) values
('27000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','Oil Change Snapshot',300000,300000,60),
('27000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000003','87000000-0000-4000-8000-000000000001','Oil Change Snapshot',300000,300000,60),
('27000000-0000-4000-8000-000000000002','d7000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000002','Oil Change B Snapshot',400000,400000,60);

select plan(43);
select has_view('public','inventory_stock','stock view exists'); select has_view('public','vehicle_service_history','service history view exists');
select has_table('public','service_consumables','service recipes exist'); select has_table('public','maintenance_rules','maintenance rules exist'); select has_table('public','maintenance_reminders','reminder queue exists'); select has_table('public','customer_communication_preferences','communication preferences exist');
select has_function('public','transfer_inventory',array['uuid','uuid','numeric','text','text'],'atomic transfer RPC exists'); select has_function('public','generate_maintenance_reminders',array['integer'],'reminder generator exists');

set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select * from inventory_stock$$,'42501',null,'anon cannot read stock'); select throws_ok($$select * from vehicle_service_history$$,'42501',null,'anon cannot read service history'); select throws_ok($$select * from maintenance_reminders$$,'42501',null,'anon cannot read reminders');

reset role; set local role authenticated; set local "request.jwt.claims"='{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from inventory_stock)::bigint,2::bigint,'Owner A sees only Org A branch stocks'); select is((select count(*) from inventory_stock where organization_id='27000000-0000-4000-8000-000000000002')::bigint,0::bigint,'Owner A cannot read Org B stock');
select lives_ok($$select record_inventory_movement('a7000000-0000-4000-8000-000000000001','opening',20,'opening','e7000000-0000-4000-8000-000000000001')$$,'opening stock recorded');
select is((select quantity_on_hand from inventory_stock where id='a7000000-0000-4000-8000-000000000001'),20.000::numeric,'stock derives from ledger');
select lives_ok($$select record_inventory_movement('a7000000-0000-4000-8000-000000000001','opening',20,'retry','e7000000-0000-4000-8000-000000000001')$$,'movement retry is idempotent');
select is((select count(*) from inventory_movements where idempotency_key='e7000000-0000-4000-8000-000000000001')::bigint,1::bigint,'retry does not duplicate movement');
select lives_ok($$select transfer_inventory('a7000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000003',5,'transfer','e7000000-0000-4000-8000-000000000002')$$,'cross-branch transfer succeeds atomically');
select is((select quantity_on_hand from inventory_stock where id='a7000000-0000-4000-8000-000000000001'),15.000::numeric,'transfer reduces source'); select is((select quantity_on_hand from inventory_stock where id='a7000000-0000-4000-8000-000000000003'),5.000::numeric,'transfer increases destination');
select lives_ok($$select transfer_inventory('a7000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000003',5,'retry','e7000000-0000-4000-8000-000000000002')$$,'transfer retry is safe');
select is((select quantity_on_hand from inventory_stock where id='a7000000-0000-4000-8000-000000000001'),15.000::numeric,'transfer retry does not deduct twice');
select throws_ok($$select transfer_inventory('a7000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002',1,'attack','e7000000-0000-4000-8000-000000000003')$$,'42501','Transfer not allowed','cross-tenant transfer denied');
select throws_ok($$insert into inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta) values('27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','purchase',999)$$,'42501','permission denied for table inventory_movements','direct ledger insert denied');
select lives_ok($$select transition_job('d7000000-0000-4000-8000-000000000003','complete')$$,'job completion succeeds with available consumables');
select is((select quantity_on_hand from inventory_stock where id='a7000000-0000-4000-8000-000000000001'),11.000::numeric,'job completion consumes recipe once');
select is((select count(*) from inventory_movements where reference_id='d7000000-0000-4000-8000-000000000003')::bigint,1::bigint,'one consumption movement created');
select is((select count(*) from vehicle_service_history)::bigint,2::bigint,'Owner A sees two completed services and no Org B history');
select is((select services->0->>'name' from vehicle_service_history where job_order_id='d7000000-0000-4000-8000-000000000001'),'Oil Change Snapshot','history uses job snapshot');
update services set name='Renamed Catalog Service' where id='87000000-0000-4000-8000-000000000001';
select is((select services->0->>'name' from vehicle_service_history where job_order_id='d7000000-0000-4000-8000-000000000001'),'Oil Change Snapshot','catalog rename does not alter history');
select lives_ok($$select generate_maintenance_reminders(30)$$,'maintenance reminders generate');
select is((select count(*) from maintenance_reminders)::bigint,1::bigint,'only latest due service generates one reminder');
select lives_ok($$select generate_maintenance_reminders(30)$$,'reminder generation retry succeeds');
select is((select count(*) from maintenance_reminders)::bigint,1::bigint,'reminder retry does not duplicate');
select lives_ok($$insert into customer_communication_preferences(customer_id,organization_id,email_opt_in,updated_by) values('57000000-0000-4000-8000-000000000001','27000000-0000-4000-8000-000000000001',true,'17000000-0000-4000-8000-000000000001')$$,'explicit email consent stored');
select ok((select email_opt_in and not sms_opt_in from customer_communication_preferences),'channel consent is explicit');
select is((select count(*) from maintenance_reminders where organization_id='27000000-0000-4000-8000-000000000002')::bigint,0::bigint,'Org A cannot read Org B reminders');
select throws_ok($$insert into service_consumables(organization_id,service_id,inventory_item_id,quantity) values('27000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002',1)$$,'P0001','Consumable tenant mismatch','recipe cannot consume Org B inventory');
select throws_ok($$insert into customer_communication_preferences(customer_id,organization_id,email_opt_in) values('57000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000001',true)$$,'P0001','Preference tenant mismatch','cross-tenant consent rejected');

reset role; set local role authenticated; set local "request.jwt.claims"='{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select record_inventory_movement('a7000000-0000-4000-8000-000000000001','purchase',1,null,'e7000000-0000-4000-8000-000000000004')$$,'42501','Inventory item not found','technician cannot mutate inventory');
select is((select count(*) from inventory_stock)::bigint,2::bigint,'technician can read own organization stock');
select is((select count(*) from vehicle_service_history)::bigint,2::bigint,'technician can read own organization service history');

reset role; select throws_ok($$insert into inventory_items(organization_id,branch_id,name) values('27000000-0000-4000-8000-000000000001','47000000-0000-4000-8000-000000000002','attack')$$,'P0001','Inventory branch organization mismatch','cross-tenant inventory branch rejected');
select * from finish(); rollback;
