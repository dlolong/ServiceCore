import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { encryptDeliverySecret, type EncryptedDeliverySecret } from "@/lib/notifications/delivery-secret";

export const ESTIMATE_APPROVAL_LINK_LIFETIME_DAYS = 7;
export const ESTIMATE_APPROVAL_TOKEN_BYTES = 32;

export const estimateApprovalTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "This approval link is invalid.");
export const estimateApprovalCommentSchema = z.string().trim().max(1000);

const inactiveStateSchema = z.object({
  state: z.enum(["invalid", "expired", "revoked", "superseded"]),
});

const publicEstimateItemSchema = z.object({
  description: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCentavos: z.number().int().nonnegative(),
  discountCentavos: z.number().int().nonnegative(),
  lineTotalCentavos: z.number().int().nonnegative(),
});

const estimatePayloadSchema = z.object({
  state: z.enum(["active", "approved", "declined"]),
  expiresAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  business: z.object({ name: z.string(), phone: z.string().nullable() }),
  branch: z.object({
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.array(z.string().nullable()),
  }),
  job: z.object({
    reference: z.string(),
    vehicle: z.object({
      make: z.string().nullable(),
      model: z.string().nullable(),
      modelYear: z.number().int().nullable(),
      plateNumber: z.string().nullable(),
    }),
  }),
  estimate: z.object({
    version: z.number().int().positive(),
    subtotalCentavos: z.number().int().nonnegative(),
    discountCentavos: z.number().int().nonnegative(),
    taxCentavos: z.number().int().nonnegative(),
    totalCentavos: z.number().int().nonnegative(),
    items: z.array(publicEstimateItemSchema),
  }),
});

export const publicEstimateApprovalSchema = z.union([inactiveStateSchema, estimatePayloadSchema]);
export type PublicEstimateApproval = z.infer<typeof publicEstimateApprovalSchema>;

export type EstimateApprovalLinkPersistence = {
  create: (input: {
    estimateId:string;tokenHash:string;expiresAt:string;deliverySecret:EncryptedDeliverySecret|null;
  }) => Promise<{
    linkId:string;expiresAt:string;
    delivery:{email:{status:string;reason:string|null};sms:{status:string;reason:string|null}};
  }>;
  revoke: (linkId: string) => Promise<void>;
};

export class EstimateApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstimateApprovalError";
  }
}

export function createEstimateApprovalToken() {
  return randomBytes(ESTIMATE_APPROVAL_TOKEN_BYTES).toString("base64url");
}

export function hashEstimateApprovalToken(token: string) {
  const parsed = estimateApprovalTokenSchema.parse(token);
  return createHash("sha256").update(parsed).digest("hex");
}

export function estimateApprovalExpiry(now = new Date()) {
  return new Date(now.getTime() + ESTIMATE_APPROVAL_LINK_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
}

async function defaultPersistence(): Promise<EstimateApprovalLinkPersistence> {
  return import("@/modules/automotive/work-execution/estimate-approval.runtime").then((module) => module.estimateApprovalLinkPersistence);
}

export async function createEstimateApprovalLink(
  estimateId:string,
  persistence?:EstimateApprovalLinkPersistence,
  deliverySecretKey=process.env.NOTIFICATION_LINK_ENCRYPTION_KEY,
) {
  const parsedEstimateId = z.uuid().parse(estimateId);
  const token = createEstimateApprovalToken();
  const expiresAt = estimateApprovalExpiry().toISOString();
  const deliverySecret=deliverySecretKey?encryptDeliverySecret(token,deliverySecretKey):null;
  const result = await (persistence ?? await defaultPersistence()).create({
    estimateId: parsedEstimateId,
    tokenHash: hashEstimateApprovalToken(token),
    expiresAt,
    deliverySecret,
  });
  return { ...result, token };
}

export async function revokeEstimateApprovalLink(linkId: string, persistence?: EstimateApprovalLinkPersistence) {
  return (persistence ?? await defaultPersistence()).revoke(z.uuid().parse(linkId));
}

export function parsePublicEstimateApproval(value: unknown): PublicEstimateApproval {
  const result = publicEstimateApprovalSchema.safeParse(value);
  if (!result.success) throw new EstimateApprovalError("This estimate cannot be displayed right now.");
  return result.data;
}
