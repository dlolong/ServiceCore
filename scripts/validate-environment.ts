import { RuntimeEnvironmentValidationError, assertRuntimeEnvironment } from "../lib/env/runtime-validation";

try {
  const source = {
    ...process.env,
    NODE_ENV: process.argv.includes("--production") ? "production" : process.env.NODE_ENV || "development",
  };
  const environment = assertRuntimeEnvironment(source);
  console.log(`[release-env] PASS environment=${environment.environment}`);
} catch (error: unknown) {
  if (error instanceof RuntimeEnvironmentValidationError) {
    console.error(`[release-env] FAIL ${error.message}`);
  } else {
    console.error("[release-env] FAIL Environment validation could not run.");
  }
  process.exitCode = 1;
}
