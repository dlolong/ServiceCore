begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('10640000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-salon-owner@example.test','',now(),'{}','{"full_name":"Public Salon Owner"}',now(),now()),
('10640000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-other-owner@example.test','',now(),'{}','{"full_name":"Other Owner"}',now(),now()),
('10640000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','public-salon-advisor@example.test','',now(),'{}','{"full_name":"Restricted Advisor"}',now(),now());
insert into organizations(id,name,slug,industry,public_page_enabled) values
('20640000-0000-4000-8000-000000000001','Public Salon','public-salon-sql-test','salon',true),
('20640000-0000-4000-8000-000000000002','Public Automotive','public-auto-sql-test','automotive',true),
('20640000-0000-4000-8000-000000000003','Private Salon','private-salon-sql-test','salon',false);
insert into organization_memberships(id,organization_id,user_id,role) values
('30640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','10640000-0000-4000-8000-000000000001','owner'),
('30640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000002','10640000-0000-4000-8000-000000000002','owner'),
('30640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','10640000-0000-4000-8000-000000000003','advisor');
insert into branches(id,organization_id,name,timezone,is_primary,opening_hours) values
('40640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','Salon Main','Pacific/Honolulu',true,'{}'),
('40640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000001','Salon Other','Pacific/Honolulu',false,'{}'),
('40640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000002','Auto Main','Pacific/Honolulu',true,'{}');
insert into membership_branch_assignments(organization_id,membership_id,branch_id) values
('20640000-0000-4000-8000-000000000001','30640000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000002');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos,is_public,is_active) values
('60640000-0000-4000-8000-000000000001','20640000-0000-4000-8000-000000000001','Haircut',30,10000,true,true),
('60640000-0000-4000-8000-000000000002','20640000-0000-4000-8000-000000000001','Color',60,25000,true,true),
('60640000-0000-4000-8000-000000000003','20640000-0000-4000-8000-000000000001','Other Branch Treatment',15,5000,true,true),
('60640000-0000-4000-8000-000000000004','20640000-0000-4000-8000-000000000001','Private Treatment',15,5000,false,true),
('60640000-0000-4000-8000-000000000005','20640000-0000-4000-8000-000000000001','Inactive Treatment',15,5000,true,false),
('60640000-0000-4000-8000-000000000006','20640000-0000-4000-8000-000000000002','Vehicle Wash',30,7000,true,true);
insert into service_branch_availability(organization_id,service_id,branch_id,is_available) values
('20640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000003','40640000-0000-4000-8000-000000000002',true);
insert into service_prices(organization_id,service_id,branch_id,vehicle_class,price_centavos) values
('20640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001',null,12000);

create function pg_temp.booking_time() returns timestamptz language sql stable as $$select (((now() at time zone 'Pacific/Honolulu')::date+2)+time '10:00') at time zone 'Pacific/Honolulu'$$;
create function pg_temp.salon_request(
  p_at timestamptz default pg_temp.booking_time(),
  p_ids uuid[] default array['60640000-0000-4000-8000-000000000001'::uuid,'60640000-0000-4000-8000-000000000002'::uuid],
  p_phone text default '09171112222',p_name text default 'Public Salon Client',
  p_branch uuid default '40640000-0000-4000-8000-000000000001',p_slug text default 'public-salon-sql-test'
) returns jsonb language sql as $$
  select public.submit_public_booking(p_slug,p_branch,p_ids,p_at,p_name,p_phone,null,null,null,null,null,null,'Public note','salon-sql-rate-'||coalesce(p_phone,''),'')
$$;
create temporary table results(kind text primary key,result jsonb,booking_id uuid);
grant all on results to anon,authenticated;

