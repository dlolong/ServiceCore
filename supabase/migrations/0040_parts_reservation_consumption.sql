-- Core inventory reservations and KarKR parts execution.
-- Physical stock remains authoritative in inventory_movements; reservations
-- only allocate that stock and never create a second on-hand quantity.

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  reference_type text not null check (reference_type ~ '^[a-z][a-z0-9_]{2,80}$'),
  reference_id uuid not null,
  quantity_reserved numeric(14,3) not null default 0 check (quantity_reserved > 0),
  quantity_consumed numeric(14,3) not null default 0 check (quantity_consumed >= 0),
  quantity_released numeric(14,3) not null default 0 check (quantity_released >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_consumed + quantity_released <= quantity_reserved),
  unique (organization_id,branch_id,inventory_item_id,reference_type,reference_id)
);

create table public.inventory_reservation_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reservation_id uuid not null references public.inventory_reservations(id) on delete cascade,
  operation_type text not null check (operation_type in ('reserve','consume','release')),
  quantity numeric(14,3) not null check (quantity > 0),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id,idempotency_key)
);

create index inventory_reservations_item_active_idx
  on public.inventory_reservations(inventory_item_id)
  where quantity_reserved > quantity_consumed + quantity_released;
create index inventory_reservations_reference_idx
  on public.inventory_reservations(organization_id,reference_type,reference_id);
create index inventory_reservation_operations_reservation_idx
  on public.inventory_reservation_operations(reservation_id,created_at);

create trigger inventory_reservations_updated_at before update on public.inventory_reservations
for each row execute function public.set_updated_at();

create function public.enforce_inventory_reservation_tenant() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare item public.inventory_items; reservation public.inventory_reservations; record_row public.vehicle_service_records;
begin
  if tg_table_name='inventory_reservations' then
    select * into item from public.inventory_items where id=new.inventory_item_id;
    if item.id is null or item.organization_id<>new.organization_id or item.branch_id<>new.branch_id
      then raise exception 'Inventory reservation tenant mismatch'; end if;
  elsif tg_table_name='inventory_reservation_operations' then
    select * into reservation from public.inventory_reservations where id=new.reservation_id;
    if reservation.id is null or reservation.organization_id<>new.organization_id
      then raise exception 'Inventory reservation operation tenant mismatch'; end if;
  else
    select * into record_row from public.vehicle_service_records where id=new.service_record_id;
    select * into reservation from public.inventory_reservations where id=new.source_inventory_reservation_id;
    select * into item from public.inventory_items where id=new.inventory_item_id;
    if record_row.id is null or reservation.id is null or item.id is null
      or record_row.organization_id<>new.organization_id or reservation.organization_id<>new.organization_id
      or item.organization_id<>new.organization_id or reservation.inventory_item_id<>new.inventory_item_id
      or reservation.reference_type<>'job_order' or reservation.reference_id<>record_row.source_job_order_id
      then raise exception 'Service history part tenant mismatch'; end if;
  end if;
  return new;
end $$;

create trigger inventory_reservations_tenant_guard before insert or update on public.inventory_reservations
for each row execute function public.enforce_inventory_reservation_tenant();
create trigger inventory_reservation_operations_tenant_guard before insert or update on public.inventory_reservation_operations
for each row execute function public.enforce_inventory_reservation_tenant();

alter table public.inventory_reservations enable row level security;
alter table public.inventory_reservation_operations enable row level security;

create policy inventory_reservations_select on public.inventory_reservations for select to authenticated
using (public.is_org_member(organization_id) and public.can_access_branch(organization_id,branch_id));
create policy inventory_reservation_operations_select on public.inventory_reservation_operations for select to authenticated
using (public.is_org_member(organization_id) and exists (
  select 1 from public.inventory_reservations reservation
  where reservation.id=reservation_id and public.can_access_branch(reservation.organization_id,reservation.branch_id)
));

revoke all on public.inventory_reservations,public.inventory_reservation_operations from public,anon,authenticated;
grant select on public.inventory_reservations,public.inventory_reservation_operations to authenticated;
grant all on public.inventory_reservations,public.inventory_reservation_operations to service_role;

create function public.inventory_reserved_balance(p_item_id uuid) returns numeric
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; result numeric;
begin
  select * into item from public.inventory_items where id=p_item_id;
  if item.id is null or (auth.role()<>'service_role' and (
    not public.is_org_member(item.organization_id) or not public.can_access_branch(item.organization_id,item.branch_id)
  )) then raise exception 'Inventory item not found' using errcode='42501'; end if;
  select coalesce(sum(quantity_reserved-quantity_consumed-quantity_released),0) into result
  from public.inventory_reservations
  where inventory_item_id=p_item_id and quantity_reserved>quantity_consumed+quantity_released;
  return result;
