-- KarKR customer digital estimate approval. Raw bearer tokens are generated in
-- server-only application code; PostgreSQL stores and compares SHA-256 hashes.

alter table public.estimates drop constraint if exists estimates_authorization_method_check;
alter table public.estimates add constraint estimates_authorization_method_check
  check (authorization_method in ('in_person','phone','sms','messenger','email','digital_link','other'));

create table public.estimate_approval_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_order_id uuid not null references public.job_orders(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  estimate_version integer not null check (estimate_version > 0),
  estimate_total_centavos bigint not null check (estimate_total_centavos >= 0),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','approved','declined','revoked','superseded','expired')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  customer_comment text check (customer_comment is null or char_length(customer_comment) <= 1000)
);

create unique index estimate_approval_links_one_active
  on public.estimate_approval_links(estimate_id) where status='active';
create index estimate_approval_links_job_created
  on public.estimate_approval_links(job_order_id,created_at desc);

alter table public.estimate_approval_links enable row level security;
create policy estimate_approval_links_staff_select on public.estimate_approval_links
  for select to authenticated
  using (
    public.has_org_role(organization_id,array['owner','manager','advisor']::public.organization_role[])
    and public.can_access_branch(organization_id,branch_id)
  );
revoke all on table public.estimate_approval_links from anon,authenticated;
grant select on public.estimate_approval_links to authenticated;

create function public.create_estimate_approval_link(
  p_estimate_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) returns table(link_id uuid,expires_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  estimate_row public.estimates;
  created_link_id uuid;
  replaced_link record;
begin
  select * into estimate_row from public.estimates where id=p_estimate_id for update;
  if estimate_row.id is null
    or not public.has_org_role(estimate_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(estimate_row.organization_id,estimate_row.branch_id)
  then raise exception 'Estimate not found' using errcode='42501'; end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at <= now()+interval '1 hour'
    or p_expires_at > now()+interval '14 days'
  then raise exception 'Invalid approval link'; end if;
  if estimate_row.status not in ('draft','sent')
    or not exists(select 1 from public.estimate_items where estimate_id=estimate_row.id)
    or exists(select 1 from public.estimates newer where newer.job_order_id=estimate_row.job_order_id and newer.version>estimate_row.version)
  then raise exception 'Only the current undecided estimate can be shared'; end if;

  for replaced_link in
    update public.estimate_approval_links
      set status='revoked',revoked_at=now()
      where estimate_id=estimate_row.id and status='active'
      returning id
  loop
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(estimate_row.organization_id,auth.uid(),'estimate_approval_link',replaced_link.id,'estimate.approval_link_revoked',jsonb_build_object('reason','replaced'));
  end loop;

  insert into public.estimate_approval_links(
    organization_id,branch_id,job_order_id,estimate_id,estimate_version,
    estimate_total_centavos,token_hash,expires_at,created_by
  ) values(
    estimate_row.organization_id,estimate_row.branch_id,estimate_row.job_order_id,estimate_row.id,estimate_row.version,
    estimate_row.total_centavos,p_token_hash,p_expires_at,auth.uid()
  ) returning id into created_link_id;

  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(estimate_row.organization_id,auth.uid(),'estimate_approval_link',created_link_id,'estimate.approval_link_created',
    jsonb_build_object('estimate_id',estimate_row.id,'version',estimate_row.version,'amount_centavos',estimate_row.total_centavos,'expires_at',p_expires_at));

  return query select created_link_id,p_expires_at;
end $$;

create function public.revoke_estimate_approval_link(p_link_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare link_row public.estimate_approval_links;
begin
  select * into link_row from public.estimate_approval_links where id=p_link_id for update;
  if link_row.id is null
    or not public.has_org_role(link_row.organization_id,array['owner','manager','advisor']::public.organization_role[])
    or not public.can_access_branch(link_row.organization_id,link_row.branch_id)
  then raise exception 'Approval link not found' using errcode='42501'; end if;
  if link_row.status<>'active' then raise exception 'Approval link is no longer active'; end if;

  update public.estimate_approval_links set status='revoked',revoked_at=now() where id=link_row.id;
  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(link_row.organization_id,auth.uid(),'estimate_approval_link',link_row.id,'estimate.approval_link_revoked',jsonb_build_object('reason','manual'));
end $$;

create or replace function public.get_public_estimate_approval(p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  link_row public.estimate_approval_links;
  estimate_row public.estimates;
  payload jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid'); end if;
  select * into link_row from public.estimate_approval_links where token_hash=p_token_hash;
  if link_row.id is null then return jsonb_build_object('state','invalid'); end if;
  if link_row.status='revoked' then return jsonb_build_object('state','revoked'); end if;
  if link_row.status='superseded' then return jsonb_build_object('state','superseded'); end if;
  if link_row.status='expired' or link_row.expires_at<=now() then return jsonb_build_object('state','expired'); end if;

  select * into estimate_row from public.estimates where id=link_row.estimate_id;
  if estimate_row.id is null
    or estimate_row.version<>link_row.estimate_version
    or estimate_row.total_centavos<>link_row.estimate_total_centavos
    or exists(select 1 from public.estimates newer where newer.job_order_id=link_row.job_order_id and newer.version>link_row.estimate_version)
    or (link_row.status='active' and estimate_row.status not in ('draft','sent'))
  then return jsonb_build_object('state','superseded'); end if;

  select jsonb_build_object(
    'state',link_row.status,
    'expiresAt',link_row.expires_at,
    'decidedAt',link_row.used_at,
    'estimate',jsonb_build_object(
      'version',link_row.estimate_version,
      'subtotalCentavos',estimate_row.subtotal_centavos,
      'discountCentavos',estimate_row.discount_centavos,
      'taxCentavos',estimate_row.tax_centavos,
      'totalCentavos',estimate_row.total_centavos,
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'description',item.description_snapshot,
          'quantity',item.quantity,
          'unitPriceCentavos',item.unit_price_centavos,
          'discountCentavos',item.discount_centavos,
          'lineTotalCentavos',item.line_total_centavos
        ) order by item.id)
        from public.estimate_items item where item.estimate_id=estimate_row.id
      ),'[]'::jsonb)
    ),
    'business',(select jsonb_build_object('name',organization.name,'phone',organization.phone) from public.organizations organization where organization.id=link_row.organization_id),
    'branch',(select jsonb_build_object(
      'name',branch.name,'phone',branch.phone,'email',branch.email,
      'address',jsonb_build_array(branch.address_line,branch.city,branch.province)
    ) from public.branches branch where branch.id=link_row.branch_id),
    'job',(select jsonb_build_object(
      'reference',case when job.job_number is null then 'Job order' else 'JO-'||extract(year from job.created_at)::integer||'-'||lpad(job.job_number::text,6,'0') end,
      'vehicle',(select jsonb_build_object('make',vehicle.make,'model',vehicle.model,'modelYear',vehicle.model_year,'plateNumber',vehicle.plate_number) from public.vehicles vehicle where vehicle.id=job.vehicle_id)
    ) from public.job_orders job where job.id=link_row.job_order_id)
  ) into payload;
  return payload;
