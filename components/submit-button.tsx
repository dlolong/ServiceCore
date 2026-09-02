"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({ id, children, pendingText, className, size="default", variant = "primary" }: { id?: string; children: React.ReactNode; pendingText: string; className?: string; size?:"default"|"sm";variant?: "primary" | "secondary" | "destructive" }) {
  const { pending } = useFormStatus();
  return <Button id={id} className={className} size={size} variant={variant} type="submit" disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</Button>;
}
