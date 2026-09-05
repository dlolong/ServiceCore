begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('15100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','work-owner-a@example.com','',now(),'{}','{}',now(),now()),
('15100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','work-tech-a@example.com','',now(),'{}','{}',now(),now()),
('15100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','work-tech-b@example.com','',now(),'{}','{}',now(),now()),
('15100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','work-owner-b@example.com','',now(),'{}','{}',now(),now()),
('15100000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','work-viewer-a@example.com','',now(),'{}','{}',now(),now());
insert into profiles(id,full_name) values
('15100000-0000-4000-8000-000000000001','Work Owner'),
('15100000-0000-4000-8000-000000000002','Mark Technician'),
('15100000-0000-4000-8000-000000000003','Leo Technician'),
('15100000-0000-4000-8000-000000000004','Other Owner'),
('15100000-0000-4000-8000-000000000005','Work Viewer')
on conflict(id) do update set full_name=excluded.full_name;
insert into organizations(id,name,slug,industry) values
('25100000-0000-4000-8000-000000000001','Work Auto A','work-auto-a','automotive'),
('25100000-0000-4000-8000-000000000002','Work Auto B','work-auto-b','automotive');
insert into organization_memberships(organization_id,user_id,role) values
('25100000-0000-4000-8000-000000000001','15100000-0000-4000-8000-000000000001','owner'),
('25100000-0000-4000-8000-000000000001','15100000-0000-4000-8000-000000000002','technician'),
('25100000-0000-4000-8000-000000000001','15100000-0000-4000-8000-000000000003','technician'),
('25100000-0000-4000-8000-000000000001','15100000-0000-4000-8000-000000000005','viewer'),
('25100000-0000-4000-8000-000000000002','15100000-0000-4000-8000-000000000004','owner');
insert into branches(id,organization_id,name,timezone,is_primary) values
('45100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','Work Branch A','Asia/Manila',true),
('45100000-0000-4000-8000-000000000002','25100000-0000-4000-8000-000000000002','Work Branch B','Asia/Manila',true);
insert into customers(id,organization_id,full_name) values
('55100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','Customer A'),
('55100000-0000-4000-8000-000000000002','25100000-0000-4000-8000-000000000002','Customer B');
insert into vehicles(id,organization_id,customer_id,make,model,plate_number,vehicle_type) values
('65100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','55100000-0000-4000-8000-000000000001','Toyota','Vios','WRK101','Sedan'),
('65100000-0000-4000-8000-000000000002','25100000-0000-4000-8000-000000000002','55100000-0000-4000-8000-000000000002','Honda','City','WRK202','Sedan');
insert into job_orders(id,organization_id,branch_id,customer_id,vehicle_id,status,primary_technician_user_id) values
('95100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','55100000-0000-4000-8000-000000000001','65100000-0000-4000-8000-000000000001','queued','15100000-0000-4000-8000-000000000002'),
('95100000-0000-4000-8000-000000000002','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','55100000-0000-4000-8000-000000000001','65100000-0000-4000-8000-000000000001','queued','15100000-0000-4000-8000-000000000002'),
('95100000-0000-4000-8000-000000000003','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','55100000-0000-4000-8000-000000000001','65100000-0000-4000-8000-000000000001','queued','15100000-0000-4000-8000-000000000003'),
('95100000-0000-4000-8000-000000000004','25100000-0000-4000-8000-000000000002','45100000-0000-4000-8000-000000000002','55100000-0000-4000-8000-000000000002','65100000-0000-4000-8000-000000000002','queued',null);
insert into job_inspections(organization_id,job_order_id,exterior_notes,inspected_by) values
('25100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001','Ready','15100000-0000-4000-8000-000000000001'),
('25100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002','Ready','15100000-0000-4000-8000-000000000001'),
('25100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000003','Ready','15100000-0000-4000-8000-000000000001');
insert into estimates(id,organization_id,branch_id,job_order_id,version,status,subtotal_centavos,total_centavos,authorized_total_centavos,approved_at) values
('a5100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001',1,'approved',0,0,0,now()),
('a5100000-0000-4000-8000-000000000002','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002',1,'approved',0,0,0,now()),
('a5100000-0000-4000-8000-000000000003','25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000003',1,'approved',0,0,0,now());

