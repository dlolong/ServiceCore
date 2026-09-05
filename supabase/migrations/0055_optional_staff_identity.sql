-- Operational Staff identity is independent from authentication. Existing
-- linked Staff keep id = membership_id so deployed scheduling identifiers stay
-- stable while new Staff may exist without contact details or login access.

alter table public.organization_staff_profiles
  add column id uuid default gen_random_uuid(),
  add column full_name text,
  add column email text,
  add column mobile text,
  add column is_active boolean not null default true,
  add column created_by uuid references auth.users(id) on delete set null;

update public.organization_staff_profiles staff
set id=staff.membership_id,
    full_name=coalesce(nullif(trim(profile.full_name),''),nullif(trim(auth_user.email),''),'Staff member'),
    email=case when lower(trim(coalesce(auth_user.email,'')))~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then lower(trim(auth_user.email)) end,
    mobile=public.normalize_ph_mobile(profile.phone)
from public.organization_memberships membership
join auth.users auth_user on auth_user.id=membership.user_id
left join public.profiles profile on profile.id=membership.user_id
where membership.id=staff.membership_id;

insert into public.organization_staff_profiles(
  id,membership_id,organization_id,full_name,email,mobile,is_active
)
select membership.id,membership.id,membership.organization_id,
  coalesce(nullif(trim(profile.full_name),''),nullif(trim(auth_user.email),''),'Staff member'),
  case when lower(trim(coalesce(auth_user.email,'')))~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then lower(trim(auth_user.email)) end,
  public.normalize_ph_mobile(profile.phone),membership.is_active
from public.organization_memberships membership
join auth.users auth_user on auth_user.id=membership.user_id
left join public.profiles profile on profile.id=membership.user_id
where not exists(select 1 from public.organization_staff_profiles staff where staff.membership_id=membership.id);

alter table public.organization_staff_profiles
  alter column id set not null,
  alter column full_name set not null,
  drop constraint organization_staff_profiles_pkey,
  drop constraint organization_staff_profiles_membership_id_fkey,
  alter column membership_id drop not null,
  add constraint organization_staff_profiles_pkey primary key(id),
  add constraint organization_staff_profiles_membership_key unique(membership_id),
  add constraint organization_staff_profiles_membership_id_fkey foreign key(membership_id)
    references public.organization_memberships(id) on delete set null,
  add constraint organization_staff_profiles_name_check check(char_length(trim(full_name)) between 1 and 120),
  add constraint organization_staff_profiles_email_check check(
    email is null or (email=lower(trim(email)) and char_length(email)<=254 and email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  add constraint organization_staff_profiles_mobile_check check(
    mobile is null or mobile~'^\+639[0-9]{9}$'
  );

create unique index organization_staff_profiles_org_id_key
  on public.organization_staff_profiles(organization_id,id);
create index organization_staff_profiles_org_active_idx
  on public.organization_staff_profiles(organization_id,is_active,full_name);

create or replace function public.validate_organization_staff_profile()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.full_name:=trim(new.full_name);
  new.email:=case when nullif(trim(coalesce(new.email,'')),'') is null then null else lower(trim(new.email)) end;
  if nullif(trim(coalesce(new.mobile,'')),'') is null then new.mobile:=null;
  else
    new.mobile:=public.normalize_ph_mobile(new.mobile);
    if new.mobile is null then raise exception 'Invalid Staff mobile number'; end if;
  end if;
  if new.membership_id is not null and not exists(
    select 1 from public.organization_memberships membership
    where membership.id=new.membership_id and membership.organization_id=new.organization_id
  ) then raise exception 'Staff profile membership mismatch'; end if;
  if exists(select 1 from unnest(new.specializations) value where char_length(trim(value)) not between 2 and 80)
  then raise exception 'Invalid staff specialization'; end if;
  return new;
end $$;

create table public.staff_profile_branch_assignments(
  staff_profile_id uuid not null references public.organization_staff_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(staff_profile_id,branch_id)
);
create index staff_profile_branches_org_branch_idx
  on public.staff_profile_branch_assignments(organization_id,branch_id,staff_profile_id);

insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id)
select membership_id,organization_id,branch_id from public.membership_branch_assignments
on conflict do nothing;

create function public.validate_staff_profile_branch()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.organization_staff_profiles staff where staff.id=new.staff_profile_id and staff.organization_id=new.organization_id)
    or not exists(select 1 from public.branches branch where branch.id=new.branch_id and branch.organization_id=new.organization_id)
  then raise exception 'Staff branch organization mismatch'; end if;
  return new;
end $$;
create trigger staff_profile_branch_guard before insert or update on public.staff_profile_branch_assignments
for each row execute function public.validate_staff_profile_branch();

