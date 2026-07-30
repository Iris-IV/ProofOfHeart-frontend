import { validateForm } from "@/lib/campaignValidation";

describe("validateForm", () => {
  const valid = {
    title: "Test Campaign",
    description: "A test campaign description",
    descriptionEs: "",
    creatorEmail: "",
    fundingGoal: "100",
    durationDays: "30",
    hasRevenueSharing: false,
    revenueSharePercentage: 5,
    coverImageUrl: "",
  };

  it("returns no errors for valid input", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("requires title", () => {
    const errors = validateForm(
      "  ",
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.title).toBe("validationTitleRequired");
  });

  it("rejects title over 100 chars", () => {
    const errors = validateForm(
      "a".repeat(101),
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.title).toBe("validationTitleTooLong");
  });

  it("requires description", () => {
    const errors = validateForm(
      valid.title,
      "  ",
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.description).toBe("validationDescriptionRequired");
  });

  it("rejects description over 1000 chars", () => {
    const errors = validateForm(
      valid.title,
      "b".repeat(1001),
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.description).toBe("validationDescriptionTooLong");
  });

  it("rejects Spanish description over 1000 chars", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      "c".repeat(1001),
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.descriptionEs).toBe("validationDescriptionEsTooLong");
  });

  it("rejects invalid creator email", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      "not-an-email",
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.creatorEmail).toBe("validationCreatorEmailInvalid");
  });

  it("accepts empty creator email", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      "",
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.creatorEmail).toBeUndefined();
  });

  it("accepts valid creator email", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      "test@example.com",
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.creatorEmail).toBeUndefined();
  });

  it("rejects invalid funding goal (zero)", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      "0",
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.fundingGoal).toBe("validationFundingGoalInvalid");
  });

  it("rejects negative funding goal", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      "-5",
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.fundingGoal).toBe("validationFundingGoalInvalid");
  });

  it("rejects empty funding goal", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      "",
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.fundingGoal).toBe("validationFundingGoalInvalid");
  });

  it("rejects duration below 1 day", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      "0",
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.durationDays).toBe("validationDurationInvalid");
  });

  it("rejects duration above 365 days", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      "366",
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );
    expect(errors.durationDays).toBe("validationDurationInvalid");
  });

  it("rejects revenue share below 0.01% when enabled", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      true,
      0,
      valid.coverImageUrl,
    );
    expect(errors.revenueSharePercentage).toBe("validationRevenueShareInvalid");
  });

  it("rejects revenue share above 50% when enabled", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      true,
      51,
      valid.coverImageUrl,
    );
    expect(errors.revenueSharePercentage).toBe("validationRevenueShareInvalid");
  });

  it("allows any revenue share when not enabled", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      false,
      100,
      valid.coverImageUrl,
    );
    expect(errors.revenueSharePercentage).toBeUndefined();
  });

  it("rejects invalid cover image URL", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      "not-a-url",
    );
    expect(errors.coverImageUrl).toBe("validationCoverImageInvalid");
  });

  it("accepts valid https cover image URL", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      "https://example.com/image.jpg",
    );
    expect(errors.coverImageUrl).toBeUndefined();
  });

  it("rejects non-http protocol for cover image", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      "ftp://example.com/image.jpg",
    );
    expect(errors.coverImageUrl).toBe("validationCoverImageInvalid");
  });
});
