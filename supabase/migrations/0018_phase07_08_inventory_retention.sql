-- Combined Phase 07-08: append-only inventory and consent-aware service retention.

alter table public.inventory_items
  add column category text,
  add column description text,
  add column lot_number text,
  add column expires_on date;
alter table public.inventory_items alter column branch_id set not null;
create unique index inventory_items_branch_sku_unique on public.inventory_items(organization_id,branch_id,lower(sku)) where sku is not null;

alter table public.inventory_movements drop constraint inventory_movements_movement_type_check;
alter table public.inventory_movements add constraint inventory_movements_movement_type_check
  check(movement_type in ('opening','purchase','usage','consume','transfer_in','transfer_out','adjustment','return','waste'));

create table public.service_consumables(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(14,3) not null check(quantity>0), created_at timestamptz not null default now(),
  unique(service_id,inventory_item_id)
);

create table public.maintenance_rules(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  interval_months integer check(interval_months is null or interval_months between 1 and 120),
  interval_km integer check(interval_km is null or interval_km between 100 and 500000),
  lead_days integer not null default 14 check(lead_days between 0 and 365), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(service_id),
  check(interval_months is not null or interval_km is not null)
);

create table public.customer_communication_preferences(
  customer_id uuid primary key references public.customers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_opt_in boolean not null default false, sms_opt_in boolean not null default false,
  opted_out_at timestamptz, updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);

create type public.reminder_status as enum('pending','sent','dismissed','completed');
create type public.reminder_channel as enum('in_app','email','sms');
create table public.maintenance_reminders(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict, customer_id uuid not null references public.customers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade, service_id uuid not null references public.services(id) on delete cascade,
  source_job_id uuid not null references public.job_orders(id) on delete cascade, status public.reminder_status not null default 'pending',
  channel public.reminder_channel not null default 'in_app', due_at timestamptz, due_odometer_km integer,
  idempotency_key text not null, attempt_count integer not null default 0, next_attempt_at timestamptz,
  sent_at timestamptz, dismissed_at timestamptz, completed_at timestamptz, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,idempotency_key)
);

create view public.inventory_stock with(security_invoker=true) as
select i.*,coalesce(sum(m.quantity_delta),0)::numeric(14,3) quantity_on_hand,
  (coalesce(sum(m.quantity_delta),0)*coalesce(i.cost_centavos,0))::numeric valuation_centavos,
  coalesce(sum(m.quantity_delta),0)<=i.reorder_level low_stock
from public.inventory_items i left join public.inventory_movements m on m.inventory_item_id=i.id
group by i.id;

create view public.vehicle_service_history with(security_invoker=true) as
select j.organization_id,j.branch_id,j.vehicle_id,j.customer_id,j.id job_order_id,j.job_number,j.completed_at,
  j.odometer_in_km,coalesce(inv.total_centavos,j.actual_total_centavos) total_centavos,
  jsonb_agg(jsonb_build_object('name',ji.service_name_snapshot,'quantity',ji.quantity,'total_centavos',ji.line_total_centavos) order by ji.created_at) services
from public.job_orders j join public.job_order_items ji on ji.job_order_id=j.id and ji.approval_status='approved'
left join public.invoices inv on inv.job_order_id=j.id and inv.status<>'void'
where j.status='completed' group by j.id,inv.total_centavos;

create function public.inventory_item_balance(p_item_id uuid) returns numeric language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(sum(quantity_delta),0) from public.inventory_movements where inventory_item_id=p_item_id
$$;

create function public.record_inventory_movement(p_item_id uuid,p_type text,p_quantity numeric,p_note text default null,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.inventory_items; movement_id uuid; delta numeric; key_text text;
begin select * into item from public.inventory_items where id=p_item_id;
  if item.id is null or not public.has_org_role(item.organization_id,array['owner','manager']::public.organization_role[]) then raise exception 'Inventory item not found' using errcode='42501'; end if;
  if p_quantity<=0 or p_type not in ('opening','purchase','usage','adjustment','return','waste') then raise exception 'Invalid movement'; end if;
  delta:=case when p_type in ('usage','waste') then -p_quantity else p_quantity end;
  if delta<0 and public.inventory_item_balance(item.id)+delta<0 then raise exception 'Insufficient stock'; end if;
  key_text:=nullif(trim(coalesce(p_idempotency_key,'')),'');
  insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,idempotency_key,note,created_by)
  values(item.organization_id,item.branch_id,item.id,p_type,delta,key_text,nullif(trim(coalesce(p_note,'')),''),auth.uid())
  on conflict(organization_id,idempotency_key) where idempotency_key is not null do update set idempotency_key=excluded.idempotency_key returning id into movement_id;
  return movement_id; end $$;

