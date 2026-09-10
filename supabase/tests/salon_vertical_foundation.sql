begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('5b100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salon-test@example.test','',now(),'{}','{}',now(),now()),
('5b100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','auto-test@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,industry) values
('5b200000-0000-4000-8000-000000000001','Salon Test','salon-test','salon'),
('5b200000-0000-4000-8000-000000000002','Auto Test','auto-test','automotive');
insert into organization_memberships(organization_id,user_id,role) values
('5b200000-0000-4000-8000-000000000001','5b100000-0000-4000-8000-000000000001','owner'),
('5b200000-0000-4000-8000-000000000002','5b100000-0000-4000-8000-000000000002','owner');
update profiles set full_name='Alex Stylist' where id='5b100000-0000-4000-8000-000000000001';
insert into branches(id,organization_id,name,timezone,is_primary) values
('5b400000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','Salon Branch','Asia/Manila',true),
('5b400000-0000-4000-8000-000000000002','5b200000-0000-4000-8000-000000000002','Auto Branch','Asia/Manila',true);
update branches set opening_hours='{"monday":{"open":"08:00","close":"20:00"},"tuesday":{"open":"08:00","close":"20:00"},"wednesday":{"open":"08:00","close":"20:00"},"thursday":{"open":"08:00","close":"20:00"},"friday":{"open":"08:00","close":"20:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"open":"08:00","close":"20:00"}}'::jsonb where id='5b400000-0000-4000-8000-000000000001';
insert into customers(id,organization_id,full_name,email,phone) values
('5b500000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','Salon Client','salon-client@example.test','09171234567'),
('5b500000-0000-4000-8000-000000000002','5b200000-0000-4000-8000-000000000002','Auto Customer',null,null);
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values
('5b700000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','Haircut',60,65000),
('5b700000-0000-4000-8000-000000000002','5b200000-0000-4000-8000-000000000001','Hair Color',90,120000);
insert into appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at) values
('5b900000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,'checked_in','internal',now()),
('5b900000-0000-4000-8000-000000000003','5b200000-0000-4000-8000-000000000001','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,'requested','internal',now()+interval '9 days'),
('5b900000-0000-4000-8000-000000000004','5b200000-0000-4000-8000-000000000001','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,'confirmed','internal',now()+interval '12 hours'),
('5b900000-0000-4000-8000-000000000002','5b200000-0000-4000-8000-000000000002','5b400000-0000-4000-8000-000000000002','5b500000-0000-4000-8000-000000000002',null,'requested','internal',now()+interval '8 days');
insert into appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values
('5b900000-0000-4000-8000-000000000001','5b700000-0000-4000-8000-000000000001','Haircut',65000,60),
('5b900000-0000-4000-8000-000000000003','5b700000-0000-4000-8000-000000000001','Haircut',65000,60),
('5b900000-0000-4000-8000-000000000004','5b700000-0000-4000-8000-000000000001','Haircut',65000,60);
insert into customer_communication_preferences(customer_id,organization_id,email_opt_in,sms_opt_in) values
('5b500000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001',true,true);
insert into scheduling_resources(id,organization_id,branch_id,name,resource_type,capacity) values
('5b800000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','5b400000-0000-4000-8000-000000000001','Styling Chair 1','station',1);
insert into appointment_staff_assignments(organization_id,appointment_id,staff_membership_id)
select '5b200000-0000-4000-8000-000000000001',appointment_id,membership.id
from organization_memberships membership
cross join (values('5b900000-0000-4000-8000-000000000003'::uuid),('5b900000-0000-4000-8000-000000000004'::uuid)) assigned(appointment_id)
where membership.organization_id='5b200000-0000-4000-8000-000000000001';
-- Deliberately malformed privileged fixture: authenticated Salon sessions must not see it.
insert into vehicles(id,organization_id,customer_id,make,model) values
('5b600000-0000-4000-8000-000000000001','5b200000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001','Hidden','Vehicle');

select plan(72);
select is((select industry from organizations where id='5b200000-0000-4000-8000-000000000002'),'automotive','Automotive organization remains explicit');
select throws_ok($$insert into organizations(name,slug,industry) values('Bad','bad-industry','unknown')$$,'23514',null,'unsupported industry is constrained');
set local session_replication_role=replica;
select lives_ok($$update organizations set public_page_enabled=true where id='5b200000-0000-4000-8000-000000000001'$$,'Salon can publish its vehicle-free public booking storefront');
set local session_replication_role=origin;

set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$update organizations set industry='automotive' where id='5b200000-0000-4000-8000-000000000001'$$,'42501',null,'Salon owner cannot promote its organization to Automotive');
select is((select industry from organizations where id='5b200000-0000-4000-8000-000000000001'),'salon','blocked industry change preserves Salon identity');
select is((select count(*) from customers where organization_id='5b200000-0000-4000-8000-000000000001')::bigint,1::bigint,'Salon member reads its Core Client');
select is((select count(*) from scheduling_resources where organization_id='5b200000-0000-4000-8000-000000000001')::bigint,1::bigint,'Salon member reads its Core Resource');
select is((select count(*) from vehicles where organization_id='5b200000-0000-4000-8000-000000000001')::bigint,0::bigint,'Salon member cannot read Automotive Vehicle rows even in its tenant');
select throws_ok($$insert into vehicles(organization_id,customer_id,make,model) values('5b200000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001','Blocked','Vehicle')$$,'42501',null,'Salon member cannot create Vehicle rows');
select lives_ok($$select save_appointment_with_assignments(null,'5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,array['5b700000-0000-4000-8000-000000000001'::uuid],now()+interval '7 days','{}',array['5b800000-0000-4000-8000-000000000001'::uuid],null,null,false)$$,'Salon creates appointment through Core persistence without Vehicle');
select is((select count(*) from appointments where organization_id='5b200000-0000-4000-8000-000000000001' and vehicle_id is null)::bigint,4::bigint,'Salon appointments persist without Vehicle');
select throws_ok($$select transition_appointment('5b900000-0000-4000-8000-000000000001','complete',null)$$,'P0001','Invalid appointment transition','generic Core transition does not complete vertical workflow');
select lives_ok($$select transition_salon_appointment('5b900000-0000-4000-8000-000000000001','start_service')$$,'Salon starts a checked-in standalone appointment');
select lives_ok($$select transition_salon_appointment('5b900000-0000-4000-8000-000000000001','complete')$$,'Salon completes an in-service standalone appointment');
select is((select status::text from appointments where id='5b900000-0000-4000-8000-000000000001'),'completed','standalone appointment reaches completed status');
select is((select count(*) from audit_events where entity_id='5b900000-0000-4000-8000-000000000001' and event_type='appointment.status_changed')::bigint,2::bigint,'start and completion use the existing appointment audit boundary');
select throws_ok($$select transition_salon_appointment('5b900000-0000-4000-8000-000000000002','complete')$$,'42501','Salon appointment not found','Salon cannot transition an Automotive tenant appointment');
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$update appointments set status='completed' where id='5b900000-0000-4000-8000-000000000002'$$,'42501',null,'same-tenant Automotive owner cannot mutate Appointment status directly');
select is((select status::text from appointments where id='5b900000-0000-4000-8000-000000000002'),'requested','blocked direct update preserves Automotive lifecycle state');
select lives_ok($$select transition_appointment('5b900000-0000-4000-8000-000000000002','confirm',null)$$,'Automotive appointment still uses the controlled Core transition RPC');
select is((select status::text from appointments where id='5b900000-0000-4000-8000-000000000002'),'confirmed','controlled Automotive transition remains operational');
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$update appointments set customer_note='Updated safely' where id='5b900000-0000-4000-8000-000000000003'$$,'authorized non-status Appointment edits remain available');
select is((select count(*) from customers where organization_id='5b200000-0000-4000-8000-000000000002')::bigint,0::bigint,'Salon cannot read Automotive tenant customers');
select is_empty($$update appointments set customer_note='cross tenant' where organization_id='5b200000-0000-4000-8000-000000000002' returning id$$,'Salon cannot update another tenant appointment');

select lives_ok($$select save_organization_staff_profile((select id from organization_memberships where organization_id='5b200000-0000-4000-8000-000000000001'),'Senior Stylist',array['Hair Color'])$$,'owner saves an organization-specific Salon job function');
select is((select job_function from organization_staff_profiles where organization_id='5b200000-0000-4000-8000-000000000001'),'Senior Stylist','job function is stored in the separate staff profile');
select is((select role::text from organization_memberships where organization_id='5b200000-0000-4000-8000-000000000001'),'owner','job function does not alter authorization role');
select throws_ok($$select save_organization_staff_profile((select id from organization_memberships where organization_id='5b200000-0000-4000-8000-000000000002'),'Stylist','{}')$$,'42501','Staff member not found','cross-tenant staff profile update is denied');
select lives_ok($$select create_appointment_self_service_link('5b900000-0000-4000-8000-000000000003',repeat('c',64),now()+interval '14 days',null,null,null)$$,'authorized Salon staff creates a hash-only customer link');
select is((select count(id) from appointment_self_service_links where appointment_id='5b900000-0000-4000-8000-000000000003')::bigint,1::bigint,'one active customer link is visible without exposing its token hash');

set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_appointment_self_service(repeat('c',64))->>'state','active','anonymous token reads only the public appointment DTO');
select is(get_public_appointment_self_service(repeat('c',64))->'assignedStaff'->>0,'Alex Stylist','public DTO exposes assigned staff display name without identifiers');
select is(update_public_appointment_self_service(repeat('c',64),'confirm',null)->>'state','confirmed','customer confirms through the narrow token RPC');
select is(update_public_appointment_self_service(repeat('c',64),'confirm',null)->>'state','confirmed','repeated customer confirmation is an idempotent success');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is((select count(*) from audit_events where entity_id='5b900000-0000-4000-8000-000000000003' and event_type='appointment.customer_confirmed')::bigint,1::bigint,'confirmation retry does not duplicate its audit event');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(update_public_appointment_self_service(repeat('c',64),'reschedule',((current_date+10)+time '10:00') at time zone 'Asia/Manila')->>'state','rescheduled','customer reschedule succeeds through authoritative availability checks');
select throws_ok($$select * from appointment_self_service_links$$,'42501','permission denied for table appointment_self_service_links','anonymous cannot browse appointment link records');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select record_appointment_payment('5b900000-0000-4000-8000-000000000001',20000,'cash','payment-retry-0001',null,null)$$,'Salon payment can reference an Appointment without a Job Order');
select is(record_appointment_payment('5b900000-0000-4000-8000-000000000001',20000,'cash','payment-retry-0001',null,null),(select id from payments where appointment_id='5b900000-0000-4000-8000-000000000001'),'exact payment retry returns the original payment');
select is((select count(*) from payments where appointment_id='5b900000-0000-4000-8000-000000000001')::bigint,1::bigint,'exact payment retry creates no duplicate row');
select throws_ok($$select record_appointment_payment('5b900000-0000-4000-8000-000000000001',25000,'cash','payment-retry-0001',null,null)$$,'P0001','Idempotency key conflicts with an existing payment','conflicting payment-key reuse is rejected');
select is((select sum(amount_centavos)::bigint from payments where appointment_id='5b900000-0000-4000-8000-000000000001' and status='paid'),20000::bigint,'appointment paid balance derives from successful payments');
select throws_ok($$select record_appointment_payment('5b900000-0000-4000-8000-000000000001',50000,'cash','payment-overpay-0001',null,null)$$,'P0001','Invalid payment amount','server-authoritative appointment total blocks overpayment');
select lives_ok($$select reverse_payment((select id from payments where appointment_id='5b900000-0000-4000-8000-000000000001'),'void','test reversal')$$,'invoice-less appointment payment reverses safely');
select is((select count(*) from payments where appointment_id='5b900000-0000-4000-8000-000000000001' and status='paid')::bigint,0::bigint,'reversed appointment payment no longer counts as paid');
select throws_ok($$select record_appointment_payment('5b900000-0000-4000-8000-000000000002',1000,'cash','payment-auto-0001',null,null)$$,'42501','Appointment not found','Salon member cannot record payment against Automotive appointment');
select lives_ok($$select create_appointment_self_service_link('5b900000-0000-4000-8000-000000000004',repeat('d',64),now()+interval '14 days','cipher','iv','tag')$$,'authorized staff creates reminder-capable appointment link');

