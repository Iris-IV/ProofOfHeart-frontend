/**
 * #1633 — Zod schemas for the environment.
 *
 * Server-only. `./runtimeEnv` deliberately has no runtime dependencies so it can
 * be imported from `"use client"` components; this module is the side that needs
 * `zod`, and nothing in the client graph reaches it.
 *
 * The per-variable schemas are *derived* from `ENV_CONTRACT` rather than written
 * by hand, so a variable cannot be added to the contract without also getting a
 * schema, a derived type, and a row in the generated documentation.
 *
 * Cross-variable rules (an analytics provider without its site id, a network
 * passphrase that disagrees with the network, a `NEXT_PUBLIC_`-prefixed secret)
 * live in a separate pass over the parsed data rather than a Zod `superRefine`.
 * Two reasons: they mix `error` and `warning` severities, and Zod v3 discards
 * refinement issues when the parse succeeds — which would silently drop exactly
 * the deprecation warnings that matter most.
 *
 * Validation never throws on its own; it returns a report, so the boot hook can
 * print every problem at once instead of dying on the first bad variable.
 *
 * @see ./envContract for the contract table.
 * @see ./runtimeEnv for the readers.
 */

import { z } from "zod";
import { ENV_CONTRACT, type EnvContractEntry, type EnvValueFormat } from "./envContract";
import { IS_MOCK_MODE, readClientEnv, readServerEnv, type EnvRecord } from "./runtimeEnv";

/** Literal names of the client-scoped variables, derived from the contract. */
export type ClientEnvName = Extract<(typeof ENV_CONTRACT)[number], { scope: "client" }>["name"];
/** Literal names of the server-scoped variables, derived from the contract. */
export type ServerEnvName = Extract<(typeof ENV_CONTRACT)[number], { scope: "server" }>["name"];

/**
 * Validated values, keyed by the contract's variable names.
 *
 * The parsed shape is assembled at runtime from the contract, so the value types
 * cannot be spelled out literally here. Consumers should treat the values as
 * `unknown` and narrow, or call `resolveEnvFlags` for the handful of values that
 * are read on every boot.
 */
export type ClientEnv = Record<ClientEnvName, unknown>;
export type ServerEnv = Record<ServerEnvName, unknown>;

// ---------------------------------------------------------------------------
// Issue model
// ---------------------------------------------------------------------------

/**
 * `error` — misconfigured in a way that breaks a user-visible feature, or a
 *   secret exposed to the browser. Blocks a production boot.
 * `warning` — worth a look but safe to boot with (an unset optional value, a
 *   deprecated variable). Never blocks.
 */
export type EnvIssueSeverity = "error" | "warning";

export interface EnvIssue {
  readonly scope: "client" | "server" | "both";
  /** The variable the issue is attributed to. */
  readonly key: string;
  readonly severity: EnvIssueSeverity;
  readonly message: string;
}

export interface EnvSection<T> {
  readonly scope: "client" | "server";
  /** Parsed values. Empty when the section failed, since Zod returns nothing. */
  readonly data: T;
  readonly issues: readonly EnvIssue[];
  /** True when this section produced no `error`-severity issues. */
  readonly ok: boolean;
}

export interface RuntimeEnvReport {
  readonly ok: boolean;
  readonly client: EnvSection<ClientEnv>;
  readonly server: EnvSection<ServerEnv>;
  readonly issues: readonly EnvIssue[];
}

