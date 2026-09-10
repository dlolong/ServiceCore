"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { firstError, formValue, normalizePlate } from "@/lib/crm";
import { reportActionError } from "@/lib/errors/action-error";
import { categorySchema, parseMoneyToCentavos, selectedValues, serviceSchema, walkInSchema, zonedDateTimeToUtc } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { assertIndustryFeature } from "@/lib/auth/industry-access";

function go(path:string,kind:"error"|"message",value:string):never { redirect(`${path}?${kind}=${encodeURIComponent(value)}`); }
const admin=(role:string)=>["owner","manager"].includes(role);
const operator=(role:string)=>["owner","manager","advisor"].includes(role);

export async function saveCategory(data:FormData) {
  const id=formValue(data,"id");
  const parsed=categorySchema.safeParse({name:formValue(data,"name"),sortOrder:formValue(data,"sortOrder")});
  if(!parsed.success) go("/dashboard/services","error",firstError(parsed.error));
  const {activeMembership}=await getDashboardContext();
  if(!admin(activeMembership.role)) go("/dashboard/services","error","Owner or manager access is required.");
  const supabase=await createClient();
  const payload={organization_id:activeMembership.organizationId,name:parsed.data.name,sort_order:parsed.data.sortOrder};
  const {error}=id?await supabase.from("service_categories").update(payload).eq("id",id).eq("organization_id",activeMembership.organizationId):await supabase.from("service_categories").insert(payload);
  if(error) go("/dashboard/services","error",error.code==="23505"?"That category already exists.":"Unable to save the category.");
  revalidatePath("/dashboard/services"); go("/dashboard/services","message",`Category ${id?"updated":"created"}.`);
}

export async function toggleCategory(data:FormData) {
  const {activeMembership}=await getDashboardContext();
  if(!admin(activeMembership.role)) go("/dashboard/services","error","Owner or manager access is required.");
  const supabase=await createClient();
  const {error}=await supabase.from("service_categories").update({is_active:formValue(data,"active")==="true"}).eq("id",formValue(data,"id")).eq("organization_id",activeMembership.organizationId);
  if(error) go("/dashboard/services","error","Unable to update category.");
  revalidatePath("/dashboard/services"); go("/dashboard/services","message","Category updated.");
}

