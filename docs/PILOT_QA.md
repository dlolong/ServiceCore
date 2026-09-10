# Pilot QA

This runbook creates deterministic Automotive and Salon owner logins for local or explicitly approved remote-development testing. The tool never runs automatically and must not target production.

## Local prerequisites

1. Use Node 24 and copy `.env.example` to `.env.local`.
2. Start local Supabase and apply migrations through at least `0053`. Use the complete current migration set for canonical launch verification. A disposable `supabase db reset` also applies `supabase/seed.sql`; never use reset against production or a shared development database.
3. Ensure `.env.local` points to the local Supabase URL and contains its local service-role key.

The QA persona tool creates or updates its own bounded Automotive and Salon organizations, branches, services/treatments, Customer/Client fixtures, sample inventory, and owner logins. If the broader `supabase/seed.sql` fixture already exists, stable IDs keep the operation idempotent.

## Guarded persona seed

Preview the operation first. Dry-run is the default and makes no Auth or database writes:

```bash
npm run qa:seed
# equivalent: npm run qa:seed -- --dry-run
```

Apply only to the confirmed local/disposable Supabase project:

```bash
npm run qa:seed -- --apply
```

The operation is idempotent: re-running updates the same two accounts and memberships instead of creating duplicates. If a remote QA email changes, the bounded QA membership is reassigned to the new user (or an existing membership is activated and the stale deterministic slot is deactivated). It never changes a membership outside the two fixed QA organizations. A newly created Auth user is removed automatically if its profile or membership setup fails, preventing a login-only partial persona.

Local fixture credentials are deliberately public and valid only for local QA:

```text
Automotive Owner: qa.automotive.owner@negosu.local.test
Salon Owner:      qa.salon.owner@negosu.local.test
Password:         NegOSu-Local-QA-2026!
```

Never reuse that password or those accounts outside local test infrastructure.

## Remote development target

Remote seeding is blocked by default. A dedicated non-production Supabase project requires all of:

```text
QA_SEED_TARGET=development
QA_SEED_ALLOW_REMOTE_DEVELOPMENT=true
QA_SEED_CONFIRM=NEGOSU_NON_PRODUCTION_QA_ONLY
QA_AUTOMOTIVE_OWNER_EMAIL=<test-only address>
QA_SALON_OWNER_EMAIL=<test-only address>
QA_OWNER_PASSWORD=<test-only strong password>
```

`NODE_ENV=production`, `VERCEL_ENV=production`, or `QA_SEED_TARGET=production` always blocks the tool. Do not place QA credentials in any `NEXT_PUBLIC_*` variable.

## Authenticated release smoke

Start or identify the test application, then run:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 \
E2E_AUTHENTICATED=1 \
npm run test:e2e:release
```

Local runs use the local fixture credentials above. A remote development environment also needs `QA_AUTOMOTIVE_OWNER_EMAIL`, `QA_SALON_OWNER_EMAIL`, and `QA_OWNER_PASSWORD`. Without `E2E_AUTHENTICATED=1`, the public smoke runs and authenticated suites are reported as skipped rather than silently pretending to pass.

The suite covers:

- Landing, Automotive, Salon, Plans, Login, Signup, Forgot Password, and `/health`.
- Automotive Dashboard, Appointments, Customers, Vehicles, Job Orders, Inventory, Payments, Staff, and Billing.
- Salon Dashboard, daily Appointment calendar, Clients, Treatments, Staff, Inventory, and Billing.
- Both configured desktop and mobile Playwright projects.
- Explicit mobile projects at 320, 375, 390, and 430px.

Without `E2E_BASE_URL`, Playwright starts a dedicated server on port 3100 and refuses to reuse an existing listener. When an operator explicitly supplies `E2E_BASE_URL`, the suite verifies the NegOSu health service identity and stable page roots so an unrelated application cannot silently pass.

Salon payment recording remains inside the supported Appointment detail flow; the Automotive invoice-backed Payments directory is intentionally industry-gated.

## Manual golden paths

Automotive:

1. Sign in and confirm Automotive navigation only.
2. Create or open a Customer and Vehicle.
3. Create an Appointment, move it through Queue, and open the Job Order.
4. Review inspection, estimate, parts readiness, work status, payment, and release gates without sending real notifications or charging a real card.

Salon:

1. Sign in and confirm Client/Treatment/Station terminology with no Automotive navigation.
2. Create or open a Client and Appointment.
3. Review the day/week calendar, Staff assignment, Treatment, resource, status, and Appointment payment flow.

Repeat critical pages at 320, 375, 390, and 430px. Confirm one primary page scroll, usable dialogs, visible action labels, keyboard focus, controlled empty/error states, and no horizontal page overflow.

Record evidence and findings; do not declare a release PASS solely from the automated smoke suite.
