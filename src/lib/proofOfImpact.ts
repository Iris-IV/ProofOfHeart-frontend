import { buildIpfsGatewayUrl } from "./ipfsUpload";

/** SHA-256 of `data` as lowercase hex (64 characters). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extracts a bare IPFS CID from `ipfs://<cid>`, a gateway URL, or a raw CID. */
export function parseIpfsReference(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(
    /^(?:ipfs:\/\/|https?:\/\/[^/]+\/ipfs\/)?([A-Za-z0-9]{46,100}(?:\/[^\s?#]*)?)(?:[?#].*)?$/,
  );
  return match ? match[1] : null;
}

export function ipfsEvidenceUrl(input: string): string | null {
  const ref = parseIpfsReference(input);
  return ref ? buildIpfsGatewayUrl(ref) : null;
}

export type ProofCheckResult = "match" | "mismatch";

export function compareProofHash(onChainHash: string, computedHash: string): ProofCheckResult {
  return onChainHash.toLowerCase() === computedHash.toLowerCase() ? "match" : "mismatch";
}
