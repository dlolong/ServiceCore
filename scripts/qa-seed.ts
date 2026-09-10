import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import {
  assertQaSeedSafety,
  formatQaSeedOperatorError,
  parseQaSeedMode,
  resolveQaMembershipStrategy,
} from "./qa-seed-safety";

const LOCAL_AUTOMOTIVE_EMAIL = "qa.automotive.owner@negosu.local.test";
const LOCAL_SALON_EMAIL = "qa.salon.owner@negosu.local.test";
const LOCAL_QA_PASSWORD = "NegOSu-Local-QA-2026!";

type QaPersona = {
  key: "automotive-owner" | "salon-owner";
  email: string;
  password: string;
  fullName: string;
  organizationId: string;
  membershipId: string;
  branchId: string;
};

type OrganizationFixture = { id: string; name: string; industry: string };

type QaVerticalFixture = {
  organization: OrganizationFixture & { slug: string; businessType: string };
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePriceCentavos: number;
  customerId: string;
  customerName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventorySku: string;
  vehicle?: { id: string; make: string; model: string; plateNumber: string };
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function qaCredentials(target: "local" | "remote-development") {
  if (target === "local") {
    return {
      automotiveEmail: process.env.QA_AUTOMOTIVE_OWNER_EMAIL?.trim() || LOCAL_AUTOMOTIVE_EMAIL,
      salonEmail: process.env.QA_SALON_OWNER_EMAIL?.trim() || LOCAL_SALON_EMAIL,
      password: process.env.QA_OWNER_PASSWORD || LOCAL_QA_PASSWORD,
    };
  }

  return {
    automotiveEmail: requiredEnvironmentValue("QA_AUTOMOTIVE_OWNER_EMAIL"),
    salonEmail: requiredEnvironmentValue("QA_SALON_OWNER_EMAIL"),
    password: requiredEnvironmentValue("QA_OWNER_PASSWORD"),
  };
}

async function findUserByEmail(client: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  throw new Error("QA user lookup exceeded the bounded 4,000-user search. Use a dedicated development project.");
}

async function ensureUser(client: SupabaseClient, persona: QaPersona): Promise<{ user: User; created: boolean }> {
  const existing = await findUserByEmail(client, persona.email);
  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      password: persona.password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, full_name: persona.fullName, qa_persona: persona.key },
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }

  const { data, error } = await client.auth.admin.createUser({
    email: persona.email,
    password: persona.password,
    email_confirm: true,
    user_metadata: { full_name: persona.fullName, qa_persona: persona.key },
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

async function loadOrganization(client: SupabaseClient, fixture: QaVerticalFixture): Promise<OrganizationFixture | null> {
  const { data, error } = await client
    .from("organizations")
    .select("id,name,industry")
    .eq("id", fixture.organization.id)
    .maybeSingle();
  if (error) throw error;
  if (data && data.industry !== fixture.organization.industry) {
    throw new Error(`QA fixture ${fixture.organization.id} has unexpected industry ${data.industry}.`);
  }
  return data as OrganizationFixture | null;
}

async function ensureVerticalFixture(client: SupabaseClient, fixture: QaVerticalFixture) {
  const existing = await loadOrganization(client, fixture);
  const { error: organizationError } = await client.from("organizations").upsert({
    id: fixture.organization.id,
    name: fixture.organization.name,
    slug: fixture.organization.slug,
    industry: fixture.organization.industry,
    business_type: fixture.organization.businessType,
    currency: "PHP",
    timezone: "Asia/Manila",
    status: "active",
  }, { onConflict: "id" });
  if (organizationError) throw organizationError;

  const { error: branchError } = await client.from("branches").upsert({
    id: fixture.branchId,
    organization_id: fixture.organization.id,
    name: fixture.branchName,
    code: "MAIN",
    address_line: "QA fixture address",
    city: "Makati",
    province: "Metro Manila",
    country: "Philippines",
    timezone: "Asia/Manila",
    is_primary: true,
    is_active: true,
  }, { onConflict: "id" });
  if (branchError) throw branchError;

  const { error: subscriptionError } = await client.from("organization_subscriptions").upsert({
    organization_id: fixture.organization.id,
    plan_id: "business",
    status: "active",
  }, { onConflict: "organization_id" });
  if (subscriptionError) throw subscriptionError;

  const { error: categoryError } = await client.from("service_categories").upsert({
    id: fixture.categoryId,
    organization_id: fixture.organization.id,
    name: fixture.categoryName,
    sort_order: 1,
    is_active: true,
  }, { onConflict: "id" });
  if (categoryError) throw categoryError;

  const { error: serviceError } = await client.from("services").upsert({
    id: fixture.serviceId,
    organization_id: fixture.organization.id,
    category_id: fixture.categoryId,
    name: fixture.serviceName,
    short_description: "Non-production QA fixture",
    duration_minutes: fixture.serviceDurationMinutes,
    base_price_centavos: fixture.servicePriceCentavos,
    currency: "PHP",
    is_active: true,
    is_public: false,
  }, { onConflict: "id" });
  if (serviceError) throw serviceError;

  const { error: availabilityError } = await client.from("service_branch_availability").upsert({
    organization_id: fixture.organization.id,
    service_id: fixture.serviceId,
    branch_id: fixture.branchId,
    is_available: true,
  }, { onConflict: "service_id,branch_id" });
  if (availabilityError) throw availabilityError;

  const { error: customerError } = await client.from("customers").upsert({
    id: fixture.customerId,
    organization_id: fixture.organization.id,
    full_name: fixture.customerName,
    notes: "Non-production QA fixture",
    is_archived: false,
  }, { onConflict: "id" });
  if (customerError) throw customerError;

  if (fixture.vehicle) {
    const { error: vehicleError } = await client.from("vehicles").upsert({
      id: fixture.vehicle.id,
      organization_id: fixture.organization.id,
      customer_id: fixture.customerId,
      make: fixture.vehicle.make,
      model: fixture.vehicle.model,
      plate_number: fixture.vehicle.plateNumber,
      is_archived: false,
    }, { onConflict: "id" });
    if (vehicleError) throw vehicleError;
  }

  const { error: inventoryError } = await client.from("inventory_items").upsert({
    id: fixture.inventoryItemId,
    organization_id: fixture.organization.id,
    branch_id: fixture.branchId,
    sku: fixture.inventorySku,
    name: fixture.inventoryItemName,
    unit: "unit",
    cost_centavos: 10000,
    sell_price_centavos: 18000,
    reorder_level: 2,
    category: fixture.categoryName,
    is_active: true,
  }, { onConflict: "id" });
  if (inventoryError) throw inventoryError;

  const movementKey = `qa-persona-seed-${fixture.inventoryItemId}`;
  const { data: movement, error: movementReadError } = await client
    .from("inventory_movements")
    .select("id")
    .eq("organization_id", fixture.organization.id)
    .eq("idempotency_key", movementKey)
    .maybeSingle();
  if (movementReadError) throw movementReadError;
  if (!movement) {
    const { error: movementError } = await client.from("inventory_movements").insert({
      organization_id: fixture.organization.id,
      branch_id: fixture.branchId,
      inventory_item_id: fixture.inventoryItemId,
      movement_type: "opening",
      quantity_delta: 10,
      idempotency_key: movementKey,
      note: "Non-production QA opening stock",
    });
    if (movementError) throw movementError;
  }

  console.log(`[qa-seed] FIXTURE ${existing ? "UPDATED" : "CREATED"} ${fixture.organization.industry} organization=${fixture.organization.id}`);
  return fixture.organization;
}

async function ensureMembership(client: SupabaseClient, persona: QaPersona, user: User) {
  const [{ data: fixedSlot, error: fixedSlotError }, { data: userMembership, error: userMembershipError }] = await Promise.all([
    client.from("organization_memberships").select("id,organization_id,user_id,is_active").eq("id", persona.membershipId).maybeSingle(),
    client
    .from("organization_memberships")
    .select("id,organization_id,user_id,is_active")
    .eq("organization_id", persona.organizationId)
    .eq("user_id", user.id)
    .maybeSingle(),
  ]);
  if (fixedSlotError) throw fixedSlotError;
  if (userMembershipError) throw userMembershipError;
  if (fixedSlot && fixedSlot.organization_id !== persona.organizationId) {
    throw Object.assign(new Error("The deterministic QA membership ID is already owned outside its bounded QA organization."), { code: "QA_MEMBERSHIP_SCOPE_CONFLICT" });
  }

  const strategy = resolveQaMembershipStrategy(
    fixedSlot ? { id: fixedSlot.id, userId: fixedSlot.user_id } : null,
    userMembership ? { id: userMembership.id, userId: userMembership.user_id } : null,
  );

  if (strategy === "ACTIVATE_USER_MEMBERSHIP" || strategy === "ACTIVATE_USER_AND_DEACTIVATE_STALE_SLOT") {
    if (!userMembership) throw new Error("QA membership strategy is inconsistent.");
    const { error: updateError } = await client
      .from("organization_memberships")
      .update({ role: "owner", is_active: true })
      .eq("id", userMembership.id)
      .eq("organization_id", persona.organizationId);
    if (updateError) throw updateError;

    if (strategy === "ACTIVATE_USER_AND_DEACTIVATE_STALE_SLOT" && fixedSlot?.is_active) {
      const { error: deactivateError } = await client
        .from("organization_memberships")
        .update({ is_active: false })
        .eq("id", fixedSlot.id)
        .eq("organization_id", persona.organizationId);
      if (deactivateError) throw deactivateError;
    }
    return;
  }

  const operation = strategy === "REASSIGN_FIXED_SLOT" && fixedSlot
    ? client.from("organization_memberships").update({ user_id: user.id, role: "owner", is_active: true }).eq("id", fixedSlot.id).eq("organization_id", persona.organizationId)
    : client.from("organization_memberships").insert({
      id: persona.membershipId,
      organization_id: persona.organizationId,
      user_id: user.id,
      role: "owner",
      is_active: true,
    });
  const { error } = await operation;
  if (error) throw error;
}

async function assertMembershipSlotScope(client: SupabaseClient, persona: QaPersona) {
  const { data, error } = await client
    .from("organization_memberships")
    .select("organization_id")
    .eq("id", persona.membershipId)
    .maybeSingle();
  if (error) throw error;
  if (data && data.organization_id !== persona.organizationId) {
    throw Object.assign(new Error("The deterministic QA membership ID is already owned outside its bounded QA organization."), { code: "QA_MEMBERSHIP_SCOPE_CONFLICT" });
  }
}

async function applyPersona(client: SupabaseClient, persona: QaPersona) {
  await assertMembershipSlotScope(client, persona);
  const { user, created } = await ensureUser(client, persona);

  try {
    const { error: profileError } = await client
      .from("profiles")
      .upsert({ id: user.id, full_name: persona.fullName }, { onConflict: "id" });
    if (profileError) throw profileError;

    await ensureMembership(client, persona, user);
    console.log(`[qa-seed] READY ${persona.key} organization=${persona.organizationId}`);
  } catch (error) {
    if (created) {
      const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
      if (cleanupError) {
        throw Object.assign(new Error("QA persona setup failed and its newly created Auth user could not be compensated. Re-run after reviewing the development Auth user list."), { code: "QA_AUTH_COMPENSATION_FAILED" });
      }
    }
    throw error;
  }
}

async function main() {
  const mode = parseQaSeedMode(process.argv.slice(2));
  const safety = assertQaSeedSafety({
    mode,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    qaSeedTarget: process.env.QA_SEED_TARGET,
    allowRemoteDevelopment: process.env.QA_SEED_ALLOW_REMOTE_DEVELOPMENT,
    confirmation: process.env.QA_SEED_CONFIRM,
  });
  const credentials = qaCredentials(safety.target);
  const personas: QaPersona[] = [
    {
      key: "automotive-owner",
      email: credentials.automotiveEmail,
      password: credentials.password,
      fullName: "Ari Automotive QA",
      organizationId: "de000000-0000-4000-8000-000000000001",
      membershipId: "de310000-0000-4000-8000-000000000001",
      branchId: "de000000-0000-4000-8000-000000000002",
    },
    {
      key: "salon-owner",
      email: credentials.salonEmail,
      password: credentials.password,
      fullName: "Sam Salon QA",
      organizationId: "5a200000-0000-4000-8000-000000000001",
      membershipId: "5a310000-0000-4000-8000-000000000001",
      branchId: "5a400000-0000-4000-8000-000000000001",
    },
  ];

  console.log(`[qa-seed] target=${safety.target} mode=${mode}`);
  console.log(`[qa-seed] personas=${personas.map(({ key }) => key).join(",")}`);
  if (mode === "dry-run") {
    console.log("[qa-seed] DRY RUN: no auth or database writes were made. Pass --apply to create/update the personas.");
    return;
  }

  const serviceRoleKey = requiredEnvironmentValue("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const fixtures: QaVerticalFixture[] = [
    {
      organization: { id: personas[0].organizationId, name: "NegOSu Automotive QA", slug: "negosu-automotive-qa", industry: "automotive", businessType: "full_auto_service" },
      branchId: personas[0].branchId,
      branchName: "Automotive QA Branch",
      categoryId: "de600000-0000-4000-8000-000000000001",
      categoryName: "QA Services",
      serviceId: "de000000-0000-4000-8000-000000000004",
      serviceName: "QA Preventive Maintenance",
      serviceDurationMinutes: 60,
      servicePriceCentavos: 150000,
      customerId: "de000000-0000-4000-8000-000000000003",
      customerName: "Automotive QA Customer",
      inventoryItemId: "deaa0000-0000-4000-8000-000000000001",
      inventoryItemName: "QA Engine Oil",
      inventorySku: "QA-AUTO-OIL",
      vehicle: { id: "de000000-0000-4000-8000-000000000009", make: "Toyota", model: "Vios", plateNumber: "QA 2026" },
    },
    {
      organization: { id: personas[1].organizationId, name: "NegOSu Salon QA", slug: "negosu-salon-qa", industry: "salon", businessType: "salon" },
      branchId: personas[1].branchId,
      branchName: "Salon QA Branch",
      categoryId: "5a600000-0000-4000-8000-000000000001",
      categoryName: "Hair",
      serviceId: "5a700000-0000-4000-8000-000000000001",
      serviceName: "QA Haircut",
      serviceDurationMinutes: 60,
      servicePriceCentavos: 65000,
      customerId: "5a500000-0000-4000-8000-000000000001",
      customerName: "Salon QA Client",
      inventoryItemId: "5aa00000-0000-4000-8000-000000000001",
      inventoryItemName: "QA Shampoo",
      inventorySku: "QA-SALON-SHAMPOO",
    },
  ];

  // Create all domain fixtures before Auth users so a schema incompatibility
  // cannot leave login-capable personas pointing at an incomplete tenant.
  for (const fixture of fixtures) await ensureVerticalFixture(client, fixture);
  for (const persona of personas) await applyPersona(client, persona);
  console.log("[qa-seed] Complete. Re-running this command updates the same users and memberships without duplicates.");
}

main().catch((error: unknown) => {
  const diagnostic = formatQaSeedOperatorError(error);
  console.error(`[qa-seed] FAILED code=${diagnostic.code} message=${diagnostic.message}`);
  process.exitCode = 1;
});
