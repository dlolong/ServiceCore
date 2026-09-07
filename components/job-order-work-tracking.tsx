import { endTechnicianWork, startTechnicianWork } from "@/app/dashboard/job-actions";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { WorkSessionTimer } from "@/components/work-session-timer";
import {
  formatWorkDuration,
  summarizeAutomotiveWorkSessions,
  type AutomotiveWorkSession,
} from "@/modules/automotive/work-tracking/work-session.service";

type TechnicianOption = { staffId: string; name: string };

export function JobOrderWorkTracking({
  jobOrderId,
  sessions,
  assignedTechnicians,
  actorStaffId,
  canManage,
  canStart,
  blocker,
}: {
  jobOrderId: string;
  sessions: AutomotiveWorkSession[];
  assignedTechnicians: TechnicianOption[];
  actorStaffId: string | null;
  canManage: boolean;
  canStart: boolean;
  blocker?: string | null;
}) {
  const now = new Date();
  const summary = summarizeAutomotiveWorkSessions(sessions, now);
  const activeIds = new Set(summary.activeSessions.map(({ staffId }) => staffId));
  const startable = assignedTechnicians.filter(({ staffId }) => !activeIds.has(staffId) && (canManage || staffId === actorStaffId));
  return <Card id="job-order-work-tracking-section" className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">Technician work tracking</h2><p className="mt-1 text-xs text-zinc-500">Operational labor effort from server timestamps. It does not change billing or payroll.</p></div>
      <div id="job-order-total-labor-time" className="text-right"><span className="block text-xs font-bold uppercase text-zinc-500">Total labor</span><strong className="text-xl">{formatWorkDuration(summary.totalSeconds)}</strong></div>
    </div>
    <div id="job-order-active-technicians" className="mt-4 grid gap-2">
      {summary.activeSessions.map((session) => <article id={`technician-work-session-row-${session.id}`} key={session.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{session.technicianName}</strong><small className="block text-emerald-800">Working now</small></span><WorkSessionTimer id={`job-order-active-session-timer-${session.id}`} startedAt={session.startedAt} className="font-semibold text-emerald-800"/></div>
        {(canManage || session.staffId === actorStaffId) ? <details className="mt-3 border-t border-emerald-200 pt-2"><summary className="cursor-pointer text-xs font-bold">Pause or stop session</summary><form id={`job-order-end-work-form-${session.id}`} action={endTechnicianWork} className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><input type="hidden" name="jobId" value={jobOrderId}/><input type="hidden" name="sessionId" value={session.id}/><select id={`job-order-end-work-action-${session.id}`} name="action" className="min-h-10 rounded-lg border bg-white px-2 text-sm"><option value="pause">Pause</option><option value="stop">Stop session</option></select><input id={`job-order-work-note-${session.id}`} name="notes" maxLength={1000} placeholder="Optional work note" className="min-h-10 rounded-lg border bg-white px-3 text-sm"/><SubmitButton id={`job-order-stop-work-button-${session.id}`} size="sm" pendingText="Saving…" variant="secondary">Save</SubmitButton></form></details> : null}
      </article>)}
      {!summary.activeSessions.length ? <p className="rounded-xl border border-dashed p-3 text-sm text-zinc-500">No technician is actively timed on this Job Order.</p> : null}
    </div>
    {canStart && startable.length ? <div className="mt-3 flex flex-wrap gap-2">{startable.map((staff) => <form id={`job-order-start-work-form-${staff.staffId}`} key={staff.staffId} action={startTechnicianWork}><input type="hidden" name="jobId" value={jobOrderId}/><input type="hidden" name="staffId" value={staff.staffId}/><SubmitButton id={`job-order-start-work-button-${staff.staffId}`} pendingText="Starting…">{sessions.some(({ staffId }) => staffId === staff.staffId) ? `Resume ${staff.name}` : `Start ${staff.name}`}</SubmitButton></form>)}</div> : null}
    {!canStart && blocker ? <p className="mt-3 text-sm font-semibold text-amber-800">{blocker}</p> : null}
    {summary.technicianTotals.length ? <div className="mt-4 border-t pt-3"><h3 className="text-xs font-bold uppercase text-zinc-500">Technician totals</h3><dl className="mt-2 grid gap-1 text-sm">{summary.technicianTotals.map((technician) => <div key={technician.staffId} className="flex justify-between gap-3"><dt>{technician.technicianName}</dt><dd className="font-bold">{formatWorkDuration(technician.totalSeconds)}</dd></div>)}</dl></div> : null}
  </Card>;
}
