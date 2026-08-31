#!/usr/bin/env node

import { typecheckStagedFiles } from "./typecheckStagedFiles.mjs";

const files = process.argv.slice(2);
const { ok, output } = typecheckStagedFiles(files);

if (!ok) {
  console.error(output);
  process.exit(1);
}
