// Standalone suite: intentionally excludes the application's environment/database setup.
module.exports = {
  rootDir: "../../..",
  testEnvironment: "node",
  testMatch: ["<rootDir>/server/tests/pairingAdvisorOffline/*.test.ts"],
  setupFiles: ["<rootDir>/server/tests/pairingAdvisorOffline/offline.guard.cjs"],
  moduleNameMapper: {
    "^(openai|@anthropic-ai/sdk|@google/generative-ai|@google/genai|pg|postgres|@neondatabase/serverless|axios|undici)(/.*)?$":
      "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
    "^(@aws-sdk|drizzle-orm)(/.*)?$":
      "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      diagnostics: false,
      tsconfig: {
        isolatedModules: true, target: "ES2022", module: "CommonJS",
        esModuleInterop: true, strict: true,
      },
    }],
  },
  clearMocks: true,
};
