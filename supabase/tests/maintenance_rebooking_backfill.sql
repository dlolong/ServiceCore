begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('1f000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rebooking-owner@example.test','',now(),'{}','{}',now(),now()),
('1f000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rebooking-other@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values
('2f000000-0000-4000-8000-000000000001','Rebooking A','rebooking-a'),
('2f000000-0000-4000-8000-000000000002','Rebooking B','rebooking-b');
insert into organization_memberships(organization_id,user_id,role) values
('2f000000-0000-4000-8000-000000000001','1f000000-0000-4000-8000-000000000001','owner'),
('2f000000-0000-4000-8000-000000000002','1f000000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name,timezone) values
('4f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','Main','Asia/Manila'),
('4f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000002','Other','Asia/Manila');
insert into customers(id,organization_id,full_name,email,phone) values
('5f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','Rebooking Customer','rebooking@example.test','09171234567'),
('5f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000002','Other Customer','other@example.test','09181234567'),
('5f000000-0000-4000-8000-000000000003','2f000000-0000-4000-8000-000000000001','Legacy Customer',null,null);
insert into customer_communication_preferences(customer_id,organization_id,email_opt_in,sms_opt_in) values
('5f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001',true,true);
insert into vehicles(id,organization_id,customer_id,make,model,odometer_km,is_archived) values
('6f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001','Toyota','Vios',50000,false),
('6f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000002','5f000000-0000-4000-8000-000000000002','Honda','City',30000,true),
('6f000000-0000-4000-8000-000000000003','2f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000003','Mitsubishi','Lancer',null,false);
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values
('8f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','Oil change',60,100000),
('8f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000001','Car wash',30,50000),
('8f000000-0000-4000-8000-000000000003','2f000000-0000-4000-8000-000000000002','Other service',60,100000);
insert into maintenance_rules(organization_id,service_id,interval_months,interval_km,lead_days) values
('2f000000-0000-4000-8000-000000000001','8f000000-0000-4000-8000-000000000001',6,10000,14);
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status) values
('9f000000-0000-4000-8000-000000001001','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',1001,'queued'),
('9f000000-0000-4000-8000-000000001002','2f000000-0000-4000-8000-000000000002','4f000000-0000-4000-8000-000000000002','5f000000-0000-4000-8000-000000000002','6f000000-0000-4000-8000-000000000002',1002,'queued');
insert into vehicle_service_records(id,organization_id,branch_id,vehicle_id,customer_id,source_job_order_id,job_number,completed_at,total_centavos,branch_name_snapshot) values
('bf000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000001001',1001,now()-interval '6 months',0,'Main'),
('bf000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000002','4f000000-0000-4000-8000-000000000002','6f000000-0000-4000-8000-000000000002','5f000000-0000-4000-8000-000000000002','9f000000-0000-4000-8000-000000001002',1002,now()-interval '6 months',0,'Other');
insert into vehicle_maintenance_due(id,organization_id,branch_id,vehicle_id,service_id,last_service_at,
  source_service_record_id,source_job_order_id,interval_months_snapshot,interval_km_snapshot,reminder_lead_days_snapshot,next_due_at,next_due_odometer_km) values
('7f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001','8f000000-0000-4000-8000-000000000001',now()-interval '6 months','bf000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000001001',6,10000,14,now(),60000),
('7f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000002','4f000000-0000-4000-8000-000000000002','6f000000-0000-4000-8000-000000000002','8f000000-0000-4000-8000-000000000003',now()-interval '6 months','bf000000-0000-4000-8000-000000000002','9f000000-0000-4000-8000-000000001002',6,null,14,now(),null);

select plan(42);
select has_column('public','vehicle_maintenance_due','appointment_id','maintenance due has an explicit appointment link');
select has_column('public','vehicle_maintenance_due','snoozed_until','maintenance due has derived-expiry snooze state');
select is(maintenance_reminder_eligibility('active',false,'confirmed',now()+interval '1 day',true,now()),'ACTIVE_RELATED_APPOINTMENT','active appointment takes precedence over snooze');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"1f000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_maintenance_appointment(
  '7f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001',
  '5f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',
  array['8f000000-0000-4000-8000-000000000001']::uuid[],now()+interval '2 days'
)$$,'maintenance appointment creation and linkage commit together');
select ok((select appointment_id is not null from vehicle_maintenance_directory where id='7f000000-0000-4000-8000-000000000001'),'created appointment is linked back to maintenance');
select is((select count(*) from appointments where organization_id='2f000000-0000-4000-8000-000000000001')::bigint,1::bigint,'one appointment was created');
select lives_ok($$select save_maintenance_appointment(
  '7f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001',
  '5f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',
  array['8f000000-0000-4000-8000-000000000001']::uuid[],now()+interval '3 days'
)$$,'repeated create returns the existing active relation');
select is((select count(*) from appointments where organization_id='2f000000-0000-4000-8000-000000000001')::bigint,1::bigint,'repeated create does not duplicate the appointment');
select lives_ok($$select save_appointment_with_assignments(
  (select appointment_id from vehicle_maintenance_due where id='7f000000-0000-4000-8000-000000000001'),
  '4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001',
  '6f000000-0000-4000-8000-000000000001',array['8f000000-0000-4000-8000-000000000001']::uuid[],
  now()+interval '4 days'
)$$,'linked appointment can be rescheduled through the normal scheduling boundary');
select ok((select appointment_id is not null and appointment_status='requested' from vehicle_maintenance_directory where id='7f000000-0000-4000-8000-000000000001'),'reschedule preserves the active maintenance link');
select ok(exists(select 1 from audit_events where event_type='maintenance.appointment_linked'),'linkage creates one high-value audit event');
select throws_ok($$update vehicle_maintenance_due set appointment_id=(select appointment_id from vehicle_maintenance_due where id='7f000000-0000-4000-8000-000000000001') where id='7f000000-0000-4000-8000-000000000002'$$,
  '42501','permission denied for table vehicle_maintenance_due','browser code cannot cross-tenant link maintenance directly');

