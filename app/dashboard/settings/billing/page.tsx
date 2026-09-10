import { openBillingPortal, startCheckout } from "@/app/dashboard/settings/billing/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
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
  const [params, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  if (activeMembership.role !== "owner") {
    return <main id="billing-page" className="mx-auto w-full max-w-5xl"><h1 className="text-2xl font-semibold sm:text-3xl">Billing</h1><Card id="billing-owner-only-state" className="mt-5 p-6">Only organization owners can manage billing.</Card></main>;
  }

  const [plansResult, subscriptionResult, entitlementsResult] = await Promise.all([
    supabase.from("plans").select("id,name,monthly_price_centavos,yearly_price_centavos,limits,features,is_custom,provider_monthly_price_id,provider_yearly_price_id").eq("is_active", true).order("sort_order"),
    supabase.from("organization_subscriptions").select("plan_id,status,current_period_end,cancel_at_period_end,provider_customer_id,grace_ends_at").eq("organization_id", activeMembership.organizationId).maybeSingle(),
    supabase.rpc("get_org_entitlements", { p_organization_id: activeMembership.organizationId }),
  ]);
  const effective = entitlementsResult.data as EffectiveEntitlements | null;
  const subscription = subscriptionResult.data;
  const hasCatalogMismatch = Boolean(plansResult.data?.some((plan) => !planMatchesLaunchCatalog(plan)));
  const hasLoadError = Boolean(plansResult.error || subscriptionResult.error || entitlementsResult.error || hasCatalogMismatch);

  return (
    <main id="billing-page" className="mx-auto w-full max-w-6xl">
      <header id="billing-page-header">
        <p className="text-sm font-medium text-brand-primary">Subscription</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Plans and billing</h1>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base">Manage {productBrand.name} access for {activeMembership.organizationName}. Downgrades never delete business data.</p>
      </header>
      <FormMessage {...params} />

      {hasLoadError ? (
        <Card id="billing-load-error" className="mt-5 p-6 text-center" role="alert">
          <h2 className="font-semibold">Could not load billing</h2>
          <p className="mt-2 text-sm text-zinc-600">Try loading this page again. Your subscription was not changed. If this continues, contact support.</p>
        </Card>
      ) : <>
        <Card id="billing-current-plan" className="mt-5 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">Current access</p>
            <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{effective?.planName ?? "Free"} · <span className="capitalize">{subscription?.status ?? "free"}</span></h2>
            {subscription?.current_period_end ? <p className="mt-1 text-sm text-zinc-600">{subscription.cancel_at_period_end ? "Ends" : "Renews"} {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(subscription.current_period_end))}</p> : null}
            {subscription?.status === "past_due" ? <p className="mt-1 text-sm font-medium text-red-700">Payment overdue. Grace access ends {subscription.grace_ends_at ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(subscription.grace_ends_at)) : "soon"}.</p> : null}
          </div>
          {subscription?.provider_customer_id ? <form id="billing-portal-form" action={openBillingPortal}><SubmitButton id="billing-manage-subscription-button" pendingText="Opening…" variant="secondary">Manage payment and cancellation</SubmitButton></form> : null}
        </Card>

        <section id="billing-plans" aria-labelledby="billing-plans-title" className="mt-5">
          <h2 id="billing-plans-title" className="text-lg font-semibold">Available plans</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plansResult.data?.map((plan) => {
              const current = effective?.planId === plan.id;
              const catalogPlan = findLaunchPlan(plan.id);
              return <Card id={`billing-plan-${plan.id}`} className={`flex flex-col p-4 sm:p-5 ${current ? "border-brand-primary ring-2 ring-blue-100" : ""}`} key={plan.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-1 text-2xl font-semibold">{plan.is_custom ? "Custom" : plan.monthly_price_centavos ? `${formatMoney(plan.monthly_price_centavos)}/mo` : "Free"}</p></div>
                  {current ? <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-medium text-brand-primary-strong">Current</span> : null}
                </div>
                {catalogPlan ? <p className="mt-2 text-sm leading-5 text-zinc-600">{catalogPlan.summary}</p> : null}
                <details id={`billing-plan-details-${plan.id}`} className="mt-4 border-y border-zinc-100 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-brand-primary-strong">View plan details</summary>
                  <PlanDetails industry={activeMembership.industry} limits={plan.limits as Record<string, number>} features={plan.features as Record<string, boolean>} />
                </details>
                <div className="mt-auto pt-4">
                  {plan.is_custom ? <a id={`billing-contact-sales-${plan.id}`} className="font-medium text-brand-primary-strong hover:underline" href="mailto:sales@negosu.com">Contact sales</a>
                    : plan.id === "free" ? <p className="text-sm text-zinc-500">Default access when no paid subscription is active.</p>
                      : <form id={`billing-checkout-form-${plan.id}`} action={startCheckout} className="grid gap-2">
                        <input type="hidden" name="planId" value={plan.id} />
                        <label className="text-xs font-medium" htmlFor={`billing-interval-${plan.id}`}>Billing interval<select id={`billing-interval-${plan.id}`} name="interval" className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3"><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
                        <SubmitButton id={`billing-choose-plan-${plan.id}`} pendingText="Opening checkout…">Choose {plan.name}</SubmitButton>
                        {!plan.provider_monthly_price_id ? <small className="text-zinc-500">Online checkout not configured.</small> : null}
                      </form>}
                </div>
              </Card>;
            })}
          </div>
          {!plansResult.data?.length ? <Card id="billing-plans-empty-state" className="mt-3 p-6 text-center text-sm text-zinc-600">No plans are currently available.</Card> : null}
        </section>
      </>}
    </main>
  );
}

function PlanDetails({ industry, limits, features }: { industry: string; limits: Record<string, number>; features: Record<string, boolean> }) {
  const featureLabels = visiblePlanFeatureLabels(industry, features);
  return <ul className="mt-3 space-y-1.5 text-sm text-zinc-600"><li>{limits.branches < 0 ? "Unlimited" : limits.branches} branches</li><li>{limits.staff < 0 ? "Unlimited" : limits.staff} staff</li>{industry === "automotive" ? <li>{limits.monthly_jobs < 0 ? "Unlimited" : limits.monthly_jobs} Job Orders/month</li> : null}{featureLabels.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>;
}
