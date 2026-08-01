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
    "^react-markdown$": "<rootDir>/src/__tests__/__mocks__/react-markdown.js",
    "^remark-gfm$": "<rootDir>/src/__tests__/__mocks__/remark-gfm.js",
    "^rehype-sanitize$": "<rootDir>/src/__tests__/__mocks__/rehype-sanitize.js",
  },
};

export default createJestConfig(config);
