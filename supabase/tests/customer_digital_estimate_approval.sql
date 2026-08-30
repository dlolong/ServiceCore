begin; create extension if not exists pgtap with schema extensions; set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('1d000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','digital-owner@example.com','',now(),'{}','{}',now(),now()),
('1d000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','digital-restricted@example.com','',now(),'{}','{}',now(),now()),
('1d000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','digital-other@example.com','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug,phone) values
('2d000000-0000-4000-8000-000000000001','KarKR Digital A','karkr-digital-a','09171234567'),
('2d000000-0000-4000-8000-000000000002','KarKR Digital B','karkr-digital-b','09170000000');
insert into organization_memberships(organization_id,user_id,role) values
('2d000000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000001','owner'),
('2d000000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000002','advisor'),
('2d000000-0000-4000-8000-000000000002','1d000000-0000-4000-8000-000000000003','owner');
insert into branches(id,organization_id,name,phone,email,address_line,city,province) values
('4d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','Digital A Main','09171111111','main@example.com','1 Main St','Makati','Metro Manila'),
('4d000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000001','Digital A Restricted',null,null,null,'Pasig','Metro Manila'),
('4d000000-0000-4000-8000-000000000003','2d000000-0000-4000-8000-000000000002','Digital B Main',null,null,null,'Cebu City','Cebu');
insert into membership_branch_assignments(membership_id,organization_id,branch_id)
select id,organization_id,'4d000000-0000-4000-8000-000000000002' from organization_memberships where user_id='1d000000-0000-4000-8000-000000000002';
insert into customers(id,organization_id,full_name,notes) values
('5d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','Digital Customer','PRIVATE CUSTOMER NOTE'),
('5d000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000002','Other Customer','PRIVATE OTHER NOTE');
insert into vehicles(id,organization_id,customer_id,make,model,model_year,plate_number,vin,notes) values
('6d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','Toyota','Vios',2024,'DIG123','PRIVATEVIN123','PRIVATE VEHICLE NOTE'),
('6d000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000002','5d000000-0000-4000-8000-000000000002','Honda','City',2023,'OTH123','PRIVATEVIN456','PRIVATE OTHER NOTE');
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,job_number,status,internal_note) values
('9d000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001',1,'queued','PRIVATE JOB NOTE'),
('9d000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001',2,'queued','PRIVATE JOB NOTE'),
('9d000000-0000-4000-8000-000000000003','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001',3,'queued','PRIVATE JOB NOTE'),
('9d000000-0000-4000-8000-000000000004','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001',4,'queued','PRIVATE JOB NOTE'),
('9d000000-0000-4000-8000-000000000005','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','5d000000-0000-4000-8000-000000000001','6d000000-0000-4000-8000-000000000001',5,'queued','PRIVATE JOB NOTE'),
('9d000000-0000-4000-8000-000000000006','2d000000-0000-4000-8000-000000000002','4d000000-0000-4000-8000-000000000003','5d000000-0000-4000-8000-000000000002','6d000000-0000-4000-8000-000000000002',6,'queued','PRIVATE OTHER NOTE');
insert into estimates(id,organization_id,branch_id,job_order_id,version,status,subtotal_centavos,total_centavos,notes,created_by) values
('ad000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000001',1,'draft',100000,100000,'PRIVATE ESTIMATE NOTE','1d000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000002',1,'draft',120000,120000,'PRIVATE ESTIMATE NOTE','1d000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000003','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000003',1,'draft',130000,130000,'PRIVATE ESTIMATE NOTE','1d000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000004','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000004',1,'draft',140000,140000,'PRIVATE ESTIMATE NOTE','1d000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000005','2d000000-0000-4000-8000-000000000001','4d000000-0000-4000-8000-000000000001','9d000000-0000-4000-8000-000000000005',1,'draft',150000,150000,'PRIVATE ESTIMATE NOTE','1d000000-0000-4000-8000-000000000001'),
('ad000000-0000-4000-8000-000000000006','2d000000-0000-4000-8000-000000000002','4d000000-0000-4000-8000-000000000003','9d000000-0000-4000-8000-000000000006',1,'draft',160000,160000,'PRIVATE OTHER NOTE','1d000000-0000-4000-8000-000000000003');
insert into estimate_items(id,estimate_id,organization_id,description_snapshot,quantity,unit_price_centavos,line_total_centavos) values
('bd000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001','2d000000-0000-4000-8000-000000000001','Brake service',1,100000,100000),
('bd000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000002','2d000000-0000-4000-8000-000000000001','Tire service',1,120000,120000),
('bd000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000003','2d000000-0000-4000-8000-000000000001','Battery service',1,130000,130000),
('bd000000-0000-4000-8000-000000000004','ad000000-0000-4000-8000-000000000004','2d000000-0000-4000-8000-000000000001','Oil service',1,140000,140000),
('bd000000-0000-4000-8000-000000000005','ad000000-0000-4000-8000-000000000005','2d000000-0000-4000-8000-000000000001','Detailing',1,150000,150000),
('bd000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000006','2d000000-0000-4000-8000-000000000002','Other service',1,160000,160000);

select plan(45);
select has_table('public','estimate_approval_links','approval links table exists');
select has_column('public','estimate_approval_links','token_hash','only the token hash has a storage field');
select ok((select relrowsecurity from pg_class where oid='public.estimate_approval_links'::regclass),'approval links enforce RLS');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '7 days')$$,'authorized advisor creates a link');
select is((select count(*) from estimate_approval_links where estimate_id='ad000000-0000-4000-8000-000000000001' and status='active'),1::bigint,'one active link exists');
select is((select token_hash from estimate_approval_links where estimate_id='ad000000-0000-4000-8000-000000000001'),repeat('a',64),'only the supplied hash is stored');

