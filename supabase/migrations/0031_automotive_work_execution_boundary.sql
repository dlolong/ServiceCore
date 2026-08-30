-- Harden the automotive work-execution persistence boundary while preserving
-- the existing transactional RPCs and status values.

create or replace function public.convert_queue_to_job(p_queue_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.queue_entries; a public.appointments; v public.vehicles; existing_id uuid; created_id uuid; next_no bigint; yr integer;
begin
  select * into q from public.queue_entries where id=p_queue_id for update;
  if q.id is null or not public.has_org_role(q.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(q.organization_id,q.branch_id) then
    raise exception 'Queue entry not found' using errcode='42501';
  end if;
  select id into existing_id from public.job_orders where queue_entry_id=q.id;
  if existing_id is not null then return existing_id; end if;
  if q.vehicle_id is null then raise exception 'A vehicle is required before this appointment can be converted into a job order'; end if;
  if q.status not in ('waiting','called','ready') then raise exception 'Queue entry cannot start a job'; end if;
  select * into v from public.vehicles where id=q.vehicle_id and organization_id=q.organization_id and customer_id=q.customer_id and not is_archived;
  if v.id is null then raise exception 'Vehicle not found'; end if;
  select * into a from public.appointments where id=q.appointment_id and organization_id=q.organization_id and branch_id=q.branch_id and customer_id=q.customer_id and vehicle_id=q.vehicle_id;
  if a.id is null then raise exception 'Appointment is not valid for this automotive job order'; end if;
  yr:=extract(year from now() at time zone 'Asia/Manila');
  insert into public.job_number_counters(branch_id,number_year,last_number) values(q.branch_id,yr,1)
    on conflict(branch_id,number_year) do update set last_number=public.job_number_counters.last_number+1 returning last_number into next_no;
  insert into public.job_orders(organization_id,branch_id,customer_id,vehicle_id,appointment_id,queue_entry_id,job_number,status,customer_concern,advisor_user_id,created_by)
  values(q.organization_id,q.branch_id,q.customer_id,q.vehicle_id,q.appointment_id,q.id,next_no,'queued',a.customer_note,auth.uid(),auth.uid()) returning id into created_id;
  insert into public.job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes)
  select q.organization_id,created_id,service_id,service_name_snapshot,1,unit_price_centavos,unit_price_centavos,duration_minutes from public.appointment_services where appointment_id=q.appointment_id;
  update public.queue_entries set status='converted_to_job' where id=q.id;
  return created_id;
end $$;

create or replace function public.transition_job(p_job_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; target public.job_status;
begin
  select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor','technician']::public.organization_role[]) or not public.can_access_branch(j.organization_id,j.branch_id) then raise exception 'Job not found' using errcode='42501'; end if;
  if public.has_org_role(j.organization_id,array['technician']::public.organization_role[]) and j.primary_technician_user_id<>auth.uid() then raise exception 'Job not assigned' using errcode='42501'; end if;
  target:=case when p_action='start' and j.status in ('queued','approved') then 'in_progress' when p_action='hold' and j.status='in_progress' then 'on_hold' when p_action='resume' and j.status='on_hold' then 'in_progress' when p_action='quality_check' and j.status='in_progress' then 'quality_check' when p_action='ready' and j.status='quality_check' then 'ready_for_release' when p_action='complete' and j.status in ('ready','ready_for_release') then 'completed' when p_action='cancel' and j.status in ('draft','queued') then 'cancelled' else null end;
  if target is null then raise exception 'This job order status transition is not allowed'; end if;
  update public.job_orders set status=target,started_at=case when target='in_progress' and started_at is null then now() else started_at end,completed_at=case when target='completed' then now() else completed_at end where id=j.id;
end $$;

create or replace function public.assign_job(p_job_id uuid,p_technician_id uuid,p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; technician_membership public.organization_memberships;
begin
  select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(j.organization_id,j.branch_id) then raise exception 'Job not found' using errcode='42501'; end if;
  if p_technician_id is not null then
    select * into technician_membership from public.organization_memberships where organization_id=j.organization_id and user_id=p_technician_id and is_active and role='technician';
    if technician_membership.id is null then raise exception 'Technician is not an active member' using errcode='42501'; end if;
    if exists(select 1 from public.membership_branch_assignments where membership_id=technician_membership.id) and not exists(select 1 from public.membership_branch_assignments where membership_id=technician_membership.id and branch_id=j.branch_id) then
      raise exception 'The assigned technician cannot access this branch' using errcode='42501';
    end if;
  end if;
  update public.job_orders set primary_technician_user_id=p_technician_id,promised_at=p_promised_at,
    technician_assigned_at=case when p_technician_id is null then null when primary_technician_user_id is distinct from p_technician_id then now() else technician_assigned_at end where id=j.id;
end $$;

create or replace function public.assign_job_item(p_item_id uuid,p_technician_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.job_order_items; j public.job_orders; technician_membership public.organization_memberships;
begin
  select * into item from public.job_order_items where id=p_item_id for update;
  select * into j from public.job_orders where id=item.job_order_id;
  if item.id is null or j.id is null or not public.has_org_role(item.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(j.organization_id,j.branch_id) then raise exception 'Job item not found' using errcode='42501'; end if;
  if p_technician_id is not null then
    select * into technician_membership from public.organization_memberships where organization_id=item.organization_id and user_id=p_technician_id and is_active and role='technician';
    if technician_membership.id is null then raise exception 'Technician is not an active member' using errcode='42501'; end if;
    if exists(select 1 from public.membership_branch_assignments where membership_id=technician_membership.id) and not exists(select 1 from public.membership_branch_assignments where membership_id=technician_membership.id and branch_id=j.branch_id) then
      raise exception 'The assigned technician cannot access this branch' using errcode='42501';
    end if;
  end if;
  update public.job_order_items set technician_user_id=p_technician_id,
    technician_assigned_at=case when p_technician_id is null then null when technician_user_id is distinct from p_technician_id then now() else technician_assigned_at end where id=item.id;
end $$;
