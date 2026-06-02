import { getAddress, signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";

const OFFCHAIN_API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

export class OffchainApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "OffchainApiError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

export interface OffchainRequestAuth {
  purpose: string;
  payload?: unknown;
}

export interface OffchainRequestOptions extends Omit<RequestInit, "body"> {
  auth?: OffchainRequestAuth;
  retries?: number;
  body?: unknown;
}

export interface SignedOffchainPayload {
  walletAddress: string;
  signature: string;
  timestamp: number;
}

export function hasOffchainApiBaseUrl(): boolean {
  return OFFCHAIN_API_BASE_URL.length > 0;
}

function resolveOffchainUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!hasOffchainApiBaseUrl()) {
    throw new OffchainApiError("NEXT_PUBLIC_API_URL is not configured.");
  }

  return `${OFFCHAIN_API_BASE_URL}${normalizedPath}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuthEnvelope(path: string, method: string, payload: unknown, timestamp: number) {
  return {
    purpose: "offchain-request",
    path,
    method,
    timestamp,
    payload,
  };
}

export async function signOffchainPayload(
  payload: unknown,
  purpose: string,
): Promise<SignedOffchainPayload> {
  const { address: walletAddress } = await getAddress();
  const timestamp = Math.floor(Date.now() / 1000);
  const envelope = {
    purpose,
    timestamp,
    payload,
  };
  const payloadString = JSON.stringify(envelope);
  const payloadHash = StellarSdk.hash(Buffer.from(payloadString));

  const { signedTxXdr } = await signTransaction(
    new StellarSdk.TransactionBuilder(new StellarSdk.Account(walletAddress, "0"), {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: `offchain_${purpose}`,
          value: payloadHash,
        }),
      )
      .setTimeout(30)
      .build()
      .toXDR(),
    {
      networkPassphrase: NETWORK_PASSPHRASE,
    },
  );

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedTxXdr,
    NETWORK_PASSPHRASE,
  ) as StellarSdk.Transaction;

  const signature = signedTx.signatures[0]?.signature();
  if (!signature) {
    throw new OffchainApiError("No wallet signature was generated.");
  }

  return {
    walletAddress,
    signature: signature.toString("hex"),
    timestamp,
  };
}

export async function requestOffchainJson<T>(
  path: string,
  options: OffchainRequestOptions = {},
): Promise<T> {
  const url = resolveOffchainUrl(path);
  const retries = options.retries ?? DEFAULT_RETRIES;
  const method = (options.method ?? "GET").toUpperCase();

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const authEnvelope = buildAuthEnvelope(path, method, options.auth.payload ?? options.body, Math.floor(Date.now() / 1000));
    const signed = await signOffchainPayload(authEnvelope, options.auth.purpose);
    headers.set("X-Wallet-Address", signed.walletAddress);
    headers.set("X-Request-Signature", signed.signature);
    headers.set("X-Request-Timestamp", String(signed.timestamp));
    headers.set("X-Request-Purpose", options.auth.purpose);
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const details = errorText ? (() => {
          try {
            return JSON.parse(errorText) as unknown;
          } catch {
            return errorText;
          }
        })() : undefined;
        const errorMessage =
          details && typeof details === "object" && details !== null && "message" in details
            ? String((details as { message?: unknown }).message ?? response.statusText)
            : response.statusText || "Off-chain request failed.";
        const error = new OffchainApiError(errorMessage, {
          status: response.status,
          details,
        });

        if (attempt < retries && isRetryableStatus(response.status)) {
          lastError = error;
          await sleep(250 * (attempt + 1));
          continue;
        }

        throw error;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      if (error instanceof OffchainApiError) {
        throw error;
      }
      throw new OffchainApiError("Failed to contact off-chain service.", {
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new OffchainApiError("Failed to contact off-chain service.", {
    details: lastError,
  });
}
