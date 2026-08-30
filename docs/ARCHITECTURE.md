# ServiceCore Architecture

ServiceCore is a modular monolith. KarKR is the active automotive product powered by the shared ServiceCore platform. Core owns reusable service-business capabilities; `modules/automotive` owns vehicles, inspections, job orders, maintenance, and vehicle history.

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

Core Scheduling now supports optional normalized staff and resource assignments. `organization_memberships.id` is the canonical staff identity, and the existing `membership_branch_assignments` relation defines branch eligibility. Generic `scheduling_resources` belong to one branch and expose an active flag and integer capacity. Assignment replacement is part of the same serialized PostgreSQL transaction as appointment persistence.

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

```text
Inspection → Estimate → Authorization → Parts → Work → QC → Payment → Release
```

The Automotive policy returns explicit blockers for presentation. Transactional RPCs independently enforce inspection, current authorization, branch stock, status transitions, and zero-balance release. Core does not import this policy.

### Customer digital estimate approval

KarKR can issue a private, expiring customer link for the current estimate version. Server-only code generates a 256-bit bearer token and stores only its SHA-256 hash. The anonymous route calls two narrowly granted security-definer functions; anonymous roles have no direct access to the link, estimate, customer, vehicle, Job Order, or audit tables.

```text
Advisor Job Order
  → Automotive Estimate Approval Service
  → hashed approval-link record
  → private /estimate/[token] page
  → transactional approve/decline
  → existing estimate authorization snapshot
```

The public projection is allowlisted to business/branch contact details, a Job Order reference, basic vehicle identity, estimate lines, and totals. It excludes customer identifiers/contact data, VIN, notes, inventory references, staff data, payments, and internal records. The decision function locks both link and estimate, verifies the exact current version and amount, consumes the link, records `digital_link` authorization, and audits the outcome in one transaction. Estimate changes supersede active links.

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
A completed job order becomes the source of truth for service history. Never duplicate history manually when it can be derived from completed jobs. Consumer-visible summaries can be materialized later for performance/privacy.

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
