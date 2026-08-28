-- Phase 09: centralized permissions, secure staff invitations, and branch scope.
create type public.permission_key as enum(
  'organization.manage','branches.manage','staff.manage','customers.read','customers.write','vehicles.read','vehicles.write',
  'services.manage','appointments.manage','jobs.manage','jobs.execute','estimates.manage','invoices.manage','payments.record',
  'inventory.manage','reports.view','settings.manage'
);
create table public.role_permissions(role public.organization_role not null,permission public.permission_key not null,primary key(role,permission));
insert into public.role_permissions(role,permission) values
('owner','organization.manage'),('owner','branches.manage'),('owner','staff.manage'),('owner','customers.read'),('owner','customers.write'),('owner','vehicles.read'),('owner','vehicles.write'),('owner','services.manage'),('owner','appointments.manage'),('owner','jobs.manage'),('owner','jobs.execute'),('owner','estimates.manage'),('owner','invoices.manage'),('owner','payments.record'),('owner','inventory.manage'),('owner','reports.view'),('owner','settings.manage'),
('manager','branches.manage'),('manager','customers.read'),('manager','customers.write'),('manager','vehicles.read'),('manager','vehicles.write'),('manager','services.manage'),('manager','appointments.manage'),('manager','jobs.manage'),('manager','jobs.execute'),('manager','estimates.manage'),('manager','invoices.manage'),('manager','payments.record'),('manager','inventory.manage'),('manager','reports.view'),('manager','settings.manage'),
('advisor','customers.read'),('advisor','customers.write'),('advisor','vehicles.read'),('advisor','vehicles.write'),('advisor','appointments.manage'),('advisor','jobs.manage'),('advisor','estimates.manage'),
('technician','customers.read'),('technician','vehicles.read'),('technician','jobs.execute'),
('cashier','customers.read'),('cashier','vehicles.read'),('cashier','invoices.manage'),('cashier','payments.record'),
('viewer','customers.read'),('viewer','vehicles.read'),('viewer','reports.view');
revoke insert,update,delete on public.role_permissions from authenticated; grant select on public.role_permissions to authenticated;

create function public.has_permission(p_organization_id uuid,p_permission public.permission_key) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.organization_memberships m join public.role_permissions rp on rp.role=m.role where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.is_active and rp.permission=p_permission)
$$;

create table public.membership_branch_assignments(
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade, created_at timestamptz not null default now(),
  primary key(membership_id,branch_id)
);
create function public.can_access_branch(p_organization_id uuid,p_branch_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.is_active and (
    m.role='owner' or not exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id)
    or exists(select 1 from public.membership_branch_assignments mba where mba.membership_id=m.id and mba.branch_id=p_branch_id)))
$$;

