import { StrKey } from "@stellar/stellar-sdk";
import {
  formatAddress,
  isContractAddress,
  isEd25519PublicKey,
  isValidStellarAddress,
} from "@/lib/formatAddress";

const VALID_G = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const VALID_C = StrKey.encodeContract(Buffer.alloc(32, 3));

describe("formatAddress", () => {
  it("truncates a long address to head...tail", () => {
    expect(formatAddress(VALID_G)).toBe(`${VALID_G.slice(0, 6)}...${VALID_G.slice(-4)}`);
  });

  it("returns short addresses unchanged and empty input as empty", () => {
    expect(formatAddress("GABC")).toBe("GABC");
    expect(formatAddress("")).toBe("");
  });
});

describe("Stellar address validation", () => {
  it("accepts a valid ed25519 public key", () => {
    expect(isEd25519PublicKey(VALID_G)).toBe(true);
    expect(isValidStellarAddress(VALID_G)).toBe(true);
  });

  it("accepts a valid contract address", () => {
    expect(isContractAddress(VALID_C)).toBe(true);
    expect(isValidStellarAddress(VALID_C)).toBe(true);
  });

  it("does not cross-accept account and contract kinds", () => {
    expect(isEd25519PublicKey(VALID_C)).toBe(false);
    expect(isContractAddress(VALID_G)).toBe(false);
  });

  it("rejects a checksum-corrupted address", () => {
    // Flip the final character so the StrKey checksum no longer matches.
    const corrupted = `${VALID_G.slice(0, -1)}${VALID_G.endsWith("A") ? "B" : "A"}`;
    expect(isEd25519PublicKey(corrupted)).toBe(false);
    expect(isValidStellarAddress(corrupted)).toBe(false);
  });

  it("rejects wrong-prefix and malformed input", () => {
    expect(isValidStellarAddress("not-an-address")).toBe(false);
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress("G".repeat(56))).toBe(false);
  });
});
