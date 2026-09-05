-- Harden Salon appointment operations after the locally applied 0043/0044
-- boundary: status is RPC-only, customer actions are audit-idempotent, reminder
-- identity follows link/schedule generations, and manual payments are idempotent.

-- Authenticated clients may still create and edit scheduling data, but may not
-- inject lifecycle states. SECURITY DEFINER scheduling/transition functions keep
-- their existing controlled write access.
revoke insert,update on table public.appointments from authenticated;
grant insert(id,organization_id,branch_id,customer_id,vehicle_id,source,starts_at,customer_note,internal_note,created_by)
  on public.appointments to authenticated;
grant update(branch_id,customer_id,vehicle_id,starts_at,customer_note,internal_note)
  on public.appointments to authenticated;

-- Any schedule change advances the active customer-link generation. This also
-- covers staff edits through Core Scheduling, not just public reschedules.
create or replace function public.cancel_stale_appointment_reminders()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.starts_at is distinct from new.starts_at then
    update public.appointment_self_service_links
      set schedule_revision=schedule_revision+1
      where appointment_id=new.id and status='active';
  end if;
  if old.starts_at is distinct from new.starts_at or new.status in('checked_in','in_service','cancelled','no_show','completed') then
    update public.notification_outbox
      set status='cancelled',
          eligibility_reason=case when old.starts_at is distinct from new.starts_at then 'APPOINTMENT_RESCHEDULED' else 'APPOINTMENT_INACTIVE' end,
          cancelled_at=now(),locked_at=null,locked_by=null
      where reference_type='appointment' and reference_id=new.id
        and notification_type='SALON_APPOINTMENT_REMINDER' and status in('pending','processing');
  end if;
  return new;
end $$;

-- Public DTO remains allowlisted. Staff exposure is display-name-only.
create or replace function public.get_public_appointment_self_service(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
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
      'assignedStaff',(select coalesce(jsonb_agg(coalesce(nullif(trim(profile.full_name),''),'Salon staff') order by coalesce(nullif(trim(profile.full_name),''),'Salon staff')),'[]'::jsonb)
        from public.appointment_staff_assignments assignment
        join public.organization_memberships membership on membership.id=assignment.staff_membership_id and membership.organization_id=appointment.organization_id
        left join public.profiles profile on profile.id=membership.user_id
        where assignment.appointment_id=appointment.id),
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

-- Follow up 0044 without rewriting it. Confirm retries are no-ops for audit,
-- and the schedule-revision trigger above owns monotonic revision advancement.
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
    if appointment_row.status='requested' then
      update public.appointments set status='confirmed' where id=appointment_row.id;
      insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_confirmed',jsonb_build_object('link_id',link_row.id));
    end if;
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
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(appointment_row.organization_id,null,'appointment',appointment_row.id,'appointment.customer_rescheduled',jsonb_build_object('link_id',link_row.id,'starts_at',p_starts_at));
  return jsonb_build_object('state','rescheduled');
end $$;

-- A rendered payment operation owns one bounded key. Exact retries return the
-- original row; reusing a key for different payment intent is rejected.
alter table public.payments add column appointment_idempotency_key text
  check(appointment_idempotency_key is null or char_length(appointment_idempotency_key) between 8 and 200);
create unique index payments_appointment_idempotency_idx
  on public.payments(organization_id,appointment_idempotency_key)
  where appointment_id is not null and appointment_idempotency_key is not null;

revoke execute on function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text) from authenticated;
drop function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text);

