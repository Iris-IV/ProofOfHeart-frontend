import { execSync } from "child_process";
import path from "path";

const TSC_ERROR_HEADER = /^\S.*\(\d+,\d+\): error TS\d+:/;

/**
 * `tsc` ignores tsconfig.json (path aliases, strict mode, etc.) when files
 * are passed on the command line, and TypeScript 6 now hard-errors on that
 * instead of silently doing it (TS5112: "tsconfig.json is present but will
 * not be loaded if files are specified on commandline"). Type-check the
 * whole project via tsconfig instead, then only fail for the given files —
 * pre-existing errors elsewhere in the repo don't block unrelated commits.
 */
export function typecheckStagedFiles(files) {
  const tsFiles = files.filter((f) => /\.(ts|tsx)$/.test(f));
  if (tsFiles.length === 0) return { ok: true, output: "" };

  const relevantPaths = new Set(
    tsFiles.map((f) => path.relative(process.cwd(), path.resolve(f)).split(path.sep).join("/")),
  );

  let combined = "";
  try {
    execSync("npx tsc --noEmit --pretty false -p tsconfig.json", { encoding: "utf8" });
    return { ok: true, output: "" };
  } catch (error) {
    combined = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }

  const lines = combined.split("\n");
  const relevantLines = [];
  let capturing = false;

  for (const line of lines) {
    if (TSC_ERROR_HEADER.test(line)) {
      const filePath = line.slice(0, line.indexOf("("));
      capturing = relevantPaths.has(filePath);
    }
    if (capturing) relevantLines.push(line);
  }

  return { ok: relevantLines.length === 0, output: relevantLines.join("\n").trim() };
}
