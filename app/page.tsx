import type { Metadata } from "next";
import { ArrowRight, Boxes, CalendarDays, CarFront, CheckCircle2, CreditCard, Scissors, ShieldCheck, Store, Users } from "lucide-react";
import Link from "next/link";

import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/product-landing";
import { productBrand, verticalBrands } from "@/modules/platform/brand";

export const metadata: Metadata = {
  title: { absolute: "NegOSu | Business Operating System" },
  description: productBrand.description,
  alternates: { canonical: "/" },
  openGraph: { title: `${productBrand.name} | Business Operating System`, description: productBrand.description, url: "/" },
};

const sharedCapabilities = [
  { icon: Users, title: "Customer records", description: "Keep the people you serve and their history easy to find." },
  { icon: CalendarDays, title: "Scheduling", description: "Coordinate appointments, staff, branches, and resources." },
  { icon: Store, title: "Services", description: "Manage what you offer, duration, pricing, and availability." },
  { icon: Boxes, title: "Inventory", description: "Know what is on hand and record stock movement at each branch." },
  { icon: CreditCard, title: "Payments", description: "Record payments against the work each industry performs." },
  { icon: ShieldCheck, title: "One secure platform", description: "Use shared permissions, audit, notifications, and tenant controls." },
] as const;

const faqs = [
  ["Which businesses can use NegOSu today?", "NegOSu currently supports automotive service businesses and salon or beauty businesses. Each gets terminology and workflows built for its day-to-day operations."],
  ["Is this one generic workspace?", "No. NegOSu shares secure platform capabilities underneath, while Automotive and Salon & Beauty present different workflows for the business using them."],
  ["Can I choose my business type during signup?", "Yes. Start from the main page to choose, or enter through a solution page to begin with that supported business type selected."],
  ["Do I need separate accounts for different businesses?", "No. One NegOSu account can access authorized businesses, and switching changes the actual organization context."],
] as const;

