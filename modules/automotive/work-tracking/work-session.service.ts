import { z } from "zod";

const startSchema = z.object({
  jobOrderId: z.uuid(),
  staffId: z.uuid().nullable().default(null),
});
const endSchema = z.object({
  sessionId: z.uuid(),
  action: z.enum(["pause", "stop"]),
  notes: z.string().trim().max(1000).nullable().default(null),
});

export type AutomotiveWorkSession = {
  id: string;
  jobOrderId: string;
  staffId: string;
  userId: string | null;
  technicianName: string;
  startedAt: string;
  endedAt: string | null;
  status: "active" | "completed" | "cancelled";
  endReason: "paused" | "stopped" | "job_cancelled" | null;
  notes: string | null;
};

export type AutomotiveWorkSessionSummary = {
  totalSeconds: number;
  firstStartedAt: string | null;
  lastActivityAt: string | null;
  activeSessions: AutomotiveWorkSession[];
  technicianTotals: Array<{ staffId: string; technicianName: string; totalSeconds: number }>;
};

export type AutomotiveWorkSessionPersistence = {
  start: (jobOrderId: string, staffId: string | null) => Promise<string>;
  end: (sessionId: string, action: "pause" | "stop", notes: string | null) => Promise<string>;
};

export class AutomotiveWorkTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomotiveWorkTrackingError";
  }
}

async function runtime(): Promise<AutomotiveWorkSessionPersistence> {
  return import("@/modules/automotive/work-tracking/work-session.runtime").then((module) => module.automotiveWorkSessionPersistence);
}

export async function startAutomotiveJobWorkSession(input: z.input<typeof startSchema>, persistence?: AutomotiveWorkSessionPersistence) {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) throw new AutomotiveWorkTrackingError("Work-session details are invalid.");
  return (persistence ?? await runtime()).start(parsed.data.jobOrderId, parsed.data.staffId);
}

export async function endAutomotiveJobWorkSession(input: z.input<typeof endSchema>, persistence?: AutomotiveWorkSessionPersistence) {
  const parsed = endSchema.safeParse(input);
  if (!parsed.success) throw new AutomotiveWorkTrackingError(parsed.error.issues[0]?.message ?? "Work-session details are invalid.");
  return (persistence ?? await runtime()).end(parsed.data.sessionId, parsed.data.action, parsed.data.notes || null);
}

export function getAutomotiveWorkSessionElapsedSeconds(session: Pick<AutomotiveWorkSession, "startedAt" | "endedAt">, now = new Date()) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function summarizeAutomotiveWorkSessions(sessions: AutomotiveWorkSession[], now = new Date()): AutomotiveWorkSessionSummary {
  const technicianMap = new Map<string, { staffId: string; technicianName: string; totalSeconds: number }>();
  let totalSeconds = 0;
  let firstStartedAt: string | null = null;
  let lastActivityAt: string | null = null;
  for (const session of sessions) {
    const seconds = getAutomotiveWorkSessionElapsedSeconds(session, now);
    totalSeconds += seconds;
    const technician = technicianMap.get(session.staffId) ?? {
      staffId: session.staffId,
      technicianName: session.technicianName,
      totalSeconds: 0,
    };
    technician.totalSeconds += seconds;
    technicianMap.set(session.staffId, technician);
    if (!firstStartedAt || session.startedAt < firstStartedAt) firstStartedAt = session.startedAt;
    const activity = session.endedAt ?? session.startedAt;
    if (!lastActivityAt || activity > lastActivityAt) lastActivityAt = activity;
  }
  return {
    totalSeconds,
    firstStartedAt,
    lastActivityAt,
    activeSessions: sessions.filter(({ status }) => status === "active"),
    technicianTotals: [...technicianMap.values()].sort((left, right) => right.totalSeconds - left.totalSeconds),
  };
}

export function formatWorkDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
