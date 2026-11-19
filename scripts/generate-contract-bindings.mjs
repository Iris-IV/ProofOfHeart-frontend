#!/usr/bin/env node
/**
 * #1790 — regenerate `src/lib/generated/` from the ProofOfHeart contract's
 * published interface.
 *
 * Resolves the contract interface (Spec JSON, the output of
 * `stellar contract info interface --output json`) from, in order of
 * preference:
 *
 *   1. `--spec <path>`   a Spec JSON dump you already have;
 *   2. `--wasm <path>`   a local proof_of_heart.wasm — runs
 *                        `stellar contract info interface --wasm <path> --output json`
 *                        (requires the Stellar CLI on PATH);
 *   3. (default)         the `contract-spec.json` CI artifact published by the
 *                        contract repo (Iris-IV/ProofOfHeart-stellar#1473),
 *                        downloaded with `gh` from the latest successful
 *                        `main` run of its CI workflow.
 *
 * Then it normalizes the spec and writes:
 *
 *   src/lib/generated/contract-spec.json   normalized, frontend-facing spec
 *   src/lib/generated/client.ts            typed read client
 *
 * By default only the entrypoints already adopted in `contract-spec.json` are
 * kept (signatures and struct shapes are refreshed from the contract, adopted
 * set stays stable — incremental migration per #1790). Pass `--all` to adopt
 * every read entrypoint of the contract.
 *
 * Usage:
 *   node scripts/generate-contract-bindings.mjs [--spec <file> | --wasm <file>]
 *                                               [--all] [--out <dir>]
 *
 * Dependency-free on purpose: runs with plain Node, no `npm ci` required.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = join(REPO_ROOT, "src", "lib", "generated");

const CONTRACT_REPO = "Iris-IV/ProofOfHeart-stellar";
const SPEC_ARTIFACT_NAME = "contract-spec.json";

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, all: false, spec: null, wasm: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--spec") args.spec = argv[++i];
    else if (arg === "--wasm") args.wasm = argv[++i];
    else if (arg === "--out") args.out = resolve(argv[++i]);
    else if (arg === "--all") args.all = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Interface resolution
// ---------------------------------------------------------------------------

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${cmdArgs.join(" ")} failed:\n${result.stderr || result.stdout || "no output"}`,
    );
  }
  return result.stdout;
}

function interfaceFromWasm(wasmPath) {
  const out = run("stellar", [
    "contract",
    "info",
    "interface",
    "--wasm",
    wasmPath,
    "--output",
    "json",
  ]);
  return JSON.parse(out);
}

/**
 * Download the `contract-spec.json` artifact published by the contract repo's
 * CI (Iris-IV/ProofOfHeart-stellar#1473) and return the parsed Spec JSON.
 * Falls back to the `proof_of_heart.wasm` artifact, from which the interface
 * is extracted with the Stellar CLI when it is installed.
 */
