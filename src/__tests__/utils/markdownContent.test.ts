import { isBlankMarkdown } from "@/utils/markdownContent";

/** #655 — empty campaign descriptions must be detected so a fallback can show. */
describe("isBlankMarkdown", () => {
  it("treats null and undefined as blank", () => {
    expect(isBlankMarkdown(null)).toBe(true);
    expect(isBlankMarkdown(undefined)).toBe(true);
  });

  it("treats an empty or whitespace-only string as blank", () => {
    expect(isBlankMarkdown("")).toBe(true);
    expect(isBlankMarkdown("   \n\t  ")).toBe(true);
  });

  it("treats markdown with only syntax characters as blank", () => {
    expect(isBlankMarkdown("###")).toBe(true);
    expect(isBlankMarkdown("**  **")).toBe(true);
    expect(isBlankMarkdown("- \n- \n")).toBe(true);
    expect(isBlankMarkdown("<!-- hidden note -->")).toBe(true);
  });

  it("treats real content as non-blank", () => {
    expect(isBlankMarkdown("Hello world")).toBe(false);
    expect(isBlankMarkdown("# Heading\n\nSome text.")).toBe(false);
    expect(isBlankMarkdown("A")).toBe(false);
  });
});
