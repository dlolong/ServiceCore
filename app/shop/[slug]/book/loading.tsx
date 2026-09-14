export default function Loading() {
  return <main id="public-booking-loading" className="min-h-dvh bg-admin-canvas text-admin-text" aria-busy="true" aria-label="Loading booking availability">
    <div className="border-b border-admin-border bg-white"><div className="mx-auto h-16 max-w-6xl px-4 sm:px-6"/></div>
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="h-4 w-28 rounded bg-admin-border"/><div className="mt-3 h-10 max-w-md rounded bg-admin-border"/><div className="mt-3 h-5 max-w-xl rounded bg-admin-border"/>
      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5"><div className="h-48 rounded-ui-lg border border-admin-border bg-white"/><div className="h-[30rem] rounded-ui-lg border border-admin-border bg-white"/><div className="h-64 rounded-ui-lg border border-admin-border bg-white"/></div>
        <div className="hidden h-64 rounded-ui-lg border border-admin-border bg-white lg:block"/>
      </div>
    </div>
  </main>;
}
