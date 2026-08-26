"use client";

import { useRef } from "react";

import { Input } from "@/components/ui/input";

export function PasswordFields({ current = false }: { current?: boolean }) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  function validateConfirmation() {
    const confirmation = confirmationRef.current;
    if (!confirmation) return;
    confirmation.setCustomValidity(confirmation.value === passwordRef.current?.value ? "" : "Passwords do not match.");
  }

  return (
    <>
      <label className="block text-sm font-semibold">
        {current ? "New password" : "Password"}
        <Input ref={passwordRef} required minLength={8} maxLength={72} autoComplete="new-password" name="password" type="password" className="mt-2" onInput={validateConfirmation} aria-describedby="password-requirements" />
        <span id="password-requirements" className="mt-1 block text-xs font-normal text-zinc-600">Use 8–72 characters.</span>
      </label>
      <label className="block text-sm font-semibold">
        Confirm password
        <Input ref={confirmationRef} required minLength={8} maxLength={72} autoComplete="new-password" name="confirmPassword" type="password" className="mt-2" onInput={validateConfirmation} />
      </label>
    </>
  );
}
