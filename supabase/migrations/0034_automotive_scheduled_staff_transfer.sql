-- Atomic, explicitly requested initialization of one Job Order technician from
-- authoritative appointment scheduling assignments.

create function public.convert_queue_to_job_with_scheduled_staff(
  p_queue_id uuid,
  p_copy_scheduled_staff boolean default false,
  p_scheduled_staff_membership_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  q public.queue_entries; a public.appointments; v public.vehicles; scheduled_member public.organization_memberships;
  existing_id uuid; created_id uuid; next_no bigint; yr integer; eligible_count integer;
begin
  select * into q from public.queue_entries where id=p_queue_id for update;
  if q.id is null or not public.has_org_role(q.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(q.organization_id,q.branch_id) then raise exception 'Queue entry not found' using errcode='42501'; end if;
  select id into existing_id from public.job_orders where queue_entry_id=q.id;
  if existing_id is not null then return existing_id; end if;
  if q.vehicle_id is null then raise exception 'A vehicle is required before this appointment can be converted into a job order'; end if;
  if q.status not in('waiting','called','ready') then raise exception 'Queue entry cannot start a job'; end if;
  select * into v from public.vehicles where id=q.vehicle_id and organization_id=q.organization_id and customer_id=q.customer_id and not is_archived;
  if v.id is null then raise exception 'Vehicle not found'; end if;
  select * into a from public.appointments where id=q.appointment_id and organization_id=q.organization_id and branch_id=q.branch_id and customer_id=q.customer_id and vehicle_id=q.vehicle_id;
  if a.id is null then raise exception 'Appointment is not valid for this automotive job order'; end if;

  if p_copy_scheduled_staff then
    if p_scheduled_staff_membership_id is null then
      select count(*) into eligible_count from public.appointment_staff_assignments asa join public.organization_memberships m on m.id=asa.staff_membership_id
      where asa.appointment_id=a.id and asa.organization_id=q.organization_id and m.organization_id=q.organization_id and m.is_active and m.role='technician'
        and (not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id) or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=q.branch_id));
      if eligible_count=0 then raise exception 'The scheduled staff member is no longer available for Job Order assignment'; end if;
      if eligible_count>1 then raise exception 'Select which scheduled technician should be assigned'; end if;
      select m.* into scheduled_member from public.appointment_staff_assignments asa join public.organization_memberships m on m.id=asa.staff_membership_id
      where asa.appointment_id=a.id and asa.organization_id=q.organization_id and m.organization_id=q.organization_id and m.is_active and m.role='technician'
        and (not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id) or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=q.branch_id));
    else
      select m.* into scheduled_member from public.appointment_staff_assignments asa join public.organization_memberships m on m.id=asa.staff_membership_id
      where asa.appointment_id=a.id and asa.organization_id=q.organization_id and asa.staff_membership_id=p_scheduled_staff_membership_id
        and m.organization_id=q.organization_id and m.is_active and m.role='technician'
        and (not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id) or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=q.branch_id));
      if scheduled_member.id is null then raise exception 'The scheduled staff member is no longer available for Job Order assignment'; end if;
    end if;
  end if;

  yr:=extract(year from now() at time zone 'Asia/Manila');
  insert into public.job_number_counters(branch_id,number_year,last_number) values(q.branch_id,yr,1)
    on conflict(branch_id,number_year) do update set last_number=public.job_number_counters.last_number+1 returning last_number into next_no;
  insert into public.job_orders(organization_id,branch_id,customer_id,vehicle_id,appointment_id,queue_entry_id,job_number,status,customer_concern,advisor_user_id,primary_technician_user_id,technician_assigned_at,created_by)
  values(q.organization_id,q.branch_id,q.customer_id,q.vehicle_id,q.appointment_id,q.id,next_no,'queued',a.customer_note,auth.uid(),case when p_copy_scheduled_staff then scheduled_member.user_id else null end,case when p_copy_scheduled_staff then now() else null end,auth.uid()) returning id into created_id;
  insert into public.job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes)
  select q.organization_id,created_id,service_id,service_name_snapshot,1,unit_price_centavos,unit_price_centavos,duration_minutes from public.appointment_services where appointment_id=q.appointment_id;
  update public.queue_entries set status='converted_to_job' where id=q.id;
  return created_id;
end $$;

create or replace function public.convert_queue_to_job(p_queue_id uuid)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select public.convert_queue_to_job_with_scheduled_staff(p_queue_id,false,null)
$$;

grant execute on function public.convert_queue_to_job_with_scheduled_staff(uuid,boolean,uuid) to authenticated;
