begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into organizations(id,name,slug,industry,public_page_enabled) values
('20650000-0000-4000-8000-000000000001','Queue Salon','queue-salon-test','salon',true),
('20650000-0000-4000-8000-000000000002','Other Salon','queue-other-test','salon',true),
('20650000-0000-4000-8000-000000000003','Private Salon','queue-private-test','salon',false),
('20650000-0000-4000-8000-000000000004','Auto','queue-auto-test','automotive',true);
insert into organization_subscriptions(organization_id,plan_id,status) values('20650000-0000-4000-8000-000000000001','business','active');
insert into branches(id,organization_id,name,timezone) values
('40650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','Main','Asia/Manila'),
('40650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','Other Branch','Asia/Manila'),
('40650000-0000-4000-8000-000000000003','20650000-0000-4000-8000-000000000002','Another Salon','Asia/Manila'),
('40650000-0000-4000-8000-000000000004','20650000-0000-4000-8000-000000000003','Private','Asia/Manila'),
('40650000-0000-4000-8000-000000000005','20650000-0000-4000-8000-000000000004','Auto','Asia/Manila');
insert into customers(id,organization_id,full_name,phone,email,notes) values
('50650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','  Maria   Secretlastname  ','09171234567','private@example.test','Private medical note'),
('50650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','Jun Otherlastname',null,null,null);
insert into appointments(id,organization_id,branch_id,customer_id,status,starts_at) values
('70650000-0000-4000-8000-000000000001','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','checked_in',((now() at time zone 'Asia/Manila')::date+time '09:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000002','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000002','in_service',((now() at time zone 'Asia/Manila')::date+time '08:30') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000003','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','confirmed',((now() at time zone 'Asia/Manila')::date+time '12:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000004','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','checked_in',(((now() at time zone 'Asia/Manila')::date-1)+time '12:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000005','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000002','50650000-0000-4000-8000-000000000001','checked_in',((now() at time zone 'Asia/Manila')::date+time '11:00') at time zone 'Asia/Manila'),
('70650000-0000-4000-8000-000000000006','20650000-0000-4000-8000-000000000001','40650000-0000-4000-8000-000000000001','50650000-0000-4000-8000-000000000001','completed',((now() at time zone 'Asia/Manila')::date+time '07:00') at time zone 'Asia/Manila');
create temporary table display_result(data jsonb);
grant all on display_result to anon;
set local role anon;
insert into display_result values(get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001'));
select is((select data->>'organizationName' from display_result),'Queue Salon','anon can view published Salon queue');
select is((select data->>'branchName' from display_result),'Main','selected branch identity');
select is((select data->>'industry' from display_result),'salon','Salon projection');
select is((select data->>'date' from display_result),(now() at time zone 'Asia/Manila')::date::text,'branch-local day');
select is((select data->>'timezone' from display_result),'Asia/Manila','branch timezone');
select is((select jsonb_array_length(data->'waiting') from display_result),1,'only current-day checked-in clients in this branch');
select is((select jsonb_array_length(data->'serving') from display_result),1,'only clients currently in service');
select is((select data->'waiting'->0->>'label' from display_result),'Maria S.','first name and last initial only');
select is((select data->'serving'->0->>'label' from display_result),'Jun O.','serving names abbreviated');
select is((select data->'waiting'->0->>'detail' from display_result),'Appointment 9:00 AM','time displayed in branch timezone');
select ok((select data->'waiting'->0->>'key' ~ '^[a-f0-9]{16}$' from display_result),'opaque display key');
select ok((select data::text !~ 'Secretlastname|Otherlastname|09171234567|private@example|medical|70650000|50650000' from display_result),'no full surnames/contact/notes/raw record identifiers');
select is((select count(*) from display_result,jsonb_object_keys(data)),8::bigint,'allowlisted snapshot fields only');
select is((select count(*) from display_result,jsonb_object_keys(data->'waiting'->0)),3::bigint,'allowlisted item fields only');
select is(get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000003'),null,'foreign Salon branch not readable via slug');
select is(get_public_salon_queue('queue-private-test','40650000-0000-4000-8000-000000000004'),null,'unpublished Salon queue unavailable');
select is(get_public_salon_queue('queue-auto-test','40650000-0000-4000-8000-000000000005'),null,'Automotive cannot use Salon queue endpoint');
select is(get_public_salon_queue('missing-salon','40650000-0000-4000-8000-000000000001'),null,'unknown slug unavailable');
select is(get_public_salon_queue('queue-salon-test',null),null,'null branch unavailable');
select is(jsonb_array_length(get_public_salon_queue('queue-other-test','40650000-0000-4000-8000-000000000003')->'waiting'),0,'empty branch returns empty list');
select throws_ok($$select * from appointments$$,'42501',null,'anonymous callers cannot read appointments');
select throws_ok($$select * from customers$$,'42501',null,'anonymous callers cannot read clients');
reset role;
update branches set is_active=false where id='40650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001'),null,'inactive branch unavailable');
reset role;
update branches set is_active=true where id='40650000-0000-4000-8000-000000000001';
update organizations set public_page_enabled=false where id='20650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001'),null,'unpublishing immediately revokes new queue reads');
reset role;
update organizations set public_page_enabled=true,status='suspended' where id='20650000-0000-4000-8000-000000000001';
set local role anon;
select is(get_public_salon_queue('queue-salon-test','40650000-0000-4000-8000-000000000001'),null,'suspended organization unavailable');
reset role;
select ok((select relrowsecurity from pg_class where oid='public.appointments'::regclass),'appointment RLS preserved');
select ok((select relrowsecurity from pg_class where oid='public.customers'::regclass),'customer RLS preserved');
select * from finish();
rollback;
