# ServiceCore — Codex Implementation Phases

## KarKR operational checkpoint — Customer Digital Estimate Approval

Advisors can now generate, copy, replace, and explicitly revoke a private seven-day approval link for the current estimate. Customers review an allowlisted, mobile-first estimate page without an account and approve or decline through the existing authorization model. Only a SHA-256 token hash is stored; anonymous table access is denied; estimate revisions supersede links; and the transactional decision boundary provides idempotent first-decision-wins behavior with audit events.

## KarKR operational checkpoint — Service Advisor Workflow

Job Order detail now presents a compact advisor workspace spanning inspection, versioned estimate authorization, branch parts readiness, work eligibility, invoice payments, QC, and vehicle release. Estimate revisions invalidate authorization automatically; PostgreSQL blocks work without inspection/current authorization/parts and blocks release without a paid invoice. Shared inventory and finance remain Core capabilities consumed by Automotive Work Execution.

## KarKR operational checkpoint — Assignment Context

KarKR Calendar, Queue, and appointment details now compose scheduled staff and resource context through a batched Automotive read model. Queue conversion shows that context and offers an unchecked, explicit option to initialize the single Job Order technician. The database reloads and validates the authoritative scheduled membership and performs creation plus optional assignment atomically. No permanent staff synchronization or service-bay transfer exists.

## Platform architecture checkpoint — Scheduling Assignments

Core Scheduling now accepts optional staff and generic resource assignments. Memberships remain canonical staff identities and existing branch assignments remain canonical eligibility. Branch-owned resources support active/inactive history and integer capacity. Core Availability evaluates staff/resource occupancy, while `save_appointment_with_assignments` persists the appointment, service snapshots, and replacement assignments atomically under the existing branch transaction lock. KarKR displays staff and service-bay terminology without leaking those terms into Core.

## Platform architecture checkpoint — Core Availability

Core Scheduling evaluates shared availability before appointment persistence. Core Availability owns UTC interval validation, branch-timezone operating hours, active/branch-enabled services, derived duration, blocking statuses, overlap evaluation, staff/resource availability, capacity, and update self-exclusion. PostgreSQL serializes branch writes and repeats conflict checks for concurrency safety.

## Platform architecture checkpoint — Automotive Work Execution

KarKR Job Order writes now enter a named Automotive Work Execution service. Queue conversion, status transitions, technician assignments, service assignments, and additional-work changes no longer originate as raw RPC calls in server actions. Core Scheduling remains independent from Job Orders. PostgreSQL continues to own atomic conversion, idempotency, centavo totals, RLS, and audit history.

## Platform architecture checkpoint — core scheduling boundary

The staff appointment save path now follows `KarKR action → Automotive Scheduling Adapter → Core Scheduling Service → save_appointment`. Core owns shared validation and authorization without a vehicle field. The automotive adapter preserves KarKR's required-vehicle policy and tenant/customer vehicle validation, while the existing SQL RPC preserves atomic appointment, vehicle association, and service snapshot persistence. No database migration was required for this application boundary.

## Platform architecture checkpoint — appointment/vehicle decoupling

Completed after Phase 12:

- `appointments.vehicle_id` is an optional automotive association;
- core appointment validation supports schedules without vehicles;
- KarKR booking, walk-in, queue, and job-order flows retain explicit vehicle requirements;
- appointment search and UI safely retain no-vehicle records;
- cross-tenant vehicle attachment and no-vehicle RLS behavior have dedicated pgTAP coverage.

Each phase is intentionally scoped so Codex can complete and verify it in a dedicated session. Do not ask Codex to implement all phases in one giant run.

---

## Phase 00 — Repository hardening and baseline
**Goal:** make the starter deterministic and safe before feature work.

**Build**
- install dependencies and resolve framework-version issues;
- verify Tailwind, ESLint, strict TypeScript, metadata, responsive shell;
- add a `/health` route returning application/build health without secrets;
- centralize environment validation with safe server/client separation;
- add reusable UI primitives needed by later phases (button, input, card, badge, dialog/sheet if necessary);
- add a simple error boundary/not-found experience;
- verify migrations parse in a disposable/local Supabase project if available.

