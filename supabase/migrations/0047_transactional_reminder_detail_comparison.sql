-- 0046 safely covered direct child mutations, but the scheduling persistence
-- boundary replaces child rows even when their normalized content is unchanged.
-- Compare the final sets once and suppress intermediate row-trigger churn.

revoke insert,update,delete on table public.appointment_services from authenticated;

create or replace function public.invalidate_reminders_for_appointment_staff()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_setting('servicecore.suppress_appointment_detail_invalidation',true)='on'
  then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op='UPDATE' and old.appointment_id is not distinct from new.appointment_id
    and old.staff_membership_id is not distinct from new.staff_membership_id then return new; end if;
  if tg_op='INSERT' then
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  elsif tg_op='DELETE' then
    perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  elsif new.appointment_id is distinct from old.appointment_id then
    perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_STAFF_CHANGED');
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  else
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_STAFF_CHANGED');
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

create or replace function public.invalidate_reminders_for_appointment_treatment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_setting('servicecore.suppress_appointment_detail_invalidation',true)='on'
  then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op='UPDATE' and old.appointment_id is not distinct from new.appointment_id
    and old.service_id is not distinct from new.service_id
    and old.service_name_snapshot is not distinct from new.service_name_snapshot
    and old.unit_price_centavos is not distinct from new.unit_price_centavos
    and old.duration_minutes is not distinct from new.duration_minutes then return new; end if;
  if tg_op='INSERT' then
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_TREATMENTS_CHANGED');
  elsif tg_op='DELETE' then
    perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_TREATMENTS_CHANGED');
  elsif new.appointment_id is distinct from old.appointment_id then
    perform public.invalidate_appointment_reminder_generation(old.appointment_id,'APPOINTMENT_TREATMENTS_CHANGED');
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_TREATMENTS_CHANGED');
  else
    perform public.invalidate_appointment_reminder_generation(new.appointment_id,'APPOINTMENT_TREATMENTS_CHANGED');
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

alter function public.save_appointment_with_assignments(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean)
  rename to save_appointment_with_assignments_0043;
revoke all on function public.save_appointment_with_assignments_0043(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean)
  from public,anon,authenticated;

create function public.save_appointment_with_assignments(
  p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,
  p_staff_membership_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  saved_id uuid;
  old_starts_at timestamptz;
  old_staff uuid[]:='{}';
  new_staff uuid[]:='{}';
  old_treatments jsonb:='[]'::jsonb;
  new_treatments jsonb:='[]'::jsonb;
  previous_suppression text:=coalesce(current_setting('servicecore.suppress_appointment_detail_invalidation',true),'');
begin
  if p_appointment_id is not null then
    select starts_at into old_starts_at from public.appointments where id=p_appointment_id;
    select coalesce(array_agg(staff_membership_id order by staff_membership_id),'{}') into old_staff
      from public.appointment_staff_assignments where appointment_id=p_appointment_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]'::jsonb)
      into old_treatments from public.appointment_services where appointment_id=p_appointment_id;
  end if;

  perform set_config('servicecore.suppress_appointment_detail_invalidation','on',true);
  begin
    saved_id:=public.save_appointment_with_assignments_0043(
      p_appointment_id,p_branch_id,p_customer_id,p_vehicle_id,p_service_ids,p_starts_at,
      p_staff_membership_ids,p_resource_ids,p_customer_note,p_internal_note,p_allow_conflict
    );
  exception when others then
    perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);
    raise;
  end;
  perform set_config('servicecore.suppress_appointment_detail_invalidation',previous_suppression,true);

  if p_appointment_id is not null then
    select coalesce(array_agg(staff_membership_id order by staff_membership_id),'{}') into new_staff
      from public.appointment_staff_assignments where appointment_id=saved_id;
    select coalesce(jsonb_agg(jsonb_build_object('serviceId',service_id,'name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_id),'[]'::jsonb)
      into new_treatments from public.appointment_services where appointment_id=saved_id;
    -- A changed start already advanced and cancelled through the Appointment
    -- trigger. Otherwise advance exactly once for any final payload difference.
    if old_starts_at is not distinct from p_starts_at
      and (old_staff is distinct from new_staff or old_treatments is distinct from new_treatments)
    then perform public.invalidate_appointment_reminder_generation(saved_id,'APPOINTMENT_DETAILS_CHANGED'); end if;
  end if;
  return saved_id;
end $$;
grant execute on function public.save_appointment_with_assignments(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean)
  to authenticated;

comment on function public.save_appointment_with_assignments(uuid,uuid,uuid,uuid,uuid[],timestamptz,uuid[],uuid[],text,text,boolean) is
  'Transactional scheduling persistence with normalized final Staff/Treatment comparison for reminder generation.';
