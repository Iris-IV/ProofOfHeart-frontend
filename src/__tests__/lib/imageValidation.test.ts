import {
  IMAGE_SIZE_ERROR,
  MAX_IMAGE_SIZE,
  validateImageFile,
  validateImageSize,
} from "@/lib/imageValidation";

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
