# ServiceCore public data contract

Anonymous callers receive data only through Phase 10 RPCs. They have no direct access to organizations, branches, services, customers, vehicles, appointments, jobs, invoices, payments, staff, internal inspections, private job photos, booking-request rows, or rate-limit rows.

`get_public_shop` exposes only a published shop's name, slug, public description and images, public contact/social links, active branch address/contact/hours/map fields, explicitly public services, and active gallery images.

`get_public_availability` exposes timestamps for one service; `get_public_availability_for_services` exposes timestamps that can fit the combined duration of one to ten unique selected services. Their bounded date projections expose only dates and slot counts. They never return appointment records, customer names, staff identities, schedule contents, or capacity details.

`submit_public_booking` accepts validated contact and vehicle information into the isolated booking-request tables. Its response contains only a random confirmation token and public reference. Existing-customer matching happens only during an authorized internal confirmation and is never disclosed publicly.

`get_public_booking_status` requires the random confirmation token and returns only reference, request/appointment status, shop/branch names, public shop slug, preferred or confirmed schedule, service snapshots, last status timestamp, and an optional decline reason. This powers the private customer progress page and does not return contact information, vehicle identifiers, internal notes, customer IDs, appointment IDs, or staff data.
