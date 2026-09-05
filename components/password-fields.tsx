"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";

export function PasswordFields({ current = false, idPrefix = "auth" }: { current?: boolean; idPrefix?: string }) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  function validateConfirmation() {
    const confirmation = confirmationRef.current;
    if (!confirmation) return;
    confirmation.setCustomValidity(confirmation.value === passwordRef.current?.value ? "" : "Passwords do not match.");
  }

  return (
    <>
      <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-password-input`}>
        {current ? "New password" : "Password"}
        <Input id={`${idPrefix}-password-input`} ref={passwordRef} required minLength={8} maxLength={72} autoComplete="new-password" name="password" type="password" className="mt-2" onInput={validateConfirmation} aria-describedby={`${idPrefix}-password-requirements`} />
        <span id={`${idPrefix}-password-requirements`} className="mt-1 block text-xs font-normal text-zinc-600">Use 8–72 characters.</span>
      </label>
      <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-confirm-password-input`}>
        Confirm password
        <Input id={`${idPrefix}-confirm-password-input`} ref={confirmationRef} required minLength={8} maxLength={72} autoComplete="new-password" name="confirmPassword" type="password" className="mt-2" onInput={validateConfirmation} />
      </label>
    </>
  );
}
