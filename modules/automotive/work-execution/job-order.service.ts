import { z } from "zod";

export const jobOrderActions = ["start", "hold", "resume", "quality_check", "ready", "complete", "cancel"] as const;
export type JobOrderAction = (typeof jobOrderActions)[number];

export type AutomotiveJobOrderStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "queued"
  | "in_progress"
  | "on_hold"
  | "quality_check"
  | "ready"
  | "ready_for_release"
  | "completed"
  | "cancelled";

const transitionTargets: Record<JobOrderAction, Partial<Record<AutomotiveJobOrderStatus, AutomotiveJobOrderStatus>>> = {
  start: { queued: "in_progress", approved: "in_progress" },
  hold: { in_progress: "on_hold" },
  resume: { on_hold: "in_progress" },
  quality_check: { in_progress: "quality_check" },
  ready: { quality_check: "ready_for_release" },
  complete: { ready: "completed", ready_for_release: "completed" },
  cancel: { draft: "cancelled", queued: "cancelled" },
};

const queueConversionSchema = z.object({ queueId: z.uuid(), copyScheduledStaff: z.boolean().default(false), scheduledStaffMembershipId: z.uuid().nullable().default(null) });
const transitionSchema = z.object({ jobOrderId: z.uuid(), action: z.enum(jobOrderActions) });
const assignmentSchema = z.object({ jobOrderId: z.uuid(), technicianId: z.uuid().nullable(), promisedAt: z.iso.datetime({ offset: true }).nullable() });
const itemAssignmentSchema = z.object({ jobOrderId: z.uuid(), itemId: z.uuid(), technicianId: z.uuid().nullable() });
const additionalServiceSchema = z.object({ jobOrderId: z.uuid(), serviceId: z.uuid(), quantity: z.number().int().min(1).max(100), requiresApproval: z.boolean(), notes: z.string().trim().max(1000).nullable() });
const serviceTransitionSchema = z.object({ jobOrderId: z.uuid(), itemId: z.uuid(), action: z.enum(["approve", "decline"]) });
const estimateItemSchema = z.object({ estimateId: z.uuid(), itemId: z.uuid().nullable(), itemType: z.enum(["service","part","product","other"]), inventoryItemId: z.uuid().nullable(), description: z.string().trim().min(1).max(300), quantity: z.number().int().min(1).max(1000), unitPriceCentavos: z.number().int().min(0), discountCentavos: z.number().int().min(0) });
const authorizationSchema = z.object({ estimateId: z.uuid(), decision: z.enum(["approve","decline"]), method: z.enum(["in_person","phone","sms","messenger","email","other"]), note: z.string().trim().max(1000).nullable() });
const inspectionSchema = z.object({
  organizationId: z.uuid(), jobOrderId: z.uuid(), inspectedBy: z.uuid(),
  odometerIn: z.number().int().min(0).max(9_999_999).nullable(), fuelLevel: z.number().int().min(0).max(100).nullable(),
  exteriorNotes: z.string().trim().max(2000).nullable(), interiorNotes: z.string().trim().max(2000).nullable(),
  tireNotes: z.string().trim().max(2000).nullable(), lightNotes: z.string().trim().max(2000).nullable(),
  windshieldNotes: z.string().trim().max(2000).nullable(), damageNotes: z.string().trim().max(2000).nullable(),
  warningNotes: z.string().trim().max(2000).nullable(), belongingsNote: z.string().trim().max(2000).nullable(),
});

export class AutomotiveWorkExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomotiveWorkExecutionError";
  }
}

export type JobOrderPersistence = {
  createFromQueue: (queueId: string, copyScheduledStaff: boolean, scheduledStaffMembershipId: string | null) => Promise<string>;
  transition: (jobOrderId: string, action: JobOrderAction) => Promise<void>;
  assignTechnician: (jobOrderId: string, technicianId: string | null, promisedAt: string | null) => Promise<void>;
  assignItemTechnician: (itemId: string, technicianId: string | null) => Promise<void>;
  addService: (input: z.output<typeof additionalServiceSchema>) => Promise<void>;
  transitionService: (itemId: string, action: "approve" | "decline") => Promise<void>;
  saveInspection: (input: z.output<typeof inspectionSchema>) => Promise<void>;
  saveEstimateItem: (input: z.output<typeof estimateItemSchema>) => Promise<string>;
  recordAuthorization: (input: z.output<typeof authorizationSchema>) => Promise<void>;
};

