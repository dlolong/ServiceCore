import assert from "node:assert/strict";
import test from "node:test";
import { selectedValues } from "../lib/operations";

import { saveAutomotiveAppointment } from "../modules/automotive/scheduling/automotive-scheduling.service";
import {
  SchedulingError,
  saveAppointmentWithPersistence,
  type SaveAppointmentInput,
  type SchedulingServiceDependencies,
} from "../modules/core/scheduling/scheduling.service";

const organizationId = "13000000-0000-4000-8000-000000000001";
const branchId = "43000000-0000-4000-8000-000000000001";
const customerId = "53000000-0000-4000-8000-000000000001";
const serviceId = "83000000-0000-4000-8000-000000000001";
const vehicleId = "63000000-0000-4000-8000-000000000001";
const maintenanceDueId = "73000000-0000-4000-8000-000000000001";

const coreInput: SaveAppointmentInput = {
  appointmentId: null,
  organizationId,
  branchId,
  customerId,
  serviceIds: [serviceId],
  scheduledStart: "2026-08-28T02:00:00.000Z",
  customerNote: null,
  internalNote: null,
};

function coreDependencies(overrides: Partial<SchedulingServiceDependencies> = {}): SchedulingServiceDependencies {
  return {
    getActor: async () => ({ organizationId, role: "advisor", branchIds: [branchId] }),
    validateEntities: async () => undefined,
    evaluateAvailability: async () => ({ available: true, conflicts: [], scheduledEnd: "2026-08-28T03:00:00.000Z", durationMinutes: 60 }),
    ...overrides,
  };
}

test("core scheduling saves a valid appointment without vehicle data", async () => {
  let persistedInput: SaveAppointmentInput | undefined;
  const result = await saveAppointmentWithPersistence(coreInput, async (input) => {
    persistedInput = input;
    return "appointment-id";
  }, coreDependencies());

  assert.equal(result, "appointment-id");
  assert.equal("vehicleId" in (persistedInput ?? {}), false);
});

for (const [staffId, resourceId] of [
  ["", ""],
  ["33000000-0000-4000-8000-000000000001", ""],
  ["", "93000000-0000-4000-8000-000000000001"],
  ["33000000-0000-4000-8000-000000000001", "93000000-0000-4000-8000-000000000001"],
]) {
  test(`appointment form saves with staff ${staffId ? "assigned" : "unassigned"} and resource ${resourceId ? "assigned" : "unassigned"}`, async () => {
    const data = new FormData();
    data.set("staffIds", staffId);
    data.set("resourceIds", resourceId);
    const input = {
      ...coreInput,
      staffAssignments: selectedValues(data, "staffIds").map(staffId => ({ staffId })),
      resourceAssignments: selectedValues(data, "resourceIds").map(resourceId => ({ resourceId })),
    };
    const result = await saveAppointmentWithPersistence(input, async (saved) => {
      assert.deepEqual(saved.staffAssignments, staffId ? [{ staffId }] : []);
      assert.deepEqual(saved.resourceAssignments, resourceId ? [{ resourceId }] : []);
      return "saved-appointment";
    }, coreDependencies());
    assert.equal(result, "saved-appointment");
  });
}

test("appointment validation gives actionable errors and never persists malformed selections", async () => {
  for (const [changes, message] of [
    [{ customerId: "" }, "Select an existing customer or create one."],
    [{ serviceIds: [] }, "Select at least one service."],
    [{ staffAssignments: [{ staffId: "not-a-uuid" }] }, "Select a valid staff member or leave staff unassigned."],
    [{ resourceAssignments: [{ resourceId: "not-a-uuid" }] }, "Select a valid resource or leave it unassigned."],
  ] as const) {
    let persisted = false;
    await assert.rejects(saveAppointmentWithPersistence({ ...coreInput, ...changes } as SaveAppointmentInput, async () => {
      persisted = true;
      return "unexpected";
    }, coreDependencies()), { name: "SchedulingError", message });
    assert.equal(persisted, false);
  }
  const data = new FormData();
  data.append("staffIds", "");
  data.append("staffIds", "malformed-id");
  assert.deepEqual(selectedValues(data, "staffIds"), ["malformed-id"]);
});

test("core scheduling denies a membership from another organization", async () => {
  await assert.rejects(
    saveAppointmentWithPersistence(coreInput, async () => "unused", coreDependencies({
      getActor: async () => ({ organizationId: "13000000-0000-4000-8000-000000000002", role: "advisor", branchIds: [branchId] }),
    })),
    /Scheduling access denied/,
  );
});

