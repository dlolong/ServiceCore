# Core Domain

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

Appointment is a shared scheduling entity. It requires an organization, branch, customer, schedule, and services, but its `vehicle_id` is an optional automotive association. KarKR staff booking, public booking, walk-in, queue, and job-order workflows may enforce a vehicle explicitly without making vehicles a core requirement.

## Scheduling Boundary

The core `saveAppointment` service accepts only organization, branch, customer, service, schedule, note, and appointment identity fields. It validates shared input, membership/role/branch access, and the tenant ownership and availability of referenced core records. Its public input and tests contain no vehicle field.

The existing `save_appointment` SQL function remains a lower persistence boundary. Its optional storage field supports an atomic vertical association but does not make that association part of the core scheduling contract.

Core stops at scheduling and the Appointment record. Job Orders, inspections, automotive technician execution, QC, and vehicle release are not Core concepts. A future Beauty vertical can use Customer, Appointment, Scheduling, Staff, Services, and Payments without importing automotive work execution.

Scheduling uses organization memberships as staff identities, existing membership branch restrictions as eligibility, and generic branch-owned scheduling resources. Optional normalized appointment staff/resource assignments preserve history and support availability checks. Core calls these concepts Staff and Resource; it does not encode job titles or automotive bay meaning.

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
| Staff/resource availability | Not modeled yet |
| Vehicle policy and overlap presentation | Automotive |
| Job Order, QC, and release | Automotive Work Execution |

Availability inputs contain only organization, branch, appointment, services, and UTC schedule data. They contain no vehicle or Job Order fields.
