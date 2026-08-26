export default function DashboardLoading() {
  return <div role="status" className="mx-auto max-w-7xl animate-pulse"><span className="sr-only">Loading workspace</span><div className="h-8 w-56 rounded-lg bg-zinc-200" /><div className="mt-4 h-4 w-80 max-w-full rounded bg-zinc-200" /><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-zinc-200" />)}</div></div>;
}
