import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/server/tests"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/src/$1",
  },
  setupFiles: ["<rootDir>/server/tests/testEnv.setup.ts"],
  verbose: true,
  clearMocks: true,
  testTimeout: 10000,
  globals: {
    "ts-jest": {
      useESM: true,
      tsconfig: {
        types: ["jest", "node"]
      }
    }
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      useESM: true
    }]
  },
  extensionsToTreatAsEsm: [".ts"]
};
export default config;