-- Phase 01 completion: split business and first-branch onboarding into two
-- authorization-safe, transactional steps. Earlier migrations remain unchanged.

alter table public.organizations
  add column business_type text,
  add column email text,
  add column website text,
  add column facebook_page text;

alter table public.organizations
  add constraint organizations_business_type_check check (
    business_type is null or business_type in (
      'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
      'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
      'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other'
    )
  ),
  add constraint organizations_email_length_check check (email is null or char_length(email) <= 254),
  add constraint organizations_website_length_check check (website is null or char_length(website) <= 500),
  add constraint organizations_facebook_length_check check (facebook_page is null or char_length(facebook_page) <= 500);

alter table public.branches
  add column country text not null default 'Philippines',
  add column barangay text,
  add column opening_notes text,
  add column is_primary boolean not null default false;

update public.branches branch
set is_primary = true
where branch.id = (
  select candidate.id
  from public.branches candidate
  where candidate.organization_id = branch.organization_id
    and candidate.is_active = true
  order by candidate.created_at, candidate.id
  limit 1
);

create unique index branches_one_primary_per_organization_idx
  on public.branches (organization_id)
  where is_primary = true;

-- Remove the earlier all-in-one onboarding entry point. The replacement below
-- deliberately does not create a placeholder branch.
drop function public.create_first_organization(text, text, text);

create function public.create_first_organization(
  p_name text,
  p_business_type text,
  p_slug_base text,
  p_legal_name text default null,
  p_phone text default null,
  p_email text default null,
  p_website text default null,
  p_facebook_page text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(p_name);
  normalized_type text := trim(p_business_type);
  normalized_slug text := lower(trim(p_slug_base));
  candidate_slug text;
  suffix integer := 1;
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1 from public.organization_memberships
    where user_id = current_user_id and is_active = true
  ) then
    raise exception 'User already belongs to an organization' using errcode = 'P0001';
  end if;

  if char_length(normalized_name) not between 2 and 120 then
    raise exception 'Invalid business name' using errcode = '22023';
  end if;
  if normalized_type not in (
    'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
    'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
    'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other'
  ) then
    raise exception 'Invalid business type' using errcode = '22023';
  end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(normalized_slug) > 70 then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if char_length(coalesce(p_legal_name, '')) > 120
    or char_length(coalesce(p_phone, '')) > 30
    or char_length(coalesce(p_email, '')) > 254
    or char_length(coalesce(p_website, '')) > 500
    or char_length(coalesce(p_facebook_page, '')) > 500 then
    raise exception 'Invalid optional business details' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('servicecore:organization-slug', 0));
  loop
    candidate_slug := case when suffix = 1 then normalized_slug else normalized_slug || '-' || suffix::text end;
    exit when not exists (select 1 from public.organizations where slug = candidate_slug);
    suffix := suffix + 1;
  end loop;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (
    name, business_type, slug, legal_name, phone, email, website,
    facebook_page, currency, timezone, created_by
  ) values (
    normalized_name,
    normalized_type,
    candidate_slug,
    nullif(trim(coalesce(p_legal_name, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_facebook_page, '')), ''),
    'PHP',
    'Asia/Manila',
    current_user_id
  ) returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner');

  insert into public.organization_subscriptions (organization_id, plan_id, status)
  values (new_organization_id, 'free', 'free');

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, event_type
  ) values (
    new_organization_id, current_user_id, 'organization',
    new_organization_id, 'organization.created'
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_first_organization(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_first_organization(text, text, text, text, text, text, text, text) to authenticated;

create function public.create_initial_branch(
  p_organization_id uuid,
  p_name text,
  p_address_line text,
  p_city text,
  p_province text,
  p_country text default 'Philippines',
  p_barangay text default null,
  p_postal_code text default null,
  p_phone text default null,
  p_email text default null,
  p_opening_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  new_branch_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));

  if not exists (
    select 1 from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = current_user_id
      and role = 'owner'
      and is_active = true
  ) then
    raise exception 'Owner access required' using errcode = '42501';
  end if;

  if exists (select 1 from public.branches where organization_id = p_organization_id) then
    raise exception 'Organization already has a branch' using errcode = 'P0001';
  end if;

  if char_length(trim(p_name)) not between 2 and 120
    or char_length(trim(p_address_line)) not between 2 and 200
    or char_length(trim(p_city)) not between 2 and 120
    or char_length(trim(p_province)) not between 2 and 120
    or char_length(trim(p_country)) not between 2 and 120 then
    raise exception 'Invalid branch details' using errcode = '22023';
  end if;
  if char_length(coalesce(p_barangay, '')) > 120
    or char_length(coalesce(p_postal_code, '')) > 20
    or char_length(coalesce(p_phone, '')) > 30
    or char_length(coalesce(p_email, '')) > 254
    or char_length(coalesce(p_opening_notes, '')) > 500 then
    raise exception 'Invalid optional branch details' using errcode = '22023';
  end if;

  insert into public.branches (
    organization_id, name, code, phone, email, address_line, barangay,
    city, province, postal_code, country, opening_notes, timezone,
    is_primary, is_active
  ) values (
    p_organization_id,
    trim(p_name),
    'MAIN',
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    trim(p_address_line),
    nullif(trim(coalesce(p_barangay, '')), ''),
    trim(p_city),
    trim(p_province),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    trim(p_country),
    nullif(trim(coalesce(p_opening_notes, '')), ''),
    'Asia/Manila',
    true,
    true
  ) returning id into new_branch_id;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, event_type
  ) values (
    p_organization_id, current_user_id, 'branch', new_branch_id,
    'branch.created'
  );

  return new_branch_id;
end;
$$;

revoke all on function public.create_initial_branch(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_initial_branch(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
