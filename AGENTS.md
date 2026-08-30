# ServiceCore Codex Operating Guide

> Placeholder project name: **ServiceCore**
>
> Suggested repository/folder name: `servicecore`
>
> `ServiceCore` is an internal working name only. Customer-facing verticals keep their own brands, such as **KarKR** for automotive.

This repository is intended to be developed phase-by-phase with Codex while remaining understandable and maintainable by a single developer.

---

## 1. Product mission

ServiceCore is a Philippines-first, multi-industry operating platform for service businesses.

The platform should provide reusable business capabilities such as:

- organizations and branches;
- customers and CRM;
- staff, roles, and permissions;
- services and packages;
- scheduling and appointments;
- work/job processing;
- inventory and product usage;
- payments and financial records;
- notifications and customer communication;
- reports and analytics;
- public business pages;
- subscriptions and feature entitlements.

The platform must stay simple enough for small businesses while being structurally capable of supporting multi-branch and enterprise operators.

### Current first vertical

**KarKR** is the first active vertical and should continue to be developed first.

KarKR serves:

- car wash;
- detailing;
- auto care;
- maintenance;
- repair/service shops;
- related automotive service businesses.

KarKR should use the shared ServiceCore platform while keeping automotive-specific features inside an automotive module.

### Future verticals

The architecture should allow future verticals such as:

- salon and barber;
- spa and wellness;
- facial and beauty businesses;
- pet grooming;
- cleaning and home services;
- aircon/appliance/field services;
- laundry and specialty cleaning;
- hospitality/resorts;
- event and rental services.

Do **not** implement a future vertical merely because the architecture allows it. Build only what the current roadmap requires.

---

## 2. Core architectural principle

### The shared core must not become automotive-specific

The most important architecture rule is:

> **Core code must represent reusable service-business concepts. Automotive concepts belong in the automotive vertical.**

Good examples:

```text
core.organizations
core.branches
core.memberships
core.customers
core.staff
core.services
core.appointments
core.payments
core.products
core.inventory
core.notifications
core.audit_events

automotive.vehicles
automotive.vehicle_profiles
automotive.inspections
automotive.job_orders
automotive.job_order_items
automotive.maintenance_records
automotive.vehicle_service_history
```

Avoid designs such as:

```text
core.customer_vehicles
core.car_appointments
core.detailing_services
core.vehicle_job_status
```

Do not force salon, spa, resort, pet, or field-service concepts into automotive naming.

---

## 3. Architecture style: modular monolith first

ServiceCore should remain a **modular monolith** unless a future scale requirement clearly justifies separation.

Do not introduce microservices only for architectural purity.

Prefer:

```text
app/
modules/
  core/
  automotive/
  beauty/
  hospitality/
  field-service/
shared/
```

or an equivalent feature-oriented structure already established by the repository.

Benefits required from this approach:

- one main deployment model;
- one authentication strategy;
- one database platform;
- clear module boundaries;
- easy local debugging;
- easy refactoring by one developer;
- shared components without unnecessary distributed-system complexity.

Codex must not create a new service, queue, worker, repository, package, or abstraction when the same goal can be achieved cleanly inside the current application.

---

## 4. Core versus vertical ownership

Before adding a new entity, Codex must determine whether it belongs to the shared core or an industry module.

### Shared core candidates

A feature usually belongs to core when it is reasonably reusable by several service industries:

- organizations;
- branches/locations;
- memberships;
- users/profile references;
- customers;
- staff;
- roles and permissions;
- services;
- service categories;
- packages;
- appointments/scheduling;
- products;
- basic inventory;
- payments;
- invoices/receipts;
- discounts;
- promotions;
- notifications;
- customer notes;
- CRM activities;
- files/attachments;
- audit events;
- subscriptions;
- feature entitlements;
- analytics primitives.

### Vertical-specific candidates

A feature belongs to a vertical when its business meaning is specific to that industry.

Automotive examples:

- vehicles;
- plate numbers;
- VIN;
- mileage/odometer;
- inspections;
- automotive job orders;
- vehicle service history;
- parts fitment;
- automotive maintenance schedules.

Beauty examples:

- treatment records;
- therapist/stylist specialization;
- chairs/stations;
- treatment rooms;
- service commissions;
- beauty preferences.

Hospitality examples:

- resorts;
- accommodation inventory;
- stay reservations;
- check-in/check-out;
- guest capacity;
- resort amenities.

Field-service examples:

- service addresses;
- dispatch;
- technician travel status;
- proof of service;
- before/after site photos.

