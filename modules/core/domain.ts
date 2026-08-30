/** Shared ServiceCore records. These types deliberately contain no vehicle fields. */
export type OrganizationRole = "owner" | "manager" | "advisor" | "technician" | "cashier" | "viewer";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
};

export type Branch = {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  isActive: boolean;
};

export type Membership = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  isActive: boolean;
};

export type Customer = {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export type Service = {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  durationMinutes: number;
  basePriceCentavos: bigint;
  isActive: boolean;
};

/** A core appointment can exist without any industry-specific subject. */
export type Appointment = {
  id: string;
  organizationId: string;
  branchId: string;
  customerId: string;
  startsAt: string;
  endsAt: string | null;
  status: "requested" | "confirmed" | "checked_in" | "queued" | "completed" | "cancelled" | "no_show";
};

export type Product = {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  sellPriceCentavos: bigint;
  isActive: boolean;
};

export type InventoryItem = {
  id: string;
  organizationId: string;
  branchId: string | null;
  productId: string | null;
  quantityOnHand: number;
  reorderLevel: number;
};

export type Payment = {
  id: string;
  organizationId: string;
  branchId: string;
  amountCentavos: bigint;
  status: "pending" | "paid" | "failed" | "refunded" | "voided";
};

export type AuditEvent = {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string | null;
  eventType: string;
  createdAt: string;
};
