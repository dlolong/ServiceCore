"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";

const required = ["full_name", "phone", "email", "address_line", "city", "province", "notes"];
function parseCsv(text: string) {
  return text.split(/\r?\n/).filter(Boolean).slice(0, 21).map((line) => line.split(",").map((value) => value.trim().replace(/^"|"$/g, "")));
}

export default function Page() {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState("");
  async function preview(file?: File) {
    setError(""); setRows([]);
    if (!file) return;
    const parsed = parseCsv(await file.text());
    if (!parsed.length || required.some((field, index) => parsed[0]?.[index] !== field)) {
      setError(`Use the template columns in this order: ${required.join(", ")}.`); return;
    }
    setRows(parsed);
  }
  return <div className="mx-auto max-w-5xl"><p className="text-sm font-bold text-amber-700">Customers</p><h1 className="mt-1 text-3xl font-black">Preview CSV import</h1><p className="mt-2 text-zinc-600">Review up to 20 rows safely before importing. Bulk database writes are intentionally deferred; no data is saved on this screen.</p><Card className="mt-6 p-5"><div className="flex flex-wrap items-center gap-4"><Link className="font-bold text-amber-800 underline" href="/dashboard/customers/import/template">Download CSV template</Link><label className="font-semibold">Choose CSV<input className="mt-2 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => void preview(event.target.files?.[0])}/></label></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{rows.length > 0 && <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr>{rows[0].map((heading) => <th className="border-b p-2" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, index) => <tr key={index}>{required.map((_, column) => <td className="border-b p-2" key={column}>{row[column] || "—"}</td>)}</tr>)}</tbody></table><p className="mt-3 text-xs text-zinc-500">Preview only — {rows.length - 1} row(s), no changes saved.</p></div>}</Card><Link className="mt-5 inline-block font-bold text-zinc-700" href="/dashboard/customers">Back to customers</Link></div>;
}
