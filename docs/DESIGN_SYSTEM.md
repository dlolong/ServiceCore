# NegOSu Design System

## Public plan presentation

Public Plans reuse the neutral NegOSu surface, border, radius, typography, and action hierarchy. The recommended plan uses one restrained primary accent; plan availability and price are communicated with text rather than color alone. Cards stack at phone widths and do not introduce a nested scroll container.

This is the implementation contract for shared NegOSu product UI. It applies to Automotive and Salon without importing either vertical into shared components.

## Colors

- Canvas: quiet off-white/slate.
- Surface and raised surface: white.
- Primary text: dark navy; secondary and muted text: slate.
- Border and strong border: low-contrast slate.
- Brand: one NegOSu blue for primary actions, focus, selected navigation/tabs, and important links.
- Semantic success, warning, danger, and info colors communicate real state only. Ordinary cards, icons, navigation groups, and filters stay neutral.

Tokens live in `app/globals.css`. Prefer named Tailwind theme tokens such as `admin-surface`, `admin-text`, `brand-primary`, and `status-danger` instead of page-specific hex colors.

### User-selected workspace themes

Authenticated users may select Ocean Blue, Graphite, Emerald, or Indigo from Profile settings. The preference is stored in the authenticated user metadata and is applied only inside `dashboard-app-shell`; it follows the user when switching organizations. Each palette changes structural chrome, interactive accents, borders, and the canvas through the same shared tokens. It does not change customer-facing public-page branding or semantic success, warning, danger, and information colors.

Unknown or older preference values resolve to Ocean Blue. Server actions allowlist every saved theme value; theme metadata is a presentation preference and is never an authorization input.

## Typography and spacing

Authenticated page titles are compact: 24px on mobile and no more than 30px at normal desktop widths. Use semibold for titles and important actions, medium for labels, and regular body text. Typical page and section gaps are 12–20px; ordinary cards use 12–20px padding.

## Radius and shadows

- Small radius: compact controls and mobile navigation.
- Medium radius: buttons and form fields.
- Large radius: cards, tables, menus, and dialogs.
- Small shadow: ordinary cards, controls, and rows.
- Medium shadow: raised panels, menus, and dialogs.
- Large shadow: major floating overlays only.

Interactive cards may strengthen their border and shadow slightly. Static cards do not move or react on hover.

## Buttons and links

`Button` supports `primary`, `secondary`, `outline`, `ghost`, `danger`, and the backwards-compatible `destructive` alias. Sizes are `sm`, `default`, `lg`, and `icon`; every operational size preserves a practical 44px target. Disabled state remains readable, and `SubmitButton` exposes pending state with text, a spinner, `disabled`, and `aria-busy`.

`asChild` forwards safe identity, data, title, event, and ARIA props to its rendered link while excluding button-only form attributes. Action links use brand text or a button/navigation surface and retain a clear focus ring.

## Cards and metrics

`Card` uses a neutral surface, subtle border, large radius, and the small shadow by default. Its explicit elevation and interactive options are reserved for genuine hierarchy or interaction. `StatCard` is compact and neutral; semantic emphasis belongs in its content only when the metric represents real status.

## Badges and status

`Badge` supports neutral, brand, success, warning, danger, and info variants. Neutral is the default. `StatusPill` always includes text so color is not the only state indicator.

## Tabs

`Tabs` renders a labelled navigation region. Tabs do not wrap; mobile uses horizontal scrolling. Active state uses a blue underline, readable text, and `aria-current`. Optional counts are compact neutral badges.

## Tables and mobile records

`TableFrame`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell` define neutral compact desktop tables. The frame allows intentional horizontal scrolling rather than clipping content. Route implementations should still render compact cards below `md` when a table cannot fit useful mobile content.

## Forms and feedback

Fields are at least 44px tall, use a visible brand focus ring, and show invalid state semantically. Labels remain explicit. `FormMessage` uses live status or alert roles, and shared empty/error/loading states keep feedback concise.

## Dialogs

`FormDialog` uses the native modal API for focus containment. Its header remains visible while one body region scrolls. Escape routes back to `closeHref`, preventing a closed dialog from leaving stale query state. Mobile uses the full dynamic viewport; larger screens use a bounded raised panel. `DialogFooter` provides an optional sticky, reachable action area.

## Navigation and scrolling

Navigation importance is expressed by the shallow Dashboard, Operations, Customers/Clients, Business, and More hierarchy, not separate colors. Groups have one collapsible level; active groups remain open. Desktop rows are compact and use regular/medium typography. Inactive destinations remain neutral, while the active destination uses a subtle surface and slim brand indicator.

The shell uses a fixed dynamic-viewport frame. Main content owns the one page-level vertical scroll; the desktop sidebar scrolls only as a fallback on short viewports. Dialog content and the mobile More popup may have one bounded internal scroll because each is an explicit overlay. Ordinary cards and desktop tables do not own vertical scroll regions.

## Responsive behavior

Shared surfaces target 320, 375, 390, and 430px mobile widths plus 1366×768, 1440×900, and 1920×1080 desktop viewports. Controls wrap without page overflow. Bottom navigation is Home, Bookings, Customers/Clients, and More; tabs scroll in one line; dialogs keep actions reachable above the virtual keyboard and safe area.

## Accessibility and DOM IDs

All interactive primitives expose visible keyboard focus. Icon-only buttons require an accessible label and stable ID. Dialogs reference their title and optional description. Meaningful roots, sections, forms, menus, repeated records, and actions use deterministic kebab-case IDs. Reduced-motion preferences disable smooth scrolling and nonessential transitions.
