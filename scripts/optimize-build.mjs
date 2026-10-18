#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function checkEnv(name) {
  return process.env[name] || null;
}

log("\n  Build Optimization Report", "blue");
log("  =========================\n", "blue");

const issues = [];
const suggestions = [];

if (!checkEnv("NEXT_PRIVATE_COMPILATION_CACHE")) {
  issues.push("Compilation cache not explicitly enabled");
  suggestions.push("Set NEXT_PRIVATE_COMPILATION_CACHE=1 for incremental builds");
}

if (!checkEnv("NODE_OPTIONS")) {
  suggestions.push("Consider NODE_OPTIONS='--max-old-space-size=4096' for large builds");
}

const nextConfig = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf-8");
if (!nextConfig.includes("turbo")) {
  issues.push("Turbopack not configured for dev builds");
}

if (nextConfig.includes('output: "standalone"')) {
  log("  [ok] Standalone output enabled", "green");
}

if (nextConfig.includes("reactCompiler: true")) {
  log("  [ok] React Compiler enabled", "green");
}

if (nextConfig.includes("turbo")) {
  log("  [ok] Turbopack rules configured", "green");
}

if (issues.length > 0) {
  log("\n  Issues:", "yellow");
  issues.forEach((i) => log(`  - ${i}`, "yellow"));
}

if (suggestions.length > 0) {
  log("\n  Suggestions:", "blue");
  suggestions.forEach((s) => log(`  - ${s}`, "blue"));
}

log("\n  Quick wins:", "blue");
log("  - Use turbo: next dev --turbo (default in Next.js 16)", "dim");
log("  - Cache: NEXT_PRIVATE_COMPILATION_CACHE=1 next build", "dim");
log("  - Parallel: next build uses all available CPU cores", "dim");
log("  - Skip type checking: next build --no-lint (CI only)", "dim");
log("");
