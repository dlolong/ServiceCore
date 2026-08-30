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

`tests/estimate-approval.test.ts` covers token shape/hash-only persistence, the named expiry policy, and public DTO field stripping. `supabase/tests/customer_digital_estimate_approval.sql` covers creation, one-active-link replacement, anonymous allowlisting, no broad table access, invalid/expired/revoked/superseded states, approve/decline, idempotent retries, first-decision-wins behavior, revision invalidation, audit privacy, branch restriction, and cross-tenant denial.
