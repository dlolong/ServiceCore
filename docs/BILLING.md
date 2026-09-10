# Billing operations

## Launch catalog contract

`modules/platform/plan-catalog.ts` is the single customer-facing launch catalog used by both `/plans` and authenticated Billing presentation. It defines the public plan names, Philippine-peso prices, summaries, and honest plan highlights. The database remains authoritative for subscription state, provider configuration, and entitlement enforcement.

Authenticated Billing compares every active database plan with this launch catalog before presenting plan choices. A name, price, annual price, or custom-plan mismatch produces a controlled billing error instead of displaying a price that conflicts with the public site. Changes to launch pricing therefore require one coordinated change to the catalog, append-only database migration, and Stripe Prices. The launch regression test verifies the seeded database values match the shared catalog.

The `monthly_jobs` entitlement currently applies to Automotive Job Orders. Public cross-industry highlights do not describe that value as a Salon Appointment limit, and Salon Billing omits the Automotive-only Job Order count. Public cards list only universal shared concepts or qualify additional capabilities by industry; they do not promise Automotive-only reports, payments, or booking-request workflows to Salon businesses. Authenticated Billing uses `visiblePlanFeatureLabels()` to translate enabled database keys into customer-readable, industry-supported capabilities: Salon may show Appointment reminders, Automotive may show Maintenance reminders and Advanced Automotive reports, and the historical `ai` flag stays hidden until a launch-ready workflow exists.

ServiceCore uses Stripe-hosted Checkout and Customer Portal behind the `BillingProvider` interface. Browser redirects never grant access. Entitlements change only after a signed Stripe webhook or authenticated server reconciliation updates the subscription through the service-role-only database RPC.

## Production configuration

1. Create recurring monthly and yearly Stripe Prices for Starter, Business, and Pro.
2. Set `plans.provider_monthly_price_id` and `plans.provider_yearly_price_id` to those Price IDs. Price amounts in Stripe must match the corresponding NegOSu launch catalog before launch.
3. Set server-only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and a random `BILLING_RECONCILIATION_SECRET` of at least 24 characters.
4. Register `POST /api/billing/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created`, `updated`, and `deleted` events.
5. Configure Stripe Customer Portal products, allowed changes, cancellation behavior, and branding.
6. Schedule `POST /api/billing/reconcile` with `Authorization: Bearer <BILLING_RECONCILIATION_SECRET>` and alert when `failed` is nonzero.

Use Stripe CLI forwarding and test-mode products before production. Never put secret keys or webhook secrets in `NEXT_PUBLIC_*` variables.

## Access behavior

- `trialing` and `active` subscriptions receive their selected plan.
- `past_due` receives a seven-day grace period, then safely falls back to Free access.
- `cancelled` and `paused` fall back to Free access.
- Downgrades prevent new over-limit resources but never delete branches, staff, jobs, photos, or history.
- Only owners can view subscription state or launch billing management.
