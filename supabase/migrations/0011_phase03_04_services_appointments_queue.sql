-- Combined Phase 03-04: trusted service pricing, appointment snapshots, and queue.

alter type public.appointment_status add value if not exists 'queued' after 'checked_in';

alter table public.service_categories add column updated_at timestamptz not null default now();
create trigger service_categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();

alter table public.services
  add column short_description text,
  add column code text,
  add column is_add_on boolean not null default false,
  add column parent_service_id uuid references public.services(id) on delete set null;
alter table public.services
  add constraint services_required_fields_check check (
    char_length(trim(name)) between 2 and 160 and duration_minutes between 1 and 10080
  ),
  add constraint services_description_length_check check (
    (description is null or char_length(description) <= 2000)
    and (short_description is null or char_length(short_description) <= 300)
    and (code is null or char_length(code) <= 50)
  );
create unique index services_org_code_idx on public.services(organization_id, lower(code)) where code is not null;
create index services_org_active_category_idx on public.services(organization_id, is_active, category_id);

create table public.service_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  vehicle_class text,
  price_centavos bigint not null check (price_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (service_id, branch_id, vehicle_class)
);
create index service_prices_resolution_idx on public.service_prices(service_id, branch_id, vehicle_class);
create trigger service_prices_updated_at before update on public.service_prices for each row execute function public.set_updated_at();

create table public.service_branch_availability (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  is_available boolean not null default true,
  primary key(service_id, branch_id)
);

alter table public.appointment_services
  add column service_name_snapshot text,
  add column unit_price_centavos bigint,
  add column duration_minutes integer;
update public.appointment_services item set
  service_name_snapshot = service.name,
  unit_price_centavos = service.base_price_centavos,
  duration_minutes = service.duration_minutes
from public.services service where service.id = item.service_id;
alter table public.appointment_services
  alter column service_name_snapshot set not null,
  alter column unit_price_centavos set not null,
  alter column duration_minutes set not null,
  add constraint appointment_services_price_check check(unit_price_centavos >= 0),
  add constraint appointment_services_duration_check check(duration_minutes > 0);

alter table public.appointments
  add column expected_total_centavos bigint not null default 0 check(expected_total_centavos >= 0),
  add column ends_at timestamptz,
  add column internal_note text,
  add column cancellation_reason text,
  add column cancelled_at timestamptz;
create index appointments_org_status_start_idx on public.appointments(organization_id, status, starts_at);
create index appointments_customer_idx on public.appointments(customer_id, starts_at desc);
create index appointments_vehicle_idx on public.appointments(vehicle_id, starts_at desc);

create table public.queue_counters (
  branch_id uuid not null references public.branches(id) on delete cascade,
  queue_date date not null,
  last_number integer not null default 0,
  primary key(branch_id, queue_date)
);
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  source text not null check(source in ('appointment','walk_in')),
  queue_date date not null,
  queue_number integer not null check(queue_number > 0),
  status text not null default 'waiting' check(status in ('waiting','called','ready','converted_to_job','cancelled')),
  estimated_total_centavos bigint not null default 0 check(estimated_total_centavos >= 0),
  estimated_duration_minutes integer not null check(estimated_duration_minutes > 0),
  notes text,
  checked_in_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, queue_date, queue_number),
  unique(appointment_id)
);
create index queue_branch_day_status_idx on public.queue_entries(branch_id, queue_date, status, queue_number);
create trigger queue_entries_updated_at before update on public.queue_entries for each row execute function public.set_updated_at();

create function public.enforce_service_configuration_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare service_org uuid; branch_org uuid;
begin
  select organization_id into service_org from public.services where id=new.service_id;
  if new.branch_id is not null then select organization_id into branch_org from public.branches where id=new.branch_id; end if;
  if service_org is null or service_org<>new.organization_id or (new.branch_id is not null and branch_org<>new.organization_id) then
    raise exception 'Service configuration organization mismatch';
  end if;
  return new;
end $$;
create trigger service_prices_org_guard before insert or update on public.service_prices for each row execute function public.enforce_service_configuration_org();
create trigger service_availability_org_guard before insert or update on public.service_branch_availability for each row execute function public.enforce_service_configuration_org();

create function public.enforce_service_parent_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent_org uuid;
begin
  if new.parent_service_id is null then return new; end if;
  select organization_id into parent_org from public.services where id=new.parent_service_id;
  if parent_org is null or parent_org<>new.organization_id or new.parent_service_id=new.id then raise exception 'Service parent organization mismatch'; end if;
  return new;
