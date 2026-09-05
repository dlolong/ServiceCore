-- Follow-up hardening for the optional Staff identity boundary. Migration 0055
-- has been applied in local development and remains immutable.

drop function public.list_staff_profiles(uuid);
create function public.list_staff_profiles(p_organization_id uuid)
returns table(
  staff_id uuid, organization_id uuid, membership_id uuid, user_id uuid,
  full_name text, email text, mobile text, job_function text,
  specializations text[], is_active boolean, branch_ids uuid[],
  has_login boolean, system_access_status text, role public.organization_role,
  access_branch_ids uuid[], created_at timestamptz
) language sql stable security definer set search_path=public,pg_temp as $$
  select
    staff.id,
    staff.organization_id,
    staff.membership_id,
    membership.user_id,
    staff.full_name,
    staff.email,
    staff.mobile,
    staff.job_function,
    staff.specializations,
    staff.is_active,
    coalesce((
      select array_agg(assignment.branch_id order by assignment.branch_id)
      from public.staff_profile_branch_assignments assignment
      where assignment.staff_profile_id=staff.id
    ),'{}'::uuid[]),
    membership.id is not null,
    case
      when membership.id is not null and membership.is_active then 'active'
      when membership.id is not null then 'disabled'
      when exists(
        select 1 from public.staff_invitations invitation
        where invitation.staff_profile_id=staff.id and invitation.status='pending'
          and invitation.expires_at>now()
      ) then 'pending'
      else 'none'
    end,
    membership.role,
    coalesce((
      select array_agg(assignment.branch_id order by assignment.branch_id)
      from public.membership_branch_assignments assignment
      where assignment.membership_id=membership.id
    ),'{}'::uuid[]),
    staff.created_at
  from public.organization_staff_profiles staff
  left join public.organization_memberships membership on membership.id=staff.membership_id
  where staff.organization_id=p_organization_id
    and public.has_permission(p_organization_id,'staff.manage')
  order by staff.full_name,staff.id
$$;
revoke all on function public.list_staff_profiles(uuid) from public,anon;
grant execute on function public.list_staff_profiles(uuid) to authenticated;

-- New memberships created after the 0055 backfill retain the historical
-- id=membership_id invariant. A profile-bound pending invitation is excluded
-- because accept_staff_invitation links that already-existing Staff profile.
create function public.initialize_linked_staff_profile()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare login_email text; display_name text;
begin
  select lower(email) into login_email from auth.users where id=new.user_id;
  if exists(
    select 1 from public.staff_invitations invitation
    where invitation.organization_id=new.organization_id
      and invitation.staff_profile_id is not null
      and invitation.status='pending' and invitation.expires_at>now()
      and invitation.email=login_email
  ) then return new; end if;
  select nullif(trim(profile.full_name),'') into display_name from public.profiles profile where profile.id=new.user_id;
  insert into public.organization_staff_profiles(id,membership_id,organization_id,full_name,email,is_active)
    values(new.id,new.id,new.organization_id,coalesce(display_name,login_email,'Staff member'),login_email,true)
    on conflict(membership_id) do nothing;
  return new;
end $$;
create trigger organization_membership_staff_profile_initialize
after insert on public.organization_memberships for each row
execute function public.initialize_linked_staff_profile();

-- Link an accepted login invitation without relying on an ambiguous PL/pgSQL
-- variable/column name. Operational Staff identity survives later access removal.
create or replace function public.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  invite public.staff_invitations;
  saved_membership_id uuid;
  current_email text;
  staff_row public.organization_staff_profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into invite from public.staff_invitations
    where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if invite.id is null or invite.status<>'pending' then raise exception 'Invitation is invalid'; end if;
  if invite.expires_at<=now() then
    update public.staff_invitations set status='expired' where id=invite.id;
    raise exception 'Invitation has expired';
  end if;
  if current_email is distinct from invite.email then
    raise exception 'Invitation email does not match' using errcode='42501';
  end if;
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
    from public.staff_invitation_branches invitation_branch
    where invitation_branch.invitation_id=invite.id;

  if invite.staff_profile_id is null then
    insert into public.organization_staff_profiles(
      id,membership_id,organization_id,full_name,email,is_active
    )
    select saved_membership_id,saved_membership_id,invite.organization_id,
      coalesce(nullif(trim(profile.full_name),''),invite.email),invite.email,true
    from public.profiles profile where profile.id=auth.uid()
    on conflict(membership_id) do update set is_active=true
    returning * into staff_row;
    if staff_row.id is null then
      select * into staff_row from public.organization_staff_profiles
        where membership_id=saved_membership_id;
    end if;
    insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id)
      select staff_row.id,invite.organization_id,invitation_branch.branch_id
      from public.staff_invitation_branches invitation_branch
      where invitation_branch.invitation_id=invite.id on conflict do nothing;
  else
    update public.organization_staff_profiles
      set membership_id=saved_membership_id
      where id=staff_row.id;
  end if;

  update public.staff_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now()
    where id=invite.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(invite.organization_id,auth.uid(),'membership',saved_membership_id,'staff.invitation_accepted',
      jsonb_build_object('role',invite.role,'staffId',coalesce(invite.staff_profile_id,staff_row.id)));
  return invite.organization_id;
