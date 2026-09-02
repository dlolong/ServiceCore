# KarKR Automotive Domain

KarKR owns Vehicle, Inspection, Job Order, automotive service execution, QC, vehicle release, and maintenance history. These concepts live under `modules/automotive` and may depend on shared ServiceCore capabilities; shared Core modules never import them.

## Vehicle service history and maintenance

The final `completed` Job Order transition is the only automatic history source. It snapshots the branch, customer-at-service, vehicle, completion time, captured odometer, actual total, assigned technician references, and approved Job Order items. Proposed and declined estimate work is excluded. A unique source Job Order constraint makes trigger retries idempotent.

Maintenance intervals are Automotive metadata attached to Services. Month and kilometer intervals may be used independently or together. Completion snapshots the configured interval into `vehicle_maintenance_due`; later configuration changes affect future completed work only. Date status uses the configured lead window (14 days by default). Mileage is never inferred: it becomes due only when the vehicle's current captured odometer reaches the stored threshold.

Completing the same service satisfies the prior active cycle and creates the next one. Staff may dismiss an active cycle with a reason. Archived vehicles and archived customers are excluded from reminder enqueueing. Appointment creation from Maintenance prefills the existing KarKR appointment form, whose save path remains Automotive Scheduling Adapter -> Core Scheduling Service.

### Maintenance rebooking lifecycle

```text
Maintenance Due
    ↓
Automotive Scheduling Adapter
    ↓
Appointment
    ↓
Job Order
    ↓
Matching completed Service
    ↓
Maintenance satisfied → Next Maintenance Due
```

`vehicle_maintenance_due.appointment_id` is an explicit, current-attempt link; same vehicle/customer/date does not imply a relationship. Creation locks the due row, reuses an already-active related appointment, atomically creates and links through the existing Scheduling persistence boundary, and cancels unsent stale reminder intents. A cancelled or no-show appointment remains historical but is inactive, so a later create may replace the current link. Rescheduling the appointment preserves it.

An appointment never satisfies maintenance by status alone. The completed Job Order must contain an approved item with the exact maintenance `service_id`. Completing unrelated work leaves the due cycle active; matching work satisfies the prior cycle and creates the next projection idempotently.

Snoozing pauses reminders until an explicit timestamp without changing `next_due_at`, mileage thresholds, or lifecycle status. Resume clears the snooze. Active appointment suppression takes precedence over snooze, and snooze expiry is derived at eligibility time rather than mutated by a background task.

### Legacy history backfill

`npm run maintenance:backfill -- --dry-run --organization <uuid> --limit <n>` is the default, read-only planner. It reports stable create/skip/warning/blocker codes to the console and an ignored JSON report under `reports/maintenance-backfill/`. Mutation requires `--apply`; production additionally requires `--confirm-production` plus `MAINTENANCE_BACKFILL_PRODUCTION_CONFIRM=<organization-uuid>`.

Apply uses small organization-scoped batches, handles individual Job Order failures, never edits source Job Orders, and is safe to rerun. It never guesses missing service IDs or odometer values. Current maintenance-rule intervals are used because historical snapshots do not exist. Backfilled projections have `notifications_enabled=false` until an owner/manager explicitly activates them, so historical reconstruction cannot unexpectedly contact customers.

## Scheduling presentation

KarKR maps an appointment Technician/Assigned Staff choice to a Core staff membership assignment and a Service Bay choice to a Core scheduling resource assignment. Vehicle validation remains in the Automotive Scheduling Adapter. Appointment assignments remain optional, and Job Order technician assignment remains independently editable in Automotive Work Execution rather than becoming a Core concern.

Queue, Calendar, and appointment details display scheduling assignments as planning context. Queue conversion provides an unchecked staff-copy control. When explicitly selected, Automotive Work Execution reloads the appointment assignment, validates organization, active technician membership, and branch eligibility, then initializes the single Job Order technician in the conversion transaction. The two assignments are independent afterward. Service-bay context is never copied because Job Orders have no work-bay assignment model.

## Work Execution

```text
Core Appointment
       ↓
Automotive Queue Adapter
       ↓
Automotive Work Execution
       ↓
Job Order → Inspection → Work → QC → Release
```

The public application boundary is `modules/automotive/work-execution/job-order.service.ts`. It defines explicit inputs and the current status/action map. Its server runtime authenticates requests and calls narrowly scoped PostgreSQL functions.

