# Testing

The practical validation ladder is:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Pure TypeScript unit tests cover validation, money helpers, transitions, permissions, reporting, and platform configuration. `supabase/tests` contains SQL/RLS suites for cross-tenant denial, role restrictions, branch access, public/private boundaries, billing, and business workflows. Playwright covers important UI paths.

Database tests run only against the local disposable Supabase stack. Never reset or seed production. Seed fixtures must include at least two fake organizations so positive access and negative cross-tenant cases are both exercised.

A passing compile is not sufficient. High-risk changes need both an allowed-path assertion and denial assertions. Record commands actually run, warnings, environment blockers, and skipped suites in the final report.

Automotive Work Execution coverage includes the TypeScript status policy and service boundary plus `phase05_06_jobs_finance_rls.sql`. The database suite verifies atomic/idempotent queue conversion, authoritative item totals, assignment restrictions, job transitions, inspection ownership, finance boundaries, and cross-tenant denial.

Core Availability unit tests cover end-exclusive overlap, containment, exact overlap, derived service duration, branch closure, service unavailability, appointment self-exclusion, industry-neutral input, and invalid timestamps. The appointment pgTAP suite verifies authoritative overlap denial, authorized override persistence, and adjacent intervals at the SQL boundary.
# Scheduling assignment coverage

`tests/availability.test.ts` covers staff conflicts, branch eligibility, resource capacity, adjacent intervals, and edit self-exclusion. `supabase/tests/scheduling_assignments.sql` covers schema constraints, valid persistence, cross-tenant and cross-branch denial, inactive resources, serialized conflict rejection, RLS visibility, and RPC-only assignment mutation.

`tests/work-execution.test.ts` locks the unchecked conversion default and explicit copy intent. `supabase/tests/automotive_scheduled_staff_transfer.sql` verifies no-copy conversion, explicit copy, inactive and cross-tenant denial, atomic failure, and idempotent retry behavior.

# Service Advisor coverage

`tests/service-advisor.test.ts` covers integer estimate totals, parts states, independent work blockers, payment status filtering, release readiness, and recommended actions. `supabase/tests/service_advisor_workflow.sql` exercises authorization snapshots/invalidation/audit, wrong-branch stock, shortage-blocked work, partial/final payment, paid release, branch restriction, and cross-tenant denial. The existing `phase05_06_jobs_finance_rls.sql` remains the compatibility suite and now saves its inspection before work starts.

# Digital estimate approval coverage

`tests/estimate-approval.test.ts` covers token shape, hash-only public validation, encrypted delivery-secret handling, the named expiry policy, and public DTO field stripping. `supabase/tests/customer_digital_estimate_approval.sql` covers creation, one-active-link replacement, anonymous allowlisting, no broad table access, invalid/expired/revoked/superseded states, approve/decline, idempotent retries, first-decision-wins behavior, revision invalidation, audit privacy, branch restriction, and cross-tenant denial.

# Notification outbox coverage

`tests/notifications.test.ts` covers email and Philippine-mobile normalization, current opt-out enforcement, AES-GCM delivery-secret protection, Automotive template injection, deterministic provider idempotency keys, accepted sends, retry/permanent failure, maximum-attempt behavior, production-safe provider selection, and cron bearer authentication. Providers are injected mocks; unit tests never contact a real delivery service.

`supabase/tests/notification_outbox.sql` covers transactional multi-channel enqueue, payload/token privacy, strict table grants, normalized destination snapshots, atomic claims, concurrent-claim denial, provider attempt accounting, future retry, stale-lease recovery, idempotent near-expiry reminders, approval cancellation, secret destruction, explicit opt-out, authorized manual retry, browser worker denial, and cross-tenant status denial.

# Vehicle maintenance coverage

Vehicle maintenance validation covers completion idempotency, approved-item-only snapshots, monotonic odometer behavior, one active projection per vehicle/service, interval snapshots, cross-tenant and branch denial, dismissal authorization, stage/channel notification deduplication, consent-ineligible rows, and cancellation after satisfaction. Database tests run only against a local or disposable Supabase database; the bounded historical backfill is never invoked by a migration.

`tests/maintenance-lifecycle.test.ts` covers established active appointment statuses, suppression precedence, snooze expiry, sent-stage preservation, legacy notification pausing, dry-run repository isolation, and the production apply guard. Scheduling unit tests verify that `maintenanceDueId` remains Automotive-only and an existing active link bypasses duplicate persistence.

`supabase/tests/maintenance_rebooking_backfill.sql` covers atomic create/link, duplicate-create idempotency, reschedule preservation, active appointment suppression, cancellation recovery, snooze/resume/audit, matching versus unrelated completed services, stage/channel deduplication, cross-tenant direct-mutation denial, zero-write dry-run planning, warning codes, explicit apply, no-notification backfill, and apply rerun idempotency. Run only after a fresh local migration apply.

`tests/parts-reservation.test.ts` covers the Core external-reference contract, Automotive adapter composition, reserve/consume/release delegation, and numeric precision validation. `supabase/tests/parts_reservation_consumption.sql` covers derived availability, full and partial allocation, insufficient-stock protection, idempotent retries and conflict detection, start gating, partial/over consumption, release semantics, cancellation and estimate-revision cleanup, actual-parts history, direct-write denial, tenant isolation, branch restrictions, and balance-helper disclosure protection. Concurrency safety is enforced by the inventory-item row lock; validation should also issue simultaneous final-unit reservation calls against a disposable database.
