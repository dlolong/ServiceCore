# ServiceCore Architecture

## Launch runtime boundary

NegOSu remains a cloud-neutral Next.js application backed by Supabase. Production startup validates the required public URL and Supabase configuration before serving traffic; optional billing and notification providers must be configured as complete sets. `/health` is intentionally a liveness-only endpoint and discloses no database or environment details. Deployment, migration ordering, rollback, and pilot smoke procedures live in `DEPLOYMENT.md`, `RELEASE_CHECKLIST.md`, and `PILOT_QA.md`.

The public Plans page and authenticated Billing UI share `modules/platform/plan-catalog.ts` as their presentation contract. Database subscription rows remain authoritative for subscription state and entitlements, and Billing fails closed when its active database catalog drifts from the published prices.

## Product entry and organization context

NegOSu is the commercial product brand. `/` presents the master NegOSu experience, `/automotive` presents NegOSu Automotive, and `/salon` presents NegOSu Salon & Beauty. All three compose shared marketing primitives and lead into one Supabase authentication implementation. ServiceCore remains the internal shared-platform and repository architecture name.

```text
                       NegOSu
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
     Master          Automotive      Salon & Beauty
       `/`         `/automotive`        `/salon`
        └────────────────┬────────────────┘
                         ↓
              Shared Auth + ServiceCore
                         ↓
             Organization Industry Config
```

After login, one active membership continues to its branch recovery or dashboard. Multiple memberships require an explicit, server-authorized organization selection. That selection sets the HTTP-only active-organization context; navigation and route gates then resolve from persisted organization industry, features, and permissions. See `docs/PRODUCT_ENTRY.md`.

## Salon operational boundaries

Salon owns its named `requested → confirmed → checked_in → in_service → completed` policy. Core retains common scheduling and availability, while a Salon-only transition verifies industry before starting/completing a standalone Appointment. Automotive still proceeds through Queue and Job Order Work Execution.

```text
                    CORE PAYMENT
                        ↑
               ┌────────┴────────┐
               │                 │
           AUTOMOTIVE          SALON
        Invoice / Job Order   Appointment
```

`payments` remains one ledger. Existing Automotive rows retain invoice/Job Order references; Salon uses the mutually exclusive Appointment reference. Both paths enforce organization/branch integrity, server-authoritative balances, RLS, audit, and shared reversal behavior.

ServiceCore is the internal modular-monolith platform. NegOSu Automotive is the customer-facing Automotive solution; KarKR remains an internal/legacy compatibility name. Core owns reusable service-business capabilities, while `modules/automotive` owns vehicles, inspections, job orders, maintenance, and vehicle history.

Salon is the second architecture-validation vertical. An explicit `organizations.industry` value selects shell terminology and capabilities; existing organizations default to `automotive`. Salon reuses Core Customers, Services, Appointments, Scheduling, Availability, Staff, Resources, Products/Inventory, permissions, and audit without importing Automotive runtime modules. See `docs/SALON.md`.

Industry is trusted tenant configuration, not an editable organization preference. Ordinary authenticated sessions cannot change it. Shared appointment lifecycle supports standalone completion, while vertical work-execution adapters remain outside Core scheduling.

```text
           ServiceCore (internal)
        ┌────────────┴────────────┐
        ↓                         ↓
 NegOSu Automotive      NegOSu Salon & Beauty
        ↓                         ↓
 Automotive adapters       Core Scheduling
        └────────────┬────────────┘
                     ↓
             Shared Core + RLS
```

> Core must never require a vehicle to function.

```text
app/                         Next.js routes and server boundaries
components/                  Shared presentation components
lib/                         Existing application/domain operations
modules/core/                Industry-neutral domain contracts
modules/automotive/          KarKR automotive domain contracts
modules/platform/            Industry, feature, and module registries
supabase/                    Source-of-truth schema, RLS, tests, and seed
```

The module directories establish ownership without a risky route or table rename. Existing flat `lib/` operations can move behind these boundaries only when touched by roadmap work.

