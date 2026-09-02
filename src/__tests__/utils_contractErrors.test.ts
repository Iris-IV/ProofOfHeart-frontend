import { normalizeContractError, parseContractError } from "../utils/contractErrors";

describe("parseContractError", () => {
  it("handles Error(Contract, #n) format", () => {
    expect(parseContractError(new Error("Error(Contract, #1)"))).toBe(
      "ContractErrors.NotAuthorized",
    );
    expect(parseContractError(new Error("Something failed: Error(Contract, #19)"))).toBe(
      "ContractErrors.VotingThresholdNotMet",
    );
  });

  it("handles string errors", () => {
    expect(parseContractError("Error(Contract, #15)")).toBe("ContractErrors.ValidationFailed");
    expect(parseContractError("contract error 12")).toBe("ContractErrors.FundingGoalNotReached");
  });

  it("handles RPC object errors", () => {
    expect(parseContractError({ message: "HostError: Error(Contract, #3)" })).toBe(
      "ContractErrors.CampaignNotActive",
    );
    expect(parseContractError({ error: { message: "contractError: 4" } })).toBe(
      "ContractErrors.FundingGoalMustBePositive",
    );
  });

  it("extracts revert details from nested RPC response shapes", () => {
    expect(
      parseContractError({ errorResult: { message: "HostError: Error(Contract, #29)" } }),
    ).toBe("ContractErrors.InsufficientBalance");
  });

  it("normalizes common balance and authorization reverts", () => {
    expect(parseContractError(normalizeContractError({ error: "tx_insufficient_balance" }))).toBe(
      "ContractErrors.InsufficientBalance",
    );
    expect(parseContractError(normalizeContractError({ result: "tx_bad_auth" }))).toBe(
      "ContractErrors.NotAuthorized",
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
