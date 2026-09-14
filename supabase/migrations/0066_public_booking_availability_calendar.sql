-- Expose a bounded date-level projection for the public booking calendar.
-- Slot validation remains delegated to get_public_availability and the final
-- submit_public_booking call continues to recheck the selected slot.
create or replace function public.get_public_availability_dates(
  p_slug text,
  p_branch_id uuid,
  p_service_id uuid,
  p_start_date date,
  p_end_date date
)
returns table(available_date date, slot_count bigint)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if p_start_date is null or p_end_date is null
    or p_end_date < p_start_date
    or p_end_date > p_start_date + 41 then
    return;
  end if;

  return query
    select day_value::date, count(slot.slot_at)
    from generate_series(p_start_date, p_end_date, interval '1 day') day_value
    cross join lateral public.get_public_availability(
      p_slug,
      p_branch_id,
      p_service_id,
      day_value::date
    ) slot
    group by day_value::date
    having count(slot.slot_at) > 0
    order by day_value::date;
end
$$;

revoke all on function public.get_public_availability_dates(text,uuid,uuid,date,date) from public;
grant execute on function public.get_public_availability_dates(text,uuid,uuid,date,date) to anon,authenticated;

notify pgrst, 'reload schema';
