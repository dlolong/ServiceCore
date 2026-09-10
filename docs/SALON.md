# Salon Vertical

## Pilot smoke coverage

The authenticated release smoke covers the Salon owner Dashboard, daily Appointments, Clients, Treatments, Staff, Inventory, and Billing on desktop and mobile. Salon Billing deliberately omits Automotive-only Job Order limits. This is route-level launch evidence and does not replace lifecycle, assignment, payment, or tenant-isolation tests.

NegOSu Salon & Beauty is the customer-facing vertical name. Salon code continues to use the stable `salon` industry key and module terminology, while ServiceCore remains the internal shared-platform name.

## Public entry and onboarding

`/salon` provides the NegOSu Salon & Beauty landing experience without Automotive vocabulary and routes into the shared `/login` and `/signup` implementation using an allowlisted presentation context. New Salon organizations persist `industry = 'salon'` through the authenticated first-organization transaction; business type and industry must agree in both Zod and PostgreSQL validation.

Salon onboarding derives progress from Branches, Treatments, additional Staff, Chairs/Rooms, Clients, and Appointments. It does not expose Vehicle or Job Order steps and does not store redundant completion flags. Multi-organization users select the Salon through a real active membership, not a frontend-only vertical toggle.

Salon is the second controlled ServiceCore vertical. Its purpose is to prove that the shared tenant, CRM, catalog, scheduling, staff/resource, and inventory capabilities work without Automotive runtime dependencies.

## Scope and terminology

| Core concept | Salon presentation |
| --- | --- |
| Customer | Client |
| Staff profile | Staff / specialist |
| Service | Treatment |
| Appointment | Appointment |
| Branch | Branch / salon |
| Scheduling resource | Chair, room, or station |
| Inventory item | Product |

Stylist, therapist, facialist, and nail technician are organization-specific job functions stored in `organization_staff_profiles`; they are not authorization roles. Salon presents the shared permission groups as Owner, Manager, Front Desk / Coordinator, Service Provider, Cashier, and Viewer. The stored `advisor` and `technician` values remain stable internal authorization identifiers and are not shown as Automotive titles in Salon UI.

```text
authorization role = Front Desk / Coordinator (`advisor` internally)
job function       = Senior Stylist
```

## Reused Core capabilities

Salon uses the existing `organizations`, `branches`, `organization_memberships`, `customers`, `services`, `appointments`, appointment staff/resource assignments, scheduling resources, inventory items/movements, Core Scheduling, and Core Availability. No Salon-specific customer, appointment, service, product, or inventory tables exist.

```text
Salon appointment form
  → application scheduling action
  → Core saveAppointment
  → Core Availability
  → save_appointment_with_assignments
  → PostgreSQL
```

The Salon form has no Vehicle field. Staff and resources use the same branch, tenant, conflict, and capacity validation as KarKR. Requested appointments may be confirmed, confirmed/requested appointments checked in, and checked-in standalone Salon appointments completed through the shared audited appointment transition. Salon completion does not introduce a Job Order.

Appointments, Clients, Treatments, Resources, and Staff use compact desktop tables and mobile cards. Appointment, Treatment, and Resource create/edit routes reuse their authoritative forms inside the standard scrollable dialog. Client lists load Upcoming Appointment and Last Visit using bounded batched queries rather than one query per client.

## Navigation and routing

`organizations.industry` selects typed terminology and capability configuration. Ordinary authenticated organization updates cannot change that vertical identity; migration/service-role operations remain the trusted configuration path. The shared shell exposes Dashboard, Appointments, Booking Requests, Clients, Treatments, Staff, Resources, Inventory, and Settings for Salon. Vehicles, Queue, Job Orders, Maintenance, Estimates, Invoices, and the current Payments page are absent and protected by server-side capability guards. Organization membership, role, branch access, and RLS remain the security boundary; industry never replaces tenant authorization.

The existing Automotive Payments route remains gated because it is an invoice/Job Order directory. Salon records Core Appointment payments from appointment detail. Each rendered payment submission carries a stable idempotency key: exact retries return the original ledger row and conflicting key reuse is rejected. Public booking uses the shared storefront and request workflow described below; appointment self-service remains a separate private link for an existing appointment.

## Public page and appointment requests

Owners and managers configure **Settings → Public page**: publish the business page, publish treatments, and enable online requests for branches with opening hours. **View public page** opens `/shop/[slug]`; `/shop/[slug]/book` shows the selected branch's available times in its timezone. Salon branding and treatment terminology replace vehicle-specific content, and clients submit contact details without a vehicle.