/** Thrown by `assertRuntimeEnv` when the environment is not shippable. */
export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(`Invalid environment configuration:\n${formatEnvIssues(issues)}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/** Render issues as an aligned, human-readable block for logs and CI output. */
export function formatEnvIssues(issues: readonly EnvIssue[]): string {
  if (issues.length === 0) return "  (no issues)";
  const width = issues.reduce((max, issue) => Math.max(max, issue.key.length), 0);
  return issues
    .map(
      (issue) =>
        `  ${issue.severity.toUpperCase().padEnd(7)} ${issue.key.padEnd(width)}  ${issue.message}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * `.env` files spell "unset" as an empty string, and several entries in
 * `.env.example` are written that way on purpose. Treat `""` exactly like an
 * absent variable so `FOO=` never surfaces as "must be a number".
 */
const absent = (value: unknown): unknown => (value === "" ? undefined : value);

const TRUTHY = new Set(["true", "1", "yes", "on"]);
const FALSY = new Set(["false", "0", "no", "off"]);
const BOOLEAN_LITERALS: readonly string[] = [...TRUTHY, ...FALSY];

const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
/** Stellar account ids: `G` + 55 base32 characters. */
const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/i;
/** Stellar contract ids: `C` + 56 base32 characters. */
const STELLAR_CONTRACT_PATTERN = /^C[A-Z2-7]{56}$/i;
/** Three base64url segments — enough to catch a paste of the wrong secret. */
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function describe(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** Trimmed, empty-as-absent, then optionally lowercased. */
function text(options: { lower?: boolean } = {}) {
  return z.preprocess((value) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    const notEmpty = absent(trimmed);
    return typeof notEmpty === "string" && options.lower ? notEmpty.toLowerCase() : notEmpty;
  }, z.string().optional());
}

/** `""` → undefined, then trimmed, then a non-empty string. */
const envString = text().refine((value) => value === undefined || value.length > 0, {
  message: "must not be blank",
});

/** Free-form text: `""` → undefined, trimmed, any length including empty. */
const envText = text();

const envBoolean = text({ lower: true })
  .refine(
    (value) => value === undefined || TRUTHY.has(value) || FALSY.has(value),
    (value) => ({
      message: `must be one of ${BOOLEAN_LITERALS.join(", ")} (got ${describe(value)})`,
    }),
  )
  .transform((value) => (value === undefined ? undefined : TRUTHY.has(value)));

function envNumber(entry: EnvContractEntry) {
  const isInteger = entry.value === "integer";
  const bounds =
    entry.min !== undefined && entry.max !== undefined
      ? `${entry.min}–${entry.max}`
      : entry.min !== undefined
        ? `at least ${entry.min}`
        : `at most ${entry.max}`;

  return text()
    .refine(
      (value) =>
        value === undefined || (isInteger ? /^[+-]?\d+$/.test(value) : NUMBER_PATTERN.test(value)),
      (value) => ({
        message: `must be ${isInteger ? "an integer" : "a number"} (got ${describe(value)})`,
      }),
    )
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .refine(
      (value) =>
        value === undefined ||
        ((entry.min === undefined || value >= entry.min) &&
          (entry.max === undefined || value <= entry.max)),
      (value) => ({ message: `must be ${bounds} (got ${describe(value)})` }),
    );
}

function envUrl(options: { httpsOnly: boolean }) {
  return text()
    .refine(
      (value) => value === undefined || parseUrl(value) !== undefined,
      (value) => ({ message: `must be an absolute URL (got ${describe(value)})` }),
    )
    .refine(
      (value) => {
        if (value === undefined) return true;
        const url = parseUrl(value);
        if (url === undefined) return true; // already reported by the check above
        if (url.protocol === "https:") return true;
        return !options.httpsOnly && url.protocol === "http:";
      },
      (value) => ({
        message: options.httpsOnly
          ? `must be an https URL, because the browser fetches it (got ${describe(value)})`
          : `must be an http or https URL (got ${describe(value)})`,
      }),
    );
}

function envPattern(pattern: RegExp, what: string) {
  return text().refine((value) => value === undefined || pattern.test(value), {
    message: `must be ${what}`,
  });
}

function envStellarAddressList() {
  return text()
    .transform((value) =>
      value === undefined
        ? []
        : value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
    )
    .refine(
      (list) => list.every((entry) => STELLAR_ADDRESS_PATTERN.test(entry)),
      (list) => {
        const rejected = list.filter((entry) => !STELLAR_ADDRESS_PATTERN.test(entry));
        return {
          message:
            `every entry must be a Stellar account id (G…, 56 characters); ` +
            `rejected ${rejected.length === 1 ? "entry" : "entries"} ${rejected.join(", ")}`,
        };
      },
    );
}

function envEnum(options: readonly string[]) {
  return text({ lower: true }).refine(
    (value) => value === undefined || options.includes(value),
    (value) => ({ message: `must be one of ${options.join(", ")} (got ${describe(value)})` }),
  );
}

/** Compile one contract row into the schema that validates it. */
function schemaForValue(format: EnvValueFormat, entry: EnvContractEntry): z.ZodTypeAny {
  switch (format) {
    case "boolean":
      return envBoolean;
    case "integer":
    case "number":
      return envNumber(entry);
    case "enum":
      return envEnum(entry.options ?? []);
    case "url":
      return envUrl({ httpsOnly: false });
    case "https-url":
      return envUrl({ httpsOnly: true });
    case "stellar-address":
      return envPattern(STELLAR_ADDRESS_PATTERN, "a Stellar account id (G…, 56 characters)");
    case "stellar-contract":
      return envPattern(STELLAR_CONTRACT_PATTERN, "a Stellar contract id (C…, 57 characters)");
    case "stellar-address-list":
      return envStellarAddressList();
    case "jwt":
      return envPattern(JWT_PATTERN, "a three-part JWT");
    case "text":
      return envText;
    case "string":
      return envString;
  }
}

/** Build the object shape for one scope, marking `required` rows as non-optional. */
function shapeFor(scope: "client" | "server"): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  for (const entry of ENV_CONTRACT) {
    if (entry.scope !== scope) continue;
    const schema = schemaForValue(entry.value, entry);
    // Every preprocessor accepts `undefined`, so an absent value passes; for a
    // required variable it has to be rejected explicitly.
    shape[entry.name] = entry.required
      ? schema.refine((value) => value !== undefined, { message: "is required" })
      : schema;
  }
  return shape;
}

