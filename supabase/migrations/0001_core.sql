-- KarKR core tenant/domain schema
create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner','manager','advisor','technician','cashier','viewer');
create type public.appointment_status as enum ('requested','confirmed','checked_in','completed','cancelled','no_show');
create type public.job_status as enum ('draft','queued','in_progress','quality_check','ready','completed','cancelled');
create type public.payment_status as enum ('pending','paid','failed','refunded','voided');
create type public.payment_method as enum ('cash','gcash','maya','bank_transfer','card','other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text,
  phone text,
  currency text not null default 'PHP' check (char_length(currency)=3),
  timezone text not null default 'Asia/Manila',
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  phone text,
  email text,
  address_line text,
  city text,
  province text,
  postal_code text,
  timezone text not null default 'Asia/Manila',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  phone_normalized text,
  email text,
  notes text,
  is_archived boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_name_idx on public.customers(organization_id, full_name);
create index customers_org_phone_idx on public.customers(organization_id, phone_normalized) where phone_normalized is not null;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  plate_number text,
  plate_normalized text,
  make text,
  model text,
  model_year int check (model_year is null or model_year between 1900 and 2200),
  color text,
  vin text,
  odometer_km int check (odometer_km is null or odometer_km >= 0),
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_org_plate_idx on public.vehicles(organization_id, plate_normalized) where plate_normalized is not null;
create index vehicles_customer_idx on public.vehicles(customer_id);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  base_price_centavos bigint not null default 0 check (base_price_centavos >= 0),
  currency text not null default 'PHP' check (char_length(currency)=3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.appointment_status not null default 'requested',
  source text not null default 'internal' check (source in ('internal','public_booking','walk_in')),
  starts_at timestamptz,
  expected_duration_minutes int check (expected_duration_minutes is null or expected_duration_minutes > 0),
  customer_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_branch_time_idx on public.appointments(branch_id, starts_at);

create table public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  primary key (appointment_id, service_id)
);

create table public.job_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  job_number bigint,
  status public.job_status not null default 'draft',
  customer_concern text,
  internal_note text,
  odometer_in_km int check (odometer_in_km is null or odometer_in_km >= 0),
  odometer_out_km int check (odometer_out_km is null or odometer_out_km >= 0),
  promised_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);
create index job_orders_branch_status_idx on public.job_orders(branch_id, status, created_at desc);

create table public.job_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_order_id uuid not null references public.job_orders(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price_centavos bigint not null check (unit_price_centavos >= 0),
  discount_centavos bigint not null default 0 check (discount_centavos >= 0),
  line_total_centavos bigint not null check (line_total_centavos >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  job_order_id uuid references public.job_orders(id) on delete restrict,
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (char_length(currency)=3),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  reference text,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  sku text,
  name text not null,
  unit text not null default 'unit',
  cost_centavos bigint check (cost_centavos is null or cost_centavos >= 0),
  sell_price_centavos bigint check (sell_price_centavos is null or sell_price_centavos >= 0),
  reorder_level numeric(14,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('stock_in','consume','adjustment','return','transfer_in','transfer_out')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reference_type text,
  reference_id uuid,
  idempotency_key text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_created_idx on public.audit_events(organization_id, created_at desc);
