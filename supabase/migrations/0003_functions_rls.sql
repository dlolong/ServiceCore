-- Helper functions are SECURITY DEFINER and pin search_path to avoid caller-controlled object resolution.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.branches enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.job_orders enable row level security;
alter table public.job_order_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_events enable row level security;
alter table public.plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_member_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_admin_update on public.organizations for update to authenticated using (public.has_org_role(id, array['owner','manager']::public.organization_role[])) with check (public.has_org_role(id, array['owner','manager']::public.organization_role[]));

create policy memberships_member_select on public.organization_memberships for select to authenticated using (public.is_org_member(organization_id));
create policy memberships_owner_write on public.organization_memberships for all to authenticated using (public.has_org_role(organization_id, array['owner']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

create policy branches_member_select on public.branches for select to authenticated using (public.is_org_member(organization_id));
create policy branches_admin_write on public.branches for all to authenticated using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy customers_member_select on public.customers for select to authenticated using (public.is_org_member(organization_id));
create policy customers_ops_write on public.customers for all to authenticated using (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[]));

create policy vehicles_member_select on public.vehicles for select to authenticated using (public.is_org_member(organization_id));
create policy vehicles_ops_write on public.vehicles for all to authenticated using (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[]));

create policy service_categories_member_select on public.service_categories for select to authenticated using (public.is_org_member(organization_id));
create policy service_categories_admin_write on public.service_categories for all to authenticated using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
create policy services_member_select on public.services for select to authenticated using (public.is_org_member(organization_id));
create policy services_admin_write on public.services for all to authenticated using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));

create policy appointments_member_select on public.appointments for select to authenticated using (public.is_org_member(organization_id));
create policy appointments_ops_write on public.appointments for all to authenticated using (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager','advisor']::public.organization_role[]));
create policy appointment_services_member_select on public.appointment_services for select to authenticated using (exists(select 1 from public.appointments a where a.id=appointment_id and public.is_org_member(a.organization_id)));
create policy appointment_services_ops_write on public.appointment_services for all to authenticated using (exists(select 1 from public.appointments a where a.id=appointment_id and public.has_org_role(a.organization_id,array['owner','manager','advisor']::public.organization_role[]))) with check (exists(select 1 from public.appointments a where a.id=appointment_id and public.has_org_role(a.organization_id,array['owner','manager','advisor']::public.organization_role[])));

create policy jobs_member_select on public.job_orders for select to authenticated using (public.is_org_member(organization_id));
create policy jobs_ops_write on public.job_orders for all to authenticated using (public.has_org_role(organization_id, array['owner','manager','advisor','technician']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager','advisor','technician']::public.organization_role[]));
create policy job_items_member_select on public.job_order_items for select to authenticated using (public.is_org_member(organization_id));
create policy job_items_ops_write on public.job_order_items for all to authenticated using (public.has_org_role(organization_id, array['owner','manager','advisor','technician']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','manager','advisor','technician']::public.organization_role[]));

create policy payments_finance_select on public.payments for select to authenticated using (public.has_org_role(organization_id,array['owner','manager','advisor','cashier']::public.organization_role[]));
create policy payments_finance_write on public.payments for all to authenticated using (public.has_org_role(organization_id,array['owner','manager','cashier']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','manager','cashier']::public.organization_role[]));

create policy inventory_member_select on public.inventory_items for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_admin_write on public.inventory_items for all to authenticated using (public.has_org_role(organization_id,array['owner','manager']::public.organization_role[])) with check (public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy inventory_movements_member_select on public.inventory_movements for select to authenticated using (public.is_org_member(organization_id));
create policy inventory_movements_ops_insert on public.inventory_movements for insert to authenticated with check (public.has_org_role(organization_id,array['owner','manager','technician']::public.organization_role[]));

create policy audit_admin_select on public.audit_events for select to authenticated using (public.has_org_role(organization_id,array['owner','manager']::public.organization_role[]));
create policy plans_authenticated_select on public.plans for select to authenticated using (is_active=true);
create policy subscriptions_owner_select on public.organization_subscriptions for select to authenticated using (public.has_org_role(organization_id,array['owner']::public.organization_role[]));
-- No authenticated policy for billing_webhook_events: service role only.

-- Baseline Data API grants; RLS remains authoritative.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.organizations, public.organization_memberships, public.branches, public.customers, public.vehicles, public.service_categories, public.services, public.appointments, public.appointment_services, public.job_orders, public.job_order_items, public.payments, public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select on public.audit_events, public.plans, public.organization_subscriptions to authenticated;
