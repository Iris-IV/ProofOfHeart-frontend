import { z } from "zod";

/**
 * Schema for client-side (public) environment variables.
 * These are prefixed with NEXT_PUBLIC_ and exposed to the browser.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_USE_MOCKS: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["testnet", "mainnet", "futurenet"]).optional(),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url().optional(),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_CONTRACT_ID: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
});

/**
 * Schema for server-side environment variables.
 * These are only available on the server and never exposed to the browser.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  API_SECRET_KEY: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
});

/**
 * Combined schema for all environment variables.
 */
const envSchema = clientEnvSchema.merge(serverEnvSchema);

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;
type Env = z.infer<typeof envSchema>;

/**
 * Validated client environment variables.
 * Safe to use on both client and server.
 */
export const clientEnv: ClientEnv = (() => {
  const env = {
    NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_STELLAR_HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
    NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
    NEXT_PUBLIC_CONTRACT_ID: process.env.NEXT_PUBLIC_CONTRACT_ID,
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
  };

  const result = clientEnvSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid client environment variables:", result.error.flatten().fieldErrors);
    throw new Error(
      `Client environment validation failed:\n${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`,
    );
  }

  return result.data;
})();

/**
 * Validated server environment variables.
 * Should only be used on the server side.
 */
export const serverEnv: ServerEnv = (() => {
  // Only validate server env on the server
  if (typeof window !== "undefined") {
    return {} as ServerEnv;
  }

  const env = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  };

  const result = serverEnvSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Invalid server environment variables:", result.error.flatten().fieldErrors);
    throw new Error(
      `Server environment validation failed:\n${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`,
    );
  }

  return result.data;
})();

/**
 * Legacy export for backward compatibility.
 * @deprecated Use `clientEnv.NEXT_PUBLIC_USE_MOCKS` instead.
 */
export const IS_MOCK_MODE = clientEnv.NEXT_PUBLIC_USE_MOCKS;

let asserted = false;

/**
 * Asserts that production environment is properly configured.
 * Throws an error if mock mode is enabled in production.
 */
export function assertProductionContractConfig(): void {
  if (asserted) return;
  asserted = true;

  if (serverEnv.NODE_ENV === "production" && clientEnv.NEXT_PUBLIC_USE_MOCKS) {
    throw new Error(
      "Mock mode is disabled in production. Set NEXT_PUBLIC_USE_MOCKS=false before building or running the app.",
    );
  }
}
