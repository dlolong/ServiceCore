"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formValue } from "@/lib/crm";
import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

export async function reviewBooking(data: FormData) {
  const { activeMembership } = await requireIndustryFeature("booking_requests");
  if (!roleHasPermission(activeMembership.role, "appointments.manage")) redirect("/dashboard/bookings?error=Booking+management+access+required.");
  const parsed = z.object({ id: z.uuid(), action: z.enum(["confirm", "decline"]), reason: z.string().trim().max(1000) }).safeParse({ id: formValue(data, "id"), action: formValue(data, "action"), reason: formValue(data, "reason") });
  if (!parsed.success) redirect("/dashboard/bookings?error=Invalid+review.");
  const supabase = await createClient();
  const request = await supabase.from("public_booking_requests").select("id").eq("id", parsed.data.id).eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).maybeSingle();
  if (request.error || !request.data) redirect("/dashboard/bookings?error=Booking+request+not+available+in+this+branch.");
  const { error } = await supabase.rpc("review_public_booking", { p_booking_id: parsed.data.id, p_action: parsed.data.action, p_reason: parsed.data.reason || null });
  if (error) redirect("/dashboard/bookings?error=Unable+to+update+this+booking.+Refresh+and+try+again.");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/appointments");
  redirect(`/dashboard/bookings?message=${parsed.data.action === "confirm" ? "Booking+confirmed." : "Booking+declined."}`);
}
