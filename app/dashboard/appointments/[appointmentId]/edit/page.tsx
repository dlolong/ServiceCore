import { notFound } from "next/navigation";
import { VisitForm } from "@/components/operations-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { getVisitChoices } from "@/lib/operations-data";
import { inputDateTimeInZone } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params, searchParams }: { params: Promise<{ appointmentId: string }>; searchParams: Promise<{ customerQ?: string; error?: string }> }) {
  const [{ appointmentId }, query, choices, { activeMembership }, supabase] = await Promise.all([params, searchParams, getVisitChoices((await searchParams).customerQ), getDashboardContext(), createClient()]);
  const { data: appointment } = await supabase.from("appointments").select("id,branch_id,customer_id,vehicle_id,starts_at,customer_note,internal_note,status,appointment_services(service_id),appointment_staff_assignments(staff_membership_id),appointment_resource_assignments(resource_id)").eq("id", appointmentId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (!appointment || !["requested", "confirmed"].includes(appointment.status)) notFound();
  const { data: branch } = await supabase.from("branches").select("timezone").eq("id", appointment.branch_id).single();
  const eligibleStaff = choices.staff.filter((member) => member.branchIds.length === 0 || member.branchIds.includes(appointment.branch_id));
  const branchResources = choices.resources.filter((resource) => resource.branch_id === appointment.branch_id);
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Appointments</p><h1 className="mt-1 text-3xl font-black">Edit appointment</h1><div className="mt-6"><VisitForm mode="appointment" appointment={{ ...appointment, starts_at: inputDateTimeInZone(appointment.starts_at!, branch?.timezone ?? activeMembership.timezone), serviceIds: appointment.appointment_services.map(({ service_id }) => service_id), staffIds: appointment.appointment_staff_assignments.map(({ staff_membership_id }) => staff_membership_id), resourceIds: appointment.appointment_resource_assignments.map(({ resource_id }) => resource_id) }} branches={activeMembership.branches.map(({ id, name }) => ({ id, name }))} customers={choices.customers} vehicles={choices.vehicles} services={choices.services} staff={eligibleStaff} resources={branchResources} customerQ={query.customerQ} error={query.error}/></div></div>;
}