alter table public.staff_profile_branch_assignments enable row level security;
create policy staff_profile_branches_read on public.staff_profile_branch_assignments for select to authenticated
using(public.is_org_member(organization_id));
revoke all on public.staff_profile_branch_assignments from public,anon,authenticated;
grant select on public.staff_profile_branch_assignments to authenticated;
grant all on public.staff_profile_branch_assignments to service_role;

-- Existing organization members may use operational directory fields, never
-- Staff contact fields. Management contact/access data is available only from
-- list_staff_profiles below.
revoke select on public.organization_staff_profiles from authenticated;
grant select(id,organization_id,membership_id,full_name,job_function,specializations,is_active,created_at,updated_at)
  on public.organization_staff_profiles to authenticated;

create or replace view public.staff_directory with (security_invoker=true) as
select staff.id staff_id,staff.organization_id,staff.full_name,staff.job_function,staff.specializations,
  staff.is_active,(staff.membership_id is not null) has_login,
  coalesce(array_agg(branches.branch_id order by branches.branch_id)
    filter(where branches.branch_id is not null),'{}'::uuid[]) branch_ids
from public.organization_staff_profiles staff
left join public.staff_profile_branch_assignments branches on branches.staff_profile_id=staff.id
group by staff.id;
revoke all on public.staff_directory from public,anon,authenticated;
grant select on public.staff_directory to authenticated;

alter table public.staff_invitations add column staff_profile_id uuid
  references public.organization_staff_profiles(id) on delete set null;
create unique index staff_invitations_one_pending_profile_idx
  on public.staff_invitations(staff_profile_id) where status='pending' and staff_profile_id is not null;

create or replace function public.list_staff_profiles(p_organization_id uuid)
returns table(
  staff_id uuid,organization_id uuid,membership_id uuid,full_name text,email text,mobile text,
  job_function text,specializations text[],is_active boolean,branch_ids uuid[],has_login boolean,
  system_access_status text,access_role public.organization_role,created_at timestamptz
) language sql stable security definer set search_path=public,pg_temp as $$
  select staff.id,staff.organization_id,staff.membership_id,staff.full_name,staff.email,staff.mobile,
    staff.job_function,staff.specializations,staff.is_active,
    coalesce(array_agg(distinct branch.branch_id order by branch.branch_id)
      filter(where branch.branch_id is not null),'{}'::uuid[]),
    staff.membership_id is not null,
    case when membership.id is not null and membership.is_active then 'active'
      when membership.id is not null then 'disabled'
      when bool_or(invitation.status='pending') then 'pending' else 'none' end,
    membership.role,staff.created_at
  from public.organization_staff_profiles staff
  left join public.organization_memberships membership on membership.id=staff.membership_id
  left join public.staff_profile_branch_assignments branch on branch.staff_profile_id=staff.id
  left join public.staff_invitations invitation on invitation.staff_profile_id=staff.id
  where staff.organization_id=p_organization_id and public.has_permission(p_organization_id,'staff.manage')
  group by staff.id,membership.id
  order by staff.full_name,staff.id
$$;

create or replace function public.save_staff_profile(
  p_staff_id uuid,p_organization_id uuid,p_full_name text,p_email text,p_mobile text,
  p_job_function text,p_specializations text[],p_is_active boolean,p_branch_ids uuid[]
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_row public.organization_staff_profiles; saved_id uuid; normalized_email text; normalized_mobile text;
begin
  if not public.has_permission(p_organization_id,'staff.manage') then raise exception 'Staff management access required' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_full_name,'')),'') is null or char_length(trim(p_full_name))>120 then raise exception 'Staff name is required'; end if;
  normalized_email:=case when nullif(trim(coalesce(p_email,'')),'') is null then null else lower(trim(p_email)) end;
  if normalized_email is not null and (char_length(normalized_email)>254 or normalized_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid Staff email'; end if;
  normalized_mobile:=case when nullif(trim(coalesce(p_mobile,'')),'') is null then null else public.normalize_ph_mobile(p_mobile) end;
  if nullif(trim(coalesce(p_mobile,'')),'') is not null and normalized_mobile is null then raise exception 'Invalid Staff mobile number'; end if;
  if cardinality(coalesce(p_branch_ids,'{}'))<>(select count(distinct value) from unnest(coalesce(p_branch_ids,'{}')) value)
    or exists(select 1 from unnest(coalesce(p_branch_ids,'{}')) branch_id where not exists(
      select 1 from public.branches branch where branch.id=branch_id and branch.organization_id=p_organization_id and branch.is_active
    )) then raise exception 'Invalid Staff branch'; end if;
  if p_staff_id is null then
    insert into public.organization_staff_profiles(organization_id,full_name,email,mobile,job_function,specializations,is_active,created_by)
    values(p_organization_id,trim(p_full_name),normalized_email,normalized_mobile,nullif(trim(coalesce(p_job_function,'')),''),coalesce(p_specializations,'{}'),p_is_active,auth.uid())
    returning id into saved_id;
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type)
    values(p_organization_id,auth.uid(),'staff_profile',saved_id,'staff.created');
  else
    select * into staff_row from public.organization_staff_profiles where id=p_staff_id and organization_id=p_organization_id for update;
    if staff_row.id is null then raise exception 'Staff member not found' using errcode='42501'; end if;
    update public.organization_staff_profiles set full_name=trim(p_full_name),email=normalized_email,mobile=normalized_mobile,
      job_function=nullif(trim(coalesce(p_job_function,'')),''),specializations=coalesce(p_specializations,'{}'),is_active=p_is_active
    where id=staff_row.id;
    saved_id:=staff_row.id;
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(p_organization_id,auth.uid(),'staff_profile',saved_id,case when p_is_active then 'staff.updated' else 'staff.disabled' end,
      jsonb_build_object('previousActive',staff_row.is_active));
  end if;
  delete from public.staff_profile_branch_assignments where staff_profile_id=saved_id;
  insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id)
    select saved_id,p_organization_id,value from unnest(coalesce(p_branch_ids,'{}')) value;
  return saved_id;