/** Zod schema for the client scope: one entry per client variable. */
export const ClientEnvSchema = z.object(shapeFor("client"));

/** Zod schema for the server scope: one entry per server variable. */
export const ServerEnvSchema = z.object(shapeFor("server"));

// ---------------------------------------------------------------------------
// Cross-variable rules
// ---------------------------------------------------------------------------

/**
 * Well-known network passphrases. A mismatch means the app signs for one network
 * while the network banner says another, which fails every transaction with an
 * opaque error.
 */
export const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

export interface RefineClientOptions {
  /** Enables the production-only rules. */
  readonly isProduction: boolean;
}

/**
 * Rules that span more than one variable, plus the production-only checks.
 * Runs over already-parsed values, so `NEXT_PUBLIC_USE_MOCKS` is a real boolean
 * rather than the string `"true"`.
 */
export function refineClientEnv(
  data: Record<string, unknown>,
  options: RefineClientOptions,
): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const error = (key: string, message: string) =>
    issues.push({ scope: "client", key, severity: "error", message });
  const warning = (key: string, message: string) =>
    issues.push({ scope: "client", key, severity: "warning", message });

  const network = (data.NEXT_PUBLIC_STELLAR_NETWORK as string | undefined) ?? "testnet";
  const passphrase = data.NEXT_PUBLIC_NETWORK_PASSPHRASE as string | undefined;
  const expectedPassphrase = NETWORK_PASSPHRASES[network];
  if (
    passphrase !== undefined &&
    expectedPassphrase !== undefined &&
    passphrase !== expectedPassphrase
  ) {
    error(
      "NEXT_PUBLIC_NETWORK_PASSPHRASE",
      `"${passphrase}" is not the ${network} passphrase; expected "${expectedPassphrase}". ` +
        "Transactions signed against the wrong passphrase are rejected by the network.",
    );
  }

  const analytics = data.NEXT_PUBLIC_ANALYTICS_PROVIDER as string | undefined;
  if (analytics === "plausible" && !data.NEXT_PUBLIC_ANALYTICS_DOMAIN) {
    error(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
      "set NEXT_PUBLIC_ANALYTICS_DOMAIN to the registered site name",
    );
  }
  if (analytics === "umami" && !data.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID) {
    error(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
      "set NEXT_PUBLIC_ANALYTICS_WEBSITE_ID to the Umami website id",
    );
  }
  if (!analytics && (data.NEXT_PUBLIC_ANALYTICS_DOMAIN || data.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID)) {
    error(
      "NEXT_PUBLIC_ANALYTICS_PROVIDER",
      "an analytics site id or website id is set but no provider is selected, so analytics stays disabled",
    );
  }

  const onramp = data.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER as string | undefined;
  if (onramp === "ramp" && !data.NEXT_PUBLIC_RAMP_API_KEY) {
    error(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
      "set NEXT_PUBLIC_RAMP_API_KEY to the publishable host key",
    );
  }
  if (onramp === "moonpay" && !data.NEXT_PUBLIC_MOONPAY_API_KEY) {
    error(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
      "set NEXT_PUBLIC_MOONPAY_API_KEY to the publishable key",
    );
  }
  if (!onramp && (data.NEXT_PUBLIC_RAMP_API_KEY || data.NEXT_PUBLIC_MOONPAY_API_KEY)) {
    error(
      "NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER",
      "a provider key is set but no provider is selected, so the on-ramp UI stays hidden",
    );
  }

  // The allowlist schema normalises an unset value to `[]`, and `[]` is truthy,
  // so this has to test the length rather than the value.
  const allowlist = data.NEXT_PUBLIC_MAINTENANCE_ALLOWLIST as string[] | undefined;
  if (data.NEXT_PUBLIC_MAINTENANCE_MODE === true && (allowlist?.length ?? 0) === 0) {
    error(
      "NEXT_PUBLIC_MAINTENANCE_ALLOWLIST",
      "maintenance mode is on with an empty allowlist, so no administrator can reach the site",
    );
  }

  // A client-scoped webhook URL hands its endpoint to every visitor. It is a
  // legacy fallback rather than a credential, so it warns instead of blocking.
  if (data.NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL) {
    warning(
      "NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL",
      "deprecated: a client-scoped webhook URL is shipped to every browser. Set the server-only CREATOR_EMAIL_WEBHOOK_URL instead.",
    );
  }

  if (!options.isProduction) return issues;

  if (data.NEXT_PUBLIC_USE_MOCKS === true) {
    error("NEXT_PUBLIC_USE_MOCKS", "mock data cannot ship to production; set it to false");
  }
  if (!data.NEXT_PUBLIC_CONTRACT_ADDRESS) {
    warning(
      "NEXT_PUBLIC_CONTRACT_ADDRESS",
      "unset in production: campaigns will not load until the contract id is configured",
    );
  }
  const siteUrl = data.NEXT_PUBLIC_SITE_URL as string | undefined;
  if (siteUrl !== undefined && parseUrl(siteUrl)?.protocol !== "https:") {
    warning(
      "NEXT_PUBLIC_SITE_URL",
      "should be https in production; browsers do not treat an http canonical URL as secure",
    );
  }

  return issues;
}

