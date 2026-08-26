# KarKR Codex Operating Guide

This repository is intended to be developed phase-by-phase with Codex.

## Product mission
KarKR is a Philippines-first operating system for car wash, detailing, auto-care, maintenance, and service businesses. It must stay simple enough for small shops while scaling to multi-branch operators and a future consumer garage/marketplace.

## Non-negotiable engineering rules
1. **Tenant isolation first.** Every business-owned row must be scoped to an `organization_id` directly or through an unambiguous parent. Never weaken RLS to make a feature work.
2. **Never expose secrets.** `SUPABASE_SERVICE_ROLE_KEY`, payment provider secrets, OpenAI keys, SMS keys, and webhook secrets are server-only.
3. **Append-only migrations.** Never rewrite an already-applied migration. Add a new migration.
4. **Server Components by default.** Use Client Components only for browser state, event handlers, or browser APIs.
5. **Validate all writes.** Use Zod at server boundaries. Do not trust browser values for organization, role, price, totals, status, or entitlements.
6. **Authorization is not UI hiding.** Enforce access in SQL/RLS and server actions/route handlers.
7. **Money uses integer centavos.** Store PHP amounts as `bigint` centavos. Never use JS floating point for financial calculations.
8. **Audit important changes.** Job status, estimate approval, invoice/payment changes, role changes, and subscription changes must eventually produce audit events.
9. **Idempotency.** Webhooks, notifications, scheduled jobs, and payment sync must be safe to retry.
10. **No premature integrations.** Keep providers behind interfaces until the roadmap phase that activates them.

## UX rules
- Mobile-first; shop staff often operate from a phone.
- Fast workflows: a walk-in should become a job in a few taps.
- Use clear automotive language: Customers, Vehicles, Queue, Job Orders, Services, Payments.
- Dashboard must prioritize today's work, queue, unpaid balances, and quick actions.
- Keep destructive actions explicit and recoverable when practical.
- Accessibility: keyboard navigation, visible focus, semantic controls, labels, sensible contrast.

## Required workflow for every Codex phase
1. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and the target phase in `docs/CODEX_PHASES.md`.
2. Inspect the current repository before changing code.
3. State a concise implementation plan in the Codex session.
4. Implement only the phase scope plus necessary bug fixes.
5. Add/update migrations, validation, tests, docs, and seed data where relevant.
6. Run: `npm run lint`, `npm run typecheck`, and `npm run build`.
7. If Supabase local tooling is configured, also reset the local DB and run SQL/RLS tests.
8. Report: files changed, migrations added, tests run, risks, and next phase.

## Database/RLS safety checklist
Before a phase is considered complete:
- authenticated member of Org A cannot read Org B data;
- staff role cannot perform owner-only writes;
- anon cannot see internal customer/vehicle/payment data;
- public booking pages expose only explicitly public fields;
- service-role-only operations are never invoked from the browser;
- deleted/inactive organization memberships immediately lose access.

## Coding conventions
- TypeScript strict mode.
- Prefer small feature-oriented modules.
- Avoid `any`; if unavoidable, document why.
- Use named domain types and Zod schemas.
- Avoid giant page components; extract feature components.
- Keep DB table names snake_case and TypeScript variables camelCase.
- Use UTC timestamps in DB; render in branch timezone.
- Philippine default timezone: `Asia/Manila`, but store timezone per branch.
- Default currency: PHP, but model currency explicitly for future expansion.

## Git/checkpoint recommendation
Create a clean commit after each completed phase. Suggested prefix: `phase-XX:`.
