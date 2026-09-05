-- Follow-up to locally applied 0043: public rescheduling must also honor the
-- same branch service availability used by Core Scheduling.
create or replace function public.update_public_appointment_self_service(p_token_hash text,p_action text,p_starts_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare link_row public.appointment_self_service_links; appointment_row public.appointments; duration integer; requested_end timestamptz; local_start timestamp; hours jsonb; open_time time; close_time time;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_action not in('confirm','reschedule')
  then return jsonb_build_object('state','invalid'); end if;
  select * into link_row from public.appointment_self_service_links where token_hash=p_token_hash for update;
  if link_row.id is null or link_row.status<>'active' or link_row.expires_at<=now() then return jsonb_build_object('state','unavailable'); end if;
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry='salon' where appointment.id=link_row.appointment_id for update of appointment;
  if appointment_row.id is null or appointment_row.status not in('requested','confirmed') then return jsonb_build_object('state','unavailable'); end if;
  if p_action='confirm' then
    if appointment_row.status='requested' then update public.appointments set status='confirmed' where id=appointment_row.id; end if;
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_confirmed',jsonb_build_object('link_id',link_row.id));
    return jsonb_build_object('state','confirmed');
  end if;
  if p_starts_at is null or p_starts_at<now()+interval '1 hour' or p_starts_at>now()+interval '90 days' then raise exception 'Choose a valid future appointment time'; end if;
  if exists(
    select 1 from public.appointment_services item
    left join public.services service on service.id=item.service_id and service.organization_id=appointment_row.organization_id and service.is_active
    where item.appointment_id=appointment_row.id and (
      service.id is null or (
        exists(select 1 from public.service_branch_availability configured where configured.service_id=service.id)
        and not exists(select 1 from public.service_branch_availability available where available.service_id=service.id and available.branch_id=appointment_row.branch_id and available.is_available)
      )
    )
  ) then raise exception 'Appointment treatments are unavailable at this branch'; end if;
  select coalesce(sum(duration_minutes),0) into duration from public.appointment_services where appointment_id=appointment_row.id;
  if duration<=0 then raise exception 'Appointment treatments are unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(appointment_row.branch_id::text,0));
  select p_starts_at at time zone branch.timezone,
    branch.opening_hours->lower(trim(to_char(p_starts_at at time zone branch.timezone,'Day')))
    into local_start,hours from public.branches branch where branch.id=appointment_row.branch_id and branch.is_active;
  if hours is null or coalesce((hours->>'closed')::boolean,false) or hours->>'open' is null or hours->>'close' is null then raise exception 'The branch is closed at that time'; end if;
  open_time:=(hours->>'open')::time;close_time:=(hours->>'close')::time;
  if local_start::time<open_time or (requested_end at time zone (select timezone from public.branches where id=appointment_row.branch_id))::time>close_time
    or local_start::date<>(requested_end at time zone (select timezone from public.branches where id=appointment_row.branch_id))::date
  then raise exception 'The selected time is outside branch operating hours'; end if;
  if exists(select 1 from public.appointments a where a.organization_id=appointment_row.organization_id and a.branch_id=appointment_row.branch_id and a.id<>appointment_row.id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at)
  then raise exception 'That time is no longer available'; end if;
  if exists(select 1 from public.appointment_staff_assignments mine join public.appointment_staff_assignments other on other.staff_membership_id=mine.staff_membership_id and other.appointment_id<>mine.appointment_id join public.appointments a on a.id=other.appointment_id where mine.appointment_id=appointment_row.id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at)
  then raise exception 'The assigned staff member is unavailable at that time'; end if;
  if exists(select 1 from public.appointment_resource_assignments mine join public.scheduling_resources resource on resource.id=mine.resource_id where mine.appointment_id=appointment_row.id and (select coalesce(sum(other.quantity),0) from public.appointment_resource_assignments other join public.appointments a on a.id=other.appointment_id where other.resource_id=mine.resource_id and other.appointment_id<>mine.appointment_id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at)+mine.quantity>resource.capacity)
  then raise exception 'The assigned resource is unavailable at that time'; end if;
  update public.appointments set starts_at=p_starts_at where id=appointment_row.id;
  update public.appointment_self_service_links set schedule_revision=schedule_revision+1 where id=link_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_rescheduled',jsonb_build_object('link_id',link_row.id,'starts_at',p_starts_at));
  return jsonb_build_object('state','rescheduled');
end $$;
