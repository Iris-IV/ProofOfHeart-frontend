import { localizeContractError, parseContractError } from "../utils/contractErrors";

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

  it("falls back gracefully for unknown errors", () => {
    expect(parseContractError(new Error("Some unknown error string"))).toBe(
      "Some unknown error string",
    );
    expect(parseContractError("Just a string")).toBe("Just a string");
    expect(parseContractError({})).toBe("ContractErrors.UnexpectedError");
    expect(parseContractError(null)).toBe("ContractErrors.UnexpectedError");
  });
});

describe("localizeContractError", () => {
  const tContractErrors = (key: string) => `translated:${key}`;

  it("strips the ContractErrors. prefix before calling the scoped t function", () => {
    expect(localizeContractError("ContractErrors.NotAuthorized", tContractErrors)).toBe(
      "translated:NotAuthorized",
    );
  });

  it("leaves non-contract messages untouched", () => {
    const message = "Some human-readable error";
    expect(localizeContractError(message, tContractErrors)).toBe(message);
    expect(localizeContractError("", tContractErrors)).toBe("");
  });

  it("localizes any key, not just known ones", () => {
    expect(localizeContractError("ContractErrors.SomeNewError", tContractErrors)).toBe(
      "translated:SomeNewError",
    );
  });
});
