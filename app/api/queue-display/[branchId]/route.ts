import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadQueueDisplay, QueueDisplayError } from "@/lib/queue-display-service";
import { queueDisplayResponseHeaders } from "@/lib/private-route-security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { branchId } = await params;
    const snapshot = await loadQueueDisplay(branchId, await createClient());
    return NextResponse.json(snapshot, { headers: queueDisplayResponseHeaders });
  } catch (error) {
    const failure = error instanceof QueueDisplayError ? error : new QueueDisplayError(503);
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: queueDisplayResponseHeaders });
  }
}
