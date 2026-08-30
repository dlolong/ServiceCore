"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({ id, children, pendingText, className, variant = "primary" }: { id?: string; children: React.ReactNode; pendingText: string; className?: string; variant?: "primary" | "secondary" | "destructive" }) {
  const { pending } = useFormStatus();
  return <Button id={id} className={className} variant={variant} type="submit" disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</Button>;
}
