import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPublicSalonQueue } from "../lib/public-queue-display";
import { privateEstimateResponseHeaders, queueDisplayResponseHeaders } from "../lib/private-route-security";

const branch = "40650000-0000-4000-8000-000000000001";
function database(data: unknown, error: unknown = null) {
  const calls: unknown[] = [];
  return { calls, db: { rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data, error }; } } as unknown as SupabaseClient };
}

test("public queue calls only the narrowly scoped RPC without staff authentication", async () => {
  const snapshot = { industry: "salon", serving: [], waiting: [] };
  const { db, calls } = database(snapshot);
  assert.deepEqual(await loadPublicSalonQueue("published-salon", branch, db), snapshot);
  assert.deepEqual(calls, [["get_public_salon_queue", { p_slug: "published-salon", p_branch_id: branch }]]);
});

test("malformed public queue inputs cannot reach the database", async () => {
  const { db, calls } = database(null);
  for (const [slug, id] of [["salon", "not-a-uuid"], ["../salon", branch], ["a".repeat(121), branch]]) {
    await assert.rejects(loadPublicSalonQueue(slug, id, db), { status: 400 });
  }
  assert.equal(calls.length, 0);
});

test("missing or unpublished queues fail closed and database errors stay private", async () => {
  await assert.rejects(loadPublicSalonQueue("salon", branch, database(null).db), { status: 404 });
  await assert.rejects(loadPublicSalonQueue("salon", branch, database(null, { message: "private SQL details" }).db), error => {
    assert.equal((error as { status: number }).status, 503);
    assert.doesNotMatch(String(error), /private SQL details/);
    return true;
  });
});

test("public queue HTML and API have no-store and noindex headers", () => {
  for (const path of ["/shop/my-salon/queue", "/api/public/queue/my-salon/" + branch]) {
    assert.deepEqual(privateEstimateResponseHeaders(path), queueDisplayResponseHeaders);
  }
  assert.equal(privateEstimateResponseHeaders("/shop/my-salon"), null);
});
