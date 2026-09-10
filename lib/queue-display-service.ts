import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zonedDateTimeToUtc } from "@/lib/operations";
import type { QueueDisplaySnapshot } from "@/lib/queue-display";
import { automotiveQueueDisplayItems, type AutomotiveQueueDisplayRow } from "@/modules/automotive/queue-display";
import { salonQueueDisplayItems, type SalonQueueDisplayRow } from "@/modules/salon/queue-display";

export class QueueDisplayError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 503) {
    super(status === 401 ? "The display session has ended. Ask a team member to reopen this display."
      : status === 403 || status === 404 ? "This queue display is unavailable. Ask a team member to check its access."
      : status === 400 ? "This queue display link is invalid."
      : "Queue updates are temporarily unavailable. Reconnecting…");
  }
}

export function queueDisplayDay(now: Date, timezone: string) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = zonedDateTimeToUtc(`${date}T00:00`, timezone);
  const end = zonedDateTimeToUtc(`${next.toISOString().slice(0, 10)}T00:00`, timezone);
  if (!start || !end) throw new QueueDisplayError(503);
  return { date, start: start.toISOString(), end: end.toISOString() };
}

async function allDisplayRows<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query(offset, offset + pageSize - 1);
    if (error) throw new QueueDisplayError(503);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** Authenticated display read; the URL branch is pinned independently of dashboard cookies. */
export async function loadQueueDisplay(branchId: string, db: SupabaseClient, now = new Date()): Promise<QueueDisplaySnapshot> {
  if (!z.uuid().safeParse(branchId).success) throw new QueueDisplayError(400);
  const auth = await db.auth.getUser();
  if (auth.error) throw new QueueDisplayError(auth.error.name === "AuthRetryableFetchError" || (auth.error.status ?? 0) >= 500 ? 503 : 401);
  if (!auth.data.user) throw new QueueDisplayError(401);
  const branchResult = await db.from("branches").select("id,organization_id,name,timezone,organizations(name,industry)").eq("id", branchId).eq("is_active", true).maybeSingle();
  if (branchResult.error) throw new QueueDisplayError(503);
  if (!branchResult.data) throw new QueueDisplayError(404);
  const branch = branchResult.data;
  const organization = Array.isArray(branch.organizations) ? branch.organizations[0] : branch.organizations;
  if (!organization || (organization.industry !== "automotive" && organization.industry !== "salon")) throw new QueueDisplayError(404);
  const access = await db.rpc("can_access_branch", { p_organization_id: branch.organization_id, p_branch_id: branchId });
  if (access.error) throw new QueueDisplayError(503);
  if (access.data !== true) throw new QueueDisplayError(403);
  const day = queueDisplayDay(now, branch.timezone);
  const groups = organization.industry === "automotive"
    ? automotiveQueueDisplayItems(await allDisplayRows<AutomotiveQueueDisplayRow>((from, to) => db.from("queue_entries")
      .select("source,queue_number,status")
      .eq("organization_id", branch.organization_id).eq("branch_id", branchId).eq("queue_date", day.date)
      .in("status", ["waiting", "called", "ready"]).order("queue_number").range(from, to)))
    : salonQueueDisplayItems(await allDisplayRows<SalonQueueDisplayRow>((from, to) => db.from("appointments")
      .select("id,status,starts_at,customers(full_name)")
      .eq("organization_id", branch.organization_id).eq("branch_id", branchId)
      .gte("starts_at", day.start).lt("starts_at", day.end)
      .in("status", ["checked_in", "in_service"]).order("starts_at").order("id").range(from, to)), branch.timezone);
  return {
    organizationName: organization.name,
    branchName: branch.name,
    industry: organization.industry,
    date: day.date,
    timezone: branch.timezone,
    refreshedAt: now.toISOString(),
    ...groups,
  };
}
