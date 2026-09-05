import { ArrowRight, Check, Circle } from "lucide-react";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand-wordmark";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { getOnboardingSignals } from "@/lib/auth/onboarding-progress";
import { createClient } from "@/lib/supabase/server";
import { calculateOnboardingProgress, onboardingForIndustry } from "@/modules/platform/onboarding";

export default async function OnboardingSetupPage() {
  const [{ activeMembership, user }, supabase] = await Promise.all([getDashboardContext(), createClient()]);
  const industry = activeMembership.industry === "salon" ? "salon" : "automotive";
  const [signals, config] = await Promise.all([
    getOnboardingSignals(supabase, activeMembership, user.id),
    Promise.resolve(onboardingForIndustry(industry)),
  ]);
  const progress = calculateOnboardingProgress(config, signals);

  return (
    <main id="negosu-onboarding-page" className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <section id="negosu-onboarding-checklist" className="mx-auto w-full max-w-3xl rounded-ui-lg border border-brand-border bg-white p-5 shadow-ui-md sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-start gap-1"><BrandWordmark className="w-32" /><span className="text-xs font-bold tracking-wide text-zinc-500">{config.title.replace("Welcome to ", "")}</span></div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">{activeMembership.organizationName}</span>
        </div>
        <div className="mt-7">
          <p className="text-sm font-bold text-brand-primary-strong">Business setup</p>
          <h1 id="negosu-onboarding-title" className="mt-1 text-3xl font-black tracking-tight">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{config.description}</p>
        </div>
        <section id="negosu-onboarding-progress" className="mt-6 rounded-xl border border-brand-border bg-brand-tint p-4 text-brand-ink">
          <div className="flex items-center justify-between gap-4 text-sm"><strong>Setup progress</strong><span className="font-semibold text-slate-600">{progress.completed} / {progress.total}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}>
            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${progress.percentage}%` }} />
          </div>
        </section>
        <div id="negosu-onboarding-steps" className="mt-5 grid gap-3 sm:grid-cols-2">
          {config.steps.map((step) => {
            const complete = signals[step.key];
            return (
              <article id={`negosu-onboarding-step-${step.key}`} key={step.key} className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4">
                <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{complete ? <Check aria-hidden="true" size={16} /> : <Circle aria-hidden="true" size={15} />}</span>
                <div className="min-w-0 flex-1"><h2 className="font-black">{step.label}</h2><p className="mt-1 text-xs leading-5 text-zinc-600">{step.description}</p>{!complete ? <Link id={`negosu-onboarding-step-${step.key}-link`} href={step.href} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-primary-strong">Continue <ArrowRight aria-hidden="true" size={14} /></Link> : <span className="mt-2 block text-xs font-bold text-emerald-700">Complete</span>}</div>
              </article>
            );
          })}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-zinc-500">Progress is derived from your current business data. There are no separate completion switches to maintain.</p>
          <Button asChild><Link id="negosu-onboarding-open-dashboard" href="/dashboard">Open dashboard</Link></Button>
        </div>
      </section>
    </main>
  );
}
