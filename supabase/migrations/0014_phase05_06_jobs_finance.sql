-- Combined Phase 05-06: job execution, inspections, estimates, invoices, and payments.

alter type public.job_status add value if not exists 'awaiting_approval' after 'draft';
alter type public.job_status add value if not exists 'approved' after 'awaiting_approval';
alter type public.job_status add value if not exists 'on_hold' after 'in_progress';
alter type public.job_status add value if not exists 'ready_for_release' after 'quality_check';

create type public.estimate_status as enum ('draft','sent','approved','declined','expired','superseded');
create type public.invoice_status as enum ('draft','issued','partially_paid','paid','void');

alter table public.job_orders
  add column queue_entry_id uuid references public.queue_entries(id) on delete restrict,
  add column advisor_user_id uuid references auth.users(id),
  add column primary_technician_user_id uuid references auth.users(id),
  add column fuel_level_percent integer check(fuel_level_percent between 0 and 100),
  add column actual_total_centavos bigint not null default 0 check(actual_total_centavos >= 0),
  add column estimated_duration_minutes integer not null default 0 check(estimated_duration_minutes >= 0);
create unique index job_orders_queue_entry_unique on public.job_orders(queue_entry_id) where queue_entry_id is not null;
create unique index job_orders_branch_number_unique on public.job_orders(branch_id,job_number) where job_number is not null;

alter table public.job_order_items
  add column duration_minutes integer not null default 60 check(duration_minutes > 0),
  add column approval_status text not null default 'approved' check(approval_status in ('proposed','approved','declined')),
  add column technician_user_id uuid references auth.users(id),
  add column notes text;

alter table public.payments
  add column invoice_id uuid,
  add column notes text,
  add column received_by uuid references auth.users(id);

create table public.job_number_counters (
  branch_id uuid not null references public.branches(id) on delete cascade,
  number_year integer not null,
  last_number bigint not null default 0,
  primary key(branch_id,number_year)
);

create table public.job_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_order_id uuid not null unique references public.job_orders(id) on delete cascade,
  checklist jsonb not null default '{}'::jsonb,
  exterior_notes text,
  interior_notes text,
  tire_notes text,
  light_notes text,
  windshield_notes text,
  damage_notes text,
  warning_indicator_notes text,
  belongings_note text,
  inspected_by uuid references auth.users(id),
  inspected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_order_id uuid not null references public.job_orders(id) on delete cascade,
  category text not null check(category in ('check_in','damage','before','after')),
  storage_path text not null unique,
  caption text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_order_id uuid not null references public.job_orders(id) on delete restrict,
  version integer not null default 1,
  status public.estimate_status not null default 'draft',
  subtotal_centavos bigint not null check(subtotal_centavos >= 0),
  discount_centavos bigint not null default 0 check(discount_centavos >= 0),
  tax_centavos bigint not null default 0 check(tax_centavos >= 0),
  total_centavos bigint not null check(total_centavos >= 0),
  notes text,
  expires_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  approval_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_order_id,version)
);
create table public.estimate_items (
  id uuid primary key default gen_random_uuid(), estimate_id uuid not null references public.estimates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_order_item_id uuid references public.job_order_items(id) on delete restrict,
  description_snapshot text not null, quantity integer not null check(quantity>0),
  unit_price_centavos bigint not null check(unit_price_centavos>=0), discount_centavos bigint not null default 0 check(discount_centavos>=0),
  line_total_centavos bigint not null check(line_total_centavos>=0)
);

create table public.invoice_number_counters (
  branch_id uuid not null references public.branches(id) on delete cascade,
  number_year integer not null, last_number bigint not null default 0,
  primary key(branch_id,number_year)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict, job_order_id uuid not null unique references public.job_orders(id) on delete restrict,
  estimate_id uuid references public.estimates(id) on delete restrict, invoice_number text not null,
  status public.invoice_status not null default 'draft', customer_name_snapshot text not null, vehicle_snapshot text not null,
  subtotal_centavos bigint not null, discount_centavos bigint not null default 0, tax_centavos bigint not null default 0,
  total_centavos bigint not null check(total_centavos>=0), paid_centavos bigint not null default 0 check(paid_centavos>=0), balance_centavos bigint not null check(balance_centavos>=0),
  issued_at timestamptz, voided_at timestamptz, notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(branch_id,invoice_number)
);
alter table public.payments add constraint payments_invoice_fk foreign key(invoice_id) references public.invoices(id) on delete restrict;
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade, description_snapshot text not null,
  quantity integer not null check(quantity>0), unit_price_centavos bigint not null check(unit_price_centavos>=0),
  discount_centavos bigint not null default 0 check(discount_centavos>=0), line_total_centavos bigint not null check(line_total_centavos>=0)
);