**Acceptance**
- clean lint/typecheck/build;
- no secrets rendered to browser;
- dashboard works at desktop and ~390px width;
- migration ordering documented.

**Codex prompt**
```text
Implement Phase 00 from docs/CODEX_PHASES.md completely. Harden the starter only; do not build auth or business CRUD yet. Follow AGENTS.md and stop after checks/report.
```

---

## Phase 01 — Authentication, organization onboarding, protected app
**Goal:** a real user can register, create a KarKR shop, and enter a protected tenant dashboard.

**Build**
- Supabase sign up, sign in, sign out, password reset, email verification flow;
- auth callback/session refresh compatible with current Supabase SSR guidance;
- protected `(dashboard)` layout;
- first-login onboarding: business name, slug, phone, default currency PHP, timezone Asia/Manila;
- create organization + owner membership atomically using a security-reviewed RPC/server flow;
- organization switcher for users with multiple memberships;
- profile/settings basics;
- replace demo dashboard organization name with real organization data.

**Security tests**
- unauthenticated dashboard blocked;
- user A cannot access user B organization;
- arbitrary role/org IDs supplied by browser are ignored/rejected.

**Codex prompt**
```text
Implement Phase 01: production-quality Supabase auth, organization onboarding, tenant selection, protected dashboard, and security tests. Use current migrations as the base; append migrations only. Stop before customer/vehicle CRUD.
```

---

## Phase 02 — Branches, customers, and vehicle CRM
**Goal:** shops can manage the records that every later workflow depends on.

**Build**
- branch CRUD (single branch by default, multi-branch-ready schema);
- customer list/search/create/edit/archive;
- vehicle create/edit/archive linked to customer;
- PH-friendly phone normalization/display; email optional;
- vehicle fields: plate, make, model, year, color, odometer, VIN optional, notes;
- customer page showing vehicles and recent activity;
- duplicate warnings for normalized phone and plate within a tenant;
- CSV import template + safe preview flow (actual large import can be later if needed).

**Acceptance**
- mobile CRUD is fast;
- archived records disappear from normal lists but historical jobs remain valid;
- no cross-tenant search leakage.

**Codex prompt**
```text
Implement Phase 02 exactly: branches plus customer/vehicle CRM with search, archive behavior, validation, mobile UX and RLS tests. Do not implement service catalog or appointments yet.
```

---

## Phase 03 — Service catalog and pricing
**Goal:** shops define what they sell.

**Build**
- service categories: Wash, Detailing, Coating, Tint/PPF, PMS, Mechanical, Tire/Battery, Other;
- service CRUD with duration, base price, active flag, taxable/configurable metadata;
- optional vehicle-size price variants (motorcycle, sedan, SUV, van/pickup) without hardcoding prices into UI;
- branch availability/overrides architecture;
- quick duplicate service and reorder;
- seed sensible demo catalog for new organizations.

**Acceptance**
- all money stored in centavos;
- historical job items will later snapshot service name/price rather than depend on live catalog.

**Codex prompt**
```text
Implement Phase 03 service catalog and pricing. Preserve integer-centavo money rules, organization isolation and future branch overrides. Stop before booking/queue.
```

---

## Phase 04 — Appointments and walk-in queue
**Goal:** handle both scheduled customers and Philippine-style walk-ins efficiently.

**Build**
- calendar/day agenda;
- appointment request/create/edit/confirm/cancel/no-show/check-in;
- select/create customer + vehicle inline;
- select requested services and estimated duration;
- branch/day/time collision warnings;
- walk-in quick add;
- live queue board with waiting/checked-in ordering;
- convert checked-in appointment/walk-in to job order without duplicate records;
- dashboard widgets for today, waiting, late, upcoming.

**Acceptance**
- walk-in to queued job should require minimal taps;
- timezone correctness for Asia/Manila and arbitrary branch timezone;
- concurrent check-in cannot create duplicate job orders.

**Codex prompt**
```text
Implement Phase 04 appointments and walk-in queue, including safe conversion to job orders and concurrency protection. Optimize for mobile front-desk use. Stop before full job execution features.
```

---

## Phase 05 — Job orders, technicians, inspections and photos
**Goal:** run the actual work in the service bay.

