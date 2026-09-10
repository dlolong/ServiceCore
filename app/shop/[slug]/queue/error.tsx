"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="public-salon-queue-error" className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-white">
    <section className="max-w-lg text-center"><h1 className="text-2xl font-bold">Unable to load the customer queue</h1>
      <p className="mt-3 text-slate-300">Please try again or contact the salon.</p>
      <button id="public-salon-queue-retry" onClick={reset} className="mt-6 min-h-11 rounded-xl bg-white px-5 font-semibold text-slate-950">Try again</button>
    </section>
  </main>;
}
