/**
 * Image URL validation for user-provided campaign images.
 * Validates size, type, and allowed domains to prevent SSRF and abuse.
 */

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

// Upload service limit. Keep this check client-side and server-side so an
// oversized image receives immediate feedback and never fails silently.
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const IMAGE_SIZE_ERROR = "Image must be < 5MB";

// Minimum file size in bytes (100 bytes - prevents empty/tiny images)
const MIN_IMAGE_SIZE = 100;

// Alt text limits for accessibility on creator-uploaded media.
export const ALT_TEXT_MAX_LENGTH = 150;
export const ALT_TEXT_REQUIRED_ERROR = "Alt text is required for accessibility";

/**
 * Validates accessibility alt text for creator uploaded media.
 *
 * Blank (or whitespace-only) alt text is rejected so screen readers announce
 * something meaningful, and overly long alt text is rejected so it stays
 * readable.
 */
export function validateAltText(altText: string | null | undefined): ValidationResult {
  const trimmed = altText ? altText.trim() : "";

  if (!trimmed) {
    return { valid: false, error: ALT_TEXT_REQUIRED_ERROR };
  }

  if (trimmed.length > ALT_TEXT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Alt text must be ${ALT_TEXT_MAX_LENGTH} characters or fewer`,
    };
  }

  return { valid: true };
}

// Allowed domains for campaign images
const ALLOWED_DOMAINS = [
  "ipfs.io",
  "cloudflare-ipfs.com",
  "ipfs.dweb.link",
  "arweave.net",
  "raw.githubusercontent.com",
  "i.imgur.com",
  "images.unsplash.com",
] as const;

/**
 * Validates an image URL for allowed domain.
 */
export function validateImageDomain(url: string): { valid: boolean; error?: string } {
  try {
    const urlObj = new URL(url);

    // Inline payloads (data:/blob:) are never accepted for campaign covers
    if (urlObj.protocol === "data:" || urlObj.protocol === "blob:") {
      return { valid: false, error: "Data and blob URLs are not allowed" };
    }

    // Must be HTTPS
    if (urlObj.protocol !== "https:") {
      return { valid: false, error: "Image URL must use HTTPS" };
    }

    const hostname = urlObj.hostname.toLowerCase();

    // Check if hostname matches any allowed domain
    const isAllowed = ALLOWED_DOMAINS.some((allowed) => {
      if (allowed.startsWith("**.")) {
        // Wildcard subdomain pattern (e.g., **.ipfs.io)
        const baseDomain = allowed.slice(3);
        return hostname === baseDomain || hostname.endsWith("." + baseDomain);
      }
      return hostname === allowed;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Image domain not allowed. Allowed domains: ${ALLOWED_DOMAINS.join(", ")}`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid image URL format" };
  }
}

/**
 * Validates image file size (for server-side uploads).
 * For external URLs, this would require a HEAD request to check Content-Length.
 */
export function validateImageSize(size: number): { valid: boolean; error?: string } {
  if (size < MIN_IMAGE_SIZE) {
    return { valid: false, error: "Image is too small (minimum 100 bytes)" };
  }

  if (size >= MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: IMAGE_SIZE_ERROR,
    };
  }

  return { valid: true };
}

/**
 * Validates image MIME type.
 */
export function validateImageType(mimeType: string): { valid: boolean; error?: string } {
  const normalizedType = mimeType.toLowerCase();

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalizedType)) {
    return {
      valid: false,
      error: `Image type not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive image URL validation.
 * For external URLs, validates domain only.
 * For uploaded files, validates size and type.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageUrl(url: string): ValidationResult {
  const domainValidation = validateImageDomain(url);
  if (!domainValidation.valid) {
    return domainValidation;
  }

  return { valid: true };
}

/**
 * Validates an uploaded image file (size and type), plus alt text when the
 * caller supplies it.
 *
 * Callers that collect alt text separately (e.g. the creation form, which
 * validates it through `campaignValidation`) omit the second argument; callers
 * that receive both in one request (the upload API route) pass it so a missing
 * or blank alt text fails the same validation.
 */
export function validateImageFile(file: File, altText?: string): ValidationResult {
  // Validate size
  const sizeValidation = validateImageSize(file.size);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Validate type
  const typeValidation = validateImageType(file.type);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // Validate alt text when provided
  if (altText !== undefined) {
    return validateAltText(altText);
  }

  return { valid: true };
}

/**
 * Checks if a URL is from an allowed image domain.
 * Useful for client-side validation before submission.
 */
export function isAllowedImageDomain(url: string): boolean {
  return validateImageDomain(url).valid;
}
