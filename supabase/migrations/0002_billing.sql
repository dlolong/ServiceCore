create table public.plans (
  id text primary key,
  name text not null,
  monthly_price_centavos bigint not null default 0 check (monthly_price_centavos >= 0),
  yearly_price_centavos bigint check (yearly_price_centavos is null or yearly_price_centavos >= 0),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_id text not null references public.plans(id),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'free' check (status in ('free','trialing','active','past_due','cancelled','paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

insert into public.plans(id,name,monthly_price_centavos,yearly_price_centavos,limits,features,sort_order) values
('free','Free',0,0,'{"branches":1,"staff":2,"monthly_jobs":30}'::jsonb,'{"public_page":false,"reminders":false,"advanced_reports":false}'::jsonb,0),
('starter','Starter',49900,499000,'{"branches":1,"staff":5,"monthly_jobs":250}'::jsonb,'{"public_page":true,"reminders":false,"advanced_reports":false}'::jsonb,10),
('business','Business',99900,999000,'{"branches":2,"staff":15,"monthly_jobs":1000}'::jsonb,'{"public_page":true,"reminders":true,"advanced_reports":true}'::jsonb,20),
('pro','Pro',199900,1999000,'{"branches":5,"staff":50,"monthly_jobs":5000}'::jsonb,'{"public_page":true,"reminders":true,"advanced_reports":true,"ai":true}'::jsonb,30)
on conflict (id) do nothing;
