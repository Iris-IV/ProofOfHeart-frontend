/**
 * #1617 / #1631 — the changeset validator.
 *
 * These are the highest-value tests of the script because the two failure modes
 * it guards against are both silent: a malformed changeset that only surfaces
 * when `changeset status` runs in `release.yml` (minutes later, on `main`), and
 * a well-formed changeset for a `private: true` package that changesets
 * discards at release time, producing an empty changelog.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- plain-JS build script, no type declarations to import
import {
  collectChangesetIssues,
  parseChangeset,
  readPackageIdentity,
  validateChangesetConfig,
  validateChangesetFile,
} from "../../../scripts/validate-changesets.mjs";

const PACKAGE_NAME = "proofofheart-frontend";

/** Build a throwaway repo with a `.changeset` directory. */
function makeRepo(
  options: {
    config?: Record<string, unknown> | string;
    changesets?: Record<string, string>;
    packageName?: string | null;
  } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "changeset-repo-"));
  mkdirSync(join(root, ".changeset"));

  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      options.packageName === null
        ? {}
        : { name: options.packageName ?? PACKAGE_NAME, version: "0.1.0" },
      null,
      2,
    ),
  );

  const validConfig = {
    $schema: "https://unpkg.com/@changesets/config@3.1.4/schema.json",
    changelog: "@changesets/cli/changelog",
    commit: false,
    access: "public",
    baseBranch: "main",
    updateInternalDependencies: "patch",
    ignore: [],
    privatePackages: { version: true, tag: false },
  };
  const config =
    typeof options.config === "string"
      ? options.config
      : JSON.stringify({ ...validConfig, ...(options.config ?? {}) }, null, 2);
  writeFileSync(join(root, ".changeset", "config.json"), config);

  for (const [name, content] of Object.entries(options.changesets ?? {})) {
    writeFileSync(join(root, ".changeset", name), content);
  }

  return root;
}

/** A changeset file with the given summary. */
function changeset(summary: string, bump = "patch", name = PACKAGE_NAME): string {
  return `---\n"${name}": ${bump}\n---\n\n${summary}\n`;
}

describe("parseChangeset", () => {
  it("splits frontmatter from the summary", () => {
    const parsed = parseChangeset(changeset("Add a health check endpoint."));

    expect(parsed).toEqual({
      ok: true,
      releases: [[PACKAGE_NAME, "patch"]],
      summary: "Add a health check endpoint.",
    });
  });

  it("accepts a major and minor bump", () => {
    expect(parseChangeset(changeset("Break the API.", "major")).ok).toBe(true);
    expect(parseChangeset(changeset("Add a feature.", "minor")).ok).toBe(true);
  });

  it("tolerates CRLF line endings", () => {
    const parsed = parseChangeset('---\r\n"pkg": patch\r\n---\r\n\r\nFix a thing.\r\n');

    expect(parsed).toMatchObject({ ok: true, summary: "Fix a thing." });
  });

  it("tolerates a byte-order mark", () => {
    const parsed = parseChangeset('﻿---\n"pkg": patch\n---\n\nFix a thing.\n');

    expect(parsed).toMatchObject({ ok: true });
  });

  it("accepts a multi-line summary", () => {
    const parsed = parseChangeset('---\n"pkg": patch\n---\n\nFix a thing.\n\nAnd another.\n');

    expect(parsed).toMatchObject({ summary: "Fix a thing.\n\nAnd another." });
  });

  it("rejects a file with no frontmatter", () => {
    expect(parseChangeset("Just a summary.\n")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("must start with a `---` frontmatter fence"),
    });
  });

  it("rejects unterminated frontmatter", () => {
    expect(parseChangeset('---\n"pkg": patch\n')).toMatchObject({
      ok: false,
      reason: expect.stringContaining("not closed"),
    });
  });

  it("rejects frontmatter with no release", () => {
    expect(parseChangeset("---\n---\n\nFix a thing.\n")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("declares no release"),
    });
  });

  it("rejects a frontmatter line that is not a package/bump pair", () => {
    expect(parseChangeset("---\nthis is not yaml\n---\n\nFix.\n")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("is not a"),
    });
  });

  it("rejects the same package listed twice", () => {
    expect(
      parseChangeset(`---\n"${PACKAGE_NAME}": patch\n"${PACKAGE_NAME}": minor\n---\n\nFix.\n`),
    ).toMatchObject({ ok: false, reason: expect.stringContaining("more than once") });
  });
});

