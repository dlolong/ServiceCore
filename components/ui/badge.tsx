import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  neutral: "border-admin-border bg-slate-100 text-slate-700",
  brand: "border-brand-border bg-brand-tint text-brand-primary-strong",
  success: "border-emerald-200 bg-status-success-tint text-status-success",
  warning: "border-amber-200 bg-status-warning-tint text-status-warning",
  danger: "border-red-200 bg-status-danger-tint text-status-danger",
  info: "border-sky-200 bg-status-info-tint text-status-info",
} as const;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants };

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", variants[variant], className)} {...props} />;
}
