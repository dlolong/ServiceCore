import { Check, CreditCard, ShieldCheck } from "lucide-react";

import { openBillingPortal, startCheckout } from "@/app/dashboard/settings/billing/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { productBrand } from "@/modules/platform/brand";
import { findLaunchPlan, planMatchesLaunchCatalog, visiblePlanFeatureLabels } from "@/modules/platform/plan-catalog";

type EffectiveEntitlements = {
  planId: string;
  planName: string;
  status: string;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);

  if (activeMembership.role !== "owner") {
    return <main id="billing-page" className="mx-auto w-full max-w-6xl"><PageHeader id="billing-page-header" eyebrow="Subscription" title="Plans and billing" description="Review subscription access for this business."/><Card id="billing-owner-only-state" className="mt-5 p-6"><h2 className="font-semibold text-admin-text">Owner access required</h2><p className="mt-1 text-sm text-admin-text-secondary">Only organization owners can change plans, payment details, or cancellation settings.</p></Card></main>;
  }

  const [plansResult, subscriptionResult, entitlementsResult] = await Promise.all([
    supabase.from("plans").select("id,name,monthly_price_centavos,yearly_price_centavos,limits,features,is_custom,provider_monthly_price_id,provider_yearly_price_id").eq("is_active", true).order("sort_order"),
    supabase.from("organization_subscriptions").select("plan_id,status,current_period_end,cancel_at_period_end,provider_customer_id,grace_ends_at").eq("organization_id", activeMembership.organizationId).maybeSingle(),
    supabase.rpc("get_org_entitlements", { p_organization_id: activeMembership.organizationId }),
  ]);
  const effective = entitlementsResult.data as EffectiveEntitlements | null;
  const subscription = subscriptionResult.data;
  const hasCatalogMismatch = Boolean(plansResult.data?.some(plan => !planMatchesLaunchCatalog(plan)));
  const hasLoadError = Boolean(plansResult.error || subscriptionResult.error || entitlementsResult.error || hasCatalogMismatch);
  const status = subscription?.status ?? "free";
  const statusVariant = status === "active" || status === "trialing" ? "success" : status === "past_due" ? "danger" : "neutral";

  return (
    <main id="billing-page" className="mx-auto w-full max-w-6xl">
      <PageHeader id="billing-page-header" eyebrow="Subscription" title="Plans and billing" description={`Manage ${productBrand.name} access for ${activeMembership.organizationName}. Plan changes never delete business data.`}/>
      <FormMessage {...params}/>

      {hasLoadError ? <Card id="billing-load-error" className="mt-5 p-6 text-center" role="alert"><h2 className="font-semibold text-admin-text">Could not load billing</h2><p className="mx-auto mt-2 max-w-xl text-sm text-admin-text-secondary">Try loading this page again. Your subscription was not changed. If this continues, contact support.</p><Button id="billing-retry-button" asChild variant="secondary" className="mt-4"><a href="/dashboard/settings/billing">Try again</a></Button></Card> : <>
        <Card id="billing-current-plan" elevation="none" className="mt-5 overflow-hidden">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><CreditCard aria-hidden="true" size={21}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Current plan</p><Badge variant={statusVariant} className="capitalize">{status.replaceAll("_", " ")}</Badge></div><h2 className="mt-1 text-2xl font-semibold text-admin-text">{effective?.planName ?? "Free"}</h2>{subscription?.current_period_end ? <p className="mt-1 text-sm text-admin-text-secondary">{subscription.cancel_at_period_end ? "Access ends" : "Next renewal"} on {new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(subscription.current_period_end))}</p> : <p className="mt-1 text-sm text-admin-text-secondary">No recurring payment is active.</p>}{subscription?.status === "past_due" ? <p className="mt-2 text-sm font-medium text-status-danger">Payment overdue. Grace access ends {subscription.grace_ends_at ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(subscription.grace_ends_at)) : "soon"}.</p> : null}</div></div>
            {subscription?.provider_customer_id ? <form id="billing-portal-form" action={openBillingPortal}><SubmitButton id="billing-manage-subscription-button" pendingText="Opening…" variant="secondary">Manage subscription</SubmitButton></form> : null}
          </div>
          <div className="flex items-start gap-2 border-t border-admin-border bg-admin-surface-muted px-5 py-3 text-xs text-admin-text-secondary sm:px-6"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={16}/><p>Payments and card details are handled by the configured billing provider. NegOSu does not store full card information.</p></div>
        </Card>

        <section id="billing-plans" aria-labelledby="billing-plans-title" className="mt-7">
          <div><h2 id="billing-plans-title" className="text-lg font-semibold text-admin-text">Choose the right plan</h2><p className="mt-1 text-sm text-admin-text-secondary">Compare limits and available tools. You will review the amount before payment.</p></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plansResult.data?.map(plan => {
              const current = effective?.planId === plan.id;
              const catalogPlan = findLaunchPlan(plan.id);
              const hasMonthlyCheckout = Boolean(plan.provider_monthly_price_id);
              const hasYearlyCheckout = Boolean(plan.provider_yearly_price_id);
              const checkoutAvailable = hasMonthlyCheckout || hasYearlyCheckout;
              return <Card id={`billing-plan-${plan.id}`} elevation="none" className={`flex flex-col p-5 ${current || catalogPlan?.recommended ? "border-brand-primary ring-2 ring-brand-border" : ""}`} key={plan.id}>
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-admin-text">{plan.name}</h3><p className="mt-1 text-2xl font-semibold text-admin-text">{plan.is_custom ? "Custom pricing" : plan.monthly_price_centavos ? `${formatMoney(plan.monthly_price_centavos)}/mo` : "Free"}</p></div><div className="flex flex-col items-end gap-1">{current ? <Badge variant="brand">Current</Badge> : null}{catalogPlan?.recommended ? <Badge variant="success">Recommended</Badge> : null}</div></div>
                {catalogPlan ? <p className="mt-3 min-h-10 text-sm leading-5 text-admin-text-secondary">{catalogPlan.summary}</p> : null}
                <details id={`billing-plan-details-${plan.id}`} className="mt-4 border-y border-admin-border py-3"><summary className="cursor-pointer text-sm font-medium text-brand-primary-strong">View plan details</summary><PlanDetails industry={activeMembership.industry} limits={plan.limits as Record<string, number>} features={plan.features as Record<string, boolean>}/></details>
                <div className="mt-auto pt-4">{current ? <p className="flex min-h-11 items-center gap-2 text-sm font-medium text-status-success"><Check aria-hidden="true" size={17}/>Your active plan</p> : plan.is_custom ? <Button id={`billing-contact-sales-${plan.id}`} asChild variant="secondary" className="w-full"><a href="mailto:sales@negosu.com">Contact sales</a></Button> : plan.id === "free" ? <p className="text-sm text-admin-text-muted">Free access is applied when no paid subscription is active.</p> : checkoutAvailable ? <form id={`billing-checkout-form-${plan.id}`} action={startCheckout} className="grid gap-2"><input type="hidden" name="planId" value={plan.id}/><label className="text-xs font-medium text-admin-text-secondary" htmlFor={`billing-interval-${plan.id}`}>Billing interval<select id={`billing-interval-${plan.id}`} name="interval" className="mt-1 min-h-11 w-full rounded-ui-md border border-admin-border-strong bg-admin-surface px-3 text-sm text-admin-text">{hasMonthlyCheckout ? <option value="month">Monthly · {formatMoney(plan.monthly_price_centavos)}</option> : null}{hasYearlyCheckout ? <option value="year">Yearly · {formatMoney(plan.yearly_price_centavos ?? 0)}</option> : null}</select></label><SubmitButton id={`billing-choose-plan-${plan.id}`} pendingText="Opening checkout…" className="w-full">Choose {plan.name}</SubmitButton></form> : <p id={`billing-checkout-unavailable-${plan.id}`} className="rounded-ui-md bg-admin-surface-muted p-3 text-sm text-admin-text-muted">Online checkout is not configured for this plan.</p>}</div>
              </Card>;
            })}
          </div>
          {!plansResult.data?.length ? <Card id="billing-plans-empty-state" className="mt-3 p-6 text-center text-sm text-admin-text-secondary">No plans are currently available.</Card> : null}
        </section>
      </>}
    </main>
  );
}

function PlanDetails({ industry, limits, features }: { industry: string; limits: Record<string, number>; features: Record<string, boolean> }) {
  const featureLabels = visiblePlanFeatureLabels(industry, features);
  return <ul className="mt-3 space-y-2 text-sm text-admin-text-secondary"><li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={15}/><span>{limits.branches < 0 ? "Unlimited" : limits.branches} branches</span></li><li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={15}/><span>{limits.staff < 0 ? "Unlimited" : limits.staff} staff</span></li>{industry === "automotive" ? <li className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={15}/><span>{limits.monthly_jobs < 0 ? "Unlimited" : limits.monthly_jobs} Job Orders/month</span></li> : null}{featureLabels.map(feature => <li key={feature} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={15}/><span>{feature}</span></li>)}</ul>;
}
