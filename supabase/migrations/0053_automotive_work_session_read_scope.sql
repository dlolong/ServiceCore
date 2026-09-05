-- Tighten operational work-time visibility after 0051 was locally applied.
drop policy if exists automotive_work_sessions_select on public.automotive_job_order_work_sessions;
create policy automotive_work_sessions_select on public.automotive_job_order_work_sessions
for select to authenticated using (
  public.can_access_branch(organization_id,branch_id)
  and (
    public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])
    or (
      public.has_org_role(organization_id,array['technician']::public.organization_role[])
      and technician_user_id=auth.uid()
    )
  )
);
