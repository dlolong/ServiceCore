import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  REMOTE_DEVELOPMENT_CONFIRMATION,
  assertQaSeedSafety,
  formatQaSeedOperatorError,
  parseQaSeedMode,
  resolveQaMembershipStrategy,
} from "../scripts/qa-seed-safety";

const source = (path: string) => readFileSync(path, "utf8");

test("QA seed defaults to dry-run and requires an explicit apply flag", () => {
  assert.equal(parseQaSeedMode([]), "dry-run");
  assert.equal(parseQaSeedMode(["--dry-run"]), "dry-run");
  assert.equal(parseQaSeedMode(["--apply"]), "apply");
  assert.throws(() => parseQaSeedMode(["--dry-run", "--apply"]));
});

test("QA seed diagnostics retain safe codes while redacting credentials", () => {
  assert.deepEqual(
    formatQaSeedOperatorError({ code: "23505", message: "duplicate qa@example.test password=unsafe token=secret-value" }),
    { code: "23505", message: "duplicate [redacted-email] password=[redacted] token=[redacted]" },
  );
});

test("QA membership rotation reuses the bounded slot without a fixed-ID insert conflict", () => {
  const stale = { id: "fixed-membership", userId: "old-user" };
  const current = { id: "existing-membership", userId: "new-user" };
  assert.equal(resolveQaMembershipStrategy(null, null), "INSERT_FIXED_SLOT");
  assert.equal(resolveQaMembershipStrategy(stale, null), "REASSIGN_FIXED_SLOT");
  assert.equal(resolveQaMembershipStrategy(stale, stale), "ACTIVATE_USER_MEMBERSHIP");
  assert.equal(resolveQaMembershipStrategy(stale, current), "ACTIVATE_USER_AND_DEACTIVATE_STALE_SLOT");
});

test("QA seed permits local targets and always rejects production", () => {
  assert.deepEqual(assertQaSeedSafety({
    mode: "apply",
    supabaseUrl: "http://127.0.0.1:54321",
    nodeEnv: "development",
    vercelEnv: undefined,
    qaSeedTarget: undefined,
    allowRemoteDevelopment: undefined,
    confirmation: undefined,
  }), { target: "local", mode: "apply" });

  assert.throws(() => assertQaSeedSafety({
    mode: "dry-run",
    supabaseUrl: "http://127.0.0.1:54321",
    nodeEnv: "production",
    vercelEnv: undefined,
    qaSeedTarget: undefined,
    allowRemoteDevelopment: undefined,
    confirmation: undefined,
  }), /disabled in production/);
});

test("remote development QA seed requires all three explicit guards", () => {
  const remote = {
    mode: "apply" as const,
    supabaseUrl: "https://development-project.supabase.co",
    nodeEnv: "development",
    vercelEnv: "preview",
    qaSeedTarget: "development",
    allowRemoteDevelopment: "true",
    confirmation: REMOTE_DEVELOPMENT_CONFIRMATION,
  };
  assert.deepEqual(assertQaSeedSafety(remote), { target: "remote-development", mode: "apply" });
  assert.throws(() => assertQaSeedSafety({ ...remote, confirmation: "wrong" }), /Remote QA seeding is blocked/);
  assert.throws(() => assertQaSeedSafety({ ...remote, qaSeedTarget: "production" }), /disabled in production/);
});

test("release scripts and docs keep seeding explicit and cloud-neutral", () => {
  const packageJson = JSON.parse(source("package.json")) as { engines: { node: string }; scripts: Record<string, string> };
  assert.equal(packageJson.engines.node, ">=24.0.0 <25.0.0");
  assert.match(packageJson.scripts["qa:seed"], /qa-seed\.ts/);
  assert.match(packageJson.scripts["release:check"], /release:env/);
  assert.match(packageJson.scripts["release:health"], /check-health\.ts/);
  assert.match(packageJson.scripts.prestart, /release:env -- --production/);
  assert.doesNotMatch(packageJson.scripts.start, /seed/i);
  assert.doesNotMatch(packageJson.scripts.build, /seed/i);

  const deployment = source("docs/DEPLOYMENT.md");
  assert.match(deployment, /cloud-neutral/i);
  assert.match(deployment, /Production backfill was NOT executed/);
  assert.match(deployment, /hosting service must not run seeds/i);

  const smoke = source("e2e/release-smoke.spec.ts");
  assert.match(smoke, /Automotive owner smoke/);
  assert.match(smoke, /Salon owner smoke/);
  assert.match(smoke, /E2E_AUTHENTICATED/);

  const playwright = source("playwright.config.ts");
  assert.match(playwright, /reuseExistingServer: false/);
  for (const width of [320, 375, 390, 430]) assert.match(playwright, new RegExp(`width: ${width}`));
  assert.match(smoke, /payload\.service.*servicecore-web/);

  const qaSeed = source("scripts/qa-seed.ts");
  assert.match(qaSeed, /QA_MEMBERSHIP_SCOPE_CONFLICT/);
  assert.match(qaSeed, /update\(\{ user_id: user\.id, role: "owner", is_active: true \}\)/);
  assert.match(qaSeed, /deleteUser\(user\.id\)/);
});
