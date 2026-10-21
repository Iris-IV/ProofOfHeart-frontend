import { UNKNOWN_NETWORK_LABEL, describeNetwork, getNetworkLabel } from "@/lib/networkLabels";

const MAINNET = "Public Global Stellar Network ; September 2015";
const TESTNET = "Test SDF Network ; September 2015";
const FUTURENET = "Test SDF Future Network ; October 2022";

describe("getNetworkLabel", () => {
  it("names each known passphrase", () => {
    expect(getNetworkLabel(MAINNET)).toBe("Mainnet");
    expect(getNetworkLabel(TESTNET)).toBe("Testnet");
    expect(getNetworkLabel(FUTURENET)).toBe("Futurenet");
  });

  it("does not confuse Futurenet with Testnet even though both contain 'Test SDF'", () => {
    expect(getNetworkLabel(FUTURENET)).not.toBe("Testnet");
  });

  it("returns null for empty, missing, or unknown passphrases", () => {
    expect(getNetworkLabel("")).toBeNull();
    expect(getNetworkLabel(undefined)).toBeNull();
    expect(getNetworkLabel(null)).toBeNull();
    expect(getNetworkLabel("Some Private Network ; 2024")).toBeNull();
  });
});

describe("describeNetwork", () => {
  it("returns the network name for a known passphrase", () => {
    expect(describeNetwork(FUTURENET)).toBe("Futurenet");
  });

  it("falls back to a generic phrase when the passphrase is not recognised", () => {
    expect(describeNetwork("")).toBe(UNKNOWN_NETWORK_LABEL);
    expect(describeNetwork("Some Private Network ; 2024")).toBe("the app network");
  });
});
