"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-5">
      <section className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-red-700">Something went wrong</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">We could not load this page.</h1>
        <p className="mt-4 text-zinc-600">Try again. If the problem continues, share the reference below with support.</p>
        {error.digest ? <p className="mt-2 text-xs text-zinc-500">Reference: {error.digest}</p> : null}
        <Button className="mt-7" onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
