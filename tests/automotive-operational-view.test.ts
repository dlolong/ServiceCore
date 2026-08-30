import assert from "node:assert/strict";
import test from "node:test";
import { assignmentContextLabel } from "../modules/automotive/scheduling/appointment-operational-view.model";

test("KarKR operational context represents multiple scheduled staff and resources", () => {
  const labels = assignmentContextLabel({
    scheduledStaff: [
      { id: "staff-a", displayName: "Juan Dela Cruz", canInitializeJobOrder: true },
      { id: "staff-b", displayName: "Maria Santos", canInitializeJobOrder: false },
    ],
    scheduledResources: [
      { id: "bay-a", name: "Detailing Bay 1", type: "bay" },
      { id: "bay-b", name: "Wash Bay 2", type: "bay" },
    ],
  });
  assert.equal(labels.staff, "Juan Dela Cruz, Maria Santos");
  assert.equal(labels.resources, "Detailing Bay 1, Wash Bay 2");
});

test("KarKR operational context safely represents unassigned appointments", () => {
  assert.deepEqual(assignmentContextLabel({ scheduledStaff: [], scheduledResources: [] }), { staff: "Unassigned", resources: "Unassigned" });
});
