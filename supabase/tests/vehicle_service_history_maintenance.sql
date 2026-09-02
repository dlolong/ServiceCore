begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('1a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','maintenance-owner@example.test','',now(),'{}','{}',now(),now()),
('1a000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','maintenance-other@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values
('2a000000-0000-4000-8000-000000000001','Maintenance A','maintenance-a'),
('2a000000-0000-4000-8000-000000000002','Maintenance B','maintenance-b');
insert into organization_memberships(organization_id,user_id,role) values
('2a000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','owner'),
('2a000000-0000-4000-8000-000000000002','1a000000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,timezone) values
('4a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','Main','Asia/Manila'),
('4a000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000002','Other','Asia/Manila');
insert into customers(id,organization_id,full_name,email,phone) values
('5a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','Maintenance Customer','customer@example.test','09171234567');
insert into customer_communication_preferences(customer_id,organization_id,email_opt_in,sms_opt_in) values
('5a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001',true,true);
insert into vehicles(id,organization_id,customer_id,make,model,odometer_km) values
('6a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','Toyota','Vios',40000);
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values
('8a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','Oil change',60,100000);
insert into maintenance_rules(organization_id,service_id,interval_months,interval_km,lead_days) values
('2a000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001',6,10000,14);
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status,odometer_in_km) values
('9a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','4a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001',1,'queued',50000),
('9a000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000001','4a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001',2,'queued',45000);
insert into job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes,approval_status) values
('aa000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001','Oil change',1,100000,100000,60,'approved'),
('aa000000-0000-4000-8000-000000000002','2a000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001','Declined flush',1,50000,50000,30,'declined'),
('aa000000-0000-4000-8000-000000000003','2a000000-0000-4000-8000-000000000001','9a000000-0000-4000-8000-000000000002','8a000000-0000-4000-8000-000000000001','Oil change',1,100000,100000,60,'approved');

select plan(15);
update job_orders set status='completed',completed_at=now() where id='9a000000-0000-4000-8000-000000000001';
select is((select count(*) from vehicle_service_records)::bigint,1::bigint,'completion creates one durable service record');
select is((select count(*) from vehicle_service_record_items)::bigint,1::bigint,'only approved work is snapshotted');
select is((select odometer_km from vehicles where id='6a000000-0000-4000-8000-000000000001'),50000,'higher completed-job odometer advances the vehicle');
select is((select count(*) from vehicle_maintenance_due where lifecycle_status='active')::bigint,1::bigint,'completion creates one active maintenance projection');
select is((select interval_km_snapshot from vehicle_maintenance_due where lifecycle_status='active'),10000,'maintenance interval is snapshotted');
select is((select next_due_odometer_km from vehicle_maintenance_due where lifecycle_status='active'),60000,'next kilometer threshold uses recorded service odometer');
select is(finalize_vehicle_service_record('9a000000-0000-4000-8000-000000000001'),(select id from vehicle_service_records limit 1),'history finalization retry returns the existing record');
select is((select count(*) from vehicle_service_records)::bigint,1::bigint,'history finalization retry creates no duplicate');
update job_orders set status='completed',completed_at=now()+interval '1 minute' where id='9a000000-0000-4000-8000-000000000002';
select is((select odometer_km from vehicles where id='6a000000-0000-4000-8000-000000000001'),50000,'lower historical odometer never reduces current vehicle odometer');
select is((select count(*) from vehicle_maintenance_due where lifecycle_status='active')::bigint,1::bigint,'new service leaves exactly one active projection');
select is((select count(*) from vehicle_maintenance_due where lifecycle_status='satisfied')::bigint,1::bigint,'new service satisfies the previous projection');

update vehicle_maintenance_due set next_due_at=now(),next_due_odometer_km=null where lifecycle_status='active';
set local role service_role; set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_vehicle_maintenance_reminders(100),2,'due projection enqueues one email and one SMS intent');
select is(enqueue_due_vehicle_maintenance_reminders(100),0,'same due stage and channels are idempotent');
reset role;
update vehicles set is_archived=true where id='6a000000-0000-4000-8000-000000000001';
select is((select count(*) from notification_outbox where reference_type='vehicle_maintenance_due' and status='cancelled')::bigint,2::bigint,'archiving a vehicle cancels its pending reminder intents');
set local role authenticated; set local "request.jwt.claims"='{"sub":"1a000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from vehicle_service_records)::bigint,0::bigint,'another tenant cannot read service history');

select * from finish();
rollback;
