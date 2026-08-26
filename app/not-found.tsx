import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-5">
      <section className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-700">404</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">That page is not in the garage.</h1>
        <p className="mt-4 text-zinc-600">The link may be outdated, or the page may not be available yet.</p>
        <Button asChild className="mt-7"><Link href="/dashboard">Back to dashboard</Link></Button>
      </section>
    </main>
  );
}
