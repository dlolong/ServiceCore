import assert from"node:assert/strict";import test from"node:test";import{branchPublicSchema,publicBookingSchema,publicPageSchema,publicBookingSchemaForIndustry,publicBookingDate,publicServiceSchema,publicGallerySchema,publicOpeningHoursFromFormData}from"../lib/public-booking";
const base={slug:"prime-auto",branchId:"4a000000-0000-4000-8000-000000000001",serviceIds:["8a000000-0000-4000-8000-000000000001"],preferredAt:"2026-09-01T08:00:00+08:00",customerName:"Juan Dela Cruz",phone:"09171234567",email:"juan@example.com",vehicleMake:"Toyota",vehicleModel:"Vios",vehicleYear:"2024",vehicleType:"Sedan",plateNumber:"ABC123",customerNote:"",website:""};
test("public booking validates the complete visitor boundary",()=>{assert.equal(publicBookingSchema.safeParse(base).success,true);assert.equal(publicBookingSchema.safeParse({...base,serviceIds:[],phone:"1"}).success,false)});
test("public booking accepts multiple unique services with a ten-service limit",()=>{
 const ids=Array.from({length:10},(_,index)=>`8a000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`);
 assert.equal(publicBookingSchema.safeParse({...base,serviceIds:ids}).success,true);
 assert.equal(publicBookingSchema.safeParse({...base,serviceIds:[base.serviceIds[0],base.serviceIds[0]]}).success,false);
 assert.equal(publicBookingSchema.safeParse({...base,serviceIds:[...ids,"8a000000-0000-4000-8000-000000000011"]}).success,false);
});
test("honeypot must remain empty",()=>assert.equal(publicBookingSchema.safeParse({...base,website:"bot-value"}).success,false));
test("public page accepts only valid public URLs",()=>{assert.equal(publicPageSchema.safeParse({description:"Shop",logoUrl:"https://example.com/logo.png",coverUrl:"",instagramUrl:"",facebookPage:"",website:"",enabled:true}).success,true);assert.equal(publicPageSchema.safeParse({description:"",logoUrl:"javascript:alert(1)",coverUrl:"",instagramUrl:"",facebookPage:"",website:"",enabled:true}).success,false)});
test("branch hours JSON is parsed at the server boundary",()=>{const parsed=branchPublicSchema.safeParse({branchId:base.branchId,description:"",mapUrl:"",acceptsBookings:true,openingHours:'{"monday":{"open":"08:00","close":"17:00"}}'});assert.equal(parsed.success,true);assert.equal(branchPublicSchema.safeParse({branchId:base.branchId,description:"",mapUrl:"",acceptsBookings:true,openingHours:"not-json"}).success,false)});
test("friendly branch-hour fields produce the validated weekly schedule",()=>{const form=new FormData();form.set("hours-monday-enabled","on");form.set("hours-monday-open","08:30");form.set("hours-monday-close","18:00");form.set("hours-sunday-open","09:00");form.set("hours-sunday-close","17:00");const hours=publicOpeningHoursFromFormData(form);assert.deepEqual(hours.monday,{open:"08:30",close:"18:00"});assert.deepEqual(hours.sunday,{closed:true});assert.equal(branchPublicSchema.safeParse({...base,description:"",mapUrl:"",acceptsBookings:true,openingHours:JSON.stringify(hours)}).success,true)});

test("Salon booking ignores vehicle input while Automotive requires make and model", () => {
 const visitor = { ...base, vehicleMake: "", vehicleModel: "", vehicleYear: "" };
 assert.equal(publicBookingSchemaForIndustry("automotive").safeParse(visitor).success, false);
 const salon = publicBookingSchemaForIndustry("salon").parse({ ...visitor, vehicleMake: "Injected car", vehicleModel: "Ignored" });
 assert.equal(salon.vehicleMake, ""); assert.equal(salon.vehicleModel, ""); assert.equal(salon.vehicleYear, "");
 assert.equal(publicBookingSchemaForIndustry("salon").safeParse({ ...visitor, customerName: "A", serviceIds: [] }).success, false);
});
test("booking dates reject impossible dates and stay inside branch-local booking window", () => {
 const now = new Date("2026-09-09T20:00:00Z");
 assert.equal(publicBookingDate(undefined, "Asia/Manila", now).date, "2026-09-10");
 assert.equal(publicBookingDate(undefined, "America/Los_Angeles", now).date, "2026-09-09");
 for (const invalid of ["2026-09-31", "2026-09-01", "2027-01-01", "2026-11-10", ["2026-09-11"]]) assert.equal(publicBookingDate(invalid, "Asia/Manila", now).date, "2026-09-10");
 assert.equal(publicBookingDate(undefined, "Asia/Manila", now).maxDate, "2026-11-09");
 assert.equal(publicBookingDate("2026-09-12", "Asia/Manila", now).date, "2026-09-12");
});
test("opening hours validate shape, weekdays and usable time ranges", () => {
 for (const hours of [[], null, { monday: { open: "99:00", close: "17:00" } }, { monday: { open: "17:00", close: "08:00" } }, { nonsense: { closed: true } }, { monday: { open: "09:00" } }]) {
  assert.equal(branchPublicSchema.safeParse({ branchId: base.branchId, description: "", mapUrl: "", acceptsBookings: true, openingHours: JSON.stringify(hours) }).success, false);
 }
});
test("settings reject unsafe service identifiers, visibility values and image URLs", () => {
 assert.equal(publicServiceSchema.safeParse({ serviceId: "not-an-id", isPublic: "true" }).success, false);
 assert.equal(publicServiceSchema.safeParse({ serviceId: base.serviceIds[0], isPublic: "anything" }).success, false);
 assert.equal(publicServiceSchema.parse({ serviceId: base.serviceIds[0], isPublic: "false" }).isPublic, false);
 assert.equal(publicGallerySchema.safeParse({ url: "javascript:alert(1)", alt: "Image" }).success, false);
});