function interfaceFromContractCi() {
  const gh = (apiArgs) => JSON.parse(run("gh", ["api", ...apiArgs]));
  const runs = gh([
    `repos/${CONTRACT_REPO}/actions/workflows/ci.yml/runs?branch=main&status=success&per_page=1`,
  ]);
  const runId = runs.workflow_runs?.[0]?.id;
  if (!runId) {
    throw new Error(`No successful CI run found on ${CONTRACT_REPO}@main.`);
  }

  const { artifacts } = gh([`repos/${CONTRACT_REPO}/actions/runs/${runId}/artifacts`]);
  const specArtifact = (artifacts ?? []).find((a) => a.name === SPEC_ARTIFACT_NAME);
  const wasmArtifact = (artifacts ?? []).find((a) => a.name.endsWith(".wasm"));
  const target = specArtifact ?? wasmArtifact;
  if (!target) {
    throw new Error(
      `Run ${runId} of ${CONTRACT_REPO} publishes neither ${SPEC_ARTIFACT_NAME} nor a wasm ` +
        `artifact. Build the contract interface first (Iris-IV/ProofOfHeart-stellar#1473), ` +
        `or pass --spec/--wasm explicitly.`,
    );
  }

  const tmp = mkdtempSync(join(tmpdir(), "poh-bindings-"));
  try {
    run("gh", [
      "run",
      "download",
      String(runId),
      "--repo",
      CONTRACT_REPO,
      "--name",
      target.name,
      "--dir",
      tmp,
    ]);
    const specFile = findFile(tmp, SPEC_ARTIFACT_NAME);
    if (specFile) return JSON.parse(readFileSync(specFile, "utf-8"));

    const wasmFile = findFile(tmp, ".wasm");
    if (wasmFile) return interfaceFromWasm(wasmFile);
    throw new Error(`Artifact ${target.name} contained neither spec JSON nor wasm.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function findFile(root, suffix) {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) stack.push(path);
      else if (entry.endsWith(suffix) || path.endsWith(suffix)) return path;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalization: official Spec JSON -> frontend-facing contract-spec.json
// ---------------------------------------------------------------------------

/**
 * Normalize a type from the official Spec JSON. Handles both key spellings
 * seen across CLI versions (`type`/`ty`, `value`/`inner`/`of`) and collapses
 * them to the compact form used by `contract-spec.json`:
 *
 *   "u32" | "address" | ...                       scalar
 *   { "type": "option", "value": <type> }         option
 *   { "type": "vec", "value": <type> }            vec
 *   { "type": "page", "struct": "Campaign" }      (Vec<Struct>, u32) page tuple
 *   <StructName>                                  struct reference
 */
function normalizeType(type) {
  if (type === null || type === undefined) return "void";
  if (typeof type === "string") return type;

  const kind = type.type ?? type.ty ?? type.kind;
  const inner = type.value ?? type.inner ?? type.of ?? type.value_type;

  if (kind === "option") return { type: "option", value: normalizeType(inner) };
  if (kind === "vec" || kind === "vec<" || kind === "Vec")
    return { type: "vec", value: normalizeType(inner) };
  if (kind === "tuple") {
    // (Vec<Campaign>, u32) is the contract's page shape.
    const values = type.values ?? type.members ?? [];
    const vecMember = values.find((v) => (v.type ?? v.ty) === "vec");
    const structName = extractStructName(vecMember);
    if (vecMember && structName) return { type: "page", struct: structName };
    return { type: "tuple", values: values.map(normalizeType) };
  }
  if (kind === "struct" || kind === "type") {
    const name = type.name ?? type.struct;
    if (name) return name;
  }
  if (kind) return kind;
  return "void";
}

function extractStructName(vecMember) {
  if (!vecMember) return null;
  const inner = vecMember.value ?? vecMember.inner ?? vecMember.of;
  if (typeof inner === "string") return inner;
  return inner?.name ?? null;
}

function normalizeSpec(raw) {
  const functions = Array.isArray(raw.functions) ? raw.functions : [];
  const types = raw.types && typeof raw.types === "object" ? raw.types : {};

  const normalizedFunctions = functions
    // Read surface only: writes migrate incrementally (#1790).
    .filter((fn) => fn.writable !== true)
    .map((fn) => ({
      name: fn.name,
      mutability: "view",
      args: (fn.args ?? []).map((arg) => ({ name: arg.name, type: normalizeType(arg.type ?? arg.ty) })),
      ret: normalizeType(fn.ret ?? fn.return ?? fn.returns),
    }));

  const normalizedTypes = {};
  for (const [name, def] of Object.entries(types)) {
    const fields = def?.fields ?? def?.Items ?? null;
    if (!Array.isArray(fields)) continue; // enums/scalars are inlined as scalars
    normalizedTypes[name] = {
      fields: fields.map((field) => ({
        name: field.name,
        type: normalizeType(field.type ?? field.ty),
      })),
    };
  }

  return { functions: normalizedFunctions, types: normalizedTypes };
}

/** Keep only entrypoints the frontend has adopted (present in the old spec). */
function selectFunctions(normalized, previousFunctions, includeAll) {
  if (includeAll || !previousFunctions || previousFunctions.length === 0) {
    return normalized.functions;
  }
  const adopted = new Set(previousFunctions.map((fn) => fn.name));
  return normalized.functions.filter((fn) => adopted.has(fn.name));
}

/** Keep only structs reachable from the selected functions. */
function selectTypes(functions, types) {
  const referenced = new Set();
  const walk = (type) => {
    if (!type || typeof type === "string") {
      if (types[type]) referenced.add(type);
      return;
    }
    if (type.type === "option" || type.type === "vec") walk(type.value);
    else if (type.type === "page") walk(type.struct);
    else if (type.type === "tuple") type.values.forEach(walk);
    else if (typeof type === "object") Object.values(type).forEach(walk);
  };
  for (const fn of functions) {
    fn.args.forEach((arg) => walk(arg.type));
    walk(fn.ret);
  }
  const selected = {};
  for (const name of [...referenced].sort()) selected[name] = types[name];
  return selected;
}

// ---------------------------------------------------------------------------
// TypeScript emission
// ---------------------------------------------------------------------------

function tsTypeFor(type, { inOption = false } = {}) {
  if (typeof type === "string") {
    switch (type) {
      case "u32":
      case "u64":
        return "number";
      case "i128":
        return "bigint";
      case "bool":
        return "boolean";
      case "address":
      case "string":
      case "symbol":
      case "bytes":
      case "bytes32":
        return "string";
      case "void":
        return "void";
      default:
        return types.includes(type) ? `Spec${type}` : "unknown";
    }
  }
  if (type.type === "option") return `${tsTypeFor(type.value, { inOption: true })} | null`;
  if (type.type === "vec") return `Array<${tsTypeFor(type.value)}>`;
  if (type.type === "page") return `SpecCampaignPage`;
  if (type.type === "tuple") return `[${type.values.map((t) => tsTypeFor(t)).join(", ")}]`;
  return "unknown";
}

function encoderFor(type) {
  const scalar = typeof type === "string" ? type : type.type;
  switch (scalar) {
    case "u32":
      return "encU32";
    case "u64":
      return "encU64";
    case "i128":
      return "encI128";
    case "bool":
      return "encBool";
    case "string":
    case "symbol":
      return "encString";
    case "address":
      return "encAddress";
    case "bytes32":
    case "bytes":
      return "encBytes32";
    default:
      throw new Error(`No encoder for argument type ${JSON.stringify(type)}`);
  }
}

function decoderExpr(type, expr) {
  if (typeof type === "string") {
    switch (type) {
      case "u32":
        return `${expr} ? ${expr}.u32() : 0`;
      case "u64":
        return `${expr} ? Number(${expr}.u64()) : 0`;
      case "i128":
        return `${expr} ? scValToBigInt(${expr}) : BigInt(0)`;
      case "bool":
        return `${expr}?.b() ?? false`;
      case "address":
        return `${expr} ? Address.fromScVal(${expr}).toString() : ""`;
      case "string":
        return `${expr} ? ${expr}.str().toString() : ""`;
      default:
        return `${expr} as never`;
    }
  }
  if (type.type === "option") {
    const inner = typeof type.value === "string" ? type.value : null;
    if (inner && types.includes(inner)) return `decodeSpec${inner}(${expr})`;
    return `isScValVoid(${expr}) ? null : ${expr}`;
  }
  if (type.type === "vec" && typeof type.value === "string" && types.includes(type.value)) {
    return `(${expr}?.vec() ?? []).map(decodeSpec${type.value})`;
  }
  if (type.type === "vec" && type.value === "u32") {
    return `(${expr}?.vec() ?? []).map((v) => v.u32())`;
  }
  if (type.type === "page") return `decodeSpecCampaignPage(${expr})`;
  if (typeof type === "string" && types.includes(type)) {
    return `${expr} ? decodeSpec${type}(${expr}) : null`;
  }
  return `${expr} as never`;
}

let types = [];

function camel(name) {
  return name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function methodName(name) {
  const camelName = camel(name);
  return camelName.charAt(0).toUpperCase() + camelName.slice(1);
}

function emitClient(spec) {
  types = Object.keys(spec.types);
  const lines = [];
  lines.push(HEADER);
  lines.push(`import { Address, nativeToScVal, scValToBigInt, xdr } from "@stellar/stellar-sdk";`);
  lines.push("");
  lines.push("// ---------------------------------------------------------------------------");
  lines.push("// Contract types (mirrors of `#[contracttype]` structs in the contract spec)");
  lines.push("// ---------------------------------------------------------------------------");
  lines.push("");
  for (const [name, def] of Object.entries(spec.types)) {
    lines.push(`/** On-chain \`${name}\` struct. */`);
    lines.push(`export interface Spec${name} {`);
    for (const field of def.fields) {
      lines.push(`  ${field.name}: ${tsTypeFor(field.type)};`);
    }
    lines.push(`}`);
    lines.push("");
  }
  if (spec.functions.some((fn) => fn.ret && fn.ret.type === "page")) {
    lines.push(`/** One page of the paginated campaign views: \`(Vec<Campaign>, next)\`. */`);
    lines.push(`export interface SpecCampaignPage {`);
    lines.push(`  campaigns: Spec${spec.types.Campaign ? "Campaign" : "unknown"}[];`);
    lines.push(`  next: number;`);
    lines.push(`}`);
    lines.push("");
  }
  lines.push(`/** Transport: performs a read-only contract call and returns the raw result. */`);
  lines.push(`export type InvokeView = (method: string, args?: xdr.ScVal[]) => Promise<xdr.ScVal | null>;`);
  lines.push("");
  lines.push(ENCODERS_DECODERS);
  lines.push("/**");
  lines.push(" * Typed read client for the ProofOfHeart contract — one method per view entrypoint.");
  lines.push(" */");
  lines.push(`export class ProofOfHeartGeneratedClient {`);
  lines.push(`  constructor(private readonly invoke: InvokeView) {}`);
  lines.push("");
  for (const fn of spec.functions) {
    const params = fn.args
      .map((arg) => `${camel(arg.name)}: ${tsTypeFor(arg.type)}`)
      .join(", ");
    const ret = fn.ret ? tsTypeFor(fn.ret) : "void";
    lines.push(`  /** \`${fn.name}(${fn.args.map((a) => a.name).join(", ")})\` */`);
    lines.push(
      `  async ${methodName(fn.name)}(${params}): Promise<${ret === "void" ? "void" : ret}> {`,
    );
    const encoderList = fn.args.map((arg) => `${encoderFor(arg.type)}(${camel(arg.name)})`).join(", ");
    const invokeArgs = encoderList ? `, [${encoderList}]` : "";
    lines.push(`    const result = await this.invoke("${fn.name}"${invokeArgs});`);
    if (fn.ret && fn.ret !== "void") {
      const decoded = decoderExpr(fn.ret, "result");
      lines.push(`    return ${decoded};`);
    }
    lines.push(`  }`);
    lines.push("");
  }
  lines.push(`}`);
  lines.push("");
  lines.push(`/** Build a generated client over a read transport. */`);
  lines.push(`export function createGeneratedClient(invoke: InvokeView): ProofOfHeartGeneratedClient {`);
  lines.push(`  return new ProofOfHeartGeneratedClient(invoke);`);
  lines.push(`}`);
  lines.push("");
  return lines.join("\n");
}

const HEADER = `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * ProofOfHeart contract read client, generated from the contract's published
 * interface (\`contract-spec.json\` in this directory).
 *
 * Source of truth : Iris-IV/ProofOfHeart-stellar (contract CI artifact,
 *                   Iris-IV/ProofOfHeart-stellar#1473), or a local
 *                   \`proof_of_heart.wasm\` via
 *                   \`stellar contract info interface --wasm <path> --output json\`
 * Regenerate with : \`npm run bindings:generate\`
 *                   (scripts/generate-contract-bindings.mjs)
 *
 * Scope: the view (read) surface consumed by \`src/lib/contractClient.ts\`.
 * Writes migrate incrementally (issue #1790).
 */`;

const ENCODERS_DECODERS = `// ---------------------------------------------------------------------------
// ScVal encoders / decoders
// ---------------------------------------------------------------------------

const encU32 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u32" });
const encU64 = (value: number): xdr.ScVal => nativeToScVal(value, { type: "u64" });
const encI128 = (value: bigint): xdr.ScVal => nativeToScVal(value, { type: "i128" });
const encBool = (value: boolean): xdr.ScVal => nativeToScVal(value, { type: "bool" });
const encString = (value: string): xdr.ScVal => nativeToScVal(value, { type: "string" });
const encAddress = (value: string): xdr.ScVal => new Address(value).toScVal();
const encBytes32 = (hex: string): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));

/** Soroban encodes \`Option<T>\` as void for \`None\` and the bare value for \`Some\`. */
function isScValVoid(val: xdr.ScVal | undefined): boolean {
  return !val || val.switch().name === "scvVoid";
}

function toMapFields(val: xdr.ScVal, expect: string): Record<string, xdr.ScVal> {
  const map = val.map();
  if (!map) throw new Error(\`Expected ScVal map for \${expect}.\`);
  const fields: Record<string, xdr.ScVal> = {};
  for (const entry of map) fields[entry.key().sym().toString()] = entry.val();
  return fields;
}
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(
      "Usage: node scripts/generate-contract-bindings.mjs [--spec <file> | --wasm <file>] [--all] [--out <dir>]\n",
    );
    return;
  }

  let raw;
  if (args.spec) {
    raw = JSON.parse(readFileSync(args.spec, "utf-8"));
  } else if (args.wasm) {
    raw = interfaceFromWasm(args.wasm);
  } else {
    raw = interfaceFromContractCi();
  }

  const specPath = join(args.out, "contract-spec.json");
  const previous = existsSync(specPath)
    ? JSON.parse(readFileSync(specPath, "utf-8"))
    : { functions: [], types: {} };

  const normalized = normalizeSpec(raw);
  const functions = selectFunctions(normalized, previous.functions, args.all);
  const selectedTypes = selectTypes(functions, normalized.types);

  const spec = {
    contract: previous.contract ?? "proof_of_heart",
    specVersion: previous.specVersion ?? 1,
    description:
      previous.description ??
      "Normalized Soroban interface for the contract read surface consumed by contractClient.ts.",
    functions,
    types: Object.keys(selectedTypes).length > 0 ? selectedTypes : previous.types,
  };

  mkdirSync(args.out, { recursive: true });
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf-8");
  process.stdout.write(`wrote ${specPath}\n`);

  const clientPath = join(args.out, "client.ts");
  writeFileSync(clientPath, emitClient(spec), "utf-8");
  process.stdout.write(`wrote ${clientPath}\n`);
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;

if (isDirectInvocation) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
