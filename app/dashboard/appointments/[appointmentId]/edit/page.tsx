import { notFound } from "next/navigation";
import { saveAppointment } from "@/app/dashboard/operations-actions";
import { VisitForm } from "@/components/operations-forms";
import { FormDialog } from "@/components/management-ui";
import { getDashboardContext } from "@/lib/auth/context";
import { getVisitChoices } from "@/lib/operations-data";
import { inputDateTimeInZone } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

type EditableAppointment={id:string;branch_id:string;customer_id:string;vehicle_id?:string|null;starts_at:string|null;customer_note:string|null;internal_note:string|null;status:string;appointment_services:Array<{service_id:string}>;appointment_staff_assignments:Array<{staff_profile_id:string}>;appointment_resource_assignments:Array<{resource_id:string}>};

export default async function Page({ params, searchParams }: { params: Promise<{ appointmentId: string }>; searchParams: Promise<{ customerQ?: string; error?: string }> }) {
  const [{ appointmentId }, query, choices, { activeMembership }, supabase] = await Promise.all([params, searchParams, getVisitChoices((await searchParams).customerQ), getDashboardContext(), createClient()]);
  const config=resolveIndustryConfig(activeMembership.industry),salon=config.key==="salon";
  const projection=salon?"id,branch_id,customer_id,starts_at,customer_note,internal_note,status,appointment_services(service_id),appointment_staff_assignments(staff_profile_id),appointment_resource_assignments(resource_id)":"id,branch_id,customer_id,vehicle_id,starts_at,customer_note,internal_note,status,appointment_services(service_id),appointment_staff_assignments(staff_profile_id),appointment_resource_assignments(resource_id)";
  const appointmentResult = await supabase.from("appointments").select(projection).eq("id", appointmentId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  const appointment = appointmentResult.data as unknown as EditableAppointment|null;
  if (!appointment || !["requested", "confirmed"].includes(appointment.status)) notFound();
  const { data: branch } = await supabase.from("branches").select("timezone").eq("id", appointment.branch_id).single();
  const eligibleStaff = choices.staff.filter((member) => member.branchIds.length === 0 || member.branchIds.includes(appointment.branch_id));
  const branchResources = choices.resources.filter((resource) => resource.branch_id === appointment.branch_id);
  const form=<VisitForm mode="appointment" action={saveAppointment} requiresVehicle={!salon} customerLabel={config.terminology.customer} serviceLabel={config.terminology.service} resourceLabel={config.terminology.resource} idPrefix={salon?"salon-appointment":"appointment"} appointment={{ ...appointment,vehicle_id:appointment.vehicle_id??null, starts_at: inputDateTimeInZone(appointment.starts_at!, branch?.timezone ?? activeMembership.timezone), serviceIds: appointment.appointment_services.map(({ service_id }) => service_id), staffIds: appointment.appointment_staff_assignments.map(({ staff_profile_id }) => staff_profile_id), resourceIds: appointment.appointment_resource_assignments.map(({ resource_id }) => resource_id) }} branches={activeMembership.branches.map(({ id, name }) => ({ id, name }))} customers={choices.customers} vehicles={choices.vehicles} services={choices.services} staff={eligibleStaff} resources={branchResources} customerQ={query.customerQ} error={query.error}/>;
  if(salon) return <main id="salon-appointment-edit-page"><FormDialog id="salon-appointment-edit-dialog" title="Edit appointment" description="Reschedule or update this client visit." closeHref={`/dashboard/appointments/${appointment.id}`} size="xl">{form}</FormDialog></main>;
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-brand-primary">Appointments</p><h1 className="mt-1 text-3xl font-black">Edit appointment</h1><div className="mt-6">{form}</div></div>;
}
