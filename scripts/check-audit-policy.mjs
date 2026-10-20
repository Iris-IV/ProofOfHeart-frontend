#!/usr/bin/env node
/**
 * #1618 — verify the dependency-security policy in the repository.
 *
 * Two invariants that are easy to state and easy to break by accident:
 *
 * 1. **No allowlist entry may outlive its expiry.** An `audit-ci` allowlist entry
 *    is a decision to accept a known vulnerability. Left alone it silently
 *    becomes permanent, which is how a temporary exception turns into a
 *    permanent one nobody remembers approving. Requiring an `expiry` and failing
 *    once it passes turns that decision into a scheduled review.
 *
 * 2. **npm is the only package manager.** CI, the Dockerfile and the docs all
 *    install with npm. A second lockfile (`pnpm-lock.yaml`, `yarn.lock`, ...)
 *    drifts silently, gives contributors a different dependency tree from CI,
 *    and lets a security pin in `overrides` protect one tree but not the other.
 *    This script fails if one reappears or if `packageManager` stops naming npm.
 *
 * Dependency-free on purpose: it runs in CI without `npm ci`, so a policy check
 * costs a second of Node startup instead of an install.
 *
 * Usage:
 *   node scripts/check-audit-policy.mjs           # human-readable
 *   node scripts/check-audit-policy.mjs --json    # machine-readable
 *
 * Exits 0 when the policy holds, 1 otherwise.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SEVERITY_ERROR = "error";
const SEVERITY_WARNING = "warning";

/**
 * @typedef {{ severity: "error" | "warning", source: string, message: string }} PolicyIssue
 */

/**
 * Read and parse a JSON file, returning an issue instead of throwing.
 *
 * @param {string} path
 * @param {string} label
 * @param {PolicyIssue[]} issues
 * @returns {unknown}
 */
