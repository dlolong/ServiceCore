import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { dashboardBranchContextHref, parseDashboardBranchContext } from "../modules/platform/command-center-branch-context";
import {
  deriveAutomotiveActions,
  deriveAutomotiveOperations,
  deriveAutomotiveStaff,
  type AutomotiveJobCandidate,
} from "../modules/automotive/command-center/automotive-command-center";
import { composeCommandCenterSnapshot, type SharedCommandCenterSnapshot } from "../modules/core/command-center";
import {
  deriveSalonActions,
  deriveSalonOperations,
  deriveSalonStaff,
  type SalonAppointmentCandidate,
} from "../modules/salon/command-center/salon-command-center";

const branchId = "branch-a";
const baseJob: AutomotiveJobCandidate = {
  id: "job-a", branchId, status: "queued", createdAt: "2026-09-01T01:00:00.000Z", startedAt: null,
  promisedAt: null, appointmentId: null, jobNumber: 12, vehicle: "Toyota Vios", customer: "Ana Cruz", serviceSummary: "Oil change",
};

test("Automotive Command Center derives only live operational conditions with entity deep links", () => {
  const actions = deriveAutomotiveActions({
    jobs: [baseJob, { ...baseJob, id: "job-qc", status: "quality_check", jobNumber: 13 }, { ...baseJob, id: "job-done", status: "completed", jobNumber: 14 }],
    estimates: [{ id: "estimate-a", jobOrderId: "job-a", branchId, createdAt: "2026-09-01T00:00:00.000Z", jobNumber: 12, vehicle: "Toyota Vios" }],
    invoices: [{ id: "invoice-a", jobOrderId: "job-done", branchId, createdAt: "2026-09-01T02:00:00.000Z", balanceCentavos: 5000, jobNumber: 14, vehicle: "Honda City" }, { id: "invoice-paid", jobOrderId: "job-done", branchId, createdAt: "2026-09-01T03:00:00.000Z", balanceCentavos: 0, jobNumber: 14, vehicle: "Honda City" }],
    maintenance: [{ id: "due-a", branchId, dueAt: "2026-08-01T00:00:00.000Z", serviceName: "Oil change", vehicle: "Toyota Vios" }],
    lowStockByBranch: new Map([[branchId, 2]]),
  });
  assert.deepEqual(new Set(actions.map(({ code }) => code)), new Set(["AUTOMOTIVE_ESTIMATE_AWAITING_CUSTOMER", "AUTOMOTIVE_JOB_WAITING_TO_START", "AUTOMOTIVE_JOB_QUALITY_CHECK", "AUTOMOTIVE_COMPLETED_INVOICE_BALANCE", "AUTOMOTIVE_MAINTENANCE_OVERDUE", "SHARED_LOW_STOCK"]));
  assert.equal(actions.some(({ id }) => id.includes("job-done") && !id.includes("invoice")), false);
  assert.equal(actions.find(({ code }) => code === "AUTOMOTIVE_ESTIMATE_AWAITING_CUSTOMER")?.href, "/dashboard/jobs/job-a#job-order-estimate-section");
  assert.equal(actions.find(({ code }) => code === "AUTOMOTIVE_COMPLETED_INVOICE_BALANCE")?.href, "/dashboard/invoices/invoice-a");
  assert.equal(actions.find(({ code }) => code === "SHARED_LOW_STOCK")?.href, `/dashboard/branch-context?branch=${branchId}&next=%2Fdashboard%2Finventory`);
});

test("Automotive operations avoid duplicate Appointment and Job Order rows and staff links to live work", () => {
  const operations = deriveAutomotiveOperations([{ id: "appointment-a", branchId, startsAt: "2026-09-03T01:00:00.000Z", status: "confirmed", vehicle: "Toyota Vios", customer: "Ana", serviceSummary: "Oil change" }], [{ ...baseJob, appointmentId: "appointment-a" }]);
  assert.equal(operations.length, 1);
  assert.equal(operations[0]?.href, "/dashboard/jobs/job-a");
  assert.deepEqual(deriveAutomotiveStaff([{ id: "staff-a", displayName: "Juan", activeJobId: "job-a", activeJobLabel: "Toyota Vios · Job #12", branchId }])[0], { id: "staff-a", displayName: "Juan", status: "working", context: "Toyota Vios · Job #12", href: "/dashboard/jobs/job-a", branchId });
});

