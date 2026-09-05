-- Vertical-neutral, branch-local aggregates for the NegOSu Owner Command Center.

create index if not exists payments_branch_paid_at_idx
on public.payments(branch_id,paid_at) include(amount_centavos)
where status='paid';

create index if not exists invoices_branch_outstanding_idx
on public.invoices(branch_id) include(balance_centavos)
where status<>'void' and balance_centavos>0;

create index if not exists appointments_branch_completed_idx
on public.appointments(branch_id) include(expected_total_centavos)
where status='completed';

create index if not exists inventory_items_branch_idx
on public.inventory_items(branch_id,id);

create index if not exists inventory_movements_item_idx
on public.inventory_movements(inventory_item_id);

create or replace function public.get_command_center_shared_metrics(
  p_organization_id uuid,
  p_branch_ids uuid[]
)
returns table(
  branch_id uuid,
  branch_name text,
  timezone text,
  revenue_today_centavos bigint,
  appointments_today bigint,
  outstanding_centavos bigint,
  low_stock_count bigint
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  requested_count integer:=coalesce(cardinality(p_branch_ids),0);
  eligible_count integer;
begin
  if auth.uid() is null
    or p_organization_id is null
    or not public.has_org_role(p_organization_id,array['owner','manager']::public.organization_role[])
    or requested_count not between 1 and 100
    or exists(select 1 from unnest(p_branch_ids) requested_id where requested_id is null)
    or requested_count<>(select count(distinct requested_id) from unnest(p_branch_ids) requested_id)
  then
    raise exception 'Command Center access denied' using errcode='42501';
  end if;

  select count(*) into eligible_count
  from public.branches branch
  where branch.id=any(p_branch_ids)
    and branch.organization_id=p_organization_id
    and branch.is_active
    and public.can_access_branch(p_organization_id,branch.id);

  if eligible_count<>requested_count then
    raise exception 'Command Center branch scope unavailable' using errcode='42501';
  end if;

  return query
  with eligible_branches as materialized (
    select branch.id,branch.name,branch.timezone
    from public.branches branch
    where branch.id=any(p_branch_ids)
      and branch.organization_id=p_organization_id
      and branch.is_active
      and public.can_access_branch(p_organization_id,branch.id)
  ),
  daily_revenue as (
    select branch.id,
      coalesce(sum(payment.amount_centavos) filter(where payment.id is not null),0)::bigint amount
    from eligible_branches branch
    left join public.payments payment on payment.branch_id=branch.id
      and payment.organization_id=p_organization_id
      and payment.status='paid'
      and payment.paid_at>=(date_trunc('day',current_timestamp at time zone branch.timezone) at time zone branch.timezone)
      and payment.paid_at<((date_trunc('day',current_timestamp at time zone branch.timezone)+interval '1 day') at time zone branch.timezone)
    group by branch.id
  ),
  daily_appointments as (
    select branch.id,
      count(appointment.id)::bigint amount
    from eligible_branches branch
    left join public.appointments appointment on appointment.branch_id=branch.id
      and appointment.organization_id=p_organization_id
      and appointment.starts_at>=(date_trunc('day',current_timestamp at time zone branch.timezone) at time zone branch.timezone)
      and appointment.starts_at<((date_trunc('day',current_timestamp at time zone branch.timezone)+interval '1 day') at time zone branch.timezone)
    group by branch.id
  ),
  invoice_outstanding as (
    select branch.id,
      coalesce(sum(invoice.balance_centavos) filter(where invoice.id is not null and invoice.status<>'void'),0)::bigint amount
    from eligible_branches branch
    left join public.invoices invoice on invoice.branch_id=branch.id
      and invoice.organization_id=p_organization_id
      and invoice.status<>'void'
      and invoice.balance_centavos>0
    group by branch.id
  ),
  appointment_paid as (
    select payment.appointment_id,
      sum(payment.amount_centavos)::bigint amount
    from public.payments payment
    join eligible_branches branch on branch.id=payment.branch_id
    where payment.organization_id=p_organization_id
      and payment.appointment_id is not null
      and payment.status='paid'
    group by payment.appointment_id
  ),
  appointment_outstanding as (
    select branch.id,
      coalesce(sum(greatest(appointment.expected_total_centavos-coalesce(paid.amount,0),0)) filter(where appointment.id is not null),0)::bigint amount
    from eligible_branches branch
    left join public.appointments appointment on appointment.branch_id=branch.id
      and appointment.organization_id=p_organization_id
      and appointment.status='completed'
    left join appointment_paid paid on paid.appointment_id=appointment.id
    group by branch.id
  ),
  low_stock as (
    select branch.id,
      count(stock.id) filter(where stock.low_stock)::bigint amount
    from eligible_branches branch
    left join public.inventory_stock stock on stock.branch_id=branch.id
      and stock.organization_id=p_organization_id
    group by branch.id
  )
  select branch.id,branch.name,branch.timezone,
    revenue.amount,
    appointments.amount,
    invoice_balance.amount+appointment_balance.amount,
    stock.amount
  from eligible_branches branch
  join daily_revenue revenue on revenue.id=branch.id
  join daily_appointments appointments on appointments.id=branch.id
  join invoice_outstanding invoice_balance on invoice_balance.id=branch.id
  join appointment_outstanding appointment_balance on appointment_balance.id=branch.id
  join low_stock stock on stock.id=branch.id
  order by branch.name,branch.id;
end
$$;

revoke all on function public.get_command_center_shared_metrics(uuid,uuid[]) from public,anon;
grant execute on function public.get_command_center_shared_metrics(uuid,uuid[]) to authenticated;
