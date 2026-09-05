"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({ id, children, pendingText, className, size="default", variant = "primary" }: { id?: string; children: React.ReactNode; pendingText: string; className?: string; size?: ButtonProps["size"]; variant?: ButtonProps["variant"] }) {
  const { pending } = useFormStatus();
  return <Button id={id} className={className} size={size} variant={variant} type="submit" disabled={pending} aria-disabled={pending} aria-busy={pending}>
    {pending ? <><span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />{pendingText}</> : children}
  </Button>;
}