export default function NegOSuLandingPage() {
  return (
    <main id="negosu-home-page" className="min-h-screen overflow-x-clip bg-white text-brand-ink">
      <MarketingHeader />

      <section id="negosu-hero" className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-12 pt-9 sm:px-6 sm:pb-16 sm:pt-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:gap-12 lg:py-14">
        <div>
          <p className="inline-flex rounded-full border border-brand-border bg-brand-tint px-3 py-1 text-sm font-bold text-brand-primary-strong">One platform. Industry-specific experience.</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl xl:text-7xl">{productBrand.tagline}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">Manage customers, appointments, staff, services, inventory, payments, and day-to-day operations from one system—built for the way your business works.</p>
          <div className="mt-7 flex flex-col gap-3 min-[380px]:flex-row">
            <Link id="negosu-start-free-button" href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-3 font-bold text-white shadow-sm hover:bg-brand-primary-strong">Start Free <ArrowRight aria-hidden="true" size={18} /></Link>
            <a id="negosu-explore-solutions-button" href="#solutions" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-border bg-white px-5 py-3 font-bold hover:bg-brand-tint">Explore Solutions</a>
          </div>
        </div>

        <div id="negosu-hero-product-visual" className="min-w-0 rounded-ui-lg border border-slate-200 bg-white p-3 shadow-ui-md sm:p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-brand-primary-strong">NegOSu</p><p className="mt-0.5 font-black text-brand-ink">Today at a glance</p></div>
              <span className="text-xs font-semibold text-slate-500">2 supported solutions</span>
            </div>
            <div className="p-4 sm:p-5">
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-4 text-brand-ink"><CarFront aria-hidden="true" className="text-brand-primary" size={22} /><h2 className="mt-5 font-black">Automotive</h2><p className="mt-1 text-sm text-slate-600">Appointments, vehicles, Job Orders, parts, and maintenance.</p></article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 text-brand-ink"><Scissors aria-hidden="true" className="text-brand-primary" size={22} /><h2 className="mt-5 font-black">Salon &amp; Beauty</h2><p className="mt-1 text-sm text-slate-600">Clients, Treatments, Staff, stations, and reminders.</p></article>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-border bg-brand-tint px-4 py-3 text-sm text-brand-ink"><CheckCircle2 aria-hidden="true" className="shrink-0 text-brand-primary" size={18} />Shared scheduling, inventory, payments, permissions, and audit.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-primary-strong">Supported industries</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">What kind of business do you run?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-600">Choose the solution that matches your work. Both are powered by the same NegOSu platform without forcing every business into the same workflow.</p>
          <div id="negosu-industry-selector" className="mt-8 grid gap-4 lg:grid-cols-2">
            <article id="negosu-automotive-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-tint text-brand-primary-strong"><CarFront aria-hidden="true" /></div>
              <h3 className="mt-5 text-2xl font-black">Automotive</h3>
              <p className="mt-2 leading-7 text-zinc-600">For car wash, detailing, repair, maintenance, and auto-care businesses.</p>
              <Link id="negosu-explore-automotive-link" href={verticalBrands.automotive.path} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold">Explore Automotive <ArrowRight aria-hidden="true" size={18} /></Link>
            </article>
            <article id="negosu-salon-card" className="rounded-ui-lg border border-zinc-200 bg-white p-6 shadow-ui-sm sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-primary-strong"><Scissors aria-hidden="true" /></div>
              <h3 className="mt-5 text-2xl font-black">Salon &amp; Beauty</h3>
              <p className="mt-2 leading-7 text-zinc-600">For salons, spas, facial care, nail, barber, and beauty-service businesses.</p>
              <Link id="negosu-explore-salon-link" href={verticalBrands.salon.path} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold">Explore Salon &amp; Beauty <ArrowRight aria-hidden="true" size={18} /></Link>
            </article>
          </div>
          <p className="mt-5 text-sm text-zinc-500">More business types are coming. Signup currently offers only the solutions that are ready.</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-primary-strong">Shared capabilities</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">The essentials stay connected.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sharedCapabilities.map(({ icon: Icon, title, description }) => <article id={`negosu-capability-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`} key={title} className="border-t border-slate-200 py-5"><Icon aria-hidden="true" className="text-brand-primary" size={22} /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p></article>)}
        </div>
      </section>

      <section id="negosu-vertical-overview" className="border-y border-blue-950 bg-brand-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-2">
          <article id="negosu-automotive-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm font-bold uppercase tracking-wider text-blue-300">NegOSu Automotive</p><h2 className="mt-3 text-3xl font-black">From arrival to the next service.</h2><p className="mt-3 leading-7 text-zinc-300">Coordinate appointments, vehicles, inspections, approved work, parts, payments, service history, and maintenance.</p><Link href={verticalBrands.automotive.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 font-bold text-white">See Automotive <ArrowRight aria-hidden="true" size={18} /></Link></article>
          <article id="negosu-salon-overview" className="rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8"><p className="text-sm font-bold uppercase tracking-wider text-blue-300">NegOSu Salon &amp; Beauty</p><h2 className="mt-3 text-3xl font-black">From booking to the next visit.</h2><p className="mt-3 leading-7 text-zinc-300">Coordinate Clients, Appointments, Staff, Treatments, chairs or rooms, products, payments, and reminders.</p><Link href={verticalBrands.salon.path} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 font-bold text-white">See Salon &amp; Beauty <ArrowRight aria-hidden="true" size={18} /></Link></article>
        </div>
      </section>

      <section id="negosu-how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-primary-strong">How NegOSu works</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choose your business. Set up the essentials. Run the day.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">{["Create your account and choose a supported business type.", "Add your business, first branch, services, team, and resources.", "Enter the workspace built for your industry and start operating."].map((step, index) => <article id={`negosu-how-it-works-step-${index + 1}`} key={step} className="border-t border-zinc-200 py-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Step {index + 1}</p><p className="mt-2 font-bold leading-6">{step}</p></article>)}</div>
      </section>

      <section id="negosu-faq" className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-18">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-primary-strong">FAQ</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">A clear start for your business.</h2>
          <div className="mt-7 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white px-5">{faqs.map(([question, answer], index) => <details id={`negosu-faq-item-${index + 1}`} key={question} className="group py-5"><summary className="cursor-pointer list-none font-black marker:content-none">{question}<span aria-hidden="true" className="float-right ml-3 text-zinc-400 group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{answer}</p></details>)}</div>
        </div>
      </section>

      <MarketingCta title="Ready to run your business with less friction?" description="Create your NegOSu account, choose Automotive or Salon & Beauty, and set up the workspace that matches your operation." />
      <MarketingFooter />
    </main>
  );
}
