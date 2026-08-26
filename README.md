# KarKR

**KarKR** is a multi-tenant SaaS starter for car wash, detailing, auto-care, maintenance, and automotive service businesses.

Tagline: **Your Car. Our Care.**

## Starter scope
This repository includes:
- Next.js App Router + TypeScript + Tailwind;
- Supabase browser/server client setup;
- a responsive product shell and demo dashboard;
- PostgreSQL/Supabase schema for organizations, branches, customers, vehicles, services, appointments, job orders, payments, inventory, subscriptions, and audit events;
- RLS helper functions and baseline policies;
- Codex-specific `AGENTS.md`;
- a long-form implementation roadmap with copy/paste phase prompts.

The UI intentionally starts with demo data. Phase 1 connects authentication/onboarding to Supabase; later phases replace demo modules with production CRUD.

## Tech baseline
- Node 24 LTS
- Next.js 16.3.3
- React 19.2.8
- TypeScript 6.0.3 (latest release supported by the current Next.js ESLint toolchain)
- Tailwind CSS 4
- Supabase JS + SSR

## Quick start
```bash
nvm use
cp .env.example .env.local
npm install
npm run dev
```
Open `http://localhost:3000`.

## Supabase
1. Create a Supabase project or start local Supabase.
2. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Apply migrations in `supabase/migrations/` in ascending filename order. Never edit a migration that has already been applied; append the next zero-padded migration instead.
4. Use `supabase/seed.sql` for local/demo development only.

Current migration order:

1. `0001_core.sql` — tenant and operational schema;
2. `0002_billing.sql` — plans, subscriptions, and webhook ledger;
3. `0003_functions_rls.sql` — membership helpers, grants, and baseline RLS;
4. `0004_integrity.sql` — timestamps and initial tenant guards;
5. `0005_tenant_integrity.sql` — cross-table tenant consistency guards.
6. `0006_auth_onboarding.sql` — user profile bootstrap and atomic first-shop onboarding.
7. `0007_phase00_5_integrity.sql` — job-item/service and inventory-item/branch tenant guards.

For disposable local validation, start Docker and run:

```bash
supabase start
supabase db reset
supabase db lint --level warning
supabase test db
```

Local authentication email is captured by Mailpit at `http://127.0.0.1:54324`; production SMTP is intentionally not configured in this repository.

The public Supabase URL and publishable key are safe for browser use because authorization remains enforced by RLS. All unprefixed provider credentials are parsed only from server-only modules.

Do not place the service-role key in any `NEXT_PUBLIC_*` variable.

### Authentication configuration

In Supabase Auth URL Configuration, set the Site URL to `NEXT_PUBLIC_APP_URL` and allow these redirect URLs for each environment:

- `<NEXT_PUBLIC_APP_URL>/auth/callback`
- `<NEXT_PUBLIC_APP_URL>/auth/confirm`

Keep email confirmation enabled for production. The default callback supports Supabase PKCE `code` links; `/auth/confirm` also supports token-hash email templates. Apply all migrations before registering the first user so the profile trigger and onboarding RPC are available.

## Codex workflow
Read `docs/PRODUCT_SPEC.md`, then start with `docs/CODEX_MASTER_PROMPT.md` and execute phases in `docs/CODEX_PHASES.md` one at a time.

A good first Codex command is:

```text
Read AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/CODEX_MASTER_PROMPT.md and Phase 01 in docs/CODEX_PHASES.md. Inspect the repository, implement Phase 01 completely, run all required checks, and stop after reporting the results. Do not begin Phase 02.
```

## Suggested deployment
The app is cloud-neutral. A typical setup is:
- Next.js: Vercel or Render
- Postgres/Auth/Storage: Supabase
- Billing: Stripe initially, with a provider abstraction for Philippine payment options later
- Email: provider abstraction (e.g. Resend)
- SMS: provider abstraction

## Important
This starter is an engineering foundation, not a finished production system. Payment, privacy, tax, invoice compliance, consent, retention, backups, and security controls must be reviewed before launch.
