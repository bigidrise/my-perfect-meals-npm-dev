// Standalone: no application setup, advisor infrastructure or database clients.
module.exports = {
  rootDir: "../..",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/scripts/tests/auth-validation-safety.test.cjs",
    "<rootDir>/server/tests/developmentBillingWriteGuard.test.ts",
  ],
  setupFiles: ["<rootDir>/scripts/tests/offline.guard.cjs"],
  moduleNameMapper: {
    "^pg(/.*)?$": "<rootDir>/scripts/tests/forbidden-database.cjs",
    "^(openai|@anthropic-ai/sdk|@google/generative-ai|@google/genai|postgres|@neondatabase/serverless|axios|undici|@aws-sdk)(/.*)?$":
      "<rootDir>/scripts/tests/forbidden-module.cjs",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      diagnostics: false,
      tsconfig: { isolatedModules: true, target: "ES2022", module: "CommonJS", esModuleInterop: true, strict: true },
    }],
  },
  clearMocks: true,
};
