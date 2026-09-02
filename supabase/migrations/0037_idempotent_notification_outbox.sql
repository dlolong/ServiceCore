-- Transactional notification outbox for secure estimate-approval delivery.
-- Raw approval tokens remain hash-only at the public validation boundary. A
-- separately encrypted, expiring delivery secret is readable only by the
-- service-role worker and is destroyed when the approval cycle ends.

create function public.normalize_ph_mobile(value text) returns text
language plpgsql immutable set search_path=public,pg_temp as $$
declare digits text:=regexp_replace(coalesce(value,''),'[^0-9]','','g');
begin
  if digits ~ '^09[0-9]{9}$' then return '+63'||substr(digits,2); end if;
  if digits ~ '^639[0-9]{9}$' then return '+'||digits; end if;
  return null;
end $$;

create table public.notification_delivery_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ciphertext text,
  initialization_vector text,
  authentication_tag text,
  expires_at timestamptz not null,
  destroyed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (destroyed_at is null and ciphertext is not null and initialization_vector is not null and authentication_tag is not null)
    or (destroyed_at is not null and ciphertext is null and initialization_vector is null and authentication_tag is null)
  )
);

alter table public.estimate_approval_links
  add column delivery_secret_id uuid references public.notification_delivery_secrets(id) on delete set null;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  recipient_customer_id uuid not null references public.customers(id) on delete cascade,
  notification_type text not null check (notification_type ~ '^[A-Z][A-Z0-9_]{2,80}$'),
  channel text not null check (channel in ('email','sms')),
  recipient_address text,
  template_key text not null,
  template_version integer not null default 1 check (template_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  reference_type text not null check (reference_type ~ '^[a-z][a-z0-9_]{2,80}$'),
  reference_id uuid not null,
  delivery_secret_id uuid references public.notification_delivery_secrets(id) on delete set null,
  deduplication_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  eligibility_reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 6 check (max_attempts between 1 and 20),
  manual_retry_count integer not null default 0 check (manual_retry_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  provider text,
  provider_message_id text,
  last_error_code text,
  last_error_message text check (last_error_message is null or char_length(last_error_message)<=500),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status='processing' and locked_at is not null and locked_by is not null)
    or (status<>'processing' and locked_at is null and locked_by is null)
  )
);

create index notification_outbox_due_idx on public.notification_outbox(available_at,created_at)
  where status='pending';
create index notification_outbox_org_created_idx on public.notification_outbox(organization_id,created_at desc);
create index notification_outbox_customer_idx on public.notification_outbox(recipient_customer_id,created_at desc);
create index notification_outbox_reference_idx on public.notification_outbox(reference_id,created_at desc);
create index estimate_approval_links_active_expiry_idx on public.estimate_approval_links(expires_at,id)
  where status='active';

create trigger notification_outbox_updated_at before update on public.notification_outbox
for each row execute function public.set_updated_at();

alter table public.notification_delivery_secrets enable row level security;
alter table public.notification_outbox enable row level security;
revoke all on table public.notification_delivery_secrets,public.notification_outbox from public,anon,authenticated;
grant select,insert,update on table public.notification_delivery_secrets,public.notification_outbox to service_role;

-- Existing staff reads remain available, but the service-role-only secret table
-- is never exposed through the approval-link table or its safe status RPC.
revoke select on table public.estimate_approval_links from authenticated;
grant select(id,organization_id,branch_id,job_order_id,estimate_id,estimate_version,
  estimate_total_centavos,token_hash,status,expires_at,created_by,created_at,used_at,
  revoked_at,customer_comment) on table public.estimate_approval_links to authenticated;

create function public.cancel_approval_link_notifications() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare cancellation_reason text;
begin
  if old.status is not distinct from new.status or new.status='active' then return new; end if;
  cancellation_reason:=case new.status
    when 'approved' then 'CUSTOMER_APPROVED'
    when 'declined' then 'CUSTOMER_DECLINED'
    when 'revoked' then 'LINK_REVOKED'
    when 'superseded' then 'ESTIMATE_SUPERSEDED'
    when 'expired' then 'LINK_EXPIRED'
    else 'APPROVAL_CYCLE_ENDED' end;

  with cancelled as (
    update public.notification_outbox
      set status='cancelled',eligibility_reason=cancellation_reason,cancelled_at=now(),
          locked_at=null,locked_by=null,last_error_code=null,last_error_message=null
      where reference_id=new.id and status in ('pending','processing')
      returning id,organization_id,channel,notification_type
  )
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    select organization_id,auth.uid(),'notification',id,'notification.cancelled',
      jsonb_build_object('channel',channel,'notification_type',notification_type,'reason',cancellation_reason)
    from cancelled;

  update public.notification_delivery_secrets
    set ciphertext=null,initialization_vector=null,authentication_tag=null,destroyed_at=now()
    where id=new.delivery_secret_id and destroyed_at is null;
  return new;
