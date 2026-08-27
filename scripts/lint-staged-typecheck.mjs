#!/usr/bin/env node

import { execSync } from "child_process";

const files = process.argv.slice(2).filter((f) => /\.(ts|tsx)$/.test(f));

if (files.length === 0) {
  process.exit(0);
}

try {
  execSync(`npx tsc --noEmit --pretty ${files.join(" ")}`, { stdio: "inherit" });
} catch {
  process.exit(1);
}
