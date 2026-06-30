import {
  validateStellarAddress,
  validateAmount,
  validateFundingGoal,
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
});
