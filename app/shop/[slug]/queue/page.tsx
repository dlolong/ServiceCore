import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerQueueDisplay } from "@/components/customer-queue-display";
import type { PublicShop } from "@/lib/public-booking";
import { loadPublicSalonQueue } from "@/lib/public-queue-display";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Salon customer queue", robots: { index: false, follow: false, nocache: true } };

export default async function Page({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ branch?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const db = createPublicClient();
  const { data, error } = await db.rpc("get_public_shop", { p_slug: slug });
  const shop = data as PublicShop | null;
  if (error) throw new Error("Unable to load this customer queue. Please try again.");
  if (!shop || shop.industry !== "salon") notFound();
  const branch = query.branch === undefined ? shop.branches[0] : shop.branches.find(item => item.id === query.branch);
  if (!branch) notFound();
  const initialData = await loadPublicSalonQueue(slug, branch.id, db).catch(() => null);
  return <CustomerQueueDisplay key={`${slug}-${branch.id}`} branchId={branch.id} initialData={initialData}
    publicSalon={{ slug, branches: shop.branches.map(item => ({ id: item.id, name: item.name })) }}/>;
}
