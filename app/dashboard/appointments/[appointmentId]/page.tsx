import Link from "next/link";
import { notFound } from "next/navigation";

import { enqueueAppointment, transitionAppointment } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration, formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { automotiveAppointmentVehicleLabel } from "@/modules/automotive/appointments";
import { assignmentContextLabel, loadKarKRAppointmentAssignmentContext } from "@/modules/automotive/scheduling/appointment-operational-view";

export default async function Page({ params, searchParams }: { params: Promise<{ appointmentId: string }>; searchParams: Promise<{ message?: string; error?: string }> }) {
  const [{ appointmentId }, query, { activeMembership }, supabase] = await Promise.all([params, searchParams, getDashboardContext(), createClient()]);
  const { data: appointment } = await supabase.from("appointments").select("id,vehicle_id,status,source,starts_at,ends_at,expected_total_centavos,expected_duration_minutes,customer_note,internal_note,cancellation_reason,created_at,branches(name,timezone),customers(id,full_name,phone),vehicles(id,make,model,plate_number),appointment_services(service_id,service_name_snapshot,unit_price_centavos,duration_minutes)").eq("id", appointmentId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (!appointment) notFound();
  const assignmentContext = await loadKarKRAppointmentAssignmentContext(activeMembership.organizationId, [appointment.id]);
  const assignmentLabels = assignmentContextLabel(assignmentContext.get(appointment.id) ?? { scheduledStaff: [], scheduledResources: [] });

  const branch = Array.isArray(appointment.branches) ? appointment.branches[0] : appointment.branches;
  const customer = Array.isArray(appointment.customers) ? appointment.customers[0] : appointment.customers;
  const vehicle = Array.isArray(appointment.vehicles) ? appointment.vehicles[0] : appointment.vehicles;
  const canWrite = ["owner", "manager", "advisor"].includes(activeMembership.role);
  const editable = ["requested", "confirmed"].includes(appointment.status);
  const canEnterAutomotiveQueue = ["checked_in", "confirmed"].includes(appointment.status);

  return <div id="appointment-details-page" className="mx-auto max-w-5xl">
    <div id="appointment-details-header" className="flex flex-wrap justify-between gap-4">
      <div><p className="text-sm font-bold capitalize text-amber-700">{appointment.source.replaceAll("_", " ")} · {appointment.status.replaceAll("_", " ")}</p><h1 id="appointment-vehicle-value" className="mt-1 text-3xl font-black">{automotiveAppointmentVehicleLabel(vehicle ? { make: vehicle.make, model: vehicle.model, plateNumber: vehicle.plate_number } : null)}</h1><p className="mt-2 text-zinc-600">{customer?.full_name} · {branch?.name}</p></div>
      {canWrite && editable && <Button asChild variant="secondary"><Link id="appointment-edit-button" href={`/dashboard/appointments/${appointment.id}/edit`}>Edit</Link></Button>}
    </div>
    <FormMessage {...query}/>
    <Card id="appointment-scheduling-assignment-context" className="mt-6 p-5"><h2 className="font-black">Scheduling assignments</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Scheduled Staff</dt><dd className="font-semibold">{assignmentLabels.staff}</dd></div><div><dt className="text-zinc-500">Service Bay</dt><dd className="font-semibold">{assignmentLabels.resources}</dd></div></dl></Card>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-5"><h2 className="font-black">Visit details</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Schedule</dt><dd className="font-bold">{new Intl.DateTimeFormat("en-PH", { timeZone: branch?.timezone ?? activeMembership.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(appointment.starts_at!))}</dd></div><div><dt className="text-zinc-500">Estimated duration</dt><dd className="font-bold">{appointment.expected_duration_minutes ? formatDuration(appointment.expected_duration_minutes) : "—"}</dd></div><div><dt className="text-zinc-500">Customer notes</dt><dd>{appointment.customer_note || "None"}</dd></div><div><dt className="text-zinc-500">Internal notes</dt><dd>{appointment.internal_note || "None"}</dd></div></dl><h3 className="mt-6 font-black">Services</h3><div className="mt-2 space-y-2">{appointment.appointment_services.map((item) => <div className="flex justify-between gap-3 border-b border-zinc-100 py-2 text-sm" key={item.service_id}><span>{item.service_name_snapshot}<span className="block text-xs text-zinc-500">{formatDuration(item.duration_minutes)}</span></span><strong>{formatMoney(item.unit_price_centavos)}</strong></div>)}<div className="flex justify-between pt-2 font-black"><span>Estimated Total</span><span>{formatMoney(appointment.expected_total_centavos)}</span></div></div></Card>
      <Card className="h-fit p-5"><h2 className="font-black">Actions</h2>{canWrite && <div className="mt-4 grid gap-3">{appointment.status === "requested" && <Action id={appointment.id} action="confirm" label="Confirm appointment"/>}{["requested", "confirmed"].includes(appointment.status) && <Action id={appointment.id} action="arrive" label="Mark arrived"/>}{["requested", "confirmed"].includes(appointment.status) && <Action id={appointment.id} action="no_show" label="Mark no-show" destructive/>}{["requested", "confirmed"].includes(appointment.status) && <Action id={appointment.id} action="cancel" label="Cancel appointment" destructive/>}{canEnterAutomotiveQueue && appointment.vehicle_id && <form id="appointment-enqueue-form" action={enqueueAppointment}><input type="hidden" name="id" value={appointment.id}/><SubmitButton id="appointment-enqueue-button" pendingText="Adding…">Add to queue</SubmitButton></form>}{canEnterAutomotiveQueue && !appointment.vehicle_id && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Assign a vehicle before adding this appointment to the KarKR queue.</p>}{appointment.status === "queued" && <Button asChild><Link href="/dashboard/queue">View in queue</Link></Button>}</div>}<p className="mt-5 text-xs text-zinc-500">KarKR queue and job-order workflows require a vehicle.</p></Card>
    </div>
  </div>;
}

function Action({ id, action, label, destructive }: { id: string; action: string; label: string; destructive?: boolean }) {
  return <form id={`appointment-${action}-form`} action={transitionAppointment}><input type="hidden" name="id" value={id}/><input type="hidden" name="action" value={action}/><SubmitButton id={`appointment-${action}-button`} pendingText="Updating…" variant={destructive ? "destructive" : "secondary"}>{label}</SubmitButton></form>;
}
