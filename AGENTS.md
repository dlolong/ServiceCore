# Developer-Only Development Workflow

ServiceCore/KarKR is developed using a **single Developer Agent**.

Do not spawn Project Manager, QA, Reviewer, Backend, Frontend, or other sub-agents.

The Developer Agent owns the complete engineering workflow:

```text
Understand
↓
Inspect
↓
Plan
↓
Implement
↓
Self-Review
↓
Test
↓
Fix
↓
Validate
↓
Report
```

The goal is to keep development efficient for a solo-developer project while maintaining strong engineering, security, testing, and quality standards.

---

# 1. Developer Agent

The Developer Agent owns:

* phase understanding;
* repository discovery;
* scope control;
* acceptance criteria;
* implementation planning;
* architecture consistency;
* dependency ordering;
* database changes;
* application implementation;
* UI implementation;
* security review;
* RLS review;
* test creation;
* regression testing;
* self-review;
* integration;
* documentation;
* final validation;
* final implementation report.

The Developer Agent must complete the work directly instead of delegating it to additional agents.

---

# 2. Before Implementation

Before modifying code, inspect the current repository state.

At minimum, review where relevant:

```text
AGENTS.md

relevant docs/

previous phase reports

existing implementation

package.json

database schema

migrations

RLS policies

domain/services

server actions/routes

shared components

tests
```

Do not assume a requested capability is missing.

Search the repository first and determine:

1. What already exists.
2. What is partially implemented.
3. What can be reused.
4. What should be extended instead of duplicated.
5. Which modules are affected.
6. Whether database changes are required.
7. Whether RLS changes are required.
8. Whether tenant or branch isolation is affected.
9. Whether concurrency or idempotency matters.
10. Whether backward compatibility is affected.
11. Which tests already cover the behavior.

Prefer extending existing architecture over introducing parallel systems.

---

# 3. Planning

For non-trivial work, create a short bounded implementation plan before coding.

The plan should identify:

```text
Goal

Existing Capabilities

Files / Modules Affected

Database Impact

Security / RLS Impact

Business Rules

UI / UX Impact

Backward Compatibility

Testing Strategy

Acceptance Criteria
```

Do not create unnecessary planning documents for small changes.

Planning should support implementation, not become a substitute for implementation.

After planning, proceed directly with the work.

---

# 4. Implementation Rules

The Developer Agent must:

1. Read `AGENTS.md`.
2. Read the phase specification or user request completely.
3. Inspect existing patterns before creating new ones.
4. Reuse existing domain/services/components where appropriate.
5. Keep Core and vertical boundaries intact.
6. Prefer the canonical architecture over compatibility workarounds.
7. Use append-only database migrations.
8. Preserve RLS.
9. Preserve tenant isolation.
10. Preserve branch restrictions where applicable.
11. Add server-side validation.
12. Keep authoritative business logic outside UI components.
13. Keep authorization enforcement server-side/database-side.
14. Add stable semantic DOM IDs to important interactive UI.
15. Preserve backward compatibility unless explicitly instructed otherwise.
16. Handle null, empty, loading, success, and error states.
17. Prevent duplicate submissions where applicable.
18. Consider idempotency for mutations that may be retried.
19. Consider concurrency for scheduling, inventory, payments, queues, and other shared resources.
20. Add or update tests for changed behavior.
21. Run targeted validation during implementation.
22. Run final validation before declaring the work complete.

Do not create duplicate domain logic merely to make a page work.

When functionality already exists elsewhere, extract or reuse it when practical.

---

# 5. Architecture Rules

ServiceCore/NegOSu supports multiple business verticals.

Keep reusable business capabilities inside Core where appropriate and keep vertical-specific behavior inside vertical boundaries.

Avoid making shared Core functionality:

```text
automotive-specific

salon-specific

vehicle-specific

treatment-specific

or dependent on one vertical's terminology
```

Vertical adapters may translate vertical-specific concepts into Core contracts.

Prefer:

```text
Core capability

↓

stable contract

↓

vertical adapter

↓

vertical UI/workflow
```

over duplicating an entire capability per vertical.

When modifying existing architecture, inspect current conventions before introducing a new abstraction.

Do not refactor unrelated architecture unless necessary for the requested phase.

---

# 6. Database and Migration Safety

Database changes must be safe and reviewable.

Use:

```text
append-only migrations
```

Never:

* rewrite previously committed migration history;
* delete migration history to fix an issue;
* disable RLS as a shortcut;
* weaken tenant isolation;
* perform destructive production migrations automatically;
* modify production data without explicit authorization.

For schema changes, consider:

```text
existing rows

nullable transitions

defaults

foreign keys

unique constraints

indexes

tenant boundaries

branch boundaries

RLS

backward compatibility

rollback/recovery implications
```

