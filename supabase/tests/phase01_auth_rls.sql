begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- Deterministic Phase 00.5 fixtures. The transaction is rolled back by this suite.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-a@karkr.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner-b@karkr.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'staff-a@karkr.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'new-owner@karkr.test', '', now(), '{}', '{}', now(), now());

insert into public.organizations (id, name, slug, created_by)
values
  ('20000000-0000-4000-8000-000000000001', 'Organization A', 'fixture-org-a', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Organization B', 'fixture-org-b', '10000000-0000-4000-8000-000000000002');

insert into public.organization_memberships (id, organization_id, user_id, role)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'advisor');

insert into public.branches (id, organization_id, name, code)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Branch A', 'A'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Branch B', 'B');

insert into public.customers (id, organization_id, full_name)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Customer A'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Customer B');

insert into public.vehicles (id, organization_id, customer_id, plate_number)
values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'AAA 0001'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'BBB 0002');

insert into public.service_categories (id, organization_id, name)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Category A'),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Category B');

insert into public.services (id, organization_id, category_id, name, base_price_centavos)
values
  ('80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'Service A', 10000),
  ('80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', 'Service B', 20000);

insert into public.appointments (id, organization_id, branch_id, customer_id, vehicle_id, status)
values
  ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'confirmed'),
  ('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', 'confirmed');

insert into public.appointment_services (appointment_id, service_id)
values
  ('90000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002');