end
$$;

create or replace function public.inventory_item_balance(p_item_id uuid) returns numeric
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; result numeric;
begin
  select * into item from public.inventory_items where id=p_item_id;
  if item.id is null or (auth.role()<>'service_role' and (
    not public.is_org_member(item.organization_id) or not public.can_access_branch(item.organization_id,item.branch_id)
  )) then raise exception 'Inventory item not found' using errcode='42501'; end if;
  select coalesce(sum(quantity_delta),0) into result from public.inventory_movements where inventory_item_id=p_item_id;
  return result;
end $$;

create function public.inventory_available_balance(p_item_id uuid) returns numeric
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.inventory_items;
begin
  select * into item from public.inventory_items where id=p_item_id;
  if item.id is null or (auth.role()<>'service_role' and (
    not public.is_org_member(item.organization_id) or not public.can_access_branch(item.organization_id,item.branch_id)
  )) then raise exception 'Inventory item not found' using errcode='42501'; end if;
  return public.inventory_item_balance(p_item_id)-public.inventory_reserved_balance(p_item_id);
end
$$;

create view public.inventory_availability with (security_invoker=true) as
select stock.*,
  public.inventory_reserved_balance(stock.id)::numeric(14,3) quantity_reserved,
  public.inventory_available_balance(stock.id)::numeric(14,3) quantity_available
from public.inventory_stock stock;
grant select on public.inventory_availability to authenticated;

create view public.inventory_reservation_balances with (security_invoker=true) as
select reservation.*,
  (reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released)::numeric(14,3) quantity_remaining,
  case
    when reservation.quantity_consumed=reservation.quantity_reserved then 'consumed'
    when reservation.quantity_released=reservation.quantity_reserved then 'released'
    when reservation.quantity_consumed+reservation.quantity_released=reservation.quantity_reserved then 'reconciled'
    when reservation.quantity_consumed>0 then 'partially_consumed'
    when reservation.quantity_released>0 then 'partially_released'
    else 'reserved'
  end status
from public.inventory_reservations reservation;
grant select on public.inventory_reservation_balances to authenticated;

