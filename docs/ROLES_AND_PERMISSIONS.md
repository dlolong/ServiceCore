# Roles and Permissions

Salon job functions live in `organization_staff_profiles` and remain organization-specific operational metadata. Changing `Senior Stylist` to `Facialist` does not grant or revoke permission; only membership role and branch assignments do that.

Business Staff and authenticated membership are deliberately separate. A Staff profile may have no email, mobile number, or login. Its optional `membership_id` enables NegOSu system access; the membership owns the authorization role and access branches, while the Staff profile owns the person's business name, job function, operational branches, contacts, and active employment state. Changing a Staff contact email never changes the Supabase Auth login email.

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

The Staff settings UI translates these stable authorization values for the active organization industry. Automotive displays `advisor` as **Service Advisor** and `technician` as **Technician**. Salon displays the same underlying permission groups as **Front Desk / Coordinator** and **Service Provider**. Salon titles such as Stylist, Facialist, or Therapist remain separate Job Function metadata. Invitations, staff records, edit forms, and permission matrices must use the same industry-aware presentation.

UI visibility is convenience only. Server actions validate inputs and check membership/permission; RLS enforces tenant, role, and branch scope. Owner-role assignment is restricted to controlled ownership workflows and cannot be requested through normal staff updates.