create function public.recalculate_job_order() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target uuid; total bigint; duration integer;
begin target:=case when tg_op='DELETE' then old.job_order_id else new.job_order_id end; select coalesce(sum(line_total_centavos),0),coalesce(sum(duration_minutes*quantity),0) into total,duration from public.job_order_items where job_order_id=target and approval_status='approved'; update public.job_orders set actual_total_centavos=total,estimated_duration_minutes=duration where id=target; if tg_op='DELETE' then return old; else return new; end if; end $$;
create trigger job_items_recalculate after insert or update or delete on public.job_order_items for each row execute function public.recalculate_job_order();

create function public.convert_queue_to_job(p_queue_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.queue_entries; a public.appointments; created_id uuid; next_no bigint; yr integer;
begin
  select * into q from public.queue_entries where id=p_queue_id for update;
  if q.id is null or not public.has_org_role(q.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Queue entry not found' using errcode='42501'; end if;
  if q.status not in ('waiting','called','ready') then raise exception 'Queue entry cannot start a job'; end if;
  if exists(select 1 from public.job_orders where queue_entry_id=q.id) then raise exception 'Queue entry already has a job'; end if;
  select * into a from public.appointments where id=q.appointment_id; yr:=extract(year from now() at time zone 'Asia/Manila');
  insert into public.job_number_counters(branch_id,number_year,last_number) values(q.branch_id,yr,1) on conflict(branch_id,number_year) do update set last_number=public.job_number_counters.last_number+1 returning last_number into next_no;
  insert into public.job_orders(organization_id,branch_id,customer_id,vehicle_id,appointment_id,queue_entry_id,job_number,status,customer_concern,advisor_user_id,created_by)
  values(q.organization_id,q.branch_id,q.customer_id,q.vehicle_id,q.appointment_id,q.id,next_no,'queued',a.customer_note,auth.uid(),auth.uid()) returning id into created_id;
  insert into public.job_order_items(organization_id,job_order_id,service_id,service_name_snapshot,quantity,unit_price_centavos,line_total_centavos,duration_minutes)
  select q.organization_id,created_id,service_id,service_name_snapshot,1,unit_price_centavos,unit_price_centavos,duration_minutes from public.appointment_services where appointment_id=q.appointment_id;
  update public.queue_entries set status='converted_to_job' where id=q.id; return created_id;
end $$;

create function public.transition_job(p_job_id uuid,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; target public.job_status;
begin select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor','technician']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501'; end if;
  if public.has_org_role(j.organization_id,array['technician']::public.organization_role[]) and j.primary_technician_user_id<>auth.uid() then raise exception 'Job not assigned' using errcode='42501'; end if;
  target:=case when p_action='start' and j.status in ('queued','approved') then 'in_progress' when p_action='hold' and j.status='in_progress' then 'on_hold' when p_action='resume' and j.status='on_hold' then 'in_progress' when p_action='quality_check' and j.status='in_progress' then 'quality_check' when p_action='ready' and j.status='quality_check' then 'ready_for_release' when p_action='complete' and j.status in ('ready','ready_for_release') then 'completed' when p_action='cancel' and j.status in ('draft','queued') then 'cancelled' else null end;
  if target is null then raise exception 'Invalid job transition'; end if;
  update public.job_orders set status=target,started_at=case when target='in_progress' and started_at is null then now() else started_at end,completed_at=case when target='completed' then now() else completed_at end where id=j.id;
end $$;

create function public.update_job_details(p_job_id uuid,p_technician_id uuid default null,p_promised_at timestamptz default null,p_odometer_in integer default null,p_fuel_level integer default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders;
begin select * into j from public.job_orders where id=p_job_id for update; if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501'; end if;
if p_technician_id is not null and not exists(select 1 from public.organization_memberships where organization_id=j.organization_id and user_id=p_technician_id and is_active and role='technician') then raise exception 'Technician is not an active member'; end if;
if p_odometer_in is not null and p_odometer_in<0 or p_fuel_level is not null and (p_fuel_level<0 or p_fuel_level>100) then raise exception 'Invalid check-in details'; end if;
update public.job_orders set primary_technician_user_id=coalesce(p_technician_id,primary_technician_user_id),promised_at=coalesce(p_promised_at,promised_at),odometer_in_km=coalesce(p_odometer_in,odometer_in_km),fuel_level_percent=coalesce(p_fuel_level,fuel_level_percent) where id=j.id; end $$;

create function public.create_estimate(p_job_id uuid,p_discount_centavos bigint default 0,p_tax_centavos bigint default 0,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; eid uuid; subtotal bigint; version_no integer;
begin select * into j from public.job_orders where id=p_job_id for update; if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501'; end if;
  select coalesce(sum(line_total_centavos),0) into subtotal from public.job_order_items where job_order_id=j.id and approval_status<>'declined'; if p_discount_centavos<0 or p_tax_centavos<0 or p_discount_centavos>subtotal then raise exception 'Invalid estimate totals'; end if;
  select coalesce(max(version),0)+1 into version_no from public.estimates where job_order_id=j.id; update public.estimates set status='superseded' where job_order_id=j.id and status in ('draft','sent');
  insert into public.estimates(organization_id,branch_id,job_order_id,version,subtotal_centavos,discount_centavos,tax_centavos,total_centavos,notes,created_by) values(j.organization_id,j.branch_id,j.id,version_no,subtotal,p_discount_centavos,p_tax_centavos,subtotal-p_discount_centavos+p_tax_centavos,p_notes,auth.uid()) returning id into eid;
  insert into public.estimate_items(estimate_id,organization_id,job_order_item_id,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos) select eid,j.organization_id,id,service_name_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos from public.job_order_items where job_order_id=j.id and approval_status<>'declined'; return eid;
end $$;

create function public.transition_estimate(p_estimate_id uuid,p_action text,p_note text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates; target public.estimate_status;
begin select * into e from public.estimates where id=p_estimate_id for update; if e.id is null or not public.has_org_role(e.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Estimate not found' using errcode='42501'; end if;
target:=case when p_action='send' and e.status='draft' then 'sent' when p_action='approve' and e.status in ('draft','sent') then 'approved' when p_action='decline' and e.status in ('draft','sent') then 'declined' else null end; if target is null then raise exception 'Invalid estimate transition'; end if;
update public.estimates set status=target,approved_at=case when target='approved' then now() else approved_at end,approved_by=case when target='approved' then auth.uid() else approved_by end,approval_note=p_note where id=e.id; update public.job_orders set status=case when target='approved' then 'approved' else status end where id=e.job_order_id; end $$;

create function public.issue_invoice(p_job_id uuid,p_estimate_id uuid default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; e public.estimates; inv uuid; next_no bigint; yr integer; number_text text; cname text; vname text; subtotal bigint; discount bigint:=0; tax bigint:=0; total bigint;
begin select * into j from public.job_orders where id=p_job_id for update; if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','cashier']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501'; end if; if exists(select 1 from public.invoices where job_order_id=j.id) then raise exception 'Job already invoiced'; end if;
if p_estimate_id is not null then select * into e from public.estimates where id=p_estimate_id and job_order_id=j.id and status='approved'; if e.id is null then raise exception 'Approved estimate required'; end if; subtotal:=e.subtotal_centavos;discount:=e.discount_centavos;tax:=e.tax_centavos;total:=e.total_centavos; else select coalesce(sum(line_total_centavos),0) into subtotal from public.job_order_items where job_order_id=j.id and approval_status='approved';total:=subtotal;end if;
select full_name into cname from public.customers where id=j.customer_id; select concat_ws(' ',make,model,plate_number) into vname from public.vehicles where id=j.vehicle_id;yr:=extract(year from now() at time zone 'Asia/Manila');insert into public.invoice_number_counters(branch_id,number_year,last_number) values(j.branch_id,yr,1) on conflict(branch_id,number_year) do update set last_number=public.invoice_number_counters.last_number+1 returning last_number into next_no;number_text:='INV-'||yr||'-'||lpad(next_no::text,6,'0');
insert into public.invoices(organization_id,branch_id,job_order_id,estimate_id,invoice_number,status,customer_name_snapshot,vehicle_snapshot,subtotal_centavos,discount_centavos,tax_centavos,total_centavos,balance_centavos,issued_at,notes,created_by) values(j.organization_id,j.branch_id,j.id,p_estimate_id,number_text,'issued',cname,vname,subtotal,discount,tax,total,total,now(),p_notes,auth.uid()) returning id into inv;
insert into public.invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos) select inv,j.organization_id,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos from public.estimate_items where estimate_id=p_estimate_id;
if p_estimate_id is null then insert into public.invoice_items(invoice_id,organization_id,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos) select inv,j.organization_id,service_name_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos from public.job_order_items where job_order_id=j.id and approval_status='approved';end if;return inv;end $$;

create function public.record_invoice_payment(p_invoice_id uuid,p_amount_centavos bigint,p_method public.payment_method,p_reference text default null,p_notes text default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.invoices; pid uuid; new_paid bigint;
begin select * into i from public.invoices where id=p_invoice_id for update; if i.id is null or not public.has_org_role(i.organization_id,array['owner','manager','cashier']::public.organization_role[]) then raise exception 'Invoice not found' using errcode='42501'; end if;if i.status not in ('issued','partially_paid') or p_amount_centavos<=0 or p_amount_centavos>i.balance_centavos then raise exception 'Invalid payment amount';end if;
insert into public.payments(organization_id,branch_id,job_order_id,invoice_id,amount_centavos,method,status,reference,paid_at,notes,received_by,created_by) values(i.organization_id,i.branch_id,i.job_order_id,i.id,p_amount_centavos,p_method,'paid',nullif(trim(coalesce(p_reference,'')),''),now(),nullif(trim(coalesce(p_notes,'')),''),auth.uid(),auth.uid()) returning id into pid;new_paid:=i.paid_centavos+p_amount_centavos;update public.invoices set paid_centavos=new_paid,balance_centavos=total_centavos-new_paid,status=case when new_paid=total_centavos then 'paid' else 'partially_paid' end where id=i.id;return pid;end $$;

-- Tighten direct writes: trusted RPCs own financial state and job transitions.
drop policy if exists jobs_ops_write on public.job_orders; drop policy if exists job_items_ops_write on public.job_order_items; drop policy if exists payments_finance_write on public.payments;
revoke insert,update,delete on public.job_orders,public.job_order_items,public.payments from authenticated;
alter table public.job_inspections enable row level security; alter table public.job_photos enable row level security; alter table public.estimates enable row level security; alter table public.estimate_items enable row level security; alter table public.invoices enable row level security; alter table public.invoice_items enable row level security;
create policy inspections_select on public.job_inspections for select to authenticated using(public.is_org_member(organization_id)); create policy inspections_ops on public.job_inspections for all to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor','technician']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager','advisor','technician']::public.organization_role[]));
create policy photos_select on public.job_photos for select to authenticated using(public.is_org_member(organization_id)); create policy photos_ops on public.job_photos for all to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor','technician']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager','advisor','technician']::public.organization_role[]));
create policy estimates_select on public.estimates for select to authenticated using(public.is_org_member(organization_id)); create policy estimate_items_select on public.estimate_items for select to authenticated using(public.is_org_member(organization_id)); create policy invoices_finance_select on public.invoices for select to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[])); create policy invoice_items_finance_select on public.invoice_items for select to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]));
grant select on public.job_inspections,public.job_photos,public.estimates,public.estimate_items,public.invoices,public.invoice_items to authenticated; grant insert,update on public.job_inspections,public.job_photos to authenticated;
revoke all on public.job_number_counters,public.invoice_number_counters from authenticated;
grant execute on function public.convert_queue_to_job(uuid),public.transition_job(uuid,text),public.update_job_details(uuid,uuid,timestamptz,integer,integer),public.create_estimate(uuid,bigint,bigint,text),public.transition_estimate(uuid,text,text),public.issue_invoice(uuid,uuid,text),public.record_invoice_payment(uuid,bigint,public.payment_method,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('job-photos','job-photos',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy job_photos_storage_select on storage.objects for select to authenticated using(bucket_id='job-photos' and public.is_org_member((storage.foldername(name))[1]::uuid));
create policy job_photos_storage_insert on storage.objects for insert to authenticated with check(bucket_id='job-photos' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','manager','advisor','technician']::public.organization_role[]));
create policy job_photos_storage_delete on storage.objects for delete to authenticated using(bucket_id='job-photos' and public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','manager','advisor']::public.organization_role[]));

create trigger inspections_updated_at before update on public.job_inspections for each row execute function public.set_updated_at(); create trigger estimates_updated_at before update on public.estimates for each row execute function public.set_updated_at(); create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();

create function public.enforce_job_child_org() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare parent_org uuid; begin select organization_id into parent_org from public.job_orders where id=new.job_order_id; if parent_org is null or parent_org<>new.organization_id then raise exception 'Job child organization mismatch'; end if; return new; end $$;
create trigger inspection_job_org_guard before insert or update on public.job_inspections for each row execute function public.enforce_job_child_org();
create trigger photo_job_org_guard before insert or update on public.job_photos for each row execute function public.enforce_job_child_org();

create function public.audit_job_finance_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ declare row_data record; action text:=lower(tg_op); details jsonb:='{}'; begin row_data:=case when tg_op='DELETE' then old else new end; if tg_op='UPDATE' and (to_jsonb(old)->>'status') is distinct from (to_jsonb(new)->>'status') then action:='status_changed'; details:=jsonb_build_object('from',to_jsonb(old)->>'status','to',to_jsonb(new)->>'status'); end if; insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(row_data.organization_id,auth.uid(),tg_table_name,row_data.id,rtrim(tg_table_name,'s')||'.'||action,details); return case when tg_op='DELETE' then old else new end; end $$;
create trigger job_orders_finance_audit after insert or update or delete on public.job_orders for each row execute function public.audit_job_finance_change();
create trigger estimates_finance_audit after insert or update or delete on public.estimates for each row execute function public.audit_job_finance_change();
create trigger invoices_finance_audit after insert or update or delete on public.invoices for each row execute function public.audit_job_finance_change();
create trigger payments_finance_audit after insert or update or delete on public.payments for each row execute function public.audit_job_finance_change();
