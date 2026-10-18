#!/usr/bin/env node
/**
 * #1617 / #1631 — validate `.changeset` entries without installing anything.
 *
 * `changeset status` is the authoritative check, but it needs `node_modules`, so
 * it cannot be the first line of defence: by the time CI has installed, the
 * feedback is already minutes old. This script is deliberately dependency-free
 * and runs in well under a second on a bare Node runtime, so it can gate every
 * pull request without adding to the install-and-build time that dominates the
 * CI budget.
 *
 * It checks two things:
 *
 * 1. `.changeset/config.json` — that the repo is actually configured to version
 *    this package. `proofofheart-frontend` is `private: true`, and changesets
 *    skips private packages by default, so without an explicit
 *    `privatePackages.version` a perfectly good changeset is silently ignored and
 *    the release notes come out empty. That failure is invisible until a release
 *    is cut, which is exactly the "validate pull requests include valid changeset
 *    descriptions" requirement this issue asks for.
 * 2. Each pending `.changeset/*.md` — frontmatter delimiters, a package name
 *    this repo actually publishes, a recognised bump type, and a non-empty
 *    summary.
 *
 * Usage:
 *   node scripts/validate-changesets.mjs                 # every pending changeset
 *   node scripts/validate-changesets.mjs --base origin/main   # only those added on this branch
 *   node scripts/validate-changesets.mjs --json           # machine-readable report
 *   node scripts/validate-changesets.mjs --require        # fail when no changeset was added
 *
 * Exits 0 when there is nothing blocking, 1 otherwise.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Files that live in `.changeset/` but are not changesets. */
const NON_CHANGESET_FILES = new Set(["README.md", "config.json"]);

/** Bump types `@changesets/cli` understands. */
const BUMP_TYPES = new Set(["patch", "minor", "major"]);

/** `changeset` generates names like `brave-lions-dance.md`; hand-written ones may differ. */
const CHANGESET_FILENAME = /^[a-z0-9]+(?:[-.][a-z0-9]+)*\.md$/;

/** Keep release notes readable in a CHANGELOG. */
const MAX_SUMMARY_LENGTH = 200;

/** Summaries that are technically present but carry no information. */
const PLACEHOLDER_SUMMARY = new Set([
  "tbd",
  "todo",
  "wip",
  "fix",
  "fixes",
  "update",
  "updates",
  "changes",
]);

const SEVERITY_ERROR = "error";
const SEVERITY_WARNING = "warning";

/**
 * @typedef {{ severity: "error" | "warning", file: string, message: string }} Issue
 */

/**
 * Read the package name this repo versions. The changesets config is useless
 * without it, so a missing or non-string name is itself an error.
 *
 * @param {string} root
 * @returns {{ name: string | null, version: string | null }}
 */
export function readPackageIdentity(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    return {
      name: typeof pkg.name === "string" ? pkg.name : null,
      version: typeof pkg.version === "string" ? pkg.version : null,
    };
  } catch {
    return { name: null, version: null };
  }
}

/**
 * Validate `.changeset/config.json`.
 *
 * The check that matters: changesets ignores `private: true` packages unless
 * `privatePackages.version` is set, so a changeset for this repo would be
 * accepted and then ignored at release time.
 *
 * @param {string} root
 * @param {{ packageName?: string | null }} [options]
 * @returns {Issue[]}
 */
