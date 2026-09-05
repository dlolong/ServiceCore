import type { Metadata } from "next";
import { CalendarDays, CarFront, ClipboardCheck, Gauge, Package, ReceiptText, Users, Wrench } from "lucide-react";

import { FeatureSection, HowItWorks, MarketingCta, MarketingFooter, MarketingHeader, MarketingHero } from "@/components/marketing/product-landing";
import { verticalBrands } from "@/modules/platform/brand";

export const metadata: Metadata = {
  title: { absolute: "NegOSu Automotive | Business Management for Auto Service" },
  description: "Manage automotive customers, vehicles, appointments, Job Orders, estimates, parts, payments, service history, and maintenance in NegOSu Automotive.",
  alternates: { canonical: verticalBrands.automotive.path },
  openGraph: {
    title: "NegOSu Automotive | Business Management for Auto Service",
    description: "Run appointments, vehicles, approved work, parts, payments, and maintenance from one automotive workspace.",
    url: verticalBrands.automotive.path,
  },
};

const features = [
  { icon: CalendarDays, title: "Appointments & Queue", description: "Coordinate scheduled visits and walk-ins from one daily view." },
  { icon: CarFront, title: "Customers & Vehicles", description: "Keep customer, vehicle, odometer, and service context together." },
  { icon: ClipboardCheck, title: "Inspections & Job Orders", description: "Move authorized work through execution and quality control." },
  { icon: Wrench, title: "Estimates & Service", description: "Keep recommended work, customer decisions, and service items clear." },
  { icon: Package, title: "Parts & Inventory", description: "Track stock, reservations, actual consumption, and branch availability." },
  { icon: ReceiptText, title: "Invoices & Payments", description: "See approved totals, recorded payments, balances, and release readiness." },
  { icon: Gauge, title: "History & Maintenance", description: "Turn completed work into durable service history and future maintenance." },
  { icon: Users, title: "Advisor & Technician Work", description: "Give the team the next-action context they need without losing accountability." },
] as const;

function AutomotiveVisual() {
  return (
    <div className="rounded-ui-lg border border-slate-200 bg-white p-3 shadow-ui-md sm:p-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-primary-strong">Main Branch</p><p className="mt-1 text-lg font-black text-brand-ink">Today&apos;s work</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Open</span></div>
        <div className="grid grid-cols-2 gap-px bg-slate-200">{[["12", "Appointments"], ["4", "In queue"], ["3", "In service"], ["2", "Ready"]].map(([value, label]) => <div key={label} className="bg-white p-3 sm:p-4"><div className="text-xl font-black text-brand-ink sm:text-2xl">{value}</div><div className="mt-1 text-xs text-slate-500">{label}</div></div>)}</div>
        <div className="m-4 rounded-xl border-l-4 border-brand-primary bg-brand-tint p-4 text-brand-ink"><div className="text-xs font-bold uppercase tracking-wider text-brand-primary-strong">Next in queue</div><div className="mt-1 text-lg font-black sm:text-xl">Toyota Fortuner · ABC 1234</div><div className="mt-1 text-sm text-slate-600">Premium wash + interior detail</div></div>
      </div>
    </div>
  );
}

export default function NegOSuAutomotivePage() {
  return (
    <main id="negosu-automotive-page" className="min-h-screen overflow-x-clip bg-white text-brand-ink">
      <MarketingHeader vertical="automotive" />
      <MarketingHero vertical="automotive" eyebrow="NegOSu Automotive" title="Run your automotive business from one system." description="Connect customers, vehicles, appointments, Staff, service bays, inspections, Job Orders, estimates, parts, payments, history, and maintenance in one operational workspace." visual={<AutomotiveVisual />} />
      <FeatureSection vertical="automotive" heading="The automotive workflow, connected from arrival to return visit." description="Built for car wash, detailing, repair, maintenance, and auto-care teams." features={features} />
      <HowItWorks vertical="automotive" steps={["Create your business, first branch, Services, Staff, and service bays.", "Schedule appointments, receive vehicles, and execute customer-authorized work.", "Record payment and preserve completed service history for the next visit."]} />
      <MarketingCta vertical="automotive" title="Put your automotive operation in one clear workspace." description="Start with the essentials, then use the NegOSu Automotive workflow as your team and service volume grow." />
      <MarketingFooter />
    </main>
  );
}
