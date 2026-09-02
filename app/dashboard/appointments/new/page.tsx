import { notFound,redirect } from "next/navigation";

import { VisitForm } from "@/components/operations-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { getVisitChoices } from "@/lib/operations-data";
import { createClient } from "@/lib/supabase/server";
import { isMaintenanceAppointmentActive,type MaintenanceAppointmentStatus } from "@/modules/automotive/maintenance/reminder-eligibility";

type MaintenanceDefaults={id:string;branch_id:string;customer_id:string;customer_name:string;vehicle_id:string;service_id:string;appointment_id:string|null;appointment_status:MaintenanceAppointmentStatus};

export default async function Page({searchParams}:{searchParams:Promise<{customerQ?:string;customerId?:string;vehicleId?:string;serviceId?:string;maintenanceDueId?:string;error?:string}>}){
  const query=await searchParams;
  const[{activeMembership},supabase]=await Promise.all([getDashboardContext(),createClient()]);
  let maintenance:MaintenanceDefaults|null=null;
  if(query.maintenanceDueId){
    const{data}=await supabase.from("vehicle_maintenance_directory").select("id,branch_id,customer_id,customer_name,vehicle_id,service_id,appointment_id,appointment_status")
      .eq("id",query.maintenanceDueId).eq("organization_id",activeMembership.organizationId).eq("lifecycle_status","active").maybeSingle();
    if(!data)notFound();
    maintenance=data as MaintenanceDefaults;
    if(maintenance.appointment_id&&isMaintenanceAppointmentActive(maintenance.appointment_status))redirect(`/dashboard/appointments/${maintenance.appointment_id}?message=This+maintenance+already+has+an+active+appointment.`);
  }
  const choices=await getVisitChoices(query.customerQ??maintenance?.customer_name);
  const customerId=maintenance?.customer_id??(choices.customers.some(customer=>customer.id===query.customerId)?query.customerId:undefined);
  const requestedVehicleId=maintenance?.vehicle_id??query.vehicleId;
  const vehicle=choices.vehicles.find(candidate=>candidate.id===requestedVehicleId&&(!customerId||candidate.customer_id===customerId));
  const requestedServiceId=maintenance?.service_id??query.serviceId;
  const serviceId=choices.services.some(service=>service.id===requestedServiceId)?requestedServiceId:undefined;
  const branchId=maintenance?.branch_id??activeMembership.branchId;
  return <main id="appointment-create-page" className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Appointments</p><h1 className="mt-1 text-3xl font-black">Book appointment</h1><p className="mt-2 text-zinc-600">{maintenance?"This appointment will be linked to the selected maintenance requirement.":"The database will resolve final estimated pricing and duration."}</p><div className="mt-6"><VisitForm mode="appointment" defaults={{customerId,vehicleId:vehicle?.id,serviceId,branchId,maintenanceDueId:maintenance?.id}} branches={activeMembership.branches.map(branch=>({id:branch.id,name:branch.name}))} customers={choices.customers} vehicles={choices.vehicles} services={choices.services} staff={choices.staff.filter(member=>member.branchIds.length===0||member.branchIds.includes(branchId))} resources={choices.resources.filter(resource=>resource.branch_id===branchId)} customerQ={query.customerQ} error={query.error}/></div></main>;
}
