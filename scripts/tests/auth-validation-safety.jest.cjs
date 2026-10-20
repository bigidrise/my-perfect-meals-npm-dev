const offline = require("../../server/tests/pairingAdvisorOffline/jest.config.cjs");
const blockedModules = { ...offline.moduleNameMapper };
delete blockedModules["^(@aws-sdk|drizzle-orm)(/.*)?$"];
module.exports = {
  ...offline,
  rootDir: "../..",
  testMatch: [
    "<rootDir>/scripts/tests/auth-validation-safety.test.cjs",
    "<rootDir>/server/tests/developmentBillingWriteGuard.test.ts",
  ],
  // Billing regression fixtures use Drizzle only to build SQL for fake clients.
  // Real pg connections and all network transports remain unavailable.
  moduleNameMapper: {
    "^pg(/.*)?$": "<rootDir>/scripts/tests/forbidden-database.cjs",
    "^@aws-sdk(/.*)?$": "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    ...blockedModules,
  },
};
