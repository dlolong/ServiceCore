import Link from "next/link";

import { saveBranch, saveCustomer, saveVehicle } from "@/app/dashboard/crm-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const textarea = "mt-2 min-h-24 w-full rounded-ui-md border border-slate-300 bg-white px-3 py-2 text-admin-text placeholder:text-zinc-400 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20";
const select = "mt-2 min-h-11 w-full rounded-ui-md border border-slate-300 bg-white px-3 text-admin-text focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-semibold text-slate-800">{label}{children}</label>;

export type BranchRecord = { id: string; name: string; address_line: string | null; barangay: string | null; city: string | null; province: string | null; postal_code: string | null; country: string; phone: string | null; email: string | null; opening_notes: string | null };
export function BranchForm({ branch, error }: { branch?: BranchRecord; error?: string }) {
  return <Card className="p-5 sm:p-7"><FormMessage error={error}/><form id={branch?"branch-edit-form":"branch-create-form"} action={saveBranch} className="mt-5 grid gap-5 sm:grid-cols-2">
    {branch?<input type="hidden" name="id" value={branch.id}/>:null}
    <Field label="Branch name *"><Input id="branch-name-input" name="name" required maxLength={120} defaultValue={branch?.name}/></Field>
    <Field label="Country *"><Input id="branch-country-input" name="country" required defaultValue={branch?.country??"Philippines"}/></Field>
    <div className="sm:col-span-2"><Field label="Address line *"><Input id="branch-address-input" name="addressLine" required maxLength={200} defaultValue={branch?.address_line??""}/></Field></div>
    <Field label="Barangay"><Input id="branch-barangay-input" name="barangay" maxLength={120} defaultValue={branch?.barangay??""}/></Field>
    <Field label="City / municipality *"><Input id="branch-city-input" name="city" required maxLength={120} defaultValue={branch?.city??""}/></Field>
    <Field label="Province *"><Input id="branch-province-input" name="province" required maxLength={120} defaultValue={branch?.province??""}/></Field>
    <Field label="Postal code"><Input id="branch-postal-input" name="postalCode" maxLength={20} defaultValue={branch?.postal_code??""}/></Field>
    <Field label="Phone"><Input id="branch-phone-input" name="phone" autoComplete="tel" maxLength={40} defaultValue={branch?.phone??""}/></Field>
    <Field label="Email"><Input id="branch-email-input" name="email" type="email" autoComplete="email" defaultValue={branch?.email??""}/></Field>
    <div className="sm:col-span-2"><Field label="Opening hours notes"><textarea id="branch-opening-notes-input" className={textarea} name="openingNotes" maxLength={500} defaultValue={branch?.opening_notes??""}/></Field></div>
    <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end"><Link id="branch-cancel-button" href="/dashboard/settings/branches" className="inline-flex min-h-11 items-center justify-center rounded-ui-md border border-admin-border-strong bg-white px-4 text-sm font-bold text-admin-text hover:bg-slate-50">Cancel</Link><SubmitButton id="branch-save-button" pendingText="Saving branch…">Save branch</SubmitButton></div>
  </form></Card>;
}

export type CustomerRecord = { id: string; full_name: string; phone: string | null; email: string | null; address_line: string | null; city: string | null; province: string | null; notes: string | null };
export function CustomerForm({ customer, error, warning, duplicateId, embedded = false, returnTo }: { customer?: CustomerRecord; error?: string; warning?: string; duplicateId?: string; embedded?: boolean; returnTo?: string }) {
  const content=<><FormMessage error={error}/>{warning?<div id="customer-duplicate-warning" role="alert" className="mt-4 rounded-xl border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning"><p className="font-bold">{warning}</p>{duplicateId?<Link id="customer-duplicate-link" className="mt-2 inline-block underline" href={`/dashboard/customers/${duplicateId}`}>View existing customer</Link>:null}<label className="mt-3 flex min-h-11 items-center gap-2"><input id="customer-accept-duplicate-checkbox" type="checkbox" name="acceptDuplicate" form="customer-form"/> Save anyway</label></div>:null}<form id="customer-form" action={saveCustomer} className="grid gap-4 sm:grid-cols-2">
    {customer?<input type="hidden" name="id" value={customer.id}/>:null}{returnTo?<input type="hidden" name="returnTo" value={returnTo}/>:null}
    <div className="sm:col-span-2"><Field label="Full name *"><Input id="customer-full-name-input" name="fullName" required autoFocus autoComplete="name" maxLength={160} defaultValue={customer?.full_name}/></Field></div>
    <Field label="Mobile number"><Input id="customer-phone-input" name="phone" autoComplete="tel" maxLength={40} placeholder="0917 123 4567" defaultValue={customer?.phone??""}/></Field>
    <Field label="Email"><Input id="customer-email-input" name="email" type="email" autoComplete="email" defaultValue={customer?.email??""}/></Field>
    <div className="sm:col-span-2"><Field label="Address"><Input id="customer-address-input" name="addressLine" autoComplete="street-address" maxLength={200} defaultValue={customer?.address_line??""}/></Field></div>
    <Field label="City / municipality"><Input id="customer-city-input" name="city" maxLength={120} defaultValue={customer?.city??""}/></Field>
    <Field label="Province"><Input id="customer-province-input" name="province" maxLength={120} defaultValue={customer?.province??""}/></Field>
    <div className="sm:col-span-2"><Field label="Notes"><textarea id="customer-notes-input" className={textarea} name="notes" maxLength={2000} defaultValue={customer?.notes??""}/></Field></div>
    <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-1 pt-4 sm:col-span-2 sm:flex-row sm:justify-end"><Link id="customer-cancel-button" href={returnTo??(customer?`/dashboard/customers/${customer.id}`:"/dashboard/customers")} className="inline-flex min-h-11 items-center justify-center rounded-ui-md border border-admin-border-strong bg-white px-4 text-sm font-bold text-admin-text hover:bg-slate-50">Cancel</Link><SubmitButton id="customer-save-button" pendingText="Saving customer…">Save customer</SubmitButton></div>
  </form></>;
  return embedded?content:<Card className="p-5 sm:p-7">{content}</Card>;
}

