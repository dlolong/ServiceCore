import { NextResponse } from "next/server";

import { stripeClient } from "@/lib/billing/stripe";
import { applyStripeSubscription } from "@/lib/billing/sync";
import { serverEnv } from "@/lib/env/server";
import { reportActionError } from "@/lib/errors/action-error";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!serverEnv.BILLING_RECONCILIATION_SECRET
    || request.headers.get("authorization") !== `Bearer ${serverEnv.BILLING_RECONCILIATION_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_subscriptions")
    .select("provider_subscription_id")
    .eq("provider", "stripe")
    .not("provider_subscription_id", "is", null);
  if (error) {
    reportActionError("billing.reconcile.load", error, "Billing reconciliation failed.");
    return NextResponse.json({ error: "Billing reconciliation failed." }, { status: 500 });
  }

  let synced = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      const subscription = await stripeClient().subscriptions.retrieve(row.provider_subscription_id!);
      await applyStripeSubscription(
        `reconcile:${subscription.id}:${Date.now()}`,
        "subscription.reconciled",
        JSON.stringify(subscription),
        subscription,
        Math.floor(Date.now() / 1000),
      );
      await admin
        .from("organization_subscriptions")
        .update({ last_reconciled_at: new Date().toISOString() })
        .eq("provider_subscription_id", subscription.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      reportActionError("billing.reconcile.subscription", error, "Billing reconciliation failed.");
    }
  }

  return NextResponse.json({ synced, failed }, { status: failed ? 207 : 200 });
}
