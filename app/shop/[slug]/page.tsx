import { ArrowRight, Clock3, ExternalLink, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandWordmark } from "@/components/brand-wordmark";
import { OpenQueueDisplay } from "@/components/open-queue-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/operations";
import type { PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";
import { verticalBrands } from "@/modules/platform/brand";

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_shop", { p_slug: slug });
  return data as PublicShop | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const publicShop = await loadShop(slug);
  if (!publicShop) return { title: "Business not found" };
  const description = publicShop.description ?? `Book ${publicShop.industry === "salon" ? "salon treatments" : "automotive services"} with ${publicShop.name}.`;
  return {
    title: `${publicShop.name} | ${verticalBrands[publicShop.industry ?? "automotive"].displayName}`,
    description,
    alternates: { canonical: `/shop/${slug}` },
    openGraph: { title: publicShop.name, description, images: publicShop.coverUrl ? [publicShop.coverUrl] : undefined, type: "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publicShop = await loadShop(slug);
  if (!publicShop) notFound();
  const industry = publicShop.industry ?? "automotive";
  const vertical = verticalBrands[industry];
  const serviceLabel = industry === "salon" ? "treatment" : "service";
  const primaryBranch = publicShop.branches.find(branch => branch.acceptsBookings) ?? publicShop.branches[0];
  const bookingHref = `/shop/${encodeURIComponent(slug)}/book`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": industry === "salon" ? "BeautySalon" : "AutomotiveBusiness",
    name: publicShop.name,
    description: publicShop.description,
    telephone: publicShop.phone,
    url: `/shop/${slug}`,
    image: [publicShop.logoUrl, publicShop.coverUrl].filter(Boolean),
    address: publicShop.branches[0]?.address.filter(Boolean).join(", "),
  };

  return <main id={industry === "salon" ? "public-salon-shop-page" : "public-automotive-shop-page"} className="min-h-dvh bg-admin-canvas text-admin-text">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />

    <header id="public-shop-header" className="border-b border-admin-border bg-white">
      <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link id="public-shop-home-link" href={`/shop/${encodeURIComponent(slug)}`} className="flex min-w-0 items-center gap-3">
          {publicShop.logoUrl ? <Image src={publicShop.logoUrl} alt="" width={44} height={44} unoptimized className="size-11 shrink-0 rounded-ui-md border border-admin-border bg-white object-contain p-1"/> : <span className="grid size-11 shrink-0 place-items-center rounded-ui-md bg-brand-ink text-lg font-semibold text-white">{publicShop.name.slice(0, 1).toUpperCase()}</span>}
          <span className="min-w-0"><strong className="block truncate text-sm text-brand-ink sm:text-base">{publicShop.name}</strong><small className="block truncate text-xs text-admin-text-muted">{industry === "salon" ? "Salon & beauty" : "Automotive care"}</small></span>
        </Link>
        <Button id="public-shop-header-book-button" asChild size="sm"><Link href={bookingHref}>Book now</Link></Button>
      </div>
    </header>

    <section id="public-automotive-shop-hero" className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:py-16">
        <div>
          <p className="text-sm font-semibold text-brand-primary-strong">{vertical.displayName}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-ink sm:text-5xl lg:text-6xl">{publicShop.name}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-admin-text-secondary">{publicShop.description ?? (industry === "salon" ? "Professional salon care with a simple online booking experience." : "Professional vehicle care with a simple online booking experience.")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button id="public-automotive-shop-book-button" asChild size="lg"><Link href={bookingHref}>View available dates<ArrowRight aria-hidden="true" size={18}/></Link></Button>{industry === "salon" && primaryBranch ? <OpenQueueDisplay id="public-salon-queue-link" branchId={primaryBranch.id} publicSlug={slug} label="View customer queue"/> : null}</div>
          <div id="public-shop-quick-details" className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-admin-text-secondary">{primaryBranch ? <span className="inline-flex items-center gap-2"><MapPin aria-hidden="true" className="text-brand-primary" size={17}/>{primaryBranch.name}</span> : null}{publicShop.phone ? <a className="inline-flex items-center gap-2 hover:text-brand-primary-strong" href={`tel:${publicShop.phone.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" className="text-brand-primary" size={17}/>{publicShop.phone}</a> : null}</div>
        </div>
        <div id="public-shop-hero-media" className="relative min-h-72 overflow-hidden rounded-ui-lg border border-admin-border bg-brand-ink shadow-ui-md sm:min-h-96">
          {publicShop.coverUrl ? <Image src={publicShop.coverUrl} alt={`${publicShop.name} business`} fill unoptimized sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover"/> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top_right,var(--brand-primary),transparent_55%)] p-10"><div className="rounded-ui-lg border border-white/15 bg-white/10 p-6 text-white backdrop-blur-sm"><p className="text-sm text-blue-100">Welcome to</p><p className="mt-2 text-3xl font-semibold">{publicShop.name}</p></div></div>}
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
      <section id="public-automotive-shop-services" aria-labelledby="public-shop-services-title">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-brand-primary-strong">What we offer</p><h2 id="public-shop-services-title" className="mt-1 text-3xl font-semibold tracking-tight text-brand-ink">{industry === "salon" ? "Treatments" : "Services"}</h2></div>{publicShop.services.length ? <Button id="public-shop-services-book-button" asChild variant="secondary"><Link href={bookingHref}>Check availability</Link></Button> : null}</div>
        {publicShop.services.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{publicShop.services.map(service => <Card id={`public-automotive-shop-service-${service.id}`} elevation="none" interactive className="flex flex-col p-5" key={service.id}><p className="text-xs font-semibold uppercase tracking-wide text-brand-primary-strong">{service.category || (industry === "salon" ? "Treatment" : "Service")}</p><h3 className="mt-2 text-xl font-semibold text-brand-ink">{service.name}</h3><p className="mt-2 grow text-sm leading-6 text-admin-text-secondary">{service.description || `Professional ${service.name.toLowerCase()} from ${publicShop.name}.`}</p><div className="mt-5 flex items-center justify-between gap-3 border-t border-admin-border pt-4 text-sm"><span className="inline-flex items-center gap-1.5 text-admin-text-muted"><Clock3 aria-hidden="true" size={16}/>{service.durationMinutes} min</span><strong className="text-brand-ink">From {formatMoney(service.priceCentavos)}</strong></div><Link id={`public-shop-service-book-${service.id}`} href={`${bookingHref}?service=${encodeURIComponent(service.id)}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary-strong hover:text-brand-primary">Book this {serviceLabel}<ArrowRight aria-hidden="true" size={15}/></Link></Card>)}</div> : <Card id="public-shop-services-empty-state" elevation="none" className="mt-6 p-6 text-center"><h3 className="font-semibold">Services will be available soon</h3><p className="mt-2 text-sm text-admin-text-secondary">Contact {publicShop.name} directly for current offerings.</p></Card>}
      </section>

      <section id="public-automotive-shop-branches" aria-labelledby="public-shop-locations-title">
        <div><p className="text-sm font-semibold text-brand-primary-strong">Visit us</p><h2 id="public-shop-locations-title" className="mt-1 text-3xl font-semibold tracking-tight text-brand-ink">Locations</h2></div>
        {publicShop.branches.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{publicShop.branches.map(branch => {
          const address = branch.address.filter(Boolean).join(", ");
          return <Card id={`public-automotive-shop-branch-${branch.id}`} elevation="none" className="p-5 sm:p-6" key={branch.id}><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-semibold text-brand-ink">{branch.name}</h3><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-admin-text-secondary"><MapPin aria-hidden="true" className="mt-1 shrink-0 text-brand-primary" size={16}/>{address || "Contact the business for directions."}</p></div>{branch.acceptsBookings ? <span className="shrink-0 rounded-full bg-status-success-tint px-2.5 py-1 text-xs font-semibold text-status-success">Online booking</span> : null}</div>{branch.description ? <p className="mt-4 text-sm leading-6 text-admin-text-secondary">{branch.description}</p> : null}<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">{branch.phone ? <a className="font-medium text-brand-primary-strong hover:text-brand-primary" href={`tel:${branch.phone.replace(/[^\d+]/g, "")}`}>{branch.phone}</a> : null}{branch.mapUrl ? <a className="inline-flex items-center gap-1 font-medium text-brand-primary-strong hover:text-brand-primary" href={branch.mapUrl} target="_blank" rel="noopener noreferrer">Open map<ExternalLink aria-hidden="true" size={14}/></a> : null}</div><Hours hours={branch.hours}/><div className="mt-5 flex flex-wrap gap-2">{branch.acceptsBookings ? <Button id={`public-shop-branch-book-${branch.id}`} asChild size="sm"><Link href={`${bookingHref}?branch=${encodeURIComponent(branch.id)}`}>Book at this location</Link></Button> : null}{industry === "salon" ? <OpenQueueDisplay id={`public-salon-branch-queue-${branch.id}`} branchId={branch.id} publicSlug={slug} label="View customer queue"/> : null}</div></Card>;
        })}</div> : <Card id="public-shop-locations-empty-state" elevation="none" className="mt-6 p-6 text-center"><h3 className="font-semibold">Location details are coming soon</h3><p className="mt-2 text-sm text-admin-text-secondary">Contact {publicShop.name} directly for directions and opening hours.</p></Card>}
      </section>

      {publicShop.gallery.length > 0 ? <section id="public-automotive-shop-gallery" aria-labelledby="public-shop-gallery-title"><div><p className="text-sm font-semibold text-brand-primary-strong">Inside our business</p><h2 id="public-shop-gallery-title" className="mt-1 text-3xl font-semibold tracking-tight text-brand-ink">Gallery</h2></div><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">{publicShop.gallery.map((image, index) => <Image id={`public-shop-gallery-image-${index}`} className={`w-full rounded-ui-lg object-cover ${index === 0 ? "col-span-2 aspect-[2/1] md:col-span-2" : "aspect-square md:aspect-[4/3]"}`} src={image.url} alt={image.alt} width={800} height={600} unoptimized key={`${image.url}-${index}`}/>)}</div></section> : null}
    </div>

    <footer id="public-automotive-shop-footer" className="border-t border-admin-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-7 px-4 py-9 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><div><BrandWordmark className="w-24"/><p className="mt-3 max-w-lg text-sm text-admin-text-secondary">Online booking for {publicShop.name}, powered by {vertical.displayName}.</p><p className="mt-2 text-sm text-admin-text-muted">{[publicShop.phone, publicShop.email].filter(Boolean).join(" · ")}</p></div><nav id="public-shop-social-links" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-brand-primary-strong" aria-label={`${publicShop.name} links`}>{publicShop.website ? <a href={publicShop.website} target="_blank" rel="noopener noreferrer">Website</a> : null}{publicShop.facebook ? <a href={publicShop.facebook} target="_blank" rel="noopener noreferrer">Facebook</a> : null}{publicShop.instagram ? <a href={publicShop.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> : null}</nav></div>
    </footer>
  </main>;
}

function Hours({ hours }: { hours: PublicShop["branches"][number]["hours"] }) {
  const entries = Object.entries(hours ?? {}).filter((entry): entry is [string, { open?: string; close?: string; closed?: boolean }] => Boolean(entry[1]) && typeof entry[1] === "object");
  if (!entries.length) return null;
  return <details className="mt-4 rounded-ui-md border border-admin-border bg-admin-surface-muted px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-admin-text">Opening hours</summary><dl className="mt-3 grid grid-cols-[minmax(6rem,1fr)_auto] gap-x-4 gap-y-1.5 text-sm">{entries.map(([day, value]) => <div className="contents" key={day}><dt className="capitalize text-admin-text-muted">{day}</dt><dd className="text-right font-medium">{value.closed ? "Closed" : `${value.open}–${value.close}`}</dd></div>)}</dl></details>;
}