Prefer database constraints for invariants that must always hold.

Application validation does not replace database security.

---

# 7. Security and RLS

Security boundaries must remain authoritative outside the client.

Explicitly inspect changes for:

```text
cross-tenant access

cross-branch access

unsafe IDs

missing ownership checks

missing RLS

incorrect RLS predicates

privileged RPC misuse

service-role leakage

client-authoritative permissions

exposed secrets

raw database errors

unprotected server actions/routes
```

Never trust:

```text
tenant IDs

branch IDs

user IDs

role values

prices

totals

authorization flags

workflow status
```

simply because they were supplied by the browser.

Resolve authoritative values server-side whenever possible.

---

# 8. Business Logic

Authoritative business rules must live in appropriate server/domain/database boundaries.

Avoid placing critical rules only in:

```text
React components

client hooks

form validation

disabled buttons

hidden UI elements
```

UI restrictions improve usability but are not security or business-rule enforcement.

Examples of rules that normally require server-side enforcement include:

```text
authorization

status transitions

tenant ownership

branch access

appointment conflicts

capacity

inventory quantities

payment totals

estimate authorization

queue transitions

duplicate prevention

idempotency
```

---

# 9. UI / UX Standards

The application should remain:

```text
simple

compact

professional

responsive

easy to understand

easy to operate

mobile friendly
```

Prefer interaction by clicking/tapping over requiring excessive scrolling.

Avoid unnecessary nested or multiple scrolling containers.

Important actions should be clearly visible.

Use dialogs, drawers, tabs, cards, or compact tables when they improve usability.

Keep desktop and mobile workflows consistent.

For important interactive elements, add stable semantic DOM IDs.

Examples:

```text
appointment-confirm-button

customer-search-input

job-order-save-button

booking-status-select

mobile-navigation

billing-plan-card
```

IDs should describe semantic purpose rather than visual position.

---

# 10. Self-Review

Because there is no separate QA agent, the Developer Agent must perform an explicit self-review after implementation.

Do not treat implementation completion as validation.

Inspect:

```text
git diff

new files

changed migrations

RLS

database constraints

server/domain code

actions/routes

UI

tests
```

Search specifically for:

```text
client-authoritative business rules

unsafe IDs

cross-tenant joins

missing RLS

raw DB errors

duplicate domain logic

missing null handling

N+1 queries

incorrect loading states

missing error states

duplicate submissions

race conditions

missing idempotency

incorrect totals

missing semantic DOM IDs

mobile overflow

nested scrolling

dead code

obsolete compatibility paths
```

Fix discovered problems directly before final reporting.

---

# 11. Required Verification Matrix

For meaningful feature changes, verify applicable scenarios.

At minimum consider:

```text
happy path

validation failures

authorization failures

cross-tenant behavior

cross-branch behavior

duplicate submissions

idempotency

concurrency

mobile behavior

desktop behavior

loading states

empty states

error states

backward compatibility

existing data compatibility
```

Not every task requires every category.

Use engineering judgment, but do not skip security or tenant isolation checks when the change affects protected data.

---

# 12. Testing

Add or update tests when behavior changes.

Prefer focused tests around important business behavior rather than tests that merely mirror implementation details.

Depending on the change, testing may include:

```text
unit tests

domain/service tests

database tests

RLS tests

RPC tests

integration tests

component tests

route/action tests

browser smoke tests
```

When fixing a bug, add a regression test when practical.

Never claim a test passed unless the command was actually executed successfully.

If a test could not be run, clearly report why.

---

# 13. Validation Commands

Run the validation commands supported by the repository.

For substantial phases, normally validate:

```text
lint

typecheck

tests

build
```

Also run targeted checks relevant to the changed modules.

Do not claim:

```text
PASS

build passes

tests pass

lint passes

typecheck passes
```

unless the corresponding command was actually executed successfully.

If validation fails because of an unrelated pre-existing issue, identify it clearly and distinguish it from regressions introduced by the current work.

---

# 14. Fix Cycle

The Developer Agent should use this internal cycle:

```text
Implement
↓
Self-Review
↓
Test
↓
Identify Findings
↓
Fix
↓
Regression Test
↓
Final Validation
```

Do not knowingly leave blocking defects merely because the initial requested implementation is complete.

For unresolved significant findings, classify them as:

```text
BLOCKER

HIGH

MEDIUM

LOW

INFO
```

Every known BLOCKER or HIGH issue must be:

```text
FIXED

ACCEPTED RISK

NOT REPRODUCIBLE

OUT OF SCOPE
```

with an explanation.

Do not silently omit known issues from the final report.

---

# 15. Severity Guidance