Do not use a giant generic JSON entity model just to make everything technically reusable.

Prefer explicit, typed domain models that are easy to understand.

---

## 5. Business engines

ServiceCore may eventually support multiple reusable operational engines.

Potential engines include:

1. **Appointment Engine**
   - salon;
   - spa;
   - barber;
   - detailing;
   - pet grooming.

2. **Work / Job Order Engine**
   - automotive;
   - appliance repair;
   - specialty cleaning;
   - repair businesses.

3. **Reservation Engine**
   - resorts;
   - rentals;
   - resource-based businesses.

4. **Field Service Engine**
   - aircon service;
   - cleaning;
   - pest control;
   - pool maintenance;
   - on-site repair.

5. **Lead / Project Engine**
   - photography;
   - events;
   - quotation-heavy service businesses.

These are architectural directions, not permission to build all engines now.

**KarKR remains the priority.**

Only generalize an engine when there is a demonstrated shared requirement or an approved roadmap task.

---

## 6. Multi-tenant model

Tenant isolation is non-negotiable.

### Organization

`organization_id` represents the business account/tenant.

Every business-owned record must be scoped to an organization either:

- directly through `organization_id`; or
- through an unambiguous parent whose organization ownership is enforced.

Prefer direct `organization_id` on frequently queried business tables when it improves clarity, security, and performance.

### Branch/location

Use `branch_id` for operational location where applicable.

Do not assume every organization has only one branch.

Do not assume every future vertical calls a branch a "branch" in the UI. The internal domain may stay generic while display terminology is configurable.

### Tenant safety

Never:

- trust `organization_id` received from the browser;
- authorize from UI state alone;
- weaken RLS to solve a query problem;
- expose one tenant's data to another tenant;
- use a service-role client in browser code.

The authenticated user, active membership, server authorization, and RLS must agree.

---

## 7. Roles and permissions

Core authorization concepts should remain generic.

Prefer core roles such as:

- owner;
- admin/manager;
- staff;
- customer;
- partner/referrer where required.

Industry job titles are not necessarily system roles.

Examples of job titles/specializations:

- technician;
- detailer;
- washer;
- stylist;
- therapist;
- dermtech;
- groomer;
- receptionist;
- cashier.

Do not create a global authorization role for every job title unless permissions genuinely require it.

Permission checks must be enforced on the server and in RLS where applicable.

UI hiding is only a presentation convenience, never authorization.

---

## 8. Industry configuration

Industry differences should be introduced through clear configuration where practical.

Configuration may include:

```ts
type IndustryConfig = {
  key: string;
  terminology: {
    customer: string;
    booking: string;
    staff: string;
    location: string;
  };
  features: {
    vehicles?: boolean;
    appointments?: boolean;
    jobOrders?: boolean;
    inventory?: boolean;
    commissions?: boolean;
    reservations?: boolean;
  };
};
```

Do not turn configuration into an untyped catch-all object.

Use:

- TypeScript types;
- Zod validation where configuration crosses runtime boundaries;
- explicit defaults;
- predictable feature checks.

Do not scatter checks such as:

```ts
if (industry === "automotive")
```

through dozens of components if the behavior can live inside the automotive module or a typed industry configuration.

---

## 9. Feature flags and entitlements

Use a centralized feature/entitlement mechanism.

Features may vary because of:

- industry;
- subscription plan;
- organization settings;
- staged rollout.

Do not hard-code plan behavior throughout UI files.

Prefer:

```text
feature catalog
      ↓
organization subscription
      ↓
entitlements
      ↓
server authorization
      ↓
UI presentation
```

Feature flags must never bypass permission or tenant checks.

---

## 10. Non-negotiable engineering rules

1. **Tenant isolation first.**
   Every business-owned row must be organization-scoped directly or through an unambiguous parent. Never weaken RLS to make a feature work.

2. **Never expose secrets.**
   `SUPABASE_SERVICE_ROLE_KEY`, payment provider secrets, OpenAI keys, SMS keys, webhook secrets, OAuth secrets, and private API tokens are server-only.

3. **Append-only migrations.**
   Never rewrite an already-applied migration. Add a new migration.

4. **Server Components by default.**
   Use Client Components only for browser state, event handlers, client-only libraries, or browser APIs.

5. **Validate all writes.**
   Use Zod at server boundaries. Never trust browser-provided organization, branch, role, price, total, status, or entitlement values.

6. **Authorization is not UI hiding.**
   Enforce access in SQL/RLS and server actions/route handlers.