set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_salon_appointment_reminders(100),2,'shared outbox receives one Salon reminder per opted-in channel');
select is(enqueue_due_salon_appointment_reminders(100),0,'Salon reminder enqueue is idempotent for the schedule');
select is((select payload->'staffNames'->>0 from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and channel='email'),'Alex Stylist','reminder payload exposes assigned staff display name only');
select is((select count(*) from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and status='pending')::bigint,2::bigint,'Salon reminders are pending in the shared outbox');
select lives_ok($$update appointments set starts_at=starts_at+interval '1 hour' where id='5b900000-0000-4000-8000-000000000004'$$,'reschedule invalidates pending reminders');
select is((select count(*) from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and status='cancelled' and eligibility_reason='APPOINTMENT_RESCHEDULED')::bigint,2::bigint,'old schedule reminders are cancelled, not deleted');
select is(enqueue_due_salon_appointment_reminders(100),2,'rescheduled time enqueues a new reminder generation');
select lives_ok($$update appointments set starts_at=starts_at-interval '1 hour' where id='5b900000-0000-4000-8000-000000000004'$$,'appointment can return to its original time without reusing reminder identity');
select is(enqueue_due_salon_appointment_reminders(100),2,'A to B to A schedule still creates a fresh reminder generation');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select create_appointment_self_service_link('5b900000-0000-4000-8000-000000000004',repeat('e',64),now()+interval '14 days','cipher2','iv2','tag2')$$,'same-time customer-link replacement creates a new link identity');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_salon_appointment_reminders(100),2,'same-time link replacement enqueues against its new link identity');
select is((select count(*) from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004')::bigint,8::bigint,'all reminder generations remain distinct historical outbox rows');

reset role;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('5b100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','new-stylist@example.test','',now(),'{}','{}',now(),now());
update profiles set full_name='Bea Stylist' where id='5b100000-0000-4000-8000-000000000003';
insert into organization_memberships(id,organization_id,user_id,role)
values('5b300000-0000-4000-8000-000000000003','5b200000-0000-4000-8000-000000000001','5b100000-0000-4000-8000-000000000003','advisor');
update notification_outbox set status='sent',sent_at=now() where reference_id='5b900000-0000-4000-8000-000000000004' and status='pending';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment_with_assignments(
  '5b900000-0000-4000-8000-000000000004','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,
  array['5b700000-0000-4000-8000-000000000001'::uuid],(select starts_at from appointments where id='5b900000-0000-4000-8000-000000000004'),
  array[(select id from organization_memberships where organization_id='5b200000-0000-4000-8000-000000000001' and user_id='5b100000-0000-4000-8000-000000000001')],
  '{}','Notes changed only',null,false)$$,'notes-only save with unchanged Staff and Treatment sets succeeds');
select is((select schedule_revision from appointment_self_service_links where appointment_id='5b900000-0000-4000-8000-000000000004' and status='active'),1,'unchanged normalized child sets preserve reminder revision');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_salon_appointment_reminders(100),0,'notes-only unchanged save does not enqueue a duplicate reminder');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment_with_assignments(
  '5b900000-0000-4000-8000-000000000004','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,
  array['5b700000-0000-4000-8000-000000000001'::uuid],(select starts_at from appointments where id='5b900000-0000-4000-8000-000000000004'),
  array['5b300000-0000-4000-8000-000000000003'::uuid],'{}','Notes changed only',null,false)$$,'same-time Staff reassignment through scheduling advances generation once');
