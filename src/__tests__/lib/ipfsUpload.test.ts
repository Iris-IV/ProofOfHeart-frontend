/**
 * @jest-environment node
 */

import { buildIpfsGatewayUrl, pinImageToIpfs } from "@/lib/ipfsUpload";

const originalFetch = global.fetch;

describe("ipfsUpload", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.PINATA_JWT;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("buildIpfsGatewayUrl returns ipfs.io gateway URL", () => {
    expect(buildIpfsGatewayUrl("QmExampleHash")).toBe("https://ipfs.io/ipfs/QmExampleHash");
  });

  it("throws when PINATA_JWT is not configured", async () => {
    await expect(pinImageToIpfs(new Blob(["x"]), "cover.png")).rejects.toThrow(
      "Image upload is not configured",
    );
  });

  it("pins a file and returns the gateway URL", async () => {
    process.env.PINATA_JWT = "test-jwt";

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ IpfsHash: "QmPinnedHash" }),
    }) as typeof fetch;

    const url = await pinImageToIpfs(new Blob(["image-bytes"], { type: "image/png" }), "cover.png");

    expect(url).toBe("https://ipfs.io/ipfs/QmPinnedHash");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer test-jwt" },
      }),
    );
  });

  it("throws when Pinata responds with an error", async () => {
    process.env.PINATA_JWT = "test-jwt";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as typeof fetch;

    await expect(pinImageToIpfs(new Blob(["x"]), "cover.png")).rejects.toThrow(
      "Failed to pin image to IPFS",
    );
  });
});