7. **Money uses integer minor units.**
   PHP values use integer centavos, normally `bigint` in PostgreSQL. Never use JavaScript floating point for financial calculations.

8. **Audit important changes.**
   Status changes, estimate approval, invoice/payment changes, permission changes, destructive changes, and subscription changes should produce audit events when the relevant audit infrastructure exists.

9. **Idempotency.**
   Webhooks, notifications, scheduled jobs, imports, and payment synchronization must be safe to retry.

10. **No premature integrations.**
    Keep external providers behind small interfaces until the roadmap phase activates them.

11. **No premature abstraction.**
    Prefer straightforward code over a clever generalized framework that only has one current consumer.

12. **No unnecessary rewrites.**
    Preserve working KarKR behavior while migrating toward ServiceCore architecture incrementally.

---

## 11. Code readability and manual debugging

This project is maintained by a solo developer. Generated code must remain easy to inspect, trace, and debug manually.

### Required readability rules

Codex must:

- use descriptive variable and function names;
- use descriptive file names;
- keep functions focused;
- prefer explicit control flow over clever one-liners;
- avoid unnecessary nested ternaries;
- avoid deeply nested callback chains;
- avoid unnecessary metaprogramming;
- avoid hidden side effects;
- keep business rules in named functions;
- extract meaningful constants instead of repeating magic values;
- add short comments where a business rule would not be obvious;
- avoid comments that merely repeat the code;
- keep domain terms consistent;
- keep data transformations easy to trace;
- handle errors explicitly;
- log only useful non-sensitive diagnostic information;
- avoid generic utility functions when a domain-specific name would be clearer.

Bad:

```ts
const x = a?.b?.filter((i) => i.s === 1).reduce((p, c) => p + c.t, 0) ?? 0;
```

Prefer:

```ts
const activeItems = orderItems.filter((item) => item.status === "active");
const activeItemsTotalCentavos = calculateOrderItemsTotal(activeItems);
```

### Debuggable business logic

Important business operations should be traceable in this order:

```text
UI action
→ validated request
→ authorization
→ domain/service operation
→ database operation
→ result
→ UI state/redirect
```

Avoid placing critical business calculations directly inside large JSX expressions.

---

## 12. Stable component and element IDs

Every generated UI must be easy to identify in browser DevTools, automated tests, screenshots, and debugging sessions.

### Required ID rule

Every meaningful rendered component must have a stable, semantic DOM `id`.

This includes at minimum:

- page roots;
- layout roots;
- major page sections;
- reusable cards;
- forms;
- dialogs/modals;
- drawers;
- tables;
- filters;
- search controls;
- tabs;
- navigation containers;
- major dashboard widgets;
- buttons;
- inputs;
- selects;
- textareas;
- checkboxes;
- radios;
- date/time controls;
- menus;
- important status controls.

### ID naming

Use deterministic `kebab-case`.

Examples:

```text
customers-page
customers-page-header
customers-search-input
customers-table
customer-create-button
customer-form-dialog
customer-first-name-input
customer-save-button

vehicles-page
vehicle-details-card
vehicle-plate-number-input

job-orders-page
job-order-status-select
job-order-payment-button
```

For repeated records, include the stable record identifier when appropriate:

```tsx
id={`customer-row-${customer.id}`}
id={`job-order-card-${jobOrder.id}`}
```

Do not use random values, array indexes, timestamps, or generated UUIDs merely to create DOM IDs.

### Reusable component rule

Reusable visual components should accept an `id` prop when practical and pass it to their root DOM element.

Example:

```tsx
type CustomerCardProps = {
  id: string;
  customer: Customer;
};

export function CustomerCard({ id, customer }: CustomerCardProps) {
  return (
    <article id={id}>
      {/* ... */}
    </article>
  );
}
```

If a component renders multiple important interactive elements, derive clear child IDs from the supplied root ID:

```tsx
<button id={`${id}-edit-button`}>Edit</button>
```

All IDs rendered on the same page must be unique.

### IDs are not React keys

Do not confuse DOM `id` with React `key`.

Use each for its intended purpose.

---

## 13. Component design rules

- Avoid giant page components.
- Extract feature components when the extraction makes the page easier to read.
- Do not create tiny wrapper components that add no meaning.
- Prefer composition over deeply configurable "do everything" components.
- Reuse existing shared UI before adding new UI primitives.
- Do not create a second table, modal, form, toast, or button system when the repository already has one.
- Keep component props explicit and typed.
- Avoid passing large untyped objects through many layers.
- Prefer server-fetched data for initial page rendering where practical.
- Keep browser-only state local unless several features genuinely share it.

