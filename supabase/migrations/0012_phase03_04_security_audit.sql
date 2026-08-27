-- Close direct queue mutation paths, authorize price lookup, and audit operations.

update public.services set duration_minutes = 60 where duration_minutes is null;
alter table public.services alter column duration_minutes set default 60;
alter table public.services alter column duration_minutes set not null;

create or replace function public.resolve_service_price(
  p_service_id uuid,
  p_branch_id uuid,
  p_vehicle_class text
)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with allowed_service as (
    select id, base_price_centavos
    from public.services
    where id = p_service_id
      and (auth.uid() is null or public.is_org_member(organization_id))
  )
  select coalesce(
    (select price_centavos from public.service_prices p join allowed_service s on s.id = p.service_id where p.branch_id = p_branch_id and p.vehicle_class = p_vehicle_class limit 1),
    (select price_centavos from public.service_prices p join allowed_service s on s.id = p.service_id where p.branch_id is null and p.vehicle_class = p_vehicle_class limit 1),
    (select price_centavos from public.service_prices p join allowed_service s on s.id = p.service_id where p.branch_id = p_branch_id and p.vehicle_class is null limit 1),
    (select base_price_centavos from allowed_service)
  )
$$;

drop policy if exists queue_entries_ops_write on public.queue_entries;
revoke insert, update, delete on public.queue_entries from authenticated;

create or replace function public.transition_appointment(
  p_appointment_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data public.appointments;
  next_status public.appointment_status;
begin
  select * into row_data from public.appointments where id = p_appointment_id for update;
  if row_data.id is null or not public.has_org_role(row_data.organization_id, array['owner','manager','advisor']::public.organization_role[]) then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;

  next_status := case
    when p_action = 'confirm' and row_data.status = 'requested' then 'confirmed'::public.appointment_status
    when p_action = 'arrive' and row_data.status in ('requested','confirmed') then 'checked_in'::public.appointment_status
    when p_action = 'cancel' and row_data.status in ('requested','confirmed') then 'cancelled'::public.appointment_status
    when p_action = 'no_show' and row_data.status in ('requested','confirmed') then 'no_show'::public.appointment_status
    else null::public.appointment_status
  end;
  if next_status is null then raise exception 'Invalid appointment transition'; end if;

  update public.appointments
  set status = next_status,
      cancellation_reason = case when next_status = 'cancelled' then nullif(trim(coalesce(p_reason, '')), '') else cancellation_reason end,
      cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end
  where id = row_data.id;
end;
$$;

create or replace function public.enqueue_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  appointment_row public.appointments;
  branch_tz text;
  operational_date date;
  next_number integer;
  queue_id uuid;
begin
  select * into appointment_row from public.appointments where id = p_appointment_id for update;
  select timezone into branch_tz from public.branches where id = appointment_row.branch_id;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id, array['owner','manager','advisor']::public.organization_role[]) then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;
  if appointment_row.status not in ('checked_in','confirmed') then
    raise exception 'Appointment must be confirmed or arrived';
  end if;

  operational_date := (now() at time zone branch_tz)::date;
  insert into public.queue_counters(branch_id, queue_date, last_number)
  values (appointment_row.branch_id, operational_date, 1)
  on conflict(branch_id, queue_date) do update
    set last_number = public.queue_counters.last_number + 1
  returning last_number into next_number;

  insert into public.queue_entries(
    organization_id, branch_id, appointment_id, customer_id, vehicle_id,
    source, queue_date, queue_number, estimated_total_centavos,
    estimated_duration_minutes, created_by
  ) values (
    appointment_row.organization_id, appointment_row.branch_id,
    appointment_row.id, appointment_row.customer_id, appointment_row.vehicle_id,
    case when appointment_row.source = 'walk_in' then 'walk_in' else 'appointment' end,
    operational_date, next_number, appointment_row.expected_total_centavos,
    appointment_row.expected_duration_minutes, auth.uid()
  ) returning id into queue_id;

  update public.appointments set status = 'queued' where id = appointment_row.id;
  return queue_id;
end;
$$;

create or replace function public.audit_operations_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data record;
  action text := lower(tg_op);
  details jsonb := '{}'::jsonb;
begin
  row_data := case when tg_op = 'DELETE' then old else new end;

  if tg_op = 'UPDATE' and tg_table_name = 'appointments'
     and (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status') then
    action := 'status_changed';
    details := jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status');
  elsif tg_op = 'UPDATE' and tg_table_name = 'queue_entries'
        and (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status') then
    action := 'status_changed';
    details := jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status');
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, entity_type, entity_id, event_type, metadata
  ) values (
    row_data.organization_id,
    auth.uid(),
    tg_table_name,
    row_data.id,
    rtrim(tg_table_name, 's') || '.' || action,
    details
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger services_operations_audit
after insert or update or delete on public.services
for each row execute function public.audit_operations_change();

create trigger appointments_operations_audit
after insert or update or delete on public.appointments
for each row execute function public.audit_operations_change();

create trigger queue_entries_operations_audit
after insert or update or delete on public.queue_entries
for each row execute function public.audit_operations_change();
