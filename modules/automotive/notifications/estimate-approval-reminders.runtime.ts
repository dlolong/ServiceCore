import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const ESTIMATE_APPROVAL_REMINDER_BEFORE_EXPIRY_HOURS=24;

export async function enqueueDueEstimateApprovalReminders(limit=50){
  const{data,error}=await createAdminClient().rpc("enqueue_due_estimate_approval_reminders",{p_limit:limit});
  if(error){
    console.error("notification.database",{operation:"enqueue_estimate_approval_reminders",error:error.message});
    throw new Error("Unable to enqueue approval reminders.");
  }
  return Number(data??0);
}
