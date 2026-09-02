import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function enqueueDueVehicleMaintenanceReminders(limit=100){
  const{data,error}=await createAdminClient().rpc("enqueue_due_vehicle_maintenance_reminders",{p_limit:limit});
  if(error){
    console.error("notification.database",{operation:"enqueue_vehicle_maintenance_reminders",error:error.message});
    throw new Error("Unable to enqueue vehicle maintenance reminders.");
  }
  return Number(data??0);
}
