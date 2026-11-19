import { StrKey } from "@stellar/stellar-sdk";
import {
  validateStellarAddress,
  isValidStellarPublicKey,
  validateAmount,
  validateFundingGoal,
  fundingGoalBoundsError,
  formatGoalStroops,
  validateDuration,
  validateRevenueShare,
  validateContributorNotCreator,
} from "../../utils/validators";
import { ContractError, ContractErrorException } from "../../utils/contractErrors";

describe("Validators", () => {
  it("validateStellarAddress", () => {
    expect(() => validateStellarAddress("")).toThrow(
      new ContractErrorException(ContractError.ValidationFailed),
    );
    expect(() => validateStellarAddress("GABC")).toThrow(
      new ContractErrorException(ContractError.ValidationFailed),
    );
    expect(() => validateStellarAddress("G" + "A".repeat(55))).not.toThrow();
  });

  it("isValidStellarPublicKey", () => {
    const valid = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
    expect(isValidStellarPublicKey(valid)).toBe(true);
    // Tolerates surrounding whitespace from copy/paste.
    expect(isValidStellarPublicKey(`  ${valid}  `)).toBe(true);

    // Wrong prefix, too short, bad checksum, and empty all fail.
    expect(isValidStellarPublicKey("")).toBe(false);
    expect(isValidStellarPublicKey("GABC")).toBe(false);
    expect(isValidStellarPublicKey("G" + "A".repeat(55))).toBe(false);
    expect(isValidStellarPublicKey("MNOTAVALIDADDRESS")).toBe(false);
  });

  it("validateAmount", () => {
    expect(() => validateAmount(0)).toThrow(
      new ContractErrorException(ContractError.ContributionMustBePositive),
    );
    expect(() => validateAmount(-10)).toThrow(
      new ContractErrorException(ContractError.ContributionMustBePositive),
    );
    expect(() => validateAmount(100)).not.toThrow();
  });

  it("validateFundingGoal", () => {
    expect(() => validateFundingGoal(0)).toThrow(
      new ContractErrorException(ContractError.FundingGoalMustBePositive),
    );
    expect(() => validateFundingGoal(-10)).toThrow(
      new ContractErrorException(ContractError.FundingGoalMustBePositive),
    );
    expect(() => validateFundingGoal(1000)).not.toThrow();
  });

  it("validateDuration", () => {
    expect(() => validateDuration(0)).toThrow(
      new ContractErrorException(ContractError.InvalidDuration),
    );
    expect(() => validateDuration(366)).toThrow(
      new ContractErrorException(ContractError.InvalidDuration),
    );
    expect(() => validateDuration(30)).not.toThrow();
  });

  it("validateRevenueShare", () => {
    expect(() => validateRevenueShare(0)).toThrow(
      new ContractErrorException(ContractError.InvalidRevenueShare),
    );
    expect(() => validateRevenueShare(5001)).toThrow(
      new ContractErrorException(ContractError.InvalidRevenueShare),
    );
    expect(() => validateRevenueShare(500)).not.toThrow();
  });

  it("validateContributorNotCreator", () => {
    const creator = "G123";
    expect(() => validateContributorNotCreator(creator, creator)).toThrow(
      new ContractErrorException(ContractError.NotAuthorized),
    );
    expect(() => validateContributorNotCreator("G456", creator)).not.toThrow();
  }); 
  it("rejects goals outside admin-adjusted limits in exact stroops (#1759)", () => {
    const limits = { min: 200_000n, max: 1_500_000_000n };
    expect(fundingGoalBoundsError(199_999n, limits)).toContain("0.02");
    expect(fundingGoalBoundsError(1_500_000_001n, limits)).toContain("150");
    expect(fundingGoalBoundsError(200_000n, limits)).toBeNull();
    expect(fundingGoalBoundsError(1_500_000_000n, limits)).toBeNull();
    expect(() => validateFundingGoal(199_999n, limits)).toThrow(/between 0.02 and 150 XLM/);
    expect(() => validateFundingGoal(200_000n, limits)).not.toThrow();
    expect(() => validateFundingGoal(Number.NaN)).toThrow();
    expect(formatGoalStroops(100_001n)).toBe("0.0100001");
  });

});
