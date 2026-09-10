const healthUrl = process.env.HEALTHCHECK_URL || "http://127.0.0.1:3000/health";

async function main() {
  const response = await fetch(healthUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}.`);

  const payload = await response.json() as { status?: unknown };
  if (payload.status !== "ok") throw new Error("Health check response did not report status=ok.");
  console.log(`[release-health] PASS ${new URL(healthUrl).origin}/health`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown health-check failure.";
  console.error(`[release-health] FAIL ${message}`);
  process.exitCode = 1;
});
