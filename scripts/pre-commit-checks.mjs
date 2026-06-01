#!/usr/bin/env node

/**
 * Pre-commit hook script: typecheck + affected tests
 *
 * Runs:
 * 1. TypeScript type-check on staged files
 * 2. Jest tests for affected files (fast mode)
 *
 * Optimized for speed to not disrupt developer flow.
 * Exits with code 1 if any check fails.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "blue");
  log(`  ${title}`, "blue");
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, "blue");
}

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedTypeScriptFiles(stagedFiles) {
  return stagedFiles.filter((file) => /\.(ts|tsx)$/.test(file));
}

function getAffectedTestFiles(stagedFiles) {
  const testFiles = new Set();

  stagedFiles.forEach((file) => {
    // If a test file is staged, include it
    if (/\.test\.(ts|tsx)$/.test(file)) {
      testFiles.add(file);
      return;
    }

    // If a source file is staged, find related test files
    if (/\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file)) {
      const basePath = file.replace(/\.(ts|tsx)$/, "");
      const possibleTestPaths = [
        `${basePath}.test.ts`,
        `${basePath}.test.tsx`,
        `src/__tests__/${path.basename(basePath)}.test.ts`,
        `src/__tests__/${path.basename(basePath)}.test.tsx`,
        `src/__tests__/lib/${path.basename(basePath)}.test.ts`,
        `src/__tests__/components/${path.basename(basePath)}.test.tsx`,
        `src/__tests__/hooks/${path.basename(basePath)}.test.ts`,
      ];

      possibleTestPaths.forEach((testPath) => {
        if (fs.existsSync(testPath)) {
          testFiles.add(testPath);
        }
      });
    }
  });

  return Array.from(testFiles);
}

async function runTypeCheck(files) {
  if (files.length === 0) {
    log("  ℹ  No TypeScript files staged", "dim");
    return true;
  }

  logSection(`TypeScript Type-Check (${files.length} files)`);

  try {
    // Run tsc on staged files only
    execSync(`npx tsc --noEmit ${files.join(" ")}`, {
      stdio: "inherit",
    });
    log("✓ Type-check passed", "green");
    return true;
  } catch (error) {
    log("✗ Type-check failed", "red");
    return false;
  }
}

async function runAffectedTests(files) {
  if (files.length === 0) {
    log("  ℹ  No test files affected", "dim");
    return true;
  }

  logSection(`Jest Tests (${files.length} files)`);

  try {
    // Run jest on affected test files with --bail to stop on first failure
    execSync(
      `npx jest --bail --testPathPattern="${files.map((f) => f.replace(/\\/g, "/")).join("|")}"`,
      {
        stdio: "inherit",
      },
    );
    log("✓ Tests passed", "green");
    return true;
  } catch (error) {
    log("✗ Tests failed", "red");
    return false;
  }
}

async function main() {
  logSection("Pre-Commit Checks");

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    log("  ℹ  No staged files", "dim");
    return;
  }

  log(`  Staged files: ${stagedFiles.length}`, "dim");

  const typeScriptFiles = getStagedTypeScriptFiles(stagedFiles);
  const affectedTestFiles = getAffectedTestFiles(stagedFiles);

  let allPassed = true;

  // Run type-check
  if (typeScriptFiles.length > 0) {
    const typeCheckPassed = await runTypeCheck(typeScriptFiles);
    allPassed = allPassed && typeCheckPassed;
  } else {
    log("  ℹ  No TypeScript files to check", "dim");
  }

  // Run affected tests
  if (affectedTestFiles.length > 0) {
    const testsPassed = await runAffectedTests(affectedTestFiles);
    allPassed = allPassed && testsPassed;
  } else {
    log("  ℹ  No test files affected", "dim");
  }

  // Summary
  logSection("Summary");
  if (allPassed) {
    log("✓ All checks passed! Ready to commit.", "green");
    process.exit(0);
  } else {
    log("✗ Some checks failed. Fix errors and try again.", "red");
    process.exit(1);
  }
}

main().catch((error) => {
  log(`✗ Error: ${error.message}`, "red");
  process.exit(1);
});
