import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OpenQueueDisplay } from "@/components/open-queue-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/operations";
import type { PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";
import { verticalBrands } from "@/modules/platform/brand";

async function shop(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_shop", { p_slug: slug });
  return data as PublicShop | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const publicShop = await shop(slug);
  if (!publicShop) return { title: "Shop not found" };
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
  const publicShop = await shop(slug);
  if (!publicShop) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": publicShop.industry === "salon" ? "BeautySalon" : "AutomotiveBusiness",
    name: publicShop.name,
    description: publicShop.description,
    telephone: publicShop.phone,
    url: `/shop/${slug}`,
    image: [publicShop.logoUrl, publicShop.coverUrl].filter(Boolean),
    address: publicShop.branches[0]?.address.filter(Boolean).join(", "),
  };

  return <main id={publicShop.industry === "salon" ? "public-salon-shop-page" : "public-automotive-shop-page"} className="min-h-screen bg-slate-50 text-admin-text">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />
    <section id="public-automotive-shop-hero" className="relative overflow-hidden bg-brand-ink text-white">
      <div className="mx-auto grid min-h-[420px] max-w-7xl items-center gap-8 px-5 py-16 lg:grid-cols-2">
        {publicShop.coverUrl && <Image src={publicShop.coverUrl} alt="" fill unoptimized sizes="100vw" className="absolute inset-0 size-full object-cover opacity-25" />}
        <div className="relative">
          {publicShop.logoUrl && <Image src={publicShop.logoUrl} alt={`${publicShop.name} logo`} width={80} height={80} unoptimized className="mb-6 size-20 rounded-2xl bg-white object-contain p-2" />}
          <p className="font-bold text-blue-300">{publicShop.industry === "salon" ? "Salon & beauty" : "Automotive care"} powered by {verticalBrands[publicShop.industry ?? "automotive"].displayName}</p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">{publicShop.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-zinc-200">{publicShop.description ?? (publicShop.industry === "salon" ? "Your next salon visit, conveniently booked online." : "Professional automotive care, conveniently booked online.")}</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button id="public-automotive-shop-book-button" asChild><Link href={`/shop/${slug}/book`}>Request a booking</Link></Button>
          {publicShop.industry === "salon" && publicShop.branches[0] ? <OpenQueueDisplay id="public-salon-queue-link" branchId={publicShop.branches[0].id} publicSlug={slug} label="View customer queue"/> : null}</div>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-7xl space-y-12 px-5 py-12">
      <section id="public-automotive-shop-services">
        <h2 className="text-3xl font-black">{publicShop.industry === "salon" ? "Treatments" : "Services"}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{publicShop.services.map((service) => <Card id={`public-automotive-shop-service-${service.id}`} elevation="none" className="p-5" key={service.id}><p className="text-xs font-bold text-brand-primary-strong">{service.category}</p><h3 className="mt-1 text-xl font-black">{service.name}</h3><p className="mt-2 text-sm text-zinc-600">{service.description}</p><div className="mt-4 flex justify-between text-sm"><span>{service.durationMinutes} min</span><strong>From {formatMoney(service.priceCentavos)}</strong></div></Card>)}</div>
      </section>
      <section id="public-automotive-shop-branches">
        <h2 className="text-3xl font-black">Branches</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">{publicShop.branches.map((branch) => <Card id={`public-automotive-shop-branch-${branch.id}`} elevation="none" className="p-5" key={branch.id}><h3 className="text-xl font-black">{branch.name}</h3><p className="mt-2 text-sm text-zinc-600">{branch.address.filter(Boolean).join(", ")}</p><p className="mt-2 text-sm">{branch.phone}</p>{branch.mapUrl && <a className="mt-3 inline-block font-bold text-brand-primary-strong" href={branch.mapUrl} target="_blank" rel="noreferrer">Open map</a>}<Hours hours={branch.hours} />{publicShop.industry === "salon" ? <div className="mt-4"><OpenQueueDisplay id={`public-salon-branch-queue-${branch.id}`} branchId={branch.id} publicSlug={slug} label="View customer queue"/></div> : null}</Card>)}</div>
      </section>
      {publicShop.gallery.length > 0 && <section id="public-automotive-shop-gallery"><h2 className="text-3xl font-black">Gallery</h2><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">{publicShop.gallery.map((image, index) => <Image className="aspect-[4/3] w-full rounded-ui-lg object-cover" src={image.url} alt={image.alt} width={800} height={600} unoptimized key={`${image.url}-${index}`} />)}</div></section>}
      <footer id="public-automotive-shop-footer" className="border-t py-8 text-sm text-zinc-600"><p>{publicShop.phone} {publicShop.email && `· ${publicShop.email}`}</p><div className="mt-2 flex gap-4">{publicShop.website && <a href={publicShop.website}>Website</a>}{publicShop.facebook && <a href={publicShop.facebook}>Facebook</a>}{publicShop.instagram && <a href={publicShop.instagram}>Instagram</a>}</div></footer>
    </div>
  </main>;
}

function Hours({ hours }: { hours: PublicShop["branches"][number]["hours"] }) {
  return <dl className="mt-4 grid grid-cols-2 gap-1 text-sm">{Object.entries(hours).map(([day, value]) => <div className="contents" key={day}><dt className="capitalize text-zinc-500">{day}</dt><dd>{value.closed ? "Closed" : `${value.open}–${value.close}`}</dd></div>)}</dl>;
}
