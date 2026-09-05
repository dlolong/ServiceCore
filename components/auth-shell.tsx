import Link from "next/link";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/components/brand-wordmark";
import { productBrand, verticalBrands } from "@/modules/platform/brand";
import type { PublicProductKey } from "@/modules/platform/product-entry";

export function AuthShell({ title, description, children, footer, industry, id = "negosu-auth-page" }: { title: string; description: string; children: ReactNode; footer?: ReactNode; industry?: PublicProductKey; id?: string }) {
  const vertical = industry ? verticalBrands[industry] : null;
  const homeHref = vertical?.path ?? "/";
  return (
    <main id={id} className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-8 sm:px-5 sm:py-10">
      <section id={`${id}-card`} className="w-full max-w-md rounded-ui-lg border border-brand-border bg-white p-5 shadow-ui-md sm:p-7">
        <Link id={`${id}-home-link`} href={homeHref} className="inline-flex flex-col items-start gap-1" aria-label={`${vertical?.displayName ?? productBrand.name} home`}>
          <BrandWordmark className="w-32" />
          {vertical ? <span className="text-xs font-bold tracking-wide text-zinc-500">{vertical.shortName}</span> : null}
        </Link>
        <h1 id={`${id}-title`} className="mt-7 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        {children}
        {footer ? <div id={`${id}-footer`} className="mt-6 text-center text-sm text-zinc-600">{footer}</div> : null}
      </section>
    </main>
  );
}