select is((select schedule_revision from appointment_self_service_links where appointment_id='5b900000-0000-4000-8000-000000000004' and status='active'),2,'Staff change advances the normalized generation exactly once');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_salon_appointment_reminders(100),2,'Staff reassignment enqueues a fresh reminder generation');
select is((select payload->'staffNames'->>0 from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and channel='email' and status='pending'),'Bea Stylist','fresh reminder snapshots the reassigned Staff display name');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"5b100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select save_appointment_with_assignments(
  '5b900000-0000-4000-8000-000000000004','5b400000-0000-4000-8000-000000000001','5b500000-0000-4000-8000-000000000001',null,
  array['5b700000-0000-4000-8000-000000000002'::uuid],(select starts_at from appointments where id='5b900000-0000-4000-8000-000000000004'),
  array['5b300000-0000-4000-8000-000000000003'::uuid],'{}','Notes changed only',null,false)$$,'Treatment change through scheduling advances generation once');
select is((select schedule_revision from appointment_self_service_links where appointment_id='5b900000-0000-4000-8000-000000000004' and status='active'),3,'Treatment change advances the normalized generation exactly once');
set local role service_role;
set local "request.jwt.claims"='{"role":"service_role"}';
select is(enqueue_due_salon_appointment_reminders(100),2,'Treatment change enqueues a fresh reminder generation');
select is((select payload->'treatments'->>0 from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and channel='email' and status='pending'),'Hair Color','fresh reminder snapshots the changed Treatment');
select is((select count(*) from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004' and eligibility_reason='APPOINTMENT_DETAILS_CHANGED')::bigint,2::bigint,'final-set change cancels stale pending rows once without deleting history');
select is((select count(*) from notification_outbox where reference_id='5b900000-0000-4000-8000-000000000004')::bigint,12::bigint,'Staff and Treatment changes retain distinct outbox generations');

select * from finish();
rollback;
