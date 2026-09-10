import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { QueueDisplaySnapshot } from "@/lib/queue-display";
import { QueueDisplayError } from "@/lib/queue-display-service";

/** The database returns only a published Salon's allowlisted display fields. */
export async function loadPublicSalonQueue(slug: string, branchId: string, db: SupabaseClient): Promise<QueueDisplaySnapshot> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !z.uuid().safeParse(branchId).success) {
    throw new QueueDisplayError(400);
  }
  const { data, error } = await db.rpc("get_public_salon_queue", { p_slug: slug, p_branch_id: branchId });
  if (error) throw new QueueDisplayError(503);
  if (!data) throw new QueueDisplayError(404);
  return data as QueueDisplaySnapshot;
}
