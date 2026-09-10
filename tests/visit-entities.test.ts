import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createVisitCustomer, createVisitVehicle } from "../lib/visit-entities";

const organizationId = "13000000-0000-4000-8000-000000000001";
const customerId = "53000000-0000-4000-8000-000000000001";
const requestId = "63000000-0000-4000-8000-000000000001";
const actor = { organizationId, role: "advisor", industry: "automotive" };
const customerInput = { requestId: customerId, fullName: "New Customer", phone: "", email: "" };
const vehicleInput = { requestId, customerId, make: "Toyota", model: "Vios", plateNumber: "abc 123", vehicleType: "Sedan" };

function database(responses: Array<{ data: unknown; error: { code: string } | null }>) {
  const calls: Array<{ table: string; operation: string; value: unknown }> = [];
  const db = { from(table: string) {
    const query = {
      insert(value: unknown) { calls.push({ table, operation: "insert", value }); return query; },
      select() { return query; },
      eq(key: string, value: unknown) { calls.push({ table, operation: key, value }); return query; },
      async single() { return responses.shift() ?? { data: null, error: null }; },
      async maybeSingle() { return responses.shift() ?? { data: null, error: null }; },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { db, calls };
}

test("quick customer creation validates and uses the authenticated organization", async () => {
  const { db, calls } = database([{ data: { id: customerId, full_name: "New Customer" }, error: null }]);
  const result = await createVisitCustomer({ ...customerInput, organizationId: "forged" }, actor, db);
  assert.deepEqual(result, { data: { id: customerId, name: "New Customer" } });
  assert.deepEqual(calls[0]?.value, { id: customerId, organization_id: organizationId, full_name: "New Customer", phone: null, email: null });
  const bad = database([]);
  assert.ok((await createVisitCustomer({ ...customerInput, fullName: "" }, actor, bad.db)).error);
  assert.ok((await createVisitCustomer({ ...customerInput, email: "invalid" }, actor, bad.db)).error);
  assert.equal(bad.calls.length, 0);
});

test("read-only roles and Salon vehicle creation are denied before database access", async () => {
  const { db, calls } = database([]);
  for (const role of ["viewer", "technician", "cashier"]) {
    assert.ok((await createVisitCustomer(customerInput, { ...actor, role }, db)).error);
    assert.ok((await createVisitVehicle(vehicleInput, { ...actor, role }, db)).error);
  }
  assert.ok((await createVisitVehicle(vehicleInput, { ...actor, industry: "salon" }, db)).error);
  assert.equal(calls.length, 0);
});

test("vehicle creation rejects another tenant's or archived customer", async () => {
  const { db, calls } = database([{ data: null, error: null }]);
  assert.ok((await createVisitVehicle(vehicleInput, actor, db)).error);
  assert.ok(calls.some(call => call.operation === "organization_id" && call.value === organizationId));
  assert.ok(calls.some(call => call.operation === "is_archived" && call.value === false));
  assert.equal(calls.filter(call => call.operation === "insert").length, 0);
});

test("vehicle creation returns a selectable record and normalizes its plate", async () => {
  const { db, calls } = database([
    { data: { id: customerId }, error: null },
    { data: { id: requestId, customer_id: customerId, make: "Toyota", model: "Vios", plate_number: "abc 123" }, error: null },
  ]);
  const result = await createVisitVehicle(vehicleInput, actor, db);
  assert.equal(result.data?.customer_id, customerId);
  assert.equal(result.data?.id, requestId);
  assert.match(result.data?.label ?? "", /Toyota Vios/);
  assert.equal((calls.find(call => call.operation === "insert")?.value as { plate_normalized: string }).plate_normalized, "ABC123");
});

test("customer retries reuse only the same scoped completed insert", async () => {
  const row = { id: customerId, full_name: "New Customer", phone: null, email: null };
  const { db, calls } = database([{ data: null, error: { code: "23505" } }, { data: row, error: null }]);
  assert.equal((await createVisitCustomer(customerInput, actor, db)).data?.id, customerId);
  assert.ok(calls.some(call => call.operation === "organization_id" && call.value === organizationId));
  const mismatch = database([{ data: null, error: { code: "23505" } }, { data: { ...row, full_name: "Someone else" }, error: null }]);
  assert.ok((await createVisitCustomer(customerInput, actor, mismatch.db)).error);
  const normalized = database([{ data: null, error: { code: "23505" } }, { data: { ...row, email: "customer@example.test" }, error: null }]);
  assert.equal((await createVisitCustomer({ ...customerInput, email: "CUSTOMER@example.test" }, actor, normalized.db)).data?.id, customerId);
});

test("vehicle retries reuse their matching record without overwriting another vehicle", async () => {
  const row = { id: requestId, customer_id: customerId, make: "Toyota", model: "Vios", plate_number: "abc 123", vehicle_type: "Sedan" };
  const { db } = database([{ data: { id: customerId }, error: null }, { data: null, error: { code: "23505" } }, { data: row, error: null }]);
  assert.equal((await createVisitVehicle(vehicleInput, actor, db)).data?.id, requestId);
  const missing = database([{ data: { id: customerId }, error: null }, { data: null, error: { code: "23505" } }, { data: null, error: null }]);
  assert.ok((await createVisitVehicle(vehicleInput, actor, missing.db)).error);
});
