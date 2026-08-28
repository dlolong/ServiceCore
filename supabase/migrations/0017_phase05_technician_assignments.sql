-- Phase 05 technician assignment history and per-service assignments.
alter table public.job_orders add column technician_assigned_at timestamptz;
alter table public.job_order_items add column technician_assigned_at timestamptz;

create or replace function public.assign_job(p_job_id uuid,p_technician_id uuid,p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders;
begin select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Job not found' using errcode='42501'; end if;
  if p_technician_id is not null and not exists(select 1 from public.organization_memberships where organization_id=j.organization_id and user_id=p_technician_id and is_active and role='technician') then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  update public.job_orders set primary_technician_user_id=p_technician_id,promised_at=p_promised_at,
    technician_assigned_at=case when p_technician_id is null then null when primary_technician_user_id is distinct from p_technician_id then now() else technician_assigned_at end where id=j.id;
end $$;

create function public.assign_job_item(p_item_id uuid,p_technician_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.job_order_items;
begin select * into item from public.job_order_items where id=p_item_id for update;
  if item.id is null or not public.has_org_role(item.organization_id,array['owner','manager','advisor']::public.organization_role[]) then raise exception 'Job item not found' using errcode='42501'; end if;
  if p_technician_id is not null and not exists(select 1 from public.organization_memberships where organization_id=item.organization_id and user_id=p_technician_id and is_active and role='technician') then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  update public.job_order_items set technician_user_id=p_technician_id,
    technician_assigned_at=case when p_technician_id is null then null when technician_user_id is distinct from p_technician_id then now() else technician_assigned_at end where id=item.id;
end $$;
grant execute on function public.assign_job_item(uuid,uuid) to authenticated;
