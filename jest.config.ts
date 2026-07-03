import nextJest from "next/jest.js";
import type { Config } from "jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/tests/"],
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts", "!src/types/**"],
  coverageThreshold: {
    global: {
      statements: 15,
      branches: 50,
      functions: 20,
      lines: 15,
    },
  },
  coverageReporters: ["text", "lcov", "html"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

/**
 * All ESM-only packages in the react-markdown / unified dependency tree.
 * Jest must transform these rather than skip them.
 */
const esmPackages = [
  "react-markdown",
  "remark-gfm",
  "remark-parse",
  "remark-rehype",
  "remark-stringify",
  "rehype-sanitize",
  "hast-util-sanitize",
  "hast-util-to-jsx-runtime",
  "hast-util-whitespace",
  "unified",
  "bail",
  "is-plain-obj",
  "trough",
  "vfile",
  "vfile-message",
  "devlop",
  "mdast-util-to-hast",
  "mdast-util-from-markdown",
  "mdast-util-gfm",
  "mdast-util-gfm-autolink-literal",
  "mdast-util-gfm-footnote",
  "mdast-util-gfm-strikethrough",
  "mdast-util-gfm-table",
  "mdast-util-gfm-task-list-item",
  "mdast-util-find-and-replace",
  "mdast-util-phrasing",
  "mdast-util-to-markdown",
  "mdast-util-to-string",
  "micromark",
  "micromark-core-commonmark",
  "micromark-extension-gfm",
  "micromark-extension-gfm-autolink-literal",
  "micromark-extension-gfm-footnote",
  "micromark-extension-gfm-strikethrough",
  "micromark-extension-gfm-table",
  "micromark-extension-gfm-tagfilter",
  "micromark-extension-gfm-task-list-item",
  "micromark-factory-destination",
  "micromark-factory-label",
  "micromark-factory-space",
  "micromark-factory-title",
  "micromark-factory-whitespace",
  "micromark-util-character",
  "micromark-util-chunked",
  "micromark-util-classify-character",
  "micromark-util-combine-extensions",
  "micromark-util-decode-numeric-character-reference",
  "micromark-util-decode-string",
  "micromark-util-encode",
  "micromark-util-html-tag-name",
  "micromark-util-normalize-identifier",
  "micromark-util-resolve-all",
  "micromark-util-sanitize-uri",
  "micromark-util-subtokenize",
  "micromark-util-symbol",
  "micromark-util-types",
  "unist-util-is",
  "unist-util-position",
  "unist-util-stringify-position",
  "unist-util-visit",
  "unist-util-visit-parents",
  "decode-named-character-reference",
  "character-entities",
  "property-information",
  "space-separated-tokens",
  "comma-separated-tokens",
  "estree-util-is-identifier-name",
  "html-url-attributes",
  "ccount",
  "escape-string-regexp",
  "markdown-table",
  "longest-streak",
  "trim-lines",
  "zwitch",
  "parse-entities",
  "stringify-entities",
  "character-entities-html4",
  "character-entities-legacy",
  "character-reference-invalid",
  "is-alphabetical",
  "is-alphanumerical",
  "is-decimal",
  "is-hexadecimal",
].join("|");

export default async function jestConfig() {
  const nextConfig = await createJestConfig(config)();

  // Next.js produces a pattern like:
  //   "/node_modules/(?!.pnpm)(?!(geist|next/dist/...)/)"
  // Inject our ESM packages into the inner negative-lookahead so Jest
  // transforms them instead of treating them as pre-compiled CJS.
  const transformIgnorePatterns = (nextConfig.transformIgnorePatterns ?? []).map((pattern) => {
    if (typeof pattern !== "string" || !pattern.includes("node_modules")) return pattern;
    return pattern.replace(/\(\?!\(([^)]+)\)\/\)/, `(?!($1|${esmPackages})/)`);
  });

  return {
    ...nextConfig,
    transformIgnorePatterns,
  };
}
