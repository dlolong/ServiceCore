import { ArrowRight, CheckCircle2, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/brand-wordmark";
import {
  productBrand,
  verticalBrands,
  type SupportedVerticalKey,
} from "@/modules/platform/brand";

export type MarketingFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function MarketingHeader({ vertical }: { vertical?: SupportedVerticalKey }) {
  const signupPath = vertical ? verticalBrands[vertical].signupPath : "/signup";
  const loginPath = vertical ? verticalBrands[vertical].loginPath : "/login";

  return (
    <header id="negosu-main-header" className="border-b border-brand-border/70 bg-white/95">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link id="negosu-header-home-link" href="/" className="inline-flex min-h-11 items-center" aria-label={`${productBrand.name} home`}>
          <BrandWordmark className="w-32" />
        </Link>

        <nav id="negosu-desktop-navigation" className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <Link id="negosu-desktop-solutions-link" href="/#solutions" className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Solutions</Link>
          <Link id="negosu-desktop-automotive-link" href={verticalBrands.automotive.path} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Automotive</Link>
          <Link id="negosu-desktop-salon-link" href={verticalBrands.salon.path} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Salon &amp; Beauty</Link>
          <Link id="negosu-desktop-features-link" href="/#features" className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Features</Link>
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link id="negosu-header-sign-in-link" href={loginPath} className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100">Sign In</Link>
          <Link id="negosu-header-start-free-button" href={signupPath} className="inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-primary-strong">Start Free</Link>
        </div>

        <details id="negosu-mobile-menu" className="group relative sm:hidden">
          <summary id="negosu-mobile-menu-button" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-brand-border text-brand-ink marker:content-none" aria-label="Open navigation menu">
            <Menu aria-hidden="true" size={20} />
          </summary>
          <nav id="negosu-mobile-navigation" className="absolute right-0 z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg" aria-label="Mobile navigation">
            <Link id="negosu-mobile-solutions-link" href="/#solutions" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-bold hover:bg-zinc-50">Solutions</Link>
            <Link id="negosu-mobile-automotive-link" href={verticalBrands.automotive.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Automotive</Link>
            <Link id="negosu-mobile-salon-link" href={verticalBrands.salon.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Salon &amp; Beauty</Link>
            <Link id="negosu-mobile-features-link" href="/#features" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Features</Link>
            <div className="mt-2 grid gap-2 border-t border-zinc-100 pt-2">
              <Link id="negosu-mobile-sign-in-link" href={loginPath} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-bold">Sign In</Link>
              <Link id="negosu-mobile-start-free-button" href={signupPath} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-bold text-white">Start Free</Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function MarketingHero({ vertical, eyebrow, title, description, visual }: {
  vertical: SupportedVerticalKey;
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
}) {
  return (
    <section id={`negosu-${vertical}-hero`} className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-12 lg:py-14">
      <div>
        <div className="inline-flex rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-sm font-bold text-brand-primary-strong">{eyebrow}</div>
        <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">{description}</p>
        <div className="mt-7 flex flex-col gap-3 min-[380px]:flex-row">
          <Link id={`negosu-${vertical}-start-free-button`} href={verticalBrands[vertical].signupPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-bold text-white shadow-sm hover:bg-brand-primary-strong">
            Start Free <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <a id={`negosu-${vertical}-explore-features-button`} href={`#negosu-${vertical}-features`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-5 py-3 font-bold text-brand-ink hover:bg-brand-tint">Explore Features</a>
        </div>
      </div>
      <div id={`negosu-${vertical}-product-visual`} className="min-w-0">{visual}</div>
    </section>
  );
}

export function FeatureSection({ vertical, heading, description, features }: {
  vertical: SupportedVerticalKey;
  heading: string;
  description?: string;
  features: readonly MarketingFeature[];
}) {
  return (
    <section id={`negosu-${vertical}-features`} className="border-y border-zinc-100 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">{heading}</h2>
        {description ? <p className="mt-3 max-w-2xl leading-7 text-zinc-600">{description}</p> : null}
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description: featureDescription }) => (
            <article id={`negosu-${vertical}-feature-${toId(title)}`} key={title} className="rounded-ui-md border border-zinc-200 bg-white p-5 shadow-ui-sm">
              <Icon aria-hidden="true" className="mb-4 text-brand-primary" size={22} />
              <h3 className="font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{featureDescription}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks({ vertical, steps }: { vertical: SupportedVerticalKey; steps: readonly string[] }) {
  return (
    <section id={`negosu-${vertical}-how-it-works`} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-primary-strong">How it works</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Set up the essentials, then run the day.</h2>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <article id={`negosu-${vertical}-how-it-works-step-${index + 1}`} key={step} className="flex gap-3 border-t border-zinc-200 py-5">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Step {index + 1}</p>
              <p className="mt-1 font-bold">{step}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MarketingCta({ vertical, title, description }: { vertical?: SupportedVerticalKey; title: string; description: string }) {
  const signupPath = vertical ? verticalBrands[vertical].signupPath : "/signup";
  return (
    <section id={vertical ? `negosu-${vertical}-final-cta` : "negosu-final-cta"} className="px-4 py-14 sm:px-6 sm:py-18">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-2xl bg-brand-ink px-6 py-8 text-white shadow-sm sm:px-8 sm:py-10 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-300">{description}</p>
        </div>
        <Link id={vertical ? `negosu-${vertical}-final-start-button` : "negosu-final-start-button"} href={signupPath} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-bold text-white hover:bg-blue-400">
          Start Free <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer id="negosu-main-footer" className="border-t border-brand-border/70 bg-brand-tint/60 px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <BrandWordmark />
          <p className="mt-1">{productBrand.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer navigation">
          <Link id="negosu-footer-automotive-link" href={verticalBrands.automotive.path}>Automotive</Link>
          <Link id="negosu-footer-salon-link" href={verticalBrands.salon.path}>Salon &amp; Beauty</Link>
          <Link id="negosu-footer-sign-in-link" href="/login">Sign In</Link>
          <Link id="negosu-footer-start-free-link" href="/signup">Start Free</Link>
        </nav>
      </div>
    </footer>
  );
}

function toId(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
