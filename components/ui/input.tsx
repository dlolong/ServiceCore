import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("min-h-11 w-full rounded-ui-md border border-admin-border-strong bg-admin-surface px-3 py-2 text-admin-text shadow-ui-sm placeholder:text-slate-400 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-invalid:border-status-danger aria-invalid:ring-status-danger/20", className)} {...props} />;
});
