-- Cross-table tenant integrity. RLS is necessary but foreign keys can still point to rows
-- in another tenant unless the relationship itself is guarded.

create or replace function public.enforce_service_category_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent_org uuid;
begin
  if new.category_id is null then return new; end if;
  select organization_id into parent_org from public.service_categories where id = new.category_id;
  if parent_org is null or parent_org <> new.organization_id then raise exception 'Service/category organization mismatch'; end if;
  return new;
end; $$;
create trigger services_category_org_guard before insert or update on public.services for each row execute function public.enforce_service_category_org();

create or replace function public.enforce_appointment_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; customer_org uuid; vehicle_org uuid; vehicle_customer uuid;
begin
  select organization_id into branch_org from public.branches where id = new.branch_id;
  select organization_id into customer_org from public.customers where id = new.customer_id;
  select organization_id, customer_id into vehicle_org, vehicle_customer from public.vehicles where id = new.vehicle_id;
  if branch_org <> new.organization_id or customer_org <> new.organization_id or vehicle_org <> new.organization_id then
    raise exception 'Appointment organization mismatch';
  end if;
  if vehicle_customer <> new.customer_id then raise exception 'Appointment vehicle/customer mismatch'; end if;
  return new;
end; $$;
create trigger appointments_org_guard before insert or update on public.appointments for each row execute function public.enforce_appointment_org();

create or replace function public.enforce_appointment_service_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare appointment_org uuid; service_org uuid;
begin
  select organization_id into appointment_org from public.appointments where id = new.appointment_id;
  select organization_id into service_org from public.services where id = new.service_id;
  if appointment_org is null or service_org is null or appointment_org <> service_org then
    raise exception 'Appointment/service organization mismatch';
  end if;
  return new;
end; $$;
create trigger appointment_services_org_guard before insert or update on public.appointment_services for each row execute function public.enforce_appointment_service_org();

create or replace function public.enforce_job_order_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; customer_org uuid; vehicle_org uuid; vehicle_customer uuid; appointment_org uuid;
begin
  select organization_id into branch_org from public.branches where id = new.branch_id;
  select organization_id into customer_org from public.customers where id = new.customer_id;
  select organization_id, customer_id into vehicle_org, vehicle_customer from public.vehicles where id = new.vehicle_id;
  if branch_org <> new.organization_id or customer_org <> new.organization_id or vehicle_org <> new.organization_id then
    raise exception 'Job order organization mismatch';
  end if;
  if vehicle_customer <> new.customer_id then raise exception 'Job order vehicle/customer mismatch'; end if;
  if new.appointment_id is not null then
    select organization_id into appointment_org from public.appointments where id = new.appointment_id;
    if appointment_org is null or appointment_org <> new.organization_id then raise exception 'Job order/appointment organization mismatch'; end if;
  end if;
  return new;
end; $$;
create trigger job_orders_org_guard before insert or update on public.job_orders for each row execute function public.enforce_job_order_org();

create or replace function public.enforce_payment_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; job_org uuid;
begin
  select organization_id into branch_org from public.branches where id = new.branch_id;
  if branch_org is null or branch_org <> new.organization_id then raise exception 'Payment/branch organization mismatch'; end if;
  if new.job_order_id is not null then
    select organization_id into job_org from public.job_orders where id = new.job_order_id;
    if job_org is null or job_org <> new.organization_id then raise exception 'Payment/job organization mismatch'; end if;
  end if;
  return new;
end; $$;
create trigger payments_org_guard before insert or update on public.payments for each row execute function public.enforce_payment_org();

create or replace function public.enforce_inventory_movement_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid; item_org uuid;
begin
  select organization_id into branch_org from public.branches where id = new.branch_id;
  select organization_id into item_org from public.inventory_items where id = new.inventory_item_id;
  if branch_org is null or item_org is null or branch_org <> new.organization_id or item_org <> new.organization_id then
    raise exception 'Inventory movement organization mismatch';
  end if;
  return new;
end; $$;
create trigger inventory_movements_org_guard before insert or update on public.inventory_movements for each row execute function public.enforce_inventory_movement_org();
