# Database

PostgreSQL/Supabase is the source of truth. Applied migrations are immutable; every schema or policy change is a new numbered migration.

Conventions:

- UUID primary and explicit foreign keys;
- `snake_case` tables/columns and `camelCase` TypeScript;
- UTC timestamps, rendered in the branch timezone (`Asia/Manila` default);
- currency stored explicitly and PHP amounts stored as `bigint` centavos;
- direct `organization_id` on frequently queried business tables;
- `branch_id` on operational/location records;
- relational columns for searchable business data and bounded JSONB only for flexible metadata/provider snapshots;
- indexes justified by real tenant/branch/status/time query paths.

All business tables use RLS. Security-definer functions pin `search_path`, derive the caller from `auth.uid()`, and verify organization/branch ownership. Public views/RPCs expose allowlisted fields only. Billing webhooks use idempotency keys and isolated server-only credentials.

Migration `0035_service_advisor_workflow.sql` adds estimate authorization method/total snapshots and optional branch-inventory links on estimate lines. Its RPCs recalculate estimate totals, invalidate changed approvals, validate branch inventory, and enforce work/release readiness. It does not reserve stock or duplicate invoice balances.

Migration `0036_customer_digital_estimate_approval.sql` adds hashed, expiring, single-use estimate approval links and the `digital_link` authorization method. Anonymous roles receive execute access only to an allowlisted read RPC and a transactional decision RPC; inherited table and staff-RPC grants are explicitly revoked. Estimate revision invalidation, link consumption, authorization, Job Order advancement, and audit metadata remain transaction-safe.

The current schema includes cross-parent integrity triggers and RLS phase suites. Do not rename existing tables for module cosmetics. Migration `0029_appointment_vehicle_decoupling.sql` makes `appointments.vehicle_id` nullable while preserving its foreign key, existing values, organization/customer integrity, and RLS. Appointment search uses an optional vehicle join; automotive queue and job conversion remain vehicle-required.
# Scheduling assignments

`organization_memberships.id` is the canonical scheduling staff identifier. `membership_branch_assignments` remains the single branch-eligibility source. `scheduling_resources` defines generic branch-owned resources with `capacity >= 1` and deactivation for history preservation. `appointment_staff_assignments` and `appointment_resource_assignments` are explicit, tenant-scoped relationships with uniqueness constraints.

`save_appointment_with_assignments` validates tenant and branch relationships, serializes branch scheduling writes with an advisory transaction lock, checks staff/resource occupancy, and atomically replaces services and assignments. Direct assignment-table writes are not granted to authenticated clients.
