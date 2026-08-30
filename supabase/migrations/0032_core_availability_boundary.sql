-- Core Availability pre-checks provide feedback; this function is the
-- authoritative serialized overlap check at appointment write time.

create function public.save_appointment_with_availability(
  p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,
  p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid; saved_id uuid; service_id uuid; current_status public.appointment_status; duration integer; service_count integer; requested_end timestamptz;
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(branch_org,p_branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  select count(*),coalesce(sum(duration_minutes),0) into service_count,duration from public.services where organization_id=branch_org and is_active and id=any(p_service_ids);
  if service_count<>(select count(distinct value) from unnest(p_service_ids) value) or duration<=0 then raise exception 'Selected service is unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  if not p_allow_conflict and exists(
    select 1 from public.appointments a where a.organization_id=branch_org and a.branch_id=p_branch_id
      and a.id is distinct from p_appointment_id and a.status in ('requested','confirmed','checked_in','queued')
      and a.starts_at<requested_end and a.ends_at>p_starts_at
  ) then raise exception 'Another appointment overlaps this time'; end if;
  if p_appointment_id is null then
    insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,internal_note,created_by)
    values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'requested','internal',p_starts_at,nullif(trim(coalesce(p_customer_note,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),auth.uid()) returning id into saved_id;
  else
    select status into current_status from public.appointments where id=p_appointment_id and organization_id=branch_org for update;
    if current_status not in ('requested','confirmed') then raise exception 'This appointment can no longer be edited'; end if;
    update public.appointments set branch_id=p_branch_id,customer_id=p_customer_id,vehicle_id=p_vehicle_id,starts_at=p_starts_at,customer_note=nullif(trim(coalesce(p_customer_note,'')),''),internal_note=nullif(trim(coalesce(p_internal_note,'')),'') where id=p_appointment_id;
    if not found then raise exception 'Appointment not found' using errcode='42501'; end if;
    saved_id:=p_appointment_id; delete from public.appointment_services where appointment_id=saved_id;
  end if;
  foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values(saved_id,service_id,'pending',0,1); end loop;
  return saved_id;
end $$;

create or replace function public.save_appointment(p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,p_customer_note text default null,p_internal_note text default null)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select public.save_appointment_with_availability(p_appointment_id,p_branch_id,p_customer_id,p_vehicle_id,p_service_ids,p_starts_at,p_customer_note,p_internal_note,false)
$$;

grant execute on function public.save_appointment_with_availability(uuid,uuid,uuid,uuid,uuid[],timestamptz,text,text,boolean) to authenticated;
