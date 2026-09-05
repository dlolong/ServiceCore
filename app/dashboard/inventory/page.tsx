import { createInventoryItem, recordMovement, saveRecipe, transferStock } from "@/app/dashboard/inventory/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { quantityLabel } from "@/lib/inventory";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

const select="min-h-11 w-full rounded-xl border bg-white px-3";

export default async function Page({searchParams}:{searchParams:Promise<{message?:string;error?:string}>}){
  const[p,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const salon=activeMembership.industry==="salon",canManage=["owner","manager"].includes(activeMembership.role);
  const[{data:stock},{data:movements},{data:branches},{data:services}]=await Promise.all([
    supabase.from("inventory_stock").select("*").eq("organization_id",activeMembership.organizationId).order("low_stock",{ascending:false}).order("name"),
    supabase.from("inventory_movements").select("id,movement_type,quantity_delta,note,created_at,inventory_items(name,unit),branches(name)").eq("organization_id",activeMembership.organizationId).order("created_at",{ascending:false}).limit(30),
    supabase.from("branches").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true),
    salon?Promise.resolve({data:[]}):supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
  ]);
  const branchStock=stock?.filter(item=>item.branch_id===activeMembership.branchId)??[],otherStock=stock?.filter(item=>item.branch_id!==activeMembership.branchId)??[],value=branchStock.reduce((sum,item)=>sum+Number(item.valuation_centavos),0);
  return <main id={salon?"salon-inventory-page":"inventory-page"} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={salon?"salon-inventory-page-header":"inventory-page-header"} eyebrow={activeMembership.branchName} title="Inventory" description="Product stock, append-only movements, transfers, and low-stock control."/><FormMessage {...p}/>
    <section id={salon?"salon-inventory-metrics":"inventory-metrics"} aria-label="Inventory summary" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Card id={salon?"salon-inventory-products":"inventory-products"} elevation="none" className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Products</p><strong className="mt-1 block text-2xl">{branchStock.length}</strong></Card><Card id={salon?"salon-inventory-low-stock":"inventory-low-stock"} elevation="none" className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Low / out of stock</p><strong className="mt-1 block text-2xl text-status-danger">{branchStock.filter(item=>item.low_stock).length}</strong></Card><Card id={salon?"salon-inventory-valuation":"inventory-valuation"} elevation="none" className="col-span-2 p-4 sm:col-span-1"><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Cost valuation</p><strong className="mt-1 block text-2xl">{formatMoney(value)}</strong></Card></section>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Card className="p-5"><h2 className="font-black">Branch stock</h2><div className="mt-3 hidden md:block"><table id={salon?"salon-inventory-table":"inventory-table"} className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-zinc-500"><th className="py-2">Product</th><th>On hand</th><th>Status</th>{canManage?<th className="text-right">Actions</th>:null}</tr></thead><tbody>{branchStock.map(item=><tr id={`${salon?"salon-product":"inventory-item"}-row-${item.id}`} key={item.id} className="border-b align-top"><td className="py-3"><strong>{item.name}</strong><small className="block text-zinc-500">{item.sku||"No SKU"} · {item.category||"Uncategorized"}</small></td><td className="py-3">{quantityLabel(item.quantity_on_hand,item.unit)}</td><td className="py-3">{item.low_stock?"Low stock":"Available"}</td>{canManage?<td className="py-3 text-right"><details id={`${salon?"salon-product":"inventory-item"}-movement-${item.id}`} className="inline-block w-56 text-left"><summary className="cursor-pointer font-bold text-brand-primary-strong">Record movement</summary><MovementForm itemId={item.id} idPrefix={`${salon?"salon-product":"inventory-item"}-${item.id}-desktop`}/></details></td>:null}</tr>)}</tbody></table></div><div className="mt-3 grid gap-2 md:hidden">{branchStock.map(item=><article id={`${salon?"salon-product":"inventory-item"}-card-${item.id}`} key={item.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><span><strong>{item.name}</strong><small className="block text-zinc-500">{item.sku||"No SKU"}</small></span><span className="text-right"><strong>{quantityLabel(item.quantity_on_hand,item.unit)}</strong><small className="block text-zinc-500">{item.low_stock?"Low stock":"Available"}</small></span></div>{canManage?<MovementForm itemId={item.id} idPrefix={`${salon?"salon-product":"inventory-item"}-${item.id}-mobile`}/>:null}</article>)}</div>{!branchStock.length?<p className="py-8 text-center text-sm text-zinc-500">No stock items yet.</p>:null}</Card>
      {canManage?<InventoryManagement salon={salon} stock={stock ?? []} otherStock={otherStock} branchStock={branchStock} branches={branches ?? []} services={services ?? []}/>:null}
    </div>
    <Card className="mt-5 p-5"><h2 className="font-black">Recent movement ledger</h2><div className="mt-3 divide-y">{movements?.map(movement=>{const item=Array.isArray(movement.inventory_items)?movement.inventory_items[0]:movement.inventory_items,branch=Array.isArray(movement.branches)?movement.branches[0]:movement.branches;return <div className="flex justify-between gap-4 py-3 text-sm" key={movement.id}><span><strong>{item?.name}</strong><small className="block text-zinc-500">{branch?.name} · {movement.movement_type.replaceAll("_"," ")} · {movement.note||"No note"}</small></span><strong className={Number(movement.quantity_delta)<0?"text-red-700":"text-green-700"}>{Number(movement.quantity_delta)>0?"+":""}{quantityLabel(movement.quantity_delta,item?.unit??"")}</strong></div>})}</div></Card>
  </main>;
}