**Build**
- job order list/detail and controlled status transitions;
- assign staff/technicians;
- job line items with service snapshot name, quantity, unit price, discount and totals;
- odometer-in / odometer-out;
- promised completion time;
- customer concerns and internal notes separated;
- checklist/inspection system;
- private before/after photos in Supabase Storage with signed access;
- status timeline/audit events;
- printable/mobile job sheet.

**Acceptance**
- technician permissions are narrower than manager/owner;
- private photos are not public URLs;
- totals use deterministic integer arithmetic.

**Codex prompt**
```text
Implement Phase 05 job-order execution, staff assignment, inspections, private photos, line-item snapshots, status machine and audit trail. Add authorization tests and storage policy checks.
```

---

## Phase 06 — Estimates, invoices and payments
**Goal:** turn jobs into approved work and recorded revenue.

**Build**
- estimate/quotation generated from job items;
- approve/decline flow with immutable approval snapshot;
- invoice numbering per organization/branch with concurrency-safe sequence;
- discounts, taxes/configuration, deposits and balance due;
- record cash, GCash, Maya, bank transfer, card/manual methods;
- payment status + receipt/reference fields;
- partial payments and refunds/voids with permissions;
- printable/PDF-friendly invoice/receipt view;
- daily cashier summary.

**Important**
Recording GCash/Maya manually is not the same as payment-provider integration. Label it correctly until a provider phase is implemented.

**Codex prompt**
```text
Implement Phase 06 estimates, invoices, partial payments, receipts, payment auditability and concurrency-safe invoice numbering. Do not fake direct GCash/Maya integrations; support them as manual methods only unless an adapter exists.
```

---

## Phase 07 — Inventory and consumables
**Goal:** help shops control stock without becoming an ERP.

**Build**
- inventory items, SKU, unit, cost, sell price, reorder level;
- stock-in, adjustment, consumption, return, transfer-ready model;
- append-only inventory movement ledger;
- optional service recipe/consumable mapping;
- deduct consumables on job completion using explicit rules;
- low-stock dashboard and inventory valuation report;
- branch-specific stock quantities.

**Acceptance**
- never directly mutate quantity without a movement ledger;
- retries cannot double-consume inventory.

**Codex prompt**
```text
Implement Phase 07 inventory using an append-only movement ledger, low-stock reporting and idempotent job consumption. Keep the design simple and multi-branch safe.
```

---

## Phase 08 — Service history, maintenance reminders and retention CRM
**Goal:** make KarKR drive repeat business.

**Build**
- vehicle service-history timeline derived from completed jobs;
- next-service date/km recommendations configurable by service;
- reminder rules and queued reminder records;
- email adapter first; SMS adapter interface but no fake delivery;
- opt-in/opt-out and communication preferences;
- reminder dashboard, due soon/overdue lists;
- campaigns limited to consented customers;
- simple loyalty/membership architecture: points or wash package can be feature-flagged if scope grows.

**Codex prompt**
```text
Implement Phase 08 service history and consent-aware maintenance reminders. Build provider adapters and a retry-safe reminder queue. Do not send via unconfigured providers.
```

---

## Phase 09 — Staff RBAC and multi-branch operations
**Goal:** support serious businesses with 2+ branches.

**Build**
- staff invite flow;
- roles owner/manager/advisor/technician/cashier/viewer;
- optional branch assignments;
- permission matrix enforced server-side and in RLS where possible;
- owner transfer safeguards;
- deactivate staff/session access behavior;
- cross-branch owner dashboard;
- branch-specific settings, operating hours and service availability.

**Codex prompt**
```text
Implement Phase 09 multi-branch staff administration and a documented permission matrix. Add hostile authorization tests for every role and ensure deactivation revokes effective access.
```

---

## Phase 10 — Public shop website and online booking
**Goal:** every paying shop gets a shareable customer-facing presence.

**Build**
- public route `/shop/[slug]`;
- logo, hero, description, address/map link, hours, public phone/social links, services, gallery;
- public booking request with branch, vehicle, service, preferred time;
- anti-spam/rate limiting architecture;
- booking confirmation token page without account requirement;
- SEO metadata/Open Graph/sitemap/public structured data where appropriate;
- public/private data contract explicitly documented.

