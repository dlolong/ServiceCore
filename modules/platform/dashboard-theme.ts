export const dashboardThemeIds = ["ocean", "graphite", "emerald", "indigo"] as const;

export type DashboardThemeId = (typeof dashboardThemeIds)[number];

export type DashboardThemeOption = {
  id: DashboardThemeId;
  name: string;
  description: string;
  swatches: readonly [string, string, string];
};

export const dashboardThemes: readonly DashboardThemeOption[] = [
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Clear blue accents with a navy workspace.",
    swatches: ["#071a45", "#0062dc", "#edf6ff"],
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral slate tones for a focused workspace.",
    swatches: ["#172033", "#475569", "#f1f5f9"],
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Balanced teal accents with deep green chrome.",
    swatches: ["#0b2e2a", "#0f766e", "#ecfdf5"],
  },
  {
    id: "indigo",
    name: "Indigo",
    description: "Polished indigo accents with a dark violet base.",
    swatches: ["#1e1b4b", "#4f46e5", "#eef2ff"],
  },
] as const;

export function isDashboardTheme(value: unknown): value is DashboardThemeId {
  return typeof value === "string" && dashboardThemeIds.includes(value as DashboardThemeId);
}

export function resolveDashboardTheme(value: unknown): DashboardThemeId {
  return isDashboardTheme(value) ? value : "ocean";
}
