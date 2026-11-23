import { compareProofHash, ipfsEvidenceUrl, parseIpfsReference, sha256Hex } from "./proofOfImpact";

const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

describe("proofOfImpact helpers", () => {
  it("hashes bytes to lowercase SHA-256 hex", async () => {
    const hash = await sha256Hex(new TextEncoder().encode("abc"));
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("parses raw CIDs, ipfs:// and gateway links", () => {
    expect(parseIpfsReference(CID)).toBe(CID);
    expect(parseIpfsReference(`ipfs://${CID}`)).toBe(CID);
    expect(parseIpfsReference(`https://ipfs.io/ipfs/${CID}`)).toBe(CID);
    expect(parseIpfsReference("not a cid")).toBeNull();
    expect(parseIpfsReference("")).toBeNull();
  });

  it("builds a gateway URL only for valid references", () => {
    expect(ipfsEvidenceUrl(CID)).toBe(`https://ipfs.io/ipfs/${CID}`);
    expect(ipfsEvidenceUrl("javascript:alert(1)")).toBeNull();
  });

  it("compares hashes case-insensitively", () => {
    expect(compareProofHash("AB".repeat(32), "ab".repeat(32))).toBe("match");
    expect(compareProofHash("ab".repeat(32), "cd".repeat(32))).toBe("mismatch");
  });
});
