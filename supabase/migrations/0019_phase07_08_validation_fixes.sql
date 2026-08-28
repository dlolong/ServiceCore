-- Preserve legacy movement vocabulary and make tenant guards null-safe under RLS.
alter table public.inventory_movements drop constraint inventory_movements_movement_type_check;
alter table public.inventory_movements add constraint inventory_movements_movement_type_check
  check(movement_type in ('opening','stock_in','purchase','usage','consume','transfer_in','transfer_out','adjustment','return','waste'));

create or replace function public.enforce_retention_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$ declare parent_org uuid; begin
  if tg_table_name='service_consumables' then select organization_id into parent_org from public.services where id=new.service_id; if parent_org is null or parent_org<>new.organization_id or not exists(select 1 from public.inventory_items where id=new.inventory_item_id and organization_id=new.organization_id) then raise exception 'Consumable tenant mismatch'; end if;
  elsif tg_table_name='maintenance_rules' then select organization_id into parent_org from public.services where id=new.service_id; if parent_org is null or parent_org<>new.organization_id then raise exception 'Maintenance rule tenant mismatch'; end if;
  elsif tg_table_name='customer_communication_preferences' then select organization_id into parent_org from public.customers where id=new.customer_id; if parent_org is null or parent_org<>new.organization_id then raise exception 'Preference tenant mismatch'; end if;
  elsif tg_table_name='maintenance_reminders' then select organization_id into parent_org from public.vehicles where id=new.vehicle_id; if parent_org is null or parent_org<>new.organization_id or not exists(select 1 from public.customers where id=new.customer_id and organization_id=new.organization_id) or not exists(select 1 from public.services where id=new.service_id and organization_id=new.organization_id) then raise exception 'Reminder tenant mismatch'; end if; end if; return new; end $$;
