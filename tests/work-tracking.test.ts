import assert from "node:assert/strict";
import test from "node:test";

import {
  endAutomotiveJobWorkSession,
  formatWorkDuration,
  getAutomotiveWorkSessionElapsedSeconds,
  startAutomotiveJobWorkSession,
  summarizeAutomotiveWorkSessions,
  type AutomotiveWorkSession,
  type AutomotiveWorkSessionPersistence,
} from "../modules/automotive/work-tracking/work-session.service";

const jobOrderId = "11000000-0000-4000-8000-000000000001";
const staffId = "12000000-0000-4000-8000-000000000001";
const sessionId = "13000000-0000-4000-8000-000000000001";

function persistence(overrides: Partial<AutomotiveWorkSessionPersistence> = {}): AutomotiveWorkSessionPersistence {
  return {
    start: async () => sessionId,
    end: async () => sessionId,
    ...overrides,
  };
}

test("work tracking validates and delegates Start without client duration", async () => {
  let received: unknown;
  const result = await startAutomotiveJobWorkSession({ jobOrderId, staffId }, persistence({
    start: async (...input) => { received = input; return sessionId; },
  }));
  assert.equal(result, sessionId);
  assert.deepEqual(received, [jobOrderId, staffId]);
  await assert.rejects(() => startAutomotiveJobWorkSession({ jobOrderId: "bad" }, persistence()), /invalid/i);
});

test("Pause and Stop delegate only bounded note and session identity", async () => {
  let received: unknown;
  await endAutomotiveJobWorkSession({ sessionId, action: "pause", notes: " Waiting for filter " }, persistence({
    end: async (...input) => { received = input; return sessionId; },
  }));
  assert.deepEqual(received, [sessionId, "pause", "Waiting for filter"]);
  await assert.rejects(() => endAutomotiveJobWorkSession({ sessionId, action: "stop", notes: "x".repeat(1001) }, persistence()), /too big|too long/i);
});

test("elapsed time is derived from authoritative timestamps", () => {
  assert.equal(getAutomotiveWorkSessionElapsedSeconds({ startedAt: "2026-09-03T01:00:00.000Z", endedAt: "2026-09-03T01:45:30.000Z" }), 2730);
  assert.equal(getAutomotiveWorkSessionElapsedSeconds({ startedAt: "2026-09-03T01:00:00.000Z", endedAt: null }, new Date("2026-09-03T02:00:00.000Z")), 3600);
  assert.equal(formatWorkDuration(2730), "45m");
  assert.equal(formatWorkDuration(6330), "1h 45m");
});

test("labor summary adds technician effort instead of wall-clock duration", () => {
  const sessions: AutomotiveWorkSession[] = [
    { id: sessionId, jobOrderId, staffId, userId: null, technicianName: "Mark", startedAt: "2026-09-03T01:00:00.000Z", endedAt: "2026-09-03T03:00:00.000Z", status: "completed", endReason: "stopped", notes: null },
    { id: "13000000-0000-4000-8000-000000000002", jobOrderId, staffId: "12000000-0000-4000-8000-000000000002", userId: null, technicianName: "Leo", startedAt: "2026-09-03T02:00:00.000Z", endedAt: "2026-09-03T03:00:00.000Z", status: "completed", endReason: "stopped", notes: null },
  ];
  const summary = summarizeAutomotiveWorkSessions(sessions);
  assert.equal(summary.totalSeconds, 10_800);
  assert.equal(summary.technicianTotals.length, 2);
  assert.equal(summary.firstStartedAt, "2026-09-03T01:00:00.000Z");
  assert.equal(summary.lastActivityAt, "2026-09-03T03:00:00.000Z");
});
