import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queueDisplayDay, loadQueueDisplay } from "../lib/queue-display-service";
import { privateEstimateResponseHeaders, queueDisplayResponseHeaders } from "../lib/private-route-security";
import { automotiveQueueDisplayItems } from "../modules/automotive/queue-display";
import { abbreviatedClientName, salonQueueDisplayItems } from "../modules/salon/queue-display";

const branchId = "43000000-0000-4000-8000-000000000001";
const organizationId = "13000000-0000-4000-8000-000000000001";
const now = new Date("2026-09-09T16:15:00Z");

function database(options: {
  user?: boolean; industry?: string; branchMissing?: boolean; allowed?: boolean;
  branchError?: boolean; accessError?: boolean; rowsError?: boolean; pages?: unknown[][];
} = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const pages = [...(options.pages ?? [[]])];
  const db = {
    auth: { async getUser() { return { data: { user: options.user === false ? null : { id: "authenticated-user" } }, error: null }; } },
    async rpc(name: string, payload: unknown) {
      calls.push({ table: "rpc", method: name, args: [payload] });
      return { data: options.allowed !== false, error: options.accessError ? { message: "private failure" } : null };
    },
    from(table: string) {
      const query = {
        select(...args: unknown[]) { calls.push({ table, method: "select", args }); return query; },
        eq(...args: unknown[]) { calls.push({ table, method: "eq", args }); return query; },
        in(...args: unknown[]) { calls.push({ table, method: "in", args }); return query; },
        gte(...args: unknown[]) { calls.push({ table, method: "gte", args }); return query; },
        lt(...args: unknown[]) { calls.push({ table, method: "lt", args }); return query; },
        order(...args: unknown[]) { calls.push({ table, method: "order", args }); return query; },
        async range(...args: unknown[]) { calls.push({ table, method: "range", args }); return { data: pages.shift() ?? [], error: options.rowsError ? { message: "private failure" } : null }; },
        async maybeSingle() {
          return { data: options.branchMissing ? null : { id: branchId, organization_id: organizationId, name: "Main Branch", timezone: "Asia/Manila", organizations: { name: "Test Business", industry: options.industry ?? "automotive" } }, error: options.branchError ? { message: "private failure" } : null };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

test("queue display dates use branch midnight, including DST day lengths", () => {
  assert.deepEqual(queueDisplayDay(now, "Asia/Manila"), { date: "2026-09-10", start: "2026-09-09T16:00:00.000Z", end: "2026-09-10T16:00:00.000Z" });
  for (const [value, hours] of [["2026-03-08T12:00:00Z", 23], ["2026-11-01T12:00:00Z", 25]] as const) {
    const day = queueDisplayDay(new Date(value), "America/New_York");
    assert.equal((Date.parse(day.end) - Date.parse(day.start)) / 3_600_000, hours);
  }
});

test("Automotive display uses existing ticket labels and active queue states only", () => {
  const result = automotiveQueueDisplayItems([
    { source: "walk_in", queue_number: 3, status: "waiting" },
    { source: "appointment", queue_number: 1, status: "called" },
    { source: "walk_in", queue_number: 2, status: "ready" },
    { source: "walk_in", queue_number: 4, status: "converted_to_job" },
    { source: "walk_in", queue_number: 5, status: "cancelled" },
  ]);
  assert.deepEqual(result.serving.map(item => item.label), ["A-001", "W-002"]);
  assert.deepEqual(result.waiting.map(item => item.label), ["W-003"]);
  assert.deepEqual(Object.keys(result.waiting[0]).sort(), ["detail", "key", "label"]);
});

test("Salon display includes arrived clients only and omits full names and record identities", () => {
  const result = salonQueueDisplayItems([
    { id: "private-appointment-one", status: "checked_in", starts_at: "2026-09-10T02:00:00Z", customers: { full_name: "Maria Clara Santos" } },
    { id: "private-appointment-two", status: "in_service", starts_at: "2026-09-10T01:30:00Z", customers: [{ full_name: "Jun Dela Cruz" }] },
    ...["requested", "confirmed", "completed", "cancelled", "no_show"].map(status => ({ id: status, status, starts_at: null, customers: null })),
  ], "Asia/Manila");
  assert.equal(result.waiting[0].label, "Maria S.");
  assert.equal(result.serving[0].label, "Jun C.");
  assert.match(result.waiting[0].detail ?? "", /10:00/);
  assert.doesNotMatch(JSON.stringify(result), /private-appointment|Clara|Santos|Dela Cruz/);
  assert.equal(abbreviatedClientName(null), "Guest");
  assert.equal(abbreviatedClientName("  Ana  "), "Ana");
  assert.ok(abbreviatedClientName("A".repeat(100)).length <= 24);
});

test("display validates identity and authorizes branch before reading queue records", async () => {
  for (const [id, options, status] of [
    ["not-a-uuid", {}, 400],
    [branchId, { user: false }, 401],
    [branchId, { branchMissing: true }, 404],
    [branchId, { allowed: false }, 403],
    [branchId, { industry: "hospitality" }, 404],
    [branchId, { branchError: true }, 503],
    [branchId, { accessError: true }, 503],
  ] as const) {
    const { db, calls } = database(options);
    await assert.rejects(loadQueueDisplay(id, db, now), { status });
    assert.equal(calls.filter(call => ["queue_entries", "appointments"].includes(call.table)).length, 0);
  }
});

test("Automotive display pins organization, branch and local day and selects only public-facing fields", async () => {
  const { db, calls } = database({ pages: [[{ source: "walk_in", queue_number: 1, status: "waiting", notes: "PRIVATE NOTE", price: 50000 }]] });
  const result = await loadQueueDisplay(branchId, db, now);
  assert.equal(result.branchName, "Main Branch");
  assert.equal(result.industry, "automotive");
  assert.equal(result.date, "2026-09-10");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE NOTE|price|organization_id|branch_id/);
  assert.deepEqual(calls.find(call => call.method === "can_access_branch")?.args, [{ p_organization_id: organizationId, p_branch_id: branchId }]);
  for (const filter of [["organization_id", organizationId], ["branch_id", branchId], ["queue_date", "2026-09-10"]]) {
    assert.ok(calls.some(call => call.table === "queue_entries" && call.method === "eq" && JSON.stringify(call.args) === JSON.stringify(filter)));
  }
  assert.deepEqual(calls.find(call => call.table === "queue_entries" && call.method === "select")?.args, ["source,queue_number,status"]);
});

test("Salon display scopes direct Appointment reads and never depends on the old vehicle directory", async () => {
  const { db, calls } = database({ industry: "salon" });
  const result = await loadQueueDisplay(branchId, db, now);
  assert.deepEqual(result.waiting, []);
  assert.ok(calls.some(call => call.table === "appointments" && call.method === "gte" && call.args[1] === "2026-09-09T16:00:00.000Z"));
  assert.ok(calls.some(call => call.table === "appointments" && call.method === "lt" && call.args[1] === "2026-09-10T16:00:00.000Z"));
  assert.ok(calls.some(call => call.table === "appointments" && call.method === "eq" && call.args[0] === "organization_id" && call.args[1] === organizationId));
  assert.ok(calls.some(call => call.table === "appointments" && call.method === "eq" && call.args[0] === "branch_id" && call.args[1] === branchId));
  assert.ok(calls.every(call => !["appointment_directory", "queue_entries", "vehicles"].includes(call.table)));
});

test("large queues load every page and database failures never become a false empty queue", async () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ source: "walk_in", queue_number: index + 1, status: "waiting" }));
  const { db, calls } = database({ pages: [rows.slice(0, 500), rows.slice(500)] });
  assert.equal((await loadQueueDisplay(branchId, db, now)).waiting.length, 501);
  assert.deepEqual(calls.filter(call => call.method === "range").map(call => call.args), [[0, 499], [500, 999]]);
  const failed = database({ rowsError: true });
  await assert.rejects(loadQueueDisplay(branchId, failed.db, now), { status: 503, message: "Queue updates are temporarily unavailable. Reconnecting…" });
});

test("display HTML and API carry private no-store and noindex headers", () => {
  for (const path of [`/display/queue/${branchId}`, `/api/queue-display/${branchId}`]) {
    assert.deepEqual(privateEstimateResponseHeaders(path), queueDisplayResponseHeaders);
    assert.match(queueDisplayResponseHeaders["Cache-Control"], /private, no-store/);
    assert.match(queueDisplayResponseHeaders["X-Robots-Tag"], /noindex/);
  }
});
