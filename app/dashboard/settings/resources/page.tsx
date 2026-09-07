import Link from "next/link";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { saveSchedulingResource, toggleSchedulingResource } from "./actions";

type ResourceRow={id:string;name:string;branch_id:string;resource_type:string;capacity:number;is_active:boolean;branches:{name:string}|{name:string}[]|null};
type Branch={id:string;name:string};
const branchName=(resource:ResourceRow)=>{const branch=Array.isArray(resource.branches)?resource.branches[0]:resource.branches;return branch?.name??"Unknown branch";};

export default async function SchedulingResourcesPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; create?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const salon = activeMembership.industry === "salon",prefix = salon ? "salon-resource" : "scheduling-resource";
  const { data } = await supabase.from("scheduling_resources").select("id,name,branch_id,resource_type,capacity,is_active,branches(name)").eq("organization_id", activeMembership.organizationId).order("name");
  const resources=(data??[]) as unknown as ResourceRow[],canManage=["owner","manager"].includes(activeMembership.role);
  const branches=activeMembership.branches.map(({id,name})=>({id,name}));
  const form=<ResourceForm branches={branches} prefix={prefix} salon={salon}/>;
  return <main id={salon ? "salon-resources-page" : "scheduling-resources-page"} className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id={salon ? "salon-resources-page-header" : "scheduling-resources-page-header"} eyebrow="Settings" title={salon ? "Stations and resources" : "Service bays and resources"} description={salon ? "Manage stations, rooms, and equipment reserved for appointments." : "Manage the bays, stations, rooms, or equipment reserved for appointments."} action={salon&&canManage?<Button asChild><Link id="salon-resource-create-button" href="/dashboard/settings/resources?create=1">Add resource</Link></Button>:undefined}/>
    <FormMessage {...params}/>
    {canManage&&!salon&&<Card className="mt-6 p-5"><h2 className="font-semibold">Add service bay or resource</h2>{form}</Card>}
    {salon?<SalonResourceViews resources={resources} canManage={canManage}/>:<div id="scheduling-resources-list" className="mt-6 grid gap-3">{resources.map(resource=><ResourceCard key={resource.id} resource={resource} canManage={canManage}/>)}</div>}
    {!resources.length&&<Card id={`${prefix}s-empty-state`} className="mt-6 p-8 text-center text-zinc-600">{salon?"No stations, rooms, or equipment yet.":"No service bays or scheduling resources yet."}</Card>}
    {salon&&canManage&&params.create?<FormDialog id="salon-resource-create-dialog" title="Add station or resource" closeHref="/dashboard/settings/resources">{form}</FormDialog>:null}
  </main>;
}

function ResourceForm({branches,prefix,salon}:{branches:Branch[];prefix:string;salon:boolean}) { return <form id={`${prefix}-form`} action={saveSchedulingResource} className="mt-4 grid gap-4 sm:grid-cols-2"><input name="id" type="hidden" value=""/><label className="text-sm font-semibold">Name<Input id={`${prefix}-name-input`} required name="name" maxLength={120} className="mt-2"/></label><label className="text-sm font-semibold">Branch<select id={`${prefix}-branch-select`} required name="branchId" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3">{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-sm font-semibold">Type<select id={`${prefix}-type-select`} name="resourceType" defaultValue={salon?"station":"bay"} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3">{!salon&&<option value="bay">Bay</option>}<option value="station">Station</option><option value="room">Room</option><option value="equipment">Equipment</option><option value="other">Other</option></select></label><label className="text-sm font-semibold">Capacity<Input id={`${prefix}-capacity-input`} required name="capacity" type="number" min={1} max={100} defaultValue={1} className="mt-2"/></label><SubmitButton id={`${prefix}-save-button`} pendingText="Saving…">Save resource</SubmitButton></form>; }

function SalonResourceViews({resources,canManage}:{resources:ResourceRow[];canManage:boolean}) { return <><div id="salon-resources-table-container" className="mt-6 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block"><table id="salon-resources-table" className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th>{canManage&&<th className="px-4 py-3 text-right">Actions</th>}</tr></thead><tbody className="divide-y divide-zinc-100">{resources.map(resource=><tr id={`salon-resource-row-${resource.id}`} key={resource.id}><td className="px-4 py-3 font-bold">{resource.name}</td><td className="px-4 py-3">{branchName(resource)}</td><td className="px-4 py-3 capitalize">{resource.resource_type}</td><td className="px-4 py-3">{resource.capacity}</td><td className="px-4 py-3">{resource.is_active?"Active":"Inactive"}</td>{canManage&&<td className="px-4 py-3"><ResourceActions resource={resource} context="desktop" prefix="salon-resource"/></td>}</tr>)}</tbody></table></div><div id="salon-resources-mobile-list" className="mt-6 grid gap-3 md:hidden">{resources.map(resource=><ResourceCard key={resource.id} resource={resource} canManage={canManage} salon/>)}</div></>; }

function ResourceCard({resource,canManage,salon=false}:{resource:ResourceRow;canManage:boolean;salon?:boolean}) { const prefix=salon?"salon-resource":"scheduling-resource"; return <Card id={`${prefix}-card-${resource.id}`} elevation="none" className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">{resource.name}</h2><p className="text-sm text-zinc-500">{branchName(resource)} · {resource.resource_type} · capacity {resource.capacity}{resource.is_active?"":" · inactive"}</p></div>{canManage&&<ResourceActions resource={resource} context={salon?"mobile":"card"} prefix={prefix}/>}</Card>; }

function ResourceActions({resource,context,prefix}:{resource:ResourceRow;context:string;prefix:"salon-resource"|"scheduling-resource"}) { return <div className="ml-auto flex justify-end gap-2"><Button asChild variant="secondary" size="sm"><Link id={`${prefix}-${resource.id}-edit-${context}`} href={`/dashboard/settings/resources/${resource.id}/edit`}>Edit</Link></Button><form id={`${prefix}-${resource.id}-toggle-form-${context}`} action={toggleSchedulingResource}><input type="hidden" name="id" value={resource.id}/><input type="hidden" name="active" value={String(!resource.is_active)}/><SubmitButton id={`${prefix}-${resource.id}-toggle-${context}`} variant={resource.is_active?"destructive":"secondary"} pendingText="Updating…">{resource.is_active?"Deactivate":"Activate"}</SubmitButton></form></div>; }