---

## 14. UI/UX rules

- Mobile-first.
- Desktop must also be fully usable.
- Important operational actions should take as few steps as practical.
- Use clear terminology for the active industry.
- KarKR should continue to use familiar automotive terms such as:
  - Customers;
  - Vehicles;
  - Queue;
  - Job Orders;
  - Services;
  - Payments.
- Future verticals may use different display terminology without changing shared domain concepts unnecessarily.
- Dashboard content should prioritize today's operational work and actionable information.
- Loading states must be visible for asynchronous operations.
- Empty states must explain what to do next.
- Errors must be understandable and actionable.
- Destructive actions must be explicit and recoverable where practical.
- Avoid horizontal overflow on normal mobile widths.
- Use accessible labels, visible focus states, semantic HTML, and sensible contrast.
- Interactive targets should remain usable on touch devices.

---

## 15. Public business pages

Public-facing business pages should be powered by shared publishing primitives where practical while remaining industry-specific in presentation.

Possible shared concepts:

- business identity;
- branch/location;
- contact information;
- operating hours;
- gallery;
- services;
- promotions;
- map/location;
- public reviews;
- booking/request CTA.

Industry modules may add specialized sections.

Do not expose internal CRM, staff-only notes, private prices, internal inventory, private customer information, or protected operational data to public pages.

---

## 16. Database conventions

- PostgreSQL/Supabase is the source of truth for persisted business data.
- Table names: `snake_case`.
- Column names: `snake_case`.
- TypeScript variables/properties: `camelCase`.
- Primary keys should follow the repository's established UUID strategy.
- Foreign keys must be explicit.
- Add indexes for real query patterns, not speculatively everywhere.
- Avoid duplicate sources of truth.
- Avoid storing derived totals unless there is a clear consistency strategy.
- Prefer explicit relational columns over opaque JSON for important searchable business data.
- JSON/JSONB is acceptable for genuinely flexible metadata, provider payloads, or versioned snapshots when justified.
- Use database constraints for invariants that the database can enforce safely.
- Use UTC timestamps in storage.
- Render dates/times using the branch timezone.
- Default branch timezone may be `Asia/Manila`, but timezone must be modeled explicitly.
- Default currency is PHP, but currency must be modeled explicitly for future expansion.

---

## 17. Supabase and RLS rules

RLS is part of the application architecture, not an optional security layer.

For every new business table:

1. determine ownership path;
2. determine tenant scope;
3. determine allowed roles;
4. define SELECT behavior;
5. define INSERT behavior;
6. define UPDATE behavior;
7. define DELETE behavior;
8. test cross-tenant denial;
9. test inactive membership denial where relevant.

Never solve an RLS problem by:

- disabling RLS;
- adding an unrestricted authenticated policy;
- moving a service-role key to the browser;
- trusting a client-provided organization ID;
- using an RPC that bypasses tenant checks without explicit justification.

Service-role operations must remain narrowly scoped server-side operations.

---

## 18. Database/RLS safety checklist

Before a phase is considered complete, verify where applicable:

- authenticated member of Org A cannot read Org B data;
- authenticated member of Org A cannot update/delete Org B data;
- staff cannot perform owner-only writes;
- anonymous users cannot access internal customer, vehicle, staff, payment, or operational data;
- public pages expose only explicitly public fields;
- service-role-only operations never execute in browser code;
- inactive/deleted memberships lose access;
- branch-restricted users cannot access unauthorized branches;
- vertical-specific records inherit the correct organization boundaries.

---

## 19. Forms and validation

- Use Zod schemas for server write boundaries.
- Reuse schemas where client validation and server validation genuinely share the same rules.
- Never treat client validation as security.
- Display field-level errors where possible.
- Preserve entered values after recoverable errors.
- Validate IDs before database operations.
- Validate status transitions.
- Validate money values as integer minor units.
- Validate organization/branch relationships on the server.
- Avoid accepting arbitrary fields from spread request objects.

Prefer explicit mutation input shapes.

---

## 20. Status and workflow rules

Do not make all industries share one hard-coded status enum.

KarKR may currently use automotive-specific states.

Future verticals may require different workflows.

Prefer:

- clear domain-specific statuses now;
- transition validation in named domain functions;
- future workflow generalization only when justified.

Do not build a drag-and-drop workflow designer until it is an approved roadmap requirement.

