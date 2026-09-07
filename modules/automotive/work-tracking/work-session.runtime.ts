import "server-only";

import { requireAutomotiveContext } from "@/lib/auth/industry-access";
import { createClient } from "@/lib/supabase/server";
import { isMissingOptionalStaffRpc } from "@/lib/supabase/schema-compatibility";
import { AutomotiveWorkTrackingError, type AutomotiveWorkSessionPersistence } from "@/modules/automotive/work-tracking/work-session.service";

function controlledError(error: { message: string } | null, fallback: string): never {
  const allowed = ["job", "work session", "technician", "inspection", "authorization", "part", "active"];
  const message = error && allowed.some((term) => error.message.toLowerCase().includes(term)) ? error.message : fallback;
  throw new AutomotiveWorkTrackingError(message);
}

export const automotiveWorkSessionPersistence: AutomotiveWorkSessionPersistence = {
  async start(jobOrderId, staffId) {
    await requireAutomotiveContext();
    const supabase = await createClient();
    const canonical = await supabase.rpc("start_automotive_staff_work_session", {
      p_job_order_id: jobOrderId,
      p_staff_id: staffId,
    });
    if (!canonical.error && canonical.data) return canonical.data;
    if (!isMissingOptionalStaffRpc(canonical.error, "start_automotive_staff_work_session")) {
      controlledError(canonical.error, "Unable to start technician work.");
    }

    // The pre-0055 function accepts the same normalized identifier exposed by
    // legacy Job Order views: an authenticated technician user ID.
    const legacy = await supabase.rpc("start_automotive_job_work_session", {
      p_job_order_id: jobOrderId,
      p_technician_user_id: staffId,
    });
    if (legacy.error || !legacy.data) controlledError(legacy.error, "Unable to start technician work.");
    return legacy.data;
  },
  async end(sessionId, action, notes) {
    await requireAutomotiveContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("end_automotive_job_work_session", {
      p_session_id: sessionId,
      p_action: action,
      p_notes: notes,
    });
    if (error || !data) controlledError(error, "Unable to update technician work.");
    return data;
  },
};
