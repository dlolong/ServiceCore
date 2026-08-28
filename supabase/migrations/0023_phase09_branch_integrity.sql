-- Phase 09 cross-tenant guards for staff and invitation branch assignments.
create function public.enforce_staff_branch_tenant() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare membership_org uuid; branch_org uuid; invitation_org uuid;
begin select organization_id into branch_org from public.branches where id=new.branch_id;
  if tg_table_name='membership_branch_assignments' then select organization_id into membership_org from public.organization_memberships where id=new.membership_id;
    if membership_org is null or branch_org is null or membership_org<>new.organization_id or branch_org<>new.organization_id then raise exception 'Staff branch organization mismatch'; end if;
  else select organization_id into invitation_org from public.staff_invitations where id=new.invitation_id;
    if invitation_org is null or branch_org is null or invitation_org<>branch_org then raise exception 'Invitation branch organization mismatch'; end if;
  end if; return new; end $$;
create trigger membership_branch_tenant_guard before insert or update on public.membership_branch_assignments for each row execute function public.enforce_staff_branch_tenant();
create trigger invitation_branch_tenant_guard before insert or update on public.staff_invitation_branches for each row execute function public.enforce_staff_branch_tenant();
