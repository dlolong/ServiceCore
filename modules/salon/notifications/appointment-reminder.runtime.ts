import "server-only";
import{createAdminClient}from"@/lib/supabase/admin";
export async function enqueueDueSalonAppointmentReminders(limit=100){const{data,error}=await createAdminClient().rpc("enqueue_due_salon_appointment_reminders",{p_limit:limit});if(error)throw new Error("Unable to enqueue Salon appointment reminders.");return Number(data??0);}
