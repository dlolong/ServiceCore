import Link from "next/link";

import { CustomerForm } from "@/components/crm-forms";
import { PageHeader } from "@/components/page-patterns";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; warning?: string; duplicateId?: string }> }) {
  const parameters = await searchParams;
  return <main id="customer-create-page" className="mx-auto min-w-0 max-w-3xl">
    <PageHeader id="customer-create-page-header" eyebrow="Customers" title="Add customer" description="Keep the common path fast; contact and address details are optional." action={<Link id="customer-import-link" className="text-sm font-bold text-brand-primary-strong underline underline-offset-4" href="/dashboard/customers/import">Preview a CSV import</Link>}/>
    <section id="customer-create-section" className="mt-5"><CustomerForm {...parameters}/></section>
  </main>;
}