create type public.staff_invitation_status as enum('pending','accepted','revoked','expired');
create table public.staff_invitations(
  id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,role public.organization_role not null,token_hash text not null unique,status public.staff_invitation_status not null default 'pending',
  expires_at timestamptz not null,invited_by uuid not null references auth.users(id),accepted_by uuid references auth.users(id),accepted_at timestamptz,
  revoked_at timestamptz,created_at timestamptz not null default now(),check(role<>'owner')
);
create unique index staff_invitations_pending_email on public.staff_invitations(organization_id,lower(email)) where status='pending';
create table public.staff_invitation_branches(invitation_id uuid not null references public.staff_invitations(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,primary key(invitation_id,branch_id));

create function public.create_staff_invitation(p_organization_id uuid,p_email text,p_role public.organization_role,p_branch_ids uuid[],p_expires_hours integer default 72)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare token text:=encode(gen_random_bytes(32),'hex'); invite_id uuid; normalized_email text:=lower(trim(p_email));
begin if not public.has_permission(p_organization_id,'staff.manage') then raise exception 'Staff management access required' using errcode='42501'; end if;
  if p_role='owner' or normalized_email!~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or p_expires_hours not between 1 and 168 then raise exception 'Invalid invitation'; end if;
  if exists(select 1 from public.organization_memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id and lower(u.email)=normalized_email) then raise exception 'User is already a member'; end if;
  update public.staff_invitations set status='revoked',revoked_at=now() where organization_id=p_organization_id and lower(email)=normalized_email and status='pending';
  insert into public.staff_invitations(organization_id,email,role,token_hash,expires_at,invited_by) values(p_organization_id,normalized_email,p_role,encode(digest(token,'sha256'),'hex'),now()+make_interval(hours=>p_expires_hours),auth.uid()) returning id into invite_id;
  if coalesce(array_length(p_branch_ids,1),0)>0 then
    if exists(select 1 from unnest(p_branch_ids) bid where not exists(select 1 from public.branches b where b.id=bid and b.organization_id=p_organization_id and b.is_active)) then raise exception 'Invalid invitation branch'; end if;
    insert into public.staff_invitation_branches(invitation_id,branch_id) select invite_id,bid from unnest(p_branch_ids) bid;
  end if;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(p_organization_id,auth.uid(),'staff_invitation',invite_id,'staff.invited',jsonb_build_object('email',normalized_email,'role',p_role)); return token;
end $$;

create function public.accept_staff_invitation(p_token text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.staff_invitations; membership_id uuid; current_email text;
begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; select lower(email) into current_email from auth.users where id=auth.uid();
  select * into invite from public.staff_invitations where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if invite.id is null or invite.status<>'pending' then raise exception 'Invitation is invalid'; end if;
  if invite.expires_at<=now() then update public.staff_invitations set status='expired' where id=invite.id; raise exception 'Invitation has expired'; end if;
  if current_email is distinct from invite.email then raise exception 'Invitation email does not match' using errcode='42501'; end if;
  insert into public.profiles(id) values(auth.uid()) on conflict(id) do nothing;
  insert into public.organization_memberships(organization_id,user_id,role,is_active) values(invite.organization_id,auth.uid(),invite.role,true)
    on conflict(organization_id,user_id) do update set role=excluded.role,is_active=true returning id into membership_id;
  insert into public.membership_branch_assignments(membership_id,organization_id,branch_id) select membership_id,invite.organization_id,branch_id from public.staff_invitation_branches where invitation_id=invite.id;
  update public.staff_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invite.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(invite.organization_id,auth.uid(),'membership',membership_id,'staff.invitation_accepted',jsonb_build_object('role',invite.role)); return invite.organization_id;
end $$;

create function public.update_staff_member(p_membership_id uuid,p_role public.organization_role,p_is_active boolean,p_branch_ids uuid[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.organization_memberships;
begin select * into target from public.organization_memberships where id=p_membership_id for update;
  if target.id is null or not public.has_permission(target.organization_id,'staff.manage') then raise exception 'Staff member not found' using errcode='42501'; end if;
  if target.role='owner' or p_role='owner' or target.user_id=auth.uid() then raise exception 'Owner membership is protected'; end if;
  if exists(select 1 from unnest(p_branch_ids) bid where not exists(select 1 from public.branches b where b.id=bid and b.organization_id=target.organization_id and b.is_active)) then raise exception 'Invalid staff branch'; end if;
  update public.organization_memberships set role=p_role,is_active=p_is_active where id=target.id;
  delete from public.membership_branch_assignments where membership_id=target.id;
  insert into public.membership_branch_assignments(membership_id,organization_id,branch_id) select target.id,target.organization_id,bid from unnest(p_branch_ids) bid;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(target.organization_id,auth.uid(),'membership',target.id,case when p_is_active then 'staff.updated' else 'staff.disabled' end,jsonb_build_object('role',p_role,'branches',p_branch_ids));
end $$;

create function public.revoke_staff_invitation(p_invitation_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$ declare invite public.staff_invitations; begin
  select * into invite from public.staff_invitations where id=p_invitation_id for update; if invite.id is null or not public.has_permission(invite.organization_id,'staff.manage') then raise exception 'Invitation not found' using errcode='42501'; end if;
  if invite.status<>'pending' then raise exception 'Invitation cannot be revoked'; end if; update public.staff_invitations set status='revoked',revoked_at=now() where id=invite.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type) values(invite.organization_id,auth.uid(),'staff_invitation',invite.id,'staff.invitation_revoked'); end $$;

create function public.enforce_actor_branch_access() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ declare row_org uuid; row_branch uuid; begin
  if auth.uid() is null then return case when tg_op='DELETE' then old else new end; end if;
  row_org:=case when tg_op='DELETE' then old.organization_id else new.organization_id end; row_branch:=case when tg_op='DELETE' then old.branch_id else new.branch_id end;
  if not public.can_access_branch(row_org,row_branch) then raise exception 'Branch access denied' using errcode='42501'; end if; return case when tg_op='DELETE' then old else new end; end $$;

alter table public.membership_branch_assignments enable row level security; alter table public.staff_invitations enable row level security; alter table public.staff_invitation_branches enable row level security;
create policy membership_branches_select on public.membership_branch_assignments for select to authenticated using(public.is_org_member(organization_id)); create policy invitations_owner_select on public.staff_invitations for select to authenticated using(public.has_permission(organization_id,'staff.manage')); create policy invitation_branches_owner_select on public.staff_invitation_branches for select to authenticated using(exists(select 1 from public.staff_invitations i where i.id=invitation_id and public.has_permission(i.organization_id,'staff.manage')));
grant select on public.membership_branch_assignments,public.staff_invitations,public.staff_invitation_branches to authenticated;
grant execute on function public.has_permission(uuid,public.permission_key),public.can_access_branch(uuid,uuid),public.create_staff_invitation(uuid,text,public.organization_role,uuid[],integer),public.accept_staff_invitation(text),public.update_staff_member(uuid,public.organization_role,boolean,uuid[]),public.revoke_staff_invitation(uuid) to authenticated;

create policy branches_staff_scope on public.branches as restrictive for all to authenticated using(public.can_access_branch(organization_id,id)) with check(public.can_access_branch(organization_id,id));
create policy appointments_staff_scope on public.appointments as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy queue_staff_scope on public.queue_entries as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy jobs_staff_scope on public.job_orders as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy payments_staff_scope on public.payments as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy inventory_items_staff_scope on public.inventory_items as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy inventory_movements_staff_scope on public.inventory_movements as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy estimates_staff_scope on public.estimates as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy invoices_staff_scope on public.invoices as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));
create policy reminders_staff_scope on public.maintenance_reminders as restrictive for all to authenticated using(public.can_access_branch(organization_id,branch_id)) with check(public.can_access_branch(organization_id,branch_id));

create trigger appointments_actor_branch before insert or update or delete on public.appointments for each row execute function public.enforce_actor_branch_access();
create trigger queue_actor_branch before insert or update or delete on public.queue_entries for each row execute function public.enforce_actor_branch_access();
create trigger jobs_actor_branch before insert or update or delete on public.job_orders for each row execute function public.enforce_actor_branch_access();
create trigger payments_actor_branch before insert or update or delete on public.payments for each row execute function public.enforce_actor_branch_access();
create trigger inventory_items_actor_branch before insert or update or delete on public.inventory_items for each row execute function public.enforce_actor_branch_access();
create trigger inventory_movements_actor_branch before insert or update or delete on public.inventory_movements for each row execute function public.enforce_actor_branch_access();
create trigger estimates_actor_branch before insert or update or delete on public.estimates for each row execute function public.enforce_actor_branch_access();
create trigger invoices_actor_branch before insert or update or delete on public.invoices for each row execute function public.enforce_actor_branch_access();
create trigger reminders_actor_branch before insert or update or delete on public.maintenance_reminders for each row execute function public.enforce_actor_branch_access();
