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
  return <main id="customer-import-page" className="mx-auto max-w-5xl"><p className="text-sm font-medium text-brand-primary">Customers</p><h1 className="mt-1 text-3xl font-semibold">Preview CSV import</h1><p className="mt-2 text-zinc-600">Review up to 20 rows safely before importing. Bulk database writes are intentionally deferred; no data is saved on this screen.</p><Card id="customer-import-card" className="mt-6 p-5"><div className="flex flex-wrap items-center gap-4"><Link id="customer-import-template-link" className="font-medium text-brand-primary-strong underline" href="/dashboard/customers/import/template">Download CSV template</Link><label className="font-medium" htmlFor="customer-import-file-input">Choose CSV<input id="customer-import-file-input" className="mt-2 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => void preview(event.target.files?.[0])}/></label></div>{error && <p id="customer-import-error" role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{rows.length > 0 && <><div id="customer-import-preview" className="mt-5 hidden overflow-x-auto md:block"><table id="customer-import-preview-table" className="min-w-full text-left text-sm"><thead><tr>{rows[0].map((heading) => <th className="border-b p-2 font-medium" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, index) => <tr key={index}>{required.map((_, column) => <td className="border-b p-2" key={column}>{row[column] || "—"}</td>)}</tr>)}</tbody></table><p className="mt-3 text-xs text-zinc-500">Preview only — {rows.length - 1} row(s), no changes saved.</p></div><div id="customer-import-preview-mobile" className="mt-5 grid gap-2 md:hidden">{rows.slice(1).map((row, index) => <article className="rounded-xl border border-admin-border p-3 text-sm" key={index}><p className="font-medium">{row[0] || "Unnamed customer"}</p><p className="mt-1 break-words text-admin-text-secondary">{[row[1], row[2]].filter(Boolean).join(" · ") || "No contact"}</p><p className="mt-1 text-xs text-admin-text-muted">{[row[4], row[5]].filter(Boolean).join(", ") || "No location"}</p></article>)}<p className="text-xs text-zinc-500">Preview only — {rows.length - 1} row(s), no changes saved.</p></div></>}</Card><Link id="customer-import-back-link" className="mt-5 inline-block font-medium text-brand-primary-strong hover:underline" href="/dashboard/customers">Back to customers</Link></main>;
}
