export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return <div role={error ? "alert" : "status"} className={`mt-5 rounded-xl px-4 py-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{error ?? message}</div>;
}
