export type QueueDisplayIndustry = "automotive" | "salon";
export type QueueDisplayItem = { key: string; label: string; detail: string | null };
export type QueueDisplaySnapshot = {
  organizationName: string;
  branchName: string;
  industry: QueueDisplayIndustry;
  date: string;
  timezone: string;
  refreshedAt: string;
  serving: QueueDisplayItem[];
  waiting: QueueDisplayItem[];
};
