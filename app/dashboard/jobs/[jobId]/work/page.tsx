import Link from "next/link";
import { notFound } from "next/navigation";

import { addJobService, assignJobItem, transitionJobService } from "@/app/dashboard/job-actions";
import { FormMessage } from "@/components/form-message";
import { EmptyState, ErrorState, PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import {
  isMissingCanonicalAutomotiveStaffColumn,
  isMissingStaffDirectory,
  type DatabaseError,
} from "@/lib/supabase/schema-compatibility";

type WorkItem = {
  id: string;
  service_name_snapshot: string;
  quantity: number;
  line_total_centavos: number;
  approval_status: string;
  notes: string | null;
  technician_staff_id: string | null;
  technician_assigned_at: string | null;
};
type JobWork = { id: string; branch_id: string; status: string; job_order_items: WorkItem[] };
type ServiceOption = { id: string; name: string; base_price_centavos: number };
type StaffOption = { staff_id: string; full_name: string; branch_ids: string[] };
type Query = { message?: string; error?: string };

export default async function JobWorkPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<Query> }) {
  const [{ jobId }, query, { activeMembership }, supabase] = await Promise.all([params, searchParams, getDashboardContext(), createClient()]);
  const canManage = ["owner", "manager", "advisor"].includes(activeMembership.role);
  const loaded = await loadJobWorkPageData(supabase, activeMembership.organizationId, jobId, canManage);
  if (!loaded.job && !loaded.error) notFound();
  const jobBranchId = loaded.job?.branch_id;
  const branchStaff = jobBranchId
    ? loaded.staff.filter((staff) => !staff.branch_ids.length || staff.branch_ids.includes(jobBranchId))
    : [];

  return <main id="job-order-work-page" className="mx-auto max-w-3xl">
    <PageHeader
      id="job-order-work-page-header"
      eyebrow="Job order"
      title="Work and approvals"
      description="Assign service work, review approvals, and add authorized work without leaving the Job Order."
      action={<Button id="job-order-work-back-button" asChild variant="secondary"><Link href={`/dashboard/jobs/${jobId}`}>Back to job</Link></Button>}
    />
    <FormMessage {...query} />
    {loaded.error || !loaded.job ? <ErrorState id="job-order-work-load-error" title="Unable to load work" description="Refresh the page and try again. If the problem continues, finish the pending development migrations." /> : <>
      <Card id="job-order-current-work" className="mt-5 p-4 sm:p-5">
        <h2 className="font-semibold">Current work</h2>
        {loaded.job.job_order_items.length ? <div id="job-order-current-work-list" className="mt-3 space-y-3">
          {loaded.job.job_order_items.map((item) => <article id={`job-order-work-item-${item.id}`} className="rounded-xl border border-admin-border p-3" key={item.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <span><strong className="font-medium">{item.service_name_snapshot} × {item.quantity}</strong><small className="block capitalize text-admin-text-muted">{item.approval_status}</small></span>
              <span className="font-medium">{formatMoney(item.line_total_centavos)}</span>
            </div>
            {item.notes ? <p className="mt-2 text-sm">{item.notes}</p> : null}
            {canManage ? <form id={`job-order-work-assignment-form-${item.id}`} action={assignJobItem} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="itemId" value={item.id} />
              <label className="sr-only" htmlFor={`job-order-work-technician-select-${item.id}`}>Technician for {item.service_name_snapshot}</label>
              <select id={`job-order-work-technician-select-${item.id}`} name="staffId" defaultValue={item.technician_staff_id ?? ""} className="min-h-11 min-w-0 grow rounded-xl border border-admin-border-strong bg-white px-3 text-sm">
                <option value="">No service technician</option>
                {branchStaff.map((staff) => <option key={staff.staff_id} value={staff.staff_id}>{staff.full_name}</option>)}
              </select>
              <SubmitButton id={`job-order-work-assign-button-${item.id}`} pendingText="Assigning…" variant="secondary">Assign</SubmitButton>
            </form> : null}
            {canManage && item.approval_status === "proposed" ? <div className="mt-3 flex flex-wrap gap-2">
              <ItemAction jobId={jobId} itemId={item.id} action="approve" />
              <ItemAction jobId={jobId} itemId={item.id} action="decline" />
            </div> : null}
          </article>)}
        </div> : <EmptyState id="job-order-current-work-empty" title="No work items" description="Add a service to begin building this Job Order." />}
      </Card>

      {canManage && !["completed", "cancelled"].includes(loaded.job.status) ? <Card id="job-order-additional-work" className="mt-4 p-4 sm:p-5">
        <h2 className="font-semibold">Add additional work</h2>
        {loaded.servicesError ? <ErrorState id="job-order-services-load-error" title="Services unavailable" description="The service catalog could not be loaded. Refresh before adding work." /> : <form id="job-order-additional-work-form" action={addJobService} className="mt-4 grid gap-4">
          <input type="hidden" name="jobId" value={loaded.job.id} />
          <label className="text-sm font-medium" htmlFor="job-order-additional-service-select">Service
            <select id="job-order-additional-service-select" required name="serviceId" className="mt-2 min-h-11 w-full rounded-xl border border-admin-border-strong bg-white px-3">
              <option value="">Select service</option>
              {loaded.services.map((service) => <option key={service.id} value={service.id}>{service.name} · {formatMoney(service.base_price_centavos)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium" htmlFor="job-order-additional-quantity-input">Quantity
            <Input id="job-order-additional-quantity-input" required name="quantity" type="number" min={1} max={100} defaultValue={1} />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium" htmlFor="job-order-additional-approval-checkbox">
            <input id="job-order-additional-approval-checkbox" name="requiresApproval" type="checkbox" defaultChecked /> Customer approval required
          </label>
          <label className="text-sm font-medium" htmlFor="job-order-additional-notes-input">Notes
            <textarea id="job-order-additional-notes-input" name="notes" className="mt-2 min-h-20 w-full rounded-xl border border-admin-border-strong bg-white px-3 py-2" />
          </label>
          <SubmitButton id="job-order-additional-work-save-button" pendingText="Adding…">Add work</SubmitButton>
        </form>}
      </Card> : null}
    </>}
  </main>;
}

function ItemAction({ jobId, itemId, action }: { jobId: string; itemId: string; action: "approve" | "decline" }) {
  return <form id={`job-order-work-${action}-form-${itemId}`} action={transitionJobService}>
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="action" value={action} />
    <SubmitButton id={`job-order-work-${action}-button-${itemId}`} pendingText="Updating…" variant={action === "decline" ? "danger" : "secondary"}>{action === "approve" ? "Approve" : "Decline"}</SubmitButton>
  </form>;
}

async function loadJobWorkPageData(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, jobId: string, includeStaff: boolean): Promise<{
  job: JobWork | null; services: ServiceOption[]; staff: StaffOption[]; error: DatabaseError; servicesError: DatabaseError;
}> {
  const [canonicalJob, services, canonicalStaff] = await Promise.all([
    supabase.from("job_orders").select("id,branch_id,status,job_order_items(id,service_name_snapshot,quantity,line_total_centavos,approval_status,notes,technician_staff_id,technician_assigned_at)").eq("id", jobId).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("services").select("id,name,base_price_centavos").eq("organization_id", organizationId).eq("is_active", true).order("name"),
    includeStaff ? supabase.from("staff_directory").select("staff_id,full_name,branch_ids").eq("organization_id", organizationId).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
  ]);
  const missingCanonicalJob = isMissingCanonicalAutomotiveStaffColumn(canonicalJob.error);
  const missingCanonicalDirectory = isMissingStaffDirectory(canonicalStaff.error);
  if (!missingCanonicalJob && !missingCanonicalDirectory) return {
    job: canonicalJob.data as unknown as JobWork | null,
    services: (services.data ?? []) as ServiceOption[],
    staff: (canonicalStaff.data ?? []) as StaffOption[],
    error: canonicalJob.error ?? canonicalStaff.error,
    servicesError: services.error,
  };
  if ((canonicalJob.error && !missingCanonicalJob) || (canonicalStaff.error && !missingCanonicalDirectory)) return {
    job: null, services: (services.data ?? []) as ServiceOption[], staff: [], error: canonicalJob.error ?? canonicalStaff.error, servicesError: services.error,
  };

  const [legacyJob, legacyStaff] = await Promise.all([
    supabase.from("job_orders").select("id,branch_id,status,job_order_items(id,service_name_snapshot,quantity,line_total_centavos,approval_status,notes,technician_user_id,technician_assigned_at)").eq("id", jobId).eq("organization_id", organizationId).maybeSingle(),
    includeStaff ? supabase.rpc("list_staff", { p_organization_id: organizationId }) : Promise.resolve({ data: [], error: null }),
  ]);
  const legacyData = legacyJob.data as unknown as (Omit<JobWork, "job_order_items"> & { job_order_items: Array<Omit<WorkItem, "technician_staff_id"> & { technician_user_id: string | null }> }) | null;
  const job = legacyData ? {
    ...legacyData,
    job_order_items: legacyData.job_order_items.map((item) => ({ ...item, technician_staff_id: item.technician_user_id })),
  } as JobWork : null;
  const staff = ((legacyStaff.data ?? []) as Array<{ user_id: string; full_name: string; branch_ids: string[] | null }>).map((item) => ({
    staff_id: item.user_id, full_name: item.full_name, branch_ids: item.branch_ids ?? [],
  }));
  return { job, services: (services.data ?? []) as ServiceOption[], staff, error: legacyJob.error ?? legacyStaff.error, servicesError: services.error };
}
