-- Phase 11: permission-protected, timezone-safe owner reporting.

create or replace function public.get_owner_report(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_branch_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_end_date - p_start_date > 731 then
    raise exception 'Invalid reporting range';
  end if;
  if not public.has_permission(p_organization_id,'reports.view') then
    raise exception 'Reporting access required' using errcode='42501';
  end if;
  if p_branch_id is not null and not exists(
    select 1 from public.branches b where b.id=p_branch_id and b.organization_id=p_organization_id
      and public.can_access_branch(p_organization_id,b.id)
  ) then raise exception 'Branch not found' using errcode='42501'; end if;

  with eligible_branches as (
    select b.id,b.name,b.timezone from public.branches b
    where b.organization_id=p_organization_id and (p_branch_id is null or b.id=p_branch_id)
      and public.can_access_branch(p_organization_id,b.id)
  ), period_invoices as (
    select i.* from public.invoices i join eligible_branches b on b.id=i.branch_id
    where i.status<>'void' and i.issued_at is not null
      and (i.issued_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), period_payments as (
    select p.* from public.payments p join eligible_branches b on b.id=p.branch_id
    where p.status='paid' and p.paid_at is not null
      and (p.paid_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), period_jobs as (
    select j.* from public.job_orders j join eligible_branches b on b.id=j.branch_id
    where j.status='completed' and j.completed_at is not null
      and (j.completed_at at time zone b.timezone)::date between p_start_date and p_end_date
  ), served as (
    select distinct customer_id from period_jobs
  ), customer_lifetime as (
    select j.customer_id,count(*) completed_jobs,min((j.completed_at at time zone b.timezone)::date) first_date
    from public.job_orders j join eligible_branches b on b.id=j.branch_id
    where j.status='completed' and j.completed_at is not null group by j.customer_id
  )
  select jsonb_build_object(
    'startDate',p_start_date,'endDate',p_end_date,
    'summary',jsonb_build_object(
      'grossSalesCentavos',(select coalesce(sum(total_centavos),0) from period_invoices),
      'paymentsReceivedCentavos',(select coalesce(sum(amount_centavos),0) from period_payments),
      'outstandingCentavos',(select coalesce(sum(balance_centavos),0) from period_invoices),
      'jobsCompleted',(select count(*) from period_jobs),
      'averageTicketCentavos',(select coalesce(round(avg(total_centavos)),0) from period_invoices),
      'customersServed',(select count(*) from served),
      'repeatCustomers',(select count(*) from customer_lifetime l join served s using(customer_id) where l.completed_jobs>1),
      'newCustomers',(select count(*) from customer_lifetime l join served s using(customer_id) where l.first_date between p_start_date and p_end_date)
    ),
    'daily',(select coalesce(jsonb_agg(to_jsonb(x) order by x."day"),'[]') from (
      select report_day "day",sum(gross)::bigint "grossSalesCentavos",sum(received)::bigint "paymentsReceivedCentavos",sum(jobs)::bigint "jobsCompleted"
      from (
        select (i.issued_at at time zone b.timezone)::date report_day,i.total_centavos gross,0::bigint received,0::bigint jobs from period_invoices i join eligible_branches b on b.id=i.branch_id
        union all select (p.paid_at at time zone b.timezone)::date,0,p.amount_centavos,0 from period_payments p join eligible_branches b on b.id=p.branch_id
        union all select (j.completed_at at time zone b.timezone)::date,0,0,1 from period_jobs j join eligible_branches b on b.id=j.branch_id
      ) d group by report_day
    ) x),
    'services',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc,x.service),'[]') from (
      select ji.service_name_snapshot service,coalesce(sc.name,'Uncategorized') category,sum(ji.line_total_centavos)::bigint "revenueCentavos",sum(ji.quantity)::bigint quantity
      from period_jobs j join public.job_order_items ji on ji.job_order_id=j.id left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id
      where ji.approval_status='approved' group by ji.service_name_snapshot,coalesce(sc.name,'Uncategorized')
    ) x),
    'categories',(select coalesce(jsonb_agg(to_jsonb(x) order by x."revenueCentavos" desc),'[]') from (
      select coalesce(sc.name,'Uncategorized') category,sum(ji.line_total_centavos)::bigint "revenueCentavos"
      from period_jobs j join public.job_order_items ji on ji.job_order_id=j.id left join public.services s on s.id=ji.service_id left join public.service_categories sc on sc.id=s.category_id
      where ji.approval_status='approved' group by coalesce(sc.name,'Uncategorized')
    ) x),
    'technicians',(select coalesce(jsonb_agg(to_jsonb(x) order by x."assignedJobs" desc,x.name),'[]') from (
      select coalesce(pr.full_name,u.email,'Unassigned') name,count(distinct j.id)::bigint "assignedJobs",count(distinct j.id) filter(where j.status='completed')::bigint "completedJobs"
      from public.job_orders j join eligible_branches b on b.id=j.branch_id left join auth.users u on u.id=j.primary_technician_user_id left join public.profiles pr on pr.id=u.id
      where (j.created_at at time zone b.timezone)::date between p_start_date and p_end_date group by coalesce(pr.full_name,u.email,'Unassigned')
    ) x),
    'branches',(select coalesce(jsonb_agg(to_jsonb(x) order by x."grossSalesCentavos" desc,x.name),'[]') from (
      select b.id,b.name,coalesce(sum(i.total_centavos),0)::bigint "grossSalesCentavos",count(i.id)::bigint invoices
      from eligible_branches b left join period_invoices i on i.branch_id=b.id group by b.id,b.name
    ) x)
  ) into result;
  return result;
end $$;

revoke all on function public.get_owner_report(uuid,date,date,uuid) from public,anon;
grant execute on function public.get_owner_report(uuid,date,date,uuid) to authenticated;
