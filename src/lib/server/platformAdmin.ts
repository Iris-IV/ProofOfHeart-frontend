import * as StellarSdk from "@stellar/stellar-sdk";

/**
 * Server-side lookup of the platform admin address.
 *
 * Deliberately independent of `lib/contractClient`, which pulls in the wallet
 * signer and other browser-only code that must never load in a route handler.
 *
 * `PLATFORM_ADMIN_ADDRESS` short-circuits the lookup for deployments that
 * would rather not depend on RPC availability to authorise a request. When it
 * is unset the address is read from the contract, which keeps the API in step
 * with `transfer_admin` without a redeploy.
 */

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ??
  process.env.TESTNET_RPC_URL ??
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://soroban-testnet.stellar.org";

const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

/** Re-reading the contract on every request would make the admin page crawl. */
const CACHE_TTL_MS = 60_000;

let cached: { address: string; fetchedAt: number } | null = null;

function contractAddress(): string {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
}

function configuredAdminAddress(): string {
  return (
    process.env.PLATFORM_ADMIN_ADDRESS ??
    process.env.ADMIN_ADDRESS ??
    process.env.NEXT_PUBLIC_ADMIN_ADDRESS ??
    ""
  ).trim();
}

async function readAdminFromContract(): Promise<string> {
  const address = contractAddress();
  if (!address) {
    throw new Error("No contract address configured.");
  }

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  const contract = new StellarSdk.Contract(address);
  const probe = new StellarSdk.Account(StellarSdk.Keypair.random().publicKey(), "0");

  const tx = new StellarSdk.TransactionBuilder(probe, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("get_admin"))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error ?? "get_admin simulation failed.");
  }

  const retval = (simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval;
  if (!retval) {
    throw new Error("get_admin returned no value.");
  }

  return StellarSdk.Address.fromScVal(retval).toString();
}

/**
 * Resolves the platform admin address, throwing when it cannot be determined.
 * Callers must treat a throw as "deny", never as "allow" — an unreachable RPC
 * node must not turn into an open endpoint.
 */
export async function getPlatformAdminAddress(): Promise<string> {
  const configured = configuredAdminAddress();
  if (configured) return configured;

  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.address;
  }

  const address = await readAdminFromContract();
  if (!address) {
    throw new Error("Contract returned an empty admin address.");
  }

  cached = { address, fetchedAt: now };
  return address;
}

/** Test helper — drops the memoised contract lookup. */
export function resetPlatformAdminCache(): void {
  cached = null;
}
