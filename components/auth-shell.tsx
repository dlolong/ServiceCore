import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
        <Link href="/" className="inline-block" aria-label="KarKR home"><BrandLogo className="w-32" priority /></Link>
        <h1 className="mt-8 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-zinc-600">{footer}</div> : null}
      </section>
    </main>
  );
}
