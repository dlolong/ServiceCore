import { z } from "zod";

import {
  consumeInventoryReservation,
  releaseInventoryReservation,
  reserveInventory,
  type CoreInventoryReservationPersistence,
} from "@/modules/core/inventory/inventory-reservation.service";

const operationKeySchema = z.string().trim().min(1).max(200);
const reservePartSchema = z.object({
  jobOrderId: z.uuid(),
  inventoryItemId: z.uuid(),
  quantity: z.number().positive().max(999_999_999).multipleOf(0.001),
  idempotencyKey: operationKeySchema,
});
const mutatePartSchema = z.object({
  jobOrderId: z.uuid(),
  reservationId: z.uuid(),
  quantity: z.number().positive().max(999_999_999).multipleOf(0.001),
  idempotencyKey: operationKeySchema,
});
const reserveAllSchema = z.object({ jobOrderId: z.uuid(), idempotencyKey: operationKeySchema });

export type AutomotivePartReadiness = {
  inventoryItemId: string;
  reservationId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  requiredQuantity: number;
  reservedQuantity: number;
  consumedQuantity: number;
  releasedQuantity: number;
  remainingReservedQuantity: number;
  onHandQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  status: "AVAILABLE" | "RESERVED" | "PARTIAL" | "SHORTAGE" | "CONSUMED";
};

export type AutomotiveJobPartsPersistence = CoreInventoryReservationPersistence & {
  reserveAllRequired: (jobOrderId: string, idempotencyKey: string) => Promise<number>;
};

export class AutomotiveJobPartsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomotiveJobPartsError";
  }
}

async function runtime(jobOrderId: string): Promise<AutomotiveJobPartsPersistence> {
  const { createAutomotiveJobPartsPersistence } = await import("@/modules/automotive/work-execution/job-parts.runtime");
  return createAutomotiveJobPartsPersistence(jobOrderId);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AutomotiveJobPartsError(result.error.issues[0]?.message ?? "Part details are invalid.");
  return result.data;
}

export async function reserveJobOrderPart(input: z.input<typeof reservePartSchema>, persistence?: AutomotiveJobPartsPersistence) {
  const parsed = parse(reservePartSchema, input);
  return reserveInventory({
    inventoryItemId: parsed.inventoryItemId,
    referenceType: "job_order",
    referenceId: parsed.jobOrderId,
    quantity: parsed.quantity,
    idempotencyKey: parsed.idempotencyKey,
  }, persistence ?? await runtime(parsed.jobOrderId));
}

export async function reserveRequiredJobOrderParts(input: z.input<typeof reserveAllSchema>, persistence?: AutomotiveJobPartsPersistence) {
  const parsed = parse(reserveAllSchema, input);
  return (persistence ?? await runtime(parsed.jobOrderId)).reserveAllRequired(parsed.jobOrderId, parsed.idempotencyKey);
}

export async function consumeJobOrderPart(input: z.input<typeof mutatePartSchema>, persistence?: AutomotiveJobPartsPersistence) {
  const parsed = parse(mutatePartSchema, input);
  return consumeInventoryReservation({
    reservationId: parsed.reservationId,
    quantity: parsed.quantity,
    idempotencyKey: parsed.idempotencyKey,
  }, persistence ?? await runtime(parsed.jobOrderId));
}

export async function releaseJobOrderPart(input: z.input<typeof mutatePartSchema>, persistence?: AutomotiveJobPartsPersistence) {
  const parsed = parse(mutatePartSchema, input);
  return releaseInventoryReservation({
    reservationId: parsed.reservationId,
    quantity: parsed.quantity,
    idempotencyKey: parsed.idempotencyKey,
  }, persistence ?? await runtime(parsed.jobOrderId));
}
