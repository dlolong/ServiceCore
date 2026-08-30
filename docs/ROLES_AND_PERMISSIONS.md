# Roles and Permissions

The current authorization roles are `owner`, `manager`, `advisor`, `technician`, `cashier`, and `viewer`. They remain because KarKR workflows currently use them. `lib/rbac.ts` is the central application permission matrix; database policies remain authoritative.

| Role | Purpose |
| --- | --- |
| owner | Tenant control, staff, billing, and all operations |
| manager | Operational administration without ownership billing authority |
| advisor | Customer, vehicle, appointment, estimate, and job coordination |
| technician | Assigned work execution with limited customer/vehicle reads |
| cashier | Invoice and payment work |
| viewer | Read-only reporting/customer access |

Industry job titles are not automatically platform roles. Future labels such as detailer, stylist, or therapist should be staff profile specializations unless they need distinct authorization.

UI visibility is convenience only. Server actions validate inputs and check membership/permission; RLS enforces tenant, role, and branch scope. Owner-role assignment is restricted to controlled ownership workflows and cannot be requested through normal staff updates.
