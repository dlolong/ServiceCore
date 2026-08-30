"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDashboardContext } from "@/lib/auth/context";
import { branchSchema, customerSchema, firstError, formValue, normalizePhone, normalizePlate, vehicleSchema } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

function message(path: string, kind: "error" | "message", text: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
}
function safeReturnPath(data: FormData, fallback: string) {
  const value = formValue(data, "returnTo");
  return value.startsWith("/dashboard/") && !value.includes("//") ? value : fallback;
}
function listReturnPath(data: FormData, fallback: string) {
  const path = safeReturnPath(data, fallback);
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("create");
  params.delete("edit");
  params.delete("error");
  params.delete("warning");
  params.delete("duplicateId");
  const remaining = params.toString();
  return remaining ? `${pathname}?${remaining}` : pathname;
}
const canOperate = (role: string) => ["owner", "manager", "advisor"].includes(role);
const canManageBranches = (role: string) => ["owner", "manager"].includes(role);

function branchInput(data: FormData) { return Object.fromEntries(["name","addressLine","barangay","city","province","postalCode","country","phone","email","openingNotes"].map((key) => [key, formValue(data, key)])); }
function customerInput(data: FormData) { return { ...Object.fromEntries(["fullName","phone","email","addressLine","city","province","notes"].map((key) => [key, formValue(data, key)])), acceptDuplicate: data.get("acceptDuplicate") === "on" }; }
function vehicleInput(data: FormData) { return { ...Object.fromEntries(["customerId","make","model","plateNumber","modelYear","variant","color","vehicleType","fuelType","transmission","odometerKm","vin","engineNumber","notes"].map((key) => [key, formValue(data, key)])), acceptDuplicate: data.get("acceptDuplicate") === "on" }; }

export async function saveBranch(data: FormData) {
  const id = formValue(data, "id"); const parsed = branchSchema.safeParse(branchInput(data));
  const back = id ? `/dashboard/settings/branches/${id}/edit` : "/dashboard/settings/branches/new";
  if (!parsed.success) message(back, "error", firstError(parsed.error));
  const { activeMembership } = await getDashboardContext(); const supabase = await createClient();
  if (!canManageBranches(activeMembership.role)) message("/dashboard/settings/branches", "error", "Owner or manager access is required.");
  const values = parsed.data;
  const payload = { organization_id: activeMembership.organizationId, name: values.name, address_line: values.addressLine, barangay: values.barangay, city: values.city, province: values.province, postal_code: values.postalCode, country: values.country, phone: values.phone, email: values.email, opening_notes: values.openingNotes };
  const query = id ? supabase.from("branches").update(payload).eq("id", id).eq("organization_id", activeMembership.organizationId) : supabase.from("branches").insert(payload);
  const { error } = await query;
  if (error) message(back, "error", error.code === "23505" ? "A branch with this name already exists." : "Unable to save this branch.");
  revalidatePath("/dashboard"); message("/dashboard/settings/branches", "message", `Branch ${id ? "updated" : "created"}.`);
}

export async function setPrimaryBranch(data: FormData) {
  const id = formValue(data, "id"); const { activeMembership } = await getDashboardContext(); const supabase = await createClient();
  if (!canManageBranches(activeMembership.role)) message("/dashboard/settings/branches", "error", "Owner or manager access is required.");
  const { error } = await supabase.rpc("set_primary_branch", { p_branch_id: id });
  if (error) message("/dashboard/settings/branches", "error", "Unable to change the default branch.");
  revalidatePath("/dashboard"); message("/dashboard/settings/branches", "message", "Default branch changed.");
}

export async function toggleBranch(data: FormData) {
  const id = formValue(data, "id"); const active = formValue(data, "active") === "true"; const { activeMembership } = await getDashboardContext(); const supabase = await createClient();
  if (!canManageBranches(activeMembership.role)) message("/dashboard/settings/branches", "error", "Owner or manager access is required.");
  const { error } = await supabase.rpc("set_branch_active", { p_branch_id: id, p_is_active: active });
  if (error) message("/dashboard/settings/branches", "error", error.message.includes("keep one") ? "Add or activate another branch before deactivating this one." : "Unable to update the branch.");
  revalidatePath("/dashboard"); message("/dashboard/settings/branches", "message", `Branch ${active ? "activated" : "deactivated"}.`);
}

