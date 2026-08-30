# KarKR Automotive Domain

KarKR owns Vehicle, Inspection, Job Order, automotive service execution, QC, vehicle release, and maintenance history. These concepts live under `modules/automotive` and may depend on shared ServiceCore capabilities; shared Core modules never import them.

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

Parts may be explicit estimate lines linked to an active inventory item or consumables derived from existing service recipes. Readiness uses only stock from the Job Order branch. This phase reports availability but does not reserve, order, or automatically source stock.

Work start requires a saved inspection, a current approved estimate, and sufficient branch stock. Vehicle release follows the existing QC status path and requires a non-void invoice with zero balance. Payments continue through the shared invoice-payment RPC; KarKR only composes their state into its automotive view.

## Customer Digital Estimate Approval

The Automotive Estimate Approval boundary lives in `modules/automotive/work-execution/estimate-approval.ts`. Advisors generate a seven-day private link from the Job Order workspace; generating a replacement revokes the former link, and manual revocation requires confirmation. The raw 256-bit token is returned once for copying and is never persisted or placed in audit metadata.

The customer route displays only the exact estimate version and amount bound to the link. It requires no account, is no-cache/no-index, and provides explicit approve/decline confirmations with an optional bounded comment. PostgreSQL serializes decisions with a row lock, so retries are idempotent and the first approve/decline decision wins. Digital decisions use the existing authorization model with `authorization_method = 'digital_link'`, a null staff actor, and the authorized total snapshot. Any estimate amount/status revision supersedes the active link.

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