`convert_queue_to_job` is the atomic conversion operation. It locks the queue record, confirms branch access, requires an active vehicle belonging to the same organization and customer, verifies the linked appointment, snapshots appointment services, updates the queue, and returns the existing Job Order on retry. Unique appointment and queue-entry constraints provide structural duplicate protection.

PostgreSQL calculates `job_order_items.line_total_centavos` and `job_orders.actual_total_centavos` using integer centavos. Estimates, invoices, and payments remain shared commerce capabilities. Existing audit triggers record Job Order creation and status changes; there is no second event or notification system.

## Service Advisor Workflow

```text
Inspection → Estimate → Customer Authorization → Parts Readiness
           → Work Ready → In Progress → QC → Payment → Release
```

The compact Job Order workspace composes an Automotive Service Advisor view from the current estimate, branch inventory, invoice payments, inspection, and Work Execution status. It shows estimate total, authorization, required-parts readiness, paid amount, balance, blockers, release readiness, and one recommended next action. The recommendation is presentation guidance; PostgreSQL and Automotive Work Execution remain authoritative.

Authorization snapshots the current estimate version total. Editing an approved line recalculates amounts server-side, clears authorization, returns an `approved` Job Order to `queued` before work starts, and emits `estimate.authorization_invalidated`. Advisor-recorded approvals and declines capture method, time, actor, note, version, and amount through the existing audit capability. Existing approval routes remain compatible and record method `other`.

Parts may be explicit estimate lines linked to an active inventory item or consumables derived from existing service recipes. Readiness and reservation use only stock from the Job Order branch. Supplier ordering and automatic sourcing remain outside this boundary.

KarKR now turns those requirements into explicit branch reservations after current customer authorization. Parts readiness means required quantity is reserved or already consumed, not merely present on a shelf. A row can be partially reserved when stock is insufficient; the reserve-all operation is atomic and rolls back if any required item cannot be secured. Work start rechecks reservation coverage in PostgreSQL.

During work, advisors record actual part usage against the reservation. Each retry-safe consumption creates one negative Core Inventory movement. Releasing unused quantity restores availability without increasing on hand. Estimate revision and Job Order cancellation release outstanding allocations; completion retains automatic service-recipe consumption for legacy behavior, releases unused allocation, and snapshots only consumed parts into Vehicle Service History.

Work start requires a saved inspection, a current approved estimate, and sufficient branch stock. Vehicle release follows the existing QC status path and requires a non-void invoice with zero balance. Payments continue through the shared invoice-payment RPC; KarKR only composes their state into its automotive view.

## Customer Digital Estimate Approval

The Automotive Estimate Approval boundary lives in `modules/automotive/work-execution/estimate-approval.ts`. Advisors generate a seven-day private link from the Job Order workspace; generating a replacement revokes the former link, and manual revocation requires confirmation. Public validation persists only the token hash. For asynchronous delivery, the token is also stored as an AES-256-GCM encrypted, expiring secret in a service-role-only notification table and is destroyed when the approval cycle ends. Raw tokens are never placed in the generic outbox payload, logs, or audit metadata.

The customer route displays only the exact estimate version and amount bound to the link. It requires no account, is no-cache/no-index, and provides explicit approve/decline confirmations with an optional bounded comment. PostgreSQL serializes decisions with a row lock, so retries are idempotent and the first approve/decline decision wins. Digital decisions use the existing authorization model with `authorization_method = 'digital_link'`, a null staff actor, and the authorized total snapshot. Any estimate amount/status revision supersedes the active link.

Approval-link creation atomically enqueues one Email and one SMS intent with deterministic per-link/version/channel keys. Ineligible channels are recorded as cancelled with a controlled reason; provider calls occur later and never block link creation. Automotive owns the `estimate-awaiting-approval` and expiry-reminder message templates. Customer decision, link revocation, and estimate supersession cancel obsolete pending delivery and destroy the encrypted secret.

| Responsibility | Owner |
| --- | --- |
| Inspection | Automotive |
| Estimate and authorization | Automotive Work Execution |
| Parts requirements/readiness | Automotive using Core Inventory |
| Product stock and ledger | Core Inventory |
| Work and QC | Automotive Work Execution |
| Invoice/payment records | Core finance capability |
| Balance/release presentation | Automotive read model using Core finance |
| Release policy | Automotive Work Execution |