end $$;
create trigger services_parent_org_guard before insert or update on public.services for each row execute function public.enforce_service_parent_org();

create function public.enforce_queue_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; customer_org uuid; vehicle_org uuid; vehicle_customer uuid; appointment_org uuid;
begin
  select organization_id into branch_org from public.branches where id=new.branch_id;
  select organization_id into customer_org from public.customers where id=new.customer_id;
  select organization_id,customer_id into vehicle_org,vehicle_customer from public.vehicles where id=new.vehicle_id;
  if branch_org is null or customer_org is null or vehicle_org is null or branch_org<>new.organization_id or customer_org<>new.organization_id or vehicle_org<>new.organization_id or vehicle_customer<>new.customer_id then raise exception 'Queue organization mismatch'; end if;
  if new.appointment_id is not null then
    select organization_id into appointment_org from public.appointments where id=new.appointment_id;
    if appointment_org is null or appointment_org<>new.organization_id then raise exception 'Queue/appointment organization mismatch'; end if;
  end if;
  return new;
end $$;
create trigger queue_entries_org_guard before insert or update on public.queue_entries for each row execute function public.enforce_queue_org();

create or replace function public.resolve_service_price(p_service_id uuid,p_branch_id uuid,p_vehicle_class text)
returns bigint language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select price_centavos from public.service_prices where service_id=p_service_id and branch_id=p_branch_id and vehicle_class=p_vehicle_class limit 1),
    (select price_centavos from public.service_prices where service_id=p_service_id and branch_id is null and vehicle_class=p_vehicle_class limit 1),
    (select price_centavos from public.service_prices where service_id=p_service_id and branch_id=p_branch_id and vehicle_class is null limit 1),
    (select base_price_centavos from public.services where id=p_service_id)
  )
$$;

create function public.snapshot_appointment_service()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; service_row public.services; vehicle_class text; configured_count integer; available boolean;
begin
  select * into appointment_row from public.appointments where id=new.appointment_id;
  select * into service_row from public.services where id=new.service_id;
  if appointment_row.id is null or service_row.id is null or appointment_row.organization_id<>service_row.organization_id or not service_row.is_active then raise exception 'Appointment service is unavailable'; end if;
  select count(*),coalesce(bool_or(branch_id=appointment_row.branch_id and is_available),false) into configured_count,available from public.service_branch_availability where service_id=new.service_id;
  if configured_count>0 and not available then raise exception 'Service is unavailable at this branch'; end if;
  select lower(replace(coalesce(vehicle_type,'custom'),' ','_')) into vehicle_class from public.vehicles where id=appointment_row.vehicle_id;
  new.service_name_snapshot:=service_row.name;
  new.unit_price_centavos:=public.resolve_service_price(new.service_id,appointment_row.branch_id,vehicle_class);
  new.duration_minutes:=service_row.duration_minutes;
  return new;
end $$;
create trigger appointment_services_snapshot before insert or update of service_id on public.appointment_services for each row execute function public.snapshot_appointment_service();

create function public.recalculate_appointment()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id uuid; total bigint; duration integer;
begin
  target_id:=coalesce(new.appointment_id,old.appointment_id);
  select coalesce(sum(unit_price_centavos),0),coalesce(sum(duration_minutes),0) into total,duration from public.appointment_services where appointment_id=target_id;
  update public.appointments set expected_total_centavos=total,expected_duration_minutes=nullif(duration,0),ends_at=case when starts_at is null or duration=0 then null else starts_at+(duration||' minutes')::interval end where id=target_id;
  return coalesce(new,old);
end $$;
create trigger appointment_services_recalculate after insert or update or delete on public.appointment_services for each row execute function public.recalculate_appointment();

create function public.protect_appointment_estimates()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare total bigint; duration integer;
begin
  select coalesce(sum(unit_price_centavos),0),coalesce(sum(duration_minutes),0) into total,duration from public.appointment_services where appointment_id=new.id;
  new.expected_total_centavos:=total; new.expected_duration_minutes:=nullif(duration,0);
  new.ends_at:=case when new.starts_at is null or duration=0 then null else new.starts_at+(duration||' minutes')::interval end;
  return new;
end $$;
create trigger appointments_protect_estimates before update on public.appointments for each row execute function public.protect_appointment_estimates();

