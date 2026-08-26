-- Phase 01: safe user bootstrap and atomic first-organization onboarding.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Membership writes are intentionally unavailable through the Data API until the
-- dedicated staff-management workflow is introduced. Organization creation below
-- is the only Phase 01 path that creates an owner membership.
drop policy if exists memberships_owner_write on public.organization_memberships;
revoke insert, update, delete on public.organization_memberships from authenticated;

create or replace function public.create_first_organization(
  p_name text,
  p_slug text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := trim(p_name);
  normalized_slug text := lower(trim(p_slug));
  normalized_phone text := nullif(trim(coalesce(p_phone, '')), '');
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize onboarding for this user so concurrent requests cannot create two
  -- "first" organizations.
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1 from public.organization_memberships
    where user_id = current_user_id and is_active = true
  ) then
    raise exception 'User already belongs to an organization' using errcode = 'P0001';
  end if;

  if char_length(normalized_name) not between 2 and 120 then
    raise exception 'Business name must contain 2 to 120 characters' using errcode = '22023';
  end if;
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(normalized_slug) > 80 then
    raise exception 'Invalid organization slug' using errcode = '22023';
  end if;
  if normalized_phone is not null and char_length(normalized_phone) > 30 then
    raise exception 'Phone number is too long' using errcode = '22023';
  end if;

  insert into public.profiles (id)
  values (current_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, phone, currency, timezone, created_by)
  values (normalized_name, normalized_slug, normalized_phone, 'PHP', 'Asia/Manila', current_user_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (new_organization_id, current_user_id, 'owner');

  insert into public.branches (organization_id, name, code, timezone)
  values (new_organization_id, 'Main Branch', 'MAIN', 'Asia/Manila');

  insert into public.organization_subscriptions (organization_id, plan_id, status)
  values (new_organization_id, 'free', 'free');

  insert into public.audit_events (organization_id, actor_user_id, entity_type, entity_id, event_type)
  values (new_organization_id, current_user_id, 'organization', new_organization_id, 'organization.created');

  return new_organization_id;
end;
$$;

revoke all on function public.create_first_organization(text, text, text) from public, anon;
grant execute on function public.create_first_organization(text, text, text) to authenticated;
