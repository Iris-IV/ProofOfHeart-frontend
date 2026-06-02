import nextJest from "next/jest.js";
import type { Config } from "jest";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/tests/"],
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/types/**",
  ],
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

const markdownEsmPattern =
  "node_modules/(?!(react-markdown|remark-gfm|rehype-sanitize|hast-util-sanitize|unist-util-visit|unified|bail|is-plain-obj|trough|vfile|vfile-message|devlop|remark-parse|remark-rehype|mdast-util-to-hast|mdast-util-from-markdown|mdast-util-gfm|micromark|micromark-extension-gfm|decode-named-character-reference|character-entities|property-information|hast-util-to-jsx-runtime|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|estree-util-is-identifier-name|html-url-attributes|ccount|escape-string-regexp|markdown-table|longest-streak|trim-lines|zwitch)/)";

export default async function jestConfig() {
  const nextConfig = await createJestConfig(config)();
  return {
    ...nextConfig,
    transformIgnorePatterns: [
      ...(nextConfig.transformIgnorePatterns ?? []),
      markdownEsmPattern,
    ],
  };
}
