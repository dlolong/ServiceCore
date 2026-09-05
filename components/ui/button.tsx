import { cloneElement, isValidElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "border border-transparent bg-brand-primary text-white shadow-ui-sm hover:bg-brand-primary-strong disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300 aria-disabled:bg-slate-300 aria-disabled:text-slate-600 aria-disabled:hover:bg-slate-300",
  secondary: "border border-admin-border-strong bg-admin-surface text-admin-text shadow-ui-sm hover:border-slate-400 hover:bg-admin-surface-muted disabled:border-admin-border disabled:bg-slate-100 disabled:text-slate-500 disabled:hover:border-admin-border disabled:hover:bg-slate-100 aria-disabled:border-admin-border aria-disabled:bg-slate-100 aria-disabled:text-slate-500 aria-disabled:hover:border-admin-border aria-disabled:hover:bg-slate-100",
  outline: "border border-admin-border-strong bg-transparent text-admin-text hover:border-brand-border hover:bg-brand-tint hover:text-brand-primary-strong disabled:border-admin-border disabled:text-slate-400 disabled:hover:bg-transparent aria-disabled:border-admin-border aria-disabled:text-slate-400 aria-disabled:hover:border-admin-border aria-disabled:hover:bg-transparent",
  ghost: "border border-transparent bg-transparent text-admin-text-secondary hover:bg-slate-100 hover:text-admin-text disabled:text-slate-400 disabled:hover:bg-transparent aria-disabled:text-slate-400 aria-disabled:hover:bg-transparent",
  danger: "border border-transparent bg-status-danger text-white shadow-ui-sm hover:bg-red-800 disabled:bg-red-200 disabled:text-red-700 disabled:hover:bg-red-200 aria-disabled:bg-red-200 aria-disabled:text-red-700 aria-disabled:hover:bg-red-200",
  destructive: "border border-transparent bg-status-danger text-white shadow-ui-sm hover:bg-red-800 disabled:bg-red-200 disabled:text-red-700 disabled:hover:bg-red-200 aria-disabled:bg-red-200 aria-disabled:text-red-700 aria-disabled:hover:bg-red-200",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children?: ReactNode;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: keyof typeof variants;
};

export function Button({ asChild = false, children, className, size = "default", variant = "primary", ...props }: ButtonProps) {
  const sizes = {
    sm: "min-h-11 px-3 py-2",
    default: "min-h-11 px-4 py-2",
    lg: "min-h-12 px-5 py-2.5 text-base",
    icon: "size-11 shrink-0 p-0",
  } as const;
  const styles = cn(
    "inline-flex items-center justify-center gap-2 rounded-ui-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:shadow-none",
    sizes[size],
    variants[variant],
    className,
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown> & { className?: string; onClick?: (event: MouseEvent<HTMLElement>) => void }>;
    const safeChildProps = { ...props } as Record<string, unknown>;
    const disabled = Boolean(props.disabled);
    const buttonOnClick = props.onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined;
    const childOnClick = child.props.onClick;
    for (const buttonOnlyProp of ["disabled", "form", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "name", "type", "value"]) {
      delete safeChildProps[buttonOnlyProp];
    }
    delete safeChildProps.onClick;
    const onClick = disabled || buttonOnClick || childOnClick ? (event: MouseEvent<HTMLElement>) => {
      childOnClick?.(event);
      if (event.defaultPrevented) return;
      if (disabled) {
        event.preventDefault();
        return;
      }
      buttonOnClick?.(event);
    } : undefined;
    return cloneElement(child, {
      ...safeChildProps,
      ...child.props,
      "aria-disabled": disabled ? true : child.props["aria-disabled"] ?? safeChildProps["aria-disabled"],
      tabIndex: disabled ? -1 : child.props.tabIndex ?? safeChildProps.tabIndex,
      className: cn(styles, child.props.className),
      onClick,
    });
  }

  return <button className={styles} {...props}>{children}</button>;
}
