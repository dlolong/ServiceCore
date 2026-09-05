-- Keep organization vertical identity under trusted operational control.
-- Ordinary authenticated sessions may update organization settings, but may not
-- promote a tenant into another vertical and thereby unlock its capabilities.
create function public.prevent_authenticated_industry_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.industry is distinct from old.industry
     and auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Organization industry cannot be changed by an authenticated user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_industry_immutable
before update of industry on public.organizations
for each row execute function public.prevent_authenticated_industry_change();

-- Completion is a shared appointment lifecycle transition. Automotive normally
-- moves checked-in appointments into its queue/job-order workflow; standalone
-- verticals may complete the appointment itself without introducing a Job Order.
create or replace function public.transition_appointment(
  p_appointment_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data public.appointments;
  next_status public.appointment_status;
begin
  select * into row_data from public.appointments where id = p_appointment_id for update;
  if row_data.id is null
     or not public.has_org_role(row_data.organization_id, array['owner','manager','advisor']::public.organization_role[])
     or not public.can_access_branch(row_data.organization_id, row_data.branch_id) then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;

  next_status := case
    when p_action = 'confirm' and row_data.status = 'requested' then 'confirmed'::public.appointment_status
    when p_action = 'arrive' and row_data.status in ('requested','confirmed') then 'checked_in'::public.appointment_status
    when p_action = 'complete' and row_data.status = 'checked_in' then 'completed'::public.appointment_status
    when p_action = 'cancel' and row_data.status in ('requested','confirmed') then 'cancelled'::public.appointment_status
    when p_action = 'no_show' and row_data.status in ('requested','confirmed') then 'no_show'::public.appointment_status
    else null::public.appointment_status
  end;
  if next_status is null then raise exception 'Invalid appointment transition'; end if;

  update public.appointments
  set status = next_status,
      cancellation_reason = case when next_status = 'cancelled' then nullif(trim(coalesce(p_reason, '')), '') else cancellation_reason end,
      cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end
  where id = row_data.id;
end;
$$;

comment on function public.transition_appointment(uuid,text,text) is
  'Shared controlled appointment lifecycle. Vertical work execution remains outside Core scheduling.';
