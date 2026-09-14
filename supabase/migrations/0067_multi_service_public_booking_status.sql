-- Public multi-service availability and customer-safe lifecycle status.
-- All service, tenant, branch, hours, and conflict validation delegates to the
-- existing private booking validators introduced in migration 0064.

create or replace function public.get_public_availability_for_services(
  p_slug text,
  p_branch_id uuid,
  p_service_ids uuid[],
  p_date date
)
returns table(slot_at timestamptz)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  org_id uuid;
  hours jsonb;
  tz text;
  day_hours jsonb;
  duration integer;
  opens_at timestamptz;
  closes_at timestamptz;
begin
  select o.id into org_id
  from public.organizations o
  where o.slug=lower(trim(p_slug)) and o.public_page_enabled and o.status='active';
  if org_id is null then return; end if;

  begin
    duration:=public.public_booking_service_duration(org_id,p_branch_id,p_service_ids);
  exception when sqlstate 'P0001' then
    return;
  end;

  select b.opening_hours,b.timezone into hours,tz
  from public.branches b
  where b.id=p_branch_id and b.organization_id=org_id;
  if p_date is null or p_date<(now() at time zone tz)::date or p_date>(now() at time zone tz)::date+60 then return; end if;

  day_hours:=hours->lower(to_char(p_date,'FMDay'));
  if jsonb_typeof(hours)<>'object'
    or (day_hours is not null and jsonb_typeof(day_hours)<>'object')
    or (day_hours ? 'closed' and jsonb_typeof(day_hours->'closed')<>'boolean') then
    return;
  end if;
  if coalesce(day_hours->'closed','false'::jsonb)='true'::jsonb then return; end if;

  opens_at:=(p_date+coalesce((day_hours->>'open')::time,'08:00'::time)) at time zone tz;
  closes_at:=(p_date+coalesce((day_hours->>'close')::time,'17:00'::time)) at time zone tz;
  return query
    select candidate
    from generate_series(opens_at,closes_at-make_interval(mins=>duration),interval '30 minutes') candidate
    where candidate>now()+interval '1 hour'
      and candidate<=now()+interval '60 days'
      and public.public_booking_slot_is_available(org_id,p_branch_id,candidate,duration);
exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then
  return;
end
$$;

create or replace function public.get_public_availability_dates_for_services(
  p_slug text,
  p_branch_id uuid,
  p_service_ids uuid[],
  p_start_date date,
  p_end_date date
)
returns table(available_date date, slot_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_start_date is null or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date > p_start_date + 41 then
    return;
  end if;

  return query
    select day_value::date, count(slot.slot_at)
    from generate_series(p_start_date,p_end_date,interval '1 day') day_value
    cross join lateral public.get_public_availability_for_services(
      p_slug,
      p_branch_id,
      p_service_ids,
      day_value::date
    ) slot
    group by day_value::date
    having count(slot.slot_at)>0
    order by day_value::date;
end
$$;

create or replace function public.get_public_booking_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path=public,extensions,pg_temp
as $$
  select jsonb_build_object(
    'reference',r.public_reference,
    'status',r.status,
    'industry',o.industry,
    'timezone',b.timezone,
    'shopName',o.name,
    'shopSlug',o.slug,
    'branchName',b.name,
    'preferredAt',r.preferred_at,
    'scheduledAt',coalesce(a.starts_at,r.preferred_at),
    'appointmentStatus',case when r.status='confirmed' then a.status::text end,
    'updatedAt',greatest(r.updated_at,coalesce(a.updated_at,r.updated_at)),
    'services',(select jsonb_agg(s.service_name_snapshot order by s.service_name_snapshot) from public.public_booking_services s where s.booking_request_id=r.id),
    'declineReason',case when r.status='declined' then r.decline_reason end
  )
  from public.public_booking_requests r
  join public.organizations o on o.id=r.organization_id
  join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
  left join public.appointments a on a.id=r.appointment_id and a.organization_id=r.organization_id
  where r.confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
$$;

revoke all on function public.get_public_availability_for_services(text,uuid,uuid[],date) from public;
revoke all on function public.get_public_availability_dates_for_services(text,uuid,uuid[],date,date) from public;
revoke all on function public.get_public_booking_status(text) from public;
grant execute on function public.get_public_availability_for_services(text,uuid,uuid[],date) to anon,authenticated;
grant execute on function public.get_public_availability_dates_for_services(text,uuid,uuid[],date,date) to anon,authenticated;
grant execute on function public.get_public_booking_status(text) to anon,authenticated;

notify pgrst, 'reload schema';