create function public.transfer_inventory(p_source_item_id uuid,p_target_item_id uuid,p_quantity numeric,p_note text,p_idempotency_key text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare source_item public.inventory_items; target_item public.inventory_items; key_text text;
begin select * into source_item from public.inventory_items where id=p_source_item_id for update; select * into target_item from public.inventory_items where id=p_target_item_id for update;
  if source_item.id is null or target_item.id is null or source_item.organization_id<>target_item.organization_id or not public.has_org_role(source_item.organization_id,array['owner','manager']::public.organization_role[]) then raise exception 'Transfer not allowed' using errcode='42501'; end if;
  if source_item.id=target_item.id or p_quantity<=0 or coalesce(lower(source_item.sku),'')<>coalesce(lower(target_item.sku),'') then raise exception 'Invalid transfer'; end if;
  if public.inventory_item_balance(source_item.id)<p_quantity then raise exception 'Insufficient stock'; end if;
  key_text:=nullif(trim(coalesce(p_idempotency_key,'')),''); if key_text is null then raise exception 'Idempotency key required'; end if;
  if exists(select 1 from public.inventory_movements where organization_id=source_item.organization_id and idempotency_key=key_text||':out') then return; end if;
  insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,idempotency_key,note,created_by) values
  (source_item.organization_id,source_item.branch_id,source_item.id,'transfer_out',-p_quantity,'transfer',key_text||':out',p_note,auth.uid()),
  (target_item.organization_id,target_item.branch_id,target_item.id,'transfer_in',p_quantity,'transfer',key_text||':in',p_note,auth.uid());
end $$;

create function public.consume_job_inventory(p_job_id uuid) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders; recipe record; count_rows integer:=0; needed numeric;
begin select * into j from public.job_orders where id=p_job_id for update; if j.id is null then raise exception 'Job not found'; end if;
  for recipe in select sc.id,sc.inventory_item_id,sc.quantity,ji.quantity job_quantity,i.branch_id,i.organization_id
    from public.job_order_items ji join public.service_consumables sc on sc.service_id=ji.service_id
    join public.inventory_items i on i.id=sc.inventory_item_id
    where ji.job_order_id=j.id and ji.approval_status='approved' and i.branch_id=j.branch_id and i.organization_id=j.organization_id loop
    needed:=recipe.quantity*recipe.job_quantity;
    if public.inventory_item_balance(recipe.inventory_item_id)<needed then raise exception 'Insufficient inventory for job completion'; end if;
    insert into public.inventory_movements(organization_id,branch_id,inventory_item_id,movement_type,quantity_delta,reference_type,reference_id,idempotency_key,note,created_by)
    values(j.organization_id,j.branch_id,recipe.inventory_item_id,'usage',-needed,'job_order',j.id,'job:'||j.id||':recipe:'||recipe.id,'Automatic job consumption',auth.uid())
    on conflict(organization_id,idempotency_key) where idempotency_key is not null do nothing;
    if found then count_rows:=count_rows+1; end if;
  end loop; return count_rows; end $$;

create function public.on_job_completed_consume_inventory() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin if new.status='completed' and old.status is distinct from new.status then perform public.consume_job_inventory(new.id); end if; return new; end $$;
create trigger job_completion_inventory after update of status on public.job_orders for each row execute function public.on_job_completed_consume_inventory();

create function public.generate_maintenance_reminders(p_horizon_days integer default 30) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted_count integer;
begin if p_horizon_days<0 or p_horizon_days>365 then raise exception 'Invalid horizon'; end if;
  if not exists(select 1 from public.organization_memberships where user_id=auth.uid() and is_active) then raise exception 'Access denied' using errcode='42501'; end if;
  with latest as(select distinct on(j.organization_id,j.vehicle_id,ji.service_id) j.*,ji.service_id,r.id rule_id,r.interval_months,r.interval_km,r.lead_days
    from public.job_orders j join public.job_order_items ji on ji.job_order_id=j.id and ji.approval_status='approved'
    join public.maintenance_rules r on r.service_id=ji.service_id and r.organization_id=j.organization_id and r.is_active
    where j.status='completed' and public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[])
    order by j.organization_id,j.vehicle_id,ji.service_id,j.completed_at desc)
  insert into public.maintenance_reminders(organization_id,branch_id,customer_id,vehicle_id,service_id,source_job_id,channel,due_at,due_odometer_km,idempotency_key)
  select l.organization_id,l.branch_id,l.customer_id,l.vehicle_id,l.service_id,l.id,'in_app',
    case when l.interval_months is not null then l.completed_at+make_interval(months=>l.interval_months) end,
    case when l.interval_km is not null and l.odometer_in_km is not null then l.odometer_in_km+l.interval_km end,
    'maintenance:'||l.id||':'||l.rule_id
  from latest l join public.vehicles v on v.id=l.vehicle_id
  where (l.interval_months is not null and l.completed_at+make_interval(months=>l.interval_months)<=now()+make_interval(days=>p_horizon_days+l.lead_days))
     or (l.interval_km is not null and l.odometer_in_km is not null and coalesce(v.odometer_km,0)>=l.odometer_in_km+l.interval_km)
  on conflict(organization_id,idempotency_key) do nothing; get diagnostics inserted_count=row_count; return inserted_count; end $$;