function parsePriceLines(value:string) {
  const rows:{vehicle_class:string;price_centavos:number}[]=[];
  for(const line of value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean)) {
    const [className,price]=line.split("="); const centavos=parseMoneyToCentavos(price??"");
    if(!className?.trim()||centavos===null||centavos>100000000000n) return null;
    rows.push({vehicle_class:className.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_"),price_centavos:Number(centavos)});
  }
  return rows;
}

export async function saveService(data:FormData) {
  const id=formValue(data,"id"),back=id?`/dashboard/services/${id}/edit`:"/dashboard/services/new";
  const parsed=serviceSchema.safeParse({name:formValue(data,"name"),categoryId:formValue(data,"categoryId"),description:formValue(data,"description"),shortDescription:formValue(data,"shortDescription"),code:formValue(data,"code"),durationMinutes:formValue(data,"durationMinutes"),basePrice:formValue(data,"basePrice"),isAddOn:data.get("isAddOn")==="on",parentServiceId:formValue(data,"parentServiceId")});
  if(!parsed.success) go(back,"error",firstError(parsed.error));
  const {activeMembership}=await getDashboardContext(); if(!admin(activeMembership.role)) go("/dashboard/services","error","Owner or manager access is required.");
  const automotive=activeMembership.industry==="automotive",base=parseMoneyToCentavos(parsed.data.basePrice),orgPrices=automotive?parsePriceLines(formValue(data,"vehiclePrices")):[];
  if(base===null||base>100000000000n) go(back,"error","Enter a valid nonnegative base price with at most two decimals.");
  if(!orgPrices) go(back,"error","Vehicle prices must use one class=price per line.");
  const branchPriceRows:{branch_id:string;vehicle_class:string|null;price_centavos:number}[]=[];
  for(const branch of activeMembership.branches) {
    const branchBase=formValue(data,`branchBasePrice:${branch.id}`),vehicleRows=automotive?parsePriceLines(formValue(data,`branchVehiclePrices:${branch.id}`)):[];
    if(vehicleRows===null) go(back,"error",`${branch.name} vehicle prices are invalid.`);
    if(branchBase) { const amount=parseMoneyToCentavos(branchBase); if(amount===null||amount>100000000000n) go(back,"error",`${branch.name} base price is invalid.`); branchPriceRows.push({branch_id:branch.id,vehicle_class:null,price_centavos:Number(amount)}); }
    branchPriceRows.push(...vehicleRows.map(row=>({...row,branch_id:branch.id})));
  }
  const supabase=await createClient();
  const payload={organization_id:activeMembership.organizationId,category_id:parsed.data.categoryId,name:parsed.data.name,description:parsed.data.description,short_description:parsed.data.shortDescription,code:parsed.data.code,duration_minutes:parsed.data.durationMinutes,base_price_centavos:Number(base),is_add_on:parsed.data.isAddOn,parent_service_id:parsed.data.isAddOn?parsed.data.parentServiceId:null};
  const result=id?await supabase.from("services").update(payload).eq("id",id).eq("organization_id",activeMembership.organizationId).select("id").maybeSingle():await supabase.from("services").insert(payload).select("id").single();
  if(result.error||!result.data) go(back,"error",result.error?.code==="23505"?"A service with this name or code already exists.":"Unable to save service.");
  const serviceId=result.data.id,branchIds=selectedValues(data,"branchIds");
  await Promise.all([supabase.from("service_prices").delete().eq("service_id",serviceId),supabase.from("service_branch_availability").delete().eq("service_id",serviceId)]);
  const priceRows=[...orgPrices.map(price=>({...price,branch_id:null})),...branchPriceRows].map(price=>({...price,organization_id:activeMembership.organizationId,service_id:serviceId}));
  if(priceRows.length) { const {error}=await supabase.from("service_prices").insert(priceRows); if(error) go(back,"error","Service saved, but pricing could not be updated."); }
  if(data.get("allBranches")!=="on"&&branchIds.length) { const {error}=await supabase.from("service_branch_availability").insert(branchIds.map(branch_id=>({organization_id:activeMembership.organizationId,service_id:serviceId,branch_id,is_available:true}))); if(error) go(back,"error","Service saved, but branch availability could not be updated."); }
  revalidatePath("/dashboard/services"); redirect(`/dashboard/services/${serviceId}?message=${encodeURIComponent(`Service ${id?"updated":"created"}.`)}`);
}

export async function toggleService(data:FormData) {
  const {activeMembership}=await getDashboardContext(); if(!admin(activeMembership.role)) go("/dashboard/services","error","Owner or manager access is required.");
  const supabase=await createClient(); const {error}=await supabase.from("services").update({is_active:formValue(data,"active")==="true"}).eq("id",formValue(data,"id")).eq("organization_id",activeMembership.organizationId);
  if(error) go("/dashboard/services","error","Unable to update service."); revalidatePath("/dashboard/services"); go("/dashboard/services","message","Service updated.");
}

const quickSchema=z.object({customerName:z.string().trim().max(200),customerPhone:z.string().trim().max(50),customerEmail:z.union([z.literal(""),z.email()]),vehicleMake:z.string().trim().max(100),vehicleModel:z.string().trim().max(100),vehiclePlate:z.string().trim().max(30),vehicleType:z.string().trim().max(100)});
const quickCustomerSchema=quickSchema.pick({customerName:true,customerPhone:true,customerEmail:true});
async function resolveVisitEntities(data:FormData,organizationId:string,back:string,includeVehicle=true) {
  const supabase=await createClient(); let customerId=formValue(data,"customerId"),vehicleId=formValue(data,"vehicleId");
  const submitted={customerName:formValue(data,"quickCustomerName"),customerPhone:formValue(data,"quickCustomerPhone"),customerEmail:formValue(data,"quickCustomerEmail"),vehicleMake:formValue(data,"quickVehicleMake"),vehicleModel:formValue(data,"quickVehicleModel"),vehiclePlate:formValue(data,"quickVehiclePlate"),vehicleType:formValue(data,"quickVehicleType")};
  const customer=quickCustomerSchema.safeParse(submitted);
  if(!customer.success) go(back,"error",includeVehicle?"Check the quick customer and vehicle details.":"Check the quick client details.");
  if(customer.data.customerName) {
    if(customer.data.customerName.length<2) go(back,"error",includeVehicle?"Quick customer name must contain at least two characters.":"Quick client name must contain at least two characters.");
    const {data:created,error}=await supabase.from("customers").insert({organization_id:organizationId,full_name:customer.data.customerName,phone:customer.data.customerPhone||null,email:customer.data.customerEmail||null}).select("id").single();
    if(error||!created) go(back,"error","Unable to create the customer."); customerId=created.id;
  }
  const automotive=includeVehicle?quickSchema.safeParse(submitted):null;
  if(includeVehicle&&!automotive?.success) go(back,"error","Check the quick customer and vehicle details.");
  if(automotive?.success&&(automotive.data.vehicleMake||automotive.data.vehicleModel)) {
    if(!customerId||automotive.data.vehicleMake.length<2||automotive.data.vehicleModel.length<1) go(back,"error","Select/create a customer and enter the vehicle make and model.");
    const {data:created,error}=await supabase.from("vehicles").insert({organization_id:organizationId,customer_id:customerId,make:automotive.data.vehicleMake,model:automotive.data.vehicleModel,plate_number:automotive.data.vehiclePlate||null,plate_normalized:automotive.data.vehiclePlate?normalizePlate(automotive.data.vehiclePlate):null,vehicle_type:automotive.data.vehicleType||null}).select("id").single();
    if(error||!created) go(back,"error","Unable to create the vehicle."); vehicleId=created.id;
  }
  return {customerId,vehicleId};
}

export async function saveAppointment(data:FormData) {
  const appointmentId=formValue(data,"appointmentId"),maintenanceDueId=formValue(data,"maintenanceDueId"),back=appointmentId?`/dashboard/appointments/${appointmentId}/edit`:maintenanceDueId?`/dashboard/appointments/new?maintenanceDueId=${encodeURIComponent(maintenanceDueId)}`:"/dashboard/appointments/new";
  const {activeMembership}=await getDashboardContext(); if(!operator(activeMembership.role)) go("/dashboard/appointments","error","You have read-only access.");
  const branchId=formValue(data,"branchId"),startsAt=formValue(data,"startsAt"),branch=activeMembership.branches.find(candidate=>candidate.id===branchId);
  if(!branch) go(back,"error","Select an active branch in this organization.");
  const supabase=await createClient(),{data:branchRow}=await supabase.from("branches").select("timezone").eq("id",branch.id).single(),utc=zonedDateTimeToUtc(startsAt,branchRow?.timezone??activeMembership.timezone);
  if(!utc) go(back,"error","Enter a valid appointment date and time.");
  const automotive=activeMembership.industry==="automotive",resolved=await resolveVisitEntities(data,activeMembership.organizationId,back,automotive);
  let saved:string,customerLink="",linkMessage="";
  try {
    const coreInput={appointmentId:appointmentId||null,organizationId:activeMembership.organizationId,branchId,customerId:resolved.customerId,serviceIds:selectedValues(data,"serviceIds"),staffAssignments:selectedValues(data,"staffIds").map(staffId=>({staffId})),resourceAssignments:selectedValues(data,"resourceIds").map(resourceId=>({resourceId})),scheduledStart:utc.toISOString(),allowAppointmentConflict:data.get("acceptConflict")==="on",customerNote:formValue(data,"customerNote")||null,internalNote:formValue(data,"internalNote")||null};
    if(automotive){const{saveAutomotiveAppointment}=await import("@/modules/automotive/scheduling/automotive-scheduling.service");saved=await saveAutomotiveAppointment({...coreInput,maintenanceDueId:maintenanceDueId||null,vehicleId:resolved.vehicleId});}
    else{const{saveAppointment:saveCoreAppointment}=await import("@/modules/core/scheduling/scheduling.service");saved=await saveCoreAppointment(coreInput);if(!appointmentId){try{const{createAppointmentSelfServiceLink}=await import("@/modules/core/scheduling/appointment-self-service.runtime");const link=await createAppointmentSelfServiceLink({appointmentId:saved,expiresAt:new Date(Date.now()+30*86_400_000).toISOString()});customerLink=`/appointment/${link.token}`;linkMessage=link.deliveryEnabled?" Customer self-service and reminders are enabled.":" Customer link created; delivery encryption is not configured.";}catch{linkMessage=" The appointment was saved, but its customer link could not be created.";}}}
  } catch(error) {
    go(back,"error",reportActionError("appointment.save",error,"Unable to save the appointment. Please review the details and try again."));
  }
  revalidatePath("/dashboard/appointments"); const next=new URLSearchParams({message:`Appointment ${appointmentId?"updated":"booked"}.${linkMessage}`});if(customerLink)next.set("customerLink",customerLink);redirect(`/dashboard/appointments/${saved}?${next}`);
}

export async function transitionAppointment(data:FormData){const id=formValue(data,"id"),supabase=await createClient();const{error}=await supabase.rpc("transition_appointment",{p_appointment_id:id,p_action:formValue(data,"action"),p_reason:formValue(data,"reason")||null});if(error)go(`/dashboard/appointments/${id}`,"error","That appointment transition is not allowed.");revalidatePath("/dashboard");go(`/dashboard/appointments/${id}`,"message","Appointment updated.");}
export async function enqueueAppointment(data:FormData){const id=formValue(data,"id"),{activeMembership}=await getDashboardContext();assertIndustryFeature(activeMembership,"queue");const supabase=await createClient();const{error}=await supabase.rpc("enqueue_appointment",{p_appointment_id:id});if(error)go(`/dashboard/appointments/${id}`,"error",error.code==="23505"?"This appointment is already in the queue.":"Unable to add this appointment to the queue. Refresh and try again.");revalidatePath("/dashboard");redirect("/dashboard/queue?message=Appointment+added+to+queue.");}
export async function createWalkIn(data:FormData){const back="/dashboard/queue/new",{activeMembership}=await getDashboardContext();assertIndustryFeature(activeMembership,"queue");if(!operator(activeMembership.role))go("/dashboard/queue","error","You have read-only access.");const resolved=await resolveVisitEntities(data,activeMembership.organizationId,back);const parsed=walkInSchema.safeParse({branchId:formValue(data,"branchId"),customerId:resolved.customerId,vehicleId:resolved.vehicleId,serviceIds:selectedValues(data,"serviceIds"),notes:formValue(data,"notes")});if(!parsed.success)go(back,"error",firstError(parsed.error));if(!activeMembership.branches.some(branch=>branch.id===parsed.data.branchId))go(back,"error","Select an active branch in this organization.");const supabase=await createClient();const{error}=await supabase.rpc("create_walk_in",{p_branch_id:parsed.data.branchId,p_customer_id:parsed.data.customerId,p_vehicle_id:parsed.data.vehicleId,p_service_ids:parsed.data.serviceIds,p_notes:parsed.data.notes});if(error)go(back,"error","Unable to add this walk-in. Review the customer, vehicle, and services, then try again.");revalidatePath("/dashboard");redirect("/dashboard/queue?message=Walk-in+added+to+queue.");}
export async function transitionQueue(data:FormData){const{activeMembership}=await getDashboardContext();assertIndustryFeature(activeMembership,"queue");const supabase=await createClient();const{error}=await supabase.rpc("transition_queue_entry",{p_queue_id:formValue(data,"id"),p_status:formValue(data,"status")});if(error)go("/dashboard/queue","error","That queue transition is not allowed.");revalidatePath("/dashboard");go("/dashboard/queue","message","Queue updated.");}
