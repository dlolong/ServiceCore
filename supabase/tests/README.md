# Supabase tests

`phase01_auth_rls.sql` is a 77-assertion pgTAP suite for onboarding, RLS, grants, and cross-table tenant guards. It creates deterministic Organization A/B fixtures inside a transaction and rolls everything back. Run it against a reset local Supabase database with `supabase test db`.

Minimum matrix:
- user A can read Org A and cannot read Org B;
- user B can read Org B and cannot read Org A;
- inactive membership has no effective access;
- role-specific mutation restrictions work;
- cross-tenant foreign-key attempts fail even when IDs are known;
- anonymous users cannot read internal customers, vehicles, jobs or payments.
- branches, services, appointments, job orders, payments, and inventory remain tenant-scoped;
- Organization A cannot read, insert, update, or delete Organization B records;
- vehicle/customer, service/category, appointment, job item, payment, and inventory relationships reject cross-tenant parents.

Later phases extend this matrix rather than replacing it.
