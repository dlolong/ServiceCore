import assert from "node:assert/strict";
import test from "node:test";

import {
  addJobOrderService,
  assertJobOrderTransitionAllowed,
  assignJobOrderTechnician,
  AutomotiveWorkExecutionError,
  createJobOrderFromQueue,
  getJobOrderTransitionTarget,
  transitionJobOrder,
  type JobOrderPersistence,
} from "../modules/automotive/work-execution/job-order.service";

const queueId = "41000000-0000-4000-8000-000000000001";
const jobOrderId = "91000000-0000-4000-8000-000000000001";
const serviceId = "81000000-0000-4000-8000-000000000001";

function persistence(overrides: Partial<JobOrderPersistence> = {}): JobOrderPersistence {
  return {
    createFromQueue: async () => jobOrderId,
    transition: async () => undefined,
    assignTechnician: async () => undefined,
    assignItemTechnician: async () => undefined,
    addService: async () => undefined,
    transitionService: async () => undefined,
    saveInspection: async () => undefined,
    saveEstimateItem: async () => "92000000-0000-4000-8000-000000000001",
    recordAuthorization: async () => undefined,
    ...overrides,
  };
}

test("automotive work execution converts a queue entry through its persistence boundary", async () => {
  let persistedQueueId = "";
  const result = await createJobOrderFromQueue({ queueId }, persistence({
    createFromQueue: async (value) => { persistedQueueId = value; return jobOrderId; },
  }));
  assert.equal(result, jobOrderId);
  assert.equal(persistedQueueId, queueId);
});

test("queue conversion does not copy scheduled staff without explicit user intent", async () => {
  let copyScheduledStaff: boolean | undefined;
  let selectedMembershipId: string | null | undefined;
  await createJobOrderFromQueue({ queueId }, persistence({
    createFromQueue: async (_queueId, copy, membershipId) => { copyScheduledStaff = copy; selectedMembershipId = membershipId; return jobOrderId; },
  }));
  assert.equal(copyScheduledStaff, false);
  assert.equal(selectedMembershipId, null);
});

test("queue conversion carries only explicit scheduled-Staff copy intent", async () => {
  const staffId = "31000000-0000-4000-8000-000000000001";
  let persistedIntent: { copy: boolean; staffId: string | null } | undefined;
  await createJobOrderFromQueue({ queueId, copyScheduledStaff: true, scheduledStaffId: staffId }, persistence({
    createFromQueue: async (_queueId, copy, selectedStaffId) => { persistedIntent = { copy, staffId: selectedStaffId }; return jobOrderId; },
  }));
  assert.deepEqual(persistedIntent, { copy: true, staffId });
});

test("job status policy allows the current QC path", () => {
  assert.equal(getJobOrderTransitionTarget("in_progress", "quality_check"), "quality_check");
  assert.equal(getJobOrderTransitionTarget("quality_check", "ready"), "ready_for_release");
  assert.equal(getJobOrderTransitionTarget("ready_for_release", "complete"), "completed");
});

test("job status policy rejects release directly from active work", () => {
  assert.throws(
    () => assertJobOrderTransitionAllowed("in_progress", "complete"),
    AutomotiveWorkExecutionError,
  );
});

test("transition service accepts only explicit automotive actions", async () => {
  await assert.rejects(
    transitionJobOrder({ jobOrderId, action: "release" as never }, persistence()),
    /Invalid option/,
  );
});

test("technician assignment preserves nullable unassignment", async () => {
  let assignedTechnicianId: string | null | undefined;
  await assignJobOrderTechnician({ jobOrderId, staffId: null, promisedAt: null }, persistence({
    assignTechnician: async (_jobOrderId, value) => { assignedTechnicianId = value; },
  }));
  assert.equal(assignedTechnicianId, null);
});

test("additional work keeps quantity integral and leaves totals to PostgreSQL", async () => {
  let quantity = 0;
  await addJobOrderService({ jobOrderId, serviceId, quantity: 3, requiresApproval: true, notes: null }, persistence({
    addService: async (input) => { quantity = input.quantity; },
  }));
  assert.equal(quantity, 3);
  await assert.rejects(
    addJobOrderService({ jobOrderId, serviceId, quantity: 1.5, requiresApproval: true, notes: null }, persistence()),
    /expected int/,
  );
});
