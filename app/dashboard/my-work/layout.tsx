import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { requireAutomotiveContext } from "@/lib/auth/industry-access";

export default async function MyWorkLayout({ children }: { children: ReactNode }) {
  const { activeMembership } = await requireAutomotiveContext();
  if (!["owner", "manager", "advisor", "technician"].includes(activeMembership.role)) notFound();
  return children;
}