end $$;

create or replace function public.create_staff_profile_invitation(
  p_staff_id uuid,p_login_email text,p_role public.organization_role,p_branch_ids uuid[],p_expires_hours integer
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
  token_digest:=encode(digest(token,'sha256'),'hex');
  update public.staff_invitations set staff_profile_id=staff_row.id where token_hash=token_digest;
  return token;
end $$;

create or replace function public.accept_staff_invitation(p_token text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.staff_invitations; membership_id uuid; current_email text; staff_row public.organization_staff_profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into current_email from auth.users where id=auth.uid();
  select * into invite from public.staff_invitations where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if invite.id is null or invite.status<>'pending' then raise exception 'Invitation is invalid'; end if;
  if invite.expires_at<=now() then update public.staff_invitations set status='expired' where id=invite.id; raise exception 'Invitation has expired'; end if;
  if current_email is distinct from invite.email then raise exception 'Invitation email does not match' using errcode='42501'; end if;
  if invite.staff_profile_id is not null then
    select * into staff_row from public.organization_staff_profiles where id=invite.staff_profile_id and organization_id=invite.organization_id for update;
    if staff_row.id is null or staff_row.membership_id is not null then raise exception 'Invitation is invalid'; end if;
  end if;
  insert into public.profiles(id) values(auth.uid()) on conflict(id) do nothing;
  insert into public.organization_memberships(organization_id,user_id,role,is_active)
    values(invite.organization_id,auth.uid(),invite.role,true)
    on conflict(organization_id,user_id) do update set role=excluded.role,is_active=true returning id into membership_id;
  delete from public.membership_branch_assignments where membership_branch_assignments.membership_id=accept_staff_invitation.membership_id;
  insert into public.membership_branch_assignments(membership_id,organization_id,branch_id)
    select membership_id,invite.organization_id,branch_id from public.staff_invitation_branches where invitation_id=invite.id;
  if invite.staff_profile_id is null then
    insert into public.organization_staff_profiles(id,membership_id,organization_id,full_name,email,is_active)
    select membership_id,membership_id,invite.organization_id,
      coalesce(nullif(trim(profile.full_name),''),invite.email),invite.email,true
    from public.profiles profile where profile.id=auth.uid()
    on conflict(membership_id) do update set is_active=true
    returning * into staff_row;
    if staff_row.id is null then select * into staff_row from public.organization_staff_profiles where membership_id=membership_id; end if;
    insert into public.staff_profile_branch_assignments(staff_profile_id,organization_id,branch_id)
      select staff_row.id,invite.organization_id,branch_id from public.staff_invitation_branches where invitation_id=invite.id
      on conflict do nothing;
  else
    update public.organization_staff_profiles set membership_id=membership_id where id=staff_row.id;
  end if;
  update public.staff_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(invite.organization_id,auth.uid(),'membership',membership_id,'staff.invitation_accepted',
    jsonb_build_object('role',invite.role,'staffId',coalesce(invite.staff_profile_id,staff_row.id)));
  return invite.organization_id;
end $$;

create or replace function public.update_staff_profile_access(
  p_staff_id uuid,p_role public.organization_role,p_is_active boolean,p_branch_ids uuid[]
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_row public.organization_staff_profiles;
begin
  select * into staff_row from public.organization_staff_profiles where id=p_staff_id for update;
  if staff_row.id is null or staff_row.membership_id is null or not public.has_permission(staff_row.organization_id,'staff.manage')
    then raise exception 'Staff member not found' using errcode='42501'; end if;
  perform public.update_staff_member(staff_row.membership_id,p_role,p_is_active,p_branch_ids);
end $$;

revoke all on function public.list_staff_profiles(uuid),
  public.save_staff_profile(uuid,uuid,text,text,text,text,text[],boolean,uuid[]),
  public.create_staff_profile_invitation(uuid,text,public.organization_role,uuid[],integer),
  public.update_staff_profile_access(uuid,public.organization_role,boolean,uuid[]) from public,anon;
grant execute on function public.list_staff_profiles(uuid),
  public.save_staff_profile(uuid,uuid,text,text,text,text,text[],boolean,uuid[]),
  public.create_staff_profile_invitation(uuid,text,public.organization_role,uuid[],integer),
  public.update_staff_profile_access(uuid,public.organization_role,boolean,uuid[]) to authenticated;

-- Appointment assignment compatibility. The new Staff profile ID is
-- authoritative; the membership column remains nullable for older clients.
alter table public.appointment_staff_assignments add column staff_profile_id uuid;
update public.appointment_staff_assignments set staff_profile_id=staff_membership_id;
alter table public.appointment_staff_assignments
  drop constraint appointment_staff_assignments_staff_membership_id_fkey,
  alter column staff_membership_id drop not null,
  add constraint appointment_staff_assignments_staff_membership_id_fkey foreign key(staff_membership_id)
    references public.organization_memberships(id) on delete set null,
  alter column staff_profile_id set not null,
  add constraint appointment_staff_assignments_staff_profile_id_fkey foreign key(staff_profile_id)
    references public.organization_staff_profiles(id) on delete restrict,
  add constraint appointment_staff_assignments_appointment_staff_profile_key unique(appointment_id,staff_profile_id);
create index appointment_staff_profile_busy_idx on public.appointment_staff_assignments(staff_profile_id,appointment_id);

create function public.guard_appointment_staff_profile()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare staff_row public.organization_staff_profiles; appointment_org uuid;
begin
  if new.staff_profile_id is null and new.staff_membership_id is not null then
    select * into staff_row from public.organization_staff_profiles where membership_id=new.staff_membership_id;
    new.staff_profile_id:=staff_row.id;
  else select * into staff_row from public.organization_staff_profiles where id=new.staff_profile_id; end if;
  if staff_row.id is null then raise exception 'Staff member not found'; end if;
  if new.staff_membership_id is null then new.staff_membership_id:=staff_row.membership_id;
  elsif staff_row.membership_id is distinct from new.staff_membership_id then raise exception 'Staff assignment identity mismatch'; end if;
  select organization_id into appointment_org from public.appointments where id=new.appointment_id;
  if appointment_org is null or appointment_org<>new.organization_id or staff_row.organization_id<>new.organization_id
    then raise exception 'Appointment Staff organization mismatch'; end if;
  return new;
end $$;
create trigger appointment_staff_profile_guard before insert or update of organization_id,appointment_id,staff_membership_id,staff_profile_id
on public.appointment_staff_assignments for each row execute function public.guard_appointment_staff_profile();

create or replace function public.invalidate_reminders_for_appointment_staff()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_setting('servicecore.suppress_appointment_detail_invalidation',true)='on'
  then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op='UPDATE' and old.appointment_id is not distinct from new.appointment_id
    and old.staff_profile_id is not distinct from new.staff_profile_id then return new; end if;
  if tg_op='INSERT' then perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  elsif tg_op='DELETE' then perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  elsif new.appointment_id is distinct from old.appointment_id then
    perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_STAFF_CHANGED');
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  else perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED'); end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

-- Canonical Staff-profile scheduling persistence. The legacy membership RPC is
-- retained unchanged for rolling clients and linked IDs remain compatible.
create function public.save_appointment_with_staff(
  p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,
  p_staff_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid;saved_id uuid;service_id uuid;staff_id uuid;resource_id uuid;current_status public.appointment_status;
  duration integer;service_count integer;requested_end timestamptz;resource_capacity integer;used_capacity integer;
  old_starts_at timestamptz;old_staff uuid[]:='{}';new_staff uuid[]:='{}';old_treatments jsonb:='[]';new_treatments jsonb:='[]';
  previous_suppression text:=coalesce(current_setting('servicecore.suppress_appointment_detail_invalidation',true),'');
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(branch_org,p_branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  if cardinality(p_staff_ids)<>(select count(distinct value) from unnest(p_staff_ids)value) then raise exception 'Duplicate staff assignment'; end if;
  if cardinality(p_resource_ids)<>(select count(distinct value) from unnest(p_resource_ids)value) then raise exception 'Duplicate resource assignment'; end if;
  select count(*),coalesce(sum(duration_minutes),0) into service_count,duration from public.services where organization_id=branch_org and is_active and id=any(p_service_ids);
  if service_count<>(select count(distinct value) from unnest(p_service_ids)value) or duration<=0 then raise exception 'Selected service is unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  if exists(select 1 from unnest(p_staff_ids)sid where not exists(
    select 1 from public.organization_staff_profiles staff where staff.id=sid and staff.organization_id=branch_org and staff.is_active
      and (not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id)
        or exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff.id and branch.branch_id=p_branch_id))
  )) then raise exception 'Staff member is not allowed at this branch'; end if;
  if exists(select 1 from unnest(p_resource_ids)rid where not exists(select 1 from public.scheduling_resources resource where resource.id=rid and resource.organization_id=branch_org and resource.branch_id=p_branch_id and resource.is_active)) then raise exception 'Scheduling resource is not available at this branch'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointments appointment where appointment.organization_id=branch_org and appointment.branch_id=p_branch_id and appointment.id is distinct from p_appointment_id and appointment.status in('requested','confirmed','checked_in','in_service','queued') and appointment.starts_at<requested_end and appointment.ends_at>p_starts_at) then raise exception 'Another appointment overlaps this time'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointment_staff_assignments assignment join public.appointments appointment on appointment.id=assignment.appointment_id where assignment.staff_profile_id=any(p_staff_ids) and appointment.id is distinct from p_appointment_id and appointment.status in('requested','confirmed','checked_in','in_service','queued') and appointment.starts_at<requested_end and appointment.ends_at>p_starts_at) then raise exception 'A selected staff member is busy'; end if;
  if not p_allow_conflict then foreach resource_id in array p_resource_ids loop
    select capacity into resource_capacity from public.scheduling_resources where id=resource_id;
    select coalesce(sum(assignment.quantity),0) into used_capacity from public.appointment_resource_assignments assignment join public.appointments appointment on appointment.id=assignment.appointment_id where assignment.resource_id=resource_id and appointment.id is distinct from p_appointment_id and appointment.status in('requested','confirmed','checked_in','in_service','queued') and appointment.starts_at<requested_end and appointment.ends_at>p_starts_at;
    if used_capacity+1>resource_capacity then raise exception 'Scheduling resource capacity exceeded'; end if;
  end loop; end if;
  if p_appointment_id is not null then
    select starts_at into old_starts_at from public.appointments where id=p_appointment_id;
    select coalesce(array_agg(staff_profile_id order by staff_profile_id),'{}') into old_staff from public.appointment_staff_assignments where appointment_id=p_appointment_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]') into old_treatments from public.appointment_services where appointment_id=p_appointment_id;
  end if;
  perform set_config('servicecore.suppress_appointment_detail_invalidation','on',true);
  begin
    if p_appointment_id is null then
      insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,internal_note,created_by)
      values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'requested','internal',p_starts_at,nullif(trim(coalesce(p_customer_note,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),auth.uid()) returning id into saved_id;
    else
      select status into current_status from public.appointments where id=p_appointment_id and organization_id=branch_org for update;
      if current_status not in('requested','confirmed') then raise exception 'This appointment can no longer be edited'; end if;
      update public.appointments set branch_id=p_branch_id,customer_id=p_customer_id,vehicle_id=p_vehicle_id,starts_at=p_starts_at,customer_note=nullif(trim(coalesce(p_customer_note,'')),''),internal_note=nullif(trim(coalesce(p_internal_note,'')),'') where id=p_appointment_id;
      if not found then raise exception 'Appointment not found' using errcode='42501'; end if;
      saved_id:=p_appointment_id;
      delete from public.appointment_services where appointment_id=saved_id;
      delete from public.appointment_staff_assignments where appointment_id=saved_id;
      delete from public.appointment_resource_assignments where appointment_id=saved_id;
    end if;
    foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes)values(saved_id,service_id,'pending',0,1);end loop;
    foreach staff_id in array p_staff_ids loop insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_profile_id)values(branch_org,saved_id,staff_id);end loop;
    foreach resource_id in array p_resource_ids loop insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id)values(branch_org,saved_id,resource_id);end loop;
  exception when others then perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);raise; end;
  perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);
  if p_appointment_id is not null then
    select coalesce(array_agg(staff_profile_id order by staff_profile_id),'{}') into new_staff from public.appointment_staff_assignments where appointment_id=saved_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]') into new_treatments from public.appointment_services where appointment_id=saved_id;
    if old_starts_at is not distinct from p_starts_at and (old_staff is distinct from new_staff or old_treatments is distinct from new_treatments)
      then perform public.invalidate_appointment_reminder_generation(saved_id,'APPOINTMENT_DETAILS_CHANGED'); end if;
  end if;
  return saved_id;