## BLOCKER

Examples:

* security vulnerability;
* tenant isolation failure;
* data corruption;
* destructive migration;
* broken build caused by the current work;
* major workflow unusable.

## HIGH

Examples:

* important business-rule bypass;
* idempotency failure;
* incorrect financial totals;
* unauthorized branch access;
* major mobile workflow broken;
* concurrency issue capable of corrupting important state.

## MEDIUM

Examples:

* incomplete requirement;
* confusing UX;
* missing important validation;
* moderate performance issue;
* incomplete error handling.

## LOW

Examples:

* small consistency issue;
* minor UI problem;
* non-critical cleanup;
* minor missing test coverage.

## INFO

Examples:

* future optimization;
* architectural observation;
* optional cleanup;
* deferred improvement.

---

# 16. Source of Truth

Use the following precedence:

```text
Phase specification / user request
→ product requirement

AGENTS.md
→ engineering policy

Existing application behavior
→ backward-compatibility baseline

Database constraints and RLS
→ authoritative data/security boundaries

Automated tests
→ evidence of correctness
```

Tests are not the complete definition of correctness.

Existing implementation is not automatically correct merely because it already exists.

When the requested behavior conflicts with legacy implementation, preserve compatibility where reasonable while implementing the requested product behavior.

---

# 17. Documentation

Update documentation when the implementation materially changes:

```text
architecture

schema

setup

environment variables

development workflow

business rules

deployment requirements

manual testing steps
```

For large phases, the Developer Agent may maintain:

```text
docs/codex/current-phase.md

docs/codex/developer-report.md

docs/codex/decisions.md
```

Use these only when they improve future development.

Do not create excessive process documentation for small tasks.

Never commit reports containing production/customer secrets or sensitive production data.

---

# 18. Developer Final Report

At the end of meaningful work, return a concise Developer Report containing:

```text
Implementation Summary

Files Changed

Database Changes

Domain / Business Rules

UI / UX Changes

Security / RLS

Tests Added / Updated

Commands Run

Validation Results

Self-Review Findings

Known Risks

Deferred / Out-of-Scope Items

Recommended Next Step
```

Do not create a fake QA verdict.

There is no separate QA Agent.

Instead, clearly report the actual validation performed by the Developer Agent.

---

# 19. Completion Criteria

A substantial phase is complete only when applicable requirements are satisfied:

```text
implementation complete

+

requested workflow usable

+

self-review complete

+

blocking findings resolved

+

lint passes

+

typecheck passes

+

build passes

+

required tests pass

+

security/RLS reviewed

+

mobile behavior reviewed

+

desktop behavior reviewed

+

documentation updated where necessary
```

If an item cannot be validated in the current environment, state that clearly in the final report.

Do not claim completion for unimplemented acceptance criteria.

---

# 20. Repository Discipline

Do not:

* force-push;
* rewrite Git history;
* rewrite migration history;
* expose secrets;
* commit credentials;
* disable security controls;
* introduce unnecessary infrastructure;
* perform unrelated large refactors;
* create duplicate implementations;
* install unnecessary dependencies;
* change production data;
* deploy automatically.

Keep changes bounded to the requested phase.

Prefer small, understandable architectural extensions over unnecessary framework creation.

---

# 21. Human Review and Production Safety

Codex may perform the complete development workflow, but generated changes remain reviewable work.

Do not automatically:

* deploy production;
* execute destructive production operations;
* rotate live secrets;
* apply production backfills;
* change production authentication configuration;
* send real customer communications;
* charge customers;
* perform irreversible external actions.

Explicit authorization is required before performing production-impacting or irreversible actions.

Development and local/test-environment operations may proceed when safe.

---

# 22. Solo-Developer Optimization

This repository is maintained primarily by a solo developer.

Optimize implementation for:

```text
maintainability

debuggability

reusability

low operational complexity

clear naming

safe migrations

strong boundaries

minimal supervision
```

Avoid architecture that requires unnecessary operational overhead.

Prefer existing platform capabilities over introducing additional infrastructure.

Prefer a complete vertical slice over several partially implemented systems.

When the task is large, complete as much of the usable workflow as safely possible rather than stopping after scaffolding.

---

# 23. Final Principle

Operate as a senior developer responsible for the entire engineering outcome.

Do not merely generate code.

Understand the requirement, inspect the existing system, make a bounded plan, implement the feature, review your own work critically, test it, fix discovered problems, validate the repository, and clearly report what was actually completed.

```text
Inspect before inventing.

Reuse before duplicating.

Validate on the server.

Protect tenant boundaries.

Preserve RLS.

Test important business rules.

Review before declaring completion.

Never claim commands were run when they were not.
```

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
