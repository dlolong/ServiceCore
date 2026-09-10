import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const salonConsumerFiles=[
  "app/dashboard/page.tsx",
  "app/dashboard/appointments/page.tsx",
  "app/dashboard/appointments/[appointmentId]/page.tsx",
  "modules/platform/industry.ts",
];

test("Salon-facing shared consumers do not statically import Automotive runtime modules",()=>{
  for(const file of salonConsumerFiles){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
    assert.doesNotMatch(source,/^import\s.+["']@\/modules\/automotive\//m,`${file} imports Automotive runtime`);
  }
});

test("Core does not import the Salon vertical",()=>{
  for(const file of ["modules/core/scheduling/scheduling.service.ts","modules/core/scheduling/scheduling.runtime.ts","modules/core/availability/availability.service.ts"]){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
    assert.doesNotMatch(source,/salon/i,`${file} knows about Salon`);
  }
});

test("Shared public-page actions enforce supported industry features at the action boundary",()=>{
  const source=readFileSync(new URL("../app/dashboard/settings/public-page/actions.ts",import.meta.url),"utf8");
  assert.match(source,/requireIndustryFeature\("booking_requests"\)/);
  assert.doesNotMatch(source,/from["']@\/lib\/auth\/context["']/);
});

test("Salon operational routes expose dialogs and responsive list contracts",()=>{
  const expectations:Record<string,string[]>={
    "app/dashboard/appointments/page.tsx":["salon-appointments-table","salon-appointments-mobile-list","salon-appointment-view-"],
    "app/dashboard/services/page.tsx":["salon-treatments-table","salon-treatments-mobile-list","salon-treatment-view-"],
    "app/dashboard/settings/resources/page.tsx":["salon-resources-table","salon-resources-mobile-list","salon-resource-create-dialog"],
    "app/dashboard/settings/staff/page.tsx":["salon-staff-page","loadStaffManagementDirectory","listOperationalStaffDirectory"],
    "components/staff-management.tsx":["salon-staff-table","salon-staff-mobile-list"],
    "app/dashboard/appointments/new/page.tsx":["salon-appointment-create-dialog"],
    "app/dashboard/services/new/page.tsx":["salon-treatment-create-dialog"],
  };
  for(const [file,ids] of Object.entries(expectations)){
    const source=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
    for(const id of ids) assert.match(source,new RegExp(id),`${file} misses ${id}`);
  }
});

test("Salon Client visit context is loaded in batches",()=>{
  const source=readFileSync(new URL("../app/dashboard/customers/page.tsx",import.meta.url),"utf8");
  assert.match(source,/\.in\("customer_id",customerIds\)/);
  assert.match(source,/Upcoming/);
  assert.match(source,/Last visit/);
});
