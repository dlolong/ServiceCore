import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-zinc-950 text-white enabled:hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-700",
  secondary: "border border-zinc-200 bg-white text-zinc-950 enabled:hover:bg-zinc-50 disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-600",
  destructive: "bg-red-700 text-white enabled:hover:bg-red-800 disabled:bg-red-200 disabled:text-red-800",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: ReactNode;
  size?: "default" | "sm";
  variant?: keyof typeof variants;
};

export function Button({ asChild = false, children, className, size = "default", variant = "primary", ...props }: ButtonProps) {
  const styles = cn("inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed", size === "sm" ? "min-h-9 px-3 py-1.5" : "min-h-11 px-4 py-2", variants[variant], className);

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { className: cn(styles, child.props.className) });
  }

  return <button className={styles} {...props}>{children}</button>;
}
