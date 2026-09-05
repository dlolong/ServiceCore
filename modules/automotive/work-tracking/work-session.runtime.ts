import "server-only";

import { requireAutomotiveContext } from "@/lib/auth/industry-access";
import { createClient } from "@/lib/supabase/server";
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
    const { data, error } = await supabase.rpc("start_automotive_staff_work_session", {
      p_job_order_id: jobOrderId,
      p_staff_id: staffId,
    });
    if (error || !data) controlledError(error, "Unable to start technician work.");
    return data;
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
