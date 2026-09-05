-- Vertical-aware first-business onboarding. The application-owned Automotive-
-- only signature is replaced by one explicit, allowlisted industry contract.
-- It enforces the industry/business-type pairing in the
-- same transaction that creates the owner membership and free subscription.

alter table public.organizations
  drop constraint organizations_business_type_check;

alter table public.organizations
  add constraint organizations_business_type_check check (
    business_type is null or business_type in (
      'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
      'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
      'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other',
      'salon', 'spa', 'facial_clinic', 'nail_salon', 'barber_shop',
      'other_beauty'
    )
  );

drop function public.create_first_organization(text, text, text, text, text, text, text, text);

create function public.create_first_organization(
  p_name text,
  p_industry text,
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
  normalized_industry text := lower(trim(p_industry));
  normalized_type text := trim(p_business_type);
  normalized_slug text := lower(trim(p_slug_base));
  candidate_slug text;
  suffix integer := 1;
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Concurrent submissions for the same user serialize before membership is
  -- checked, so only one first organization can be created.
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
  if normalized_industry not in ('automotive', 'salon') then
    raise exception 'Invalid organization industry' using errcode = '22023';
  end if;
  if (normalized_industry = 'automotive' and normalized_type not in (
      'car_wash', 'auto_detailing', 'car_wash_detailing', 'auto_repair',
      'pms_maintenance', 'tire_shop', 'battery_shop', 'auto_aircon',
      'ceramic_coating', 'tint_ppf', 'full_auto_service', 'other'
    )) or (normalized_industry = 'salon' and normalized_type not in (
      'salon', 'spa', 'facial_clinic', 'nail_salon', 'barber_shop', 'other_beauty'
    )) then
    raise exception 'Business type does not match organization industry' using errcode = '22023';
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
    name, industry, business_type, slug, legal_name, phone, email, website,
    facebook_page, currency, timezone, created_by
  ) values (
    normalized_name,
    normalized_industry,
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
    organization_id, actor_user_id, entity_type, entity_id, event_type,
    metadata
  ) values (
    new_organization_id, current_user_id, 'organization',
    new_organization_id, 'organization.created',
    jsonb_build_object('industry', normalized_industry, 'business_type', normalized_type)
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_first_organization(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_first_organization(text, text, text, text, text, text, text, text, text) to authenticated;

comment on function public.create_first_organization(text, text, text, text, text, text, text, text, text) is
  'Creates the authenticated user first organization, owner membership, and subscription with a validated product industry.';
