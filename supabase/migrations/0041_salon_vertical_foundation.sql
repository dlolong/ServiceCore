-- Explicit organization vertical identity. Existing organizations remain KarKR.
alter table public.organizations
  add column industry text not null default 'automotive';

alter table public.organizations
  add constraint organizations_industry_check
  check (industry in ('automotive', 'salon'));

alter table public.organizations
  add constraint organizations_public_booking_industry_check
  check (industry = 'automotive' or not public_page_enabled);

comment on column public.organizations.industry is
  'Product configuration selector. Tenant authorization continues to use membership, branch access, and RLS.';

-- Automotive extension rows are not available inside a non-Automotive tenant.
-- Industry gating supplements (and never replaces) membership/RLS isolation.
drop policy vehicles_member_select on public.vehicles;
drop policy vehicles_ops_write on public.vehicles;
create policy vehicles_member_select on public.vehicles for select to authenticated using (
  public.is_org_member(organization_id)
  and exists(select 1 from public.organizations o where o.id=organization_id and o.industry='automotive')
);
create policy vehicles_ops_write on public.vehicles for all to authenticated using (
  public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])
  and exists(select 1 from public.organizations o where o.id=organization_id and o.industry='automotive')
) with check (
  public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])
  and exists(select 1 from public.organizations o where o.id=organization_id and o.industry='automotive')
);