export function validateChangesetConfig(root, options = {}) {
  /** @type {Issue[]} */
  const issues = [];
  const file = ".changeset/config.json";
  let config;

  try {
    config = JSON.parse(readFileSync(join(root, ".changeset", "config.json"), "utf-8"));
  } catch (error) {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message: `could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return issues;
  }

  const packageName =
    options.packageName === undefined ? readPackageIdentity(root).name : options.packageName;
  const versionsPrivatePackages =
    typeof config.privatePackages === "object" &&
    config.privatePackages !== null &&
    config.privatePackages.version === true;

  if (packageName && !versionsPrivatePackages) {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message:
        `does not set "privatePackages": { "version": true }. Changesets skips packages with ` +
        `"private": true by default, so changesets for "${packageName}" would be silently ` +
        `dropped and the release notes would ship empty.`,
    });
  }

  if (config.baseBranch !== "main") {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message: `must set "baseBranch" to "main"; found ${JSON.stringify(config.baseBranch ?? null)}.`,
    });
  }

  if (config.access !== "public" && packageName) {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message: `must set "access" to "public"; found ${JSON.stringify(config.access ?? null)}.`,
    });
  }

  if (!Array.isArray(config.ignore) || config.ignore.length > 0) {
    issues.push({
      severity: SEVERITY_WARNING,
      file,
      message: `"ignore" should be an empty array; found ${JSON.stringify(config.ignore ?? null)}.`,
    });
  }

  return issues;
}

/**
 * Split a changeset into its YAML frontmatter and its summary.
 *
 * Only the narrow subset of YAML that changesets emits is handled: a `---` fence,
 * then one `"package": bump` pair per line, then a closing `---`. Anything else
 * is reported rather than guessed at, because guessing wrong here would accept a
 * changeset that `changeset status` later rejects.
 *
 * @param {string} content
 * @returns {{ ok: true, releases: Array<[string, string]>, summary: string } | { ok: false, reason: string }}
 */
export function parseChangeset(content) {
  const normalised = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!normalised.startsWith("---\n")) {
    return { ok: false, reason: "must start with a `---` frontmatter fence on the first line" };
  }

  const end = normalised.indexOf("\n---", 3);
  if (end === -1) {
    return { ok: false, reason: "frontmatter is not closed by a `---` line" };
  }

  const frontmatter = normalised.slice(4, end);
  const summary = normalised.slice(end + 4).trim();

  /** @type {Array<[string, string]>} */
  const releases = [];
  const seen = new Set();

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const match = /^["']?([^"':]+)["']?\s*:\s*["']?([A-Za-z]+)["']?$/.exec(line);
    if (match === null) {
      return {
        ok: false,
        reason: `frontmatter line ${JSON.stringify(rawLine)} is not a "<package>": <bump type> pair`,
      };
    }

    const [, name, bump] = match;
    if (seen.has(name)) {
      return { ok: false, reason: `frontmatter lists "${name}" more than once` };
    }
    seen.add(name);
    releases.push([name.trim(), bump.trim()]);
  }

  if (releases.length === 0) {
    return { ok: false, reason: "frontmatter declares no release" };
  }

  return { ok: true, releases, summary };
}

/**
 * Validate one changeset file.
 *
 * @param {{ file: string, content: string, packageName: string | null }} input
 * @returns {Issue[]}
 */
export function validateChangesetFile({ file, content, packageName }) {
  /** @type {Issue[]} */
  const issues = [];

  const fileName = file.split("/").pop() ?? file;
  if (!CHANGESET_FILENAME.test(fileName)) {
    issues.push({
      severity: SEVERITY_WARNING,
      file,
      message: `filename should be lowercase words separated by dashes, e.g. "brave-lions-dance.md".`,
    });
  }

  const parsed = parseChangeset(content);
  if (!parsed.ok) {
    issues.push({ severity: SEVERITY_ERROR, file, message: parsed.reason });
    return issues;
  }

  for (const [name, bump] of parsed.releases) {
    if (packageName !== null && name !== packageName) {
      issues.push({
        severity: SEVERITY_ERROR,
        file,
        message: `declares a release for "${name}", but this repo versions "${packageName}".`,
      });
    }
    if (!BUMP_TYPES.has(bump)) {
      issues.push({
        severity: SEVERITY_ERROR,
        file,
        message: `declares bump type "${bump}" for "${name}"; expected one of ${[...BUMP_TYPES].join(", ")}.`,
      });
    }
  }

  const summary = parsed.summary;
  if (summary === "") {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message:
        "has no summary. Add a line after the frontmatter describing the change for the changelog.",
    });
    return issues;
  }

  if (summary.length > MAX_SUMMARY_LENGTH) {
    issues.push({
      severity: SEVERITY_ERROR,
      file,
      message: `summary is ${summary.length} characters; keep it to ${MAX_SUMMARY_LENGTH} or fewer so the changelog stays readable.`,
    });
  }

  if (PLACEHOLDER_SUMMARY.has(summary.toLowerCase().replace(/[.]+$/, ""))) {
    issues.push({
      severity: SEVERITY_WARNING,
      file,
      message: `summary "${summary}" does not say what changed. Describe the change for the changelog.`,
    });
  }

  return issues;
}

/**
 * Validate every changeset in the repository, or only the ones added on a branch.
 *
 * @param {{ root?: string, files?: string[], packageName?: string | null }} [options]
 * @returns {{ issues: Issue[], changesetFiles: string[], packageName: string | null }}
 */
export function collectChangesetIssues(options = {}) {
  const root = options.root ?? process.cwd();
  const packageName =
    options.packageName === undefined ? readPackageIdentity(root).name : options.packageName;

  /** @type {Issue[]} */
  const issues = [];

  if (packageName === null) {
    issues.push({
      severity: SEVERITY_ERROR,
      file: "package.json",
      message: 'has no "name" field, so a changeset cannot name the package it releases.',
    });
  }

  issues.push(...validateChangesetConfig(root, { packageName }));

  const changesetDir = join(root, ".changeset");
  let entries = [];
  try {
    entries = readdirSync(changesetDir).filter((name) => name.endsWith(".md"));
  } catch {
    issues.push({
      severity: SEVERITY_ERROR,
      file: ".changeset",
      message: "directory is missing, so `npm run changeset` has nowhere to write.",
    });
    return { issues, changesetFiles: [], packageName };
  }

  const all = entries
    .filter((name) => !NON_CHANGESET_FILES.has(name))
    .map((name) => `.changeset/${name}`)
    .sort();

  // A branch-scoped run only inspects the changesets the branch adds, so a
  // long-lived pending changeset cannot mask a missing one on this pull request.
  const selected = options.files ? all.filter((file) => options.files?.includes(file)) : all;

  /** @type {Map<string, string>} */
  const summaries = new Map();

  for (const file of selected) {
    const content = readFileSync(join(root, file), "utf-8");
    issues.push(...validateChangesetFile({ file, content, packageName }));

    const parsed = parseChangeset(content);
    if (parsed.ok && parsed.summary !== "") {
      const normalised = parsed.summary.toLowerCase();
      const previous = summaries.get(normalised);
      if (previous !== undefined) {
        issues.push({
          severity: SEVERITY_WARNING,
          file,
          message: `duplicates the summary in ${previous}. One entry per change keeps the changelog readable.`,
        });
      } else {
        summaries.set(normalised, file);
      }
    }
  }

  return { issues, changesetFiles: selected, packageName };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Files this branch added or changed, relative to the repository root.
 *
 * @param {string} root
 * @param {string} base
 * @returns {string[] | undefined} `undefined` when git could not answer.
 */
function changedFilesSince(root, base) {
  try {
    const output = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024,
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    // No upstream ref to compare against (shallow clone, first push): fall back
    // to validating everything rather than silently passing.
    return undefined;
  }
}

function formatReport(report, issues) {
  const errors = issues.filter((issue) => issue.severity === SEVERITY_ERROR);
  const warnings = issues.filter((issue) => issue.severity === SEVERITY_WARNING);
  const lines = [];

  lines.push(`Changeset validation — package "${report.packageName ?? "(unknown)"}"`);
  lines.push(`  Changesets inspected: ${report.changesetFiles.length}`);
  for (const file of report.changesetFiles) lines.push(`    - ${file}`);

  if (issues.length > 0) {
    const width = Math.max(...issues.map((issue) => issue.file.length));
    for (const issue of issues) {
      lines.push(
        `  ${issue.severity.toUpperCase().padEnd(7)} ${issue.file.padEnd(width)}  ${issue.message}`,
      );
    }
  }

  lines.push(
    `  ${errors.length} error(s), ${warnings.length} warning(s).` +
      (errors.length === 0 ? " Nothing blocking." : ""),
  );
  return lines.join("\n");
}

function main(argv) {
  const root = process.cwd();
  const asJson = argv.includes("--json");
  const requireOne = argv.includes("--require");
  const baseIndex = argv.indexOf("--base");
  const base = baseIndex !== -1 ? argv[baseIndex + 1] : undefined;

  const files = base ? changedFilesSince(root, base) : undefined;
  const report = collectChangesetIssues({ root, files });
  const issues = [...report.issues];

  if (requireOne && report.changesetFiles.length === 0) {
    issues.push({
      severity: SEVERITY_ERROR,
      file: ".changeset",
      message: files
        ? "no changeset was added on this branch, so this pull request would not appear in the release notes. Run `npm run changeset`."
        : "no pending changeset was found. Run `npm run changeset` if this change should be released.",
    });
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ ...report, issues }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report, issues)}\n`);
  }

  const blocking = issues.filter((issue) => issue.severity === SEVERITY_ERROR);
  process.exitCode = blocking.length > 0 ? 1 : 0;
}

// Only run the CLI when executed directly, so importing the helpers in tests
// does not terminate the process.
const isDirectInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  main(process.argv.slice(2));
}
