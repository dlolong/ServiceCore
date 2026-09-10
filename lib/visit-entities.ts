import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { customerSchema, firstError, normalizePlate, vehicleLabel, vehicleSchema } from "@/lib/crm";

export type VisitCustomerChoice = { id: string; name: string };
export type VisitVehicleChoice = { id: string; customer_id: string; label: string };
export type VisitEntityResult<T> = { data: T; error?: never } | { data?: never; error: string };
export type VisitEntityActor = { organizationId: string; role: string; industry: string };

export const visitCustomerSchema = customerSchema.pick({ fullName: true, phone: true, email: true }).extend({ requestId: z.uuid() });
export const visitVehicleSchema = vehicleSchema.pick({ customerId: true, make: true, model: true, plateNumber: true, vehicleType: true }).extend({ requestId: z.uuid() });
const canCreate = (actor: VisitEntityActor) => ["owner", "manager", "advisor"].includes(actor.role);

export async function createVisitCustomer(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<VisitCustomerChoice>> {
  if (!canCreate(actor)) return { error: "You do not have permission to create customers." };
  const parsed = visitCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const value = parsed.data;
  const email = value.email?.toLowerCase() ?? null;
  const payload = { id: value.requestId, organization_id: actor.organizationId, full_name: value.fullName, phone: value.phone, email };
  const result = await db.from("customers").insert(payload).select("id,full_name").single();
  if (!result.error && result.data) return { data: { id: result.data.id, name: result.data.full_name } };
  // A retry of the same submission may reuse its own completed insert, never overwrite it.
  if (result.error?.code === "23505") {
    const { data } = await db.from("customers").select("id,full_name,phone,email").eq("id", value.requestId).eq("organization_id", actor.organizationId).eq("is_archived", false).maybeSingle();
    if (data && data.full_name === value.fullName && data.phone === value.phone && data.email === email) return { data: { id: data.id, name: data.full_name } };
  }
  return { error: "Unable to create the customer. Check the details and try again." };
}

export async function createVisitVehicle(input: unknown, actor: VisitEntityActor, db: SupabaseClient): Promise<VisitEntityResult<VisitVehicleChoice>> {
  if (!canCreate(actor) || actor.industry !== "automotive") return { error: "You do not have permission to create vehicles." };
  const parsed = visitVehicleSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const value = parsed.data;
  const { data: customer, error: customerError } = await db.from("customers").select("id").eq("id", value.customerId).eq("organization_id", actor.organizationId).eq("is_archived", false).maybeSingle();
  if (customerError || !customer) return { error: "Select an active customer from this organization before creating a vehicle." };
  const payload = { id: value.requestId, organization_id: actor.organizationId, customer_id: value.customerId, make: value.make, model: value.model, plate_number: value.plateNumber, plate_normalized: value.plateNumber ? normalizePlate(value.plateNumber) : null, vehicle_type: value.vehicleType };
  const result = await db.from("vehicles").insert(payload).select("id,customer_id,make,model,plate_number").single();
  if (!result.error && result.data) return { data: { id: result.data.id, customer_id: result.data.customer_id, label: vehicleLabel(result.data) } };
  if (result.error?.code === "23505") {
    const { data } = await db.from("vehicles").select("id,customer_id,make,model,plate_number,vehicle_type").eq("id", value.requestId).eq("organization_id", actor.organizationId).eq("is_archived", false).maybeSingle();
    if (data && data.customer_id === value.customerId && data.make === value.make && data.model === value.model && data.plate_number === value.plateNumber && data.vehicle_type === value.vehicleType) return { data: { id: data.id, customer_id: data.customer_id, label: vehicleLabel(data) } };
  }
  return { error: "Unable to create the vehicle. Check its details and whether its plate already exists." };
}
