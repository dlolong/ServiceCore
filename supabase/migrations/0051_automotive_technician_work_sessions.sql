-- Automotive Job Order work-session ledger. This is operational time only: it
-- never changes payroll, invoice, estimate, or customer billing values.

create table public.automotive_job_order_work_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_order_id uuid not null references public.job_orders(id) on delete restrict,
  technician_user_id uuid not null references auth.users(id) on delete restrict,
  technician_name_snapshot text not null check (char_length(technician_name_snapshot) between 1 and 200),
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  end_reason text check (end_reason is null or end_reason in ('paused','stopped','job_cancelled')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  ended_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and ended_at is null and end_reason is null and ended_by is null)
    or (status <> 'active' and ended_at is not null and end_reason is not null)
  ),
  check (ended_at is null or ended_at >= started_at)
);

-- A technician cannot truthfully be clocked into two Automotive jobs at once.
-- This partial unique index is the final concurrency boundary.
create unique index automotive_work_sessions_one_active_technician_idx
  on public.automotive_job_order_work_sessions(technician_user_id)
  where status = 'active';
create index automotive_work_sessions_job_time_idx
  on public.automotive_job_order_work_sessions(job_order_id, started_at desc);
create index automotive_work_sessions_branch_active_idx
  on public.automotive_job_order_work_sessions(branch_id, started_at desc)
  where status = 'active';

create function public.guard_automotive_work_session_parent()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; membership_row public.organization_memberships;
begin
  select * into job_row from public.job_orders where id=new.job_order_id;
  if job_row.id is null
    or job_row.organization_id is distinct from new.organization_id
    or job_row.branch_id is distinct from new.branch_id
    or not exists(select 1 from public.organizations o where o.id=new.organization_id and o.industry='automotive')
  then raise exception 'Work session does not match its Automotive Job Order'; end if;

  select * into membership_row from public.organization_memberships
    where organization_id=new.organization_id and user_id=new.technician_user_id
      and role='technician' and is_active;
  if membership_row.id is null then raise exception 'Technician is not an active member'; end if;
  if exists(select 1 from public.membership_branch_assignments where membership_id=membership_row.id)
    and not exists(select 1 from public.membership_branch_assignments where membership_id=membership_row.id and branch_id=new.branch_id)
  then raise exception 'The assigned technician cannot access this branch' using errcode='42501'; end if;
  return new;
end $$;

create trigger automotive_work_session_parent_guard
before insert or update of organization_id,branch_id,job_order_id,technician_user_id
on public.automotive_job_order_work_sessions for each row
execute function public.guard_automotive_work_session_parent();

alter table public.automotive_job_order_work_sessions enable row level security;
create policy automotive_work_sessions_select on public.automotive_job_order_work_sessions
for select to authenticated using (
  public.is_org_member(organization_id)
  and public.can_access_branch(organization_id,branch_id)
);

revoke all on public.automotive_job_order_work_sessions from public,anon,authenticated;
grant select on public.automotive_job_order_work_sessions to authenticated;
grant all on public.automotive_job_order_work_sessions to service_role;

