# Testing

`tests/salon-operations.test.ts` covers the named Salon lifecycle, token/hash contract, neutral payment summary, reminder wording, and dependency direction. The Salon pgTAP suite covers job-function/role separation, Automotive-negative completion, public DTO/table denial, confirmation/reschedule, Appointment overpayment/reversal, and tenant boundaries.

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

Salon architecture coverage lives in `tests/salon-boundary.test.ts`, the expanded platform-foundation tests, and `supabase/tests/salon_vertical_foundation.sql`. It verifies fail-closed configuration, immutable tenant industry, direct public-action gating, industry navigation isolation, no static Salon-facing Automotive runtime imports, no Core-to-Salon dependency, no-vehicle Core appointment persistence, audited standalone appointment completion, Vehicle denial inside a Salon tenant, and cross-tenant Client/Appointment isolation.

Automotive Work Execution coverage includes the TypeScript status policy and service boundary plus `phase05_06_jobs_finance_rls.sql`. The database suite verifies atomic/idempotent queue conversion, authoritative item totals, assignment restrictions, job transitions, inspection ownership, finance boundaries, and cross-tenant denial.

`tests/work-tracking.test.ts` covers timestamp-derived elapsed time, summed technician labor effort, bounded action validation, and persistence delegation without browser-submitted duration. `supabase/tests/automotive_technician_work_sessions.sql` covers readiness-checked Start, actor-resolved technician identity, same-job idempotency, cross-job double-Start denial, assignment spoofing denial, pause/resume segmentation, Stop, completion blocking, cancellation cleanup, inactive technician history, assignment audit, direct-write denial, and tenant isolation. The partial unique index is the database concurrency boundary; validation should additionally race two local Start calls for the same technician and confirm one active row.

Core Availability unit tests cover end-exclusive overlap, containment, exact overlap, derived service duration, branch closure, service unavailability, appointment self-exclusion, industry-neutral input, and invalid timestamps. The appointment pgTAP suite verifies authoritative overlap denial, authorized override persistence, and adjacent intervals at the SQL boundary.
# Scheduling assignment coverage

`tests/availability.test.ts` covers staff conflicts, branch eligibility, resource capacity, adjacent intervals, and edit self-exclusion. `supabase/tests/scheduling_assignments.sql` covers schema constraints, valid persistence, cross-tenant and cross-branch denial, inactive resources, serialized conflict rejection, RLS visibility, and RPC-only assignment mutation.

`tests/work-execution.test.ts` locks the unchecked conversion default and explicit copy intent. `supabase/tests/automotive_scheduled_staff_transfer.sql` verifies no-copy conversion, explicit copy, inactive and cross-tenant denial, atomic failure, and idempotent retry behavior.

`tests/salon-operations.test.ts` and `supabase/tests/salon_vertical_foundation.sql` cover Salon lifecycle isolation, direct Automotive status-mutation denial, customer confirmation/reschedule, assigned-Staff allowlisting, reminder A→B→A/link-replacement identity, unchanged-save deduplication, normalized Staff/Treatment reminder refresh, idempotent Appointment payments, and invoice-less payment reversal. The existing Automotive finance pgTAP suite remains the regression boundary for invoice and Job Order payment behavior.

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

# Command Center coverage

`tests/command-center.test.ts` covers owner/manager scope, inaccessible branches, complete All Branches results, safe integer normalization, priority/age ordering, derived attention totals, Automotive and Salon action resolution, terminology, deep links, and the Core-to-vertical dependency boundary. `supabase/tests/command_center.sql` verifies paid revenue, branch-local Manila/New York date windows, invoice plus standalone Appointment outstanding balances, existing low-stock semantics, owner/restricted-manager role behavior, cross-tenant denial, and invalid branch scopes.

Run the SQL suite only on the local/disposable database after migration 0054. Dashboard browser validation should cover 320×800, 375×812, 390×844, 430×932, 1366×768, 1440×900, and 1920×1080, including no horizontal overflow, branch switching, direct links, staff financial isolation, empty/error states, and unique semantic DOM IDs.

# Optional Staff identity coverage

`tests/schema-compatibility.test.ts` covers rolling-schema detection for Command Center, Automotive work, Staff directories, and Appointment Staff assignments. Compatibility must activate only for exact missing-capability errors; authorization and unrelated database failures must remain visible. `tests/command-center.test.ts` also protects exact centavo aggregation in the pre-0054 metrics fallback.

`tests/staff-profile.test.ts` covers optional/normalized contacts, explicit login invitation input, shared notification eligibility, and Core dependency direction. `supabase/tests/staff_profile_login_decoupling.sql` covers both/mobile-only/email-only/neither persistence, stable linked IDs, independent operational/access branches, pending and accepted invitation linkage, Salon appointment assignment, Automotive Job/item/work-session assignment without login, tenant denial, and strict table/contact-column privileges. No Staff notification producer is introduced in this phase; the eligibility helper reuses the existing shared channel rules for future producers.

# Product experience coverage

`tests/product-experience.test.ts` protects the approved NegOSu landing message and calls to action, restrained public visual treatment, single-scroll auth/onboarding shell, compact Command Center hierarchy, visible non-color status labels, responsive Appointments and Services layouts, visible Inventory labels, stable CRM/public-booking IDs, and the neutral not-found experience. Run it with the shared design-system regressions:

```bash
node --import tsx --test tests/product-experience.test.ts tests/design-system.test.ts
```

Browser QA should inspect 320×800, 375×812, 390×844, 430×932, 640×960, 768×1024, 1024×768, 1366×768, 1440×900, and 1920×1080. Verify one primary page scroll, no clipped dialogs or horizontal overflow, usable keyboard focus, readable labels, table-to-card transitions, primary-action hierarchy, and unique semantic IDs on both Automotive and Salon organizations. Public checks must include the homepage, vertical landings, authentication/onboarding, shop page, booking request/status, invitation acceptance, and the neutral 404 surface.

`tests/click-first-product-pages.test.ts` protects Reports section tabs/filter continuity, mobile daily records, Booking Request decision reachability, and Billing plan disclosure. `tests/design-system.test.ts` protects the compact five-group desktop hierarchy, subtle active state, four-item mobile navigation, grouped More popup, and sole main-content page scroll. Authenticated visual QA should additionally confirm that the common desktop menu fits at 1366×768 and that More, dialogs, and tabs remain keyboard reachable.
