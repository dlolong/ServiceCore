begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('1e000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outbox-owner@example.com','',now(),'{}','{}',now(),now()),
('1e000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outbox-other@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values
('2e000000-0000-4000-8000-000000000001','KarKR Outbox A','karkr-outbox-a'),
('2e000000-0000-4000-8000-000000000002','KarKR Outbox B','karkr-outbox-b');
insert into organization_memberships(organization_id,user_id,role) values
('2e000000-0000-4000-8000-000000000001','1e000000-0000-4000-8000-000000000001','owner'),
('2e000000-0000-4000-8000-000000000002','1e000000-0000-4000-8000-000000000002','owner');
insert into branches(id,organization_id,name) values
('4e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','Outbox Main'),
('4e000000-0000-4000-8000-000000000002','2e000000-0000-4000-8000-000000000002','Other Main');
insert into customers(id,organization_id,full_name,email,phone) values
('5e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','Outbox Customer','CUSTOMER@EXAMPLE.COM','09171234567');
insert into customer_communication_preferences(customer_id,organization_id,email_opt_in,sms_opt_in,updated_by) values
('5e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001',true,true,'1e000000-0000-4000-8000-000000000001');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number) values
('6e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','5e000000-0000-4000-8000-000000000001','Toyota','Vios','OUT123');
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status) values
('9e000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','5e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001',1,'queued'),
('9e000000-0000-4000-8000-000000000002','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','5e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001',2,'queued'),
('9e000000-0000-4000-8000-000000000003','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','5e000000-0000-4000-8000-000000000001','6e000000-0000-4000-8000-000000000001',3,'queued');
insert into estimates(id,organization_id,branch_id,job_order_id,version,status,subtotal_centavos,total_centavos,created_by) values
('ae000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000001',1,'draft',850000,850000,'1e000000-0000-4000-8000-000000000001'),
('ae000000-0000-4000-8000-000000000002','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000002',1,'draft',950000,950000,'1e000000-0000-4000-8000-000000000001'),
('ae000000-0000-4000-8000-000000000003','2e000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000001','9e000000-0000-4000-8000-000000000003',1,'draft',1050000,1050000,'1e000000-0000-4000-8000-000000000001');
insert into estimate_items(id,estimate_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos) values
('be000000-0000-4000-8000-000000000001','ae000000-0000-4000-8000-000000000001','2e000000-0000-4000-8000-000000000001','Brake service',1,850000,850000),
('be000000-0000-4000-8000-000000000002','ae000000-0000-4000-8000-000000000002','2e000000-0000-4000-8000-000000000001','Suspension service',1,950000,950000),
('be000000-0000-4000-8000-000000000003','ae000000-0000-4000-8000-000000000003','2e000000-0000-4000-8000-000000000001','Transmission service',1,1050000,1050000);

select plan(47);
select has_table('public','notification_outbox','notification outbox exists');
select has_table('public','notification_delivery_secrets','protected delivery-secret table exists');
select has_column('public','notification_outbox','deduplication_key','outbox has deterministic deduplication');
select ok((select relrowsecurity from pg_class where oid='public.notification_outbox'::regclass),'outbox enforces RLS');
select ok((select relrowsecurity from pg_class where oid='public.notification_delivery_secrets'::regclass),'delivery secrets enforce RLS');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from notification_outbox$$,'42501','permission denied for table notification_outbox','staff cannot browse the protected outbox table');
select throws_ok($$select * from notification_delivery_secrets$$,'42501','permission denied for table notification_delivery_secrets','staff cannot read encrypted delivery secrets');
select lives_ok($$select * from create_estimate_approval_link(
  'ae000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '7 days',
  'Y2lwaGVydGV4dA==','aW5pdGlhbGl6YXRpb24=','YXV0aHRhZw=='
)$$,'approval link and notification intents commit together');

reset role;
select is((select count(*) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('a',64))),2::bigint,'email and SMS use separate outbox rows');
select is((select status from notification_outbox where channel='email' and reference_id=(select id from estimate_approval_links where token_hash=repeat('a',64))),'pending','eligible email is pending');
select is((select status from notification_outbox where channel='sms' and reference_id=(select id from estimate_approval_links where token_hash=repeat('a',64))),'pending','eligible SMS is pending');
select is((select count(distinct deduplication_key) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('a',64))),2::bigint,'each channel has a unique deterministic key');
select ok(not exists(select 1 from notification_outbox where payload::text like '%'||repeat('a',64)||'%'),'outbox payload excludes token hashes and raw tokens');
select is((select recipient_address from notification_outbox where channel='email' limit 1),'customer@example.com','email destination is normalized and snapshotted');
select is((select recipient_address from notification_outbox where channel='sms' limit 1),'+639171234567','Philippine mobile is normalized and snapshotted');

set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is((select count(*) from claim_notification_outbox_batch('worker-one',25,15)),2::bigint,'first worker atomically claims both due rows');
select is((select count(*) from claim_notification_outbox_batch('worker-two',25,15)),0::bigint,'second worker cannot concurrently claim the same rows');
select is(record_notification_delivery_result(
  (select id from notification_outbox where channel='email' and notification_type='ESTIMATE_AWAITING_APPROVAL'),
  'worker-one','sent','test-email','message-1',null,null,null
),'sent','provider acceptance records sent');
select is((select attempt_count from notification_outbox where channel='email' and notification_type='ESTIMATE_AWAITING_APPROVAL'),1,'sent delivery increments the provider attempt count');
select is(record_notification_delivery_result(
  (select id from notification_outbox where channel='sms' and notification_type='ESTIMATE_AWAITING_APPROVAL'),
  'worker-one','retry','test-sms',null,'RATE_LIMIT','Try later',now()+interval '1 minute'
),'pending','temporary failure returns the message to pending');
select is((select attempt_count from notification_outbox where channel='sms' and notification_type='ESTIMATE_AWAITING_APPROVAL'),1,'retry increments the provider attempt count once');
select ok((select available_at>now() from notification_outbox where channel='sms' and notification_type='ESTIMATE_AWAITING_APPROVAL'),'retry schedules a future attempt');

