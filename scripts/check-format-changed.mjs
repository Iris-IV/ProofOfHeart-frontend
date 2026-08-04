#!/usr/bin/env node

import { execSync } from "node:child_process";

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getChangedFiles() {
  const isPullRequest = process.env.GITHUB_EVENT_NAME === "pull_request";
  const baseRef = process.env.GITHUB_BASE_REF;

  if (isPullRequest && baseRef) {
    try {
      runGit(["fetch", "--no-tags", "origin", baseRef]);
    } catch {
      // Ignore fetch failures here; the subsequent diff may still work in local runs.
    }

    try {
      const output = runGit([
        "diff",
        "--name-only",
        "--diff-filter=ACMRTUXB",
        "--merge-base",
        `origin/${baseRef}`,
        "HEAD",
      ]);
      return output ? output.split(/\r?\n/).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  try {
    const output = runGit(["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD^", "HEAD"]);
    return output ? output.split(/\r?\n/).filter(Boolean) : [];
  } catch {
    try {
      const output = runGit(["ls-files"]);
      return output ? output.split(/\r?\n/).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  console.log("No changed files found for formatting check.");
  process.exit(0);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const prettierCommand = [npxCommand, "prettier", "--check", "--ignore-unknown", ...changedFiles]
  .map((part) => (part.includes(" ") ? `"${part}"` : part))
  .join(" ");

execSync(prettierCommand, { stdio: "inherit", shell: true });
