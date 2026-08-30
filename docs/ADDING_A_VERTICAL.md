# Adding a Vertical

Do not add a vertical until current workflow evidence justifies it.

1. Add a typed `IndustryConfig` with terminology and supported capabilities.
2. Select existing core modules: organization, branch, customer, staff, service, scheduling, payment, and inventory as needed.
3. Add explicit vertical domain types and tables only for concepts core cannot express clearly.
4. Map subscription entitlements separately from industry capabilities.
5. Register navigation with capability, entitlement, and permission requirements.
6. Keep display terminology in configuration or the vertical module.
7. Implement named vertical workflow and transition rules.
8. Add organization/branch ownership, constraints, RLS, and cross-tenant denial tests.
9. Add clearly fake multi-tenant seed data.
10. Add unit, SQL/RLS, and relevant browser tests.

For a future Beauty example, Customers, Branches, Staff, Services, Appointments, Payments, and Inventory remain shared. TreatmentRecord, Station, TreatmentRoom, CommissionRule, and CustomerPreference would be explicit Beauty concepts. This example is documentation, not production functionality.

PrivateResortPH integration is a separate reviewed migration project. Never connect this repository to its production database or migrate its users/data as part of adding a vertical.