function readJson(path, label, issues) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    issues.push({
      severity: SEVERITY_ERROR,
      source: label,
      message: `could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return undefined;
  }
}

/**
 * Validate `audit-ci.json`.
 *
 * @param {Record<string, unknown> | undefined} config
 * @param {{ today?: string }} [options] `today` is injected so the check is testable.
 * @returns {PolicyIssue[]}
 */
export function validateAuditCiConfig(config, options = {}) {
  /** @type {PolicyIssue[]} */
  const issues = [];
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  if (config === undefined || config === null || typeof config !== "object") {
    return [{ severity: SEVERITY_ERROR, source: "audit-ci.json", message: "is not a JSON object" }];
  }

  const source = "audit-ci.json";

  // A scanner that does not fail on anything is a no-op with extra steps.
  if (config.critical !== true) {
    issues.push({ severity: SEVERITY_ERROR, source, message: 'must set "critical": true' });
  }
  if (config.high !== true) {
    issues.push({ severity: SEVERITY_ERROR, source, message: 'must set "high": true' });
  }
  if (typeof config["package-manager"] !== "string") {
    issues.push({
      severity: SEVERITY_ERROR,
      source,
      message:
        'must pin "package-manager"; leaving it "auto" makes the gate depend on lockfiles the repo also ships',
    });
  }

  const allowlist = config.allowlist;
  if (allowlist !== undefined && !Array.isArray(allowlist)) {
    issues.push({
      severity: SEVERITY_ERROR,
      source,
      message:
        '"allowlist" must be an array; audit-ci rejects an object with "recordsOrIds is not iterable"',
    });
    return issues;
  }

  for (const entry of allowlist ?? []) {
    // An allowlist item is either a bare id string or a single-key record.
    if (typeof entry === "string") {
      issues.push({
        severity: SEVERITY_WARNING,
        source,
        message: `allowlists "${entry}" as a bare string, so there is no expiry or rationale attached to it. Use the { "<module>": { active, expiry, notes } } form.`,
      });
      continue;
    }

    if (entry === null || typeof entry !== "object") {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry ${JSON.stringify(entry)} is not a string or object`,
      });
      continue;
    }

    const names = Object.keys(entry);
    if (names.length !== 1) {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry has ${names.length} keys; audit-ci expects exactly one module per entry (got ${names.join(", ") || "none"})`,
      });
      continue;
    }

    const name = names[0];
    const record = entry[name];
    if (record === null || typeof record !== "object") {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry "${name}" must be an object with active/expiry/notes`,
      });
      continue;
    }

    if (typeof record.notes !== "string" || record.notes.trim() === "") {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry "${name}" has no notes. Record why the advisory is accepted and where it is reachable from.`,
      });
    }

    const expiry = record.expiry;
    if (expiry === undefined || expiry === null) {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry "${name}" has no expiry. Every suppression needs a review date.`,
      });
      continue;
    }

    // audit-ci accepts a string date or a number of days; normalise both.
    const expiryDate = normaliseExpiry(expiry);
    if (expiryDate === null) {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry "${name}" has an unreadable expiry ${JSON.stringify(expiry)}; use "YYYY-MM-DD" or a number of days`,
      });
      continue;
    }

    if (expiryDate < today) {
      issues.push({
        severity: SEVERITY_ERROR,
        source,
        message: `allowlist entry "${name}" expired on ${expiryDate} (today is ${today}). Fix the advisory and remove the entry, or extend the expiry with a fresh justification.`,
      });
    } else if (expiryDate === today) {
      issues.push({
        severity: SEVERITY_WARNING,
        source,
        message: `allowlist entry "${name}" expires today. Re-approve it or remove it.`,
      });
    }

    if (record.active === false) {
      issues.push({
        severity: SEVERITY_WARNING,
        source,
        message: `allowlist entry "${name}" is marked "active": false; audit-ci still lists it, so remove it instead if it is resolved.`,
      });
    }
  }

  return issues;
}

/**
 * Normalise an audit-ci expiry to a `YYYY-MM-DD` string.
 *
 * audit-ci documents `expiry` as either an absolute date string or a number of
 * days from now, so a bare number has to be resolved against today.
 *
 * @param {unknown} expiry
 * @param {string} [today]
 * @returns {string | null}
 */
export function normaliseExpiry(expiry, today = new Date().toISOString().slice(0, 10)) {
  if (typeof expiry === "number") {
    if (!Number.isFinite(expiry)) return null;
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + expiry);
    return date.toISOString().slice(0, 10);
  }

  if (typeof expiry !== "string") return null;

  const trimmed = expiry.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Lockfiles and workspace files that belong to package managers other than npm. */
export const FOREIGN_LOCKFILES = [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
];

/**
 * Check that the repository installs with npm and nothing else.
 *
 * @param {{ files: string[], packageManager?: unknown }} input
 *   `files` is the list of foreign lockfiles present at the repository root.
 * @returns {PolicyIssue[]}
 */
export function validateSinglePackageManager({ files, packageManager }) {
  /** @type {PolicyIssue[]} */
  const issues = [];

  for (const file of files) {
    issues.push({
      severity: SEVERITY_ERROR,
      source: file,
      message:
        "should not be committed: npm is the only supported package manager, so package-lock.json is the only lockfile",
    });
  }

  if (typeof packageManager !== "string" || !/^npm@\d/.test(packageManager)) {
    issues.push({
      severity: SEVERITY_ERROR,
      source: "package.json",
      message: '"packageManager" must name npm, for example "npm@10.9.0"',
    });
  }

  return issues;
}

/**
 * Run every check against the repository.
 *
 * @param {{ root?: string, today?: string }} [options]
 * @returns {{ issues: PolicyIssue[], allowlistEntries: number }}
 */
export function checkAuditPolicy(options = {}) {
  const root = options.root ?? process.cwd();
  /** @type {PolicyIssue[]} */
  const issues = [];

  const config = readJson(join(root, "audit-ci.json"), "audit-ci.json", issues);
  issues.push(...validateAuditCiConfig(config, { today: options.today }));

  const pkg = readJson(join(root, "package.json"), "package.json", issues);
  if (pkg !== undefined && pkg !== null && typeof pkg === "object") {
    const files = FOREIGN_LOCKFILES.filter((file) => existsSync(join(root, file)));
    issues.push(...validateSinglePackageManager({ files, packageManager: pkg.packageManager }));
  }

  const allowlist =
    config !== undefined &&
    config !== null &&
    typeof config === "object" &&
    Array.isArray(config.allowlist)
      ? config.allowlist
      : [];

  return { issues, allowlistEntries: allowlist.length };
}

function formatReport(report) {
  const lines = ["Dependency security policy"];
  lines.push(`  Allowlist entries: ${report.allowlistEntries}`);

  if (report.issues.length === 0) {
    lines.push("  Policy holds. Nothing to review.");
    return lines.join("\n");
  }

  const width = Math.max(...report.issues.map((issue) => issue.source.length));
  for (const issue of report.issues) {
    lines.push(
      `  ${issue.severity.toUpperCase().padEnd(7)} ${issue.source.padEnd(width)}  ${issue.message}`,
    );
  }
  const errors = report.issues.filter((issue) => issue.severity === SEVERITY_ERROR).length;
  lines.push(`  ${errors} error(s), ${report.issues.length - errors} warning(s).`);
  return lines.join("\n");
}

function main(argv) {
  const report = checkAuditPolicy();
  const asJson = argv.includes("--json");
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(report)}\n`);
  }
  process.exitCode = report.issues.some((issue) => issue.severity === SEVERITY_ERROR) ? 1 : 0;
}

const isDirectInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  main(process.argv.slice(2));
}