const salonAppointment: SalonAppointmentCandidate = {
  id: "appointment-a", branchId, startsAt: "2026-09-03T02:00:00.000Z", endsAt: "2026-09-03T03:00:00.000Z",
  status: "requested", client: "Mia Santos", treatmentSummary: "Haircut", staff: [{ id: "staff-a", displayName: "Alex" }], resourceSummary: "Chair 1",
  expectedTotalCentavos: 100000, paidCentavos: 0, createdAt: "2026-09-01T00:00:00.000Z",
};

test("Salon Command Center derives confirmation, waiting, and completed-balance actions", () => {
  const actions = deriveSalonActions([
    salonAppointment,
    { ...salonAppointment, id: "appointment-waiting", status: "checked_in" },
    { ...salonAppointment, id: "appointment-balance", status: "completed", paidCentavos: 25000 },
    { ...salonAppointment, id: "appointment-paid", status: "completed", paidCentavos: 100000 },
  ], new Map([[branchId, 1]]));
  assert.deepEqual(new Set(actions.map(({ code }) => code)), new Set(["SALON_APPOINTMENT_UNCONFIRMED", "SALON_CLIENT_WAITING", "SALON_COMPLETED_APPOINTMENT_BALANCE", "SHARED_LOW_STOCK"]));
  assert.equal(actions.find(({ code }) => code === "SALON_COMPLETED_APPOINTMENT_BALANCE")?.href, "/dashboard/appointments/appointment-balance#salon-appointment-payment");
  assert.equal(actions.some(({ id }) => id.includes("appointment-paid")), false);
  assert.equal(actions.find(({ code }) => code === "SHARED_LOW_STOCK")?.href, `/dashboard/branch-context?branch=${branchId}&next=%2Fdashboard%2Finventory`);
});

test("Salon today and Staff snapshot use Appointment assignments", () => {
  const operation = deriveSalonOperations([salonAppointment])[0];
  assert.equal(operation?.staffSummary, "Alex");
  assert.equal(operation?.resourceSummary, "Chair 1");
  const staff = deriveSalonStaff([{ id: "staff-a", displayName: "Alex", jobFunction: "Stylist" }], [{ ...salonAppointment, status: "in_service" }], new Date("2026-09-03T02:30:00.000Z"))[0];
  assert.equal(staff?.status, "busy");
  assert.equal(staff?.href, "/dashboard/appointments/appointment-a");
});

test("Core composition sorts priority then age and derives attention counts", () => {
  const shared: SharedCommandCenterSnapshot = { scope: { mode: "branch", organizationId: "org", branchIds: [branchId], selectedBranchId: branchId, label: "Main", currency: "PHP" }, metrics: [], actions: [], operations: [], staff: [], branchPerformance: [{ branchId, branchName: "Main", timezone: "Asia/Manila", revenueTodayCentavos: 0, appointmentsToday: 0, outstandingCentavos: 0, lowStockCount: 0, attentionCount: 0 }] };
  const actions = deriveSalonActions([{ ...salonAppointment, id: "new", createdAt: "2026-09-02T00:00:00.000Z" }, salonAppointment], new Map([[branchId, 1]]));
  const composed = composeCommandCenterSnapshot(shared, { actions });
  assert.deepEqual(composed.actions.slice(0, 2).map(({ id }) => id), ["appointment-requested-appointment-a", "appointment-requested-new"]);
  assert.equal(composed.metrics.find(({ key }) => key === "attention")?.value, 3);
  assert.equal(composed.branchPerformance[0]?.attentionCount, 3);
});