## 1. Domain model

```text
User
 └─ Membership ─ Organization (shop/company)
                   ├─ Branches
                   ├─ Staff memberships
                   ├─ Customers
                   │   └─ Vehicles
                   ├─ Services / categories
                   ├─ Appointments
                   ├─ Job Orders
                   │   ├─ Job Items
                   │   ├─ Inspection / photos (later phase)
                   │   └─ Payments / invoice relationship
                   ├─ Inventory
                   └─ Subscription / entitlements
```

The future consumer product links an authenticated consumer profile to one or more vehicles without giving the consumer access to shop-internal records. Shared service-history entries require explicit visibility rules.

`Customer -> Vehicle` is an automotive extension. A future non-automotive product reuses Organization, Branch, Membership, Customer, Service, Appointment, Product, Inventory, Payment, and Audit without creating a vehicle.

Appointment owns shared scheduling data. Its optional `vehicle_id` links to the automotive module; the foreign key and tenant/customer integrity guard remain enforced. Automotive queue and job-order operations require this association explicitly.

## Scheduling Boundary

Core scheduling is exposed through `modules/core/scheduling/scheduling.service.ts`. It validates shared appointment input, authorizes the authenticated membership and branch, verifies tenant ownership of the branch, customer, and services, then delegates storage to the existing `save_appointment` RPC.

Core scheduling does not know about vehicles. KarKR calls `modules/automotive/scheduling/automotive-scheduling.service.ts`, which applies the required-vehicle and vehicle/customer/tenant policies before invoking core scheduling. A storage-only extension passes the validated vehicle association to the RPC so appointment and service snapshot persistence remains atomic.

```text
KarKR
  ↓
Automotive Scheduling Adapter
  ↓
Core Scheduling Service
  ↓
save_appointment
  ↓
PostgreSQL
```

## Core Availability Boundary

Core Scheduling calls `evaluateAppointmentAvailability` before persistence. Availability derives the end time from active service durations and evaluates branch-local operating hours, branch service configuration, blocking appointment intervals, and update self-exclusion. Results use stable neutral codes and disclose no customer or automotive information.

```text
Core Scheduling
    ↓
Core Availability
    ├── Time validation
    ├── Branch operating time
    ├── Service availability and duration
    └── Appointment conflicts
    ↓
Appointment Persistence
```

The existing opening-hours format does not define overnight hours; `close <= open` is treated as unavailable. Core Availability is the feedback/domain check, while the appointment persistence functions take a branch advisory transaction lock and repeat conflict rules as the authoritative concurrency check.

## Scheduling Assignments

Core Scheduling supports optional normalized Staff-profile and resource assignments. `organization_staff_profiles.id` is the canonical operational Staff identity, and `staff_profile_branch_assignments` defines scheduling eligibility independently from login access. An optional membership link grants authentication and authorization; it is not required to be Staff. Generic `scheduling_resources` belong to one branch and expose an active flag and integer capacity. Assignment replacement is part of the same serialized PostgreSQL transaction as appointment persistence.

```text
Core Scheduling
      ↓
Core Availability
      ├── Appointment Conflict
      ├── Branch Time
      ├── Service Availability
      ├── Staff Availability
      └── Resource Availability
              ↓
       Scheduling Assignments
        ├── Staff
        └── Resource
```

KarKR maps Technician presentation to Core Staff and Service Bay presentation to a Core Scheduling Resource. Job Order technician assignment remains a separate Automotive Work Execution responsibility.

KarKR composes these assignments into a bounded operational read model for Calendar, Queue, and appointment details. Queue conversion defaults to an unassigned Job Order. Only an explicit operator choice allows Automotive Work Execution to revalidate an authoritative scheduled technician and initialize the Job Order technician atomically. This is a one-time copy, not synchronization; scheduling resources remain display-only.

## Automotive Work Execution Boundary

