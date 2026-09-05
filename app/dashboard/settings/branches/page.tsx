import Link from "next/link";

import { setPrimaryBranch, toggleBranch } from "@/app/dashboard/crm-actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const { data, error } = await supabase.from("branches")
    .select("id,name,address_line,barangay,city,province,is_active,is_primary,phone,email")
    .eq("organization_id", activeMembership.organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at");
  const canManage = ["owner", "manager"].includes(activeMembership.role);

  return <main id="branches-page" className="mx-auto min-w-0 max-w-5xl">
    <PageHeader id="branches-page-header" eyebrow="Settings" title="Branches" description="Manage locations and the organization default." action={canManage ? <Button asChild><Link id="branch-create-button" href="/dashboard/settings/branches/new">Add branch</Link></Button> : undefined}/>
    <FormMessage {...params} error={params.error ?? (error ? "Unable to load branches." : undefined)}/>
    <section id="branches-list" className="mt-5 grid gap-3">
      {data?.map((branch) => <Card id={`branch-card-${branch.id}`} key={branch.id} elevation="none" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{branch.name}</h2>{branch.is_primary ? <span className="rounded-full border border-brand-border bg-brand-tint px-2 py-1 text-xs font-bold text-brand-primary-strong">Default</span> : null}{!branch.is_active ? <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-bold">Inactive</span> : null}</div>
            <p className="mt-2 text-sm text-zinc-600">{[branch.address_line, branch.barangay, branch.city, branch.province].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-sm text-zinc-500">{branch.phone || branch.email || "No contact details"}</p>
          </div>
          {canManage ? <div className="flex flex-wrap gap-2">
            <Button id={`branch-edit-button-${branch.id}`} asChild variant="secondary"><Link href={`/dashboard/settings/branches/${branch.id}/edit`}>Edit</Link></Button>
            {branch.is_active && !branch.is_primary ? <form id={`branch-default-form-${branch.id}`} action={setPrimaryBranch}><input type="hidden" name="id" value={branch.id}/><SubmitButton id={`branch-default-button-${branch.id}`} variant="secondary" pendingText="Updating…">Make default</SubmitButton></form> : null}
            <form id={`branch-toggle-form-${branch.id}`} action={toggleBranch}><input type="hidden" name="id" value={branch.id}/><input type="hidden" name="active" value={String(!branch.is_active)}/><SubmitButton id={`branch-toggle-button-${branch.id}`} variant={branch.is_active ? "destructive" : "secondary"} pendingText="Updating…">{branch.is_active ? "Deactivate" : "Activate"}</SubmitButton></form>
          </div> : null}
        </div>
      </Card>)}
      {data?.length === 0 ? <Card id="branches-empty-state" elevation="none" className="p-10 text-center"><h2 className="font-black">No branches</h2><p className="mt-2 text-sm text-zinc-600">Add a location to continue operating this business.</p></Card> : null}
    </section>
  </main>;
}