select plan(39);
select has_table('public','automotive_job_order_work_sessions','Automotive work-session ledger exists');
select has_function('public','start_automotive_job_work_session',array['uuid','uuid'],'Start RPC exists');
select has_function('public','end_automotive_job_work_session',array['uuid','text','text'],'End RPC exists');
select col_is_fk('public','automotive_job_order_work_sessions','job_order_id','session retains Job Order parent');
select col_is_fk('public','automotive_job_order_work_sessions','technician_user_id','session retains historical technician identity');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select transition_job('95100000-0000-4000-8000-000000000001','start')$$,'P0001','Start or resume work through technician work tracking','legacy direct Start cannot bypass session tracking');
select throws_ok($$select transition_job('95100000-0000-4000-8000-000000000001','resume')$$,'P0001','Start or resume work through technician work tracking','legacy direct Resume cannot bypass session tracking');
select lives_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000001',null)$$,'assigned technician starts own ready job');
select is((select status from job_orders where id='95100000-0000-4000-8000-000000000001')::text,'in_progress','Start preserves Work Execution status transition');
select is((select technician_user_id from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'15100000-0000-4000-8000-000000000002'::uuid,'technician identity resolves from auth.uid');
select ok((select started_at is not null and ended_at is null from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'server records active segment timestamps');
select is((select start_automotive_job_work_session('95100000-0000-4000-8000-000000000001',null)),(select id from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'same-job duplicate Start is idempotent');
select is((select count(*) from automotive_job_order_work_sessions where status='active')::bigint,1::bigint,'duplicate Start creates one active row');
select is((select count(*) from automotive_job_order_work_sessions where technician_user_id='15100000-0000-4000-8000-000000000002')::bigint,1::bigint,'technician can read own active session');
select throws_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000002',null)$$,'P0001','Technician already has an active work session','cross-job double Start is controlled');
select throws_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000003','15100000-0000-4000-8000-000000000003')$$,'42501','Technicians can only start their own work','technician cannot spoof another technician');
select throws_ok($$select transition_job('95100000-0000-4000-8000-000000000001','complete')$$,'P0001','Stop all active work sessions before completing this Job Order','completion cannot leave active sessions');
select lives_ok($$select end_automotive_job_work_session((select id from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'pause','Waiting for filter')$$,'Pause closes current segment');
select ok((select status='completed' and end_reason='paused' and ended_at>=started_at from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'Pause uses authoritative ended timestamp');
select lives_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000001',null)$$,'Resume creates another segment');
select is((select count(*) from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001')::bigint,2::bigint,'Pause and resume preserve two auditable segments');
select lives_ok($$select end_automotive_job_work_session((select id from automotive_job_order_work_sessions where status='active'),'stop',null)$$,'Stop closes resumed segment');
reset role;
select is((select count(*) from audit_events where event_type in ('job_order.work_started','job_order.work_paused','job_order.work_stopped'))::bigint,4::bigint,'start pause resume and stop audit high-value events');

update organization_memberships set is_active=false where organization_id='25100000-0000-4000-8000-000000000001' and user_id='15100000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select technician_name_snapshot from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001' limit 1),'Mark Technician','inactive technician history remains readable by manager');
select lives_ok($$select assign_job('95100000-0000-4000-8000-000000000001','15100000-0000-4000-8000-000000000003',null)$$,'reassignment preserves historical work sessions');
select is((select count(*) from audit_events where event_type='job_order.staff_assignment_changed')::bigint,1::bigint,'assignment change is audited once');
select lives_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000003','15100000-0000-4000-8000-000000000003')$$,'manager starts an assigned active technician');

reset role;
-- Materially invalidate the current authorization while the Job is already in progress.
update estimates set authorized_total_centavos=null where id='a5100000-0000-4000-8000-000000000003';
insert into job_order_items(id,organization_id,job_order_id,service_name_snapshot,unit_price_centavos,line_total_centavos,duration_minutes,technician_user_id)
values('b5100000-0000-4000-8000-000000000001','25100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000003','Second tech task',0,0,1,'15100000-0000-4000-8000-000000000002');
update organization_memberships set is_active=true where organization_id='25100000-0000-4000-8000-000000000001' and user_id='15100000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000003','15100000-0000-4000-8000-000000000002')$$,'P0001','Current customer authorization is required before work starts','second technician rechecks readiness on in-progress job');
select lives_ok($$select end_automotive_job_work_session((select id from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000003'),'stop',null)$$,'manager may stop assigned technician session');

-- Cancellation closes an anomalous active session without deleting elapsed history.
reset role;
insert into automotive_job_order_work_sessions(organization_id,branch_id,job_order_id,technician_user_id,technician_name_snapshot,created_by)
values('25100000-0000-4000-8000-000000000001','45100000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002','15100000-0000-4000-8000-000000000002','Mark Technician','15100000-0000-4000-8000-000000000001');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select transition_job('95100000-0000-4000-8000-000000000002','cancel')$$,'allowed cancellation closes active sessions');
select ok((select status='cancelled' and end_reason='job_cancelled' and ended_at is not null from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000002'),'cancel preserves and closes session history');

set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select start_automotive_job_work_session('95100000-0000-4000-8000-000000000003',null)$$,'42501','Job not found','cross-tenant Start is denied');
select throws_ok($$select transition_job('95100000-0000-4000-8000-000000000003','complete')$$,'42501','Job not found','transition wrapper does not disclose active cross-tenant sessions');
select is((select count(*) from automotive_job_order_work_sessions)::bigint,0::bigint,'cross-tenant member cannot read work sessions');
select throws_ok($$insert into automotive_job_order_work_sessions(organization_id,branch_id,job_order_id,technician_user_id,technician_name_snapshot,created_by) values('25100000-0000-4000-8000-000000000002','45100000-0000-4000-8000-000000000002','95100000-0000-4000-8000-000000000004','15100000-0000-4000-8000-000000000003','Attack','15100000-0000-4000-8000-000000000004')$$,'42501',null,'direct session INSERT is denied');

reset role;
select throws_ok($$insert into automotive_job_order_work_sessions(organization_id,branch_id,job_order_id,technician_user_id,technician_name_snapshot,created_by) values('25100000-0000-4000-8000-000000000002','45100000-0000-4000-8000-000000000002','95100000-0000-4000-8000-000000000003','15100000-0000-4000-8000-000000000003','Bad parent','15100000-0000-4000-8000-000000000001')$$,'P0001','Work session does not match its Automotive Job Order','parent tenant mismatch is rejected');
select ok((select count(*)=1 from pg_indexes where schemaname='public' and indexname='automotive_work_sessions_one_active_technician_idx'),'database uniqueness protects concurrent double Start');
select ok((select count(*)>=2 from automotive_job_order_work_sessions where job_order_id='95100000-0000-4000-8000-000000000001'),'historical segments remain after reassignment/deactivation');

set local role authenticated;
set local "request.jwt.claims"='{"sub":"15100000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*) from automotive_job_order_work_sessions)::bigint,0::bigint,'viewer cannot read operational work sessions');

select * from finish();
rollback;
