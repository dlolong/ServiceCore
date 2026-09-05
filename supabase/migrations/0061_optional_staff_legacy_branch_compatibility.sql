-- Preserve branch restrictions for rolling clients that still assign linked
-- technicians by Auth-user ID. Canonical Staff APIs continue to use the
-- independent operational Staff branch scope.

insert into public.staff_profile_branch_assignments(
  staff_profile_id,organization_id,branch_id
)
select staff.id,assignment.organization_id,assignment.branch_id
from public.organization_staff_profiles staff
join public.membership_branch_assignments assignment
  on assignment.membership_id = staff.membership_id
on conflict(staff_profile_id,branch_id) do nothing;

create or replace function public.assign_job(
  p_job_id uuid,
  p_technician_id uuid,
  p_promised_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job_row public.job_orders;
  technician_membership public.organization_memberships;
  staff_id uuid;
begin
  select * into job_row
  from public.job_orders
  where id = p_job_id
  for update;
  if job_row.id is null
    or not public.has_org_role(
      job_row.organization_id,
      array['owner','manager','advisor']::public.organization_role[]
    )
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then
    raise exception 'Job not found' using errcode = '42501';
  end if;

  if p_technician_id is not null then
    select membership.* into technician_membership
    from public.organization_memberships membership
    where membership.organization_id = job_row.organization_id
      and membership.user_id = p_technician_id
      and membership.is_active
      and membership.role = 'technician';
    if technician_membership.id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.membership_branch_assignments assignment
      where assignment.membership_id = technician_membership.id
    ) and not exists (
      select 1 from public.membership_branch_assignments assignment
      where assignment.membership_id = technician_membership.id
        and assignment.branch_id = job_row.branch_id
    ) then
      raise exception 'The assigned technician cannot access this branch' using errcode = '42501';
    end if;
    select staff.id into staff_id
    from public.organization_staff_profiles staff
    where staff.membership_id = technician_membership.id;
    if staff_id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
  end if;

  perform public.assign_job_staff(p_job_id,staff_id,p_promised_at);
end
$$;

create or replace function public.assign_job_item(
  p_item_id uuid,
  p_technician_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_row public.job_order_items;
  job_row public.job_orders;
  technician_membership public.organization_memberships;
  staff_id uuid;
begin
  select * into item_row
  from public.job_order_items
  where id = p_item_id
  for update;
  select * into job_row
  from public.job_orders
  where id = item_row.job_order_id;
  if item_row.id is null or job_row.id is null
    or not public.has_org_role(
      item_row.organization_id,
      array['owner','manager','advisor']::public.organization_role[]
    )
    or not public.can_access_branch(job_row.organization_id,job_row.branch_id)
  then
    raise exception 'Job item not found' using errcode = '42501';
  end if;

  if p_technician_id is not null then
    select membership.* into technician_membership
    from public.organization_memberships membership
    where membership.organization_id = item_row.organization_id
      and membership.user_id = p_technician_id
      and membership.is_active
      and membership.role = 'technician';
    if technician_membership.id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.membership_branch_assignments assignment
      where assignment.membership_id = technician_membership.id
    ) and not exists (
      select 1 from public.membership_branch_assignments assignment
      where assignment.membership_id = technician_membership.id
        and assignment.branch_id = job_row.branch_id
    ) then
      raise exception 'The assigned technician cannot access this branch' using errcode = '42501';
    end if;
    select staff.id into staff_id
    from public.organization_staff_profiles staff
    where staff.membership_id = technician_membership.id;
    if staff_id is null then
      raise exception 'Technician is not an active member' using errcode = '42501';
    end if;
  end if;

  perform public.assign_job_item_staff(p_item_id,staff_id);
end
$$;