end $$;

-- Automotive maintenance scheduling keeps its existing atomic linkage while
-- accepting canonical Staff IDs, including Staff without login access.
create function public.save_maintenance_appointment_with_staff(
  p_maintenance_due_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],
  p_starts_at timestamptz,p_staff_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',
  p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare due_row public.vehicle_maintenance_due; linked public.appointments; saved_id uuid;
begin
  select * into due_row from public.vehicle_maintenance_due where id=p_maintenance_due_id for update;
  if due_row.id is null or due_row.lifecycle_status<>'active'
    or not public.has_org_role(due_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(due_row.organization_id,due_row.branch_id)
  then raise exception 'Maintenance item not found' using errcode='42501'; end if;
  if due_row.organization_id<>(select organization_id from public.branches where id=p_branch_id)
    or due_row.vehicle_id is distinct from p_vehicle_id
    or p_customer_id is distinct from (select customer_id from public.vehicles where id=due_row.vehicle_id and organization_id=due_row.organization_id)
    or not due_row.service_id=any(p_service_ids)
  then raise exception 'Appointment does not match this maintenance item' using errcode='42501'; end if;
  select * into linked from public.appointments where id=due_row.appointment_id;
  if linked.id is not null and public.is_maintenance_appointment_active(linked.status) then return linked.id; end if;

  saved_id:=public.save_appointment_with_staff(null,p_branch_id,p_customer_id,p_vehicle_id,p_service_ids,p_starts_at,
    p_staff_ids,p_resource_ids,p_customer_note,p_internal_note,p_allow_conflict);
  update public.vehicle_maintenance_due set appointment_id=saved_id where id=due_row.id;
  update public.notification_outbox set status='cancelled',cancelled_at=now(),locked_at=null,locked_by=null,
    eligibility_reason='ACTIVE_RELATED_APPOINTMENT'
    where reference_type='vehicle_maintenance_due' and reference_id=due_row.id and status in ('pending','processing');
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(due_row.organization_id,auth.uid(),'vehicle_maintenance_due',due_row.id,'maintenance.appointment_linked',
      jsonb_build_object('appointment_id',saved_id));
  return saved_id;
end $$;
revoke all on function public.save_maintenance_appointment_with_staff(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) from public,anon;
grant execute on function public.save_maintenance_appointment_with_staff(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) to authenticated;

-- Queue conversion delegates the transactional Job creation to the existing
-- boundary, then copies the selected operational Staff identity in that same
-- database transaction. No login is required for the selected Staff profile.
create function public.convert_queue_to_job_with_scheduled_staff_profile(
  p_queue_id uuid,
  p_copy_scheduled_staff boolean default false,
  p_scheduled_staff_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  queue_row public.queue_entries;
  selected_staff public.organization_staff_profiles;
  eligible_count integer;
  created_id uuid;
begin
  select * into queue_row from public.queue_entries where id=p_queue_id for update;
  if queue_row.id is null
    or not public.has_org_role(queue_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(queue_row.organization_id,queue_row.branch_id)
  then raise exception 'Queue entry not found' using errcode='42501'; end if;

  if p_copy_scheduled_staff then
    if p_scheduled_staff_id is null then
      select count(*) into eligible_count
      from public.appointment_staff_assignments assignment
      join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id
      where assignment.appointment_id=queue_row.appointment_id
        and assignment.organization_id=queue_row.organization_id and staff.is_active
        and (not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id)
          or exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id and branch.branch_id=queue_row.branch_id));
      if eligible_count=0 then raise exception 'The scheduled staff member is no longer available for Job Order assignment'; end if;
      if eligible_count>1 then raise exception 'Select which scheduled technician should be assigned'; end if;
      select staff.* into selected_staff
      from public.appointment_staff_assignments assignment
      join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id
      where assignment.appointment_id=queue_row.appointment_id
        and assignment.organization_id=queue_row.organization_id and staff.is_active
        and (not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id)
          or exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id and branch.branch_id=queue_row.branch_id));
    else
      select staff.* into selected_staff
      from public.appointment_staff_assignments assignment
      join public.organization_staff_profiles staff on staff.id=assignment.staff_profile_id
      where assignment.appointment_id=queue_row.appointment_id
        and assignment.organization_id=queue_row.organization_id
        and staff.id=p_scheduled_staff_id and staff.is_active
        and (not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id)
          or exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id and branch.branch_id=queue_row.branch_id));
      if selected_staff.id is null then raise exception 'The scheduled staff member is no longer available for Job Order assignment'; end if;
    end if;
  end if;

  created_id:=public.convert_queue_to_job_with_scheduled_staff(p_queue_id,false,null);
  if p_copy_scheduled_staff then perform public.assign_job_staff(created_id,selected_staff.id,null); end if;
  return created_id;
end $$;
revoke all on function public.convert_queue_to_job_with_scheduled_staff_profile(uuid,boolean,uuid) from public,anon;
grant execute on function public.convert_queue_to_job_with_scheduled_staff_profile(uuid,boolean,uuid) to authenticated;
