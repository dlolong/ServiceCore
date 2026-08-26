create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.organization_memberships for each row execute function public.set_updated_at();
create trigger branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger job_orders_updated_at before update on public.job_orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger inventory_items_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.organization_subscriptions for each row execute function public.set_updated_at();

-- Preserve tenant consistency for vehicle -> customer relationship.
create or replace function public.enforce_vehicle_customer_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent_org uuid;
begin
  select organization_id into parent_org from public.customers where id = new.customer_id;
  if parent_org is null or parent_org <> new.organization_id then raise exception 'Vehicle/customer organization mismatch'; end if;
  return new;
end; $$;
create trigger vehicles_customer_org_guard before insert or update on public.vehicles for each row execute function public.enforce_vehicle_customer_org();

-- Similar parent consistency for job order items.
create or replace function public.enforce_job_item_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent_org uuid;
begin
  select organization_id into parent_org from public.job_orders where id = new.job_order_id;
  if parent_org is null or parent_org <> new.organization_id then raise exception 'Job item organization mismatch'; end if;
  return new;
end; $$;
create trigger job_items_org_guard before insert or update on public.job_order_items for each row execute function public.enforce_job_item_org();
