-- Public booking uses Core requests and appointments for both supported verticals.
-- No existing shop is published automatically and no historical rows are rewritten.
alter table public.organizations drop constraint organizations_public_booking_industry_check;
alter table public.public_booking_requests alter column vehicle_make drop not null;
alter table public.public_booking_requests alter column vehicle_model drop not null;

create or replace function public.get_public_shop(p_slug text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('slug',o.slug,'name',o.name,'industry',o.industry,'description',o.public_description,'logoUrl',o.logo_url,'coverUrl',o.cover_url,'phone',o.phone,'email',o.email,'website',o.website,'facebook',o.facebook_page,'instagram',o.instagram_url,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'timezone',b.timezone,'description',b.public_description,'phone',b.phone,'email',b.email,'address',array[b.address_line,b.barangay,b.city,b.province,b.postal_code,b.country],'mapUrl',b.map_url,'hours',b.opening_hours,'acceptsBookings',b.accepts_public_bookings) order by b.is_primary desc,b.name) from public.branches b where b.organization_id=o.id and b.is_active),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'durationMinutes',s.duration_minutes,'priceCentavos',s.base_price_centavos,'category',c.name) order by c.sort_order,s.name) from public.services s left join public.service_categories c on c.id=s.category_id and c.organization_id=o.id where s.organization_id=o.id and s.is_active and s.is_public),'[]'::jsonb),
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt_text) order by g.sort_order,g.created_at) from public.shop_gallery_images g where g.organization_id=o.id and g.is_active),'[]'::jsonb))
 from public.organizations o where o.slug=lower(trim(p_slug)) and o.status='active' and o.public_page_enabled
$$;