end $$;
revoke all on function public.save_appointment_with_staff(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) from public,anon;
grant execute on function public.save_appointment_with_staff(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) to authenticated,service_role;

-- Automotive assignment columns gain Staff-profile identities while legacy
-- Auth-user columns remain as nullable compatibility snapshots.
alter table public.job_orders add column primary_technician_staff_id uuid references public.organization_staff_profiles(id) on delete set null;
alter table public.job_order_items add column technician_staff_id uuid references public.organization_staff_profiles(id) on delete set null;
alter table public.automotive_job_order_work_sessions
  add column technician_staff_id uuid references public.organization_staff_profiles(id) on delete restrict;
update public.job_orders job set primary_technician_staff_id=membership.id
from public.organization_memberships membership where membership.organization_id=job.organization_id and membership.user_id=job.primary_technician_user_id;
update public.job_order_items item set technician_staff_id=membership.id
from public.organization_memberships membership where membership.organization_id=item.organization_id and membership.user_id=item.technician_user_id;
update public.automotive_job_order_work_sessions session set technician_staff_id=membership.id
from public.organization_memberships membership where membership.organization_id=session.organization_id and membership.user_id=session.technician_user_id;
alter table public.automotive_job_order_work_sessions
  alter column technician_staff_id set not null,
  alter column technician_user_id drop not null;