create function public.transition_maintenance_reminder(p_reminder_id uuid,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.maintenance_reminders;
begin select * into r from public.maintenance_reminders where id=p_reminder_id for update;
  if r.id is null or not public.has_org_role(r.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Reminder not found' using errcode='42501'; end if;
  if p_action='dismiss' and r.status='pending' then update public.maintenance_reminders set status='dismissed',dismissed_at=now() where id=r.id;
  elsif p_action='complete' and r.status in ('pending','sent') then update public.maintenance_reminders set status='completed',completed_at=now() where id=r.id;
  else raise exception 'Invalid reminder transition'; end if; end $$;

create function public.enforce_inventory_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare b public.branches; i public.inventory_items; begin
  select * into b from public.branches where id=new.branch_id; if b.id is null or b.organization_id<>new.organization_id then raise exception 'Inventory branch organization mismatch'; end if;
  if tg_table_name='inventory_movements' then select * into i from public.inventory_items where id=new.inventory_item_id; if i.id is null or i.organization_id<>new.organization_id or i.branch_id<>new.branch_id then raise exception 'Inventory movement organization mismatch'; end if; end if; return new; end $$;
create trigger inventory_item_tenant_guard before insert or update on public.inventory_items for each row execute function public.enforce_inventory_tenant();

create function public.enforce_retention_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare parent_org uuid; begin
  if tg_table_name='service_consumables' then select organization_id into parent_org from public.services where id=new.service_id; if parent_org<>new.organization_id or not exists(select 1 from public.inventory_items where id=new.inventory_item_id and organization_id=new.organization_id) then raise exception 'Consumable tenant mismatch'; end if;
  elsif tg_table_name='maintenance_rules' then select organization_id into parent_org from public.services where id=new.service_id; if parent_org<>new.organization_id then raise exception 'Maintenance rule tenant mismatch'; end if;
  elsif tg_table_name='customer_communication_preferences' then select organization_id into parent_org from public.customers where id=new.customer_id; if parent_org<>new.organization_id then raise exception 'Preference tenant mismatch'; end if;
  elsif tg_table_name='maintenance_reminders' then select organization_id into parent_org from public.vehicles where id=new.vehicle_id; if parent_org<>new.organization_id or not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id) or not exists(select 1 from public.services where id=new.service_id and organization_id=new.organization_id) then raise exception 'Reminder tenant mismatch'; end if; end if; return new; end $$;
create trigger consumable_tenant_guard before insert or update on public.service_consumables for each row execute function public.enforce_retention_tenant();
create trigger maintenance_rule_tenant_guard before insert or update on public.maintenance_rules for each row execute function public.enforce_retention_tenant();
create trigger preference_tenant_guard before insert or update on public.customer_communication_preferences for each row execute function public.enforce_retention_tenant();
create trigger reminder_tenant_guard before insert or update on public.maintenance_reminders for each row execute function public.enforce_retention_tenant();

alter table public.service_consumables enable row level security; alter table public.maintenance_rules enable row level security; alter table public.customer_communication_preferences enable row level security; alter table public.maintenance_reminders enable row level security;
create policy consumables_select on public.service_consumables for select to authenticated using(public.is_org_member(organization_id)); create policy consumables_manage on public.service_consumables for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy rules_select on public.maintenance_rules for select to authenticated using(public.is_org_member(organization_id)); create policy rules_manage on public.maintenance_rules for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy preferences_select on public.customer_communication_preferences for select to authenticated using(public.is_org_member(organization_id)); create policy preferences_manage on public.customer_communication_preferences for all to authenticated using(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]));
create policy reminders_select on public.maintenance_reminders for select to authenticated using(public.is_org_member(organization_id));

drop policy if exists inventory_items_member_select on public.inventory_items; drop policy if exists inventory_items_ops_write on public.inventory_items; drop policy if exists inventory_movements_member_select on public.inventory_movements; drop policy if exists inventory_movements_ops_write on public.inventory_movements;
create policy inventory_items_select on public.inventory_items for select to authenticated using(public.is_org_member(organization_id)); create policy inventory_items_manage on public.inventory_items for all to authenticated using(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check(public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy inventory_movements_select on public.inventory_movements for select to authenticated using(public.is_org_member(organization_id));
revoke insert,update,delete on public.inventory_movements from authenticated;
grant select on public.inventory_stock,public.vehicle_service_history,public.service_consumables,public.maintenance_rules,public.customer_communication_preferences,public.maintenance_reminders to authenticated;
grant insert,update,delete on public.service_consumables,public.maintenance_rules to authenticated; grant insert,update on public.customer_communication_preferences to authenticated;
grant execute on function public.record_inventory_movement(uuid,text,numeric,text,text),public.transfer_inventory(uuid,uuid,numeric,text,text),public.generate_maintenance_reminders(integer),public.transition_maintenance_reminder(uuid,text) to authenticated;
create trigger maintenance_rules_updated_at before update on public.maintenance_rules for each row execute function public.set_updated_at(); create trigger preferences_updated_at before update on public.customer_communication_preferences for each row execute function public.set_updated_at(); create trigger reminders_updated_at before update on public.maintenance_reminders for each row execute function public.set_updated_at();
