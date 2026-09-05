begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50500000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'new-salon-owner@servicecore.test', '', now(), '{}', '{}', now(), now()),
  ('50500000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'invalid-industry-owner@servicecore.test', '', now(), '{}', '{}', now(), now());

select plan(12);

select isnt(to_regprocedure('public.create_first_organization(text,text,text,text,text,text,text,text,text)')::text, null, 'vertical first-organization RPC exists');
select ok(not has_function_privilege('anon', 'public.create_first_organization(text,text,text,text,text,text,text,text,text)', 'EXECUTE'), 'anonymous cannot create an organization');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"50500000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.create_first_organization(p_name => 'Forged Org', p_industry => 'hospitality', p_business_type => 'salon', p_slug_base => 'forged-org')$$,
  '22023', 'Invalid organization industry',
  'unsupported industries are rejected in the database'
);
select throws_ok(
  $$select public.create_first_organization(p_name => 'Mismatched Org', p_industry => 'salon', p_business_type => 'auto_repair', p_slug_base => 'mismatched-org')$$,
  '22023', 'Business type does not match organization industry',
  'cross-industry business types are rejected in the database'
);
select is((select count(*) from public.organization_memberships where user_id = '50500000-0000-4000-8000-000000000002')::bigint, 0::bigint, 'failed signup leaves no membership');

set local "request.jwt.claims" = '{"sub":"50500000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.create_first_organization(p_name => 'Glow Test Salon', p_industry => 'salon', p_business_type => 'spa', p_slug_base => 'glow-test-salon')$$,
  'Salon organization is created transactionally'
);
select is((select industry from public.organizations where created_by = '50500000-0000-4000-8000-000000000001'), 'salon', 'organization stores the selected industry');
select is((select business_type from public.organizations where created_by = '50500000-0000-4000-8000-000000000001'), 'spa', 'organization stores the matching business type');
select is((select role::text from public.organization_memberships where user_id = '50500000-0000-4000-8000-000000000001'), 'owner', 'owner role is assigned server-side');
select is((select count(*) from public.organization_subscriptions where organization_id = (select id from public.organizations where created_by = '50500000-0000-4000-8000-000000000001'))::bigint, 1::bigint, 'free subscription is created in the same transaction');
select is((select count(*) from public.branches where organization_id = (select id from public.organizations where created_by = '50500000-0000-4000-8000-000000000001'))::bigint, 0::bigint, 'branchless organization remains recoverable through branch setup');
select throws_ok(
  $$select public.create_first_organization(p_name => 'Duplicate Salon', p_industry => 'salon', p_business_type => 'salon', p_slug_base => 'duplicate-salon')$$,
  'P0001', 'User already belongs to an organization',
  'repeat or concurrent-equivalent submission cannot create a second organization'
);

select * from finish();
rollback;
