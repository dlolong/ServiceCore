import type { Metadata } from "next";
import { CustomerQueueDisplay } from "@/components/customer-queue-display";
import { createClient } from "@/lib/supabase/server";
import { loadQueueDisplay } from "@/lib/queue-display-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer queue display", robots: { index: false, follow: false, nocache: true } };

export default async function QueueDisplayPage({ params }: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await params;
  const initialData = await loadQueueDisplay(branchId, await createClient()).catch(() => null);
  return <CustomerQueueDisplay branchId={branchId} initialData={initialData}/>;
}
