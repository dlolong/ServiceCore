import { z } from "zod";

const reservationReferenceSchema = z.object({
  inventoryItemId: z.uuid(),
  referenceType: z.string().regex(/^[a-z][a-z0-9_]{2,80}$/),
  referenceId: z.uuid(),
  quantity: z.number().positive().max(999_999_999).multipleOf(0.001),
  idempotencyKey: z.string().trim().min(1).max(200),
});

const reservationMutationSchema = z.object({
  reservationId: z.uuid(),
  quantity: z.number().positive().max(999_999_999).multipleOf(0.001),
  idempotencyKey: z.string().trim().min(1).max(200),
});

export type ReserveInventoryInput = z.output<typeof reservationReferenceSchema>;
export type MutateInventoryReservationInput = z.output<typeof reservationMutationSchema>;

export type CoreInventoryReservationPersistence = {
  reserve: (input: ReserveInventoryInput) => Promise<string>;
  consume: (input: MutateInventoryReservationInput) => Promise<string>;
  release: (input: MutateInventoryReservationInput) => Promise<string>;
};

export class InventoryReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryReservationError";
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InventoryReservationError(result.error.issues[0]?.message ?? "Inventory reservation details are invalid.");
  }
  return result.data;
}

export async function reserveInventory(input: ReserveInventoryInput, persistence: CoreInventoryReservationPersistence) {
  return persistence.reserve(parse(reservationReferenceSchema, input));
}

export async function consumeInventoryReservation(
  input: MutateInventoryReservationInput,
  persistence: CoreInventoryReservationPersistence,
) {
  return persistence.consume(parse(reservationMutationSchema, input));
}

export async function releaseInventoryReservation(
  input: MutateInventoryReservationInput,
  persistence: CoreInventoryReservationPersistence,
) {
  return persistence.release(parse(reservationMutationSchema, input));
}
