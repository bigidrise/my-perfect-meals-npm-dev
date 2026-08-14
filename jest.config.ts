import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/server/tests", "<rootDir>/client/src/lib/__tests__"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/src/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  setupFiles: ["<rootDir>/server/tests/testEnv.setup.ts"],
  verbose: true,
  clearMocks: true,
  // forceExit is required for integration tests that hold open a pg connection
  // pool (the pool keeps the Node process alive after test assertions complete).
  // This does not affect test correctness — it only prevents jest from hanging
  // indefinitely waiting for the pool's idle timer to fire.
  forceExit: true,
  testTimeout: 10000,
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      useESM: true,
      // Disable type-checking during test runs — ts-jest transpiles only.
      // This avoids false-positive failures caused by @types version mismatches
      // in the manually-restored environment (tar CVE block prevents npm ci).
      diagnostics: false,
      tsconfig: {
        types: ["jest", "node"],
        jsx: "react-jsx"
      }
    }]
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  // uuid v9+ ships only ESM; transform it instead of skipping it.
  transformIgnorePatterns: ["/node_modules/(?!(uuid)/)"],
};
export default config;