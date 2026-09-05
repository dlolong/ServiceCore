import "server-only";

import { serverEnv } from "@/lib/env/server";
import { encryptDeliverySecret } from "@/lib/notifications/delivery-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { availabilityDependenciesForClient } from "@/modules/core/availability/availability.runtime";
import { createAppointmentSelfServiceToken,hashAppointmentSelfServiceToken,parsePublicAppointmentSelfService } from "@/modules/core/scheduling/appointment-self-service";
import { rescheduleAuthorizedAppointment } from "@/modules/core/scheduling/scheduling.service";

export async function createAppointmentSelfServiceLink(input:{appointmentId:string;expiresAt:string}){
  const token=createAppointmentSelfServiceToken();
  const protectedToken=serverEnv.NOTIFICATION_LINK_ENCRYPTION_KEY?encryptDeliverySecret(token,serverEnv.NOTIFICATION_LINK_ENCRYPTION_KEY):null;
  const supabase=await createClient();
  const{data,error}=await supabase.rpc("create_appointment_self_service_link",{
    p_appointment_id:input.appointmentId,p_token_hash:hashAppointmentSelfServiceToken(token),p_expires_at:input.expiresAt,
    p_secret_ciphertext:protectedToken?.ciphertext??null,p_secret_initialization_vector:protectedToken?.initializationVector??null,p_secret_authentication_tag:protectedToken?.authenticationTag??null,
  });
  if(error||!data)throw new Error("Unable to create the customer appointment link.");
  return{linkId:data as string,token,expiresAt:input.expiresAt,deliveryEnabled:Boolean(protectedToken)};
}

export async function getPublicAppointmentSelfService(token:string){
  const supabase=await createClient();
  const{data,error}=await supabase.rpc("get_public_appointment_self_service",{p_token_hash:hashAppointmentSelfServiceToken(token)});
  if(error)throw new Error("This appointment cannot be displayed right now.");
  return parsePublicAppointmentSelfService(data);
}

export async function updatePublicAppointmentSelfService(token:string,action:"confirm"|"reschedule",startsAt?:string){
  const supabase=await createClient();
  const tokenHash=hashAppointmentSelfServiceToken(token);
  if(action==="reschedule"&&startsAt){
    const admin=createAdminClient();
    const{data:link}=await admin.from("appointment_self_service_links").select("appointment_id,organization_id,branch_id,status,expires_at").eq("token_hash",tokenHash).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle();
    if(!link)throw new Error("This appointment link is no longer available.");
    const[{data:appointment},{data:services},{data:staff},{data:resources}]=await Promise.all([
      admin.from("appointments").select("id").eq("id",link.appointment_id).eq("organization_id",link.organization_id).eq("branch_id",link.branch_id).in("status",["requested","confirmed"]).maybeSingle(),
      admin.from("appointment_services").select("service_id").eq("appointment_id",link.appointment_id),
      admin.from("appointment_staff_assignments").select("staff_profile_id").eq("appointment_id",link.appointment_id).eq("organization_id",link.organization_id),
      admin.from("appointment_resource_assignments").select("resource_id").eq("appointment_id",link.appointment_id).eq("organization_id",link.organization_id),
    ]);
    if(!appointment)throw new Error("This appointment can no longer be rescheduled.");
    let result:{state:string}|undefined;
    await rescheduleAuthorizedAppointment({organizationId:link.organization_id,branchId:link.branch_id,appointmentId:link.appointment_id,serviceIds:(services??[]).map(row=>row.service_id),staffAssignments:(staff??[]).map(row=>({staffId:row.staff_profile_id})),resourceAssignments:(resources??[]).map(row=>({resourceId:row.resource_id})),scheduledStart:startsAt},async scheduledStart=>{const response=await supabase.rpc("update_public_appointment_self_service",{p_token_hash:tokenHash,p_action:action,p_starts_at:scheduledStart});if(response.error)throw new Error("The appointment could not be rescheduled. Please choose another time.");result=response.data as{state:string};},availabilityDependenciesForClient(admin));
    return result??{state:"unavailable"};
  }
  const{data,error}=await supabase.rpc("update_public_appointment_self_service",{p_token_hash:hashAppointmentSelfServiceToken(token),p_action:action,p_starts_at:startsAt??null});
  if(error)throw new Error(error.message.includes("unavailable")?error.message:"The appointment could not be updated. Please choose another time or contact the salon.");
  return data as{state:string};
}
