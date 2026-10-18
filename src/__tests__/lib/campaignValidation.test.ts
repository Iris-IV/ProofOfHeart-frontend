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

  it("accepts emoji-rich titles within the character limit", () => {
    const title = "🌍 Community Repair Initiative 🚜";
    const errors = validateForm(
      title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );

    expect(errors.title).toBeUndefined();
  });

  it("rejects titles longer than 100 characters even when they contain emoji", () => {
    const title = "🚀".repeat(51) + " A very long community campaign title that exceeds the limit";
    const errors = validateForm(
      title,
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

  it("accepts a funding goal just above zero", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      "0.01",
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );

    expect(errors.fundingGoal).toBeUndefined();
  });

  it("rejects zero funding goal values such as 0.00", () => {
    const errors = validateForm(
      valid.title,
      valid.description,
      valid.descriptionEs,
      valid.creatorEmail,
      "0.00",
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );

    expect(errors.fundingGoal).toBe("validationFundingGoalInvalid");
  });

  it("accepts long text with emoji content under the description limit", () => {
    const description = `🌱 ${"A".repeat(500)} community action plan to improve local infrastructure and support education access across our neighborhood.`;
    const errors = validateForm(
      valid.title,
      description,
      valid.descriptionEs,
      valid.creatorEmail,
      valid.fundingGoal,
      valid.durationDays,
      valid.hasRevenueSharing,
      valid.revenueSharePercentage,
      valid.coverImageUrl,
    );

    expect(errors.description).toBeUndefined();
  });

  it("rejects description content above 1000 characters even with emoji formatting", () => {
    const description = "🌍 " + "a".repeat(1001);
    const errors = validateForm(
      valid.title,
      description,
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

  it("accepts valid https cover image URL with valid alt text", () => {
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
      "A clean solar panel installation in rural community",
    );
    expect(errors.coverImageUrl).toBeUndefined();
    expect(errors.coverImageAltText).toBeUndefined();
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
      "Valid alt text description",
    );
    expect(errors.coverImageUrl).toBe("validationCoverImageInvalid");
  });

  describe("Alt text validation for creator uploaded media", () => {
    it("requires alt text when cover image URL is present", () => {
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
        "",
      );
      expect(errors.coverImageAltText).toBe("validationAltTextRequired");
    });

    it("rejects alt text that is too short (< 5 chars)", () => {
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
        "cat",
      );
      expect(errors.coverImageAltText).toBe("validationAltTextTooShort");
    });

    it("rejects generic alt text terms like 'image', 'photo', 'picture'", () => {
      const genericTerms = ["image", "photo", "picture", "cover", "img", "IMG_1234"];
      for (const term of genericTerms) {
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
          term,
        );
        expect(errors.coverImageAltText).toBe("validationAltTextGeneric");
      }
    });

    it("rejects alt text longer than 150 characters", () => {
      const longAlt = "a".repeat(151);
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
        longAlt,
      );
      expect(errors.coverImageAltText).toBe("validationAltTextTooLong");
    });
  });
});