create unique index automotive_work_sessions_one_active_staff_idx
  on public.automotive_job_order_work_sessions(technician_staff_id) where status='active';

drop trigger automotive_work_session_parent_guard on public.automotive_job_order_work_sessions;
create or replace function public.guard_automotive_work_session_parent()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; staff_row public.organization_staff_profiles; linked_user uuid;
begin
  select * into job_row from public.job_orders where id=new.job_order_id;
  select * into staff_row from public.organization_staff_profiles where id=new.technician_staff_id;
  if job_row.id is null or staff_row.id is null or job_row.organization_id<>new.organization_id or job_row.branch_id<>new.branch_id
    or staff_row.organization_id<>new.organization_id or not exists(select 1 from public.organizations organization where organization.id=new.organization_id and organization.industry='automotive')
  then raise exception 'Work session does not match its Automotive Job Order'; end if;
  if not staff_row.is_active then raise exception 'Technician is inactive'; end if;
  if exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff_row.id)
    and not exists(select 1 from public.staff_profile_branch_assignments branch where branch.staff_profile_id=staff_row.id and branch.branch_id=new.branch_id)
  then raise exception 'The assigned technician cannot work at this branch' using errcode='42501'; end if;
  if staff_row.membership_id is not null then select user_id into linked_user from public.organization_memberships where id=staff_row.membership_id; end if;
  if new.technician_user_id is null then new.technician_user_id:=linked_user;
  elsif linked_user is distinct from new.technician_user_id then raise exception 'Technician Staff identity mismatch'; end if;
  return new;
