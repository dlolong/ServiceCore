import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  assertJobOrderTransitionAllowed,
  AutomotiveWorkExecutionError,
  type AutomotiveJobOrderStatus,
  type JobOrderPersistence,
} from "@/modules/automotive/work-execution/job-order.service";

function persistenceError(error: { message: string } | null, fallback: string): never {
  const controlledMessages = ["vehicle", "already has a job", "cannot start", "not assigned", "transition", "technician", "branch"];
  const message = error && controlledMessages.some((part) => error.message.toLowerCase().includes(part)) ? error.message : fallback;
  throw new AutomotiveWorkExecutionError(message);
}

export const automotiveJobOrderPersistence: JobOrderPersistence = {
  async createFromQueue(queueId, copyScheduledStaff, scheduledStaffMembershipId) {
    await getDashboardContext();
    const supabase = await createClient();
    const { data: jobOrderId, error } = await supabase.rpc("convert_queue_to_job_with_scheduled_staff", { p_queue_id: queueId, p_copy_scheduled_staff: copyScheduledStaff, p_scheduled_staff_membership_id: scheduledStaffMembershipId });
    if (error || !jobOrderId) persistenceError(error, "Unable to create job order.");
    return jobOrderId;
  },
  async transition(jobOrderId, action) {
    const { activeMembership } = await getDashboardContext();
    const supabase = await createClient();
    const { data: jobOrder } = await supabase.from("job_orders").select("status").eq("id", jobOrderId).eq("organization_id", activeMembership.organizationId).maybeSingle();
    if (!jobOrder) throw new AutomotiveWorkExecutionError("Job order not found.");
    assertJobOrderTransitionAllowed(jobOrder.status as AutomotiveJobOrderStatus, action);
    const { error } = await supabase.rpc("transition_job", { p_job_id: jobOrderId, p_action: action });
    if (error) persistenceError(error, "Unable to update job order status.");
  },
  async assignTechnician(jobOrderId, technicianId, promisedAt) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_job", { p_job_id: jobOrderId, p_technician_id: technicianId, p_promised_at: promisedAt });
    if (error) persistenceError(error, "Unable to assign technician.");
  },
  async assignItemTechnician(itemId, technicianId) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("assign_job_item", { p_item_id: itemId, p_technician_id: technicianId });
    if (error) persistenceError(error, "Unable to assign service technician.");
  },
  async addService(input) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_job_service", { p_job_id: input.jobOrderId, p_service_id: input.serviceId, p_quantity: input.quantity, p_requires_approval: input.requiresApproval, p_notes: input.notes });
    if (error) persistenceError(error, "Unable to add work.");
  },
  async transitionService(itemId, action) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_job_service", { p_item_id: itemId, p_action: action });
    if (error) persistenceError(error, "Unable to update proposed work.");
  },
  async saveInspection(input) {
    const { activeMembership } = await getDashboardContext();
    if (activeMembership.organizationId !== input.organizationId) throw new AutomotiveWorkExecutionError("Job order not found.");
    const supabase = await createClient();
    const { error: jobError } = await supabase.rpc("update_job_details", {
      p_job_id: input.jobOrderId, p_technician_id: null, p_promised_at: null,
      p_odometer_in: input.odometerIn, p_fuel_level: input.fuelLevel,
    });
    if (jobError) persistenceError(jobError, "Unable to save inspection.");
    const { error } = await supabase.from("job_inspections").upsert({
      organization_id: input.organizationId, job_order_id: input.jobOrderId,
      exterior_notes: input.exteriorNotes, interior_notes: input.interiorNotes,
      tire_notes: input.tireNotes, light_notes: input.lightNotes,
      windshield_notes: input.windshieldNotes, damage_notes: input.damageNotes,
      warning_indicator_notes: input.warningNotes, belongings_note: input.belongingsNote,
      inspected_by: input.inspectedBy,
    }, { onConflict: "job_order_id" });
    if (error) persistenceError(error, "Unable to save inspection.");
  },
  async saveEstimateItem(input) {
    await getDashboardContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_estimate_item", { p_estimate_id: input.estimateId, p_item_id: input.itemId, p_item_type: input.itemType, p_inventory_item_id: input.inventoryItemId, p_description: input.description, p_quantity: input.quantity, p_unit_price_centavos: input.unitPriceCentavos, p_discount_centavos: input.discountCentavos });
    if (error || !data) persistenceError(error, "Unable to save estimate item.");
    return data;
  },
  async recordAuthorization(input) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_estimate_authorization", { p_estimate_id: input.estimateId, p_decision: input.decision, p_method: input.method, p_note: input.note });
    if (error) persistenceError(error, "Could not record authorization. The estimate may have changed. Refresh and try again.");
  },
};