create function public.reserve_inventory(
  p_item_id uuid,p_reference_type text,p_reference_id uuid,p_quantity numeric,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; reservation_id uuid; operation_key text; prior_operation record;
begin
  select * into item from public.inventory_items where id=p_item_id for update;
  if item.id is null or not item.is_active
    or not public.has_org_role(item.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(item.organization_id,item.branch_id)
  then raise exception 'Inventory item not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity>999999999 or p_quantity<>round(p_quantity,3) or p_reference_id is null
    or coalesce(p_reference_type,'') !~ '^[a-z][a-z0-9_]{2,80}$'
    or operation_key is null or char_length(operation_key)>200
  then raise exception 'Invalid reservation'; end if;

  select operation.*,reservation.inventory_item_id,reservation.reference_type,reservation.reference_id into prior_operation
  from public.inventory_reservation_operations operation join public.inventory_reservations reservation on reservation.id=operation.reservation_id
  where operation.organization_id=item.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'reserve' or prior_operation.quantity<>p_quantity
      or prior_operation.inventory_item_id<>p_item_id or prior_operation.reference_type<>p_reference_type
      or prior_operation.reference_id<>p_reference_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.reservation_id;
  end if;

  if public.inventory_available_balance(item.id)<p_quantity then raise exception 'Insufficient available stock'; end if;
  insert into public.inventory_reservations(
    organization_id,branch_id,inventory_item_id,reference_type,reference_id,quantity_reserved,created_by
  ) values(item.organization_id,item.branch_id,item.id,p_reference_type,p_reference_id,p_quantity,auth.uid())
  on conflict(organization_id,branch_id,inventory_item_id,reference_type,reference_id) do update
    set quantity_reserved=inventory_reservations.quantity_reserved+excluded.quantity_reserved,updated_at=now()
  returning id into reservation_id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(item.organization_id,reservation_id,'reserve',p_quantity,operation_key,auth.uid());
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(item.organization_id,auth.uid(),'inventory_reservation',reservation_id,'inventory.reserved',
    jsonb_build_object('inventory_item_id',item.id,'branch_id',item.branch_id,'reference_type',p_reference_type,
      'reference_id',p_reference_id,'quantity',p_quantity));
  return reservation_id;
end $$;

create function public.consume_inventory_reservation(
  p_reservation_id uuid,p_quantity numeric,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare initial_reservation public.inventory_reservations; reservation public.inventory_reservations;
  item public.inventory_items; operation_key text; movement_id uuid; prior_operation record;
begin
  select * into initial_reservation from public.inventory_reservations where id=p_reservation_id;
  if initial_reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  select * into item from public.inventory_items where id=initial_reservation.inventory_item_id for update;
  select * into reservation from public.inventory_reservations where id=p_reservation_id for update;
  if reservation.id is null or item.id is null
    or not public.has_org_role(reservation.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(reservation.organization_id,reservation.branch_id)
  then raise exception 'Reservation not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity<>round(p_quantity,3) or operation_key is null or char_length(operation_key)>200 then raise exception 'Invalid consumption'; end if;
  select operation.*,movement.id movement_id into prior_operation from public.inventory_reservation_operations operation
    left join public.inventory_movements movement on movement.organization_id=operation.organization_id
      and movement.idempotency_key='reservation:'||operation.idempotency_key
    where operation.organization_id=reservation.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'consume' or prior_operation.quantity<>p_quantity
      or prior_operation.reservation_id<>p_reservation_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.movement_id;
  end if;
  if reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released<p_quantity
    then raise exception 'Consumption exceeds reserved quantity'; end if;
  if public.inventory_item_balance(item.id)<p_quantity then raise exception 'Insufficient physical stock'; end if;

  update public.inventory_reservations set quantity_consumed=quantity_consumed+p_quantity,updated_at=now()
    where id=reservation.id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(reservation.organization_id,reservation.id,'consume',p_quantity,operation_key,auth.uid());
  insert into public.inventory_movements(
    organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,
    idempotency_key,note,created_by
  ) values(reservation.organization_id,reservation.branch_id,reservation.inventory_item_id,'usage',-p_quantity,
    'inventory_reservation',reservation.id,'reservation:'||operation_key,'Reserved inventory consumed',auth.uid())
  returning id into movement_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(reservation.organization_id,auth.uid(),'inventory_reservation',reservation.id,'inventory.consumed',
    jsonb_build_object('inventory_item_id',reservation.inventory_item_id,'branch_id',reservation.branch_id,'quantity',p_quantity));
  return movement_id;
end $$;

create function public.release_inventory_reservation(
  p_reservation_id uuid,p_quantity numeric,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare initial_reservation public.inventory_reservations; reservation public.inventory_reservations;
  item public.inventory_items; operation_key text; operation_id uuid; prior_operation record;
begin
  select * into initial_reservation from public.inventory_reservations where id=p_reservation_id;
  if initial_reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  select * into item from public.inventory_items where id=initial_reservation.inventory_item_id for update;
  select * into reservation from public.inventory_reservations where id=p_reservation_id for update;
  if reservation.id is null or item.id is null
    or not public.has_org_role(reservation.organization_id,array['owner','manager','advisor','technician']::public.organization_role[])
    or not public.can_access_branch(reservation.organization_id,reservation.branch_id)
  then raise exception 'Reservation not found' using errcode='42501'; end if;
  operation_key:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if p_quantity<=0 or p_quantity<>round(p_quantity,3) or operation_key is null or char_length(operation_key)>200 then raise exception 'Invalid release'; end if;
  select operation.* into prior_operation from public.inventory_reservation_operations operation
    where operation.organization_id=reservation.organization_id and operation.idempotency_key=operation_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'release' or prior_operation.quantity<>p_quantity
      or prior_operation.reservation_id<>p_reservation_id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.id;
  end if;
  if reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released<p_quantity
    then raise exception 'Release exceeds remaining reservation'; end if;
  update public.inventory_reservations set quantity_released=quantity_released+p_quantity,updated_at=now()
    where id=reservation.id;
  insert into public.inventory_reservation_operations(
    organization_id,reservation_id,operation_type,quantity,idempotency_key,created_by
  ) values(reservation.organization_id,reservation.id,'release',p_quantity,operation_key,auth.uid()) returning id into operation_id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(reservation.organization_id,auth.uid(),'inventory_reservation',reservation.id,'inventory.released',
    jsonb_build_object('inventory_item_id',reservation.inventory_item_id,'branch_id',reservation.branch_id,'quantity',p_quantity));
  return operation_id;
end $$;

create function public.release_inventory_reference(
  p_reference_type text,p_reference_id uuid,p_idempotency_prefix text
) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare reservation record; released_count integer:=0;
begin
  for reservation in
    select id,quantity_reserved,(quantity_reserved-quantity_consumed-quantity_released) remaining
    from public.inventory_reservations
    where reference_type=p_reference_type and reference_id=p_reference_id
      and quantity_reserved>quantity_consumed+quantity_released order by inventory_item_id
  loop
    perform public.release_inventory_reservation(reservation.id,reservation.remaining,
      left(p_idempotency_prefix||':'||reservation.id||':allocation:'||reservation.quantity_reserved,200));
    released_count:=released_count+1;
  end loop;
  return released_count;
end $$;

-- Existing inventory adjustments now serialize with reservation operations and
-- cannot consume quantities already allocated to active work.
create or replace function public.record_inventory_movement(p_item_id uuid,p_type text,p_quantity numeric,p_note text default null,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; movement_id uuid; delta numeric; key_text text;
begin select * into item from public.inventory_items where id=p_item_id for update;
  if item.id is null or not public.has_org_role(item.organization_id,array['owner','manager']::public.organization_role[])
    or not public.can_access_branch(item.organization_id,item.branch_id) then raise exception 'Inventory item not found' using errcode='42501'; end if;
  if p_quantity<=0 or p_type not in ('opening','purchase','usage','adjustment','return','waste') then raise exception 'Invalid movement'; end if;
  delta:=case when p_type in ('usage','waste') then -p_quantity else p_quantity end;
  if delta<0 and public.inventory_available_balance(item.id)+delta<0 then raise exception 'Insufficient available stock'; end if;
  key_text:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,idempotency_key,note,created_by)
  values(item.organization_id,item.branch_id,item.id,p_type,delta,key_text,nullif(trim(coalesce(p_note,'')),''),auth.uid())
  on conflict(organization_id,idempotency_key) where idempotency_key is not null do update set idempotency_key=excluded.idempotency_key returning id into movement_id;
  return movement_id; end $$;

create or replace function public.transfer_inventory(p_source_item_id uuid,p_target_item_id uuid,p_quantity numeric,p_note text,p_idempotency_key text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare source_item public.inventory_items; target_item public.inventory_items; key_text text;
begin
  -- UUID ordering prevents deadlocks when simultaneous transfers use opposite directions.
  perform 1 from public.inventory_items where id in (p_source_item_id,p_target_item_id) order by id for update;
  select * into source_item from public.inventory_items where id=p_source_item_id;
  select * into target_item from public.inventory_items where id=p_target_item_id;
  if source_item.id is null or target_item.id is null or source_item.organization_id<>target_item.organization_id
    or not public.has_org_role(source_item.organization_id,array['owner','manager']::public.organization_role[])
    or not public.can_access_branch(source_item.organization_id,source_item.branch_id)
    or not public.can_access_branch(target_item.organization_id,target_item.branch_id)
  then raise exception 'Transfer not allowed' using errcode='42501'; end if;
  if source_item.id=target_item.id or p_quantity<=0 or p_quantity<>round(p_quantity,3)
    or coalesce(lower(source_item.sku),'')<>coalesce(lower(target_item.sku),'') then raise exception 'Invalid transfer'; end if;
  if public.inventory_available_balance(source_item.id)<p_quantity then raise exception 'Insufficient available stock'; end if;
  key_text:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  if key_text is null then raise exception 'Idempotency key required'; end if;
  if exists(select 1 from public.inventory_movements where organization_id=source_item.organization_id and idempotency_key=key_text||':out') then return; end if;
  insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,idempotency_key,note,created_by) values
  (source_item.organization_id,source_item.branch_id,source_item.id,'transfer_out',-p_quantity,'transfer',key_text||':out',p_note,auth.uid()),
  (target_item.organization_id,target_item.branch_id,target_item.id,'transfer_in',p_quantity,'transfer',key_text||':in',p_note,auth.uid());
end $$;

-- Automotive requirement projection. It intentionally lives above Core
-- Inventory and contains the Job Order/Estimate policy Core must not know.
create function public.automotive_job_part_requirements(p_job_order_id uuid)
returns table(inventory_item_id uuid,required_quantity numeric,recipe_quantity numeric)
language sql stable security definer set search_path=public,pg_temp as $$
  with current_estimate as (
    select estimate.id from public.estimates estimate where estimate.job_order_id=p_job_order_id
    order by estimate.version desc limit 1
  ), requirement_lines as (
    select item.inventory_item_id,item.quantity::numeric required_quantity,0::numeric recipe_quantity
    from public.estimate_items item join current_estimate estimate on estimate.id=item.estimate_id
    where item.inventory_item_id is not null
    union all
    select consumable.inventory_item_id,(consumable.quantity*job_item.quantity)::numeric,
      (consumable.quantity*job_item.quantity)::numeric
    from public.job_order_items job_item join public.service_consumables consumable on consumable.service_id=job_item.service_id
    where job_item.job_order_id=p_job_order_id and job_item.approval_status='approved'
  )
  select line.inventory_item_id,sum(line.required_quantity)::numeric,sum(line.recipe_quantity)::numeric
  from requirement_lines line group by line.inventory_item_id
$$;

create function public.get_job_parts_readiness(p_job_order_id uuid)
returns table(
  inventory_item_id uuid,reservation_id uuid,name text,sku text,unit text,required_quantity numeric,
  reserved_quantity numeric,consumed_quantity numeric,released_quantity numeric,remaining_reserved_quantity numeric,
  on_hand_quantity numeric,available_quantity numeric,shortage_quantity numeric,status text
) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders;
begin
  select * into job_row from public.job_orders where id=p_job_order_id;
  if job_row.id is null or not public.is_org_member(job_row.organization_id)
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;
  return query
  select requirement.inventory_item_id,reservation.id,item.name,item.sku,item.unit,requirement.required_quantity,
    coalesce(reservation.quantity_reserved,0),coalesce(reservation.quantity_consumed,0),
    coalesce(reservation.quantity_released,0),
    coalesce(reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released,0),
    public.inventory_item_balance(item.id),public.inventory_available_balance(item.id),
    greatest(requirement.required_quantity-coalesce(reservation.quantity_consumed,0)
      -coalesce(reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released,0),0),
    case
      when coalesce(reservation.quantity_consumed,0)>=requirement.required_quantity then 'CONSUMED'
      when coalesce(reservation.quantity_reserved-reservation.quantity_released,0)>=requirement.required_quantity then 'RESERVED'
      when coalesce(reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released,0)>0 then 'PARTIAL'
      when public.inventory_available_balance(item.id)>0 then 'AVAILABLE'
      else 'SHORTAGE'
    end
  from public.automotive_job_part_requirements(job_row.id) requirement
  join public.inventory_items item on item.id=requirement.inventory_item_id
    and item.organization_id=job_row.organization_id and item.branch_id=job_row.branch_id
  left join public.inventory_reservations reservation on reservation.organization_id=job_row.organization_id
    and reservation.branch_id=job_row.branch_id and reservation.inventory_item_id=requirement.inventory_item_id
    and reservation.reference_type='job_order' and reservation.reference_id=job_row.id
  order by item.name;
end $$;

create function public.assert_job_parts_operation(p_job_order_id uuid,p_item_id uuid default null)
returns public.job_orders language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; estimate_row public.estimates;
begin
  select * into job_row from public.job_orders where id=p_job_order_id for update;
  if job_row.id is null
    or not public.has_org_role(job_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then raise exception 'Job not found' using errcode='42501'; end if;
  if job_row.status in ('completed','cancelled') then raise exception 'Parts are locked for this Job Order'; end if;
  select * into estimate_row from public.estimates where job_order_id=job_row.id order by version desc limit 1;
  if estimate_row.id is null or estimate_row.status<>'approved'
    or estimate_row.authorized_total_centavos is distinct from estimate_row.total_centavos
  then raise exception 'Current customer authorization is required before reserving parts'; end if;
  if p_item_id is not null and not exists(
    select 1 from public.automotive_job_part_requirements(job_row.id) requirement
    join public.inventory_items item on item.id=requirement.inventory_item_id
      and item.organization_id=job_row.organization_id and item.branch_id=job_row.branch_id and item.is_active
    where requirement.inventory_item_id=p_item_id
  ) then raise exception 'Part is not required by this Job Order'; end if;
  if p_item_id is null and exists(
    select 1 from public.automotive_job_part_requirements(job_row.id) requirement
    left join public.inventory_items item on item.id=requirement.inventory_item_id
      and item.organization_id=job_row.organization_id and item.branch_id=job_row.branch_id and item.is_active
    where item.id is null
  ) then raise exception 'A required part is not available at this branch'; end if;
  return job_row;
end $$;

create function public.reserve_job_part(p_job_order_id uuid,p_item_id uuid,p_quantity numeric,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; required_quantity numeric; secured_quantity numeric; outstanding_quantity numeric; prior_operation record;
begin
  job_row:=public.assert_job_parts_operation(p_job_order_id,p_item_id);
  perform 1 from public.inventory_items where id=p_item_id for update;
  select operation.*,reservation.inventory_item_id,reservation.reference_type,reservation.reference_id into prior_operation
    from public.inventory_reservation_operations operation join public.inventory_reservations reservation on reservation.id=operation.reservation_id
    where operation.organization_id=job_row.organization_id and operation.idempotency_key=p_idempotency_key;
  if prior_operation.id is not null then
    if prior_operation.operation_type<>'reserve' or prior_operation.quantity<>p_quantity
      or prior_operation.inventory_item_id<>p_item_id or prior_operation.reference_type<>'job_order'
      or prior_operation.reference_id<>job_row.id then raise exception 'Idempotency key conflicts with another operation'; end if;
    return prior_operation.reservation_id;
  end if;
  select requirement.required_quantity into required_quantity
    from public.automotive_job_part_requirements(job_row.id) requirement where requirement.inventory_item_id=p_item_id;
  select coalesce(reservation.quantity_reserved-reservation.quantity_released,0) into secured_quantity
    from public.inventory_reservations reservation where reservation.organization_id=job_row.organization_id
      and reservation.branch_id=job_row.branch_id and reservation.inventory_item_id=p_item_id
      and reservation.reference_type='job_order' and reservation.reference_id=job_row.id;
  outstanding_quantity:=greatest(required_quantity-coalesce(secured_quantity,0),0);
  if p_quantity>outstanding_quantity then raise exception 'Reservation exceeds outstanding Job Order requirement'; end if;
  return public.reserve_inventory(p_item_id,'job_order',job_row.id,p_quantity,p_idempotency_key);
end $$;

create function public.reserve_job_required_parts(p_job_order_id uuid,p_idempotency_key text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; requirement record; reserve_quantity numeric; reserved_count integer:=0;
begin
  job_row:=public.assert_job_parts_operation(p_job_order_id,null);
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'Idempotency key required'; end if;
  for requirement in
    select required.inventory_item_id,required.required_quantity,
      coalesce(reservation.quantity_reserved-reservation.quantity_released,0) secured_quantity
    from public.automotive_job_part_requirements(job_row.id) required
    left join public.inventory_reservations reservation on reservation.organization_id=job_row.organization_id
      and reservation.branch_id=job_row.branch_id and reservation.inventory_item_id=required.inventory_item_id
      and reservation.reference_type='job_order' and reservation.reference_id=job_row.id
    order by required.inventory_item_id
  loop
    reserve_quantity:=greatest(requirement.required_quantity-requirement.secured_quantity,0);
    if reserve_quantity>0 then
      perform public.reserve_inventory(requirement.inventory_item_id,'job_order',job_row.id,reserve_quantity,
        left(p_idempotency_key||':'||requirement.inventory_item_id,200));
      reserved_count:=reserved_count+1;
    end if;
  end loop;
  return reserved_count;
end $$;

create function public.consume_job_part(p_job_order_id uuid,p_reservation_id uuid,p_quantity numeric,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; reservation public.inventory_reservations;
begin
  job_row:=public.assert_job_parts_operation(p_job_order_id,null);
  if job_row.status not in ('in_progress','on_hold','quality_check','ready','ready_for_release')
    then raise exception 'Start work before recording part usage'; end if;
  select * into reservation from public.inventory_reservations where id=p_reservation_id
    and organization_id=job_row.organization_id and branch_id=job_row.branch_id
    and reference_type='job_order' and reference_id=job_row.id;
  if reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  return public.consume_inventory_reservation(reservation.id,p_quantity,p_idempotency_key);
end $$;

create function public.release_job_part(p_job_order_id uuid,p_reservation_id uuid,p_quantity numeric,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare job_row public.job_orders; reservation public.inventory_reservations;
begin
  job_row:=public.assert_job_parts_operation(p_job_order_id,null);
  select * into reservation from public.inventory_reservations where id=p_reservation_id
    and organization_id=job_row.organization_id and branch_id=job_row.branch_id
    and reference_type='job_order' and reference_id=job_row.id;
  if reservation.id is null then raise exception 'Reservation not found' using errcode='42501'; end if;
  return public.release_inventory_reservation(reservation.id,p_quantity,p_idempotency_key);
end $$;

-- Estimate revisions invalidate allocations as well as customer authorization.
create or replace function public.recalculate_estimate(p_estimate_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.estimates; subtotal_value bigint;
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if e.id is null then raise exception 'Estimate not found'; end if;
  perform public.release_inventory_reference('job_order',e.job_order_id,'estimate-revision:'||e.id||':'||e.version);
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

-- Reservation-aware completion preserves legacy automatic recipe usage. Jobs
-- without reservations retain the old movement behavior. Reservation-aware jobs
-- consume recipe deficits, then release every unused allocation.
create or replace function public.consume_job_inventory(p_job_id uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; recipe record; reservation record; count_rows integer:=0; needed numeric; already_consumed numeric;
begin
  select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null then raise exception 'Job not found'; end if;
  if exists(select 1 from public.inventory_reservations where reference_type='job_order' and reference_id=j.id) then
    for recipe in
      select consumable.inventory_item_id,sum(consumable.quantity*item.quantity)::numeric needed
      from public.job_order_items item join public.service_consumables consumable on consumable.service_id=item.service_id
      where item.job_order_id=j.id and item.approval_status='approved'
      group by consumable.inventory_item_id order by consumable.inventory_item_id
    loop
      select coalesce(sum(quantity_consumed),0) into already_consumed from public.inventory_reservations
        where organization_id=j.organization_id and branch_id=j.branch_id and inventory_item_id=recipe.inventory_item_id
          and reference_type='job_order' and reference_id=j.id;
      needed:=greatest(recipe.needed-already_consumed,0);
      if needed>0 then
        select * into reservation from public.inventory_reservations
          where organization_id=j.organization_id and branch_id=j.branch_id and inventory_item_id=recipe.inventory_item_id
            and reference_type='job_order' and reference_id=j.id for update;
        if reservation.id is null or reservation.quantity_reserved-reservation.quantity_consumed-reservation.quantity_released<needed
          then raise exception 'Reserved service consumables are incomplete'; end if;
        perform public.consume_inventory_reservation(reservation.id,needed,
          left('job-completion-consume:'||j.id||':'||recipe.inventory_item_id,200));
        count_rows:=count_rows+1;
      end if;
    end loop;
    perform public.release_inventory_reference('job_order',j.id,'job-completion-release:'||j.id);
    return count_rows;
  end if;

  for recipe in select consumable.id,consumable.inventory_item_id,consumable.quantity,item.quantity job_quantity,
      inventory.branch_id,inventory.organization_id
    from public.job_order_items item join public.service_consumables consumable on consumable.service_id=item.service_id
    join public.inventory_items inventory on inventory.id=consumable.inventory_item_id
    where item.job_order_id=j.id and item.approval_status='approved'
      and inventory.branch_id=j.branch_id and inventory.organization_id=j.organization_id order by consumable.inventory_item_id
  loop
    perform 1 from public.inventory_items where id=recipe.inventory_item_id for update;
    needed:=recipe.quantity*recipe.job_quantity;
    if public.inventory_available_balance(recipe.inventory_item_id)<needed then raise exception 'Insufficient inventory for job completion'; end if;
    insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by)
    values(j.organization_id,j.branch_id,recipe.inventory_item_id,'usage',-needed,'job_order',j.id,'job:'||j.id||':recipe:'||recipe.id,'Automatic job consumption',auth.uid())
    on conflict(organization_id,idempotency_key) where idempotency_key is not null do nothing;
    if found then count_rows:=count_rows+1; end if;
  end loop;
  return count_rows;
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
    select count(*) into missing_parts from public.automotive_job_part_requirements(j.id) requirement
    left join public.inventory_reservations reservation on reservation.organization_id=j.organization_id
      and reservation.branch_id=j.branch_id and reservation.inventory_item_id=requirement.inventory_item_id
      and reservation.reference_type='job_order' and reservation.reference_id=j.id
    where coalesce(reservation.quantity_reserved-reservation.quantity_released,0)<requirement.required_quantity;
    if missing_parts>0 then raise exception 'Reserve all required parts before work starts'; end if;
  end if;
  if p_action='complete' then
    select * into invoice_row from public.invoices where job_order_id=j.id and status<>'void';
    if invoice_row.id is null then raise exception 'Issue an invoice before releasing the vehicle'; end if;
    if invoice_row.balance_centavos>0 then raise exception 'Full payment is required before releasing the vehicle'; end if;
  end if;
  target:=case when p_action='start' and j.status in ('queued','approved') then 'in_progress'
    when p_action='hold' and j.status='in_progress' then 'on_hold'
    when p_action='resume' and j.status='on_hold' then 'in_progress'
    when p_action='quality_check' and j.status='in_progress' then 'quality_check'
    when p_action='ready' and j.status='quality_check' then 'ready_for_release'
    when p_action='complete' and j.status in ('ready','ready_for_release') then 'completed'
    when p_action='cancel' and j.status in ('draft','queued','awaiting_approval','approved') then 'cancelled' else null end;
  if target is null then raise exception 'This job order status transition is not allowed'; end if;
  if target='cancelled' then perform public.release_inventory_reference('job_order',j.id,'job-cancel:'||j.id); end if;
  update public.job_orders set status=target,started_at=case when target='in_progress' and started_at is null then now() else started_at end,
    completed_at=case when target='completed' then now() else completed_at end where id=j.id;
end $$;

create table public.vehicle_service_record_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_record_id uuid not null references public.vehicle_service_records(id) on delete cascade,
  source_inventory_reservation_id uuid not null references public.inventory_reservations(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  sku_snapshot text,
  part_name_snapshot text not null,
  unit_snapshot text not null,
  quantity_consumed numeric(14,3) not null check (quantity_consumed > 0),
  created_at timestamptz not null default now(),
  unique (service_record_id,source_inventory_reservation_id)
);
create index vehicle_service_record_parts_record_idx on public.vehicle_service_record_parts(service_record_id,created_at);
alter table public.vehicle_service_record_parts enable row level security;
create policy vehicle_service_record_parts_select on public.vehicle_service_record_parts for select to authenticated
using (public.is_org_member(organization_id) and exists (
  select 1 from public.vehicle_service_records record where record.id=service_record_id
    and public.can_access_branch(record.organization_id,record.branch_id)
));
revoke all on public.vehicle_service_record_parts from public,anon,authenticated;
grant select on public.vehicle_service_record_parts to authenticated;
grant all on public.vehicle_service_record_parts to service_role;
create trigger vehicle_service_record_parts_tenant_guard before insert or update on public.vehicle_service_record_parts
for each row execute function public.enforce_inventory_reservation_tenant();

create function public.snapshot_completed_job_parts() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='completed' and old.status is distinct from new.status then
    insert into public.vehicle_service_record_parts(
      organization_id,service_record_id,source_inventory_reservation_id,inventory_item_id,
      sku_snapshot,part_name_snapshot,unit_snapshot,quantity_consumed
    ) select new.organization_id,record.id,reservation.id,item.id,item.sku,item.name,item.unit,reservation.quantity_consumed
    from public.vehicle_service_records record
    join public.inventory_reservations reservation on reservation.organization_id=new.organization_id
      and reservation.reference_type='job_order' and reservation.reference_id=new.id and reservation.quantity_consumed>0
    join public.inventory_items item on item.id=reservation.inventory_item_id
    where record.source_job_order_id=new.id
    on conflict(service_record_id,source_inventory_reservation_id) do nothing;
  end if;
  return new;
end $$;
create trigger zz_job_completion_parts_snapshot after update of status on public.job_orders
for each row execute function public.snapshot_completed_job_parts();

-- Generic mutation functions are an internal Core boundary. Authenticated
-- application callers enter through Automotive wrappers which validate Job Order
-- state and reference ownership first.
revoke all on function public.inventory_reserved_balance(uuid),public.inventory_available_balance(uuid),
  public.reserve_inventory(uuid,text,uuid,numeric,text),public.consume_inventory_reservation(uuid,numeric,text),
  public.release_inventory_reservation(uuid,numeric,text),public.release_inventory_reference(text,uuid,text),
  public.automotive_job_part_requirements(uuid),public.assert_job_parts_operation(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.inventory_reserved_balance(uuid),public.inventory_available_balance(uuid) to authenticated;
grant execute on function public.get_job_parts_readiness(uuid),public.reserve_job_part(uuid,uuid,numeric,text),
  public.reserve_job_required_parts(uuid,text),public.consume_job_part(uuid,uuid,numeric,text),
  public.release_job_part(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.reserve_inventory(uuid,text,uuid,numeric,text),public.consume_inventory_reservation(uuid,numeric,text),
  public.release_inventory_reservation(uuid,numeric,text),public.release_inventory_reference(text,uuid,text),
  public.automotive_job_part_requirements(uuid),public.assert_job_parts_operation(uuid,uuid) to service_role;
