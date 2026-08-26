-- Phase 00.5: close remaining cross-table tenant consistency gaps found by
-- disposable-database security validation. Existing migrations remain unchanged.

create or replace function public.enforce_job_item_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare parent_org uuid; service_org uuid;
begin
  select organization_id into parent_org from public.job_orders where id = new.job_order_id;
  if parent_org is null or parent_org <> new.organization_id then
    raise exception 'Job item organization mismatch';
  end if;
  if new.service_id is not null then
    select organization_id into service_org from public.services where id = new.service_id;
    if service_org is null or service_org <> new.organization_id then
      raise exception 'Job item/service organization mismatch';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_inventory_item_branch_org()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare branch_org uuid;
begin
  if new.branch_id is null then return new; end if;
  select organization_id into branch_org from public.branches where id = new.branch_id;
  if branch_org is null or branch_org <> new.organization_id then
    raise exception 'Inventory item/branch organization mismatch';
  end if;
  return new;
end;
$$;

create trigger inventory_items_branch_org_guard
before insert or update on public.inventory_items
for each row execute function public.enforce_inventory_item_branch_org();