end $$;
create trigger automotive_work_session_parent_guard
before insert or update of organization_id,branch_id,job_order_id,technician_user_id,technician_staff_id
on public.automotive_job_order_work_sessions for each row execute function public.guard_automotive_work_session_parent();

create or replace function public.assign_job_staff(p_job_id uuid,p_staff_id uuid,p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; staff_row public.organization_staff_profiles; linked_user uuid; previous_staff uuid;
begin
  select * into job_row from public.job_orders where id=p_job_id for update;
  if job_row.id is null or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
    then raise exception 'Job not found' using errcode='42501'; end if;
  previous_staff:=job_row.primary_technician_staff_id;
  if p_staff_id is not null then
    select * into staff_row from public.organization_staff_profiles where id=p_staff_id and organization_id=job_row.organization_id and is_active;
    if staff_row.id is null or (exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff_row.id)
      and not exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff_row.id and branch_id=job_row.branch_id))
      then raise exception 'Technician is not available for this branch' using errcode='42501'; end if;
    select user_id into linked_user from public.organization_memberships where id=staff_row.membership_id;
  end if;
  update public.job_orders set primary_technician_staff_id=p_staff_id,primary_technician_user_id=linked_user,promised_at=p_promised_at,
    technician_assigned_at=case when p_staff_id is null then null when primary_technician_staff_id is distinct from p_staff_id then now() else technician_assigned_at end
  where id=job_row.id;
  if previous_staff is distinct from p_staff_id then
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(job_row.organization_id,auth.uid(),'job_order',job_row.id,'job_order.staff_assignment_changed',jsonb_build_object('fromStaffId',previous_staff,'toStaffId',p_staff_id));
  end if;
