-- Salon appointment operations built on shared scheduling, notification, and payment primitives.

alter type public.appointment_status add value if not exists 'in_service' after 'checked_in';

create table public.organization_staff_profiles (
  membership_id uuid primary key references public.organization_memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_function text check (job_function is null or char_length(trim(job_function)) between 2 and 80),
  specializations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.validate_organization_staff_profile()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.organization_memberships m where m.id=new.membership_id and m.organization_id=new.organization_id)
  then raise exception 'Staff profile membership mismatch'; end if;
  if exists(select 1 from unnest(new.specializations) value where char_length(trim(value)) not between 2 and 80)
  then raise exception 'Invalid staff specialization'; end if;
  return new;
end $$;
create trigger organization_staff_profile_guard before insert or update on public.organization_staff_profiles
for each row execute function public.validate_organization_staff_profile();
create trigger organization_staff_profiles_updated_at before update on public.organization_staff_profiles
for each row execute function public.set_updated_at();

alter table public.organization_staff_profiles enable row level security;
create policy organization_staff_profiles_read on public.organization_staff_profiles for select to authenticated
using(public.is_org_member(organization_id));
revoke insert,update,delete on public.organization_staff_profiles from authenticated;
grant select on public.organization_staff_profiles to authenticated;

create function public.save_organization_staff_profile(
  p_membership_id uuid,p_job_function text default null,p_specializations text[] default '{}'
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare member public.organization_memberships;
begin
  select * into member from public.organization_memberships where id=p_membership_id for update;
  if member.id is null or not public.has_org_role(member.organization_id,array['owner','manager']::public.organization_role[])
  then raise exception 'Staff member not found' using errcode='42501'; end if;
  insert into public.organization_staff_profiles(membership_id,organization_id,job_function,specializations)
  values(member.id,member.organization_id,nullif(trim(coalesce(p_job_function,'')),''),coalesce(p_specializations,'{}'))
  on conflict(membership_id) do update set job_function=excluded.job_function,specializations=excluded.specializations;
end $$;
grant execute on function public.save_organization_staff_profile(uuid,text,text[]) to authenticated;

-- Core lifecycle remains industry-neutral. Direct completion is deliberately removed;
-- verticals that can complete without work execution use their own narrow policy boundary.
create or replace function public.transition_appointment(
  p_appointment_id uuid,p_action text,p_reason text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.appointments; next_status public.appointment_status;
begin
  select * into row_data from public.appointments where id=p_appointment_id for update;
  if row_data.id is null
    or not public.has_org_role(row_data.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(row_data.organization_id,row_data.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  next_status:=case
    when p_action='confirm' and row_data.status='requested' then 'confirmed'::public.appointment_status
    when p_action='arrive' and row_data.status in('requested','confirmed') then 'checked_in'::public.appointment_status
    when p_action='cancel' and row_data.status in('requested','confirmed') then 'cancelled'::public.appointment_status
    when p_action='no_show' and row_data.status in('requested','confirmed') then 'no_show'::public.appointment_status
    else null::public.appointment_status end;
  if next_status is null then raise exception 'Invalid appointment transition'; end if;
  update public.appointments set status=next_status,
    cancellation_reason=case when next_status='cancelled' then nullif(trim(coalesce(p_reason,'')),'') else cancellation_reason end,
    cancelled_at=case when next_status='cancelled' then now() else cancelled_at end
  where id=row_data.id;
end $$;

create function public.transition_salon_appointment(p_appointment_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.appointments; next_status public.appointment_status;
begin
  select appointment.* into row_data from public.appointments appointment
  join public.organizations organization on organization.id=appointment.organization_id and organization.industry='salon'
  where appointment.id=p_appointment_id for update of appointment;
  if row_data.id is null
    or not public.has_org_role(row_data.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(row_data.organization_id,row_data.branch_id)
  then raise exception 'Salon appointment not found' using errcode='42501'; end if;
  next_status:=case
    when p_action='confirm' and row_data.status='requested' then 'confirmed'::public.appointment_status
    when p_action='arrive' and row_data.status in('requested','confirmed') then 'checked_in'::public.appointment_status
    when p_action='start_service' and row_data.status='checked_in' then 'in_service'::public.appointment_status
    when p_action='complete' and row_data.status='in_service' then 'completed'::public.appointment_status
    when p_action='cancel' and row_data.status in('requested','confirmed','checked_in') then 'cancelled'::public.appointment_status
    when p_action='no_show' and row_data.status in('requested','confirmed') then 'no_show'::public.appointment_status
    else null::public.appointment_status end;
  if next_status is null then raise exception 'Invalid salon appointment transition'; end if;
  update public.appointments set status=next_status,
    cancelled_at=case when next_status='cancelled' then now() else cancelled_at end
  where id=row_data.id;
end $$;
grant execute on function public.transition_salon_appointment(uuid,text) to authenticated;

-- Keep the transactional scheduling persistence boundary aware that in-service
-- appointments still occupy their assigned staff and resources.
create or replace function public.save_appointment_with_assignments(
  p_appointment_id uuid,p_branch_id uuid,p_customer_id uuid,p_vehicle_id uuid,p_service_ids uuid[],p_starts_at timestamptz,
  p_staff_membership_ids uuid[] default '{}',p_resource_ids uuid[] default '{}',p_customer_note text default null,p_internal_note text default null,p_allow_conflict boolean default false
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare branch_org uuid;saved_id uuid;service_id uuid;staff_id uuid;requested_resource_id uuid;current_status public.appointment_status;duration integer;service_count integer;requested_end timestamptz;resource_capacity integer;used_capacity integer;
begin
  select organization_id into branch_org from public.branches where id=p_branch_id and is_active;
  if auth.uid() is null or branch_org is null or not public.has_org_role(branch_org,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(branch_org,p_branch_id) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_starts_at is null or p_starts_at<now()-interval '1 day' then raise exception 'Appointment time is invalid'; end if;
  if coalesce(array_length(p_service_ids,1),0)=0 then raise exception 'Select at least one service'; end if;
  if cardinality(p_staff_membership_ids)<>(select count(distinct value) from unnest(p_staff_membership_ids)value) then raise exception 'Duplicate staff assignment'; end if;
  if cardinality(p_resource_ids)<>(select count(distinct value) from unnest(p_resource_ids)value) then raise exception 'Duplicate resource assignment'; end if;
  select count(*),coalesce(sum(duration_minutes),0) into service_count,duration from public.services where organization_id=branch_org and is_active and id=any(p_service_ids);
  if service_count<>(select count(distinct value) from unnest(p_service_ids)value) or duration<=0 then raise exception 'Selected service is unavailable'; end if;
  requested_end:=p_starts_at+make_interval(mins=>duration);
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  if exists(select 1 from unnest(p_staff_membership_ids)sid where not exists(
    select 1 from public.organization_memberships m where m.id=sid and m.organization_id=branch_org and m.is_active and
      (m.role='owner' or not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id) or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=p_branch_id))
  )) then raise exception 'Staff member is not allowed at this branch'; end if;
  if exists(select 1 from unnest(p_resource_ids)rid where not exists(select 1 from public.scheduling_resources r where r.id=rid and r.organization_id=branch_org and r.branch_id=p_branch_id and r.is_active)) then raise exception 'Scheduling resource is not available at this branch'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointments a where a.organization_id=branch_org and a.branch_id=p_branch_id and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at) then raise exception 'Another appointment overlaps this time'; end if;
  if not p_allow_conflict and exists(select 1 from public.appointment_staff_assignments asa join public.appointments a on a.id=asa.appointment_id where asa.staff_membership_id=any(p_staff_membership_ids) and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at) then raise exception 'A selected staff member is busy'; end if;
  if not p_allow_conflict then
    foreach requested_resource_id in array p_resource_ids loop
      select capacity into resource_capacity from public.scheduling_resources where id=requested_resource_id;
      select coalesce(sum(ara.quantity),0) into used_capacity from public.appointment_resource_assignments ara join public.appointments a on a.id=ara.appointment_id where ara.resource_id=requested_resource_id and a.id is distinct from p_appointment_id and a.status in('requested','confirmed','checked_in','in_service','queued') and a.starts_at<requested_end and a.ends_at>p_starts_at;
      if used_capacity+1>resource_capacity then raise exception 'Scheduling resource capacity exceeded'; end if;
    end loop;
  end if;
  if p_appointment_id is null then
    insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,internal_note,created_by) values(branch_org,p_branch_id,p_customer_id,p_vehicle_id,'requested','internal',p_starts_at,nullif(trim(coalesce(p_customer_note,'')),''),nullif(trim(coalesce(p_internal_note,'')),''),auth.uid()) returning id into saved_id;
  else
    select status into current_status from public.appointments where id=p_appointment_id and organization_id=branch_org for update;
    if current_status not in('requested','confirmed') then raise exception 'This appointment can no longer be edited'; end if;
    update public.appointments set branch_id=p_branch_id,customer_id=p_customer_id,vehicle_id=p_vehicle_id,starts_at=p_starts_at,customer_note=nullif(trim(coalesce(p_customer_note,'')),''),internal_note=nullif(trim(coalesce(p_internal_note,'')),'') where id=p_appointment_id;
    if not found then raise exception 'Appointment not found' using errcode='42501'; end if;
    saved_id:=p_appointment_id;delete from public.appointment_services where appointment_id=saved_id;delete from public.appointment_staff_assignments where appointment_id=saved_id;delete from public.appointment_resource_assignments where appointment_id=saved_id;
  end if;
  foreach service_id in array p_service_ids loop insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes)values(saved_id,service_id,'pending',0,1);end loop;
  foreach staff_id in array p_staff_membership_ids loop insert into public.appointment_staff_assignments(organization_id,appointment_id,staff_membership_id)values(branch_org,saved_id,staff_id);end loop;
  foreach requested_resource_id in array p_resource_ids loop insert into public.appointment_resource_assignments(organization_id,appointment_id,resource_id)values(branch_org,saved_id,requested_resource_id);end loop;
  return saved_id;
end $$;

create table public.appointment_self_service_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check(status in('active','revoked','expired')),
  expires_at timestamptz not null,
  delivery_secret_id uuid references public.notification_delivery_secrets(id) on delete set null,
  schedule_revision integer not null default 1 check(schedule_revision>0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(appointment_id,id)
);
create unique index appointment_self_service_one_active on public.appointment_self_service_links(appointment_id) where status='active';
create index appointment_self_service_expiry_idx on public.appointment_self_service_links(expires_at,id) where status='active';
alter table public.appointment_self_service_links enable row level security;
revoke all on public.appointment_self_service_links from public,anon,authenticated;
grant select(id,organization_id,branch_id,appointment_id,status,expires_at,schedule_revision,created_by,created_at,revoked_at)
on public.appointment_self_service_links to authenticated;
create policy appointment_self_service_staff_read on public.appointment_self_service_links for select to authenticated
using(public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));

create function public.validate_appointment_self_service_link() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.appointments a join public.organizations o on o.id=a.organization_id and o.industry='salon'
    where a.id=new.appointment_id and a.organization_id=new.organization_id and a.branch_id=new.branch_id)
  then raise exception 'Appointment self-service tenant mismatch'; end if;
  return new;
end $$;
create trigger appointment_self_service_link_guard before insert or update on public.appointment_self_service_links
for each row execute function public.validate_appointment_self_service_link();

create function public.create_appointment_self_service_link(
  p_appointment_id uuid,p_token_hash text,p_expires_at timestamptz,
  p_secret_ciphertext text default null,p_secret_initialization_vector text default null,p_secret_authentication_tag text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; link_id uuid; secret_id uuid; old_link record;
begin
  select appointment.* into appointment_row from public.appointments appointment
  join public.organizations organization on organization.id=appointment.organization_id and organization.industry='salon'
  where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null
    or not public.has_org_role(appointment_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  if appointment_row.status not in('requested','confirmed') or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at<=now()+interval '1 hour' or p_expires_at>now()+interval '30 days'
  then raise exception 'Appointment cannot be shared'; end if;
  if (p_secret_ciphertext is null)<>(p_secret_initialization_vector is null)
    or (p_secret_ciphertext is null)<>(p_secret_authentication_tag is null)
  then raise exception 'Invalid delivery secret'; end if;
  for old_link in update public.appointment_self_service_links set status='revoked',revoked_at=now()
    where appointment_id=appointment_row.id and status='active' returning id,delivery_secret_id
  loop
    update public.notification_delivery_secrets set ciphertext=null,initialization_vector=null,authentication_tag=null,destroyed_at=now()
      where id=old_link.delivery_secret_id and destroyed_at is null;
  end loop;
  update public.notification_outbox set status='cancelled',eligibility_reason='LINK_REPLACED',cancelled_at=now(),locked_at=null,locked_by=null
    where reference_type='appointment' and reference_id=appointment_row.id and status in('pending','processing');
  if p_secret_ciphertext is not null then
    insert into public.notification_delivery_secrets(organization_id,ciphertext,initialization_vector,authentication_tag,expires_at)
    values(appointment_row.organization_id,p_secret_ciphertext,p_secret_initialization_vector,p_secret_authentication_tag,p_expires_at)
    returning id into secret_id;
  end if;
  insert into public.appointment_self_service_links(organization_id,branch_id,appointment_id,token_hash,expires_at,delivery_secret_id,created_by)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_token_hash,p_expires_at,secret_id,auth.uid()) returning id into link_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(appointment_row.organization_id,auth.uid(),'appointment_self_service_link',link_id,'appointment.self_service_link_created',jsonb_build_object('appointment_id',appointment_row.id,'expires_at',p_expires_at));
  return link_id;
end $$;
grant execute on function public.create_appointment_self_service_link(uuid,text,timestamptz,text,text,text) to authenticated;

create function public.get_public_appointment_self_service(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select case when link.status<>'active' then jsonb_build_object('state',link.status)
    when link.expires_at<=now() then jsonb_build_object('state','expired')
    when appointment.status in('cancelled','no_show') then jsonb_build_object('state','unavailable')
    else jsonb_build_object(
      'state','active','businessName',organization.name,'branchName',branch.name,'branchTimezone',branch.timezone,
      'appointmentStatus',appointment.status,'startsAt',appointment.starts_at,'endsAt',appointment.ends_at,
      'treatments',(select coalesce(jsonb_agg(jsonb_build_object('name',service_name_snapshot,'durationMinutes',duration_minutes) order by service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=appointment.id),
      'paymentStatus',case when coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)>=appointment.expected_total_centavos then 'paid' when exists(select 1 from public.payments p where p.appointment_id=appointment.id and p.status='paid') then 'partial' else 'unpaid' end,
      'totalCentavos',appointment.expected_total_centavos,
      'paidCentavos',coalesce((select sum(p.amount_centavos) from public.payments p where p.appointment_id=appointment.id and p.status='paid'),0)
    ) end into result
  from public.appointment_self_service_links link
  join public.appointments appointment on appointment.id=link.appointment_id
  join public.organizations organization on organization.id=link.organization_id and organization.industry='salon'
  join public.branches branch on branch.id=link.branch_id
  where link.token_hash=p_token_hash;
  return coalesce(result,jsonb_build_object('state','invalid'));
end $$;

create function public.update_public_appointment_self_service(p_token_hash text,p_action text,p_starts_at timestamptz default null)
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
grant execute on function public.get_public_appointment_self_service(text),public.update_public_appointment_self_service(text,text,timestamptz) to anon,authenticated;

-- Payments gain a neutral Appointment reference without changing invoice-backed Automotive records.
alter table public.payments add column appointment_id uuid references public.appointments(id) on delete restrict;
alter table public.payments add constraint payments_business_reference_check check(
  appointment_id is null or (job_order_id is null and invoice_id is null)
);
create index payments_appointment_paid_idx on public.payments(appointment_id,paid_at) where appointment_id is not null;

create or replace function public.enforce_payment_org() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; job_org uuid; appointment_row public.appointments;
begin
  select organization_id into branch_org from public.branches where id=new.branch_id;
  if branch_org is null or branch_org<>new.organization_id then raise exception 'Payment/branch organization mismatch'; end if;
  if new.job_order_id is not null then select organization_id into job_org from public.job_orders where id=new.job_order_id; if job_org is null or job_org<>new.organization_id then raise exception 'Payment/job organization mismatch'; end if; end if;
  if new.appointment_id is not null then select * into appointment_row from public.appointments where id=new.appointment_id; if appointment_row.id is null or appointment_row.organization_id<>new.organization_id or appointment_row.branch_id<>new.branch_id then raise exception 'Payment/appointment tenant mismatch'; end if; end if;
  return new;
end $$;

create function public.record_appointment_payment(p_appointment_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_reference text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; paid bigint; payment_id uuid;
begin
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry='salon' where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  select coalesce(sum(amount_centavos),0) into paid from public.payments where appointment_id=appointment_row.id and status='paid';
  if p_amount_centavos<=0 or p_amount_centavos>appointment_row.expected_total_centavos-paid then raise exception 'Invalid payment amount'; end if;
  insert into public.payments(organization_id,branch_id,appointment_id,amount_centavos,method,status,reference,paid_at,notes,received_by,created_by)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_amount_centavos,p_method,'paid',nullif(trim(coalesce(p_reference,'')),''),now(),nullif(trim(coalesce(p_notes,'')),''),auth.uid(),auth.uid()) returning id into payment_id;
  return payment_id;
end $$;
grant execute on function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text) to authenticated;

create or replace function public.reverse_payment(p_payment_id uuid,p_action text,p_note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare payment public.payments; invoice public.invoices; next_paid bigint;
begin
  select * into payment from public.payments where id=p_payment_id for update;
  if payment.id is null or not public.has_org_role(payment.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(payment.organization_id,payment.branch_id)
  then raise exception 'Payment not found' using errcode='42501'; end if;
  if payment.status<>'paid' or p_action not in('refund','void') then raise exception 'Payment cannot be reversed'; end if;
  update public.payments set status=case when p_action='refund' then 'refunded'::public.payment_status else 'voided'::public.payment_status end,notes=concat_ws(E'\n',notes,nullif(trim(coalesce(p_note,'')),'')) where id=payment.id;
  if payment.invoice_id is not null then
    select * into invoice from public.invoices where id=payment.invoice_id for update;
    next_paid:=invoice.paid_centavos-payment.amount_centavos;
    if next_paid<0 then raise exception 'Invalid invoice balance'; end if;
    update public.invoices set paid_centavos=next_paid,balance_centavos=total_centavos-next_paid,status=case when next_paid=0 then 'issued'::public.invoice_status else 'partially_paid'::public.invoice_status end where id=invoice.id;
  end if;
end $$;

-- Reschedule/status changes invalidate only pending reminders; sent rows remain history.
create function public.cancel_stale_appointment_reminders() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.starts_at is distinct from new.starts_at or new.status in('checked_in','in_service','cancelled','no_show','completed') then
    update public.notification_outbox set status='cancelled',eligibility_reason=case when old.starts_at is distinct from new.starts_at then 'APPOINTMENT_RESCHEDULED' else 'APPOINTMENT_INACTIVE' end,cancelled_at=now(),locked_at=null,locked_by=null
    where reference_type='appointment' and reference_id=new.id and notification_type='SALON_APPOINTMENT_REMINDER' and status in('pending','processing');
  end if;
  return new;
end $$;
create trigger appointment_reminder_invalidation after update of starts_at,status on public.appointments
for each row execute function public.cancel_stale_appointment_reminders();

create function public.enqueue_due_salon_appointment_reminders(p_limit integer default 100) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; preference public.customer_communication_preferences; normalized_email text; normalized_mobile text; channel text; address text; reason text; inserted integer:=0; safe_payload jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  for candidate in
    select a.*,l.id link_id,l.delivery_secret_id,l.expires_at link_expires,o.name business_name,b.name branch_name,b.timezone,c.email,c.phone,c.full_name
    from public.appointments a join public.organizations o on o.id=a.organization_id and o.industry='salon'
    join public.branches b on b.id=a.branch_id join public.customers c on c.id=a.customer_id
    join public.appointment_self_service_links l on l.appointment_id=a.id and l.status='active' and l.expires_at>now()
    where a.status in('requested','confirmed') and a.starts_at>now() and a.starts_at<=now()+interval '24 hours'
    order by a.starts_at limit least(greatest(p_limit,1),500)
  loop
    select * into preference from public.customer_communication_preferences where organization_id=candidate.organization_id and customer_id=candidate.customer_id;
    normalized_email:=case when lower(trim(coalesce(candidate.email,''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then lower(trim(candidate.email)) end;
    normalized_mobile:=public.normalize_ph_mobile(candidate.phone);
    safe_payload:=jsonb_build_object('businessName',candidate.business_name,'branchName',candidate.branch_name,'clientFirstName',split_part(candidate.full_name,' ',1),'startsAt',candidate.starts_at,'timezone',candidate.timezone,'treatments',(select jsonb_agg(service_name_snapshot order by service_name_snapshot) from public.appointment_services where appointment_id=candidate.id));
    foreach channel in array array['email','sms'] loop
      address:=case when channel='email' then normalized_email else normalized_mobile end;
      reason:=case when address is null then upper(channel)||'_MISSING_OR_INVALID' when channel='email' and not coalesce(preference.email_opt_in,false) then 'EMAIL_OPTED_OUT' when channel='sms' and not coalesce(preference.sms_opt_in,false) then 'SMS_OPTED_OUT' when candidate.delivery_secret_id is null then 'DELIVERY_SECRET_UNAVAILABLE' else null end;
      insert into public.notification_outbox(organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,template_key,template_version,payload,reference_type,reference_id,delivery_secret_id,deduplication_key,status,eligibility_reason,available_at,expires_at,cancelled_at)
      values(candidate.organization_id,candidate.branch_id,candidate.customer_id,'SALON_APPOINTMENT_REMINDER',channel,address,'salon-appointment-reminder-'||channel||'-v1',1,safe_payload,'appointment',candidate.id,candidate.delivery_secret_id,'salon-appointment:'||candidate.id||':'||extract(epoch from candidate.starts_at)::bigint||':'||channel,case when reason is null then 'pending' else 'cancelled' end,reason,now(),least(candidate.link_expires,candidate.starts_at),case when reason is null then null else now() end)
      on conflict(deduplication_key) do nothing;
      if found and reason is null then inserted:=inserted+1; end if;
    end loop;
  end loop;
  return inserted;
end $$;
revoke all on function public.enqueue_due_salon_appointment_reminders(integer) from public,anon,authenticated;
grant execute on function public.enqueue_due_salon_appointment_reminders(integer) to service_role;

comment on table public.organization_staff_profiles is 'Organization-specific job functions; authorization remains on organization_memberships.role.';
comment on table public.appointment_self_service_links is 'Hashed, expiring neutral appointment confirmation/reschedule capability.';
comment on column public.payments.appointment_id is 'Neutral Appointment payment reference. Automotive invoice payments keep invoice/job references.';
