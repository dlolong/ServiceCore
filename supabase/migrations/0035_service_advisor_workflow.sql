-- KarKR Service Advisor workflow: explicit authorization metadata, estimate parts,
-- and transaction-safe work/release readiness. Core inventory and payments remain unchanged.

alter table public.estimates
  add column authorization_method text check (authorization_method in ('in_person','phone','sms','messenger','email','other')),
  add column authorized_total_centavos bigint check (authorized_total_centavos is null or authorized_total_centavos >= 0);

alter table public.estimate_items
  add column item_type text not null default 'service' check (item_type in ('service','part','product','other')),
  add column inventory_item_id uuid references public.inventory_items(id) on delete restrict;

create index estimate_items_inventory_idx on public.estimate_items(inventory_item_id) where inventory_item_id is not null;

create or replace function public.recalculate_estimate(p_estimate_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates; subtotal_value bigint;
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if e.id is null then raise exception 'Estimate not found'; end if;
  select coalesce(sum(line_total_centavos),0) into subtotal_value from public.estimate_items where estimate_id=e.id;
  if e.discount_centavos>subtotal_value then raise exception 'Estimate discount exceeds subtotal'; end if;
  update public.estimates set subtotal_centavos=subtotal_value,total_centavos=subtotal_value-discount_centavos+tax_centavos,
    status=case when status='approved' then 'draft'::public.estimate_status else status end,
    approved_at=case when status='approved' then null else approved_at end,
    approved_by=case when status='approved' then null else approved_by end,
    approval_note=case when status='approved' then null else approval_note end,
    authorization_method=case when status='approved' then null else authorization_method end,
    authorized_total_centavos=case when status='approved' then null else authorized_total_centavos end
  where id=e.id;
  if e.status='approved' then
    update public.job_orders set status='queued' where id=e.job_order_id and status='approved';
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(e.organization_id,auth.uid(),'estimate',e.id,'estimate.authorization_invalidated',jsonb_build_object('version',e.version));
  end if;
end $$;

create or replace function public.save_estimate_item(p_estimate_id uuid,p_item_id uuid,p_item_type text,p_inventory_item_id uuid,p_description text,p_quantity integer,p_unit_price_centavos bigint,p_discount_centavos bigint default 0)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates; item public.estimate_items; inventory public.inventory_items; job_status public.job_status; result_id uuid; line_total bigint;
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if e.id is null or not public.has_org_role(e.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(e.organization_id,e.branch_id) then raise exception 'Estimate not found' using errcode='42501'; end if;
  if e.status in ('declined','expired','superseded') then raise exception 'This estimate cannot be changed'; end if;
  select status into job_status from public.job_orders where id=e.job_order_id;
  if job_status not in ('draft','queued','awaiting_approval','approved') or exists(select 1 from public.invoices where job_order_id=e.job_order_id and status<>'void') then raise exception 'This estimate is locked after work or invoicing begins'; end if;
  if p_item_type not in ('service','part','product','other') or p_quantity<=0 or p_unit_price_centavos<0 or p_discount_centavos<0 or p_discount_centavos>p_quantity*p_unit_price_centavos or nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'Invalid estimate item'; end if;
  if p_item_type in ('part','product') then
    select * into inventory from public.inventory_items where id=p_inventory_item_id and organization_id=e.organization_id and branch_id=e.branch_id and is_active;
    if inventory.id is null then raise exception 'Select an active inventory item from this branch'; end if;
  elsif p_inventory_item_id is not null then raise exception 'Only parts or products may reference inventory'; end if;
  line_total:=p_quantity*p_unit_price_centavos-p_discount_centavos;
  if p_item_id is null then
    insert into public.estimate_items(estimate_id,organization_id,item_type,inventory_item_id,description_snapshot,quantity,unit_price_centavos,discount_centavos,line_total_centavos)
    values(e.id,e.organization_id,p_item_type,p_inventory_item_id,trim(p_description),p_quantity,p_unit_price_centavos,p_discount_centavos,line_total) returning id into result_id;
  else
    select * into item from public.estimate_items where id=p_item_id and estimate_id=e.id for update;
    if item.id is null then raise exception 'Estimate item not found' using errcode='42501'; end if;
    update public.estimate_items set item_type=p_item_type,inventory_item_id=p_inventory_item_id,description_snapshot=trim(p_description),quantity=p_quantity,unit_price_centavos=p_unit_price_centavos,discount_centavos=p_discount_centavos,line_total_centavos=line_total where id=item.id returning id into result_id;
  end if;
  perform public.recalculate_estimate(e.id);
  return result_id;
end $$;

create or replace function public.record_estimate_authorization(p_estimate_id uuid,p_decision text,p_method text,p_note text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates; target public.estimate_status;
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if e.id is null or not public.has_org_role(e.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(e.organization_id,e.branch_id) then raise exception 'Estimate not found' using errcode='42501'; end if;
  if e.status not in ('draft','sent') or p_decision not in ('approve','decline') or p_method not in ('in_person','phone','sms','messenger','email','other') then raise exception 'The estimate may have changed. Refresh and try again.'; end if;
  if not exists(select 1 from public.estimate_items where estimate_id=e.id) then raise exception 'An estimate must have at least one item'; end if;
  target:=case when p_decision='approve' then 'approved'::public.estimate_status else 'declined'::public.estimate_status end;
  update public.estimates set status=target,approved_at=now(),approved_by=auth.uid(),approval_note=nullif(trim(coalesce(p_note,'')),''),authorization_method=p_method,authorized_total_centavos=e.total_centavos where id=e.id;
  update public.job_orders set status=case when target='approved' and status in ('draft','queued','awaiting_approval') then 'approved'::public.job_status else status end where id=e.job_order_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(e.organization_id,auth.uid(),'estimate',e.id,case when target='approved' then 'estimate.authorized' else 'estimate.declined' end,jsonb_build_object('version',e.version,'amount_centavos',e.total_centavos,'method',p_method));
end $$;

-- Keep the established estimate action compatible. New advisor UI records a
-- method explicitly; legacy approval is truthfully labeled as "other".
create or replace function public.transition_estimate(p_estimate_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates;
begin
  if p_action in ('approve','decline') then perform public.record_estimate_authorization(p_estimate_id,p_action,'other',p_note); return; end if;
  select * into e from public.estimates where id=p_estimate_id for update;
  if e.id is null or not public.has_org_role(e.organization_id,array['owner','manager','advisor']::public.organization_role[]) or not public.can_access_branch(e.organization_id,e.branch_id) then raise exception 'Estimate not found' using errcode='42501'; end if;
  if p_action<>'send' or e.status<>'draft' then raise exception 'Invalid estimate transition'; end if;
  update public.estimates set status='sent' where id=e.id;
end $$;

create or replace function public.transition_job(p_job_id uuid,p_action text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; target public.job_status; current_estimate public.estimates; invoice_row public.invoices; missing_parts integer;
begin
  select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor','technician']::public.organization_role[]) or not public.can_access_branch(j.organization_id,j.branch_id) then raise exception 'Job not found' using errcode='42501'; end if;
  if public.has_org_role(j.organization_id,array['technician']::public.organization_role[]) and j.primary_technician_user_id is distinct from auth.uid() then raise exception 'Job not assigned' using errcode='42501'; end if;
  if p_action='start' then
    if not exists(select 1 from public.job_inspections where job_order_id=j.id) then raise exception 'Complete the vehicle inspection before work starts'; end if;
    select * into current_estimate from public.estimates where job_order_id=j.id order by version desc limit 1;
    if current_estimate.id is null or current_estimate.status<>'approved' or current_estimate.authorized_total_centavos is distinct from current_estimate.total_centavos then raise exception 'Current customer authorization is required before work starts'; end if;
    select count(*) into missing_parts from (
      select ei.inventory_item_id,ei.quantity::numeric required_quantity from public.estimate_items ei where ei.estimate_id=current_estimate.id and ei.inventory_item_id is not null
      union all
      select sc.inventory_item_id,(sc.quantity*ji.quantity)::numeric from public.job_order_items ji join public.service_consumables sc on sc.service_id=ji.service_id where ji.job_order_id=j.id and ji.approval_status='approved'
    ) requirements join public.inventory_items i on i.id=requirements.inventory_item_id
    where i.organization_id<>j.organization_id or i.branch_id<>j.branch_id or public.inventory_item_balance(i.id)<requirements.required_quantity;
    if missing_parts>0 then raise exception 'Required parts are not available at this branch'; end if;
  end if;
  if p_action='complete' then
    select * into invoice_row from public.invoices where job_order_id=j.id and status<>'void';
    if invoice_row.id is null then raise exception 'Issue an invoice before releasing the vehicle'; end if;
    if invoice_row.balance_centavos>0 then raise exception 'Full payment is required before releasing the vehicle'; end if;
  end if;
  target:=case when p_action='start' and j.status in ('queued','approved') then 'in_progress' when p_action='hold' and j.status='in_progress' then 'on_hold' when p_action='resume' and j.status='on_hold' then 'in_progress' when p_action='quality_check' and j.status='in_progress' then 'quality_check' when p_action='ready' and j.status='quality_check' then 'ready_for_release' when p_action='complete' and j.status in ('ready','ready_for_release') then 'completed' when p_action='cancel' and j.status in ('draft','queued') then 'cancelled' else null end;
  if target is null then raise exception 'This job order status transition is not allowed'; end if;
  update public.job_orders set status=target,started_at=case when target='in_progress' and started_at is null then now() else started_at end,completed_at=case when target='completed' then now() else completed_at end where id=j.id;
end $$;

revoke all on function public.recalculate_estimate(uuid),public.save_estimate_item(uuid,uuid,text,uuid,text,integer,bigint,bigint),public.record_estimate_authorization(uuid,text,text,text) from public,anon;
grant execute on function public.save_estimate_item(uuid,uuid,text,uuid,text,integer,bigint,bigint),public.record_estimate_authorization(uuid,text,text,text) to authenticated;