describe("validateChangesetFile", () => {
  it("accepts a well-formed changeset", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("Add a health check endpoint."),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toEqual([]);
  });

  it("rejects a release for a package this repo does not version", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("Add something.", "patch", "some-other-package"),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('declares a release for "some-other-package"');
  });

  it("rejects an unrecognised bump type", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("Add something.", "huge"),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('declares bump type "huge"');
  });

  it("rejects a changeset with no summary", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: `---\n"${PACKAGE_NAME}": patch\n---\n\n`,
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("has no summary");
  });

  it("rejects an over-long summary", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("x".repeat(201)),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("201 characters");
  });

  it("warns about a summary that says nothing", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("fix"),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("does not warn about a summary that starts with the same word", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: changeset("Fix the vote tally rounding."),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toEqual([]);
  });

  it("warns about an unconventional filename", () => {
    const issues = validateChangesetFile({
      file: ".changeset/Some Changes!.md",
      content: changeset("Add something."),
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("stops at the first structural problem", () => {
    const issues = validateChangesetFile({
      file: ".changeset/brave-lions-dance.md",
      content: "no frontmatter here",
      packageName: PACKAGE_NAME,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });
});

describe("validateChangesetConfig", () => {
  it("accepts the repository configuration", () => {
    const root = makeRepo();

    expect(validateChangesetConfig(root, { packageName: PACKAGE_NAME })).toEqual([]);
  });

  it("rejects a config that does not version private packages", () => {
    const root = makeRepo({ config: { privatePackages: undefined } });

    const issues = validateChangesetConfig(root, { packageName: PACKAGE_NAME });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"privatePackages": { "version": true }');
  });

  it("rejects a config that ignores the package", () => {
    const root = makeRepo({ config: { ignore: [PACKAGE_NAME] } });

    const issues = validateChangesetConfig(root, { packageName: PACKAGE_NAME });

    expect(
      issues.some((issue) => issue.severity === "warning" && issue.message.includes('"ignore"')),
    ).toBe(true);
  });

  it("rejects the wrong base branch", () => {
    const root = makeRepo({ config: { baseBranch: "master" } });

    const issues = validateChangesetConfig(root, { packageName: PACKAGE_NAME });

    expect(issues.some((issue) => issue.message.includes('"baseBranch"'))).toBe(true);
  });

  it("rejects restricted access", () => {
    const root = makeRepo({ config: { access: "restricted" } });

    const issues = validateChangesetConfig(root, { packageName: PACKAGE_NAME });

    expect(issues.some((issue) => issue.message.includes('"access"'))).toBe(true);
  });

  it("reports unparseable JSON instead of throwing", () => {
    const root = makeRepo({ config: "{ not json" });

    const issues = validateChangesetConfig(root, { packageName: PACKAGE_NAME });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("could not be parsed");
  });
});

describe("collectChangesetIssues", () => {
  it("finds nothing to complain about in a clean repository", () => {
    const root = makeRepo({
      changesets: { "brave-lions-dance.md": changeset("Add a health check.") },
    });

    const report = collectChangesetIssues({ root });

    expect(report.issues).toEqual([]);
    expect(report.changesetFiles).toEqual([".changeset/brave-lions-dance.md"]);
    expect(report.packageName).toBe(PACKAGE_NAME);
  });

  it("ignores README.md", () => {
    const root = makeRepo({
      changesets: { "brave-lions-dance.md": changeset("Add a health check.") },
    });
    writeFileSync(join(root, ".changeset", "README.md"), "# Changesets\nnot a changeset");

    expect(collectChangesetIssues({ root }).changesetFiles).toHaveLength(1);
  });

  it("reports a package.json with no name", () => {
    const root = makeRepo({ packageName: null });

    const report = collectChangesetIssues({ root });

    expect(report.issues.some((issue) => issue.file === "package.json")).toBe(true);
  });

  it("warns about two changesets with the same summary", () => {
    const root = makeRepo({
      changesets: {
        "brave-lions-dance.md": changeset("Add a health check."),
        "quiet-moons-shave.md": changeset("Add a health check."),
      },
    });

    const report = collectChangesetIssues({ root });

    expect(report.issues.some((issue) => issue.message.includes("duplicates the summary"))).toBe(
      true,
    );
  });

  it("only inspects the changesets a branch adds", () => {
    const root = makeRepo({
      changesets: {
        "brave-lions-dance.md": changeset("Add a health check."),
        "broken-one.md": "not a changeset",
      },
    });

    const report = collectChangesetIssues({
      root,
      files: [".changeset/brave-lions-dance.md"],
    });

    expect(report.changesetFiles).toEqual([".changeset/brave-lions-dance.md"]);
    expect(report.issues).toEqual([]);
  });

  it("still validates the config on a branch-scoped run", () => {
    const root = makeRepo({
      config: { privatePackages: undefined },
      changesets: { "brave-lions-dance.md": changeset("Add a health check.") },
    });

    const report = collectChangesetIssues({ root, files: [".changeset/brave-lions-dance.md"] });

    expect(report.issues.some((issue) => issue.file === ".changeset/config.json")).toBe(true);
  });

  it("reports a missing .changeset directory", () => {
    const root = mkdtempSync(join(tmpdir(), "changeset-empty-"));

    const report = collectChangesetIssues({ root });

    expect(report.issues.some((issue) => issue.message.includes("directory is missing"))).toBe(
      true,
    );
  });
});

describe("readPackageIdentity", () => {
  it("reads the name and version", () => {
    const root = makeRepo();

    expect(readPackageIdentity(root)).toEqual({ name: PACKAGE_NAME, version: "0.1.0" });
  });

  it("returns nulls for an unreadable manifest", () => {
    expect(readPackageIdentity(join(tmpdir(), "definitely-not-a-repo-here"))).toEqual({
      name: null,
      version: null,
    });
  });
});

describe("this repository", () => {
  // The regression these tests exist for: `private: true` plus no
  // `privatePackages.version` means changesets are accepted and then dropped.
  const root = join(__dirname, "..", "..", "..");

  it("versions its private package", () => {
    expect(validateChangesetConfig(root)).toEqual([]);
  });

  it("is named the same in package.json as in the config", () => {
    expect(readPackageIdentity(root).name).toBe(PACKAGE_NAME);
  });
});