export type VehicleRecord = { id: string; customer_id: string; make: string; model: string; plate_number: string | null; model_year: number | null; variant: string | null; color: string | null; vehicle_type: string | null; fuel_type: string | null; transmission: string | null; odometer_km: number | null; vin: string | null; engine_number: string | null; notes: string | null };
export function VehicleForm({ vehicle, customers, presetCustomerId, error, warning, duplicateId, embedded = false, returnTo }: { vehicle?: VehicleRecord; customers: {id:string;full_name:string}[]; presetCustomerId?: string; error?: string; warning?: string; duplicateId?: string; embedded?: boolean; returnTo?: string }) {
  const content=<><FormMessage error={error}/>{warning?<div id="vehicle-duplicate-warning" role="alert" className="mb-4 rounded-xl border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning"><p className="font-bold">{warning}</p>{duplicateId?<Link id="vehicle-duplicate-link" className="mt-2 inline-block underline" href={`/dashboard/vehicles/${duplicateId}`}>View existing vehicle</Link>:null}<label className="mt-3 flex min-h-11 items-center gap-2"><input id="vehicle-accept-duplicate-checkbox" type="checkbox" name="acceptDuplicate" form="vehicle-form"/> Save anyway</label></div>:null}<form id="vehicle-form" action={saveVehicle} className="grid gap-4 sm:grid-cols-2">
    {vehicle?<input type="hidden" name="id" value={vehicle.id}/>:null}{returnTo?<input type="hidden" name="returnTo" value={returnTo}/>:null}
    <div className="sm:col-span-2"><Field label="Customer *"><select id="vehicle-customer-select" className={select} name="customerId" required autoFocus defaultValue={vehicle?.customer_id??presetCustomerId??""}><option value="" disabled>Select customer</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.full_name}</option>)}</select></Field></div>
    <Field label="Make *"><Input id="vehicle-make-input" name="make" required maxLength={80} placeholder="Toyota" defaultValue={vehicle?.make}/></Field>
    <Field label="Model *"><Input id="vehicle-model-input" name="model" required maxLength={80} placeholder="Fortuner" defaultValue={vehicle?.model}/></Field>
    <Field label="Year"><Input id="vehicle-year-input" name="modelYear" type="number" min={1900} max={new Date().getFullYear()+1} defaultValue={vehicle?.model_year??""}/></Field>
    <Field label="Variant"><Input id="vehicle-variant-input" name="variant" maxLength={80} defaultValue={vehicle?.variant??""}/></Field>
    <Field label="Plate number"><Input id="vehicle-plate-number-input" name="plateNumber" maxLength={30} placeholder="ABC 1234" defaultValue={vehicle?.plate_number??""}/></Field>
    <Field label="Vehicle type"><select id="vehicle-type-select" className={select} name="vehicleType" defaultValue={vehicle?.vehicle_type??""}><option value="">Not specified</option>{["Sedan","Hatchback","SUV","Crossover","Pickup","Van","MPV","Coupe","Sports Car","Motorcycle","Scooter","Truck","Other"].map(type=><option key={type}>{type}</option>)}</select></Field>
    <Field label="Color"><Input id="vehicle-color-input" name="color" maxLength={60} defaultValue={vehicle?.color??""}/></Field>
    <Field label="Odometer (km)"><Input id="vehicle-odometer-input" name="odometerKm" type="number" min={0} defaultValue={vehicle?.odometer_km??""}/></Field>
    <Field label="Fuel type"><Input id="vehicle-fuel-type-input" name="fuelType" maxLength={40} defaultValue={vehicle?.fuel_type??""}/></Field>
    <Field label="Transmission"><Input id="vehicle-transmission-input" name="transmission" maxLength={40} defaultValue={vehicle?.transmission??""}/></Field>
    <Field label="VIN / chassis number"><Input id="vehicle-vin-input" name="vin" maxLength={80} defaultValue={vehicle?.vin??""}/></Field>
    <Field label="Engine number"><Input id="vehicle-engine-number-input" name="engineNumber" maxLength={80} defaultValue={vehicle?.engine_number??""}/></Field>
    <div className="sm:col-span-2"><Field label="Notes"><textarea id="vehicle-notes-input" className={textarea} name="notes" maxLength={2000} defaultValue={vehicle?.notes??""}/></Field></div>
    <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white px-1 pt-4 sm:col-span-2 sm:flex-row sm:justify-end"><Link id="vehicle-cancel-button" href={returnTo??(vehicle?`/dashboard/vehicles/${vehicle.id}`:"/dashboard/vehicles")} className="inline-flex min-h-11 items-center justify-center rounded-ui-md border border-admin-border-strong bg-white px-4 text-sm font-bold text-admin-text hover:bg-slate-50">Cancel</Link><SubmitButton id="vehicle-save-button" pendingText="Saving vehicle…">Save vehicle</SubmitButton></div>
  </form></>;
  return embedded?content:<Card className="p-5 sm:p-7">{content}</Card>;
}
