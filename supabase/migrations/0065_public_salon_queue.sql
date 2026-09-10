-- A narrow anonymous projection for a published Salon's customer queue.
-- Internal appointments/customers retain their existing RLS and table grants.
create function public.get_public_salon_queue(p_slug text, p_branch_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare business record; local_day date; result jsonb;
begin
  select o.id as organization_id,o.name as organization_name,b.name as branch_name,b.timezone
    into business
  from public.organizations o join public.branches b on b.organization_id=o.id
  where o.slug=lower(trim(p_slug)) and o.industry='salon'
    and o.status='active' and o.public_page_enabled
    and b.id=p_branch_id and b.is_active;
  if not found then return null; end if;
  local_day:=(now() at time zone business.timezone)::date;
  with queue as (
    select a.id,a.starts_at,a.status,
      regexp_split_to_array(trim(coalesce(c.full_name,'')), '\s+') as name_parts
    from public.appointments a
    join public.customers c on c.id=a.customer_id and c.organization_id=a.organization_id
    where a.organization_id=business.organization_id and a.branch_id=p_branch_id
      and a.status in('checked_in','in_service')
      and a.starts_at >= (local_day::timestamp at time zone business.timezone)
      and a.starts_at < ((local_day+1)::timestamp at time zone business.timezone)
  ), items as (
    select id,starts_at,status,jsonb_build_object(
      'key',substr(encode(extensions.digest(id::text||local_day::text,'sha256'),'hex'),1,16),
      'label',case when coalesce(name_parts[1],'')='' then 'Guest'
        else left(name_parts[1],24)||case when cardinality(name_parts)>1
          then ' '||left(name_parts[cardinality(name_parts)],1)||'.' else '' end end,
      'detail','Appointment '||to_char(starts_at at time zone business.timezone,'FMHH12:MI AM')
    ) as item from queue
  )
  select jsonb_build_object(
    'organizationName',business.organization_name,'branchName',business.branch_name,
    'industry','salon','date',local_day::text,'timezone',business.timezone,'refreshedAt',now(),
    'serving',coalesce(jsonb_agg(item order by starts_at,id) filter(where status='in_service'),'[]'::jsonb),
    'waiting',coalesce(jsonb_agg(item order by starts_at,id) filter(where status='checked_in'),'[]'::jsonb)
  ) into result from items;
  return result;
end $$;

revoke all on function public.get_public_salon_queue(text,uuid) from public;
grant execute on function public.get_public_salon_queue(text,uuid) to anon,authenticated;
notify pgrst, 'reload schema';
