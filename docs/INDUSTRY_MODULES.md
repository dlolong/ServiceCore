# Industry Modules

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
