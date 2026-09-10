import { Check } from "lucide-react";
import Link from "next/link";

import { launchPlanCatalog, formatPlanPrice } from "@/modules/platform/plan-catalog";

export function PublicPlanCatalog({ compact = false }: { compact?: boolean }) {
  return (
    <section id={compact ? "negosu-home-plans" : "negosu-plans-catalog"} aria-labelledby={compact ? "negosu-home-plans-title" : "negosu-plans-title"} className={compact ? "border-y border-zinc-100 bg-zinc-50" : "bg-white"}>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-semibold text-brand-primary-strong">Simple plans</p>
        <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 id={compact ? "negosu-home-plans-title" : "negosu-plans-title"} className="text-3xl font-semibold tracking-tight sm:text-4xl">Start free. Upgrade when your business needs more.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-600">Choose Automotive or Salon &amp; Beauty at signup. Available tools vary by industry and plan. Prices are in Philippine pesos.</p>
          </div>
          {compact ? <Link id="negosu-view-all-plans-link" href="/plans" className="inline-flex min-h-11 items-center font-semibold text-brand-primary-strong hover:underline">Compare all plans</Link> : null}
        </div>

        <div id="negosu-plan-grid" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {launchPlanCatalog.map((plan) => (
            <article id={`negosu-plan-${plan.id}`} key={plan.id} className={`relative flex min-w-0 flex-col rounded-ui-lg border bg-white p-5 shadow-ui-sm ${plan.recommended ? "border-brand-primary ring-2 ring-blue-100" : "border-zinc-200"}`}>
              {plan.recommended ? <span className="mb-3 w-fit rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand-primary-strong">Most popular</span> : null}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-12 text-sm leading-5 text-zinc-600">{plan.summary}</p>
              <p className="mt-5 text-2xl font-semibold">
                {plan.custom ? "Let’s talk" : plan.monthlyPriceCentavos === 0 ? "Free" : <>{formatPlanPrice(plan.monthlyPriceCentavos)}<span className="text-sm font-normal text-zinc-500">/month</span></>}
              </p>
              {!plan.custom && plan.yearlyPriceCentavos ? <p className="mt-1 text-xs text-zinc-500">{formatPlanPrice(plan.yearlyPriceCentavos)} billed yearly</p> : <div className="h-5" />}
              <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                {plan.highlights.map((highlight) => <li key={highlight} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={16} /><span>{highlight}</span></li>)}
              </ul>
              <div className="mt-auto pt-6">
                {plan.custom
                  ? <a id={`negosu-plan-${plan.id}-contact-link`} href="mailto:sales@negosu.com" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-border px-4 font-semibold text-brand-ink hover:bg-brand-tint">Contact sales</a>
                  : <Link id={`negosu-plan-${plan.id}-start-link`} href="/signup" className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-semibold ${plan.recommended ? "bg-brand-primary text-white hover:bg-brand-primary-strong" : "border border-brand-border text-brand-ink hover:bg-brand-tint"}`}>{plan.id === "free" ? "Start free" : `Choose ${plan.name}`}</Link>}
              </div>
            </article>
          ))}
        </div>
        <p id="negosu-plan-note" className="mt-5 text-center text-sm text-zinc-500">Paid plans can be managed by the business owner after signup. Upgrading or downgrading never deletes your business records.</p>
      </div>
    </section>
  );
}