reset role;
update notification_outbox set status='processing',locked_by='dead-worker',locked_at=now()-interval '20 minutes'
where channel='sms' and notification_type='ESTIMATE_AWAITING_APPROVAL';
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is((select count(*) from claim_notification_outbox_batch('recovery-worker',25,15)),1::bigint,'expired worker lease is recovered without a duplicate row');
select is(record_notification_delivery_result(
  (select id from notification_outbox where channel='sms' and notification_type='ESTIMATE_AWAITING_APPROVAL'),
  'recovery-worker','sent','test-sms','message-2',null,null,null
),'sent','recovered work can complete');

reset role;
update estimate_approval_links set expires_at=now()+interval '23 hours' where token_hash=repeat('a',64);
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_estimate_approval_reminders(50),2,'one reminder is queued for each eligible channel');
select is(enqueue_due_estimate_approval_reminders(50),0,'repeated reminder scheduling is idempotent');
select is((select count(*) from notification_outbox where notification_type='ESTIMATE_APPROVAL_REMINDER'),2::bigint,'exactly two reminder rows exist');
select is((select count(*) from claim_notification_outbox_batch('reminder-worker',25,15)),2::bigint,'bounded worker claims the due reminders');

set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(decide_public_estimate_approval(repeat('a',64),'approve',null)->>'state','approved','customer approval succeeds while reminders are claimed');
reset role;
select is((select count(*) from notification_outbox where notification_type='ESTIMATE_APPROVAL_REMINDER' and status in ('pending','processing')),0::bigint,'customer decision cancels outstanding reminders');
select ok((select destroyed_at is not null and ciphertext is null from notification_delivery_secrets limit 1),'approval decision destroys encrypted delivery material');
select ok(exists(select 1 from audit_events where event_type='notification.cancelled' and metadata->>'reason'='CUSTOMER_APPROVED'),'obsolete delivery cancellation is audited safely');

update customer_communication_preferences set email_opt_in=false,sms_opt_in=false where customer_id='5e000000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link(
  'ae000000-0000-4000-8000-000000000002',repeat('b',64),now()+interval '7 days',
  'Y2lwaGVydGV4dDI=','aW5pdGlhbGl6YXRpb24y','YXV0aHRhZzI='
)$$,'link creation remains successful when both channels are opted out');
reset role;
select is((select count(*) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('b',64)) and status='cancelled'),2::bigint,'opted-out channels are terminally cancelled, not retried');
select is((select count(distinct eligibility_reason) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('b',64))),2::bigint,'each opted-out channel records its controlled reason');

update notification_outbox set status='failed',failed_at=now(),cancelled_at=null
where reference_id=(select id from estimate_approval_links where token_hash=repeat('b',64)) and channel='email';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select retry_notification_outbox((select outbox_id from get_estimate_approval_delivery_status('9e000000-0000-4000-8000-000000000002') where channel='email'))$$,'authorized owner can manually retry a failed message');
select is((select status from get_estimate_approval_delivery_status('9e000000-0000-4000-8000-000000000002') where channel='email'),'pending','manual retry requeues the same outbox row');
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select retry_notification_outbox('ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'42501','Notification not found','unauthorized users receive a controlled retry denial');
select throws_ok($$select * from get_estimate_approval_delivery_status('9e000000-0000-4000-8000-000000000001')$$,'42501','Job order not found','another tenant cannot inspect delivery status');
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from get_estimate_approval_delivery_status('9e000000-0000-4000-8000-000000000001')),4::bigint,'authorized advisor status RPC returns safe per-channel history');
select throws_ok($$select * from claim_notification_outbox_batch('browser-worker',25,15)$$,'42501','permission denied for function claim_notification_outbox_batch','browser roles cannot claim worker jobs');

set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(decide_public_estimate_approval(repeat('b',64),'decline',null)->>'state','declined','customer decline succeeds with a queued retry outstanding');
reset role;
select is((select count(*) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('b',64)) and status in ('pending','processing')),0::bigint,'customer decline cancels outstanding delivery');

update customer_communication_preferences set email_opt_in=true,sms_opt_in=true where customer_id='5e000000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"1e000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link(
  'ae000000-0000-4000-8000-000000000003',repeat('c',64),now()+interval '2 hours',
  'Y2lwaGVydGV4dDM=','aW5pdGlhbGl6YXRpb24z','YXV0aHRhZzM='
)$$,'another active approval cycle gets independent channel identities');
reset role;
update estimate_approval_links set expires_at=now()-interval '1 minute' where token_hash=repeat('c',64);
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_estimate_approval_reminders(50),0,'expired links do not receive reminders');
reset role;
update estimate_items set description_snapshot='Revised transmission service' where estimate_id='ae000000-0000-4000-8000-000000000003';
select is((select status from estimate_approval_links where token_hash=repeat('c',64)),'superseded','estimate revision supersedes the active approval link');
select is((select count(*) from notification_outbox where reference_id=(select id from estimate_approval_links where token_hash=repeat('c',64)) and status in ('pending','processing')),0::bigint,'estimate revision cancels stale version delivery');

select * from finish();
rollback;