reset role;
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_vehicle_maintenance_reminders(100),0,'active linked appointment suppresses reminder creation');
reset role;

set local role authenticated;
set local "request.jwt.claims"='{"sub":"1f000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select set_vehicle_maintenance_snooze('7f000000-0000-4000-8000-000000000001',now()+interval '14 days','Customer requested follow-up')$$,'authorized advisor can snooze a reminder');
select is((select reminder_eligibility from vehicle_maintenance_directory where id='7f000000-0000-4000-8000-000000000001'),'ACTIVE_RELATED_APPOINTMENT','active appointment remains the first suppression reason');
select lives_ok($$select transition_appointment((select appointment_id from vehicle_maintenance_due where id='7f000000-0000-4000-8000-000000000001'),'cancel','Customer unavailable')$$,'linked appointment can be cancelled normally');
select is((select reminder_eligibility from vehicle_maintenance_directory where id='7f000000-0000-4000-8000-000000000001'),'SNOOZED','cancelled appointment restores snooze as the suppression reason');
select ok(exists(select 1 from audit_events where event_type='maintenance.appointment_inactivated'),'appointment inactivation is audited');
select ok(exists(select 1 from audit_events where event_type='maintenance.reminder_snoozed'),'snooze is audited');
select lives_ok($$select resume_vehicle_maintenance_reminders('7f000000-0000-4000-8000-000000000001')$$,'reminders can be explicitly resumed');
select is((select reminder_eligibility from vehicle_maintenance_directory where id='7f000000-0000-4000-8000-000000000001'),'ELIGIBLE','resume makes a cancelled-appointment maintenance item eligible');
select ok(exists(select 1 from audit_events where event_type='maintenance.reminder_resumed'),'resume is audited');
reset role;

set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_vehicle_maintenance_reminders(100),2,'cancelled appointment permits the current due stage to enqueue');
reset role;
update notification_outbox set status='sent',sent_at=now() where reference_id='7f000000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"1f000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select set_vehicle_maintenance_snooze('7f000000-0000-4000-8000-000000000001',now()+interval '1 day',null)$$,'snoozing after send preserves sent history');
reset role;
update vehicle_maintenance_due set snoozed_until=now()-interval '1 minute' where id='7f000000-0000-4000-8000-000000000001';
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_vehicle_maintenance_reminders(100),0,'expired snooze does not resend the already-sent due stage');
select is((select count(*) from notification_outbox where reference_id='7f000000-0000-4000-8000-000000000001')::bigint,2::bigint,'stage deduplication retains exactly one row per channel');
reset role;

insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status,odometer_in_km) values
('9f000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',1,'queued',51000),
('9f000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',2,'queued',52000);
insert into job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes,approval_status) values
('af000000-0000-4000-8000-000000000001','2f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000001','8f000000-0000-4000-8000-000000000002','Car wash',1,50000,50000,30,'approved'),
('af000000-0000-4000-8000-000000000002','2f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000002','8f000000-0000-4000-8000-000000000001','Oil change',1,100000,100000,60,'approved');
update job_orders set status='completed',completed_at=now() where id='9f000000-0000-4000-8000-000000000001';
select is((select lifecycle_status from vehicle_maintenance_due where id='7f000000-0000-4000-8000-000000000001'),'active','completed unrelated service does not satisfy maintenance');
update job_orders set status='completed',completed_at=now()+interval '1 minute' where id='9f000000-0000-4000-8000-000000000002';
select is((select lifecycle_status from vehicle_maintenance_due where id='7f000000-0000-4000-8000-000000000001'),'satisfied','completed matching service satisfies the linked due item');
select is((select count(*) from vehicle_maintenance_due where vehicle_id='6f000000-0000-4000-8000-000000000001' and service_id='8f000000-0000-4000-8000-000000000001' and lifecycle_status='active')::bigint,1::bigint,'matching completion generates exactly one next due');
select ok(exists(select 1 from audit_events where entity_id='7f000000-0000-4000-8000-000000000001' and event_type='maintenance.satisfied'),'maintenance satisfaction is audited');

-- Completed inserts simulate legacy rows because the live completion trigger only observes status transitions.
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status,completed_at) values
('9f000000-0000-4000-8000-000000000003','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000003','6f000000-0000-4000-8000-000000000003',3,'completed',now()-interval '2 years'),
('9f000000-0000-4000-8000-000000000004','2f000000-0000-4000-8000-000000000001','4f000000-0000-4000-8000-000000000001','5f000000-0000-4000-8000-000000000003','6f000000-0000-4000-8000-000000000003',4,'completed',now()-interval '1 year');
insert into job_order_items(id,organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes,approval_status) values
('af000000-0000-4000-8000-000000000003','2f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000003','8f000000-0000-4000-8000-000000000001','Oil change',1,100000,100000,60,'approved'),
('af000000-0000-4000-8000-000000000004','2f000000-0000-4000-8000-000000000001','9f000000-0000-4000-8000-000000000004',null,'Legacy unknown service',1,75000,75000,45,'approved');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select throws_ok($$select backfill_vehicle_service_records(1)$$,'42501','permission denied for function backfill_vehicle_service_records','legacy unscoped write-only backfill is no longer operationally callable');
select is((plan_vehicle_service_backfill('2f000000-0000-4000-8000-000000000001',20)->'summary'->>'scanned')::integer,4,'dry run honors organization scope and bounded limit');
select ok(plan_vehicle_service_backfill('2f000000-0000-4000-8000-000000000001',20)::text like '%MISSING_ODOMETER%','dry run reports missing odometer without inventing mileage');
select ok(plan_vehicle_service_backfill('2f000000-0000-4000-8000-000000000001',20)::text like '%UNRESOLVED_SERVICE%','dry run reports unresolved service without fuzzy matching');
select is((select count(*) from vehicle_service_records where source='legacy_backfill')::bigint,0::bigint,'dry run creates no history records');
select is((select count(*) from vehicle_maintenance_due where source='legacy_backfill')::bigint,0::bigint,'dry run creates no maintenance projections');
select is((apply_vehicle_service_backfill('2f000000-0000-4000-8000-000000000001',20)->'summary'->>'historyCreated')::integer,2,'explicit apply creates only missing legacy history');
select is((select count(*) from vehicle_maintenance_due where source='legacy_backfill' and notifications_enabled=false)::bigint,1::bigint,'backfilled maintenance is created with notifications disabled');
select is((select next_due_odometer_km from vehicle_maintenance_due where source='legacy_backfill'),null::integer,'missing historical odometer is never invented');
select is((select count(*) from notification_outbox where reference_id in(select id from vehicle_maintenance_due where source='legacy_backfill'))::bigint,0::bigint,'backfill does not enqueue customer notifications');
select is((apply_vehicle_service_backfill('2f000000-0000-4000-8000-000000000001',20)->'summary'->>'historyCreated')::integer,0,'backfill apply is idempotent on rerun');
select ok(exists(select 1 from audit_events where event_type='maintenance.backfill_applied'),'apply writes one high-level run audit');

select * from finish();
rollback;
