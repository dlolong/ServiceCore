# Core Domain

Core Appointment Self-Service owns hash-token mechanics and an allowlisted public DTO. Vertical adapters opt in and own customer wording. Public rescheduling repeats authoritative branch, service, Staff, Resource, and overlap checks rather than updating a timestamp directly.

Core Payments understands organization, branch, amount, method, status, and an explicit business reference. Automotive invoice payments and Salon Appointment payments share the ledger; Core does not require a Vehicle, Job Order, or invoice for an Appointment payment. Appointment totals come from persisted service-price snapshots, never browser input.

The shared core models service-business concepts that have meaning in more than one industry.

| Capability | Ownership | Tenant path |
| --- | --- | --- |
| Organization | Core tenant root | `organizations.id` |
| Branch | Core location | direct `organization_id` |
| Membership/staff access | Core authorization | direct `organization_id` |
| Customer/CRM | Core relationship | direct `organization_id` |
| Service/category | Core catalog | direct `organization_id` |
| Appointment | Core scheduling | organization and branch |
| Product/inventory | Core stock | organization and optional branch |
| Payment/invoice | Core financial record | organization and branch |
| Notification/audit | Core support capability | direct `organization_id` |
| Subscription/entitlement | Core platform access | organization |

Core domain contracts live in `modules/core`. Existing database names remain unchanged. Core must never require a vehicle to function.

Money is stored in integer centavos. Business writes are validated at the server boundary, authorized against the authenticated active membership, and constrained again by RLS. Browser-supplied organization, branch, role, price, status, or entitlement values are never authoritative.

## Notification Boundary

Core Notifications owns email/SMS channel eligibility, destination snapshots, outbox lifecycle, deterministic deduplication, worker claims and leases, bounded retry, provider-neutral results, and safe operational metadata. Its worker operates on opaque notification type/template keys and structured payloads; it contains no estimate, vehicle, VIN, Job Order, or maintenance policy.

Vertical modules create business notification intent and provide templates. The application route composes those templates with the shared worker, preserving the dependency direction `Automotive → Core`. `SENT` means a provider accepted a message, not that a customer read or received it.

Appointment is a shared scheduling entity. It requires an organization, branch, customer, schedule, and services, but its `vehicle_id` is an optional automotive association. KarKR staff booking, public booking, walk-in, queue, and job-order workflows may enforce a vehicle explicitly without making vehicles a core requirement.

## Scheduling Boundary

The core `saveAppointment` service accepts only organization, branch, customer, service, schedule, note, and appointment identity fields. It validates shared input, membership/role/branch access, and the tenant ownership and availability of referenced core records. Its public input and tests contain no vehicle field.

The existing `save_appointment` SQL function remains a lower persistence boundary. Its optional storage field supports an atomic vertical association but does not make that association part of the core scheduling contract.

Core stops at scheduling and the Appointment record. Job Orders, inspections, automotive technician execution, QC, and vehicle release are not Core concepts. A future Beauty vertical can use Customer, Appointment, Scheduling, Staff, Services, and Payments without importing automotive work execution.

Core Inventory owns the append-only physical movement ledger plus generic reservations addressed by an opaque external reference. Its terms are organization, branch, inventory item, reserved quantity, consumed quantity, released quantity, and idempotency key. It does not derive estimate requirements or know Job Orders, vehicles, inspections, or technician workflow. Vertical adapters supply those policies.

Scheduling uses `organization_staff_profiles.id` as its operational Staff identity. A Staff profile may exist without an authentication membership, email, or mobile number. `staff_profile_branch_assignments` controls where Staff may be scheduled; membership branch assignments independently control where a login may access the application. Optional normalized appointment Staff/resource assignments preserve history and support availability checks. Core calls these concepts Staff and Resource; it does not encode automotive work rules or bay meaning.

## Staff identity boundary

Operational Staff, login access, and notification destinations are separate concerns. `full_name` and employment `is_active` belong to the Staff profile. The optional membership link grants system access and carries authorization role/access branches. Optional normalized email/mobile values never create login access implicitly, and missing Staff contacts are controlled notification-ineligibility outcomes. Existing linked records retain `staff_profile.id = membership.id` for deployed identifier compatibility.

```text
Business Staff Profile
    ├── Mobile (optional)
    ├── Email (optional)
    └── NegOSu User / Membership (optional)
```

Staff is not an authenticated User. Contact email is for business communication; Auth email is the login identity, and editing either one never silently edits the other.

| Responsibility | Owner |
| --- | --- |
| Staff identity and branch eligibility | Core |
| Staff schedule conflict | Core Availability |
| Resource definition, branch, active state, and capacity | Core |
| Resource schedule conflict | Core Availability |
| Appointment assignment | Core Scheduling |
| Technician and service-bay terminology | Automotive |
| Technician specialization | Automotive |
| Vehicle policy and Job Order execution | Automotive Work Execution |

## Availability Responsibilities

| Responsibility | Owner |
| --- | --- |
| Time range and derived duration | Core Availability |
| Appointment overlap and blocking statuses | Core Availability |
| Branch operating time/timezone | Core Availability |
| Branch service availability | Core Availability |
| Staff/resource availability | Core Availability |
| Vehicle policy and overlap presentation | Automotive |
| Job Order, QC, and release | Automotive Work Execution |

Availability inputs contain only organization, branch, appointment, services, and UTC schedule data. They contain no vehicle or Job Order fields.

## Command Center boundary

Core Command Center owns only the shared presentation contract, owner/manager branch-scope resolution, paid Payment totals, shared Appointment counts and standalone balances, Core Inventory low-stock counts, deterministic action ordering, and composition helpers. It has no Automotive or Salon action codes and imports neither vertical.

The active vertical supplies current actions, operational rows, staff context, terminology, and deep links. The application page composes those pieces. No Action Inbox business state is persisted, and reading the dashboard creates no audit event. Detailed metric and role semantics are in `docs/COMMAND_CENTER.md`.