export async function saveCustomer(data: FormData) {
  const id = formValue(data, "id"); const parsed = customerSchema.safeParse(customerInput(data)); const back = safeReturnPath(data, id ? `/dashboard/customers/${id}/edit` : "/dashboard/customers/new");
  if (!parsed.success) message(back, "error", firstError(parsed.error));
  const { activeMembership } = await getDashboardContext(); const supabase = await createClient(); if (!canOperate(activeMembership.role)) message("/dashboard/customers", "error", "You have read-only access.");
  const values = parsed.data; const normalized = values.phone ? normalizePhone(values.phone) : null;
  if (!values.acceptDuplicate && (normalized || values.email)) {
    let query = supabase.from("customers").select("id, full_name").eq("organization_id", activeMembership.organizationId).limit(1);
    if (id) query = query.neq("id", id);
    const filters = [normalized && `phone_normalized.eq.${normalized}`, values.email && `email.ilike.${values.email}`].filter(Boolean).join(",");
    const { data: duplicate } = filters ? await query.or(filters).maybeSingle() : { data: null };
    if (duplicate) redirect(`${back}${back.includes("?") ? "&" : "?"}warning=${encodeURIComponent(`Possible duplicate: ${duplicate.full_name}`)}&duplicateId=${duplicate.id}`);
  }
  const payload = { organization_id: activeMembership.organizationId, full_name: values.fullName, phone: values.phone, email: values.email, address_line: values.addressLine, city: values.city, province: values.province, notes: values.notes };
  const result = id ? await supabase.from("customers").update(payload).eq("id", id).eq("organization_id", activeMembership.organizationId).select("id").maybeSingle() : await supabase.from("customers").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id }).select("id").single();
  if (result.error || !result.data) {
    const schemaOutdated = result.error && ["PGRST204", "42703"].includes(result.error.code);
    message(back, "error", schemaOutdated ? "The database is missing Phase 02 migrations. Apply migrations 0009 and 0010, then try again." : "Unable to save this customer.");
  }
  revalidatePath("/dashboard/customers");
  if (formValue(data, "returnTo")) message(listReturnPath(data, "/dashboard/customers"), "message", `Customer ${id ? "updated" : "created"}.`);
  redirect(`/dashboard/customers/${result.data.id}?message=${encodeURIComponent(`Customer ${id ? "updated" : "created"}.`)}`);
}

export async function archiveCustomer(data: FormData) {
  const id = formValue(data, "id"); const archived = formValue(data, "archived") === "true"; const { activeMembership } = await getDashboardContext(); const supabase = await createClient();
  if (!canOperate(activeMembership.role)) message("/dashboard/customers", "error", "You have read-only access.");
  const { error } = await supabase.from("customers").update({ is_archived: archived }).eq("id", id).eq("organization_id", activeMembership.organizationId);
  if (error) message(`/dashboard/customers/${id}`, "error", "Unable to update this customer.");
  revalidatePath("/dashboard/customers"); message("/dashboard/customers", "message", `Customer ${archived ? "archived" : "restored"}.`);
}

export async function saveVehicle(data: FormData) {
  const id = formValue(data, "id"); const parsed = vehicleSchema.safeParse(vehicleInput(data)); const back = safeReturnPath(data, id ? `/dashboard/vehicles/${id}/edit` : "/dashboard/vehicles/new");
  if (!parsed.success) message(back, "error", firstError(parsed.error));
  const { activeMembership } = await getDashboardContext(); const supabase = await createClient(); if (!canOperate(activeMembership.role)) message("/dashboard/vehicles", "error", "You have read-only access.");
  const values = parsed.data;
  const { data: customer } = await supabase.from("customers").select("id").eq("id", values.customerId).eq("organization_id", activeMembership.organizationId).eq("is_archived", false).maybeSingle();
  if (!customer) message(back, "error", "Select an active customer from this organization.");
  const plate = values.plateNumber ? normalizePlate(values.plateNumber) : null;
  if (!values.acceptDuplicate && (plate || values.vin)) {
    let query = supabase.from("vehicles").select("id, make, model").eq("organization_id", activeMembership.organizationId).eq("is_archived", false).limit(1);
    if (id) query = query.neq("id", id);
    const filters = [plate && `plate_normalized.eq.${plate}`, values.vin && `vin.ilike.${values.vin}`].filter(Boolean).join(",");
    const { data: duplicate } = filters ? await query.or(filters).maybeSingle() : { data: null };
    if (duplicate) redirect(`${back}${back.includes("?") ? "&" : "?"}warning=${encodeURIComponent(`Possible duplicate: ${duplicate.make} ${duplicate.model}`)}&duplicateId=${duplicate.id}`);
  }
  const payload = { organization_id: activeMembership.organizationId, customer_id: values.customerId, make: values.make, model: values.model, plate_number: values.plateNumber, model_year: values.modelYear, variant: values.variant, color: values.color, vehicle_type: values.vehicleType, fuel_type: values.fuelType, transmission: values.transmission, odometer_km: values.odometerKm, vin: values.vin, engine_number: values.engineNumber, notes: values.notes };
  const result = id ? await supabase.from("vehicles").update(payload).eq("id", id).eq("organization_id", activeMembership.organizationId).select("id").maybeSingle() : await supabase.from("vehicles").insert(payload).select("id").single();
  if (result.error || !result.data) message(back, "error", result.error?.code === "23505" ? "An active vehicle with that plate already exists." : "Unable to save this vehicle.");
  revalidatePath("/dashboard/vehicles");
  if (formValue(data, "returnTo")) message(listReturnPath(data, "/dashboard/vehicles"), "message", `Vehicle ${id ? "updated" : "created"}.`);
  redirect(`/dashboard/vehicles/${result.data.id}?message=${encodeURIComponent(`Vehicle ${id ? "updated" : "created"}.`)}`);
}

export async function archiveVehicle(data: FormData) {
  const id = formValue(data, "id"); const archived = formValue(data, "archived") === "true"; const { activeMembership } = await getDashboardContext(); const supabase = await createClient();
  if (!canOperate(activeMembership.role)) message("/dashboard/vehicles", "error", "You have read-only access.");
  const { error } = await supabase.from("vehicles").update({ is_archived: archived }).eq("id", id).eq("organization_id", activeMembership.organizationId);
  if (error) message(`/dashboard/vehicles/${id}`, "error", "Unable to update this vehicle.");
  revalidatePath("/dashboard/vehicles"); message("/dashboard/vehicles", "message", `Vehicle ${archived ? "archived" : "restored"}.`);
}
