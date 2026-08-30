begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('16000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','transfer-owner@example.test','',now(),'{}','{}',now(),now()),
('16000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','transfer-tech@example.test','',now(),'{}','{}',now(),now()),
('16000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','other-tech@example.test','',now(),'{}','{}',now(),now());
insert into organizations(id,name,slug) values('26000000-0000-4000-8000-000000000001','Transfer A','transfer-a'),('26000000-0000-4000-8000-000000000002','Transfer B','transfer-b');
insert into organization_memberships(id,organization_id,user_id,role,is_active) values
('36000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','owner',true),
('36000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000002','technician',true),
('36000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000002','16000000-0000-4000-8000-000000000003','technician',true);
insert into branches(id,organization_id,name,timezone) values('46000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Transfer Branch','Asia/Manila');
insert into customers(id,organization_id,full_name) values('56000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Transfer Customer');
insert into vehicles(id,organization_id,customer_id,make,model) values('66000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','Toyota','Vios');
insert into services(id,organization_id,name,duration_minutes,base_price_centavos) values('86000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','Transfer Service',30,10000);
insert into appointments(id,organization_id,branch_id,customer_id,vehicle_id,status,starts_at) values
('96000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','queued',now()+interval '1 day'),
('96000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','queued',now()+interval '2 days'),
('96000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','queued',now()+interval '3 days');
insert into appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) select id,'86000000-0000-4000-8000-000000000001','Transfer Service',10000,30 from appointments where organization_id='26000000-0000-4000-8000-000000000001';
insert into appointment_staff_assignments(organization_id,appointment_id,staff_membership_id) values
('26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000002'),
('26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000002'),
('26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003','36000000-0000-4000-8000-000000000002');
insert into queue_entries(id,organization_id,branch_id,appointment_id,customer_id,vehicle_id,source,queue_date,queue_number,status,estimated_duration_minutes) values
('76000000-0000-4000-8000-000000000001','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','appointment',current_date,1,'waiting',30),
('76000000-0000-4000-8000-000000000002','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','appointment',current_date,2,'waiting',30),
('76000000-0000-4000-8000-000000000003','26000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003','56000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','appointment',current_date,3,'waiting',30);

select plan(12);
set local role authenticated;
set local "request.jwt.claims"='{"sub":"16000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select convert_queue_to_job_with_scheduled_staff('76000000-0000-4000-8000-000000000001',false,null)$$,'conversion without copy succeeds');
select is((select primary_technician_user_id from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000001'),null::uuid,'unchecked conversion does not assign scheduled staff');
select lives_ok($$select convert_queue_to_job_with_scheduled_staff('76000000-0000-4000-8000-000000000002',true,'36000000-0000-4000-8000-000000000002')$$,'explicit scheduled staff copy succeeds');
select is((select primary_technician_user_id from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000002'),'16000000-0000-4000-8000-000000000002'::uuid,'copy initializes the Job Order technician');
reset role;
delete from appointment_staff_assignments where appointment_id='96000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((select primary_technician_user_id from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000002'),'16000000-0000-4000-8000-000000000002'::uuid,'later appointment assignment changes do not alter Job Order staff');
reset role;
insert into appointment_staff_assignments(organization_id,appointment_id,staff_membership_id) values('26000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','36000000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok($$select assign_job((select id from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000002'),null,null)$$,'Job Order technician may be changed independently');
select is((select count(*) from appointment_staff_assignments where appointment_id='96000000-0000-4000-8000-000000000002')::bigint,1::bigint,'Job Order reassignment does not mutate appointment staff');
select is(convert_queue_to_job_with_scheduled_staff('76000000-0000-4000-8000-000000000002',false,null),(select id from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000002'),'retry returns the same Job Order regardless of changed copy intent');
select is((select count(*) from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000002')::bigint,1::bigint,'retry does not duplicate the Job Order');
select throws_ok($$select convert_queue_to_job_with_scheduled_staff('76000000-0000-4000-8000-000000000003',true,'36000000-0000-4000-8000-000000000003')$$,'P0001','The scheduled staff member is no longer available for Job Order assignment','cross-tenant arbitrary membership cannot be copied');
reset role;
update organization_memberships set is_active=false where id='36000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select convert_queue_to_job_with_scheduled_staff('76000000-0000-4000-8000-000000000003',true,'36000000-0000-4000-8000-000000000002')$$,'P0001','The scheduled staff member is no longer available for Job Order assignment','inactive scheduled staff cannot be copied');
select is((select count(*) from job_orders where queue_entry_id='76000000-0000-4000-8000-000000000003')::bigint,0::bigint,'failed staff validation leaves no partial Job Order');

select * from finish();
rollback;