Do not prematurely replace working statuses with an overly generic workflow framework.

---

## 21. Services, products, and inventory

Keep these concepts distinct:

- **service** = work sold/performed;
- **product** = item sold or consumed;
- **inventory item/stock** = quantity/location state;
- **service consumption** = product quantity used while performing a service;
- **part** = automotive specialization of a product/inventory concept when appropriate.

Do not make core inventory depend on vehicles.

Automotive-specific fitment or vehicle compatibility belongs in the automotive module.

---

## 22. Payments and financial calculations

- Store PHP amounts as integer centavos.
- Never use JS floating-point arithmetic for authoritative totals.
- Recalculate authoritative totals server-side.
- Do not trust client totals.
- Payment provider payloads must be verified.
- Webhook handling must be idempotent.
- Never log full sensitive payment payloads unnecessarily.
- Keep payment providers behind a clear boundary.
- Do not create real charges in tests.
- Do not change live payment behavior without explicit approval.

---

## 23. External providers

External services may include:

- payment processors;
- email;
- SMS;
- messaging;
- AI;
- maps;
- storage;
- analytics.

Keep provider-specific details outside domain code where practical.

Good:

```text
domain operation
→ notification interface
→ provider adapter
```

Avoid making core business rules depend directly on a provider SDK.

Do not add a provider just because it may be useful later.

---

## 24. AI readiness

The platform may later include AI for:

- onboarding suggestions;
- reporting explanations;
- customer retention recommendations;
- service suggestions;
- operational summaries;
- workflow assistance.

Do not make AI a required dependency for normal business operations.

Core operations must work when AI is unavailable.

Never allow AI output to:

- bypass authorization;
- directly perform destructive changes without validation;
- invent financial values used as authoritative totals;
- expose another tenant's information.

AI integration should consume clearly scoped, permission-checked data.

---

## 25. PrivateResortPH boundary

PrivateResortPH may become a future hospitality vertical or may reuse ServiceCore concepts later.

However:

- do not couple this repository directly to the existing PrivateResortPH production database unless explicitly requested;
- do not migrate PrivateResortPH automatically;
- do not break or modify PrivateResortPH while developing ServiceCore/KarKR;
- design reusable concepts so a future hospitality adapter/migration is possible;
- treat any future PrivateResortPH integration as a separate migration project with its own review and rollback plan.

---

## 26. Testing strategy

Generated code is not complete merely because it compiles.

At minimum, run the repository's available checks:

```bash
npm run lint
npm run typecheck
npm run build
```

Run relevant unit/integration tests if present.

For important workflows, add or update tests when practical.

Priority test areas:

- tenant isolation;
- role authorization;
- organization and branch access;
- customer CRUD;
- vehicle CRUD;
- appointments;
- job orders;
- status transitions;
- money calculations;
- payment state;
- public/private data boundaries;
- feature entitlements.

When Supabase local tooling is configured, use a disposable/local database for migration and RLS validation.

Never run destructive validation against production data.

---

## 27. Seed data

Use realistic development seed data to expose UX and query problems.

Seed data should:

- clearly be non-production data;
- cover multiple organizations;
- cover multiple branches;
- include multiple roles;
- include realistic customers;
- include automotive vehicles for KarKR;
- include realistic service and product records;
- exercise empty, normal, and edge states where practical.

Seed scripts must be safe and clearly separated from production operations.

---

## 28. Required workflow for every Codex task

For every non-trivial task:

1. Read `AGENTS.md`.
2. Read relevant architecture/phase documentation.
3. Inspect the existing repository before editing.
4. Search for existing implementations to reuse.
5. Identify whether the change belongs to core or a vertical module.
6. Identify database/RLS implications.
7. State a concise implementation plan.
8. Implement the smallest coherent scope.
9. Keep code manually understandable.
10. Add stable semantic DOM IDs to generated UI.
11. Add/update migrations, validation, tests, documentation, and seed data where relevant.
12. Run available validation.
13. Review the diff for unnecessary changes.
14. Report exactly what changed, what was tested, and what remains risky.

Do not start a broad refactor merely because a new architecture would look cleaner.

---

## 29. Reuse-before-create rule

Before adding a new:

- component;
- hook;
- helper;
- schema;
- domain type;
- query;
- table;
- server action;
- route handler;
- repository;
- service;
- layout;
- form pattern;
- modal;
- table abstraction;

search the repository for an existing equivalent.

Reuse or extend existing code when doing so remains clear.

