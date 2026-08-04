import {
  isUserRejection,
  isExtensionNotInstalled,
  parseFreighterError,
  wrapFreighterError,
  UserCancelledError,
  FreighterExtensionNotInstalledError,
  USER_CANCELLED_MESSAGE,
  FREIGHTER_NOT_INSTALLED_MESSAGE,
  GENERIC_FREIGHTER_ERROR_MESSAGE,
} from "@/utils/freighterErrors";

describe("freighterErrors", () => {
  describe("isUserRejection", () => {
    it("detects user-rejected signature errors across common formats", () => {
      expect(isUserRejection(new Error("User declined the request"))).toBe(true);
      expect(isUserRejection("User rejected the transaction")).toBe(true);
      expect(isUserRejection({ message: "Request cancelled by user" })).toBe(true);
      expect(isUserRejection({ error: { message: "denied by user" } })).toBe(true);
      expect(isUserRejection("User canceled")).toBe(true);
    });

    it("returns false for unrelated errors and non-errors", () => {
      expect(isUserRejection(new Error("Network error"))).toBe(false);
      expect(isUserRejection("Freighter is not installed")).toBe(false);
      expect(isUserRejection(null)).toBe(false);
      expect(isUserRejection(undefined)).toBe(false);
      expect(isUserRejection({})).toBe(false);
    });
  });

  describe("isExtensionNotInstalled", () => {
    it("detects extension-not-installed errors across common formats", () => {
      expect(isExtensionNotInstalled(new Error("Freighter is not installed"))).toBe(true);
      expect(isExtensionNotInstalled("window.freighter is not defined")).toBe(true);
      expect(isExtensionNotInstalled({ message: "No Freighter extension detected" })).toBe(true);
    });

    it("does not misclassify unrelated errors", () => {
      expect(isExtensionNotInstalled(new Error("User rejected the request"))).toBe(false);
      expect(isExtensionNotInstalled("Request timed out")).toBe(false);
    });
  });

  describe("parseFreighterError", () => {
    it("maps a user rejection to the cancellation message", () => {
      expect(parseFreighterError(new Error("User declined the request"))).toBe(
        USER_CANCELLED_MESSAGE,
      );
    });

    it("maps a missing extension to the install message", () => {
      expect(parseFreighterError("Freighter is not installed")).toBe(
        FREIGHTER_NOT_INSTALLED_MESSAGE,
      );
    });

    it("returns the raw message for readable unrecognized errors", () => {
      expect(parseFreighterError(new Error("RPC unavailable"))).toBe("RPC unavailable");
      expect(parseFreighterError("Something went wrong")).toBe("Something went wrong");
    });

    it("falls back to a generic message for unrecognized error objects instead of crashing", () => {
      expect(parseFreighterError({})).toBe(GENERIC_FREIGHTER_ERROR_MESSAGE);
      expect(parseFreighterError({ code: 4001 })).toBe(GENERIC_FREIGHTER_ERROR_MESSAGE);
      expect(parseFreighterError({ message: 42 })).toBe(GENERIC_FREIGHTER_ERROR_MESSAGE);
      expect(parseFreighterError(null)).toBe(GENERIC_FREIGHTER_ERROR_MESSAGE);
      expect(parseFreighterError(undefined)).toBe(GENERIC_FREIGHTER_ERROR_MESSAGE);
    });
  });

  describe("wrapFreighterError", () => {
    it("throws UserCancelledError for a user rejection", () => {
      expect(() => wrapFreighterError(new Error("User rejected the request"))).toThrow(
        UserCancelledError,
      );
      expect(() => wrapFreighterError("Request cancelled")).toThrow(UserCancelledError);
    });

    it("throws FreighterExtensionNotInstalledError when the extension is missing", () => {
      expect(() => wrapFreighterError("Freighter is not installed")).toThrow(
        FreighterExtensionNotInstalledError,
      );
    });

    it("re-throws the original unrecognized error unchanged", () => {
      const original = new Error("RPC unavailable");
      expect(() => wrapFreighterError(original)).toThrow(original);
      expect(() => wrapFreighterError(original)).toThrow("RPC unavailable");
    });
  });
});
