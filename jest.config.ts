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
      tsconfig: {
        types: ["jest", "node"]
      }
    }]
  },
  extensionsToTreatAsEsm: [".ts"]
};
export default config;