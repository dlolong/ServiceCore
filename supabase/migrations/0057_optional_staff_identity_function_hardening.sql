-- Function-level hardening discovered while validating the applied optional
-- Staff identity migrations. Earlier migrations remain immutable.

-- Management reads preserve pending invitation defaults until login access is
-- linked; membership access becomes authoritative afterward.
create or replace function public.list_staff_profiles(p_organization_id uuid)
returns table(
  staff_id uuid, organization_id uuid, membership_id uuid, user_id uuid,
  full_name text, email text, mobile text, job_function text,
  specializations text[], is_active boolean, branch_ids uuid[],
  has_login boolean, system_access_status text, role public.organization_role,
  access_branch_ids uuid[], created_at timestamptz
) language sql stable security definer set search_path=public,pg_temp as $$
  select
    staff.id,staff.organization_id,staff.membership_id,membership.user_id,
    staff.full_name,staff.email,staff.mobile,staff.job_function,
    staff.specializations,staff.is_active,
    coalesce((select array_agg(assignment.branch_id order by assignment.branch_id)
      from public.staff_profile_branch_assignments assignment
      where assignment.staff_profile_id=staff.id),'{}'::uuid[]),
    membership.id is not null,
    case
      when membership.id is not null and membership.is_active then 'active'
      when membership.id is not null then 'disabled'
      when exists(select 1 from public.staff_invitations invitation
        where invitation.staff_profile_id=staff.id and invitation.status='pending'
          and invitation.expires_at>now()) then 'pending'
      else 'none'
    end,
    coalesce(membership.role,(select invitation.role
      from public.staff_invitations invitation
      where invitation.staff_profile_id=staff.id and invitation.status='pending'
        and invitation.expires_at>now()
      order by invitation.created_at desc limit 1)),
    case when membership.id is not null then coalesce((
      select array_agg(assignment.branch_id order by assignment.branch_id)
      from public.membership_branch_assignments assignment
      where assignment.membership_id=membership.id
    ),'{}'::uuid[]) else coalesce((
      select array_agg(invitation_branch.branch_id order by invitation_branch.branch_id)
      from public.staff_invitations invitation
      join public.staff_invitation_branches invitation_branch on invitation_branch.invitation_id=invitation.id
      where invitation.staff_profile_id=staff.id and invitation.status='pending'
        and invitation.expires_at>now()
        and invitation.id=(select latest.id from public.staff_invitations latest
          where latest.staff_profile_id=staff.id and latest.status='pending'
            and latest.expires_at>now()
          order by latest.created_at desc limit 1)
    ),'{}'::uuid[]) end,
    staff.created_at
  from public.organization_staff_profiles staff
  left join public.organization_memberships membership on membership.id=staff.membership_id
  where staff.organization_id=p_organization_id
    and public.has_permission(p_organization_id,'staff.manage')
  order by staff.full_name,staff.id
$$;

