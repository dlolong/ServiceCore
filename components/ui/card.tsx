import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevation?: "none" | "sm" | "md";
  interactive?: boolean;
};

export function Card({ className, elevation = "sm", interactive = false, ...props }: CardProps) {
  const shadows = { none: "shadow-none", sm: "shadow-ui-sm", md: "shadow-ui-md" } as const;
  return <div className={cn(
    "rounded-ui-lg border border-admin-border bg-admin-surface",
    shadows[elevation],
    interactive && "transition-[border-color,box-shadow] hover:border-admin-border-strong hover:shadow-ui-md",
    className,
  )} {...props} />;
}