A public submission creates a pending **Booking Request**, not a confirmed appointment. Authorized staff review it from **Booking Requests** and confirm or decline it. Confirmation creates the Core client/appointment/service records with no vehicle, using the existing authoritative price and duration triggers. Staff can then assign specialists and stations from the appointment. Customers use the private booking status link to check the result.

The database derives industry from the published business and validates branch access, public treatment availability, opening hours, and the complete appointment duration. Availability remains conservative at branch level; pending requests do not reserve a slot, and confirmation rechecks availability under the branch scheduling lock. Existing Automotive vehicle requirements remain in place. Apply migration `0064` before enabling Salon public booking; pages remain unpublished until an operator publishes them.

The published Salon page includes **View customer queue**, opening a separate window with branch selection and fullscreen. The customer queue requires no login and refreshes every 10 seconds. It shows only today's checked-in and in-service clients using abbreviated names; contact details, notes, payment information, and raw appointment identifiers are excluded. Apply `0065_public_salon_queue.sql` after the public-booking migration. Unpublished businesses and inactive branches have no anonymous queue access.

## Products and notifications

Salon reuses neutral inventory catalog, stock movements, transfers, and low-stock presentation. Automotive parts reservation, fitment, Job Order readiness, and automatic service-consumable recipes are not exposed. Product consumption by treatment is deferred.

Salon owns appointment reminder wording while the shared outbox owns consent, delivery, retry, leases, and provider adapters. Salon never calls email/SMS providers directly.

## Operational appointment flow

```text
Appointment → Customer confirmation → Reminder → Check-in → In service → Complete → Payment
```

The named Salon lifecycle policy drives `requested → confirmed → checked_in → in_service → completed`. Its narrow SQL transition verifies the tenant is Salon; the generic transition cannot complete Automotive appointments. Authenticated table grants exclude Appointment status, so callers cannot bypass the transition functions with direct writes. Daily staff schedule summaries are derived from Core assignments, not a duplicate schedule table.

Staff may issue one active, hashed, expiring appointment link. `/appointment/[token]` exposes an allowlisted schedule/treatment/payment summary. Schedule-only rescheduling repeats branch-hours, appointment, Staff, and Resource availability under the branch scheduling lock. Tokens are not stored raw; optional encrypted delivery material remains service-role-only.

Salon reminder deduplication includes Appointment, scheduled timestamp, and channel. Reschedule cancels old pending work; check-in, in-service, completion, cancellation, and no-show cancel pending reminders. Appointment payments use persisted service-price snapshots, support partial records, and do not initiate online charges.

## Local seed

`supabase/seed.sql` contains a fake `Glow Beauty Lounge` organization with two branches, owner/manager/staff memberships, clients, treatments, no-vehicle appointments, styling/facial/nail resources, and product inventory. Its fake owner also belongs to `KarKR Demo Auto Care` so the real organization selector can be tested locally. It is development-only and must never be applied to production.

Salon scheduling uses Core Staff profiles, including people with no login, email, or mobile number. A separate system-access invitation may later link that same Staff record without changing its appointments or job-function history. Staff branch assignment is operational scheduling scope and does not grant application access.

## Automotive boundary

Dependency direction remains:

```text
Automotive → Core
Salon      → Core
```

Core never imports Salon. Salon-facing shared pages do not statically import Automotive runtime modules. Vehicle RLS additionally prevents authenticated members of a Salon organization from reading or creating Vehicle rows in that tenant.

## Deferred capabilities

Treatment records, consultation/consent, before/after photos, packages, memberships, gift cards, loyalty, commissions, tips, payroll, advanced product consumption, treatment protocols, online marketplace, and franchise/head-office features are intentionally not part of this foundation.

## Owner Command Center

The Salon contributor uses shared financial, scheduling, assignment, and inventory primitives while keeping Client, Treatment, Staff, and Station/Room presentation in Salon. Its Action Inbox derives unconfirmed Appointments, checked-in Clients, completed Appointments with a remaining balance, and low-stock products. Today's list and staff snapshot use real Appointment assignments and resource context.

Salon does not import the Automotive contributor or show Vehicles, Job Orders, inspections, maintenance, VINs, technicians, or service bays. Its outstanding-balance links return to supported Appointment workflows because the current invoice-backed Payments directory remains Automotive-only.
