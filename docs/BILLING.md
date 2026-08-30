# Billing operations

ServiceCore uses Stripe-hosted Checkout and Customer Portal behind the `BillingProvider` interface. Browser redirects never grant access. Entitlements change only after a signed Stripe webhook or authenticated server reconciliation updates the subscription through the service-role-only database RPC.

## Production configuration

1. Create recurring monthly and yearly Stripe Prices for Starter, Business, and Pro.
2. Set `plans.provider_monthly_price_id` and `plans.provider_yearly_price_id` to those Price IDs. Price amounts in Stripe must match the corresponding ServiceCore plan catalog before launch.
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
