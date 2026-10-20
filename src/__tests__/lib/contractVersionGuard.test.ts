import {
  checkContractVersion,
  getContractVersionWarning,
} from "@/lib/contractVersionGuard";

describe("getContractVersionWarning", () => {
  it("returns null when the live hash matches", () => {
    expect(
      getContractVersionWarning({ mismatch: false, expectedHash: "abc", liveHash: "abc" }),
    ).toBeNull();
  });

  it("returns a refresh prompt when there is a mismatch", () => {
    const warning = getContractVersionWarning({
      mismatch: true,
      expectedHash: "abc",
      liveHash: "def",
    });
    expect(warning).toMatch(/refresh/i);
  });
});

describe("checkContractVersion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete process.env.NEXT_PUBLIC_CONTRACT_WASM_HASH;
  });

  it("does not flag a mismatch on the first observed hash", () => {
    const check = checkContractVersion("hash-1");
    expect(check.mismatch).toBe(false);
  });

  it("flags a mismatch when the live hash changes from the cached one", () => {
    checkContractVersion("hash-1");
    const check = checkContractVersion("hash-2");
    expect(check.mismatch).toBe(true);
    expect(check.liveHash).toBe("hash-2");
  });
});