/** Cross-variable rules for the server scope. */
export function refineServerEnv(
  data: Record<string, unknown>,
  options: RefineClientOptions & { stellarNetwork?: string },
): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const warning = (key: string, message: string) =>
    issues.push({ scope: "server", key, severity: "warning", message });

  // A mainnet deployment wants a credentialed RPC; the public mainnet endpoint
  // rate-limits aggressively, which shows up as intermittent failed donations.
  // The network is client-scoped, so it is passed in rather than read from the
  // server record, and it has to be compared explicitly: the default is testnet,
  // so an unset value must not produce a mainnet warning.
  if (options.isProduction && options.stellarNetwork === "mainnet" && !data.MAINNET_RPC_URL) {
    warning(
      "MAINNET_RPC_URL",
      "unset while the app is configured for mainnet: traffic falls back to the public, rate-limited RPC endpoint",
    );
  }

  return issues;
}

/**
 * A server secret that is also exported under a `NEXT_PUBLIC_` name gets inlined
 * into the JavaScript bundle by Next.js and is readable by anyone who loads the
 * site. This is the single highest-value check in the module, and it catches a
 * mistake a per-variable schema structurally cannot.
 */
export function findExposedSecrets(env: EnvRecord = process.env as EnvRecord): EnvIssue[] {
  const issues: EnvIssue[] = [];
  for (const entry of ENV_CONTRACT) {
    if (!entry.secret) continue;
    const leaked = env[`NEXT_PUBLIC_${entry.name}`];
    if (leaked === undefined || leaked === "") continue;
    issues.push({
      scope: "both",
      key: `NEXT_PUBLIC_${entry.name}`,
      severity: "error",
      message:
        `${entry.name} is a server-only secret but is also exported as NEXT_PUBLIC_${entry.name}, which ` +
        "Next.js inlines into the public JavaScript bundle. Remove the NEXT_PUBLIC_ variable and rotate the credential.",
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function issuesFromZod(error: z.ZodError, scope: "client" | "server"): EnvIssue[] {
  return error.issues.map((issue) => ({
    scope,
    key: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    severity: "error" as const,
    message: issue.message,
  }));
}

function emptySection<T>(scope: "client" | "server"): EnvSection<T> {
  return { scope, data: {} as T, issues: [], ok: true };
}

function isOk(issues: readonly EnvIssue[]): boolean {
  return issues.every((issue) => issue.severity !== "error");
}

/** Keep only the variables belonging to `scope`. */
function pick(source: EnvRecord, scope: "client" | "server"): EnvRecord {
  const out: EnvRecord = {};
  for (const entry of ENV_CONTRACT) {
    if (entry.scope !== scope) continue;
    out[entry.name] = source[entry.name];
  }
  return out;
}

export interface ValidateClientOptions {
  /** Raw environment to read instead of `process.env`. Intended for tests. */
  readonly source?: EnvRecord;
  /** Enables the production-only rules. Defaults to `NODE_ENV === "production"`. */
  readonly isProduction?: boolean;
}

/** Validate the client scope. Never throws. */
export function validateClientEnv(options: ValidateClientOptions = {}): EnvSection<ClientEnv> {
  const source = options.source ?? readClientEnv();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const result = ClientEnvSchema.safeParse(source);
  if (!result.success) {
    return {
      scope: "client",
      data: {} as ClientEnv,
      issues: issuesFromZod(result.error, "client"),
      ok: false,
    };
  }
  const data = result.data as ClientEnv;
  const issues = refineClientEnv(data as Record<string, unknown>, { isProduction });
  return { scope: "client", data, issues, ok: isOk(issues) };
}

export interface ValidateServerOptions {
  /** Raw environment to read instead of `process.env`. Intended for tests. */
  readonly source?: EnvRecord;
  /**
   * Whether to validate the server scope. Defaults to `true`.
   *
   * Deliberately not sniffed from `typeof window`: the runtime decision belongs
   * to `validateRuntimeEnv`, and a primitive that guesses makes the test
   * environment silently change its own behaviour.
   */
  readonly enabled?: boolean;
  /** Enables the production-only rules. */
  readonly isProduction?: boolean;
  /**
   * The configured Stellar network, forwarded to the server rules because a
   * mainnet deployment needs a credentialed RPC and that variable is
   * client-scoped.
   */
  readonly stellarNetwork?: string;
}

/**
 * Validate the server scope. Never throws.
 *
 * Returns an empty, `ok` section when `enabled` is false, so callers can report
 * one combined result without branching.
 */
export function validateServerEnv(options: ValidateServerOptions = {}): EnvSection<ServerEnv> {
  if (options.enabled === false) return emptySection<ServerEnv>("server");

  const source = options.source ?? readServerEnv();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const result = ServerEnvSchema.safeParse(source);
  if (!result.success) {
    return {
      scope: "server",
      data: {} as ServerEnv,
      issues: issuesFromZod(result.error, "server"),
      ok: false,
    };
  }
  const data = result.data as ServerEnv;
  const issues = refineServerEnv(data as Record<string, unknown>, {
    isProduction,
    stellarNetwork: options.stellarNetwork,
  });
  return { scope: "server", data, issues, ok: isOk(issues) };
}

export interface ValidateRuntimeOptions {
  /** Validate the client scope. Defaults to `true`. */
  readonly includeClient?: boolean;
  /**
   * Validate the server scope. Defaults to `true`.
   *
   * Not sniffed from `typeof window` on purpose: server variables that are
   * simply absent validate to "unset", so including them is harmless, and
   * guessing the runtime would make a jsdom test silently skip the server rules
   * it is trying to exercise. A browser caller that cares about bundle size
   * should pass `includeServer: false` — though this module is server-only in
   * practice, since importing it from a `"use client"` module would pull `zod`
   * into the browser bundle.
   */
  readonly includeServer?: boolean;
  /** Enable the production-only rules. Defaults to `NODE_ENV === "production"`. */
  readonly isProduction?: boolean;
  /** Raw environment to read instead of `process.env`. Intended for tests. */
  readonly source?: EnvRecord;
  /** Report secrets that are also exported with a `NEXT_PUBLIC_` prefix. Defaults to `true`. */
  readonly checkSecretExposure?: boolean;
}

/** Validate both scopes plus the cross-scope secret check. Never throws. */
export function validateRuntimeEnv(options: ValidateRuntimeOptions = {}): RuntimeEnvReport {
  const source = options.source;
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";

  const client =
    (options.includeClient ?? true)
      ? validateClientEnv({
          source: source ? pick(source, "client") : undefined,
          isProduction,
        })
      : emptySection<ClientEnv>("client");

  const server =
    (options.includeServer ?? true)
      ? validateServerEnv({
          source: source ? pick(source, "server") : undefined,
          isProduction,
          // Forwarded so the mainnet-RPC rule can fire; the default is testnet.
          stellarNetwork: (client.data as Record<string, unknown>).NEXT_PUBLIC_STELLAR_NETWORK as
            string | undefined,
        })
      : emptySection<ServerEnv>("server");

  const exposed =
    options.checkSecretExposure === false
      ? []
      : findExposedSecrets((source ?? process.env) as EnvRecord);

  const issues = [...client.issues, ...server.issues, ...exposed];
  return { ok: isOk(issues), client, server, issues };
}

export interface AssertRuntimeEnvOptions extends ValidateRuntimeOptions {
  /** Also fail on `warning`-severity issues. Defaults to `false`. */
  readonly throwOnWarning?: boolean;
  /** Throw at all when there are blocking issues. Defaults to `true`. */
  readonly throwOnError?: boolean;
}

/**
 * Validate the environment and throw an `EnvValidationError` when it is not
 * shippable. Used by the server boot hook and by the production build gate.
 */
export function assertRuntimeEnv(options: AssertRuntimeEnvOptions = {}): RuntimeEnvReport {
  const report = validateRuntimeEnv(options);
  if (options.throwOnError === false) return report;
  const blocking = options.throwOnWarning
    ? report.issues
    : report.issues.filter((issue) => issue.severity === "error");
  if (blocking.length > 0) throw new EnvValidationError(blocking);
  return report;
}

/** The handful of validated values that are read on every boot. */
export interface ResolvedEnvFlags {
  readonly isMockMode: boolean;
  readonly isProduction: boolean;
  readonly stellarNetwork: "testnet" | "mainnet";
  readonly maintenanceMode: boolean;
}

export function resolveEnvFlags(
  report: RuntimeEnvReport,
  options: { isProduction?: boolean } = {},
): ResolvedEnvFlags {
  const client = report.client.data as Record<string, unknown>;
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const network = client.NEXT_PUBLIC_STELLAR_NETWORK as string | undefined;
  return {
    // Fall back to the module-level flag when the client section failed to parse,
    // so a broken environment never silently flips mock mode off.
    isMockMode:
      typeof client.NEXT_PUBLIC_USE_MOCKS === "boolean"
        ? client.NEXT_PUBLIC_USE_MOCKS
        : IS_MOCK_MODE,
    isProduction,
    stellarNetwork: network === "mainnet" ? "mainnet" : "testnet",
    maintenanceMode: client.NEXT_PUBLIC_MAINTENANCE_MODE === true,
  };
}