test("Salon contributor has no Automotive dependency or terminology", () => {
  for (const file of ["modules/salon/command-center/salon-command-center.ts", "modules/salon/command-center/salon-command-center.runtime.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /modules\/automotive|vehicle|job order|service bay|maintenance/i, file);
  }
});

test("Salon Command Center uses shared migration-compatible Staff and assignment reads", () => {
  const source = readFileSync(new URL("../modules/salon/command-center/salon-command-center.runtime.ts", import.meta.url), "utf8");
  assert.match(source, /listOperationalStaffDirectory\(shared\.scope\.organizationId\)/);
  assert.match(source, /loadAppointmentAssignmentContext\(shared\.scope\.organizationId, appointmentIds\)/);
  assert.doesNotMatch(source, /from\("staff_directory"\)/);
  assert.match(source, /assignmentContextResult\.error/);
  assert.match(source, /memberInScope\(member\.branchIds, branchIds\)/);
});

test("Command Center dashboard enforces role split and stable semantic IDs", () => {
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const view = readFileSync(new URL("../components/command-center/command-center.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dashboard, /^import\s.+["']@\/modules\/(?:automotive|salon)\//m);
  assert.match(dashboard, /await import\("@\/modules\/salon\/command-center\/salon-command-center\.runtime"\)/);
  assert.match(dashboard, /await import\("@\/modules\/automotive\/command-center\/automotive-command-center\.runtime"\)/);
  assert.match(dashboard, /activeMembership\.role === "owner" \|\| activeMembership\.role === "manager"/);
  assert.match(dashboard, /role === "technician"\) redirect\("\/dashboard\/my-work"\)/);
  assert.match(dashboard, /no financial or organization-wide metrics/i);
  for (const id of ["negosu-command-center-page", "negosu-command-center-header", "negosu-command-center-operational-date", "negosu-command-center-branch-selector", "negosu-command-center-metrics", "negosu-command-center-revenue", "negosu-command-center-appointments", "negosu-command-center-outstanding", "negosu-command-center-attention-count", "negosu-action-inbox", "negosu-today-operations", "negosu-staff-snapshot", "negosu-branch-performance", "negosu-command-center-quick-actions"]) assert.match(view, new RegExp(id), id);
  assert.match(view, /attentionCount.*snapshot\.metrics/);
  assert.match(dashboard, /automotive-command-center-jobs/);
  assert.match(dashboard, /automotive-command-center-estimates/);
  assert.match(dashboard, /salon-command-center-today-appointments/);
  assert.match(dashboard, /branches=\{activeMembership\.branches\}/);
  assert.match(view, /action="\/dashboard\/branch-context"/);
  assert.match(view, /snapshot\.scope\.mode !== "all"/);
});

test("dashboard branch context accepts only UUID or all with allowlisted destinations", () => {
  const branch = "5b900000-0000-4000-8000-000000000001";
  assert.equal(parseDashboardBranchContext(new URLSearchParams({ branch: "all", next: "/dashboard" })).success, true);
  assert.equal(parseDashboardBranchContext(new URLSearchParams({ branch, next: "/dashboard/inventory" })).success, true);
  assert.equal(parseDashboardBranchContext(new URLSearchParams({ branch: "all", next: "/dashboard/inventory" })).success, false);
  assert.equal(parseDashboardBranchContext(new URLSearchParams({ branch: "not-a-uuid", next: "/dashboard" })).success, false);
  assert.equal(parseDashboardBranchContext(new URLSearchParams({ branch, next: "https://evil.example" })).success, false);
  assert.equal(dashboardBranchContextHref(branch, "/dashboard/inventory"), `/dashboard/branch-context?branch=${branch}&next=%2Fdashboard%2Finventory`);
});

test("branch context route preserves all-branch cookie and validates concrete access before replacement", () => {
  const source = readFileSync(new URL("../app/dashboard/branch-context/route.ts", import.meta.url), "utf8");
  const allBranch = source.indexOf('parsed.data.branch === "all"');
  const accessCheck = source.indexOf("activeMembership.branches.some");
  const cookieWrite = source.indexOf("response.cookies.set");
  assert.ok(allBranch >= 0 && allBranch < accessCheck);
  assert.ok(accessCheck >= 0 && accessCheck < cookieWrite);
  assert.match(source, /\/dashboard\?branch=all/);
  assert.doesNotMatch(source.slice(allBranch, accessCheck), /cookies\.set|cookies\.delete/);
});
