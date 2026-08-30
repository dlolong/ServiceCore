import { createHash } from "node:crypto";

import type Stripe from "stripe";

import { stripeSubscriptionState } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyStripeSubscription(
  eventId: string,
  eventType: string,
  payload: string,
  subscription: Stripe.Subscription,
  eventCreated = subscription.created,
) {
  const state = stripeSubscriptionState(subscription);
  if (!state.organizationId || !state.planId) throw new Error("Subscription metadata is incomplete.");

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_billing_subscription", {
    p_provider: "stripe",
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: createHash("sha256").update(payload).digest("hex"),
    p_organization_id: state.organizationId,
    p_plan_id: state.planId,
    p_customer_id: state.customerId,
    p_subscription_id: state.subscriptionId,
    p_status: state.status,
    p_price_id: state.priceId,
    p_interval: state.interval,
    p_period_start: state.periodStart,
    p_period_end: state.periodEnd,
    p_cancel_at_period_end: state.cancelAtPeriodEnd,
    p_provider_updated_at: new Date(eventCreated * 1000).toISOString(),
  });
  if (error) throw error;
}
