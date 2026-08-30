# KarKR UI Conventions

## Standard page anatomy

Operational pages use a compact header with title/context on the left and one primary action on the right. The main list or workflow begins after a single compact filter toolbar; avoid decorative hero spacing and repeated introductions.

```text
Page title                         Primary action
Compact context
Search | common filters | more filters
Desktop table / mobile cards      Optional selected detail
```

`PageHeader`, `FilterBar`, `EmptyState`, and `StatusPill` in `components/page-patterns.tsx` are the focused shared primitives. They are intentionally compositional rather than a universal management-page abstraction.

## Lists, tables, and cards

- Use compact tables from the `md` breakpoint when records share comparable fields.
- Use cards below `md`; preserve the same identity, status, key operational context, and primary action.
- Keep rows approximately 40–56 pixels where content permits. Combine identity details such as vehicle/model and plate instead of creating secondary columns.
- Put long descriptions, notes, and history in detail views. Never hide critical status, money, or primary identity through truncation.
- Distinguish “no records” from “no filter results”; filtered empty states provide a Clear filters action.

## Create and edit flow

Simple create/edit actions open `FormDialog` from the list or current context. Existing form components and server actions remain authoritative and are reused inside dialogs. The dialog has a fixed header, one scrollable body, and reachable form actions. Successful list-launched mutations return to the list; legacy `/new` and `/edit` routes remain available for bookmarks and compatibility.

```text
List → Create dialog → Save → refreshed list
List/detail → Edit dialog → Save → current context
```

Large workflows—Job Orders, inspections, estimates, invoices, and multi-section operational details—remain dedicated pages.

## Filters and actions

Search is first and visible. Common status/branch controls follow it. Rare controls belong under a compact More filters disclosure when needed. Preserve search, status, branch, and page in links that launch dialogs. Use one visible primary row action; lower-frequency or consequential actions belong in a clearly labelled overflow or confirmation.

## Detail panels

A right-side detail panel is optional and only justified for frequent list/detail switching. It must not duplicate the page, must scroll only when taller than the viewport, and becomes a sheet or stacked summary on mobile.

## Scrolling and responsive behavior

The app shell owns one main content scroll region. The desktop navigation can scroll independently when taller than the viewport. Avoid nested vertical list/table scroll areas. Dialogs use `100dvh`, a single scrollable body, and actions within that body; mobile bottom padding keeps content clear of navigation. Horizontal table scrolling is a last resort—reduce columns or switch to cards first.

Review at 1366×768, 1440×900, and common mobile widths 320, 375, 390, and 430 pixels. Do not allow mobile page overflow, unreachable dialog actions, or bottom-navigation collisions.

Complex Job Orders use a compact section navigation plus a sticky desktop Service Advisor panel. On mobile the panel participates in the single page flow. Add/edit estimate lines, authorization, and payment are focused dialogs; never nest these dialogs. The first viewport should expose identity, status, estimate, authorization, parts, balance, blockers, and the recommended next action.

Customer estimate review is a separate, mobile-first public page rather than a dashboard/portal shell. It shows business identity, basic vehicle context, itemized money, a prominent total, and explicit decision confirmation. It must never use wording that implies the link was sent when KarKR only generated/copied it. Invalid, expired, revoked, superseded, and already-decided states need calm, actionable copy without exposing internal identifiers.

## Spacing and typography

Page titles are compact (`text-2xl`, rising to `text-3xl` where appropriate). Prefer page gaps of 12–20 pixels and card padding of 12–20 pixels. Operational buttons use default or compact sizes rather than marketing-scale controls. Status color is consistent: neutral, success, warning, and danger.

## Accessibility and DOM IDs

Use native semantic elements and the existing accessible controls. Dialogs use the native modal API for focus trapping and Escape behavior, label their heading, and return navigation to a stable URL. Icon-only actions require an accessible label and title.

Use Server Components for initial protected data and Client Components only for browser interaction. Reuse `components/ui`, existing shells, form messages, submit buttons, cards, and badges before adding primitives.

Every meaningful rendered root, section, form, table, dialog, menu, control, and major action needs a deterministic semantic DOM `id`. Use kebab-case and include a stable record ID for repeated entities. React keys and DOM IDs are separate.

```tsx
<main id="customers-page">
<form id="customer-create-form">
<input id="customer-phone-input" />
<article id={`customer-card-${customer.id}`} />
```

Pages are mobile-first, avoid horizontal overflow, expose visible loading/empty/error states, preserve visible focus, use native semantic HTML, and keep touch targets practical. Dense tables may become cards on narrow screens. Reusable visual components should accept an `id` prop when practical and derive child IDs from it.

The current application predates the complete ID convention. Add IDs whenever a screen is materially changed; a dedicated screen-by-screen pass should use Playwright at 320, 375, 390, and 430 pixels rather than unsafe mechanical JSX rewrites.