Job Orders are a KarKR automotive concept. Core Scheduling ends at the Appointment boundary and never creates, transitions, assigns, inspects, or releases a Job Order. Queue conversion enters `modules/automotive/work-execution`, which applies automotive input and status policy before delegating to transaction-safe PostgreSQL RPCs.

```text
Core Appointment
       ↓
KarKR Automotive Adapter
       ↓
Automotive Work Execution
       ↓
Job Order
   ↓       ↓
Inspection Work
      ↓
      QC
      ↓
   Release
```

The existing database functions remain the concurrency and persistence boundary. `convert_queue_to_job` locks the queue row, validates its appointment/customer/vehicle relationship, and returns the existing Job Order on retry. Job item triggers calculate authoritative totals in integer centavos. Audit triggers continue recording creation and status changes.

### Service Advisor boundary

KarKR composes inspection, the latest estimate authorization snapshot, branch inventory availability, invoice payments, and Job Order status into a Service Advisor view. Automotive owns estimate authorization, part requirements, work readiness, recommended actions, QC, and release readiness. Core Inventory remains the stock ledger and Core finance remains the invoice/payment source of truth.

### Parts reservation boundary

KarKR derives required parts from the current authorized estimate and service-consumable recipes, then calls the shared Core Inventory reservation boundary. Core Inventory knows only organization, branch, inventory item, quantity, operation, and an opaque external reference. It has no Vehicle, Estimate, or Job Order policy.

```text
Estimate / Job Order
        ↓
Automotive Parts Requirement
        ↓
Core Inventory Reservation
        ↓
Consumption or Release
        ↓
Inventory Movement ledger
```

`inventory_movements` remains the only physical on-hand source of truth. Active reservation remainder is an allocation ledger, and available quantity is derived as on hand minus that remainder. PostgreSQL locks the inventory item before checking and reserving availability, so competing final-unit requests serialize. Consumption reduces both reservation remainder and physical on hand atomically; release reduces only reservation remainder.

```text
Inspection → Estimate → Authorization → Parts → Work → QC → Payment → Release
```

The Automotive policy returns explicit blockers for presentation. Transactional RPCs independently enforce inspection, current authorization, branch stock, status transitions, and zero-balance release. Core does not import this policy.

### Customer digital estimate approval

KarKR can issue a private, expiring customer link for the current estimate version. Server-only code generates a 256-bit bearer token; public validation stores only its SHA-256 hash, while optional asynchronous delivery uses a separate encrypted expiring secret described below. The anonymous route calls two narrowly granted security-definer functions; anonymous roles have no direct access to the link, estimate, customer, vehicle, Job Order, notification, or audit tables.

```text
Advisor Job Order
  → Automotive Estimate Approval Service
  → hashed approval-link record
  → private /estimate/[token] page
  → transactional approve/decline
  → existing estimate authorization snapshot
```

The public projection is allowlisted to business/branch contact details, a Job Order reference, basic vehicle identity, estimate lines, and totals. It excludes customer identifiers/contact data, VIN, notes, inventory references, staff data, payments, and internal records. The decision function locks both link and estimate, verifies the exact current version and amount, consumes the link, records `digital_link` authorization, and audits the outcome in one transaction. Estimate changes supersede active links.

### Transactional notification outbox

Core notification infrastructure owns recipient eligibility, per-channel outbox state, atomic claiming, leases, retries, safe diagnostics, and provider adapters. Automotive creates `ESTIMATE_AWAITING_APPROVAL` intent and renders its own estimate templates; Core does not import Automotive concepts. The application cron route is the composition root that injects Automotive templates into the shared worker.

```text
Automotive approval request
  → approval link + Email/SMS outbox rows (one transaction)
  → shared eligibility and bounded claim
  → configured provider adapter
  → Sent / Retry / Failed / Cancelled
```

Raw approval tokens never enter the generic outbox payload, logs, or audit metadata. Public validation still stores only SHA-256 hashes. An AES-256-GCM encrypted, expiring delivery secret is kept in a service-role-only table until the link is decided, revoked, superseded, or expired. Provider failure does not roll back the link or remove the manual Copy Link fallback.

