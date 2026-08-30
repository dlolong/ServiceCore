import assert from "node:assert/strict";
import test from "node:test";

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
