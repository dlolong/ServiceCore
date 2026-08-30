-- Shared, industry-neutral appointment staff and resource assignments.

create type public.scheduling_resource_type as enum ('bay','station','room','equipment','other');

create table public.scheduling_resources(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  name text not null check(char_length(trim(name)) between 1 and 120),
  resource_type public.scheduling_resource_type not null default 'other',
  capacity integer not null default 1 check(capacity >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,branch_id,name)
);
create index scheduling_resources_org_branch_idx on public.scheduling_resources(organization_id,branch_id,is_active);

create table public.appointment_staff_assignments(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  staff_membership_id uuid not null references public.organization_memberships(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(appointment_id,staff_membership_id)
);
create index appointment_staff_busy_idx on public.appointment_staff_assignments(staff_membership_id,appointment_id);

create table public.appointment_resource_assignments(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  resource_id uuid not null references public.scheduling_resources(id) on delete restrict,
  quantity integer not null default 1 check(quantity >= 1),
  created_at timestamptz not null default now(),
  unique(appointment_id,resource_id)
);
create index appointment_resource_busy_idx on public.appointment_resource_assignments(resource_id,appointment_id);

create function public.validate_scheduling_resource() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.branches b where b.id=new.branch_id and b.organization_id=new.organization_id) then
    raise exception 'Scheduling resource branch mismatch';
  end if;
  return new;
end $$;
create trigger validate_scheduling_resource_row before insert or update on public.scheduling_resources for each row execute function public.validate_scheduling_resource();

alter table public.scheduling_resources enable row level security;
alter table public.appointment_staff_assignments enable row level security;
alter table public.appointment_resource_assignments enable row level security;
create policy scheduling_resources_read on public.scheduling_resources for select to authenticated using(public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create policy scheduling_resources_manage on public.scheduling_resources for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]) and public.can_access_branch(organization_id,branch_id)) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]) and public.can_access_branch(organization_id,branch_id));
create policy appointment_staff_read on public.appointment_staff_assignments for select to authenticated using(public.is_org_member(organization_id) and exists(select 1 from public.appointments a where a.id=appointment_id and public.can_access_branch(organization_id,a.branch_id)));
create policy appointment_resource_read on public.appointment_resource_assignments for select to authenticated using(public.is_org_member(organization_id) and exists(select 1 from public.appointments a where a.id=appointment_id and public.can_access_branch(organization_id,a.branch_id)));
grant select,insert,update on public.scheduling_resources to authenticated;
grant select on public.appointment_staff_assignments,public.appointment_resource_assignments to authenticated;
revoke insert,update,delete on public.appointment_staff_assignments,public.appointment_resource_assignments from authenticated;

create function public.save_appointment_with_assignments(
  p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,
  p_staff_membership_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid;saved_id uuid;service_id uuid;staff_id uuid;requested_resource_id uuid;current_status public.appointment_status;duration integer;service_count integer;requested_end timestamptz;resource_capacity integer;used_capacity integer;
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(branch_org,p_branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  if cardinality(p_staff_membership_ids)<>(select count(distinct value) from unnest(p_staff_membership_ids)value) then raise exception 'Duplicate staff assignment'; end if;
  if cardinality(p_resource_ids)<>(select count(distinct value) from unnest(p_resource_ids)value) then raise exception 'Duplicate resource assignment'; end if;
  select count(*),coalesce(sum(duration_minutes),0) into service_count,duration from public.services where organization_id=branch_org and is_active and id=any(p_service_ids);
  if service_count<>(select count(distinct value) from unnest(p_service_ids)value) or duration<=0 then raise exception 'Selected service is unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  if exists(select 1 from unnest(p_staff_membership_ids)sid where not exists(
    select 1 from public.organization_memberships m where m.id=sid and m.organization_id=branch_org and m.is_active and
      (m.role='owner' or not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id) or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=p_branch_id))
  )) then raise exception 'Staff member is not allowed at this branch'; end if;
  if exists(select 1 from unnest(p_resource_ids)rid where not exists(select 1 from public.scheduling_resources r where r.id=rid and r.organization_id=branch_org and r.branch_id=p_branch_id and r.is_active)) then raise exception 'Scheduling resource is not available at this branch'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointments a where a.organization_id=branch_org and a.branch_id=p_branch_id and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at) then raise exception 'Another appointment overlaps this time'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointment_staff_assignments asa join public.appointments a on a.id=asa.appointment_id where asa.staff_membership_id=any(p_staff_membership_ids) and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at) then raise exception 'A selected staff member is busy'; end if;
  if not p_allow_conflict then
    foreach requested_resource_id in array p_resource_ids loop
      select capacity into resource_capacity from public.scheduling_resources where id=requested_resource_id;
      select coalesce(sum(ara.quantity),0) into used_capacity from public.appointment_resource_assignments ara join public.appointments a on a.id=ara.appointment_id where ara.resource_id=requested_resource_id and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at;
      if used_capacity+1>resource_capacity then raise exception 'Scheduling resource capacity exceeded'; end if;
    end loop;
  end if;
  if p_appointment_id is null then
    insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,internal_note,created_by) values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'requested','internal',p_starts_at,nullif(trim(coalesce(p_customer_note,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),auth.uid()) returning id into saved_id;
  else
    select status into current_status from public.appointments where id=p_appointment_id and organization_id=branch_org for update;
    if current_status not in('requested','confirmed') then raise exception 'This appointment can no longer be edited'; end if;
    update public.appointments set branch_id=p_branch_id,customer_id=p_customer_id,vehicle_id=p_vehicle_id,starts_at=p_starts_at,customer_note=nullif(trim(coalesce(p_customer_note,'')),''),internal_note=nullif(trim(coalesce(p_internal_note,'')),'') where id=p_appointment_id;
    if not found then raise exception 'Appointment not found' using errcode='42501'; end if;
    saved_id:=p_appointment_id;delete from public.appointment_services where appointment_id=saved_id;delete from public.appointment_staff_assignments where appointment_id=saved_id;delete from public.appointment_resource_assignments where appointment_id=saved_id;
  end if;
  foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes)values(saved_id,service_id,'pending',0,1);end loop;
  foreach staff_id in array p_staff_membership_ids loop insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_membership_id)values(branch_org,saved_id,staff_id);end loop;
  foreach requested_resource_id in array p_resource_ids loop insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id)values(branch_org,saved_id,requested_resource_id);end loop;
  return saved_id;
end $$;

grant execute on function public.save_appointment_with_assignments(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) to authenticated;

create or replace function public.save_appointment_with_availability(p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false)
returns uuid language sql security definer set search_path=public,pg_temp as $$select public.save_appointment_with_assignments(p_appointment_id,p_branch_id,p_customer_id,p_vehicle_id,p_service_ids,p_starts_at,'{}','{}',p_customer_note,p_internal_note,p_allow_conflict)$$;