select ok((select relrowsecurity from pg_class where oid='public.public_booking_requests'::regclass),'request RLS remains enabled');
select ok((select relrowsecurity from pg_class where oid='public.public_booking_services'::regclass),'request service RLS remains enabled');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_shop('public-salon-sql-test')->>'industry','salon','published Salon advertises server-owned industry');
select is(get_public_shop('public-salon-sql-test')->'branches'->0->>'timezone','Pacific/Honolulu','public branch advertises timezone');
select is(get_public_shop('private-salon-sql-test'),null,'private Salon stays private');
select is(jsonb_array_length(get_public_shop('public-salon-sql-test')->'services'),3,'only active public treatments are advertised');
select throws_ok($$select * from public_booking_requests$$,'42501',null,'anon cannot read booking PII');
select throws_ok($$select public_booking_service_duration('20640000-0000-4000-8000-000000000001','40640000-0000-4000-8000-000000000001',array['60640000-0000-4000-8000-000000000001'::uuid])$$,'42501',null,'private duration validator cannot probe tenants');
select throws_ok($$select review_public_booking(null,'confirm')$$,'42501',null,'anonymous review execution is revoked');
select ok(exists(select 1 from get_public_availability('public-salon-sql-test','40640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000001',(pg_temp.booking_time() at time zone 'Pacific/Honolulu')::date) where slot_at=pg_temp.booking_time()),'Salon availability includes valid branch-local slot');
select is((select count(*) from get_public_availability('public-salon-sql-test','40640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000003',(pg_temp.booking_time() at time zone 'Pacific/Honolulu')::date)),0::bigint,'branch-restricted treatment has no slots here');
insert into results(kind,result) values('salon',pg_temp.salon_request());
select ok((select length(result->>'token')=64 and result ? 'reference' from results where kind='salon'),'vehicle-free anonymous Salon request succeeds');
select is(get_public_booking_status((select result->>'token' from results where kind='salon'))->>'industry','salon','token status advertises Salon presentation');
select is(get_public_booking_status((select result->>'token' from results where kind='salon'))->>'timezone','Pacific/Honolulu','token status advertises branch-local timezone');
select ok(get_public_booking_status((select result->>'token' from results where kind='salon'))::text not like '%09171112222%','token status omits customer contact details');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000002'::uuid,'60640000-0000-4000-8000-000000000001'::uuid])$$,'P0001','A similar booking request is already pending','reordered treatments cannot bypass duplicate detection');
set local timezone='Pacific/Auckland';
select throws_ok($$select pg_temp.salon_request()$$,'P0001','A similar booking request is already pending','session timezone cannot bypass duplicate detection');
select throws_ok($$select pg_temp.salon_request(p_at=>null)$$,'P0001','Invalid booking request','null preferred time is rejected');
select throws_ok($$select pg_temp.salon_request(p_name=>null)$$,'P0001','Invalid booking details','null required name is rejected');
select throws_ok($$select pg_temp.salon_request(p_phone=>null)$$,'P0001','Invalid booking details','null required phone is rejected');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000001'::uuid,null])$$,'P0001','Invalid booking request','null treatment IDs are rejected');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000001'::uuid,'60640000-0000-4000-8000-000000000001'::uuid])$$,'P0001','Invalid booking request','duplicate treatment IDs are rejected');
select throws_ok($$select pg_temp.salon_request(p_branch=>'40640000-0000-4000-8000-000000000003')$$,'P0001','Shop unavailable','cross-tenant branch is rejected');
select throws_ok($$select pg_temp.salon_request(p_slug=>'private-salon-sql-test')$$,'P0001','Shop unavailable','unpublished organization rejects submission');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000006'::uuid])$$,'P0001','Service unavailable','cross-tenant treatment is rejected');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000003'::uuid])$$,'P0001','Service unavailable','branch restriction is enforced on submission');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000004'::uuid])$$,'P0001','Service unavailable','private treatment is rejected');
select throws_ok($$select pg_temp.salon_request(p_ids=>array['60640000-0000-4000-8000-000000000005'::uuid])$$,'P0001','Service unavailable','inactive treatment is rejected');
select throws_ok($$select pg_temp.salon_request(p_at=>pg_temp.booking_time()+interval '6 hours')$$,'P0001','Selected booking time is unavailable','combined duration cannot run past branch closing');
select throws_ok($$select pg_temp.salon_request(p_at=>pg_temp.booking_time()-interval '3 hours')$$,'P0001','Selected booking time is unavailable','time before branch opening is rejected');
select throws_ok($$select pg_temp.salon_request(p_at=>pg_temp.booking_time()+interval '7 minutes')$$,'P0001','Selected booking time is unavailable','unadvertised off-grid time is rejected');
select throws_ok($$select pg_temp.salon_request(p_at=>now()+interval '30 minutes')$$,'P0001','Invalid booking request','minimum notice is enforced');
select throws_ok($$select pg_temp.salon_request(p_at=>now()+interval '61 days')$$,'P0001','Invalid booking request','booking horizon is enforced');
insert into results(kind,result) values('duration-change',pg_temp.salon_request(p_at=>pg_temp.booking_time()+interval '5 hours 30 minutes',p_phone=>'09177778888'));
insert into results(kind,result) values('same-slot',pg_temp.salon_request(p_phone=>'09172223333'));
insert into results(kind,result) values('tampered-vehicle',submit_public_booking('public-salon-sql-test','40640000-0000-4000-8000-000000000001',array['60640000-0000-4000-8000-000000000001'::uuid],pg_temp.booking_time()+interval '1 day','Another Salon Client','09173334444',null,'Forged','Vehicle',2024,'SUV','FAKE001',null,'tampered-vehicle',''));
select throws_ok($$select submit_public_booking('public-auto-sql-test','40640000-0000-4000-8000-000000000003',array['60640000-0000-4000-8000-000000000006'::uuid],pg_temp.booking_time(),'Auto Client','09174445555',null,null,null,null,null,null,null,'auto-invalid','')$$,'P0001','Invalid booking details','Automotive still requires vehicle make and model');
insert into results(kind,result) values('auto',submit_public_booking('public-auto-sql-test','40640000-0000-4000-8000-000000000003',array['60640000-0000-4000-8000-000000000006'::uuid],pg_temp.booking_time(),'Auto Client','09174445555',null,'Toyota','Vios',2024,'Sedan','AUT0064',null,'auto-valid',''));