Do not force reuse when it creates confusing coupling.

The goal is **less duplication without sacrificing readability**.

---

## 30. Dependency policy

Before installing a new package:

1. confirm the problem cannot be solved cleanly with the current stack;
2. check whether an installed package already solves it;
3. prefer established, maintained packages;
4. avoid overlapping libraries;
5. explain why the dependency is needed.

Do not change major frameworks or architectural libraries as part of an unrelated feature.

Do not upgrade core dependencies casually.

---

## 31. Git and checkpoint rules

Create clean checkpoints after coherent phases.

Suggested commit format:

```text
phase-XX: short description
```

For non-phase work:

```text
feat: ...
fix: ...
refactor: ...
test: ...
docs: ...
```

Do not:

```bash
git reset --hard
git clean -fd
git push --force
```

unless explicitly requested and the consequences are understood.

Do not commit:

- `.env` files;
- secrets;
- build artifacts;
- temporary debug dumps;
- credentials.

---

## 32. Stop and request approval before

Codex must not autonomously perform:

- destructive database operations;
- table drops;
- destructive column changes;
- production data deletion;
- production deployment;
- authentication architecture replacement;
- RLS disabling;
- bulk role changes;
- live payment provider changes;
- real payment charges;
- production environment-variable changes;
- secret rotation;
- DNS changes;
- destructive storage changes;
- force-pushing Git history;
- replacing major frameworks/libraries;
- introducing microservices;
- a large repository-wide rewrite;
- migrating PrivateResortPH production data;
- irreversible scripts.

When such work appears necessary, explain:

- why;
- affected systems/data;
- safest migration approach;
- rollback approach;
- what requires human approval.

---

## 33. Required final Codex report

After every implementation task, report:

### Changed

- files changed;
- modules affected;
- user-visible behavior;
- whether changes are core or vertical-specific.

### Database

- migrations added;
- SQL generated;
- whether SQL was executed;
- RLS changes;
- data migration implications.

### Validation

List the exact commands/tests actually run and their results.

Example:

```text
npm run lint — passed
npm run typecheck — passed
npm run build — passed
```

Do not claim a test passed if it was not run.

### Risks / follow-up

Report:

- known limitations;
- untested areas;
- manual checks recommended;
- future cleanup only when genuinely needed.

---

## 34. Solo-developer optimization rules

Because this platform is maintained by one primary developer:

- prefer one clear implementation over multiple competing patterns;
- minimize operational infrastructure;
- avoid premature microservices;
- avoid excessive abstraction layers;
- automate repetitive validation;
- centralize shared business rules;
- keep modules independently understandable;
- keep documentation close to the code;
- make errors searchable;
- use stable component/element IDs;
- use predictable file structures;
- build one vertical deeply before adding another;
- do not add a new industry solely because the core could support it.

Developer velocity comes from reuse, clarity, and controlled scope—not from generating the largest amount of code.

---

## 35. Current development priority

Until explicitly changed, the priority order is:

```text
1. Preserve completed KarKR functionality
2. Establish clean ServiceCore boundaries
3. Continue KarKR automotive functionality
4. Validate with real automotive business workflows
5. Extract genuinely reusable core capabilities
6. Add another vertical only after the core is proven
7. Consider PrivateResortPH integration separately
```

Do not stop useful KarKR development to build speculative support for every future industry.

---

## 36. Documentation

Keep `AGENTS.md` focused on operating rules.

As the repository grows, maintain deeper documentation such as:

```text
docs/
  ARCHITECTURE.md
  CORE_DOMAIN.md
  MULTI_TENANCY.md
  ROLES_AND_PERMISSIONS.md
  INDUSTRY_MODULES.md
  AUTOMOTIVE.md
  WORKFLOWS.md
  DATABASE.md
  UI_CONVENTIONS.md
  TESTING.md
  CODEX_PHASES.md
  DEPLOYMENT.md
```

When architecture changes materially, update the relevant documentation in the same task.

---

## 37. Final principle

ServiceCore should become a reusable service-business operating platform **without turning into an over-engineered generic ERP**.

For every implementation decision, prioritize:

```text
Security
→ Data isolation
→ Correct business behavior
→ Readability/debuggability
→ Reuse
→ Mobile usability
→ Performance
→ Future extensibility
```

When there is a choice between:

- a clever abstraction and obvious code;
- future speculation and a current business requirement;
- a broad rewrite and a safe incremental change;

prefer the approach that a single developer can understand, debug, test, and maintain confidently.