type InventoryOption={id:string;name:string;branch_id?:string};
type BranchOption={id:string;name:string};

function InventoryManagement({salon,stock,otherStock,branchStock,branches,services}:{salon:boolean;stock:InventoryOption[];otherStock:InventoryOption[];branchStock:InventoryOption[];branches:BranchOption[];services:Array<{id:string;name:string}>}) {
  const productPrefix=salon?"salon-product":"inventory-item",inventoryPrefix=salon?"salon-inventory":"inventory";
  return <div id={`${inventoryPrefix}-management`} className="space-y-4">
    <Card id={`${productPrefix}-create-section`} elevation="none" className="p-5"><h2 className="font-black">New product</h2><form id={`${productPrefix}-create-form`} action={createInventoryItem} className="mt-4 grid gap-3 sm:grid-cols-2">
      <InventoryField label="Product name"><Input id={`${productPrefix}-name-input`} required name="name"/></InventoryField>
      <InventoryField label="SKU" optional><Input id={`${productPrefix}-sku-input`} name="sku"/></InventoryField>
      <InventoryField label="Category" optional><Input id={`${productPrefix}-category-input`} name="category"/></InventoryField>
      <InventoryField label="Unit"><Input id={`${productPrefix}-unit-input`} required name="unit" defaultValue="unit"/></InventoryField>
      <InventoryField label="Cost (PHP)"><Input id={`${productPrefix}-cost-input`} required name="cost" defaultValue="0" inputMode="decimal"/></InventoryField>
      <InventoryField label="Sell price (PHP)"><Input id={`${productPrefix}-price-input`} required name="sellPrice" defaultValue="0" inputMode="decimal"/></InventoryField>
      <InventoryField label="Reorder level"><Input id={`${productPrefix}-reorder-input`} required name="reorderLevel" type="number" step="0.001" min="0" defaultValue="0"/></InventoryField>
      <InventoryField label="Lot / batch" optional><Input id={`${productPrefix}-lot-input`} name="lotNumber"/></InventoryField>
      <InventoryField label="Expiry date" optional><Input id={`${productPrefix}-expiry-input`} name="expiresOn" type="date"/></InventoryField>
      <InventoryField label="Description" optional><Input id={`${productPrefix}-description-input`} name="description"/></InventoryField>
      <SubmitButton id={`${productPrefix}-save-button`} className="sm:col-span-2 sm:justify-self-start" pendingText="Creating product…">Create product</SubmitButton>
    </form></Card>
    <Card id={`${inventoryPrefix}-transfer-section`} elevation="none" className="p-5"><h2 className="font-black">Branch transfer</h2><form id={`${inventoryPrefix}-transfer-form`} action={transferStock} className="mt-4 grid gap-3"><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/>
      <InventoryField label="Source stock"><select id={`${inventoryPrefix}-transfer-source`} required className={select} name="sourceItemId"><option value="">Select source stock</option>{stock.map(item=><option key={item.id} value={item.id}>{item.name} · {branches.find(branch=>branch.id===item.branch_id)?.name}</option>)}</select></InventoryField>
      <InventoryField label="Destination stock"><select id={`${inventoryPrefix}-transfer-target`} required className={select} name="targetItemId"><option value="">Select matching destination stock</option>{otherStock.map(item=><option key={item.id} value={item.id}>{item.name} · {branches.find(branch=>branch.id===item.branch_id)?.name}</option>)}</select></InventoryField>
      <InventoryField label="Quantity"><Input id={`${inventoryPrefix}-transfer-quantity`} required name="quantity" type="number" min="0.001" step="0.001"/></InventoryField>
      <InventoryField label="Transfer note" optional><Input id={`${inventoryPrefix}-transfer-note`} name="note"/></InventoryField>
      <SubmitButton id={`${inventoryPrefix}-transfer-button`} pendingText="Transferring stock…">Transfer</SubmitButton>
    </form></Card>
    {!salon?<Card id="inventory-recipe-section" elevation="none" className="p-5"><h2 className="font-black">Service consumable recipe</h2><form id="inventory-recipe-form" action={saveRecipe} className="mt-4 grid gap-3">
      <InventoryField label="Service"><select id="inventory-recipe-service-select" required className={select} name="serviceId"><option value="">Select service</option>{services.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></InventoryField>
      <InventoryField label="Inventory item"><select id="inventory-recipe-item-select" required className={select} name="inventoryItemId"><option value="">Select inventory item</option>{branchStock.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></InventoryField>
      <InventoryField label="Quantity used"><Input id="inventory-recipe-quantity-input" required name="quantity" type="number" min="0.001" step="0.001"/></InventoryField>
      <SubmitButton id="inventory-recipe-save-button" pendingText="Saving recipe…">Save recipe</SubmitButton>
    </form></Card>:null}
  </div>;
}

function InventoryField({label,optional=false,children}:{label:string;optional?:boolean;children:React.ReactNode}) { return <label className="block text-sm font-semibold text-slate-700">{label}{optional?<span className="font-normal text-slate-500"> (optional)</span>:null}{children}</label>; }

function MovementForm({itemId,idPrefix}:{itemId:string;idPrefix:string}){return <form id={`${idPrefix}-movement-form`} action={recordMovement} className="mt-3 grid gap-2"><input type="hidden" name="itemId" value={itemId}/><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><InventoryField label="Movement type"><select id={`${idPrefix}-movement-type`} className={select} name="type"><option value="purchase">Purchase</option><option value="opening">Opening</option><option value="return">Return</option><option value="usage">Usage</option><option value="waste">Waste</option><option value="adjustment">Positive adjustment</option></select></InventoryField><InventoryField label="Quantity"><Input id={`${idPrefix}-movement-quantity`} required name="quantity" type="number" min="0.001" step="0.001"/></InventoryField><InventoryField label="Reference / note" optional><Input id={`${idPrefix}-movement-note`} name="note"/></InventoryField><SubmitButton id={`${idPrefix}-movement-save`} pendingText="Recording movement…" variant="secondary">Record</SubmitButton></form>}
