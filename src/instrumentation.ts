/**
 * #1633 — server boot hook.
 *
 * Validates the whole environment once per server process, before the first
 * request is handled, so a misconfigured deployment fails at boot with a list of
 * problems instead of at the first donation with a single opaque error.
 *
 * Next.js calls `register()` when a server instance is bootstrapped (dev server,
 * `next start`, and the standalone `server.js` the Dockerfile runs). It does not
 * run during `next build`, so this never blocks a build.
 *
 * Enforcement is deliberately asymmetric:
 *
 * - `error` issues throw in production, and only in production. In development
 *   and test they are logged, so a work-in-progress `.env.local` does not make
 *   the dev server unusable.
 * - `warning` issues are always logged and never throw. They cover "unset but
 *   probably should be" and deprecations.
 *
 * Set `SKIP_ENV_VALIDATION=true` to bypass the boot check entirely — the same
 * escape hatch `scripts/validate-production-build.mjs` uses for `SKIP_MOCK_CHECK`.
 */

import { assertProductionContractConfig } from "@/lib/runtimeEnv";
import {
  EnvValidationError,
  formatEnvIssues,
  resolveEnvFlags,
  validateRuntimeEnv,
} from "@/lib/envSchema";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_ENV_VALIDATION === "true") return;

  // The pre-existing production guard (mock data must not ship) still runs first,
  // so its error message stays the one operators already search for.
  assertProductionContractConfig();

  const report = validateRuntimeEnv();
  if (report.issues.length === 0) return;

  const flags = resolveEnvFlags(report);
  const errorCount = report.issues.filter((issue) => issue.severity === "error").length;
  const warningCount = report.issues.length - errorCount;

  console.warn(
    `[runtimeEnv] Validated ${Object.keys(report.client.data).length} client and ` +
      `${Object.keys(report.server.data).length} server environment variables on ` +
      `${flags.stellarNetwork}${flags.isMockMode ? " (mock mode)" : ""}.\n` +
      `${formatEnvIssues(report.issues)}`,
  );

  if (errorCount === 0) return;

  const summary = `[runtimeEnv] ${errorCount} blocking environment problem(s) and ${warningCount} warning(s) detected.`;
  if (!flags.isProduction) {
    console.warn(`${summary} Not enforced outside production.`);
    return;
  }
  throw new EnvValidationError(report.issues.filter((issue) => issue.severity === "error"));
}