create or replace function public.get_public_booking_status(p_token text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('reference',r.public_reference,'status',r.status,'industry',o.industry,'timezone',b.timezone,'shopName',o.name,'branchName',b.name,'preferredAt',r.preferred_at,
   'services',(select jsonb_agg(s.service_name_snapshot order by s.service_name_snapshot) from public.public_booking_services s where s.booking_request_id=r.id),
   'declineReason',case when r.status='declined' then r.decline_reason end)
 from public.public_booking_requests r join public.organizations o on o.id=r.organization_id
 join public.branches b on b.id=r.branch_id and b.organization_id=r.organization_id
 where r.confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
$$;

-- Private validators: callers cannot use these to probe unpublished tenants.
create or replace function public.public_booking_service_duration(p_organization_id uuid,p_branch_id uuid,p_service_ids uuid[])
returns integer language plpgsql stable security definer set search_path=public,pg_temp as $$
declare service_count integer; duration integer;
begin
  if coalesce(cardinality(p_service_ids),0) not between 1 and 10
    or cardinality(p_service_ids)<>(select count(distinct value) from unnest(p_service_ids) value) then
    raise exception 'Invalid booking request';
  end if;
  if not exists(select 1 from public.organizations o join public.branches b on b.organization_id=o.id
    where o.id=p_organization_id and o.status='active' and o.public_page_enabled
      and b.id=p_branch_id and b.is_active and b.accepts_public_bookings) then
    raise exception 'Shop unavailable';
  end if;
  select count(*),coalesce(sum(s.duration_minutes),0) into service_count,duration
  from public.services s where s.id=any(p_service_ids) and s.organization_id=p_organization_id and s.is_active and s.is_public
    and (not exists(select 1 from public.service_branch_availability a where a.service_id=s.id)
      or exists(select 1 from public.service_branch_availability a where a.service_id=s.id and a.branch_id=p_branch_id and a.is_available));
  if service_count<>cardinality(p_service_ids) or duration<=0 then raise exception 'Service unavailable'; end if;
  return duration;
end $$;

create or replace function public.public_booking_slot_is_available(p_organization_id uuid,p_branch_id uuid,p_starts_at timestamptz,p_duration integer,p_require_grid boolean default false)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare hours jsonb; tz text; day_hours jsonb; day date; opens_at timestamptz; closes_at timestamptz; requested_end timestamptz;
begin
  if p_starts_at is null or p_starts_at<=now() or p_duration is null or p_duration<=0 then return false; end if;
  select b.opening_hours,b.timezone into hours,tz from public.branches b
    where b.organization_id=p_organization_id and b.id=p_branch_id and b.is_active and b.accepts_public_bookings;
  if not found or jsonb_typeof(hours)<>'object' then return false; end if;
  day:=(p_starts_at at time zone tz)::date;
  day_hours:=hours->lower(to_char(day,'FMDay'));
  if (day_hours is not null and jsonb_typeof(day_hours)<>'object') or (day_hours ? 'closed' and jsonb_typeof(day_hours->'closed')<>'boolean') then return false; end if;
  if coalesce(day_hours->'closed','false'::jsonb)='true'::jsonb then return false; end if;
  opens_at:=(day+coalesce((day_hours->>'open')::time,'08:00'::time)) at time zone tz;
  closes_at:=(day+coalesce((day_hours->>'close')::time,'17:00'::time)) at time zone tz;
  requested_end:=p_starts_at+make_interval(mins=>p_duration);
  return p_starts_at>=opens_at and requested_end<=closes_at
    and (not p_require_grid or mod(extract(epoch from p_starts_at-opens_at),1800)=0) and not exists(
    select 1 from public.appointments a where a.organization_id=p_organization_id and a.branch_id=p_branch_id
      and a.status in('requested','confirmed','checked_in','in_service','queued')
      and a.starts_at<requested_end and coalesce(a.ends_at,a.starts_at+interval '1 hour')>p_starts_at
  );
exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then return false;
end $$;

create or replace function public.get_public_availability(p_slug text,p_branch_id uuid,p_service_id uuid,p_date date)
returns table(slot_at timestamptz) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org_id uuid; hours jsonb; tz text; day_hours jsonb; duration integer; opens_at timestamptz; closes_at timestamptz;
begin
  select o.id into org_id from public.organizations o where o.slug=lower(trim(p_slug)) and o.public_page_enabled and o.status='active';
  if org_id is null then return; end if;
  begin duration:=public.public_booking_service_duration(org_id,p_branch_id,array[p_service_id]);
  exception when sqlstate 'P0001' then return; end;
  select b.opening_hours,b.timezone into hours,tz from public.branches b where b.id=p_branch_id and b.organization_id=org_id;
  if p_date is null or p_date<(now() at time zone tz)::date or p_date>(now() at time zone tz)::date+60 then return; end if;
  day_hours:=hours->lower(to_char(p_date,'FMDay'));
  if jsonb_typeof(hours)<>'object' or (day_hours is not null and jsonb_typeof(day_hours)<>'object') or (day_hours ? 'closed' and jsonb_typeof(day_hours->'closed')<>'boolean') then return; end if;
  if coalesce(day_hours->'closed','false'::jsonb)='true'::jsonb then return; end if;
  opens_at:=(p_date+coalesce((day_hours->>'open')::time,'08:00'::time)) at time zone tz;
  closes_at:=(p_date+coalesce((day_hours->>'close')::time,'17:00'::time)) at time zone tz;
  return query select candidate from generate_series(opens_at,closes_at-make_interval(mins=>duration),interval '30 minutes') candidate
    where candidate>now()+interval '1 hour' and candidate<=now()+interval '60 days'
      and public.public_booking_slot_is_available(org_id,p_branch_id,candidate,duration);
exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then return;
end $$;

create or replace function public.submit_public_booking(
 p_slug text,p_branch_id uuid,p_service_ids uuid[],p_preferred_at timestamptz,p_customer_name text,p_phone text,p_email text,
 p_vehicle_make text,p_vehicle_model text,p_vehicle_year integer,p_vehicle_type text,p_plate_number text,p_customer_note text,p_rate_key_hash text,p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 org_id uuid; org_industry text; request_id uuid; token text:=encode(extensions.gen_random_bytes(32),'hex'); reference text;
 normalized_phone text; normalized_email text; normalized_plate text; dup text;
 window_time timestamptz:=date_trunc('hour',now())+(floor(extract(minute from now())/15)*interval '15 minutes');
 current_count integer; service_id uuid; sorted_services uuid[]; duration integer;
begin
  if coalesce(p_honeypot,'')<>'' then raise exception 'Unable to submit booking'; end if;
  if p_preferred_at is null or p_preferred_at<=now()+interval '1 hour' or p_preferred_at>now()+interval '60 days' then raise exception 'Invalid booking request'; end if;
  normalized_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g');
  normalized_email:=nullif(lower(trim(coalesce(p_email,''))),'');
  if char_length(trim(coalesce(p_customer_name,''))) not between 2 and 120
    or char_length(trim(coalesce(p_phone,''))) not between 7 and 30 or normalized_phone!~'^\+?[0-9]{7,15}$'
    or char_length(coalesce(p_email,''))>254 or (normalized_email is not null and normalized_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or char_length(coalesce(p_customer_note,''))>1000 or char_length(coalesce(p_rate_key_hash,'')) not between 1 and 128 then raise exception 'Invalid booking details'; end if;
  select o.id,o.industry into org_id,org_industry from public.organizations o where o.slug=lower(trim(p_slug)) and o.public_page_enabled and o.status='active' for share;
  if org_id is null then raise exception 'Shop unavailable'; end if;
  -- The canonical scheduling lock serializes confirmation with internal edits.
  -- Requests do not reserve capacity; confirmation rechecks it under this lock.
  perform pg_advisory_xact_lock(hashtextextended(p_branch_id::text,0));
  perform 1 from public.branches b where b.id=p_branch_id and b.organization_id=org_id for share;
  perform 1 from public.services s where s.id=any(p_service_ids) and s.organization_id=org_id order by s.id for share;
  duration:=public.public_booking_service_duration(org_id,p_branch_id,p_service_ids);
  if org_industry='automotive' then
    if char_length(trim(coalesce(p_vehicle_make,''))) not between 1 and 80 or char_length(trim(coalesce(p_vehicle_model,''))) not between 1 and 80
      or (p_vehicle_year is not null and p_vehicle_year not between 1900 and 2200)
      or char_length(coalesce(p_vehicle_type,''))>80 or char_length(coalesce(p_plate_number,''))>30 then raise exception 'Invalid booking details'; end if;
  else
    -- Salon never writes a vehicle, even if an old or tampered client sends one.
    p_vehicle_make:=null;p_vehicle_model:=null;p_vehicle_year:=null;p_vehicle_type:=null;p_plate_number:=null;
  end if;
  if not public.public_booking_slot_is_available(org_id,p_branch_id,p_preferred_at,duration,true) then raise exception 'Selected booking time is unavailable'; end if;
  insert into public.public_booking_rate_limits(key_hash,window_started_at,request_count) values(p_rate_key_hash,window_time,1)
    on conflict(key_hash,window_started_at) do update set request_count=public.public_booking_rate_limits.request_count+1 returning request_count into current_count;
  if current_count>5 then raise exception 'Too many booking requests'; end if;
  select array_agg(value order by value) into sorted_services from unnest(p_service_ids) value;
  -- Existing pending requests retain their historical hash. Compare the actual
  -- request identity as well, without rewriting data or weakening uniqueness.
  if exists(select 1 from public.public_booking_requests r
    where r.organization_id=org_id and r.branch_id=p_branch_id and r.status='requested'
      and r.phone_normalized=normalized_phone and r.email_normalized is not distinct from normalized_email
      and r.preferred_at=p_preferred_at
      and (select array_agg(s.service_id order by s.service_id) from public.public_booking_services s where s.booking_request_id=r.id)=sorted_services
  ) then raise exception 'A similar booking request is already pending'; end if;
  normalized_plate:=nullif(upper(regexp_replace(coalesce(p_plate_number,''),'[^A-Za-z0-9]','','g')),'');
  dup:=encode(extensions.digest(org_id::text||p_branch_id::text||normalized_phone||coalesce(normalized_email,'')||extract(epoch from p_preferred_at)::text||array_to_string(sorted_services,','),'sha256'),'hex');
  reference:='BK-'||upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10));
  insert into public.public_booking_requests(organization_id,branch_id,public_reference,confirmation_token_hash,customer_name,phone,phone_normalized,email,email_normalized,vehicle_make,vehicle_model,vehicle_year,vehicle_type,plate_number,plate_normalized,preferred_at,customer_note,duplicate_hash,rate_key_hash)
    values(org_id,p_branch_id,reference,encode(extensions.digest(token,'sha256'),'hex'),trim(p_customer_name),trim(p_phone),normalized_phone,normalized_email,normalized_email,trim(p_vehicle_make),trim(p_vehicle_model),p_vehicle_year,nullif(trim(coalesce(p_vehicle_type,'')),''),nullif(trim(coalesce(p_plate_number,'')),''),normalized_plate,p_preferred_at,nullif(trim(coalesce(p_customer_note,'')),''),dup,p_rate_key_hash) returning id into request_id;
  foreach service_id in array sorted_services loop
    insert into public.public_booking_services(booking_request_id,service_id,service_name_snapshot,price_centavos,duration_minutes)
      select request_id,s.id,s.name,public.resolve_service_price(s.id,p_branch_id,case when org_industry='automotive' then lower(replace(coalesce(p_vehicle_type,'custom'),' ','_')) end),s.duration_minutes from public.services s where s.id=service_id;
  end loop;
  return jsonb_build_object('reference',reference,'token',token);
exception when unique_violation then raise exception 'A similar booking request is already pending';
end $$;

create or replace function public.review_public_booking(p_booking_id uuid,p_action text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.public_booking_requests; cust_id uuid; veh_id uuid; new_appointment_id uuid; item record; org_industry text; service_ids uuid[]; duration integer;
begin
  select * into r from public.public_booking_requests where id=p_booking_id for update;
  if auth.uid() is null or r.id is null or not public.has_permission(r.organization_id,'appointments.manage') or not public.can_access_branch(r.organization_id,r.branch_id) then raise exception 'Booking request not found' using errcode='42501'; end if;
  if r.status<>'requested' or p_action is null or p_action not in('confirm','decline') then raise exception 'Invalid booking transition'; end if;
  if char_length(coalesce(p_reason,''))>1000 then raise exception 'Invalid review details'; end if;
  if p_action='decline' then
    update public.public_booking_requests set status='declined',decline_reason=nullif(trim(coalesce(p_reason,'')),''),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.branch_id::text,0));
  select o.industry into org_industry from public.organizations o where o.id=r.organization_id for share;
  perform 1 from public.branches b where b.id=r.branch_id and b.organization_id=r.organization_id for share;
  select array_agg(s.service_id order by s.service_id) into service_ids from public.public_booking_services s where s.booking_request_id=r.id;
  perform 1 from public.services s where s.id=any(service_ids) and s.organization_id=r.organization_id order by s.id for share;
  duration:=public.public_booking_service_duration(r.organization_id,r.branch_id,service_ids);
  if not public.public_booking_slot_is_available(r.organization_id,r.branch_id,r.preferred_at,duration) then raise exception 'Selected booking time is unavailable'; end if;
  -- Serialize customer matching across different branches of this tenant.
  perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text||':public-booking-customer',0));
  select c.id into cust_id from public.customers c where c.organization_id=r.organization_id and (c.phone_normalized=r.phone_normalized or (r.email_normalized is not null and lower(c.email)=r.email_normalized)) order by c.created_at,c.id limit 1;
  if cust_id is null then
    insert into public.customers(organization_id,full_name,phone,phone_normalized,email,created_by) values(r.organization_id,r.customer_name,r.phone,r.phone_normalized,r.email_normalized,auth.uid()) returning id into cust_id;
  end if;
  if org_industry='automotive' then
    if char_length(trim(coalesce(r.vehicle_make,'')))=0 or char_length(trim(coalesce(r.vehicle_model,'')))=0 then raise exception 'Invalid booking vehicle details'; end if;
    if r.plate_normalized is not null then select v.id into veh_id from public.vehicles v where v.organization_id=r.organization_id and v.customer_id=cust_id and v.plate_normalized=r.plate_normalized limit 1; end if;
    if veh_id is null then
      insert into public.vehicles(organization_id,customer_id,make,model,model_year,vehicle_type,plate_number,plate_normalized) values(r.organization_id,cust_id,r.vehicle_make,r.vehicle_model,r.vehicle_year,r.vehicle_type,r.plate_number,r.plate_normalized) returning id into veh_id;
    end if;
  end if;
  insert into public.appointments(organization_id,branch_id,customer_id,vehicle_id,status,source,starts_at,customer_note,created_by)
    values(r.organization_id,r.branch_id,cust_id,veh_id,'confirmed','public_booking',r.preferred_at,r.customer_note,auth.uid()) returning id into new_appointment_id;
  -- Canonical service triggers resolve tenant/branch pricing, service names,
  -- duration snapshots, expected total and ends_at for both verticals.
  for item in select unnest(service_ids) as service_id loop
    insert into public.appointment_services(appointment_id,service_id,service_name_snapshot,unit_price_centavos,duration_minutes) values(new_appointment_id,item.service_id,'pending',0,1);
  end loop;
  update public.public_booking_requests set status='confirmed',appointment_id=new_appointment_id,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
  return new_appointment_id;
end $$;

revoke all on function public.public_booking_service_duration(uuid,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.public_booking_slot_is_available(uuid,uuid,timestamptz,integer,boolean) from public,anon,authenticated;
revoke all on function public.get_public_booking_status(text) from public;
grant execute on function public.get_public_booking_status(text) to anon,authenticated;
revoke all on function public.get_public_shop(text),public.get_public_availability(text,uuid,uuid,date),public.submit_public_booking(text,uuid,uuid[],timestamptz,text,text,text,text,text,integer,text,text,text,text,text),public.review_public_booking(uuid,text,text) from public;
revoke all on function public.review_public_booking(uuid,text,text) from anon;
grant execute on function public.get_public_shop(text),public.get_public_availability(text,uuid,uuid,date),public.submit_public_booking(text,uuid,uuid[],timestamptz,text,text,text,text,text,integer,text,text,text,text,text) to anon,authenticated;
grant execute on function public.review_public_booking(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
