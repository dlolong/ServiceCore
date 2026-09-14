export default function Loading() {
  return <main id="public-booking-status-loading" className="min-h-dvh bg-admin-canvas" aria-busy="true" aria-label="Loading booking status">
    <div className="h-16 border-b border-admin-border bg-white"/>
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]"><div className="h-[34rem] animate-pulse rounded-ui-lg border border-admin-border bg-white"/><div className="hidden h-52 animate-pulse rounded-ui-lg border border-admin-border bg-white lg:block"/></div></div>
  </main>;
}
