"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { formValue } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

const resourceSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  branchId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  resourceType: z.enum(["bay", "station", "room", "equipment", "other"]),
  capacity: z.coerce.number().int().min(1).max(100),
});

export async function saveSchedulingResource(data: FormData) {
  const parsed = resourceSchema.safeParse({ id: formValue(data, "id"), branchId: formValue(data, "branchId"), name: formValue(data, "name"), resourceType: formValue(data, "resourceType"), capacity: formValue(data, "capacity") });
  if (!parsed.success) redirect(`/dashboard/settings/resources?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Resource details are invalid.")}`);
  const { activeMembership } = await getDashboardContext();
  if (!["owner", "manager"].includes(activeMembership.role) || !activeMembership.branches.some(({ id }) => id === parsed.data.branchId)) redirect("/dashboard/settings/resources?error=Resource+management+access+denied.");
  const supabase = await createClient();
  const values = { organization_id: activeMembership.organizationId, branch_id: parsed.data.branchId, name: parsed.data.name, resource_type: parsed.data.resourceType, capacity: parsed.data.capacity };
  const result = parsed.data.id ? await supabase.from("scheduling_resources").update(values).eq("id", parsed.data.id).eq("organization_id", activeMembership.organizationId) : await supabase.from("scheduling_resources").insert(values);
  if (result.error) redirect("/dashboard/settings/resources?error=Unable+to+save+this+resource.+Review+the+details+and+try+again.");
  revalidatePath("/dashboard/settings/resources");
  redirect("/dashboard/settings/resources?message=Service+bay+saved.");
}

export async function toggleSchedulingResource(data: FormData) {
  const id = z.uuid().safeParse(formValue(data, "id"));
  const active = formValue(data, "active") === "true";
  const { activeMembership } = await getDashboardContext();
  if (!id.success || !["owner", "manager"].includes(activeMembership.role)) redirect("/dashboard/settings/resources?error=Resource+management+access+denied.");
  const supabase = await createClient();
  const { error } = await supabase.from("scheduling_resources").update({ is_active: active }).eq("id", id.data).eq("organization_id", activeMembership.organizationId);
  if (error) redirect("/dashboard/settings/resources?error=Unable+to+update+service+bay.");
  revalidatePath("/dashboard/settings/resources");
  redirect("/dashboard/settings/resources?message=Service+bay+updated.");
}