**Security**
Never expose internal customer IDs, notes, payments, staff private details, or private job photos.

**Codex prompt**
```text
Implement Phase 10 public shop pages and secure online booking requests. Audit exactly which fields are anonymous-readable and add public data-leak tests.
```

---

## Phase 11 — Reporting and owner analytics
**Goal:** demonstrate ROI to subscribers.

**Build**
- daily/monthly gross sales, payments received, outstanding balances;
- jobs and average ticket;
- service/category revenue;
- customer repeat rate and new vs returning;
- technician workload (avoid misleading productivity scoring initially);
- branch comparisons;
- export CSV with authorization;
- date presets and timezone-safe aggregation.

**Codex prompt**
```text
Implement Phase 11 owner reporting with correct centavo arithmetic and timezone-aware SQL. Add reconciliation tests so dashboard totals match source transactions.
```

---

## Phase 12 — SaaS plans, subscriptions, entitlements and billing
**Goal:** monetize KarKR safely.

**Suggested initial plans**
- Free
- Starter
- Business
- Pro
- Multi-Branch / custom

**Build**
- plan catalog + feature limits separated from UI;
- organization subscription state;
- entitlement service controlling branches, staff, public page, reminders, advanced reports, storage, etc.;
- Stripe adapter + Checkout/Customer Portal if Stripe is selected;
- verified webhook signatures, idempotent event ledger, reconciliation job;
- trials, grace period, cancellation, past-due behavior;
- billing page and upgrade/downgrade UX;
- no irreversible data deletion simply because a subscription downgrades.

**Codex prompt**
```text
Implement Phase 12 SaaS billing and entitlements with Stripe behind a provider boundary. Treat webhooks as untrusted, verify signatures, make processing idempotent, add reconciliation, and never grant features based only on client state.
```

---

## Phase 13 — Customer My Garage
**Goal:** add the consumer side without compromising shop data.

**Build**
- consumer account/profile;
- claim/add vehicles with a safe ownership verification flow;
- My Garage vehicle cards;
- consumer-visible service history from participating shops;
- owner-approved/shared documents and receipts;
- registration, insurance, tire, battery and maintenance reminders;
- QR/deep-link design for a vehicle profile without exposing sensitive data;
- privacy controls to disconnect a shop or hide history entries where legally/operationally appropriate.

**Codex prompt**
```text
Implement Phase 13 My Garage as a separate consumer authorization domain. Do not reuse shop membership as consumer access. Threat-model vehicle claiming, QR sharing and service-history privacy before implementation.
```

---

## Phase 14 — Marketplace / Find Auto Care
**Goal:** convert public shops into a discovery network only after enough supply exists.

**Build**
- public search by location, service, vehicle type, open/available indicators where reliable;
- verified shop badge process architecture;
- shop profiles generated from Phase 10;
- lead/booking attribution;
- sponsored placement model clearly labeled if later monetized;
- ratings only if an anti-abuse and verified-service strategy is implemented;
- no misleading “availability” if real capacity is not synchronized.

**Codex prompt**
```text
Implement Phase 14 marketplace discovery using only explicitly public shop data. Add location/service search and lead attribution. Do not add ratings unless verified-service anti-abuse controls are implemented in the same phase.
```

---

## Phase 15 — KarKR AI Service Advisor
**Goal:** use AI for useful assisted workflows, never as an autonomous mechanic.

**Build**
- AI provider interface using server-only keys;
- turn customer concern text into structured draft notes/categories;
- draft estimate explanation/customer-friendly summary from already-selected job items;
- summarize inspection findings from structured technician input;
- generate follow-up/reminder copy;
- label AI output as draft; require human review before customer-facing send or work authorization;
- redact/minimize sensitive data sent to provider;
- usage/cost quotas tied to entitlements;
- prompt/version logging without storing unnecessary customer secrets.

**Do not**
- diagnose safety-critical failures as facts;
- auto-authorize repairs;
- auto-charge customers;
- fabricate inspection findings.

**Codex prompt**
```text
Implement Phase 15 KarKR AI Service Advisor as human-reviewed drafting assistance. Add privacy minimization, usage limits, provider abstraction, failure handling and explicit non-autonomous safety boundaries.
```