end $$;

create function public.decide_public_estimate_approval(
  p_token_hash text,
  p_decision text,
  p_comment text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  link_row public.estimate_approval_links;
  estimate_row public.estimates;
  normalized_comment text:=nullif(trim(coalesce(p_comment,'')),'');
  latest_estimate_id uuid;
  decision_status text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_decision not in ('approve','decline')
    or char_length(coalesce(normalized_comment,''))>1000
  then return jsonb_build_object('state','invalid'); end if;

  select * into link_row from public.estimate_approval_links where token_hash=p_token_hash for update;
  if link_row.id is null then return jsonb_build_object('state','invalid'); end if;
  if link_row.status in ('approved','declined') then
    if link_row.status=(case when p_decision='approve' then 'approved' else 'declined' end)
      then return jsonb_build_object('state',link_row.status,'idempotent',true);
    end if;
    return jsonb_build_object('state','already_'||link_row.status);
  end if;
  if link_row.status in ('revoked','superseded','expired') then return jsonb_build_object('state',link_row.status); end if;
  if link_row.expires_at<=now() then
    update public.estimate_approval_links set status='expired' where id=link_row.id;
    return jsonb_build_object('state','expired');
  end if;

  select id into latest_estimate_id from public.estimates where job_order_id=link_row.job_order_id order by version desc limit 1;
  select * into estimate_row from public.estimates where id=link_row.estimate_id for update;
  if estimate_row.id is null
    or latest_estimate_id<>estimate_row.id
    or estimate_row.version<>link_row.estimate_version
    or estimate_row.total_centavos<>link_row.estimate_total_centavos
    or estimate_row.status not in ('draft','sent')
  then
    update public.estimate_approval_links set status='superseded' where id=link_row.id;
    return jsonb_build_object('state','superseded');
  end if;
  if not exists(select 1 from public.estimate_items where estimate_id=estimate_row.id) then
    update public.estimate_approval_links set status='superseded' where id=link_row.id;
    return jsonb_build_object('state','superseded');
  end if;

  decision_status:=case when p_decision='approve' then 'approved' else 'declined' end;
  -- Consume first so the estimate-status trigger cannot supersede this link.
  update public.estimate_approval_links set status=decision_status,used_at=now(),customer_comment=normalized_comment where id=link_row.id;
  update public.estimates set
    status=decision_status::public.estimate_status,
    approved_at=now(),
    approved_by=null,
    approval_note=normalized_comment,
    authorization_method='digital_link',
    authorized_total_centavos=estimate_row.total_centavos
  where id=estimate_row.id;
  update public.job_orders set status=case
    when decision_status='approved' and status in ('draft','queued','awaiting_approval') then 'approved'::public.job_status
    else status end
  where id=estimate_row.job_order_id;

  insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
  values(estimate_row.organization_id,null,'estimate',estimate_row.id,
    case when decision_status='approved' then 'estimate.digital_approved' else 'estimate.digital_declined' end,
    jsonb_build_object('link_id',link_row.id,'version',estimate_row.version,'amount_centavos',estimate_row.total_centavos,'method','digital_link'));
  return jsonb_build_object('state',decision_status,'idempotent',false);
end $$;

create function public.invalidate_estimate_approval_links() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare invalidated_link record;
begin
  if old.total_centavos is distinct from new.total_centavos
    or old.subtotal_centavos is distinct from new.subtotal_centavos
    or old.discount_centavos is distinct from new.discount_centavos
    or old.tax_centavos is distinct from new.tax_centavos
    or (old.status is distinct from new.status and new.status not in ('draft','sent'))
  then
    for invalidated_link in
      update public.estimate_approval_links set status='superseded'
      where estimate_id=new.id and status='active'
      returning id
    loop
      insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
      values(new.organization_id,auth.uid(),'estimate_approval_link',invalidated_link.id,'estimate.approval_link_superseded',jsonb_build_object('estimate_id',new.id,'version',new.version));
    end loop;
  end if;
  return new;
end $$;
create trigger estimate_approval_links_invalidate
after update of subtotal_centavos,discount_centavos,tax_centavos,total_centavos,status on public.estimates
for each row execute function public.invalidate_estimate_approval_links();

create or replace function public.invalidate_estimate_item_approval_links() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  target_estimate_id uuid:=case when tg_op='DELETE' then old.estimate_id else new.estimate_id end;
  target_estimate public.estimates;
  invalidated_link record;
begin
  select * into target_estimate from public.estimates where id=target_estimate_id;
  if target_estimate.id is null then return case when tg_op='DELETE' then old else new end; end if;
  for invalidated_link in
    update public.estimate_approval_links set status='superseded'
    where estimate_id=target_estimate_id and status='active'
    returning id
  loop
    insert into public.audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata)
    values(target_estimate.organization_id,auth.uid(),'estimate_approval_link',invalidated_link.id,'estimate.approval_link_superseded',
      jsonb_build_object('estimate_id',target_estimate.id,'version',target_estimate.version,'reason','estimate_item_changed'));
  end loop;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger estimate_item_approval_links_invalidate
after insert or update or delete on public.estimate_items
for each row execute function public.invalidate_estimate_item_approval_links();

revoke all on function public.create_estimate_approval_link(uuid,text,timestamptz),public.revoke_estimate_approval_link(uuid),
  public.get_public_estimate_approval(text),public.decide_public_estimate_approval(text,text,text) from public,anon,authenticated;
grant execute on function public.create_estimate_approval_link(uuid,text,timestamptz),public.revoke_estimate_approval_link(uuid) to authenticated;
grant execute on function public.get_public_estimate_approval(text),public.decide_public_estimate_approval(text,text,text) to anon,authenticated;
