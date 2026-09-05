import { createWalkIn } from "@/app/dashboard/operations-actions";
import { VisitForm } from "@/components/operations-forms";
import { PageHeader } from "@/components/page-patterns";
import { getVisitChoices } from "@/lib/operations-data";

export default async function Page({ searchParams }: { searchParams: Promise<{ customerQ?: string; error?: string }> }) {
  const parameters = await searchParams;
  const { activeMembership, customers, vehicles, services } = await getVisitChoices(parameters.customerQ);
  return <main id="walk-in-create-page" className="mx-auto min-w-0 max-w-3xl">
    <PageHeader id="walk-in-create-page-header" eyebrow="Walk-in queue" title="Add walk-in" description="Find the customer and vehicle, select services, and get an atomic queue number."/>
    <section id="walk-in-create-section" className="mt-5"><VisitForm mode="walk_in" action={createWalkIn} branches={activeMembership.branches.map((branch) => ({ id: branch.id, name: branch.name }))} customers={customers} vehicles={vehicles} services={services} customerQ={parameters.customerQ} error={parameters.error}/></section>
  </main>;
}