insert into public.job_orders (id, organization_id, branch_id, customer_id, vehicle_id, appointment_id, status)
values
  ('a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'queued'),
  ('a0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'queued');

insert into public.job_order_items (id, organization_id, job_order_id, service_id, service_name_snapshot, unit_price_centavos, line_total_centavos)
values
  ('a1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Service A', 10000, 10000),
  ('a1000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 'Service B', 20000, 20000);

insert into public.payments (id, organization_id, branch_id, job_order_id, amount_centavos, method, status)
values
  ('b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 10000, 'cash', 'paid'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 20000, 'cash', 'paid');

insert into public.inventory_items (id, organization_id, branch_id, name)
values
  ('c0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Inventory A'),
  ('c0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Inventory B');

insert into public.inventory_movements (id, organization_id, branch_id, inventory_item_id, movement_type, quantity_delta)
values
  ('d0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'stock_in', 1),
  ('d0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'stock_in', 1);

select plan(86);

-- Data API privilege boundaries.
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT'), 'authenticated cannot insert memberships directly');
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE'), 'authenticated cannot change roles directly');
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'DELETE'), 'authenticated cannot delete memberships directly');
select ok(not has_table_privilege('authenticated', 'public.inventory_movements', 'UPDATE'), 'authenticated cannot rewrite inventory movement history');
select ok(not has_table_privilege('authenticated', 'public.inventory_movements', 'DELETE'), 'authenticated cannot delete inventory movement history');
select is(to_regprocedure('public.create_first_organization(text,text,text)')::text, null, 'legacy onboarding RPC is removed');
select isnt(to_regprocedure('public.create_first_organization(text,text,text,text,text,text,text,text)')::text, null, 'business onboarding RPC is installed');

select ok(not has_table_privilege('anon', 'public.organization_memberships', 'SELECT'), 'anonymous cannot read memberships');
select ok(not has_table_privilege('anon', 'public.branches', 'SELECT'), 'anonymous cannot read branches');
select ok(not has_table_privilege('anon', 'public.customers', 'SELECT'), 'anonymous cannot read customers');
select ok(not has_table_privilege('anon', 'public.vehicles', 'SELECT'), 'anonymous cannot read vehicles');
select ok(not has_table_privilege('anon', 'public.services', 'SELECT'), 'anonymous cannot read services');
select ok(not has_table_privilege('anon', 'public.appointments', 'SELECT'), 'anonymous cannot read appointments');
select ok(not has_table_privilege('anon', 'public.job_orders', 'SELECT'), 'anonymous cannot read job orders');
select ok(not has_table_privilege('anon', 'public.payments', 'SELECT'), 'anonymous cannot read payments');
select ok(not has_table_privilege('anon', 'public.inventory_items', 'SELECT'), 'anonymous cannot read inventory');

-- Owner A sees only Organization A rows across the domain.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.organizations)::bigint, 1::bigint, 'Owner A sees one organization');
select is((select count(*) from public.branches)::bigint, 1::bigint, 'Owner A sees only Branch A');
select is((select count(*) from public.customers)::bigint, 1::bigint, 'Owner A sees only Customer A');
select is((select count(*) from public.vehicles)::bigint, 1::bigint, 'Owner A sees only Vehicle A');
select is((select count(*) from public.organization_memberships)::bigint, 2::bigint, 'Owner A sees only Organization A memberships');
select is((select count(*) from public.service_categories)::bigint, 1::bigint, 'Owner A sees only Category A');
select is((select count(*) from public.services)::bigint, 1::bigint, 'Owner A sees only Service A');
select is((select count(*) from public.appointments)::bigint, 1::bigint, 'Owner A sees only Appointment A');
select is((select count(*) from public.appointment_services)::bigint, 1::bigint, 'Owner A sees only Appointment A services');
select is((select count(*) from public.job_orders)::bigint, 1::bigint, 'Owner A sees only Job A');
select is((select count(*) from public.job_order_items)::bigint, 1::bigint, 'Owner A sees only Job A items');
select is((select count(*) from public.payments)::bigint, 1::bigint, 'Owner A sees only Payment A');
select is((select count(*) from public.inventory_items)::bigint, 1::bigint, 'Owner A sees only Inventory A');
select is((select count(*) from public.inventory_movements)::bigint, 1::bigint, 'Owner A sees only Inventory A movements');

-- Owner A cannot insert Organization B rows through RLS.
select throws_ok($$insert into public.branches (organization_id, name) values ('20000000-0000-4000-8000-000000000002', 'Blocked')$$, '42501', 'new row violates row-level security policy for table "branches"', 'Owner A cannot insert Branch B records');
select throws_ok($$insert into public.customers (organization_id, full_name) values ('20000000-0000-4000-8000-000000000002', 'Blocked')$$, '42501', 'new row violates row-level security policy for table "customers"', 'Owner A cannot insert Customer B records');
select throws_ok($$insert into public.vehicles (organization_id, customer_id) values ('20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002')$$, 'P0001', 'Vehicle/customer organization mismatch', 'Owner A cannot insert Vehicle B records');
select throws_ok($$insert into public.service_categories (organization_id, name) values ('20000000-0000-4000-8000-000000000002', 'Blocked')$$, '42501', 'new row violates row-level security policy for table "service_categories"', 'Owner A cannot insert Category B records');
select throws_ok($$insert into public.services (organization_id, category_id, name) values ('20000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', 'Blocked')$$, 'P0001', 'Service/category organization mismatch', 'Owner A cannot insert Service B records');
select throws_ok($$insert into public.appointments (organization_id, branch_id, customer_id, vehicle_id) values ('20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002')$$, '42501', 'Branch access denied', 'Owner A cannot insert Appointment B records');
select throws_ok($$insert into public.job_orders (organization_id, branch_id, customer_id, vehicle_id) values ('20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002')$$, '42501', 'permission denied for table job_orders', 'Owner A cannot directly insert jobs');
select throws_ok($$insert into public.job_order_items (organization_id, job_order_id, service_name_snapshot, unit_price_centavos, line_total_centavos) values ('20000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'Blocked', 0, 0)$$, '42501', 'permission denied for table job_order_items', 'Owner A cannot directly insert job items');
select throws_ok($$insert into public.payments (organization_id, branch_id, amount_centavos, method) values ('20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, 'cash')$$, '42501', 'permission denied for table payments', 'Owner A cannot directly insert payments');
select throws_ok($$insert into public.inventory_items (organization_id, branch_id, name) values ('20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Blocked')$$, 'P0001', 'Inventory branch organization mismatch', 'Owner A cannot insert Inventory B records');
select throws_ok($$insert into public.inventory_movements (organization_id, branch_id, inventory_item_id, movement_type, quantity_delta) values ('20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'stock_in', 1)$$, '42501', 'permission denied for table inventory_movements', 'Owner A cannot directly insert inventory movements');

-- Updates and deletes against Organization B are invisible no-ops, never cross-tenant mutations.
select is_empty($$update public.organizations set name = 'blocked' where id = '20000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Organization B');
select is_empty($$delete from public.organizations where id = '20000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Organization B');
select is_empty($$update public.branches set phone = 'blocked' where id = '40000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Branch B');
select is_empty($$update public.customers set full_name = 'blocked' where id = '50000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Customer B');
select is_empty($$update public.vehicles set color = 'blocked' where id = '60000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Vehicle B');
select is_empty($$update public.services set description = 'blocked' where id = '80000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Service B');
select is_empty($$update public.appointments set customer_note = 'blocked' where id = '90000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Appointment B');
select throws_ok($$update public.job_orders set internal_note = 'blocked' where id = 'a0000000-0000-4000-8000-000000000002'$$, '42501', 'permission denied for table job_orders', 'Owner A cannot directly update jobs');
select throws_ok($$update public.payments set reference = 'blocked' where id = 'b0000000-0000-4000-8000-000000000002'$$, '42501', 'permission denied for table payments', 'Owner A cannot directly update payments');
select is_empty($$update public.inventory_items set name = 'blocked' where id = 'c0000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot update Inventory B');
select is_empty($$delete from public.branches where id = '40000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Branch B');
select is_empty($$delete from public.customers where id = '50000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Customer B');
select is_empty($$delete from public.vehicles where id = '60000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Vehicle B');
select is_empty($$delete from public.services where id = '80000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Service B');
select is_empty($$delete from public.appointments where id = '90000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Appointment B');
select throws_ok($$delete from public.job_orders where id = 'a0000000-0000-4000-8000-000000000002'$$, '42501', 'permission denied for table job_orders', 'Owner A cannot directly delete jobs');
select throws_ok($$delete from public.payments where id = 'b0000000-0000-4000-8000-000000000002'$$, '42501', 'permission denied for table payments', 'Owner A cannot directly delete payments');
select is_empty($$delete from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000002' returning 1$$, 'Owner A cannot delete Inventory B');

-- Owner B has the inverse tenant view.
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.organizations)::bigint, 1::bigint, 'Owner B sees one organization');
select is((select count(*) from public.customers)::bigint, 1::bigint, 'Owner B sees only Customer B');
select is((select count(*) from public.customers where id = '50000000-0000-4000-8000-000000000001')::bigint, 0::bigint, 'Owner B cannot read Customer A');

-- Staff can perform advisor work but cannot perform owner-only organization writes.
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is_empty($$update public.organizations set phone = 'blocked' where id = '20000000-0000-4000-8000-000000000001' returning 1$$, 'advisor cannot update organization settings');
select lives_ok($$insert into public.customers (organization_id, full_name) values ('20000000-0000-4000-8000-000000000001', 'Advisor Customer')$$, 'advisor can perform allowed customer writes');

-- First organization onboarding remains atomic and server-owned.
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok($$select public.create_first_organization('New Shop', 'auto_detailing', 'fixture-new-shop', null, '+63 900 000 0000')$$, 'authenticated user can atomically create a business');
select is((select role::text from public.organization_memberships where user_id = '10000000-0000-4000-8000-000000000004'), 'owner', 'onboarding assigns owner role server-side');
select is((select count(*) from public.branches where organization_id = (select organization_id from public.organization_memberships where user_id = '10000000-0000-4000-8000-000000000004'))::bigint, 0::bigint, 'business onboarding leaves branch setup incomplete');
select is((select count(*) from public.organization_subscriptions where plan_id = 'free')::bigint, 1::bigint, 'onboarding creates the free subscription');
select lives_ok($$select public.create_initial_branch((select organization_id from public.organization_memberships where user_id = '10000000-0000-4000-8000-000000000004'), 'Main Branch', '1 Test Street', 'Pasig', 'Metro Manila')$$, 'owner can atomically create the first branch');
select is((select organization_id from public.branches where name = 'Main Branch'), (select organization_id from public.organization_memberships where user_id = '10000000-0000-4000-8000-000000000004'), 'first branch belongs to the owner organization');
select ok((select is_primary from public.branches where name = 'Main Branch'), 'first branch is primary');
select is((select count(*) from public.audit_events where event_type = 'organization.created' and actor_user_id = '10000000-0000-4000-8000-000000000004')::bigint, 1::bigint, 'business creation is audited');
select is((select count(*) from public.audit_events where event_type = 'branch.created' and actor_user_id = '10000000-0000-4000-8000-000000000004')::bigint, 1::bigint, 'branch creation is audited');
select throws_ok($$select public.create_first_organization('Second Shop', 'other', 'fixture-second-shop')$$, 'P0001', 'User already belongs to an organization', 'business onboarding cannot be repeated');

set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.create_initial_branch('20000000-0000-4000-8000-000000000002', 'Claimed Branch', '1 Attack Street', 'Pasig', 'Metro Manila')$$, '42501', 'Owner access required', 'Owner A cannot create an initial branch for Organization B');

-- Cross-tenant foreign keys are rejected even for privileged SQL paths.
reset role;
select throws_ok($$insert into public.vehicles (organization_id, customer_id) values ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002')$$, 'P0001', 'Vehicle/customer organization mismatch', 'vehicle/customer tenant mismatch is rejected');
select throws_ok($$insert into public.services (organization_id, category_id, name) values ('20000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', 'Mismatch')$$, 'P0001', 'Service/category organization mismatch', 'service/category tenant mismatch is rejected');
select throws_ok($$insert into public.appointments (organization_id, branch_id, customer_id, vehicle_id) values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001')$$, 'P0001', 'Appointment organization mismatch', 'appointment/branch tenant mismatch is rejected');
select throws_ok($$insert into public.appointment_services (appointment_id, service_id) values ('90000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002')$$, 'P0001', 'Appointment/service organization mismatch', 'appointment/service tenant mismatch is rejected');
select throws_ok($$insert into public.job_orders (organization_id, branch_id, customer_id, vehicle_id) values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001')$$, 'P0001', 'Job order organization mismatch', 'job/branch tenant mismatch is rejected');
select throws_ok($$insert into public.job_order_items (organization_id, job_order_id, service_id, service_name_snapshot, unit_price_centavos, line_total_centavos) values ('20000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'Mismatch', 0, 0)$$, 'P0001', 'Job item/service organization mismatch', 'job item/service tenant mismatch is rejected');
select throws_ok($$insert into public.payments (organization_id, branch_id, amount_centavos, method) values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 1, 'cash')$$, 'P0001', 'Payment/branch organization mismatch', 'payment/branch tenant mismatch is rejected');
select throws_ok($$insert into public.inventory_items (organization_id, branch_id, name) values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Mismatch')$$, 'P0001', 'Inventory branch organization mismatch', 'inventory item/branch tenant mismatch is rejected');
select throws_ok($$insert into public.inventory_movements (organization_id, branch_id, inventory_item_id, movement_type, quantity_delta) values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'stock_in', 1)$$, 'P0001', 'Inventory movement organization mismatch', 'inventory movement/item tenant mismatch is rejected');

-- Deactivation removes access immediately.
update public.organization_memberships set is_active = false where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.organizations)::bigint, 0::bigint, 'inactive membership immediately loses organization access');
select is((select count(*) from public.customers)::bigint, 0::bigint, 'inactive membership immediately loses customer access');

select * from finish();
rollback;