test("core scheduling denies an unauthorized branch", async () => {
  await assert.rejects(
    saveAppointmentWithPersistence(coreInput, async () => "unused", coreDependencies({
      getActor: async () => ({ organizationId, role: "advisor", branchIds: [] }),
    })),
    /Branch not available/,
  );
});

test("core scheduling blocks an appointment overlap unless the authorized KarKR flow requests an override", async () => {
  const conflictDependencies = coreDependencies({
    evaluateAvailability: async () => ({ available: false, scheduledEnd: "2026-08-28T03:00:00.000Z", durationMinutes: 60, conflicts: [{ type: "appointment_conflict", code: "APPOINTMENT_OVERLAP", message: "Another appointment overlaps this time." }] }),
  });
  await assert.rejects(saveAppointmentWithPersistence(coreInput, async () => "unused", conflictDependencies), /may overlap/);
  const result = await saveAppointmentWithPersistence({ ...coreInput, allowAppointmentConflict: true }, async () => "overridden", conflictDependencies);
  assert.equal(result, "overridden");
});

for (const errorMessage of ["Customer not found.", "Selected service is unavailable."]) {
  test(`core scheduling controls ${errorMessage.toLowerCase()}`, async () => {
    await assert.rejects(
      saveAppointmentWithPersistence(coreInput, async () => "unused", coreDependencies({
        validateEntities: async () => { throw new SchedulingError(errorMessage); },
      })),
      new RegExp(errorMessage.replace(".", "\\.")),
    );
  });
}

test("automotive scheduling validates and atomically persists a valid vehicle association", async () => {
  let persistedVehicleId: string | undefined;
  const result = await saveAutomotiveAppointment({ ...coreInput, vehicleId }, {
    validateVehicle: async (actualOrganizationId, actualCustomerId, actualVehicleId) => {
      assert.equal(actualOrganizationId, organizationId);
      assert.equal(actualCustomerId, customerId);
      assert.equal(actualVehicleId, vehicleId);
    },
    coreDependencies: coreDependencies(),
    persist: async (_input, actualVehicleId) => {
      persistedVehicleId = actualVehicleId;
      return "automotive-appointment-id";
    },
  });

  assert.equal(result, "automotive-appointment-id");
  assert.equal(persistedVehicleId, vehicleId);
});

test("automotive scheduling carries maintenance linkage only to its atomic persistence extension", async () => {
  let persistedMaintenanceDueId: string | null | undefined;
  const result = await saveAutomotiveAppointment({ ...coreInput, vehicleId, maintenanceDueId }, {
    validateVehicle: async () => undefined,
    getActiveMaintenanceAppointment: async (lookup) => {
      assert.deepEqual(lookup, { maintenanceDueId, branchId, customerId, vehicleId, serviceIds: [serviceId] });
      return null;
    },
    coreDependencies: coreDependencies(),
    persist: async (input, _vehicleId, actualMaintenanceDueId) => {
      assert.equal("maintenanceDueId" in input, false);
      persistedMaintenanceDueId = actualMaintenanceDueId;
      return "linked-appointment-id";
    },
  });

  assert.equal(result, "linked-appointment-id");
  assert.equal(persistedMaintenanceDueId, maintenanceDueId);
});

test("automotive scheduling reuses an active maintenance appointment instead of creating a duplicate", async () => {
  let persisted = false;
  const result = await saveAutomotiveAppointment({ ...coreInput, vehicleId, maintenanceDueId }, {
    validateVehicle: async () => undefined,
    getActiveMaintenanceAppointment: async () => "existing-appointment-id",
    coreDependencies: coreDependencies(),
    persist: async () => { persisted = true; return "duplicate"; },
  });

  assert.equal(result, "existing-appointment-id");
  assert.equal(persisted, false);
});

test("KarKR scheduling preserves its required-vehicle policy", async () => {
  await assert.rejects(
    saveAutomotiveAppointment({ ...coreInput, vehicleId: null }, {
      validateVehicle: async () => undefined,
      coreDependencies: coreDependencies(),
    }),
    /vehicle is required/i,
  );
});

for (const [scenario, errorMessage] of [
  ["a cross-tenant vehicle", "Vehicle not found."],
  ["a vehicle owned by another customer", "Vehicle does not belong to this customer."],
] as const) {
  test(`automotive scheduling rejects ${scenario}`, async () => {
    await assert.rejects(
      saveAutomotiveAppointment({ ...coreInput, vehicleId }, {
        validateVehicle: async () => { throw new Error(errorMessage); },
        coreDependencies: coreDependencies(),
      }),
      new RegExp(errorMessage.replace(".", "\\.")),
    );
  });
}
