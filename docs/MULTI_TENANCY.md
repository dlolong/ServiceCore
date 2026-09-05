# Multi-Tenancy

Appointment self-service links retain organization and branch parents and are browser-readable only through a hash-token RPC. Appointment payments repeat the Appointment organization/branch relationship in both trigger and recording RPC. Staff profile organization must match its membership organization.

`organizations` is the tenant root. Business records carry `organization_id` directly or inherit it through an enforced parent. Operational records use `branch_id` where location matters.

For every read or write:

1. Supabase Auth establishes the user.
2. The server resolves an active, non-disabled organization membership.
3. The server derives organization and allowed branches; it never accepts them as authority from the browser.
4. Explicit query predicates make intent and debugging clear.
5. RLS and relational integrity enforce the boundary independently.

Branch restrictions use membership branch assignments. Owners retain organization-wide access; restricted staff must not access unassigned branches. An inactive membership has no tenant access.

Every new business table needs SELECT, INSERT, UPDATE, and DELETE decisions, cross-tenant denial tests, inactive-membership tests, and branch tests when applicable. Service-role access is limited to isolated server modules and trusted webhook/admin operations.
