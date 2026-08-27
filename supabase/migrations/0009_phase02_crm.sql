-- Phase 02: branch, customer, and vehicle CRM integrity/search support.

alter table public.customers
  add column address_line text,
  add column city text,
  add column province text;

alter table public.vehicles
  add column variant text,
  add column vehicle_type text,
  add column fuel_type text,
  add column transmission text,
  add column engine_number text;

alter table public.customers
  add constraint customers_contact_length_check check (
    char_length(full_name) between 2 and 160
    and (phone is null or char_length(phone) <= 40)
    and (email is null or char_length(email) <= 254)
    and (notes is null or char_length(notes) <= 2000)
  );

alter table public.vehicles
  add constraint vehicles_identity_check check (
    char_length(make) between 1 and 80
    and char_length(model) between 1 and 80
    and (notes is null or char_length(notes) <= 2000)
  );

create or replace function public.normalize_phone(value text)
returns text language sql immutable parallel safe set search_path = public, pg_temp as $$
  select case
    when nullif(regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g'), '') is null then null
    when regexp_replace(value, '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
      then '+63' || substring(regexp_replace(value, '[^0-9]', '', 'g') from 2)
    when regexp_replace(value, '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
      then '+' || regexp_replace(value, '[^0-9]', '', 'g')
    else '+' || regexp_replace(value, '[^0-9]', '', 'g')
  end
$$;

create or replace function public.normalize_plate(value text)
returns text language sql immutable parallel safe set search_path = public, pg_temp as $$
  select nullif(upper(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]', '', 'g')), '')
$$;

create function public.normalize_crm_record()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'customers' then
    new.phone_normalized := public.normalize_phone(new.phone);
    new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  else
    new.plate_normalized := public.normalize_plate(new.plate_number);
    new.vin := nullif(upper(trim(coalesce(new.vin, ''))), '');
  end if;
  return new;
end;
$$;

create trigger customers_normalize before insert or update of phone, email
on public.customers for each row execute function public.normalize_crm_record();
create trigger vehicles_normalize before insert or update of plate_number, vin
on public.vehicles for each row execute function public.normalize_crm_record();

update public.customers set phone = phone, email = email;
update public.vehicles set plate_number = plate_number, vin = vin;

create index customers_org_email_idx on public.customers (organization_id, lower(email)) where email is not null;
create index vehicles_org_make_model_idx on public.vehicles (organization_id, lower(make), lower(model));
create index vehicles_org_vin_idx on public.vehicles (organization_id, vin) where vin is not null;
create unique index vehicles_org_active_plate_unique_idx
  on public.vehicles (organization_id, plate_normalized)
  where plate_normalized is not null and is_archived = false;

create view public.vehicle_directory with (security_invoker = true) as
select v.*, c.full_name as customer_name, c.phone as customer_phone,
  c.phone_normalized as customer_phone_normalized
from public.vehicles v join public.customers c on c.id = v.customer_id;
grant select on public.vehicle_directory to authenticated;

create function public.set_primary_branch(p_branch_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.branches;
begin
  select * into target from public.branches where id = p_branch_id;
  if target.id is null or not public.has_org_role(target.organization_id, array['owner','manager']::public.organization_role[]) then
    raise exception 'Branch not found' using errcode = '42501';
  end if;
  if not target.is_active then raise exception 'Primary branch must be active'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target.organization_id::text, 0));
  update public.branches set is_primary = false where organization_id = target.organization_id and is_primary;
  update public.branches set is_primary = true where id = target.id;
end;
$$;

create function public.set_branch_active(p_branch_id uuid, p_is_active boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target public.branches; replacement_id uuid;
begin
  select * into target from public.branches where id = p_branch_id;
  if target.id is null or not public.has_org_role(target.organization_id, array['owner','manager']::public.organization_role[]) then
    raise exception 'Branch not found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target.organization_id::text, 0));
  if not p_is_active and target.is_primary then
    select id into replacement_id from public.branches
      where organization_id = target.organization_id and is_active and id <> target.id
      order by created_at, id limit 1;
    if replacement_id is null then raise exception 'An organization must keep one active branch'; end if;
    update public.branches set is_primary = false where id = target.id;
    update public.branches set is_primary = true where id = replacement_id;
  end if;
  update public.branches set is_active = p_is_active where id = target.id;
end;
$$;

revoke all on function public.normalize_phone(text), public.normalize_plate(text), public.set_primary_branch(uuid), public.set_branch_active(uuid, boolean) from public;
grant execute on function public.normalize_phone(text), public.normalize_plate(text), public.set_primary_branch(uuid), public.set_branch_active(uuid, boolean) to authenticated;

create function public.audit_crm_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare row_data record; action text;
begin
  row_data := case when tg_op = 'DELETE' then old else new end;
  action := lower(tg_op);
  if tg_op = 'UPDATE' and tg_table_name = 'branches' and old.is_active and not new.is_active then action := 'deactivated';
  elsif tg_op = 'UPDATE' and tg_table_name in ('customers','vehicles') and not old.is_archived and new.is_archived then action := 'archived';
  elsif tg_op = 'UPDATE' and tg_table_name = 'branches' and not old.is_primary and new.is_primary then action := 'made_primary';
  end if;
  insert into public.audit_events (organization_id, actor_user_id, entity_type, entity_id, event_type)
  values (row_data.organization_id, auth.uid(), tg_table_name, row_data.id,
    (case tg_table_name when 'branches' then 'branch' when 'customers' then 'customer' else 'vehicle' end) || '.' || action);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger branches_audit after insert or update or delete on public.branches for each row execute function public.audit_crm_change();
create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.audit_crm_change();
create trigger vehicles_audit after insert or update or delete on public.vehicles for each row execute function public.audit_crm_change();
