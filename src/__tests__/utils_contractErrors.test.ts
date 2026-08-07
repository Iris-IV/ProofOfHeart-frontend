import { parseContractError } from "../utils/contractErrors";

describe("parseContractError", () => {
  it("handles Error(Contract, #n) format for base error codes", () => {
    expect(parseContractError(new Error("Error(Contract, #1)"))).toBe(
      "ContractErrors.NotAuthorized",
    );
    expect(parseContractError(new Error("Something failed: Error(Contract, #19)"))).toBe(
      "ContractErrors.VotingThresholdNotMet",
    );
  });

  it("handles Error(Contract, #n) format for extended error codes 20-41", () => {
    expect(parseContractError(new Error("Error(Contract, #24)"))).toBe(
      "ContractErrors.ContractPaused",
    );
    expect(parseContractError(new Error("Error(Contract, #25)"))).toBe(
      "ContractErrors.ContributionCapExceeded",
    );
    expect(parseContractError(new Error("Error(Contract, #26)"))).toBe(
      "ContractErrors.CampaignNotVerified",
    );
    expect(parseContractError(new Error("Error(Contract, #30)"))).toBe(
      "ContractErrors.Overflow",
    );
    expect(parseContractError(new Error("Error(Contract, #32)"))).toBe(
      "ContractErrors.CreationDisabled",
    );
    expect(parseContractError(new Error("Error(Contract, #41)"))).toBe(
      "ContractErrors.InvalidVestingDelay",
    );
  });

  it("handles string errors", () => {
    expect(parseContractError("Error(Contract, #15)")).toBe("ContractErrors.ValidationFailed");
    expect(parseContractError("contract error 12")).toBe("ContractErrors.FundingGoalNotReached");
    expect(parseContractError("contract error 27")).toBe("ContractErrors.MultiSigSignerNotFound");
  });

  it("handles RPC object errors", () => {
    expect(parseContractError({ message: "HostError: Error(Contract, #3)" })).toBe(
      "ContractErrors.CampaignNotActive",
    );
    expect(parseContractError({ error: { message: "contractError: 4" } })).toBe(
      "ContractErrors.FundingGoalMustBePositive",
    );
    expect(parseContractError({ message: "HostError: Error(Contract, #38)" })).toBe(
      "ContractErrors.InsufficientSignatures",
    );
  });

  it("falls back gracefully for unknown errors", () => {
    expect(parseContractError(new Error("Some unknown error string"))).toBe(
      "Some unknown error string",
    );
    expect(parseContractError("Just a string")).toBe("Just a string");
    expect(parseContractError({})).toBe("ContractErrors.UnexpectedError");
    expect(parseContractError(null)).toBe("ContractErrors.UnexpectedError");
  });
});
