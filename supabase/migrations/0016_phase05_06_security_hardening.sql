-- Phase 05-06 hardening: assignment semantics, technician scope, and tenant guards.

create function public.assign_job(p_job_id uuid, p_technician_id uuid, p_promised_at timestamptz default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.job_orders;
begin
  select * into j from public.job_orders where id=p_job_id for update;
  if j.id is null or not public.has_org_role(j.organization_id,array['owner','manager','advisor']::public.organization_role[]) then
    raise exception 'Job not found' using errcode='42501';
  end if;
  if p_technician_id is not null and not exists (
    select 1 from public.organization_memberships
    where organization_id=j.organization_id and user_id=p_technician_id and is_active and role='technician'
  ) then raise exception 'Technician is not an active member' using errcode='42501'; end if;
  update public.job_orders set primary_technician_user_id=p_technician_id,promised_at=p_promised_at where id=j.id;
end $$;

create function public.is_assigned_job(p_organization_id uuid,p_job_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.has_org_role(p_organization_id,array['technician']::public.organization_role[])
    and exists(select 1 from public.job_orders j where j.id=p_job_id and j.organization_id=p_organization_id and j.primary_technician_user_id=auth.uid())
$$;

drop policy if exists inspections_ops on public.job_inspections;
create policy inspections_manager_write on public.job_inspections for all to authenticated
  using(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]))
  with check(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]));
create policy inspections_assigned_technician_write on public.job_inspections for all to authenticated
  using(public.is_assigned_job(organization_id,job_order_id))
  with check(public.is_assigned_job(organization_id,job_order_id));

drop policy if exists photos_ops on public.job_photos;
create policy photos_manager_write on public.job_photos for all to authenticated
  using(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]))
  with check(public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[]));
create policy photos_assigned_technician_write on public.job_photos for all to authenticated
  using(public.is_assigned_job(organization_id,job_order_id))
  with check(public.is_assigned_job(organization_id,job_order_id));

drop policy if exists job_photos_storage_insert on storage.objects;
create policy job_photos_storage_insert on storage.objects for insert to authenticated with check(
  bucket_id='job-photos' and (
    public.has_org_role((storage.foldername(name))[1]::uuid,array['owner','manager','advisor']::public.organization_role[])
    or public.is_assigned_job((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid)
  )
);

create function public.enforce_estimate_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare j public.job_orders; b public.branches;
begin
  select * into j from public.job_orders where id=new.job_order_id;
  select * into b from public.branches where id=new.branch_id;
  if j.id is null or b.id is null or j.organization_id<>new.organization_id or b.organization_id<>new.organization_id or j.branch_id<>new.branch_id then
    raise exception 'Estimate tenant mismatch';
  end if; return new;
end $$;
create trigger estimate_tenant_guard before insert or update on public.estimates for each row execute function public.enforce_estimate_tenant();

create function public.enforce_estimate_item_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare e public.estimates; ji public.job_order_items;
begin
  select * into e from public.estimates where id=new.estimate_id;
  if e.id is null or e.organization_id<>new.organization_id then raise exception 'Estimate item tenant mismatch'; end if;
  if new.job_order_item_id is not null then
    select * into ji from public.job_order_items where id=new.job_order_item_id;
    if ji.id is null or ji.organization_id<>new.organization_id or ji.job_order_id<>e.job_order_id then raise exception 'Estimate item job mismatch'; end if;
  end if; return new;
end $$;
create trigger estimate_item_tenant_guard before insert or update on public.estimate_items for each row execute function public.enforce_estimate_item_tenant();

create function public.enforce_invoice_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare j public.job_orders; e public.estimates;
begin
  select * into j from public.job_orders where id=new.job_order_id;
  if j.id is null or j.organization_id<>new.organization_id or j.branch_id<>new.branch_id then raise exception 'Invoice tenant mismatch'; end if;
  if new.estimate_id is not null then select * into e from public.estimates where id=new.estimate_id;
    if e.id is null or e.organization_id<>new.organization_id or e.job_order_id<>new.job_order_id then raise exception 'Invoice estimate mismatch'; end if;
  end if; return new;
end $$;
create trigger invoice_tenant_guard before insert or update on public.invoices for each row execute function public.enforce_invoice_tenant();

create function public.enforce_invoice_item_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare i public.invoices;
begin select * into i from public.invoices where id=new.invoice_id;
  if i.id is null or i.organization_id<>new.organization_id then raise exception 'Invoice item tenant mismatch'; end if;
  return new;
end $$;
create trigger invoice_item_tenant_guard before insert or update on public.invoice_items for each row execute function public.enforce_invoice_item_tenant();

create function public.enforce_payment_invoice_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare i public.invoices;
begin if new.invoice_id is not null then select * into i from public.invoices where id=new.invoice_id;
  if i.id is null or i.organization_id<>new.organization_id or i.branch_id<>new.branch_id or i.job_order_id<>new.job_order_id then raise exception 'Payment invoice tenant mismatch'; end if;
end if; return new; end $$;
create trigger payment_invoice_tenant_guard before insert or update on public.payments for each row execute function public.enforce_payment_invoice_tenant();

grant execute on function public.assign_job(uuid,uuid,timestamptz) to authenticated;