end $$;

create or replace function public.assign_job_item_staff(p_item_id uuid,p_staff_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item_row public.job_order_items; job_row public.job_orders; staff_row public.organization_staff_profiles; linked_user uuid;
begin
  select * into item_row from public.job_order_items where id=p_item_id for update;
  select * into job_row from public.job_orders where id=item_row.job_order_id;
  if item_row.id is null or job_row.id is null or not public.has_org_role(item_row.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
    then raise exception 'Job item not found' using errcode='42501'; end if;
  if p_staff_id is not null then
    select * into staff_row from public.organization_staff_profiles where id=p_staff_id and organization_id=item_row.organization_id and is_active;
    if staff_row.id is null or (exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff_row.id)
      and not exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=staff_row.id and branch_id=job_row.branch_id))
      then raise exception 'Technician is not available for this branch' using errcode='42501'; end if;
    select user_id into linked_user from public.organization_memberships where id=staff_row.membership_id;
  end if;
  update public.job_order_items set technician_staff_id=p_staff_id,technician_user_id=linked_user,
    technician_assigned_at=case when p_staff_id is null then null when technician_staff_id is distinct from p_staff_id then now() else technician_assigned_at end where id=item_row.id;
end $$;

create or replace function public.assign_job(p_job_id uuid,p_technician_id uuid,p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_id uuid;
begin
  if p_technician_id is not null then
    select staff.id into staff_id from public.organization_staff_profiles staff join public.organization_memberships membership on membership.id=staff.membership_id
    join public.job_orders job on job.id=p_job_id and job.organization_id=staff.organization_id where membership.user_id=p_technician_id;
    if staff_id is null then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  end if;
  perform public.assign_job_staff(p_job_id,staff_id,p_promised_at);
end $$;
create or replace function public.assign_job_item(p_item_id uuid,p_technician_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_id uuid;
begin
  if p_technician_id is not null then
    select staff.id into staff_id from public.organization_staff_profiles staff join public.organization_memberships membership on membership.id=staff.membership_id
    join public.job_order_items item on item.id=p_item_id and item.organization_id=staff.organization_id where membership.user_id=p_technician_id;
    if staff_id is null then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  end if;
  perform public.assign_job_item_staff(p_item_id,staff_id);
end $$;

create or replace function public.start_automotive_staff_work_session(p_job_order_id uuid,p_staff_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders;staff_row public.organization_staff_profiles;membership_row public.organization_memberships;
  active_row public.automotive_job_order_work_sessions;target_staff uuid;linked_user uuid;created_id uuid;
begin
  select * into job_row from public.job_orders where id=p_job_order_id for update;
  if job_row.id is null or not exists(select 1 from public.organizations organization where organization.id=job_row.organization_id and organization.industry='automotive')
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;
  if public.has_org_role(job_row.organization_id,array['technician']::public.organization_role[]) then
    select staff.* into staff_row from public.organization_staff_profiles staff join public.organization_memberships membership on membership.id=staff.membership_id
      where staff.organization_id=job_row.organization_id and membership.user_id=auth.uid() and membership.is_active for update of staff;
    if staff_row.id is null or (p_staff_id is not null and p_staff_id<>staff_row.id) then raise exception 'Technicians can only start their own work' using errcode='42501'; end if;
    target_staff:=staff_row.id;
  else target_staff:=coalesce(p_staff_id,job_row.primary_technician_staff_id); end if;
  if target_staff is null then raise exception 'Assign a technician before starting work'; end if;
  select * into staff_row from public.organization_staff_profiles where id=target_staff and organization_id=job_row.organization_id and is_active for update;
  if staff_row.id is null then raise exception 'Technician is inactive' using errcode='42501'; end if;
  if job_row.primary_technician_staff_id is distinct from target_staff and not exists(select 1 from public.job_order_items item where item.job_order_id=job_row.id and item.technician_staff_id=target_staff)
    then raise exception 'Technician is not assigned to this Job Order' using errcode='42501'; end if;
  if exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=target_staff)
    and not exists(select 1 from public.staff_profile_branch_assignments where staff_profile_id=target_staff and branch_id=job_row.branch_id)
    then raise exception 'The assigned technician cannot work at this branch' using errcode='42501'; end if;
  select user_id into linked_user from public.organization_memberships where id=staff_row.membership_id;
  select * into active_row from public.automotive_job_order_work_sessions where technician_staff_id=target_staff and status='active' for update;
  if active_row.id is not null then if active_row.job_order_id=job_row.id then return active_row.id; end if;raise exception 'Technician already has an active work session';end if;
  perform public.assert_automotive_job_work_readiness(job_row.id);
  if job_row.status in('queued','approved') then perform public.transition_job_before_work_sessions(job_row.id,'start');
  elsif job_row.status='on_hold' then perform public.transition_job_before_work_sessions(job_row.id,'resume');
  elsif job_row.status<>'in_progress' then raise exception 'This Job Order is not ready for technician work'; end if;
  insert into public.automotive_job_order_work_sessions(organization_id,branch_id,job_order_id,technician_staff_id,technician_user_id,technician_name_snapshot,created_by)
  values(job_row.organization_id,job_row.branch_id,job_row.id,target_staff,linked_user,staff_row.full_name,auth.uid()) returning id into created_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(job_row.organization_id,auth.uid(),'automotive_job_order_work_session',created_id,'job_order.work_started',jsonb_build_object('jobOrderId',job_row.id,'staffId',target_staff));
  return created_id;
exception when unique_violation then
  select * into active_row from public.automotive_job_order_work_sessions where technician_staff_id=target_staff and status='active';
  if active_row.job_order_id=p_job_order_id then return active_row.id; end if;raise exception 'Technician already has an active work session';
end $$;

create or replace function public.start_automotive_job_work_session(p_job_order_id uuid,p_technician_user_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare staff_id uuid;
begin
  if p_technician_user_id is not null then
    select staff.id into staff_id from public.organization_staff_profiles staff join public.organization_memberships membership on membership.id=staff.membership_id
      join public.job_orders job on job.id=p_job_order_id and job.organization_id=staff.organization_id where membership.user_id=p_technician_user_id;
  end if;
  return public.start_automotive_staff_work_session(p_job_order_id,staff_id);
end $$;

drop policy automotive_work_sessions_select on public.automotive_job_order_work_sessions;
create policy automotive_work_sessions_select on public.automotive_job_order_work_sessions for select to authenticated using(
  public.can_access_branch(organization_id,branch_id) and (
    public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])
    or exists(select 1 from public.organization_staff_profiles staff join public.organization_memberships membership on membership.id=staff.membership_id
      where staff.id=technician_staff_id and membership.user_id=auth.uid() and membership.is_active)
  )
);

alter table public.vehicle_service_records
  add column primary_technician_staff_id uuid references public.organization_staff_profiles(id) on delete set null,
  add column primary_technician_name_snapshot text;
alter table public.vehicle_service_record_items
  add column technician_staff_id uuid references public.organization_staff_profiles(id) on delete set null,
  add column technician_name_snapshot text;
update public.vehicle_service_records record set primary_technician_staff_id=job.primary_technician_staff_id,
  primary_technician_name_snapshot=staff.full_name
from public.job_orders job left join public.organization_staff_profiles staff on staff.id=job.primary_technician_staff_id
where job.id=record.source_job_order_id;
update public.vehicle_service_record_items record_item set technician_staff_id=item.technician_staff_id,
  technician_name_snapshot=staff.full_name
from public.job_order_items item left join public.organization_staff_profiles staff on staff.id=item.technician_staff_id
where item.id=record_item.source_job_order_item_id;

create function public.snapshot_service_record_staff()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_table_name='vehicle_service_records' then
    select job.primary_technician_staff_id,staff.full_name into new.primary_technician_staff_id,new.primary_technician_name_snapshot
    from public.job_orders job left join public.organization_staff_profiles staff on staff.id=job.primary_technician_staff_id where job.id=new.source_job_order_id;
  else
    select item.technician_staff_id,staff.full_name into new.technician_staff_id,new.technician_name_snapshot
    from public.job_order_items item left join public.organization_staff_profiles staff on staff.id=item.technician_staff_id where item.id=new.source_job_order_item_id;
  end if;
  return new;
end $$;
create trigger vehicle_service_record_staff_snapshot before insert on public.vehicle_service_records
for each row execute function public.snapshot_service_record_staff();
create trigger vehicle_service_record_item_staff_snapshot before insert on public.vehicle_service_record_items
for each row execute function public.snapshot_service_record_staff();

revoke all on function public.assign_job_staff(uuid,uuid,timestamptz),public.assign_job_item_staff(uuid,uuid),
  public.start_automotive_staff_work_session(uuid,uuid) from public,anon;
grant execute on function public.assign_job_staff(uuid,uuid,timestamptz),public.assign_job_item_staff(uuid,uuid),
  public.start_automotive_staff_work_session(uuid,uuid) to authenticated,service_role;

comment on table public.organization_staff_profiles is
  'Canonical operational Staff profiles. Optional membership links grant login access; contact and employment state remain independent.';
