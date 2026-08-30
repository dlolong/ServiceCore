-- Keep customer-facing staff labels aligned with the KarKR automotive brand.
create or replace function public.list_staff(p_organization_id uuid)
returns table(membership_id uuid,user_id uuid,full_name text,email text,role public.organization_role,is_active boolean,branch_ids uuid[],created_at timestamptz)
language sql stable security definer set search_path=public,auth,pg_temp as $$
  select m.id,m.user_id,coalesce(p.full_name,u.email,'KarKR user'),u.email,m.role,m.is_active,
    coalesce(array_agg(mba.branch_id) filter(where mba.branch_id is not null),'{}'::uuid[]),m.created_at
  from public.organization_memberships m join auth.users u on u.id=m.user_id left join public.profiles p on p.id=m.user_id
  left join public.membership_branch_assignments mba on mba.membership_id=m.id
  where m.organization_id=p_organization_id and public.has_permission(p_organization_id,'staff.manage')
  group by m.id,p.full_name,u.email order by m.created_at
$$;
