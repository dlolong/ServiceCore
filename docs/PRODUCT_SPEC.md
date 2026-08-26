# KarKR Product Spec

## Brand
**KarKR** = Kar (Car) + KR (Care)

Primary positioning: **Smart software for car wash, detailing and auto service businesses.**
Brand line: **Your Car. Our Care.**

## Initial market
Independent and small-to-medium automotive businesses in the Philippines:
- car wash;
- detailing / ceramic coating;
- tint / PPF;
- PMS / oil change;
- tire / battery;
- air-conditioning and light mechanical service;
- eventually larger multi-branch service centers.

Do not optimize the MVP around dealership-level complexity.

## Primary users
### Owner
Needs revenue visibility, controls, staff access, branch management, inventory signals, customer retention and SaaS billing.

### Manager / Service Advisor
Needs fast customer/vehicle lookup, booking/walk-in check-in, job creation, estimates, status updates and customer communication.

### Technician / Detailer
Needs an extremely simple mobile view of assigned work, customer concerns, checklist, photos, notes and status.

### Cashier
Needs amount due, deposits, payment method/reference, receipt and daily reconciliation.

### Consumer (Phase 13+)
Needs My Garage, service history, reminders, trusted shops and future marketplace discovery.

## MVP north-star workflow
```text
Customer arrives/books
  -> identify/create customer
  -> identify/create vehicle
  -> choose services
  -> appointment or walk-in queue
  -> job order
  -> inspection / additional work
  -> customer approval when needed
  -> service execution
  -> payment / receipt
  -> completed service history
  -> maintenance/repeat reminder
```

## Product principles
1. A walk-in must be fast to encode.
2. Vehicle history is a long-term retention asset.
3. Job orders are the operational source of truth.
4. Completed jobs drive service history and reporting.
5. Payments recorded in KarKR must reconcile; provider integration is not implied by a payment-method label.
6. The platform remains useful without the future marketplace.
7. Marketplace and consumer features should amplify an already-useful B2B SaaS, not rescue it.
8. AI assists staff; it does not replace inspections, approvals or safety-critical judgment.

## Initial plan hypothesis (validate with real shops)
- Free: 1 branch, 2 staff, 30 jobs/month
- Starter: ₱499/month
- Business: ₱999/month
- Pro: ₱1,999/month
- Multi-Branch: custom / later

Pricing is a business hypothesis, not a hard-coded domain assumption. Keep plan capabilities data-driven.

## Activation metrics
A new organization is meaningfully activated when it has:
1. completed onboarding;
2. configured at least 3 services;
3. added first customer + vehicle;
4. completed first job order;
5. recorded first payment.

## Pilot target
After Phase 06, pilot with 3–5 real shops before building the deeper roadmap. Capture:
- time to add a walk-in;
- number of steps from arrival to job;
- missing fields/workflows;
- estimate/payment edge cases;
- owner dashboard questions;
- staff behavior on mobile;
- reasons users still fall back to paper/Messenger/spreadsheets.