create function public.record_appointment_payment(
  p_appointment_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_idempotency_key text,
  p_reference text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare appointment_row public.appointments; existing_payment public.payments; paid bigint; payment_id uuid; operation_key text:=nullif(trim(coalesce(p_idempotency_key,'')),''); normalized_reference text:=nullif(trim(coalesce(p_reference,'')),''); normalized_notes text:=nullif(trim(coalesce(p_notes,'')),'');
begin
  select appointment.* into appointment_row from public.appointments appointment join public.organizations organization on organization.id=appointment.organization_id and organization.industry='salon' where appointment.id=p_appointment_id for update of appointment;
  if appointment_row.id is null or not public.has_org_role(appointment_row.organization_id,array['owner','manager','cashier']::public.organization_role[]) or not public.can_access_branch(appointment_row.organization_id,appointment_row.branch_id)
  then raise exception 'Appointment not found' using errcode='42501'; end if;
  if operation_key is null or char_length(operation_key) not between 8 and 200 then raise exception 'Invalid idempotency key'; end if;
  select * into existing_payment from public.payments where organization_id=appointment_row.organization_id and appointment_idempotency_key=operation_key and appointment_id is not null;
  if existing_payment.id is not null then
    if existing_payment.appointment_id=appointment_row.id and existing_payment.amount_centavos=p_amount_centavos and existing_payment.method=p_method
      and existing_payment.reference is not distinct from normalized_reference and existing_payment.notes is not distinct from normalized_notes
    then return existing_payment.id; end if;
    raise exception 'Idempotency key conflicts with an existing payment';
  end if;
  select coalesce(sum(amount_centavos),0) into paid from public.payments where appointment_id=appointment_row.id and status='paid';
  if p_amount_centavos<=0 or p_amount_centavos>appointment_row.expected_total_centavos-paid then raise exception 'Invalid payment amount'; end if;
  insert into public.payments(organization_id,branch_id,appointment_id,amount_centavos,method,status,reference,paid_at,notes,received_by,created_by,appointment_idempotency_key)
  values(appointment_row.organization_id,appointment_row.branch_id,appointment_row.id,p_amount_centavos,p_method,'paid',normalized_reference,now(),normalized_notes,auth.uid(),auth.uid(),operation_key)
  returning id into payment_id;
  return payment_id;
end $$;
grant execute on function public.record_appointment_payment(uuid,bigint,public.payment_method,text,text,text) to authenticated;

create or replace function public.enqueue_due_salon_appointment_reminders(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; preference public.customer_communication_preferences; normalized_email text; normalized_mobile text; channel text; address text; reason text; inserted integer:=0; safe_payload jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  for candidate in
    select a.*,l.id link_id,l.schedule_revision,l.delivery_secret_id,l.expires_at link_expires,o.name business_name,b.name branch_name,b.timezone,c.email,c.phone,c.full_name
    from public.appointments a join public.organizations o on o.id=a.organization_id and o.industry='salon'
    join public.branches b on b.id=a.branch_id join public.customers c on c.id=a.customer_id
    join public.appointment_self_service_links l on l.appointment_id=a.id and l.status='active' and l.expires_at>now()
    where a.status in('requested','confirmed') and a.starts_at>now() and a.starts_at<=now()+interval '24 hours'
    order by a.starts_at limit least(greatest(p_limit,1),500)
  loop
    select * into preference from public.customer_communication_preferences where organization_id=candidate.organization_id and customer_id=candidate.customer_id;
    normalized_email:=case when lower(trim(coalesce(candidate.email,''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then lower(trim(candidate.email)) end;
    normalized_mobile:=public.normalize_ph_mobile(candidate.phone);
    safe_payload:=jsonb_build_object(
      'businessName',candidate.business_name,'branchName',candidate.branch_name,'clientFirstName',split_part(candidate.full_name,' ',1),
      'startsAt',candidate.starts_at,'timezone',candidate.timezone,
      'treatments',(select coalesce(jsonb_agg(service_name_snapshot order by service_name_snapshot),'[]'::jsonb) from public.appointment_services where appointment_id=candidate.id),
      'staffNames',(select coalesce(jsonb_agg(coalesce(nullif(trim(profile.full_name),''),'Salon staff') order by coalesce(nullif(trim(profile.full_name),''),'Salon staff')),'[]'::jsonb)
        from public.appointment_staff_assignments assignment
        join public.organization_memberships membership on membership.id=assignment.staff_membership_id and membership.organization_id=candidate.organization_id
        left join public.profiles profile on profile.id=membership.user_id
        where assignment.appointment_id=candidate.id)
    );
    foreach channel in array array['email','sms'] loop
      address:=case when channel='email' then normalized_email else normalized_mobile end;
      reason:=case when address is null then upper(channel)||'_MISSING_OR_INVALID' when channel='email' and not coalesce(preference.email_opt_in,false) then 'EMAIL_OPTED_OUT' when channel='sms' and not coalesce(preference.sms_opt_in,false) then 'SMS_OPTED_OUT' when candidate.delivery_secret_id is null then 'DELIVERY_SECRET_UNAVAILABLE' else null end;
      insert into public.notification_outbox(organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,template_key,template_version,payload,reference_type,reference_id,delivery_secret_id,deduplication_key,status,eligibility_reason,available_at,expires_at,cancelled_at)
      values(candidate.organization_id,candidate.branch_id,candidate.customer_id,'SALON_APPOINTMENT_REMINDER',channel,address,'salon-appointment-reminder-'||channel||'-v1',1,safe_payload,'appointment',candidate.id,candidate.delivery_secret_id,
        'salon-appointment:'||candidate.id||':link:'||candidate.link_id||':revision:'||candidate.schedule_revision||':'||channel,
        case when reason is null then 'pending' else 'cancelled' end,reason,now(),least(candidate.link_expires,candidate.starts_at),case when reason is null then null else now() end)
      on conflict(deduplication_key) do nothing;
      if found and reason is null then inserted:=inserted+1; end if;
    end loop;
  end loop;
  return inserted;
end $$;

comment on column public.payments.appointment_idempotency_key is 'Caller-owned idempotency identity for one rendered Appointment payment intent.';
