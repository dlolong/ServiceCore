import type { Metadata } from "next";
import { Armchair, Bell, CalendarDays, Package, Scissors, Sparkles, Users, WalletCards } from "lucide-react";

import { FeatureSection, HowItWorks, MarketingCta, MarketingFooter, MarketingHeader, MarketingHero } from "@/components/marketing/product-landing";
import { verticalBrands } from "@/modules/platform/brand";

export const metadata: Metadata = {
  title: { absolute: "NegOSu Salon & Beauty | Salon Management Software" },
  description: "Manage Clients, Appointments, Staff, Treatments, chairs or rooms, products, inventory, payments, and reminders in NegOSu Salon & Beauty.",
  alternates: { canonical: verticalBrands.salon.path },
  openGraph: {
    title: "NegOSu Salon & Beauty | Salon Management Software",
    description: "Run Client appointments, Treatments, Staff schedules, resources, products, payments, and reminders from one salon workspace.",
    url: verticalBrands.salon.path,
  },
};

const features = [
  { icon: CalendarDays, title: "Appointments & Calendar", description: "Plan daily Client visits around Staff and Resource availability." },
  { icon: Users, title: "Clients & Staff", description: "Keep Client visit history and Staff schedules close to the day’s work." },
  { icon: Scissors, title: "Treatments", description: "Offer clear duration and pricing for each Treatment at the right branches." },
  { icon: Armchair, title: "Chairs & Rooms", description: "Assign chairs, rooms, stations, and equipment without exceeding capacity." },
  { icon: Package, title: "Products & Inventory", description: "Track the professional and retail products each branch keeps on hand." },
  { icon: WalletCards, title: "Appointment Payments", description: "Record partial and full Appointment payments with a clear balance." },
  { icon: Bell, title: "Client Reminders", description: "Send Salon-specific appointment reminders through shared delivery infrastructure." },
  { icon: Sparkles, title: "Daily Operations", description: "See confirmed, waiting, in-service, completed, and upcoming Client visits." },
] as const;

function SalonVisual() {
  return (
    <div className="rounded-ui-lg border border-slate-200 bg-white p-3 shadow-ui-md sm:p-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-primary-strong">Today&apos;s schedule</p><p className="mt-1 font-black">Glow Beauty Lounge</p></div><Scissors aria-hidden="true" className="text-brand-primary" /></div>
        <div className="p-4 sm:p-5">
        <div className="mt-5 space-y-3">{[["9:00 AM", "Camille · Hair Color", "Maria · Chair 1"], ["11:30 AM", "Bianca · Classic Facial", "Ana · Facial Room"], ["2:00 PM", "Nina · Manicure", "Lea · Nail Station"]].map(([time, treatment, context], index) => <div key={time} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-zinc-100 p-3"><span className="text-xs font-bold text-zinc-500">{time}</span><div className="min-w-0"><p className="truncate text-sm font-black">{treatment}</p><p className="mt-1 truncate text-xs text-zinc-500">{context}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${index === 1 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{index === 1 ? "WAITING" : "CONFIRMED"}</span></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}

export default function NegOSuSalonPage() {
  return (
    <main id="negosu-salon-page" className="min-h-screen overflow-x-clip bg-white text-brand-ink">
      <MarketingHeader vertical="salon" />
      <MarketingHero vertical="salon" eyebrow="NegOSu Salon & Beauty" title="Run your salon from one simple system." description="Bring Clients, Appointments, Calendar, Staff, Treatments, chairs and rooms, products, inventory, payments, and reminders into one clear daily workspace." visual={<SalonVisual />} />
      <FeatureSection vertical="salon" heading="Everything your salon needs to run the day." description="Built around Client visits, Staff time, treatment spaces, and the next appointment." features={features} />
      <HowItWorks vertical="salon" steps={["Create your salon, first branch, Treatments, Staff, and chairs or rooms.", "Schedule Clients with the right Staff and Resource availability.", "Complete each Appointment, record payment, and keep the next visit on track."]} />
      <MarketingCta vertical="salon" title="Give your team one clear view of the day." description="Start with your Treatments, team, and resources, then schedule Clients in the NegOSu Salon & Beauty workspace." />
      <MarketingFooter />
    </main>
  );
}
