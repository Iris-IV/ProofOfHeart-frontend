export const IPFS_GATEWAY_BASE = "https://ipfs.io/ipfs";

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export function buildIpfsGatewayUrl(cid: string): string {
  return `${IPFS_GATEWAY_BASE}/${cid}`;
}

/**
 * Pins an image blob to IPFS via Pinata and returns a public gateway URL.
 */
export async function pinImageToIpfs(file: Blob, filename: string): Promise<string> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new Error("Image upload is not configured");
  }

  const formData = new FormData();
  formData.append("file", file, filename);

  const response = await fetch(PINATA_PIN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to pin image to IPFS");
  }

  const data = (await response.json()) as { IpfsHash?: string };
  const cid = data.IpfsHash;
  if (!cid || typeof cid !== "string") {
    throw new Error("Invalid IPFS response");
  }

  return buildIpfsGatewayUrl(cid);
}