set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_estimate_approval(repeat('a',64))->>'state','active','anonymous customer can load a valid private link');
select is(get_public_estimate_approval(repeat('a',64))#>>'{business,name}','KarKR Digital A','public DTO includes the business name');
select ok(not (get_public_estimate_approval(repeat('a',64))::text like '%customer_id%'),'public DTO excludes customer identifiers');
select ok(not ((get_public_estimate_approval(repeat('a',64))#>'{estimate,items,0}') ? 'id'),'public estimate lines exclude internal row IDs');
select ok(not (get_public_estimate_approval(repeat('a',64))::text like '%PRIVATEVIN%'),'public DTO excludes VIN');
select ok(not (get_public_estimate_approval(repeat('a',64))::text like '%PRIVATE%'),'public DTO excludes internal notes');
select throws_ok($$select * from estimate_approval_links$$,'42501','permission denied for table estimate_approval_links','anonymous role has no broad table read');
select is(get_public_estimate_approval(repeat('0',64))->>'state','invalid','unknown tokens return a generic invalid state');
select is(decide_public_estimate_approval(repeat('a',64),'approve','Please proceed')->>'state','approved','customer approves the exact estimate');

reset role;
select is((select status::text from estimates where id='ad000000-0000-4000-8000-000000000001'),'approved','digital approval updates estimate status');
select is((select authorization_method from estimates where id='ad000000-0000-4000-8000-000000000001'),'digital_link','authorization method records digital link');
select is((select approved_by from estimates where id='ad000000-0000-4000-8000-000000000001'),null::uuid,'digital customer is not impersonated as staff');
select is((select authorized_total_centavos from estimates where id='ad000000-0000-4000-8000-000000000001'),100000::bigint,'authorized amount is snapshotted');
select is((select status::text from job_orders where id='9d000000-0000-4000-8000-000000000001'),'approved','approved estimate advances eligible job');
select is((select status from estimate_approval_links where token_hash=repeat('a',64)),'approved','link is consumed atomically');
select ok(exists(select 1 from audit_events where entity_id='ad000000-0000-4000-8000-000000000001' and event_type='estimate.digital_approved' and actor_user_id is null),'digital approval is audited without a staff actor');
select ok(not exists(select 1 from audit_events where metadata::text like '%'||repeat('a',64)||'%'),'token hash is not copied into audit metadata');

set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(decide_public_estimate_approval(repeat('a',64),'approve','retry')->>'idempotent','true','same decision is idempotent');
select is(decide_public_estimate_approval(repeat('a',64),'decline','opposite')->>'state','already_approved','opposite retry cannot overwrite the first decision');
reset role;
select is((select count(*) from audit_events where entity_id='ad000000-0000-4000-8000-000000000001' and event_type='estimate.digital_approved'),1::bigint,'idempotent retry does not duplicate decision audit');
select is((select status::text from estimates where id='ad000000-0000-4000-8000-000000000001'),'approved','first decision wins');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000002',repeat('b',64),now()+interval '7 days')$$,'second estimate link created');
set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(decide_public_estimate_approval(repeat('b',64),'decline','Not now')->>'state','declined','customer can decline');
reset role;
select is((select authorization_method from estimates where id='ad000000-0000-4000-8000-000000000002'),'digital_link','decline records digital authorization method');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000003',repeat('c',64),now()+interval '7 days')$$,'expiring link created');
reset role; update estimate_approval_links set expires_at=now()-interval '1 minute' where token_hash=repeat('c',64);
set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_estimate_approval(repeat('c',64))->>'state','expired','expired link cannot disclose estimate data');
select is(decide_public_estimate_approval(repeat('c',64),'approve',null)->>'state','expired','expired link cannot decide');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000004',repeat('d',64),now()+interval '7 days')$$,'revocable link created');
select lives_ok($$select revoke_estimate_approval_link((select id from estimate_approval_links where token_hash=repeat('d',64)))$$,'advisor revokes an active link');
set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_estimate_approval(repeat('d',64))->>'state','revoked','revoked link is unusable');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000005',repeat('e',64),now()+interval '7 days')$$,'original replaceable link created');
select lives_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000005',repeat('f',64),now()+interval '7 days')$$,'regeneration creates a replacement');
select is((select status from estimate_approval_links where token_hash=repeat('e',64)),'revoked','regeneration revokes the original');
select is((select count(*) from estimate_approval_links where estimate_id='ad000000-0000-4000-8000-000000000005' and status='active'),1::bigint,'regeneration retains only one active link');
reset role; update estimate_items set description_snapshot='Revised detailing' where estimate_id='ad000000-0000-4000-8000-000000000005';
select is((select status from estimate_approval_links where token_hash=repeat('f',64)),'superseded','estimate work revision invalidates active link even when the total is unchanged');
set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select is(get_public_estimate_approval(repeat('f',64))->>'state','superseded','superseded link cannot display stale estimate');

set local role authenticated; set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000006',repeat('8',64),now()+interval '7 days')$$,'42501','Estimate not found','another tenant estimate cannot be shared');
set local "request.jwt.claims"='{"sub":"1d000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000001',repeat('9',64),now()+interval '7 days')$$,'42501','Estimate not found','branch-restricted advisor cannot share another branch estimate');
set local role anon; set local "request.jwt.claims"='{"role":"anon"}';
select throws_ok($$select * from create_estimate_approval_link('ad000000-0000-4000-8000-000000000003',repeat('7',64),now()+interval '7 days')$$,'42501','permission denied for function create_estimate_approval_link','anonymous user cannot create links');

select * from finish(); rollback;
