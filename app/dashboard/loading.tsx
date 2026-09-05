export default function DashboardLoading() {
  return <main id="negosu-command-center-loading" aria-busy="true" aria-label="Loading Command Center" className="mx-auto min-w-0 max-w-7xl animate-pulse pb-5">
    <div id="negosu-command-center-header" className="h-24 border-b border-admin-border bg-white/60"/>
    <div id="negosu-command-center-metrics" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">{["revenue", "appointments", "outstanding", "low-stock", "attention-count"].map((metric) => <div id={`negosu-command-center-${metric}`} className="h-24 rounded-ui-lg border border-admin-border bg-white" key={metric}/>)}</div>
    <div className="mt-3 grid gap-3 xl:grid-cols-2"><div id="negosu-action-inbox" className="h-72 rounded-ui-lg border border-admin-border border-l-4 border-l-brand-primary bg-white"/><div id="negosu-today-operations" className="h-72 rounded-ui-lg border border-admin-border bg-white"/></div>
  </main>;
}