## 2. Multi-tenancy
`organizations` is the tenant root. `organization_memberships` maps authenticated users to tenants and roles.

Roles:
- `owner`: full tenant control and billing;
- `manager`: operational administration except protected billing/ownership actions;
- `advisor`: front desk/customer/job workflow;
- `technician`: assigned job execution and inspection workflow;
- `cashier`: invoices/payments;
- `viewer`: read-only internal access.

A user may belong to multiple organizations.

## 3. Branch model
An organization can have many branches. Operational records should carry both `organization_id` and `branch_id` where branch ownership matters. RLS always starts from organization membership; phase 09 adds optional branch-level staff restrictions.

## 4. Money
All monetary values are integer centavos (`bigint`):
- ₱499.00 -> `49900`.
- Never calculate totals with floating point.
- Persist the invoice snapshot; do not recalculate historical invoices from a mutable service catalog.

## 5. Status machines
### Appointment
`requested -> confirmed -> checked_in -> completed`
Alternative exits: `cancelled`, `no_show`.

### Job order
`draft -> queued -> in_progress -> quality_check -> ready -> completed`
Alternative exit: `cancelled`.

### Payment
`pending -> paid | failed | refunded | voided`.

Transitions must eventually be centralized and audited; do not scatter arbitrary status updates across UI components.

## 6. Service history
A completed Job Order is the source event for Automotive service history. Completion transactionally creates one immutable `vehicle_service_records` snapshot and its approved work-item snapshots. The live Job Order remains operational data; history does not change if that operational record is later edited. The same transaction advances a vehicle odometer only when the captured reading is greater and replaces the active maintenance projection for each configured service. Core never imports this Automotive lifecycle.

```text
Final Job Order completion
  -> immutable vehicle service record
  -> monotonic vehicle odometer update
  -> one active vehicle/service due projection
  -> generic notification outbox when a reminder stage is reached
```

`vehicle_service_history` remains as a compatibility query model. It prefers durable snapshots and temporarily falls back to legacy completed Job Orders that have not yet been backfilled, so deployment does not hide existing customer history. A bounded service-role backfill function exists for controlled operations; migrations never run it automatically.

## 7. External providers
Use adapter boundaries:
- `BillingProvider`
- `EmailProvider`
- `SmsProvider`
- `PaymentProvider`
- `AiProvider`

Domain code must not depend directly on a vendor SDK except inside an adapter.

## 8. Next.js boundaries
- Server Components: initial data and protected screens.
- Server Actions/Route Handlers: validated mutations.
- Client Components: interactive tables, dialogs, optimistic queue actions.
- Supabase service role: only isolated server modules for trusted admin/webhook work.

## 9. Security model
- Supabase Auth establishes identity.
- RLS establishes row-level authorization.
- Server validation establishes allowed operations and field integrity.
- Entitlements establish plan limits.
- Audit logs establish traceability.

All four are necessary; none substitutes for another.

## 10. Recommended later infrastructure
- background jobs: scheduled worker/queue rather than long request handlers;
- object storage: private buckets with signed URLs for internal inspection photos;
- observability: structured error tracking and application logs;
- analytics: privacy-aware product analytics;
- backups: validate restore procedure before production launch.

## 11. Owner Command Center boundary

The owner/manager dashboard composes a vertical-neutral Core metrics snapshot with one explicit Automotive or Salon contributor. Core owns paid revenue, branch-local Appointment counts, shared outstanding balances, low-stock projection, branch scope, and the presentation contract. Each vertical owns the meaning and wording of its operational actions, Today's Operations, and staff context.

```text
NegOSu dashboard
  -> Shared Command Center metrics
  +  active vertical contributor
  -> derived Action Inbox and branch performance
```

The database aggregate reauthorizes every branch and role. Actions are derived from live state and have no persistent task table. Core never imports a vertical module; the page is the composition root. See `docs/COMMAND_CENTER.md`.