create function public.assert_automotive_job_work_readiness(p_job_order_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; current_estimate public.estimates; missing_parts integer;
begin
  select * into job_row from public.job_orders where id=p_job_order_id;
  if job_row.id is null then raise exception 'Job not found' using errcode='42501'; end if;
  if not exists(select 1 from public.job_inspections where job_order_id=job_row.id)
    then raise exception 'Complete the vehicle inspection before work starts'; end if;
  select * into current_estimate from public.estimates where job_order_id=job_row.id order by version desc limit 1;
  if current_estimate.id is null or current_estimate.status<>'approved'
    or current_estimate.authorized_total_centavos is distinct from current_estimate.total_centavos
  then raise exception 'Current customer authorization is required before work starts'; end if;
  select count(*) into missing_parts from public.automotive_job_part_requirements(job_row.id) requirement
  left join public.inventory_reservations reservation on reservation.organization_id=job_row.organization_id
    and reservation.branch_id=job_row.branch_id and reservation.inventory_item_id=requirement.inventory_item_id
    and reservation.reference_type='job_order' and reservation.reference_id=job_row.id
  where coalesce(reservation.quantity_reserved-reservation.quantity_released,0)<requirement.required_quantity;
  if missing_parts>0 then raise exception 'Reserve all required parts before work starts'; end if;
end $$;

create function public.start_automotive_job_work_session(
  p_job_order_id uuid,
  p_technician_user_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  job_row public.job_orders;
  membership_row public.organization_memberships;
  active_row public.automotive_job_order_work_sessions;
  target_technician uuid;
  technician_name text;
  created_id uuid;
begin
  select * into job_row from public.job_orders where id=p_job_order_id for update;
  if job_row.id is null
    or not exists(select 1 from public.organizations o where o.id=job_row.organization_id and o.industry='automotive')
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;

  if public.has_org_role(job_row.organization_id,array['technician']::public.organization_role[]) then
    if p_technician_user_id is not null and p_technician_user_id is distinct from auth.uid()
      then raise exception 'Technicians can only start their own work' using errcode='42501'; end if;
    target_technician:=auth.uid();
  else
    target_technician:=coalesce(p_technician_user_id,job_row.primary_technician_user_id);
  end if;
  if target_technician is null then raise exception 'Assign a technician before starting work'; end if;

  if job_row.primary_technician_user_id is distinct from target_technician
    and not exists(select 1 from public.job_order_items i where i.job_order_id=job_row.id and i.technician_user_id=target_technician)
  then raise exception 'Technician is not assigned to this Job Order' using errcode='42501'; end if;

  select * into membership_row from public.organization_memberships
    where organization_id=job_row.organization_id and user_id=target_technician
      and role='technician' and is_active for update;
  if membership_row.id is null then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  if exists(select 1 from public.membership_branch_assignments where membership_id=membership_row.id)
    and not exists(select 1 from public.membership_branch_assignments where membership_id=membership_row.id and branch_id=job_row.branch_id)
  then raise exception 'The assigned technician cannot access this branch' using errcode='42501'; end if;

  select * into active_row from public.automotive_job_order_work_sessions
    where technician_user_id=target_technician and status='active' for update;
  if active_row.id is not null then
    if active_row.job_order_id=job_row.id then return active_row.id; end if;
    raise exception 'Technician already has an active work session';
  end if;

  -- Every new segment rechecks current readiness. This matters when another
  -- assigned technician joins an already in-progress Job Order after an
  -- estimate revision or reservation change.
  perform public.assert_automotive_job_work_readiness(job_row.id);

  if job_row.status in ('queued','approved') then
    perform public.transition_job(job_row.id,'start');
  elsif job_row.status='on_hold' then
    perform public.transition_job(job_row.id,'resume');
  elsif job_row.status<>'in_progress' then
    raise exception 'This Job Order is not ready for technician work';
  end if;

  select coalesce(nullif(trim(p.full_name),''),'Technician') into technician_name
    from public.profiles p where p.id=target_technician;
  technician_name:=coalesce(technician_name,'Technician');
  insert into public.automotive_job_order_work_sessions(
    organization_id,branch_id,job_order_id,technician_user_id,
    technician_name_snapshot,created_by
  ) values (
    job_row.organization_id,job_row.branch_id,job_row.id,target_technician,
    technician_name,auth.uid()
  ) returning id into created_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(job_row.organization_id,auth.uid(),'automotive_job_order_work_session',created_id,
    'job_order.work_started',jsonb_build_object('jobOrderId',job_row.id,'technicianUserId',target_technician));
  return created_id;
exception when unique_violation then
  select * into active_row from public.automotive_job_order_work_sessions
    where technician_user_id=target_technician and status='active';
  if active_row.job_order_id=p_job_order_id then return active_row.id; end if;
  raise exception 'Technician already has an active work session';
end $$;

create function public.end_automotive_job_work_session(
  p_session_id uuid,
  p_action text,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare session_row public.automotive_job_order_work_sessions; normalized_notes text;
begin
  if p_action not in ('pause','stop') then raise exception 'Invalid work-session action'; end if;
  normalized_notes:=nullif(trim(p_notes),'');
  if char_length(coalesce(normalized_notes,''))>1000 then raise exception 'Work note is too long'; end if;
  select * into session_row from public.automotive_job_order_work_sessions where id=p_session_id for update;
  if session_row.id is null
    or not public.has_org_role(session_row.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(session_row.organization_id,session_row.branch_id)
  then raise exception 'Work session not found' using errcode='42501'; end if;
  if public.has_org_role(session_row.organization_id,array['technician']::public.organization_role[])
    and session_row.technician_user_id is distinct from auth.uid()
  then raise exception 'Work session not found' using errcode='42501'; end if;

  if session_row.status<>'active' then
    if session_row.status='completed'
      and session_row.end_reason=(case when p_action='pause' then 'paused' else 'stopped' end)
      and session_row.notes is not distinct from normalized_notes
    then return session_row.id; end if;
    raise exception 'Work session already ended';
  end if;
  update public.automotive_job_order_work_sessions set
    status='completed',ended_at=clock_timestamp(),ended_by=auth.uid(),
    end_reason=case when p_action='pause' then 'paused' else 'stopped' end,
    notes=normalized_notes,updated_at=now()
  where id=session_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(session_row.organization_id,auth.uid(),'automotive_job_order_work_session',session_row.id,
    case when p_action='pause' then 'job_order.work_paused' else 'job_order.work_stopped' end,
    jsonb_build_object('jobOrderId',session_row.job_order_id,'technicianUserId',session_row.technician_user_id));
  return session_row.id;
end $$;

-- Preserve the current Work Execution state/readiness/finance behavior behind
-- a narrow wrapper which adds only work-session lifecycle protection.
alter function public.transition_job(uuid,text) rename to transition_job_before_work_sessions;
revoke all on function public.transition_job_before_work_sessions(uuid,text) from public,anon,authenticated;
create function public.transition_job(p_job_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; closed_count integer;
begin
  select * into job_row from public.job_orders where id=p_job_id;
  if job_row.id is null
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;
  if p_action='complete' and exists(
    select 1 from public.automotive_job_order_work_sessions where job_order_id=p_job_id and status='active'
  ) then raise exception 'Stop all active work sessions before completing this Job Order'; end if;
  perform public.transition_job_before_work_sessions(p_job_id,p_action);
  if p_action='cancel' then
    update public.automotive_job_order_work_sessions set status='cancelled',ended_at=clock_timestamp(),
      ended_by=auth.uid(),end_reason='job_cancelled',updated_at=now()
    where job_order_id=p_job_id and status='active';
    get diagnostics closed_count=row_count;
    if closed_count>0 then
      insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      values(job_row.organization_id,auth.uid(),'job_order',job_row.id,'job_order.work_sessions_cancelled',
        jsonb_build_object('sessionCount',closed_count));
    end if;
  end if;
end $$;

-- Assignment remains the existing Job Order execution assignment. Add the
-- high-value assignment-change audit without introducing a second model.
alter function public.assign_job(uuid,uuid,timestamptz) rename to assign_job_before_work_tracking;
revoke all on function public.assign_job_before_work_tracking(uuid,uuid,timestamptz) from public,anon,authenticated;
create function public.assign_job(p_job_id uuid,p_technician_id uuid,p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; previous_technician uuid;
begin
  select * into job_row from public.job_orders where id=p_job_id;
  previous_technician:=job_row.primary_technician_user_id;
  perform public.assign_job_before_work_tracking(p_job_id,p_technician_id,p_promised_at);
  if previous_technician is distinct from p_technician_id then
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(job_row.organization_id,auth.uid(),'job_order',p_job_id,'job_order.staff_assignment_changed',
      jsonb_build_object('fromTechnicianUserId',previous_technician,'toTechnicianUserId',p_technician_id));
  end if;
end $$;

revoke all on function public.start_automotive_job_work_session(uuid,uuid),
  public.end_automotive_job_work_session(uuid,text,text),
  public.assert_automotive_job_work_readiness(uuid),
  public.transition_job(uuid,text),public.assign_job(uuid,uuid,timestamptz)
from public,anon;
grant execute on function public.start_automotive_job_work_session(uuid,uuid),
  public.end_automotive_job_work_session(uuid,text,text),
  public.transition_job(uuid,text),public.assign_job(uuid,uuid,timestamptz)
to authenticated;
grant execute on function public.start_automotive_job_work_session(uuid,uuid),
  public.end_automotive_job_work_session(uuid,text,text),
  public.assert_automotive_job_work_readiness(uuid),
  public.transition_job(uuid,text),public.assign_job(uuid,uuid,timestamptz)
to service_role;
