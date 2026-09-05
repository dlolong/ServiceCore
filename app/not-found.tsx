import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="negosu-not-found-page" className="grid min-h-dvh place-items-center bg-slate-50 px-5">
      <section id="negosu-not-found-content" className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-primary-strong">404</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-ink">We couldn&apos;t find that page.</h1>
        <p className="mt-4 text-zinc-600">The link may be outdated, or the page may not be available yet.</p>
        <Button id="negosu-not-found-dashboard-button" asChild className="mt-7"><Link href="/dashboard">Back to dashboard</Link></Button>
      </section>
    </main>
  );
}
