import * as StellarSdk from "@stellar/stellar-sdk";
// #649 — Freighter and the embedded social wallet both satisfy this interface.
import { getSignerAddress, signTransactionXdr } from "./walletSigner";
import { wrapFreighterError } from "../utils/freighterErrors";

const OFFCHAIN_API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

/**
 * Error thrown by the off-chain client for network failures, non-2xx responses
 * and missing configuration.
 *
 * @example
 * try {
 *   await requestOffchainJson("/api/reports");
 * } catch (error) {
 *   if (error instanceof OffchainApiError && error.status === 404) {
 *     // handle a missing resource
 *   }
 * }
 */
export class OffchainApiError extends Error {
  /** HTTP status code of the failed response. Undefined for network and config errors. */
  status?: number;
  /** Parsed JSON error body, or the raw response text when it is not JSON. */
  details?: unknown;

  constructor(message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "OffchainApiError";
    this.status = options?.status;
    this.details = options?.details;
  }
}

/** Wallet-signed authentication attached to a request. */
export interface OffchainRequestAuth {
  /** Label for the signed action, such as `"create-report"`. Sent as `X-Request-Purpose`. */
  purpose: string;
  /** Data to sign. Defaults to the request body when omitted. */
  payload?: unknown;
}

/**
 * Options for {@link requestOffchainJson}. Extends `RequestInit` except for `body`.
 */
export interface OffchainRequestOptions extends Omit<RequestInit, "body"> {
  /** When set, the request is signed with the connected wallet and the signature is sent in headers. */
  auth?: OffchainRequestAuth;
  /** Retries after a network error or a retryable status (408, 425, 429, 5xx). Defaults to `2`. */
  retries?: number;
  /** Request body. Objects are JSON-encoded and `Content-Type` is set to `application/json`. Strings are sent as-is. */
  body?: unknown;
}

/** Wallet signature and metadata returned by {@link signOffchainPayload}. */
export interface SignedOffchainPayload {
  /** Stellar public key (`G…`) of the signing wallet. */
  walletAddress: string;
  /** Hex-encoded signature of the signed transaction. */
  signature: string;
  /** Unix timestamp in seconds at which the payload was signed. */
  timestamp: number;
}

/**
 * Returns `true` when `NEXT_PUBLIC_API_URL` is set. Check this before making
 * requests so the UI can disable off-chain features instead of throwing.
 */
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

/**
 * Signs `payload` with the connected wallet (Freighter or the embedded social wallet).
 *
 * The payload is wrapped in `{ purpose, timestamp, payload }`, hashed, and that hash is
 * stored in a `manageData` operation on an unsubmitted transaction. The transaction is
 * never submitted to the network. The returned signature is sent in request headers for
 * the server to verify against `walletAddress`.
 *
 * @param payload - JSON-serializable data to bind to the signature.
 * @param purpose - Action label. Becomes part of the signed envelope and the operation name.
 * @returns The wallet address, hex signature and timestamp.
 * @throws {OffchainApiError} If the wallet returns no signature.
 * @throws If the wallet rejects or fails the signing request. Freighter errors are
 *   normalized by `wrapFreighterError`.
 */
export async function signOffchainPayload(
  payload: unknown,
  purpose: string,
): Promise<SignedOffchainPayload> {
  const walletAddress = await getSignerAddress();
  const timestamp = Math.floor(Date.now() / 1000);
  const envelope = {
    purpose,
    timestamp,
    payload,
  };
  const payloadString = JSON.stringify(envelope);
  const payloadHash = StellarSdk.hash(Buffer.from(payloadString));

  let signedTxXdr: string;
  try {
    signedTxXdr = await signTransactionXdr(
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
  } catch (error) {
    wrapFreighterError(error);
  }

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

/**
 * Sends a JSON request to the off-chain API and returns the parsed response.
 *
 * - `path` may be relative (`/api/reports`) or absolute (`https://…`). Relative paths
 *   are joined to `NEXT_PUBLIC_API_URL`.
 * - Each attempt times out after 15 seconds.
 * - Failed attempts are retried after a linear backoff of 250 ms × attempt number, up to
 *   `retries` times. Retryable statuses (408, 425, 429, 5xx) are retried by design. Note
 *   that the current implementation also retries other non-2xx responses, because the
 *   status check runs inside the same `try` block as the retry `catch`.
 * - A `204 No Content` response resolves to `undefined`.
 * - When `auth` is set, the request is signed with {@link signOffchainPayload} and the
 *   `X-Wallet-Address`, `X-Request-Signature`, `X-Request-Timestamp` and
 *   `X-Request-Purpose` headers are added.
 *
 * @example
 * const report = await requestOffchainJson<Report>("/api/reports", {
 *   method: "POST",
 *   body: { campaignId: 42, reason: "spam" },
 *   auth: { purpose: "create-report" },
 * });
 *
 * @typeParam T - Expected shape of the JSON response body.
 * @throws {OffchainApiError} When `NEXT_PUBLIC_API_URL` is unset, the server returns a
 *   non-2xx status after retries, or all attempts fail to reach the service.
 */
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
    const authEnvelope = buildAuthEnvelope(
      path,
      method,
      options.auth.payload ?? options.body,
      Math.floor(Date.now() / 1000),
    );
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
        const details = errorText
          ? (() => {
              try {
                return JSON.parse(errorText) as unknown;
              } catch {
                return errorText;
              }
            })()
          : undefined;
        const bodyMessage =
          details && typeof details === "object" && details !== null && "message" in details
            ? (details as { message?: unknown }).message
            : undefined;
        const errorMessage =
          typeof bodyMessage === "string"
            ? bodyMessage
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