end $$;

create trigger estimate_approval_link_notification_cancellation
after update of status on public.estimate_approval_links
for each row execute function public.cancel_approval_link_notifications();

create function public.create_estimate_approval_link(
  p_estimate_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_secret_ciphertext text,
  p_secret_initialization_vector text,
  p_secret_authentication_tag text
) returns table(link_id uuid,expires_at timestamptz,email_status text,email_reason text,sms_status text,sms_reason text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  estimate_row public.estimates;
  job_row public.job_orders;
  customer_row public.customers;
  preference_row public.customer_communication_preferences;
  created_link_id uuid;
  created_secret_id uuid;
  normalized_email text;
  normalized_mobile text;
  selected_email_reason text;
  selected_sms_reason text;
  safe_payload jsonb;
  replaced_link record;
begin
  select * into estimate_row from public.estimates where id=p_estimate_id for update;
  if estimate_row.id is null
    or not public.has_org_role(estimate_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(estimate_row.organization_id,estimate_row.branch_id)
  then raise exception 'Estimate not found' using errcode='42501'; end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()+interval '1 hour'
    or p_expires_at > now()+interval '14 days'
  then raise exception 'Invalid approval link'; end if;
  if estimate_row.status not in ('draft','sent')
    or not exists(select 1 from public.estimate_items where estimate_id=estimate_row.id)
    or exists(select 1 from public.estimates newer where newer.job_order_id=estimate_row.job_order_id and newer.version>estimate_row.version)
  then raise exception 'Only the current undecided estimate can be shared'; end if;

  if (p_secret_ciphertext is null)<>(p_secret_initialization_vector is null)
    or (p_secret_ciphertext is null)<>(p_secret_authentication_tag is null)
    or char_length(coalesce(p_secret_ciphertext,''))>512
    or char_length(coalesce(p_secret_initialization_vector,''))>128
    or char_length(coalesce(p_secret_authentication_tag,''))>128
  then raise exception 'Invalid delivery secret'; end if;

  select * into job_row from public.job_orders where id=estimate_row.job_order_id;
  select * into customer_row from public.customers where id=job_row.customer_id and organization_id=estimate_row.organization_id;
  if job_row.id is null or customer_row.id is null then raise exception 'Estimate customer not found'; end if;
  select * into preference_row from public.customer_communication_preferences
    where customer_id=customer_row.id and organization_id=estimate_row.organization_id;

  for replaced_link in
    update public.estimate_approval_links set status='revoked',revoked_at=now()
      where estimate_id=estimate_row.id and status='active' returning id
  loop
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(estimate_row.organization_id,auth.uid(),'estimate_approval_link',replaced_link.id,
      'estimate.approval_link_revoked',jsonb_build_object('reason','replaced'));
  end loop;

  if p_secret_ciphertext is not null then
    insert into public.notification_delivery_secrets(
      organization_id,ciphertext,initialization_vector,authentication_tag,expires_at
    ) values(
      estimate_row.organization_id,p_secret_ciphertext,p_secret_initialization_vector,p_secret_authentication_tag,p_expires_at
    ) returning id into created_secret_id;
  end if;

  insert into public.estimate_approval_links(
    organization_id,branch_id,job_order_id,estimate_id,estimate_version,
    estimate_total_centavos,token_hash,expires_at,created_by,delivery_secret_id
  ) values(
    estimate_row.organization_id,estimate_row.branch_id,estimate_row.job_order_id,estimate_row.id,estimate_row.version,
    estimate_row.total_centavos,p_token_hash,p_expires_at,auth.uid(),created_secret_id
  ) returning id into created_link_id;

  normalized_email:=case
    when lower(trim(coalesce(customer_row.email,''))) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then lower(trim(customer_row.email)) else null end;
  normalized_mobile:=public.normalize_ph_mobile(customer_row.phone);
  selected_email_reason:=case
    when nullif(trim(coalesce(customer_row.email,'')),'') is null then 'EMAIL_MISSING'
    when normalized_email is null then 'EMAIL_INVALID'
    when not coalesce(preference_row.email_opt_in,false) then 'EMAIL_OPTED_OUT'
    when created_secret_id is null then 'DELIVERY_SECRET_UNAVAILABLE'
    else null end;
  selected_sms_reason:=case
    when nullif(trim(coalesce(customer_row.phone,'')),'') is null then 'SMS_MISSING'
    when normalized_mobile is null then 'SMS_INVALID'
    when not coalesce(preference_row.sms_opt_in,false) then 'SMS_OPTED_OUT'
    when created_secret_id is null then 'DELIVERY_SECRET_UNAVAILABLE'
    else null end;

  select jsonb_build_object(
    'businessName',organization.name,
    'branchName',branch.name,
    'vehicleLabel',trim(concat_ws(' ',vehicle.make,vehicle.model)),
    'plateNumber',vehicle.plate_number,
    'amountCentavos',estimate_row.total_centavos,
    'expiresAt',p_expires_at
  ) into safe_payload
  from public.organizations organization
  join public.branches branch on branch.id=estimate_row.branch_id and branch.organization_id=organization.id
  join public.vehicles vehicle on vehicle.id=job_row.vehicle_id and vehicle.organization_id=organization.id
  where organization.id=estimate_row.organization_id;

  insert into public.notification_outbox(
    organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,
    template_key,template_version,payload,reference_type,reference_id,delivery_secret_id,
    deduplication_key,status,eligibility_reason,expires_at,cancelled_at
  ) values
  (estimate_row.organization_id,estimate_row.branch_id,customer_row.id,'ESTIMATE_AWAITING_APPROVAL','email',normalized_email,
    'estimate-awaiting-approval-email-v1',1,safe_payload,'estimate_approval_link',created_link_id,created_secret_id,
    'estimate-approval:'||created_link_id||':v'||estimate_row.version||':email:initial',
    case when selected_email_reason is null then 'pending' else 'cancelled' end,selected_email_reason,p_expires_at,
    case when selected_email_reason is null then null else now() end),
  (estimate_row.organization_id,estimate_row.branch_id,customer_row.id,'ESTIMATE_AWAITING_APPROVAL','sms',normalized_mobile,
    'estimate-awaiting-approval-sms-v1',1,safe_payload,'estimate_approval_link',created_link_id,created_secret_id,
    'estimate-approval:'||created_link_id||':v'||estimate_row.version||':sms:initial',
    case when selected_sms_reason is null then 'pending' else 'cancelled' end,selected_sms_reason,p_expires_at,
    case when selected_sms_reason is null then null else now() end);

  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values
    (estimate_row.organization_id,auth.uid(),'estimate_approval_link',created_link_id,'estimate.approval_link_created',
      jsonb_build_object('estimate_id',estimate_row.id,'version',estimate_row.version,'amount_centavos',estimate_row.total_centavos,'expires_at',p_expires_at)),
    (estimate_row.organization_id,auth.uid(),'estimate',estimate_row.id,'estimate.approval_requested',
      jsonb_build_object('link_id',created_link_id,'version',estimate_row.version,'amount_centavos',estimate_row.total_centavos));

  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    select organization_id,auth.uid(),'notification',id,'notification.queued',
      jsonb_build_object('channel',channel,'notification_type',notification_type,'template_key',template_key)
    from public.notification_outbox where reference_id=created_link_id and status='pending';

  return query select created_link_id,p_expires_at,
    case when selected_email_reason is null then 'pending' else 'cancelled' end,selected_email_reason,
    case when selected_sms_reason is null then 'pending' else 'cancelled' end,selected_sms_reason;
end $$;

-- Compatibility overload for existing callers and SQL fixtures. It creates the
-- link and explicit non-deliverable channel rows without persisting raw data.
create or replace function public.create_estimate_approval_link(
  p_estimate_id uuid,p_token_hash text,p_expires_at timestamptz
) returns table(link_id uuid,expires_at timestamptz)
language sql security definer set search_path=public,pg_temp as $$
  select created.link_id,created.expires_at
  from public.create_estimate_approval_link(
    p_estimate_id,p_token_hash,p_expires_at,null,null,null
  ) created
$$;

create function public.claim_notification_outbox_batch(
  p_worker_id text,p_batch_size integer default 25,p_lease_minutes integer default 15
) returns setof public.notification_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  if nullif(trim(coalesce(p_worker_id,'')),'') is null or char_length(p_worker_id)>120
    or p_batch_size not between 1 and 50 or p_lease_minutes not between 5 and 60
  then raise exception 'Invalid claim request'; end if;

  update public.notification_outbox
    set status=case when attempt_count>=max_attempts then 'failed' else 'pending' end,
        failed_at=case when attempt_count>=max_attempts then now() else failed_at end,
        available_at=case when attempt_count>=max_attempts then available_at else now() end,
        locked_at=null,locked_by=null,
        last_error_code=case when attempt_count>=max_attempts then 'MAX_ATTEMPTS' else 'STALE_LOCK_RECOVERED' end,
        last_error_message=case when attempt_count>=max_attempts then 'Maximum delivery attempts reached.' else 'A stale worker lease was recovered.' end
    where status='processing' and locked_at<=now()-make_interval(mins=>p_lease_minutes);

  update public.notification_outbox
    set status='cancelled',cancelled_at=now(),eligibility_reason='MESSAGE_EXPIRED',locked_at=null,locked_by=null
    where status in ('pending','processing') and expires_at is not null and expires_at<=now();

  update public.notification_delivery_secrets
    set ciphertext=null,initialization_vector=null,authentication_tag=null,destroyed_at=now()
    where destroyed_at is null and expires_at<=now();

  return query
  with candidates as (
    select id from public.notification_outbox
      where status='pending' and available_at<=now() and attempt_count<max_attempts
      order by available_at,created_at
      for update skip locked limit p_batch_size
  )
  update public.notification_outbox outbox
    set status='processing',locked_at=now(),locked_by=p_worker_id
    from candidates where outbox.id=candidates.id
    returning outbox.*;
end $$;

create function public.record_notification_delivery_result(
  p_outbox_id uuid,p_worker_id text,p_result text,p_provider text default null,
  p_provider_message_id text default null,p_error_code text default null,
  p_error_message text default null,p_next_available_at timestamptz default null
) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.notification_outbox; next_attempt_count integer; final_status text;
begin
  if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  if p_result not in ('sent','retry','failed','cancelled') then raise exception 'Invalid delivery result'; end if;
  select * into row_data from public.notification_outbox where id=p_outbox_id for update;
  if row_data.id is null or row_data.status<>'processing' or row_data.locked_by<>p_worker_id
  then raise exception 'Notification claim is no longer active' using errcode='40001'; end if;

  next_attempt_count:=row_data.attempt_count+case when p_result='cancelled' then 0 else 1 end;
  final_status:=case
    when p_result='retry' and next_attempt_count<row_data.max_attempts then 'pending'
    when p_result='retry' then 'failed'
    else p_result end;

  update public.notification_outbox set
    status=final_status,
    attempt_count=next_attempt_count,
    available_at=case when final_status='pending' then coalesce(p_next_available_at,now()+interval '5 minutes') else available_at end,
    locked_at=null,locked_by=null,
    last_attempt_at=case when p_result='cancelled' then last_attempt_at else now() end,
    sent_at=case when final_status='sent' then now() else sent_at end,
    failed_at=case when final_status='failed' then now() else null end,
    cancelled_at=case when final_status='cancelled' then now() else cancelled_at end,
    provider=nullif(left(coalesce(p_provider,''),80),''),
    provider_message_id=case when final_status='sent' then nullif(left(coalesce(p_provider_message_id,''),200),'') else null end,
    eligibility_reason=case when final_status='cancelled' then nullif(left(coalesce(p_error_code,''),80),'') else eligibility_reason end,
    last_error_code=case when final_status in ('pending','failed') then nullif(left(coalesce(p_error_code,''),80),'') else null end,
    last_error_message=case when final_status in ('pending','failed') then nullif(left(coalesce(p_error_message,''),500),'') else null end
  where id=row_data.id;

  if final_status in ('sent','failed','cancelled') then
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(row_data.organization_id,null,'notification',row_data.id,'notification.'||final_status,
      jsonb_strip_nulls(jsonb_build_object('channel',row_data.channel,'notification_type',row_data.notification_type,
        'provider',nullif(left(coalesce(p_provider,''),80),''),'error_code',nullif(left(coalesce(p_error_code,''),80),''))));
  end if;
  return final_status;
end $$;

create function public.enqueue_due_estimate_approval_reminders(p_limit integer default 50) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare queued_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
  if p_limit not between 1 and 100 then raise exception 'Invalid reminder limit'; end if;
  with due as (
    select initial.* from public.notification_outbox initial
    join public.estimate_approval_links link on link.id=initial.reference_id
    join public.notification_delivery_secrets secret on secret.id=initial.delivery_secret_id
    where initial.notification_type='ESTIMATE_AWAITING_APPROVAL'
      and initial.status<>'cancelled'
      and link.status='active' and link.expires_at>now() and link.expires_at<=now()+interval '24 hours'
      and secret.destroyed_at is null and secret.expires_at>now()
      and not exists(
        select 1 from public.notification_outbox existing
        where existing.deduplication_key='estimate-approval:'||link.id||':v'||link.estimate_version||':'||initial.channel||':reminder-1'
      )
    order by link.expires_at,initial.created_at limit p_limit
  ), inserted as (
    insert into public.notification_outbox(
      organization_id,branch_id,recipient_customer_id,notification_type,channel,recipient_address,
      template_key,template_version,payload,reference_type,reference_id,delivery_secret_id,
      deduplication_key,status,expires_at
    )
    select organization_id,branch_id,recipient_customer_id,'ESTIMATE_APPROVAL_REMINDER',channel,recipient_address,
      case channel when 'email' then 'estimate-approval-reminder-email-v1' else 'estimate-approval-reminder-sms-v1' end,
      1,payload,reference_type,reference_id,delivery_secret_id,
      regexp_replace(deduplication_key,':initial$',':reminder-1'),'pending',expires_at
    from due on conflict(deduplication_key) do nothing
    returning id,organization_id,channel,notification_type,template_key
  ), audited as (
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      select organization_id,null,'notification',id,'estimate.approval_reminder_queued',
        jsonb_build_object('channel',channel,'notification_type',notification_type,'template_key',template_key)
      from inserted returning 1
  ) select count(*)::integer into queued_count from audited;
  return queued_count;
end $$;

create function public.get_estimate_approval_delivery_status(p_job_order_id uuid)
returns table(
  outbox_id uuid,approval_link_id uuid,notification_type text,channel text,status text,
  eligibility_reason text,attempt_count integer,last_attempt_at timestamptz,sent_at timestamptz,
  failed_at timestamptz,last_error_code text,created_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; selected_link_id uuid;
begin
  select * into job_row from public.job_orders where id=p_job_order_id;
  if job_row.id is null
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job order not found' using errcode='42501'; end if;
  select link.id into selected_link_id from public.estimate_approval_links link
    where link.job_order_id=job_row.id order by link.created_at desc limit 1;
  return query select outbox.id,outbox.reference_id,outbox.notification_type,outbox.channel,outbox.status,
    outbox.eligibility_reason,outbox.attempt_count,outbox.last_attempt_at,outbox.sent_at,
    outbox.failed_at,outbox.last_error_code,outbox.created_at
    from public.notification_outbox outbox where outbox.reference_id=selected_link_id
    order by outbox.created_at;
end $$;

create function public.retry_notification_outbox(p_outbox_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_data public.notification_outbox; link_row public.estimate_approval_links;
begin
  select * into row_data from public.notification_outbox where id=p_outbox_id for update;
  select * into link_row from public.estimate_approval_links where id=row_data.reference_id;
  if row_data.id is null or link_row.id is null
    or not public.has_org_role(row_data.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(row_data.organization_id,row_data.branch_id)
  then raise exception 'Notification not found' using errcode='42501'; end if;
  if row_data.status<>'failed' then raise exception 'Only failed notifications can be retried'; end if;
  if link_row.status<>'active' or link_row.expires_at<=now() then raise exception 'Approval link is no longer active'; end if;
  if row_data.delivery_secret_id is null or not exists(
    select 1 from public.notification_delivery_secrets secret
    where secret.id=row_data.delivery_secret_id and secret.destroyed_at is null and secret.expires_at>now()
  ) then raise exception 'Secure approval delivery is no longer available'; end if;
  update public.notification_outbox set status='pending',attempt_count=0,manual_retry_count=manual_retry_count+1,
    available_at=now(),failed_at=null,last_error_code=null,last_error_message=null
    where id=row_data.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(row_data.organization_id,auth.uid(),'notification',row_data.id,'notification.manual_retry',
      jsonb_build_object('channel',row_data.channel,'notification_type',row_data.notification_type));
end $$;

revoke all on function public.normalize_ph_mobile(text),
  public.create_estimate_approval_link(uuid,text,timestamptz,text,text,text),
  public.claim_notification_outbox_batch(text,integer,integer),
  public.record_notification_delivery_result(uuid,text,text,text,text,text,text,timestamptz),
  public.enqueue_due_estimate_approval_reminders(integer),
  public.get_estimate_approval_delivery_status(uuid),public.retry_notification_outbox(uuid)
  from public,anon,authenticated;
grant execute on function public.create_estimate_approval_link(uuid,text,timestamptz,text,text,text),
  public.get_estimate_approval_delivery_status(uuid),public.retry_notification_outbox(uuid) to authenticated;
grant execute on function public.claim_notification_outbox_batch(text,integer,integer),
  public.record_notification_delivery_result(uuid,text,text,text,text,text,text,timestamptz),
  public.enqueue_due_estimate_approval_reminders(integer) to service_role;
