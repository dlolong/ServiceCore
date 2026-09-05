-- Preserve rolling-client compatibility for Automotive assignments written
-- through the legacy Auth-user columns while Staff profile IDs are canonical.

create or replace function public.save_organization_staff_profile(
  p_membership_id uuid,
  p_job_function text default null,
  p_specializations text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member public.organization_memberships;
  resolved_name text;
begin
  select * into member
  from public.organization_memberships
  where id = p_membership_id
  for update;
  if member.id is null or not public.has_org_role(
    member.organization_id,
    array['owner','manager']::public.organization_role[]
  ) then
    raise exception 'Staff member not found' using errcode = '42501';
  end if;

  select coalesce(
    nullif(trim(profile.full_name), ''),
    nullif(trim(auth_user.email), ''),
    'Staff member'
  ) into resolved_name
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  where auth_user.id = member.user_id;

  insert into public.organization_staff_profiles(
    id,membership_id,organization_id,full_name,job_function,specializations
  ) values (
    member.id,member.id,member.organization_id,coalesce(resolved_name,'Staff member'),
    nullif(trim(coalesce(p_job_function,'')),''),coalesce(p_specializations,'{}')
  )
  on conflict(membership_id) do update
  set job_function = excluded.job_function,
      specializations = excluded.specializations;
end
$$;

create or replace function public.sync_job_order_staff_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  staff_row public.organization_staff_profiles;
  linked_user uuid;
begin
  if new.primary_technician_staff_id is null and new.primary_technician_user_id is not null then
    select staff.* into staff_row
    from public.organization_staff_profiles staff
    join public.organization_memberships membership on membership.id = staff.membership_id
    where staff.organization_id = new.organization_id
      and membership.user_id = new.primary_technician_user_id;

    if staff_row.id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
    new.primary_technician_staff_id := staff_row.id;
  elsif new.primary_technician_staff_id is not null then
    select staff.* into staff_row
    from public.organization_staff_profiles staff
    where staff.id = new.primary_technician_staff_id
      and staff.organization_id = new.organization_id;

    if staff_row.id is null then
      raise exception 'Technician Staff identity mismatch';
    end if;
    select membership.user_id into linked_user
    from public.organization_memberships membership
    where membership.id = staff_row.membership_id;
    new.primary_technician_user_id := linked_user;
  end if;
  return new;
end
$$;

drop trigger if exists job_order_staff_identity_sync on public.job_orders;
create trigger job_order_staff_identity_sync
before insert or update of organization_id, primary_technician_user_id, primary_technician_staff_id
on public.job_orders
for each row execute function public.sync_job_order_staff_identity();

create or replace function public.sync_job_order_item_staff_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  staff_row public.organization_staff_profiles;
  linked_user uuid;
begin
  if new.technician_staff_id is null and new.technician_user_id is not null then
    select staff.* into staff_row
    from public.organization_staff_profiles staff
    join public.organization_memberships membership on membership.id = staff.membership_id
    where staff.organization_id = new.organization_id
      and membership.user_id = new.technician_user_id;

    if staff_row.id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
    new.technician_staff_id := staff_row.id;
  elsif new.technician_staff_id is not null then
    select staff.* into staff_row
    from public.organization_staff_profiles staff
    where staff.id = new.technician_staff_id
      and staff.organization_id = new.organization_id;

    if staff_row.id is null then
      raise exception 'Technician Staff identity mismatch';
    end if;
    select membership.user_id into linked_user
    from public.organization_memberships membership
    where membership.id = staff_row.membership_id;
    new.technician_user_id := linked_user;
  end if;
  return new;
end
$$;

drop trigger if exists job_order_item_staff_identity_sync on public.job_order_items;
create trigger job_order_item_staff_identity_sync
before insert or update of organization_id, technician_user_id, technician_staff_id
on public.job_order_items
for each row execute function public.sync_job_order_item_staff_identity();

create or replace function public.guard_automotive_work_session_parent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_row public.job_orders;
  staff_row public.organization_staff_profiles;
  linked_user uuid;
begin
  select * into job_row from public.job_orders where id = new.job_order_id;

  if new.technician_staff_id is null and new.technician_user_id is not null then
    select staff.* into staff_row
    from public.organization_staff_profiles staff
    join public.organization_memberships membership on membership.id = staff.membership_id
    where staff.organization_id = new.organization_id
      and membership.user_id = new.technician_user_id;
    new.technician_staff_id := staff_row.id;
  else
    select * into staff_row
    from public.organization_staff_profiles
    where id = new.technician_staff_id;
  end if;

  if job_row.id is null or staff_row.id is null
    or job_row.organization_id <> new.organization_id
    or job_row.branch_id <> new.branch_id
    or staff_row.organization_id <> new.organization_id
    or not exists (
      select 1 from public.organizations organization
      where organization.id = new.organization_id
        and organization.industry = 'automotive'
    )
  then
    raise exception 'Work session does not match its Automotive Job Order';
  end if;
  if not staff_row.is_active then
    raise exception 'Technician is inactive';
  end if;
  if exists (
    select 1 from public.staff_profile_branch_assignments branch
    where branch.staff_profile_id = staff_row.id
  ) and not exists (
    select 1 from public.staff_profile_branch_assignments branch
    where branch.staff_profile_id = staff_row.id
      and branch.branch_id = new.branch_id
  ) then
    raise exception 'The assigned technician cannot work at this branch' using errcode = '42501';
  end if;
  if staff_row.membership_id is not null then
    select user_id into linked_user
    from public.organization_memberships
    where id = staff_row.membership_id;
  end if;
  if new.technician_user_id is null then
    new.technician_user_id := linked_user;
  elsif linked_user is distinct from new.technician_user_id then
    raise exception 'Technician Staff identity mismatch';
  end if;
  return new;
end
$$;