create function public.save_appointment(p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,p_customer_note text default null,p_internal_note text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid; saved_id uuid; service_id uuid; current_status public.appointment_status;
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is too far in the past'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
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

create function public.transition_appointment(p_appointment_id uuid,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.appointments; next_status public.appointment_status;
begin
  select * into row_data from public.appointments where id=p_appointment_id for update;
  if row_data.id is null or not public.has_org_role(row_data.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Appointment not found' using errcode='42501'; end if;
  next_status:=case
    when p_action='confirm' and row_data.status='requested' then 'confirmed'
    when p_action='arrive' and row_data.status in ('requested','confirmed') then 'checked_in'
    when p_action='cancel' and row_data.status in ('requested','confirmed') then 'cancelled'
    when p_action='no_show' and row_data.status in ('requested','confirmed') then 'no_show'
    else null end;
  if next_status is null then raise exception 'Invalid appointment transition'; end if;
  update public.appointments set status=next_status,cancellation_reason=case when next_status='cancelled' then nullif(trim(coalesce(p_reason,'')),'') else cancellation_reason end,cancelled_at=case when next_status='cancelled' then now() else cancelled_at end where id=row_data.id;
end $$;

create function public.enqueue_appointment(p_appointment_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; branch_tz text; operational_date date; next_number integer; queue_id uuid;
begin
  select * into appointment_row from public.appointments where id=p_appointment_id for update;
  select timezone into branch_tz from public.branches where id=appointment_row.branch_id;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Appointment not found' using errcode='42501'; end if;
  if appointment_row.status not in ('checked_in','confirmed') then raise exception 'Appointment must be confirmed or arrived'; end if;
  operational_date:=(now() at time zone branch_tz)::date;
  insert into public.queue_counters(branch_id,queue_date,last_number) values(appointment_row.branch_id,operational_date,1)
    on conflict(branch_id,queue_date) do update set last_number=public.queue_counters.last_number+1 returning last_number into next_number;
  insert into public.queue_entries(organization_id,branch_id,appointment_id,customer_id,vehicle_id,source,queue_date,queue_number,estimated_total_centavos,estimated_duration_minutes,created_by)
    values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,appointment_row.customer_id,appointment_row.vehicle_id,'appointment',operational_date,next_number,appointment_row.expected_total_centavos,appointment_row.expected_duration_minutes,auth.uid()) returning id into queue_id;
  update public.appointments set status='queued' where id=appointment_row.id;
  return queue_id;
end $$;

create function public.create_walk_in(p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid; appointment_id uuid; service_id uuid;
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Access denied' using errcode='42501'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,created_by) values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'checked_in','walk_in',now(),nullif(trim(coalesce(p_notes,'')),''),auth.uid()) returning id into appointment_id;
  foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values(appointment_id,service_id,'pending',0,1); end loop;
  perform public.enqueue_appointment(appointment_id); return appointment_id;
end $$;

create function public.transition_queue_entry(p_queue_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.queue_entries;
begin
  select * into row_data from public.queue_entries where id=p_queue_id for update;
  if row_data.id is null or not public.has_org_role(row_data.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Queue entry not found' using errcode='42501'; end if;
  if not ((row_data.status='waiting' and p_status in ('called','cancelled')) or (row_data.status='called' and p_status in ('ready','cancelled'))) then raise exception 'Invalid queue transition'; end if;
  update public.queue_entries set status=p_status where id=row_data.id;
end $$;

alter table public.service_prices enable row level security;
alter table public.service_branch_availability enable row level security;
alter table public.queue_counters enable row level security;
alter table public.queue_entries enable row level security;
create policy service_prices_member_select on public.service_prices for select to authenticated using(public.is_org_member(organization_id));
create policy service_prices_admin_write on public.service_prices for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy service_availability_member_select on public.service_branch_availability for select to authenticated using(public.is_org_member(organization_id));
create policy service_availability_admin_write on public.service_branch_availability for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy queue_entries_member_select on public.queue_entries for select to authenticated using(public.is_org_member(organization_id));
create policy queue_entries_ops_write on public.queue_entries for all to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]));
grant select,insert,update,delete on public.service_prices,public.service_branch_availability,public.queue_entries to authenticated;
revoke all on public.queue_counters from authenticated;
grant execute on function public.resolve_service_price(uuid,uuid,text),public.save_appointment(uuid,uuid,uuid,uuid,uuid[],timestamptz,text,text),public.transition_appointment(uuid,text,text),public.enqueue_appointment(uuid),public.create_walk_in(uuid,uuid,uuid,uuid[],text),public.transition_queue_entry(uuid,text) to authenticated;
