# Industry Modules

NegOSu is the commercial master brand. Its supported customer-facing solutions are NegOSu Automotive and NegOSu Salon & Beauty. ServiceCore, KarKR, `automotive`, and `salon` remain stable internal architecture or compatibility terms where renaming would not add customer value.

## Product entry configuration

Only `automotive` and `salon` are enabled signup products. `modules/platform/product-entry.ts` maps customer-facing categories and specific business types to those persisted keys; arbitrary or future reserved industry keys are not accepted during signup. PostgreSQL repeats that allowlist and business-type pairing inside transactional first-organization creation.

Public copy may follow an entry context, but application behavior never does. The active membership's persisted organization industry is authoritative for product navigation, onboarding terminology, and direct route gating. Vertical checklist definitions live in `modules/platform/onboarding.ts` and completion is derived from domain records rather than stored flags.

Salon owns its operational Appointment transition policy and reminder wording. Core owns Scheduling, Availability, secure Appointment self-service mechanics, Notification delivery, and the neutral Payment ledger. Authorization role remains on `organization_memberships`; `organization_staff_profiles.job_function` is operational metadata only.

Organization industry is explicit data, not inferred from a URL, organization name, or service catalog. `automotive` remains the safe migration default for all existing organizations; `salon` activates the second controlled vertical. Unknown industry values fail the typed application resolver and are rejected by the database constraint.

Ordinary authenticated users cannot change an organization industry. Trusted migrations or service-role operational tooling must perform any deliberate vertical conversion after its data compatibility has been reviewed.

| Capability | Core | Automotive | Salon |
| --- | --- | --- | --- |
| Customer / Client | Owns | Presentation | Presentation |
| Staff and branch access | Owns | Technician terminology | Staff/specialist terminology |
| Service | Owns | Vehicle pricing extension | Treatment presentation |
| Appointment / Availability | Owns | Vehicle adapter/policy | Direct Core consumer |
| Scheduling resource | Owns | Service bay | Chair/room/station |
| Product / Inventory | Owns | Parts execution adapter | Product stock |
| Payment | Shared ledger/reference boundary | Invoice + Job Order integration | Appointment reference |
| Vehicle / Inspection / Job Order / Maintenance | — | Owns | — |

Automotive-only routes are both removed from Salon navigation and blocked at their server layouts/actions. Vehicle RLS denies Salon-tenant Vehicle reads/writes. Industry checks supplement tenant, role, and branch authorization; they never replace it.

KarKR is the active automotive vertical. `modules/automotive` owns Vehicle, VehicleInspection, JobOrder, JobOrderItem, MaintenanceRecord, and the automotive appointment subject.

`appointments.vehicle_id` is nullable at the shared persistence boundary. When present, database integrity requires the vehicle to belong to the same organization and customer. KarKR queue and job-order conversion remain automotive operations and reject appointments without a vehicle using explicit domain errors.

The platform registry in `modules/platform/industry.ts` defines terminology and capabilities. Capability means the industry supports a feature; it does not grant subscription access or user permission.

```text
industry capability + subscription entitlement + permission
                                  ↓
                         presentation eligibility
                                  ↓
                    server authorization and RLS
```

No Beauty, Hospitality, or Field Service implementation exists. Those keys reserve a typed vocabulary only. Avoid scattered industry string comparisons: behavior belongs in a module or typed configuration.

Database tables do not need cosmetic automotive prefixes. Logical ownership, typed contracts, authorization, and documentation provide the boundary without destructive renames.

## Scheduling Boundary

KarKR appointment writes use the Automotive Scheduling Adapter. The adapter requires a vehicle for the current staff booking workflow, verifies that the active vehicle belongs to the appointment organization and customer, and then supplies only shared scheduling data to the Core Scheduling Service.

```text
KarKR server action
  → Automotive Scheduling Adapter
  → Core Scheduling Service
  → save_appointment
```

This dependency direction is one-way: automotive may depend on core, while core never imports or validates automotive concepts. Public booking and walk-in retain their purpose-built transactional RPCs; they use different persistence operations rather than calling `save_appointment`.

## Automotive Work Execution

`modules/automotive/work-execution` owns KarKR Job Order conversion, status semantics, technician/service assignment, additional-work coordination, and controlled automotive errors. Appointment-to-Job conversion requires a valid same-tenant customer and active vehicle and is idempotent for the queue/appointment relationship.

The same module owns Automotive parts requirements and Job Order lifecycle policy. It maps current authorized estimate lines and service recipes to generic Core Inventory reservation calls. Work cannot start until required quantities are secured. Estimate revision and cancellation release stale allocations; completion preserves legacy recipe consumption, records actual consumption only, and releases unused allocations.

KarKR appointment forms present Core staff as assigned staff and Core scheduling resources as service bays. These are presentation mappings only. Automotive certification, technician specialization, Vehicle policy, and Job Order execution assignments remain outside Core; scheduled appointment staff are not silently made authoritative Job Order technicians.

Inspection, work, QC, completion, and release remain automotive concerns. Payments and service catalog records are consumed through shared capabilities but are not moved into the automotive module. PostgreSQL remains authoritative for line snapshots, totals, permissions, row locking, RLS, and audit events.

KarKR's Automotive Scheduling Adapter supplies vehicle policy and passes shared schedule data into Core Scheduling. Shared time, branch, service, and overlap rules are not duplicated in Automotive. KarKR retains the “allow overlapping booking” presentation; Core still reports the slot as unavailable, and the authenticated scheduling role plus write RPC controls whether the override is persisted.

## Command Center contributors

`modules/automotive/command-center` and `modules/salon/command-center` are explicit contributors to the shared Command Center contract. Automotive derives estimate, Job Order, ready-for-release, invoice, and maintenance actions. Salon derives Client Appointment confirmation, waiting, service, and payment context. Shared Core only sorts and presents their neutral action records.

The dashboard page is the composition root. Dependency direction remains `Automotive -> Core` and `Salon -> Core`; Core and Salon never import Automotive. Shared low-stock state may be presented by either contributor with vertical-appropriate wording.
