-- 0051 was already applied locally before review identified that the legacy
-- transition RPC could still start/resume work without creating a session.
-- Keep migration history append-only and make the work-session boundary the
-- only public Start/Resume path.

create or replace function public.start_automotive_job_work_session(
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

  perform public.assert_automotive_job_work_readiness(job_row.id);
  if job_row.status in ('queued','approved') then
    perform public.transition_job_before_work_sessions(job_row.id,'start');
  elsif job_row.status='on_hold' then
    perform public.transition_job_before_work_sessions(job_row.id,'resume');
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

create or replace function public.transition_job(p_job_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; closed_count integer;
begin
  select * into job_row from public.job_orders where id=p_job_id;
  if job_row.id is null
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;
  if p_action in ('start','resume') then
    raise exception 'Start or resume work through technician work tracking';
  end if;
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

revoke all on function public.start_automotive_job_work_session(uuid,uuid),public.transition_job(uuid,text) from public,anon;
grant execute on function public.start_automotive_job_work_session(uuid,uuid),public.transition_job(uuid,text) to authenticated,service_role;
