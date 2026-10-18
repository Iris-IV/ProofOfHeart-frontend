import {
  ALT_TEXT_MAX_LENGTH,
  ALT_TEXT_REQUIRED_ERROR,
  IMAGE_SIZE_ERROR,
  MAX_IMAGE_SIZE,
  validateAltText,
  validateImageFile,
  validateImageSize,
} from "@/lib/imageValidation";

function makeImageFile(name = "cover.png", type = "image/png", size = 512): File {
  const bytes = new Uint8Array(size).fill(1);
  return new File([bytes], name, { type });
}

describe("image upload size validation", () => {
  it("accepts an image just below 5MB", () => {
    expect(validateImageSize(MAX_IMAGE_SIZE - 1)).toEqual({ valid: true });
  });

  it("rejects an image at or above 5MB with actionable feedback", () => {
    expect(validateImageSize(MAX_IMAGE_SIZE)).toEqual({
      valid: false,
      error: IMAGE_SIZE_ERROR,
    });

    const oversized = new File([new Uint8Array(MAX_IMAGE_SIZE)], "large.png", {
      type: "image/png",
    });
    expect(validateImageFile(oversized)).toEqual({
      valid: false,
      error: "Image must be < 5MB",
    });
  });
});

describe("image alt text validation", () => {
  it("requires non-empty alt text", () => {
    expect(validateAltText("")).toEqual({
      valid: false,
      error: ALT_TEXT_REQUIRED_ERROR,
    });
    expect(validateAltText("   ")).toEqual({
      valid: false,
      error: ALT_TEXT_REQUIRED_ERROR,
    });
    expect(validateAltText(undefined)).toEqual({
      valid: false,
      error: ALT_TEXT_REQUIRED_ERROR,
    });
  });

  it("accepts descriptive alt text", () => {
    expect(validateAltText("A campaign cover showing a community garden")).toEqual({
      valid: true,
    });
  });

  it("rejects alt text longer than the maximum length", () => {
    const tooLong = "a".repeat(ALT_TEXT_MAX_LENGTH + 1);
    expect(validateAltText(tooLong)).toEqual({
      valid: false,
      error: `Alt text must be ${ALT_TEXT_MAX_LENGTH} characters or fewer`,
    });
  });

  it("validates alt text as part of image file validation", () => {
    const file = makeImageFile();
    expect(validateImageFile(file, "")).toEqual({
      valid: false,
      error: ALT_TEXT_REQUIRED_ERROR,
    });
    expect(validateImageFile(file, "A campaign cover")).toEqual({ valid: true });
  });
});
