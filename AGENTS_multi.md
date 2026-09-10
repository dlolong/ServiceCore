# Multi-Agent Development Workflow

ServiceCore/KarKR is developed using a role-based Codex workflow.

For sufficiently large phases, use multiple agents when the Codex environment supports parallel agents/worktrees.

The default team is:

```text
Project Manager / Orchestrator
Developer
QA / Reviewer
```

Do not spawn additional agents unless work can be divided into genuinely independent workstreams.

## 1. Project Manager / Orchestrator

The Project Manager owns:

* phase understanding;
* repository discovery;
* scope control;
* acceptance criteria;
* task decomposition;
* architecture consistency;
* dependency ordering;
* assignment of implementation work;
* QA coordination;
* integration decisions;
* final phase acceptance.

The Project Manager should inspect:

```text
AGENTS.md
relevant docs/
previous phase reports
existing implementation
migrations
tests
```

before delegating work.

The Project Manager should not normally implement the majority of feature code.

The Project Manager may make small integration/documentation fixes when necessary.

### PM responsibilities

Before implementation:

1. Inspect current repository state.
2. Confirm what already exists.
3. Identify reusable capabilities.
4. Identify affected modules.
5. Identify DB/RLS implications.
6. Identify concurrency/idempotency implications.
7. Define acceptance criteria.
8. Create a bounded implementation plan.
9. Assign implementation to Developer.
10. Give QA enough requirements to independently prepare verification.

After implementation:

1. Review Developer handoff.
2. Give QA the completed implementation.
3. Review QA findings.
4. Assign blocking fixes.
5. Require regression verification.
6. Run or delegate final validation.
7. Produce the consolidated final report.

---

# 2. Developer Agent

Developer owns implementation.

Developer must:

1. Read `AGENTS.md`.
2. Read the phase specification.
3. Inspect existing patterns before creating new ones.
4. Reuse existing domain/services/components where appropriate.
5. Keep Core and vertical boundaries intact.
6. Use append-only migrations.
7. Preserve RLS.
8. Add server-side validation.
9. Keep authoritative business logic outside UI components.
10. Add stable semantic DOM IDs.
11. Preserve backward compatibility.
12. Add/update tests.
13. Run targeted validation.
14. Produce a Developer Handoff.

Developer must not:

* deploy;
* change production data;
* disable RLS;
* expose secrets;
* force-push;
* rewrite migration history;
* introduce unnecessary infrastructure;
* declare QA PASS on its own work.

## Developer Handoff

Developer must return:

```text
Implementation Summary

Files Changed

Database Changes

Domain / Business Rules

UI Changes

Security / RLS

Tests Added

Commands Run

Known Risks

Items Requiring QA Attention
```

---

# 3. QA / Reviewer Agent

QA must be independent from implementation.

QA should begin by reading:

```text
AGENTS.md
phase specification
acceptance criteria
```

and creating an independent verification matrix.

QA should not assume Developer implementation is correct.

After Developer handoff, QA must inspect:

```text
git diff
migrations
RLS
server/domain code
actions/routes
UI
tests
```

QA should test:

```text
happy path
validation failures
authorization failures
cross-tenant behavior
branch restrictions
duplicate submissions
idempotency
concurrency where relevant
mobile behavior
desktop behavior
loading/error states
backward compatibility
```

QA should explicitly search for:

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
missing semantic DOM IDs
```

QA initially reports issues instead of modifying implementation.

## QA Severity

Use:

```text
BLOCKER
HIGH
MEDIUM
LOW
INFO
```

### BLOCKER

Examples:

* security vulnerability;
* tenant isolation failure;
* data corruption;
* destructive migration;
* broken build;
* major workflow unusable.

### HIGH

Examples:

* important business rule bypass;
* idempotency failure;
* incorrect totals;
* major mobile workflow broken.

### MEDIUM

Examples:

* incomplete requirement;
* confusing UX;
* missing important validation;
* moderate performance issue.

### LOW

Examples:

* small consistency issue;
* minor UI problem;
* non-critical cleanup.

## QA Verdict

Return exactly one:

```text
PASS

PASS WITH NON-BLOCKING FINDINGS

FAIL — BLOCKING ISSUES FOUND
```

QA must not return PASS merely because existing automated tests pass.

---

# 4. Fix Cycle

When QA finds blocking issues:

```text
QA
↓
Project Manager
↓
Developer Fix
↓
QA Regression
↓
Project Manager
```

Do not let QA findings disappear without disposition.

Every BLOCKER/HIGH finding must end as:

```text
FIXED
ACCEPTED RISK
NOT REPRODUCIBLE
OUT OF SCOPE
```

with explanation.

---

# 5. Worktree Ownership

When multiple agents use worktrees:

```text
PM
→ planning/integration worktree

Developer
→ implementation worktree

QA
→ review/testing worktree
```

Avoid multiple agents editing the same files concurrently unless the Project Manager explicitly decomposed file ownership.

---

# 6. Parallelism Policy

Parallelize only independent work.

Good parallel work:

```text
Developer implements
while
QA prepares test matrix
```

or:

```text
Backend Developer
→ domain/database

UI Developer
→ UI consuming already-defined contract
```

when contracts are stable.

Bad parallel work:

```text
two agents independently refactor the same Scheduling service
```

Avoid merge-conflict-driven development.

---

# 7. Source of Truth

The phase specification is the product requirement.

`AGENTS.md` is the engineering policy.

Existing application behavior is the backward-compatibility baseline.

Database constraints/RLS are authoritative security boundaries.

Automated tests are evidence, not the complete definition of correctness.

---

# 8. Agent Communication Artifacts

For large phases, agents may maintain:

```text
docs/codex/current-phase.md
docs/codex/developer-handoff.md
docs/codex/qa-report.md
docs/codex/decisions.md
```

Use these only when they improve coordination.

Do not create excessive process documentation for small tasks.

Generated reports containing production/customer data must not be committed.

---

# 9. Final Acceptance

A large phase is complete only when:

```text
Developer implementation complete
+
QA verdict acceptable
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
documentation updated
+
Project Manager accepts phase
```

Never claim a command passed unless it was actually executed.

---

# 10. Human Review

Codex may perform the full engineering workflow, but generated changes remain reviewable work.

Do not:

* deploy production automatically;
* execute destructive production operations;
* rotate live secrets;
* apply production backfills;
* perform irreversible external actions

without explicit authorization.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
