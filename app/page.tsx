import Link from "next/link";
import { ArrowRight, CalendarDays, CarFront, ClipboardCheck, Gauge, Wrench } from "lucide-react";

const features = [
  [CalendarDays, "Bookings & queue", "Handle scheduled appointments and walk-ins in one workflow."],
  [CarFront, "Customer & vehicle CRM", "Keep every vehicle, owner and service history organized."],
  [ClipboardCheck, "Job orders", "Run inspections, services, estimates and completion from the bay."],
  [Gauge, "Maintenance reminders", "Bring customers back when their vehicle is due for care."],
  [Wrench, "Built for auto care", "Car wash, detailing, coating, PMS and service workflows."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-2xl font-black tracking-tight">Kar<span className="text-amber-500">KR</span></Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-100">Open app</Link>
          <Link href="/login" className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">Your Car. Our Care.</div>
          <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">Run your auto-care business from one place.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">KarKR brings customers, vehicles, bookings, queue, job orders, payments, inventory and service history into one mobile-first platform.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 font-bold text-white">Create your shop <ArrowRight size={18}/></Link>
            <a href="#features" className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 font-bold text-zinc-950 hover:bg-zinc-50">Explore features</a>
          </div>
        </div>
        <div className="rounded-[2rem] border border-zinc-200 bg-zinc-950 p-5 shadow-2xl">
          <div className="rounded-[1.5rem] bg-zinc-900 p-5 text-white">
            <p className="text-sm text-zinc-400">Today · Main Branch</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[['12','Cars today'],['4','Waiting'],['₱28.4K','Sales'],['3','Due soon']].map(([v,l]) => <div key={l} className="rounded-2xl bg-white/7 p-4"><div className="text-2xl font-black">{v}</div><div className="mt-1 text-xs text-zinc-400">{l}</div></div>)}
            </div>
            <div className="mt-4 rounded-2xl bg-amber-400 p-4 text-zinc-950">
              <div className="text-xs font-bold uppercase tracking-wider">Next in queue</div>
              <div className="mt-1 text-xl font-black">Toyota Fortuner · ABC 1234</div>
              <div className="mt-1 text-sm">Premium wash + interior detail</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-black tracking-tight">Start with the workflows shops use every day.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {features.map(([Icon, title, text]) => {
              const FeatureIcon = Icon as typeof CalendarDays;
              return <div key={String(title)} className="rounded-2xl border border-zinc-200 bg-white p-5"><FeatureIcon className="mb-5"/><h3 className="font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{String(text)}</p></div>
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
