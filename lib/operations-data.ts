import "server-only";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function getVisitChoices(customerQ?:string) {
  const[{activeMembership},supabase]=await Promise.all([getDashboardContext(),createClient()]);
  const q=customerQ?.trim().replace(/[,%()]/g," ").slice(0,100);
  let customerQuery=supabase.from("customers").select("id,full_name").eq("organization_id",activeMembership.organizationId).eq("is_archived",false).order("full_name").limit(q?50:25);
  if(q) customerQuery=customerQuery.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const vehicleQuery=activeMembership.industry==="automotive"?supabase.from("vehicles").select("id,customer_id,make,model,model_year,plate_number").eq("organization_id",activeMembership.organizationId).eq("is_archived",false).order("make").limit(250):Promise.resolve({data:[],error:null});
  const[{data:customers},{data:vehicles},{data:services},{data:staff},{data:resources}]=await Promise.all([customerQuery,vehicleQuery,supabase.from("services").select("id,name,base_price_centavos,duration_minutes").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name").limit(250),supabase.from("staff_directory").select("staff_id,full_name,branch_ids").eq("organization_id",activeMembership.organizationId).eq("is_active",true),supabase.from("scheduling_resources").select("id,name,branch_id,capacity").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name")]);
  let vehicleChoices:Array<{id:string;customer_id:string;label:string}>=[];
  if(activeMembership.industry==="automotive") {
    const {automotiveAppointmentVehicleLabel}=await import("@/modules/automotive/appointments");
    vehicleChoices=(vehicles??[]).map(vehicle=>({id:vehicle.id,customer_id:vehicle.customer_id,label:automotiveAppointmentVehicleLabel({make:vehicle.make,model:vehicle.model,plateNumber:vehicle.plate_number})}));
  }
  return {activeMembership,customers:(customers??[]).map(customer=>({id:customer.id,name:customer.full_name})),vehicles:vehicleChoices,services:services??[],staff:(staff??[]).map(member=>({id:member.staff_id,name:member.full_name??"Staff member",branchIds:member.branch_ids??[]})),resources:resources??[]};
}
