# NegOSu

**NegOSu** is a Philippines-first, multi-tenant operating platform for service businesses. The current products are **NegOSu Automotive** and **NegOSu Salon & Beauty**. ServiceCore and KarKR remain internal/legacy engineering names where changing them would create needless migration risk.

Positioning: **The Operating System for Your Negosyo.**

## Current scope
This repository includes:
- Next.js App Router + TypeScript + Tailwind;
- Supabase browser/server client setup;
- a responsive product shell with Automotive and Salon operational workflows;
- PostgreSQL/Supabase schema for organizations, branches, customers, vehicles, services, appointments, job orders, payments, inventory, subscriptions, and audit events;
- RLS helper functions and baseline policies;
- Codex-specific `AGENTS.md`;
- a long-form implementation roadmap with copy/paste phase prompts.

Authentication, onboarding, CRM, operations, finance, inventory, retention reminders, staff RBAC, and public shop booking are connected to Supabase.

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
npm ci
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
8. `0008_phase01_onboarding_state.sql` — business metadata, primary branches, and secure two-step owner onboarding RPCs.
9. `0009_phase02_crm.sql` — CRM fields, normalization, search view, branch operations, indexes, and audit triggers.
10. `0010_fix_crm_audit_trigger.sql` — table-safe audit trigger field handling.
11. `0011_phase03_04_services_appointments_queue.sql` — service pricing and availability, appointment snapshots and transitions, and an atomic branch queue.
12. `0012_phase03_04_security_audit.sql` — authorized price resolution, RPC-only queue writes, required service durations, and operations audit events.
13. `0013_phase03_04_completion.sql` — tenant-safe appointment/queue search projections and add-on compatibility enforcement.
14. `0014_phase05_06_jobs_finance.sql` — job execution, private inspections/photos, estimates, invoices, receipts, and trusted payment accounting.
15. `0015_phase05_06_completion.sql` — typed workflow transitions, proposed-work approval, and payment/invoice reversals.
16. `0016_phase05_06_security_hardening.sql` — assigned-technician policies and cross-tenant finance guards.
17. `0017_phase05_technician_assignments.sql` — timestamped primary and per-service technician assignment.
18. `0018_phase07_08_inventory_retention.sql` — append-only inventory, atomic transfers, service consumption, derived history, consent, and reminder queue.
19. `0019_phase07_08_validation_fixes.sql` — legacy movement compatibility and null-safe tenant guards.
20. `0020_phase09_staff_rbac.sql` — permission matrix, secure invitations, branch assignments, deactivation, restrictive RLS, and staff audit events.
21. `0021_phase09_staff_directory.sql` — owner-authorized staff directory RPC.
22. `0022_phase09_crypto_search_path.sql` — fixed trusted pgcrypto resolution for invitation hashing.
23. `0023_phase09_branch_integrity.sql` — privileged-path tenant guards for staff and invitation branch assignments.
24. `0024_phase10_public_booking.sql` — curated storefront data, safe availability, isolated booking requests, spam controls, and internal review.
25. `0025_phase10_review_fix.sql` — unambiguous trusted booking-to-appointment conversion.
26. `0026_phase11_reporting.sql` — permission-protected, timezone-aware owner reporting and reconciled operational analytics.
27. `0027_phase11_anon_grant_hardening.sql` — explicit RPC-only anonymous access across Supabase local image versions.
28. `0028_phase11_revenue_phase12_billing.sql` — reconciled invoice-line revenue, plans, subscriptions, entitlements, limits, and trusted billing synchronization.

For disposable local validation, start Docker and run:

```bash
supabase start
supabase db reset
supabase db lint --level warning
supabase test db
```

Browser regression checks use Playwright. Install its Chromium build where supported, then run `npm run test:e2e`. On systems where Playwright does not provide a bundled browser, set `PLAYWRIGHT_CHROME_PATH` to a compatible local Chrome executable. Set `E2E_BASE_URL` to reuse an already-running NegOSu development server.

Deterministic authenticated QA uses two bounded non-production owner personas and fixtures. Run the guarded persona command and release smoke suite as documented in [`docs/PILOT_QA.md`](docs/PILOT_QA.md). The command defaults to dry-run and production execution is rejected.

Local authentication email is captured by Mailpit at `http://127.0.0.1:54324`; production SMTP is intentionally not configured in this repository.

The public Supabase URL and publishable key are safe for browser use because authorization remains enforced by RLS. All unprefixed provider credentials are parsed only from server-only modules.

Do not place the service-role key in any `NEXT_PUBLIC_*` variable.

### Authentication configuration

In Supabase Auth URL Configuration, set the Site URL to `NEXT_PUBLIC_APP_URL` and allow these redirect URLs for each environment:

- `<NEXT_PUBLIC_APP_URL>/auth/callback`
- `<NEXT_PUBLIC_APP_URL>/auth/confirm`

Keep email confirmation enabled for production. The default callback supports Supabase PKCE `code` links; `/auth/confirm` also supports token-hash email templates. Apply all migrations before registering the first user so the profile trigger and onboarding RPC are available.

Canonical account routes are `/signup`, `/login`, `/forgot-password`, and `/reset-password`. The older `/sign-up`, `/sign-in`, and `/update-password` paths remain redirects for backward compatibility. New owners resume from database-backed state at `/onboarding/business` or `/onboarding/branch`; no browser flag determines tenant access.

## Codex workflow
Read `docs/PRODUCT_SPEC.md`, then start with `docs/CODEX_MASTER_PROMPT.md` and execute phases in `docs/CODEX_PHASES.md` one at a time.

A good first Codex command is:

```text
Read AGENTS.md, README.md, docs/ARCHITECTURE.md, docs/CODEX_MASTER_PROMPT.md and Phase 01 in docs/CODEX_PHASES.md. Inspect the repository, implement Phase 01 completely, run all required checks, and stop after reporting the results. Do not begin Phase 02.
```

## Deployment

The repository is cloud-neutral; no Render- or Vercel-specific manifest is authoritative. Deploy the Node 24 Next.js server to a compatible host and Supabase to a separately managed project. Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md). Do not auto-run seeds, resets, backfills, or destructive migration rollback during startup.

## Important
This starter is an engineering foundation, not a finished production system. Payment, privacy, tax, invoice compliance, consent, retention, backups, and security controls must be reviewed before launch.
