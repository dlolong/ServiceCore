-- A Staff display name is business data. Do not manufacture placeholder names
-- when a linked login has neither a profile name nor an email fallback.

create or replace function public.initialize_linked_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  login_email text;
  display_name text;
begin
  select nullif(lower(trim(email)), '') into login_email
  from auth.users
  where id = new.user_id;

  if exists (
    select 1
    from public.staff_invitations invitation
    where invitation.organization_id = new.organization_id
      and invitation.staff_profile_id is not null
      and invitation.status = 'pending'
      and invitation.expires_at > now()
      and invitation.email = login_email
  ) then
    return new;
  end if;

  select nullif(trim(profile.full_name), '') into display_name
  from public.profiles profile
  where profile.id = new.user_id;
  display_name := coalesce(display_name, login_email);
  if display_name is null then
    raise exception 'Staff full name is required';
  end if;

  insert into public.organization_staff_profiles(
    id,membership_id,organization_id,full_name,email,is_active
  ) values (
    new.id,new.id,new.organization_id,display_name,login_email,true
  )
  on conflict(membership_id) do nothing;
  return new;
end
$$;

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
    nullif(lower(trim(auth_user.email)), '')
  ) into resolved_name
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  where auth_user.id = member.user_id;
  if resolved_name is null then
    raise exception 'Staff full name is required';
  end if;

  insert into public.organization_staff_profiles(
    id,membership_id,organization_id,full_name,job_function,specializations
  ) values (
    member.id,member.id,member.organization_id,resolved_name,
    nullif(trim(coalesce(p_job_function,'')),''),coalesce(p_specializations,'{}')
  )
  on conflict(membership_id) do update
  set job_function = excluded.job_function,
      specializations = excluded.specializations;
end
$$;

