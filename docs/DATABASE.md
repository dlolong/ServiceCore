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

Migration `0040_parts_reservation_consumption.sql` adds `inventory_reservations` and an idempotent operation ledger without adding a physical-stock column. `inventory_availability` derives available stock from the existing movement-derived on-hand balance minus active reservation remainder. Core reserve/consume/release functions serialize on the inventory item row. Authenticated KarKR callers use narrower Job Order RPCs which revalidate tenant, branch, role, current estimate authorization, requirement identity, and Job Order state. Direct table mutations and direct execution of generic mutation functions remain revoked.

Consumed reservation quantities create negative `inventory_movements`; release creates no movement. `vehicle_service_record_parts` snapshots only positive actual consumption after the durable service record exists. A reservation-aware completion path auto-consumes outstanding service-recipe requirements for backward compatibility, releases unused allocation, and never double-consumes an idempotent operation.

Migration `0037_idempotent_notification_outbox.sql` adds the shared notification outbox, protected encrypted delivery-secret storage, deterministic delivery keys, bounded service-role claim/result RPCs, stale-lease recovery, manual retry, and safe advisor status projection. The Automotive approval-link RPC is extended so the link plus Email/SMS intent commit atomically. Outbox/secret tables have RLS enabled and no browser table grants; authorized staff use narrow status/retry RPCs, while worker operations require the service role.

The current schema includes cross-parent integrity triggers and RLS phase suites. Do not rename existing tables for module cosmetics. Migration `0029_appointment_vehicle_decoupling.sql` makes `appointments.vehicle_id` nullable while preserving its foreign key, existing values, organization/customer integrity, and RLS. Appointment search uses an optional vehicle join; automotive queue and job conversion remain vehicle-required.
# Scheduling assignments

`organization_memberships.id` is the canonical scheduling staff identifier. `membership_branch_assignments` remains the single branch-eligibility source. `scheduling_resources` defines generic branch-owned resources with `capacity >= 1` and deactivation for history preservation. `appointment_staff_assignments` and `appointment_resource_assignments` are explicit, tenant-scoped relationships with uniqueness constraints.

`save_appointment_with_assignments` validates tenant and branch relationships, serializes branch scheduling writes with an advisory transaction lock, checks staff/resource occupancy, and atomically replaces services and assignments. Direct assignment-table writes are not granted to authenticated clients.
## Automotive service history

`vehicle_service_records` and `vehicle_service_record_items` are immutable, organization-scoped completion snapshots. Authenticated clients receive branch-aware SELECT access only; creation is owned by the completed-Job-Order trigger. `vehicle_maintenance_due` stores interval snapshots and enforces one active row per organization/vehicle/service. Its safe directory view derives due status from the stored date threshold and the vehicle's current recorded odometer.

Migration `0038_vehicle_service_history_maintenance.sql` exposes a bounded service-role-only `backfill_vehicle_service_records(limit)` utility. It is intentionally not executed by the migration or application startup.

Migration `0039_maintenance_rebooking_snooze_backfill.sql` adds the Automotive maintenance-to-appointment foreign key (`ON DELETE SET NULL`), snooze actor/time/reason fields, source/backfill trace fields, and a notification activation flag. The partial appointment index supports directory/scheduler linkage reads; the existing unique active organization/vehicle/service index remains authoritative.

`save_maintenance_appointment` locks the due row and atomically delegates appointment persistence to `save_appointment_with_assignments`, links the result, cancels stale reminder work, and audits the relationship. Browser roles retain SELECT-only access to maintenance due rows; mutation uses tenant- and branch-checked RPCs. The service-role backfill planner is read-only. Explicit apply processes no more than 100 records per batch, uses per-record subtransactions, and leaves legacy projections notification-disabled. Migration 0039 removes the service-role grant from the older global write-only `backfill_vehicle_service_records(limit)` utility; operations must use the scoped planner/apply boundary.
