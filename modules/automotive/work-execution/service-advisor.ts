export type PartsReadinessStatus = "NOT_REQUIRED" | "READY" | "PARTIAL" | "NOT_READY";
export type AdvisorAction = "PREPARE_ESTIMATE" | "RECORD_AUTHORIZATION" | "CHECK_PARTS" | "START_WORK" | "RESUME_WORK" | "SEND_TO_QC" | "RECORD_PAYMENT" | "RELEASE_VEHICLE" | "NONE";

export type EstimateLineAmount = { quantity: number; unitPriceCentavos: number; discountCentavos: number };
export type PartRequirement = { inventoryItemId: string; name: string; requiredQuantity: number; availableQuantity: number };

export function calculateEstimateLineTotalCentavos(line: EstimateLineAmount) {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0 || !Number.isInteger(line.unitPriceCentavos) || line.unitPriceCentavos < 0 || !Number.isInteger(line.discountCentavos) || line.discountCentavos < 0) throw new Error("Estimate line amounts are invalid.");
  return Math.max(0, line.quantity * line.unitPriceCentavos - line.discountCentavos);
}

export function calculateEstimateTotals(lines: EstimateLineAmount[], discountCentavos = 0, taxCentavos = 0) {
  const subtotalCentavos = lines.reduce((sum, line) => sum + calculateEstimateLineTotalCentavos(line), 0);
  if (!Number.isInteger(discountCentavos) || discountCentavos < 0 || discountCentavos > subtotalCentavos || !Number.isInteger(taxCentavos) || taxCentavos < 0) throw new Error("Estimate totals are invalid.");
  return { subtotalCentavos, discountCentavos, taxCentavos, totalCentavos: subtotalCentavos - discountCentavos + taxCentavos };
}

export function evaluatePartsReadiness(requirements: PartRequirement[]) {
  if (!requirements.length) return { status: "NOT_REQUIRED" as const, requiredCount: 0, readyCount: 0, blockers: [] as string[] };
  const ready = requirements.filter((part) => part.availableQuantity >= part.requiredQuantity);
  const blockers = requirements.filter((part) => part.availableQuantity < part.requiredQuantity).map((part) => `${part.name}: requires ${part.requiredQuantity}, ${part.availableQuantity} available`);
  return { status: (ready.length === requirements.length ? "READY" : ready.length ? "PARTIAL" : "NOT_READY") as PartsReadinessStatus, requiredCount: requirements.length, readyCount: ready.length, blockers };
}

export function calculatePaymentSummary(totalCentavos: number, payments: { amountCentavos: number; status: string }[]) {
  const paidCentavos = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + payment.amountCentavos, 0);
  return { totalCentavos, paidCentavos, balanceCentavos: Math.max(0, totalCentavos - paidCentavos) };
}

export function evaluateJobOrderWorkReadiness(input: { status: string; inspectionComplete: boolean; estimateStatus: string | null; authorizationCurrent: boolean; partsStatus: PartsReadinessStatus }) {
  const blockers: string[] = [];
  if (!input.inspectionComplete) blockers.push("INSPECTION_REQUIRED");
  if (!input.estimateStatus) blockers.push("ESTIMATE_REQUIRED");
  else if (!input.authorizationCurrent) blockers.push(input.estimateStatus === "declined" ? "CUSTOMER_DECLINED" : "CUSTOMER_AUTHORIZATION_REQUIRED");
  if (input.partsStatus === "PARTIAL" || input.partsStatus === "NOT_READY") blockers.push("PARTS_NOT_READY");
  if (!["queued", "approved"].includes(input.status)) blockers.push("JOB_STATUS_NOT_READY");
  return { ready: blockers.length === 0, blockers };
}

export function evaluateVehicleReleaseReadiness(input: { status: string; authorizationCurrent: boolean; balanceCentavos: number }) {
  const blockers: string[] = [];
  if (!input.authorizationCurrent) blockers.push("CUSTOMER_AUTHORIZATION_REQUIRED");
  if (input.status !== "ready_for_release" && input.status !== "ready") blockers.push("QC_NOT_COMPLETE");
  if (input.balanceCentavos > 0) blockers.push("BALANCE_REMAINING");
  return { ready: blockers.length === 0, blockers };
}

export function getRecommendedJobOrderAction(input: { status: string; hasEstimate: boolean; authorizationCurrent: boolean; partsStatus: PartsReadinessStatus; balanceCentavos: number }) : AdvisorAction {
  if (!input.hasEstimate) return "PREPARE_ESTIMATE";
  if (!input.authorizationCurrent) return "RECORD_AUTHORIZATION";
  if (input.partsStatus === "PARTIAL" || input.partsStatus === "NOT_READY") return "CHECK_PARTS";
  if (["queued", "approved"].includes(input.status)) return "START_WORK";
  if (input.status === "on_hold") return "RESUME_WORK";
  if (input.status === "in_progress") return "SEND_TO_QC";
  if (["quality_check", "ready", "ready_for_release"].includes(input.status) && input.balanceCentavos > 0) return "RECORD_PAYMENT";
  if (["ready", "ready_for_release"].includes(input.status) && input.balanceCentavos === 0) return "RELEASE_VEHICLE";
  return "NONE";
}

export const advisorBlockerLabels: Record<string, string> = {
  INSPECTION_REQUIRED: "Complete the vehicle inspection before work starts.", ESTIMATE_REQUIRED: "Prepare an estimate for customer authorization.",
  CUSTOMER_AUTHORIZATION_REQUIRED: "Waiting for customer authorization.", CUSTOMER_DECLINED: "The customer declined the current estimate.",
  PARTS_NOT_READY: "One or more required parts are unavailable at this branch.", JOB_STATUS_NOT_READY: "The current Job Order status cannot start work.",
  QC_NOT_COMPLETE: "Quality control is not complete.", BALANCE_REMAINING: "The invoice has an unpaid balance.",
};