async function runtime(): Promise<JobOrderPersistence> {
  return import("@/modules/automotive/work-execution/job-order.runtime").then((module) => module.automotiveJobOrderPersistence);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AutomotiveWorkExecutionError(result.error.issues[0]?.message ?? "Job order details are invalid.");
  return result.data;
}

export function getJobOrderTransitionTarget(status: AutomotiveJobOrderStatus, action: JobOrderAction) {
  return transitionTargets[action][status] ?? null;
}

export function assertJobOrderTransitionAllowed(status: AutomotiveJobOrderStatus, action: JobOrderAction) {
  const target = getJobOrderTransitionTarget(status, action);
  if (!target) throw new AutomotiveWorkExecutionError("This job order status transition is not allowed.");
  return target;
}

export async function createJobOrderFromQueue(input: { queueId: string; copyScheduledStaff?: boolean; scheduledStaffMembershipId?: string | null }, persistence?: JobOrderPersistence) {
  const parsed = parse(queueConversionSchema, input);
  return (persistence ?? await runtime()).createFromQueue(parsed.queueId, parsed.copyScheduledStaff, parsed.scheduledStaffMembershipId);
}

export async function transitionJobOrder(input: { jobOrderId: string; action: JobOrderAction }, persistence?: JobOrderPersistence) {
  const parsed = parse(transitionSchema, input);
  return (persistence ?? await runtime()).transition(parsed.jobOrderId, parsed.action);
}

export async function assignJobOrderTechnician(input: { jobOrderId: string; technicianId: string | null; promisedAt: string | null }, persistence?: JobOrderPersistence) {
  const parsed = parse(assignmentSchema, input);
  return (persistence ?? await runtime()).assignTechnician(parsed.jobOrderId, parsed.technicianId, parsed.promisedAt);
}

export async function assignJobOrderItemTechnician(input: { jobOrderId: string; itemId: string; technicianId: string | null }, persistence?: JobOrderPersistence) {
  const parsed = parse(itemAssignmentSchema, input);
  return (persistence ?? await runtime()).assignItemTechnician(parsed.itemId, parsed.technicianId);
}

export async function addJobOrderService(input: z.input<typeof additionalServiceSchema>, persistence?: JobOrderPersistence) {
  const parsed = parse(additionalServiceSchema, input);
  return (persistence ?? await runtime()).addService(parsed);
}

export async function transitionJobOrderService(input: z.input<typeof serviceTransitionSchema>, persistence?: JobOrderPersistence) {
  const parsed = parse(serviceTransitionSchema, input);
  return (persistence ?? await runtime()).transitionService(parsed.itemId, parsed.action);
}

export async function saveJobOrderInspection(input: z.input<typeof inspectionSchema>, persistence?: JobOrderPersistence) {
  const parsed = parse(inspectionSchema, input);
  return (persistence ?? await runtime()).saveInspection(parsed);
}

export async function saveEstimateItem(input: z.input<typeof estimateItemSchema>, persistence?: JobOrderPersistence) {
  const parsed = parse(estimateItemSchema, input);
  if (parsed.discountCentavos > parsed.quantity * parsed.unitPriceCentavos) throw new AutomotiveWorkExecutionError("Estimate item discount exceeds its amount.");
  if (["part","product"].includes(parsed.itemType) !== Boolean(parsed.inventoryItemId)) throw new AutomotiveWorkExecutionError("Select branch inventory for a part or product item.");
  return (persistence ?? await runtime()).saveEstimateItem(parsed);
}

export async function recordCustomerAuthorization(input: z.input<typeof authorizationSchema>, persistence?: JobOrderPersistence) {
  const parsed = parse(authorizationSchema, input);
  return (persistence ?? await runtime()).recordAuthorization(parsed);
}
