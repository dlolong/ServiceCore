import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicSalonQueue } from "@/lib/public-queue-display";
import { QueueDisplayError } from "@/lib/queue-display-service";
import { queueDisplayResponseHeaders } from "@/lib/private-route-security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; branchId: string }> }) {
  try {
    const { slug, branchId } = await params;
    return NextResponse.json(await loadPublicSalonQueue(slug, branchId, createPublicClient()), { headers: queueDisplayResponseHeaders });
  } catch (error) {
    const failure = error instanceof QueueDisplayError ? error : new QueueDisplayError(503);
    return NextResponse.json({ error: failure.status === 503 ? "Queue updates are temporarily unavailable." : "This customer queue is unavailable." }, { status: failure.status, headers: queueDisplayResponseHeaders });
  }
}
