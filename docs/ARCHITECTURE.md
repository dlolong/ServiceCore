# KarKR Architecture

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
