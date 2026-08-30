import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { saveSchedulingResource } from "../../actions";

export default async function EditSchedulingResourcePage({ params }: { params: Promise<{ resourceId: string }> }) {
  const [{ resourceId }, { activeMembership }, supabase] = await Promise.all([params, getDashboardContext(), createClient()]);
  const { data: resource } = await supabase.from("scheduling_resources").select("id,name,branch_id,resource_type,capacity").eq("id", resourceId).eq("organization_id", activeMembership.organizationId).maybeSingle();
  if (!resource || !["owner", "manager"].includes(activeMembership.role)) notFound();
  return <div id="scheduling-resource-edit-page" className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Settings</p><h1 className="mt-1 text-3xl font-black">Edit service bay</h1><Card className="mt-6 p-5"><form id="scheduling-resource-edit-form" action={saveSchedulingResource} className="grid gap-4 sm:grid-cols-2"><input name="id" type="hidden" value={resource.id}/><label className="text-sm font-semibold">Name<Input id="scheduling-resource-edit-name-input" required name="name" defaultValue={resource.name} maxLength={120} className="mt-2"/></label><label className="text-sm font-semibold">Branch<select id="scheduling-resource-edit-branch-select" name="branchId" defaultValue={resource.branch_id} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3">{activeMembership.branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-sm font-semibold">Type<select id="scheduling-resource-edit-type-select" name="resourceType" defaultValue={resource.resource_type} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3"><option value="bay">Bay</option><option value="station">Station</option><option value="room">Room</option><option value="equipment">Equipment</option><option value="other">Other</option></select></label><label className="text-sm font-semibold">Capacity<Input id="scheduling-resource-edit-capacity-input" required name="capacity" type="number" min={1} max={100} defaultValue={resource.capacity} className="mt-2"/></label><SubmitButton id="scheduling-resource-edit-save-button" pendingText="Saving…">Save changes</SubmitButton></form></Card></div>;
}