-- SECURITY DEFINER functions use a deliberately restricted search_path, so
-- pgcrypto entry points are explicitly schema-qualified.
create or replace function public.create_staff_invitation(
  p_organization_id uuid,p_email text,p_role public.organization_role,
  p_branch_ids uuid[],p_expires_hours integer default 72
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare
  token text:=encode(extensions.gen_random_bytes(32),'hex');
  invite_id uuid;
  normalized_email text:=lower(trim(p_email));
begin
  if not public.has_permission(p_organization_id,'staff.manage') then raise exception 'Staff management access required' using errcode='42501'; end if;
  if p_role='owner' or normalized_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or p_expires_hours not between 1 and 168 then raise exception 'Invalid invitation'; end if;
  if exists(select 1 from public.organization_memberships membership join auth.users login on login.id=membership.user_id where membership.organization_id=p_organization_id and lower(login.email)=normalized_email) then raise exception 'User is already a member'; end if;
  update public.staff_invitations set status='revoked',revoked_at=now()
    where organization_id=p_organization_id and lower(email)=normalized_email and status='pending';
  insert into public.staff_invitations(organization_id,email,role,token_hash,expires_at,invited_by)
    values(p_organization_id,normalized_email,p_role,encode(extensions.digest(token,'sha256'),'hex'),now()+make_interval(hours=>p_expires_hours),auth.uid())
    returning id into invite_id;
  if coalesce(array_length(p_branch_ids,1),0)>0 then
    if exists(select 1 from unnest(p_branch_ids) branch_id where not exists(select 1 from public.branches branch where branch.id=branch_id and branch.organization_id=p_organization_id and branch.is_active)) then raise exception 'Invalid invitation branch'; end if;
    insert into public.staff_invitation_branches(invitation_id,branch_id)
      select invite_id,branch_id from unnest(p_branch_ids) branch_id;
  end if;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(p_organization_id,auth.uid(),'staff_invitation',invite_id,'staff.invited',jsonb_build_object('email',normalized_email,'role',p_role));
  return token;
end $$;

create or replace function public.create_staff_profile_invitation(
  p_staff_id uuid,p_login_email text,p_role public.organization_role,
  p_branch_ids uuid[],p_expires_hours integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_row public.organization_staff_profiles; token text; token_digest text;
begin
  select * into staff_row from public.organization_staff_profiles where id=p_staff_id for update;
  if staff_row.id is null or not public.has_permission(staff_row.organization_id,'staff.manage')
    then raise exception 'Staff member not found' using errcode='42501'; end if;
  if staff_row.membership_id is not null then raise exception 'Staff member already has system access'; end if;
  update public.staff_invitations set status='revoked',revoked_at=now()
    where staff_profile_id=staff_row.id and status='pending';
  token:=public.create_staff_invitation(staff_row.organization_id,p_login_email,p_role,p_branch_ids,p_expires_hours);
  token_digest:=encode(extensions.digest(token,'sha256'),'hex');
  update public.staff_invitations set staff_profile_id=staff_row.id where token_hash=token_digest;
  return token;
end $$;

create or replace function public.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.staff_invitations; saved_membership_id uuid; current_email text; staff_row public.organization_staff_profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into invite from public.staff_invitations
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if invite.id is null or invite.status<>'pending' then raise exception 'Invitation is invalid'; end if;
  if invite.expires_at<=now() then update public.staff_invitations set status='expired' where id=invite.id; raise exception 'Invitation has expired'; end if;
  if current_email is distinct from invite.email then raise exception 'Invitation email does not match' using errcode='42501'; end if;
  if invite.staff_profile_id is not null then
    select * into staff_row from public.organization_staff_profiles
      where id=invite.staff_profile_id and organization_id=invite.organization_id for update;
    if staff_row.id is null or staff_row.membership_id is not null then raise exception 'Invitation is invalid'; end if;
  end if;
  insert into public.profiles(id) values(auth.uid()) on conflict(id) do nothing;
  insert into public.organization_memberships(organization_id,user_id,role,is_active)
    values(invite.organization_id,auth.uid(),invite.role,true)
    on conflict(organization_id,user_id) do update set role=excluded.role,is_active=true
    returning id into saved_membership_id;
  delete from public.membership_branch_assignments where membership_id=saved_membership_id;
  insert into public.membership_branch_assignments(membership_id,organization_id,branch_id)
    select saved_membership_id,invite.organization_id,invitation_branch.branch_id
    from public.staff_invitation_branches invitation_branch where invitation_branch.invitation_id=invite.id;
  if invite.staff_profile_id is null then
    insert into public.organization_staff_profiles(id,membership_id,organization_id,full_name,email,is_active)
      select saved_membership_id,saved_membership_id,invite.organization_id,
        coalesce(nullif(trim(profile.full_name),''),invite.email),invite.email,true
      from public.profiles profile where profile.id=auth.uid()
      on conflict(membership_id) do update set is_active=true returning * into staff_row;
    if staff_row.id is null then select * into staff_row from public.organization_staff_profiles where membership_id=saved_membership_id; end if;
    insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id)
      select staff_row.id,invite.organization_id,invitation_branch.branch_id
      from public.staff_invitation_branches invitation_branch where invitation_branch.invitation_id=invite.id
      on conflict do nothing;
  else
    update public.organization_staff_profiles set membership_id=saved_membership_id where id=staff_row.id;
  end if;
  update public.staff_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(invite.organization_id,auth.uid(),'membership',saved_membership_id,'staff.invitation_accepted',
      jsonb_build_object('role',invite.role,'staffId',coalesce(invite.staff_profile_id,staff_row.id)));
  return invite.organization_id;
end $$;