---

## Phase 16 — Notifications and operational automations
**Goal:** reduce missed appointments and manual follow-ups.

**Build**
- notification event/outbox architecture;
- email + configured SMS channels;
- appointment confirmation/reminder;
- vehicle ready notification;
- estimate awaiting approval;
- overdue balance reminder with sensible safeguards;
- maintenance due reminder;
- retry/backoff/dead-letter handling;
- templates per organization while preserving mandatory compliance text.

**Codex prompt**
```text
Implement Phase 16 event-driven notification outbox, templates, retry/backoff and provider adapters. Make every send idempotent and consent-aware where marketing rules apply.
```

---

## Phase 17 — PWA, mobile workflow and limited offline resilience
**Goal:** make the web app feel excellent on phones before building native apps.

**Build**
- installable PWA metadata/icons;
- mobile bottom navigation based on role;
- camera-friendly photo capture;
- touch-friendly queue/job workflows;
- network/offline status;
- safe retry for explicitly supported drafts/actions;
- never cache sensitive pages broadly in a shared/offline cache;
- performance budgets and image optimization.

**Codex prompt**
```text
Implement Phase 17 mobile/PWA improvements with a privacy-safe caching strategy. Prioritize queue, job, camera and payment-recording workflows at 360–430px widths.
```

---

## Phase 18 — Security, privacy and reliability hardening
**Goal:** prepare for production customers.

**Build/check**
- full RLS test matrix with two tenants and all roles;
- rate limiting for auth-sensitive/public endpoints;
- webhook replay tests;
- audit log coverage;
- dependency/security review;
- CSP/security headers where compatible;
- file upload type/size validation and malware-scanning integration point;
- privacy export/delete workflow design with accounting/legal retention exceptions;
- backup + restore runbook;
- error monitoring and structured logs;
- database indexes from measured query patterns;
- concurrency tests for booking/job/invoice/inventory/payment paths.

**Codex prompt**
```text
Implement Phase 18 as a hostile production-readiness review. Find and fix tenant leakage, privilege escalation, unsafe uploads, replay/idempotency, race conditions and privacy gaps. Produce SECURITY_REVIEW.md with unresolved risks.
```

---

## Phase 19 — Production launch and operations
**Goal:** safely onboard the first real shops.

**Build**
- production environment checklist;
- custom domain, email domain, storage limits;
- observability dashboards/alerts;
- seed removal and demo-data isolation;
- support/admin tooling with strict privileged-access audit logs;
- plan/usage dashboards;
- terms/privacy placeholders replaced by reviewed business/legal content;
- onboarding tutorial and sample services;
- disaster recovery drill;
- launch analytics funnel: signup -> org -> services -> first customer -> first job -> first paid invoice.

**Codex prompt**
```text
Implement Phase 19 launch readiness. Remove development-only shortcuts, validate deployment/runtime config, add operational runbooks and instrument the activation funnel. Do not claim legal/tax compliance without reviewed requirements.
```

---

## Phase 20 — Native mobile app (optional, after product-market proof)
**Goal:** provide a dedicated staff/consumer mobile experience without forking business rules.

**Recommended direction**
- Expo/React Native client;
- same Supabase backend and authorization model;
- shared generated database/domain types where practical;
- mobile staff features first: queue, assigned jobs, inspections, camera uploads, notifications;
- consumer My Garage second;
- biometric convenience must not replace server authorization.

**Codex prompt**
```text
Design and implement Phase 20 as a separate Expo app/package while preserving the existing backend and RLS. Reuse domain contracts, do not duplicate authorization logic, and begin with staff queue/job/photo workflows.
```

---

# Recommended stopping points for launch
- **Pilot MVP:** Phases 00–06
- **Strong paid SaaS:** Phases 00–12
- **Network product:** through Phase 14
- **AI/automation differentiation:** through Phase 16
- **Production hardening:** Phase 18 before broad launch

Do not wait for all 20 phases before speaking to real shop owners. Pilot after Phase 06 with 3–5 shops and adjust workflows before building deeper inventory/consumer/marketplace features.