reset role;
update results x set booking_id=r.id from public_booking_requests r where r.public_reference=x.result->>'reference';
update public_booking_requests set duplicate_hash='legacy-pending-hash' where id=(select booking_id from results where kind='salon');
set local role anon;
select throws_ok($$select pg_temp.salon_request()$$,'P0001','A similar booking request is already pending','historical duplicate hashes cannot bypass duplicate detection after upgrade');
reset role;
update services set duration_minutes=120 where id='60640000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select review_public_booking((select booking_id from results where kind='duration-change'),'confirm')$$,'P0001','Selected booking time is unavailable','confirmation rechecks current combined duration against closing time');
select is((select status::text from public_booking_requests where id=(select booking_id from results where kind='duration-change')),'requested','duration-change rejection leaves request reviewable');
reset role;
update services set duration_minutes=60 where id='60640000-0000-4000-8000-000000000002';
select is((select count(*) from public_booking_requests where organization_id='20640000-0000-4000-8000-000000000001' and vehicle_make is null and vehicle_model is null and vehicle_type is null and plate_number is null),4::bigint,'Salon requests never retain vehicle fields including tampered input');
select is((select sum(price_centavos) from public_booking_services where booking_request_id=(select booking_id from results where kind='salon')),37000::numeric,'public request snapshots use branch-specific treatment prices');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public_booking_requests where organization_id='20640000-0000-4000-8000-000000000001'),0::bigint,'other tenant cannot read Salon requests');
select throws_ok($$select review_public_booking((select booking_id from results where kind='salon'),'confirm')$$,'42501','Booking request not found','other tenant cannot confirm known Salon ID');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select review_public_booking((select booking_id from results where kind='salon'),'confirm')$$,'42501','Booking request not found','branch-restricted advisor cannot confirm another branch');
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select review_public_booking((select booking_id from results where kind='salon'),null)$$,'P0001','Invalid booking transition','null review action cannot confirm a request');
select lives_ok($$select review_public_booking((select booking_id from results where kind='salon'),'confirm')$$,'owner confirms vehicle-free Salon booking');
select is((select count(*) from appointments where organization_id='20640000-0000-4000-8000-000000000001' and vehicle_id is null and status='confirmed' and source='public_booking'),1::bigint,'Salon confirmation creates correct Core appointment without vehicle');
select is((select expected_total_centavos from appointments where id=(select appointment_id from public_booking_requests where id=(select booking_id from results where kind='salon'))),37000::bigint,'canonical appointment pricing snapshots match branch prices');
select is((select ends_at-starts_at from appointments where id=(select appointment_id from public_booking_requests where id=(select booking_id from results where kind='salon'))),interval '90 minutes','canonical triggers calculate total duration and ends_at');
select is((select count(*) from appointment_services where appointment_id=(select appointment_id from public_booking_requests where id=(select booking_id from results where kind='salon')) and service_name_snapshot in('Haircut','Color')),2::bigint,'canonical treatment name snapshots persist');
select throws_ok($$select review_public_booking((select booking_id from results where kind='salon'),'confirm')$$,'P0001','Invalid booking transition','repeat confirmation cannot create another appointment');
select throws_ok($$select review_public_booking((select booking_id from results where kind='same-slot'),'confirm')$$,'P0001','Selected booking time is unavailable','a second pending request cannot confirm into occupied slot');
select is((select status::text from public_booking_requests where id=(select booking_id from results where kind='same-slot')),'requested','failed conflict confirmation leaves request reviewable');
select lives_ok($$select review_public_booking((select booking_id from results where kind='same-slot'),'decline','Please select another time')$$,'conflicting request can be declined');
select lives_ok($$select review_public_booking((select booking_id from results where kind='tampered-vehicle'),'confirm')$$,'Salon confirmation ignores tampered vehicle input');
reset role;
select is((select count(*) from vehicles where organization_id='20640000-0000-4000-8000-000000000001'),0::bigint,'Salon public flow creates no vehicle rows');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"10640000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select review_public_booking((select booking_id from results where kind='auto'),'confirm')$$,'Automotive owner still confirms vehicle-based booking');
select is((select count(*) from appointments where organization_id='20640000-0000-4000-8000-000000000002' and vehicle_id is not null and expected_total_centavos=7000 and ends_at=starts_at+interval '30 minutes'),1::bigint,'Automotive appointment retains vehicle and pricing/duration snapshots');
set local role anon;
set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select pg_temp.salon_request(p_phone=>'09175556666')$$,'P0001','Selected booking time is unavailable','new submission cannot select occupied slot');
select ok(not exists(select 1 from get_public_availability('public-salon-sql-test','40640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000001',(pg_temp.booking_time() at time zone 'Pacific/Honolulu')::date) where slot_at=pg_temp.booking_time()),'occupied slot disappears from advertised availability');
reset role;
update branches set opening_hours=jsonb_build_object(lower(to_char((pg_temp.booking_time() at time zone 'Pacific/Honolulu')::date,'FMDay')),jsonb_build_object('open','not-a-time','close','17:00')) where id='40640000-0000-4000-8000-000000000001';
set local role anon;
select is((select count(*) from get_public_availability('public-salon-sql-test','40640000-0000-4000-8000-000000000001','60640000-0000-4000-8000-000000000001',(pg_temp.booking_time() at time zone 'Pacific/Honolulu')::date)),0::bigint,'malformed opening hours fail closed without raw errors');
select throws_ok($$select pg_temp.salon_request(p_at=>pg_temp.booking_time()+interval '4 hours',p_phone=>'09176667777')$$,'P0001','Selected booking time is unavailable','malformed opening hours cannot be bypassed on submit');
select * from finish();
rollback;
