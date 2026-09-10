# NegOSu Release Checklist

Record the release commit, operator, environment, and completion time beside this checklist. A checked item represents observed evidence, not an assumption.

## Before migration

- [ ] Release commit/version recorded.
- [ ] Node 24 is active and `npm ci` completed from the lockfile.
- [ ] Production environment is configured and `npm run release:env -- --production` passes.
- [ ] No test-only QA or E2E variables are configured on production.
- [ ] No development seed, database reset, or backfill runs during build/start.
- [ ] Production database backup is current and restorable.
- [ ] Pending append-only migrations were reviewed in order.
- [ ] Migration history matches the linked Supabase project.
- [ ] External Auth URLs and allowed redirects match `NEXT_PUBLIC_APP_URL`.

## Build and deployment

- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Reviewed migrations apply successfully before the new application starts receiving traffic.
- [ ] Deployment uses `npm run start` on Node 24.
- [ ] Previous compatible application artifact is available for rollback.

## Smoke and security

- [ ] `GET /health` returns HTTP 200 and `status: ok` without sensitive fields.
- [ ] Public Landing, Automotive, Salon, Plans, Login, Signup, and Forgot Password pages pass.
- [ ] Automotive owner login, Dashboard, Appointments, Customers, Vehicles, Job Orders, Inventory, Payments, Staff, Billing, and navigation pass.
- [ ] Salon owner login, Dashboard, daily Appointment calendar, Clients, Treatments, Staff, Inventory, Billing, and navigation pass.
- [ ] Mobile Automotive and Salon critical paths pass at 320–430px.
- [ ] Cross-tenant RLS and branch restrictions pass on a disposable/test database.
- [ ] Industry route gating blocks Automotive-only routes for Salon.
- [ ] Public-token estimate/appointment links remain narrow and token-protected.
- [ ] Billing permissions and public pricing/catalog consistency pass.

## External operations

- [ ] Supabase backup/restore ownership and alerts are confirmed.
- [ ] Stripe webhook/reconciliation secrets and endpoints are confirmed if Stripe is enabled.
- [ ] Notification scheduler secret and invocation schedule are confirmed if notifications are enabled.
- [ ] Production Email/SMS is either backed by a verified delivery adapter or explicitly declared unavailable; console delivery is not configured.
- [ ] Application/server error monitoring ownership is confirmed.
- [ ] Pilot support contact and incident escalation path are recorded.

## Decision

- [ ] No unresolved BLOCKER or HIGH QA findings remain.
- [ ] Release limitations are documented for the pilot operator.
- [ ] PM records the release decision and authorized pilot vertical(s).
