# NegOSu Owner Command Center

## Purpose

The Owner Command Center is the primary `/dashboard` experience for owners and managers. It answers what happened today, what requires action, what remains unpaid, and which authorized branch needs attention without turning the dashboard into a second source of business state.

```text
                       NegOSu Owner Command Center
                                  |
                    +-------------+-------------+
                    |                           |
              Shared metrics              Action Inbox
                    |                           |
              Core capabilities          Vertical rules
                    |                           |
              +-----+-----+               +-----+-----+
              |           |               |           |
         Automotive     Salon        Automotive     Salon
```

Ordinary staff retain the existing operational/My Work dashboard and do not receive Command Center financial data.

## Shared contract and ownership

`modules/core/command-center` defines small presentation types for metrics, actions, operations, staff, branch performance, and selected scope. Core understands labels, amounts, counts, priority, links, and shared records. It does not understand Vehicle, Job Order, estimate, maintenance, or Salon workflow meanings.

| Metric | Owner and source of truth |
| --- | --- |
| Revenue Today | Core Payments with `status = paid`, inside each branch's local calendar day |
| Appointments Today | Core Appointments by `starts_at`, inside each branch's local calendar day |
| Outstanding | Non-void invoice balance plus completed standalone Appointment expected total less paid Appointment payments |
| Low Stock | Core `inventory_stock.low_stock` projection |
| Needs Attention | Current actions derived by the active vertical contributor |

Automotive owns estimate approval, Job Order, quality-check, ready-for-release, unpaid completed Job Order, and maintenance-overdue conditions. Salon owns Appointment confirmation, checked-in Client, completed-unpaid Appointment, and Salon wording. Both may present shared low-stock state in vertical-appropriate language.

## Action Inbox rules

The Action Inbox is a derived read model, not a notification feed, audit log, or task system. No `action_inbox_items` table exists. Each refresh derives current actions from authoritative business state, so approving an estimate, paying a balance, changing an Appointment state, or restocking an item removes or changes the corresponding action naturally.

Actions sort deterministically by `critical`, `high`, `medium`, then `low`; older conditions sort first within a priority, followed by stable ID. Each action links to its relevant entity or operational screen. The total and per-branch attention counts include the represented condition count, not merely the number of rendered rows.

## Branch and role scope

The browser may request `all` or a branch UUID, but it is not authoritative. The server resolves only RLS-visible active branches and the database function independently requires an authenticated owner/manager, matching organization, active branch, and `can_access_branch` for every requested branch. All Branches therefore means all authorized branches, not every branch in the organization.

Owners see organization-wide information for their authorized scope. Managers see their authorized branch scope. Other roles stay on the nonfinancial operational dashboard. UI hiding is not the authorization boundary.

## Financial and timezone semantics

Revenue is the sum of successful Payment ledger rows, never estimates, invoices, catalog prices, or client totals. Refunded, voided, pending, and failed records are excluded. Invoice outstanding uses persisted non-void balances. Standalone completed Appointments use persisted expected totals less paid Appointment-linked payments, clamped at zero.

For an All Branches view, every branch evaluates Today in its own IANA timezone and the results are summed. No server-timezone or fixed 24-hour-day assumption is used. Invalid timezone configuration fails instead of silently changing financial boundaries.

## Query design and performance

`get_command_center_shared_metrics` returns one aggregate row per authorized branch in one call and accepts at most 100 unique branch IDs. It performs complete aggregates; UI list limits never determine financial totals. Vertical contributors issue a fixed number of batched, tenant/branch-filtered queries and bound action, operation, assignment, and staff candidates. No per-record query loop, snapshot warehouse, or persistent dashboard state was introduced.

Indexes support paid Payment day ranges, open invoice balances, completed Appointment balances, and the existing inventory-stock join. The dashboard does not write audit events. Quick actions continue through their existing authorized and audited workflows.

## UI contract

The desktop first viewport keeps business identity, operational date, branch selector, five compact metrics, Action Inbox preview, and the beginning of Today's Operations visible. Mobile uses a two-column metric grid followed by actions and a vertical operations list. The page uses one application scroll area and semantic `negosu-command-center-*` IDs.

## Deferred analytics

This boundary intentionally does not add AI recommendations, a business-health score, profit accounting, forecasting, a data warehouse, advanced BI, customer cohorts, predictive staffing, arbitrary date-range analytics, or another chart library.
