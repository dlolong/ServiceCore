-- Appointment reminder payloads snapshot assigned Staff and Treatments. Keep
-- their generation identity synchronized when either child collection changes.

create function public.invalidate_appointment_reminder_generation(
  p_appointment_id uuid,
  p_reason text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_appointment_id is null then return; end if;
  update public.appointment_self_service_links
    set schedule_revision=schedule_revision+1
    where appointment_id=p_appointment_id and status='active';
  update public.notification_outbox
    set status='cancelled',eligibility_reason=p_reason,cancelled_at=now(),locked_at=null,locked_by=null
    where reference_type='appointment' and reference_id=p_appointment_id
      and notification_type='SALON_APPOINTMENT_REMINDER' and status in('pending','processing');
end $$;
revoke all on function public.invalidate_appointment_reminder_generation(uuid,text) from public,anon,authenticated;

create function public.invalidate_reminders_for_appointment_staff()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
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

create trigger appointment_staff_reminder_generation
after insert or update or delete on public.appointment_staff_assignments
for each row execute function public.invalidate_reminders_for_appointment_staff();

create function public.invalidate_reminders_for_appointment_treatment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
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

create trigger appointment_treatment_reminder_generation
after insert or update or delete on public.appointment_services
for each row execute function public.invalidate_reminders_for_appointment_treatment();

comment on function public.invalidate_appointment_reminder_generation(uuid,text) is
  'Cancels pending Salon Appointment reminders and advances the active customer-link generation after payload detail changes.';
