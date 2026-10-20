const offline = require("../pairingAdvisorOffline/jest.config.cjs");
module.exports = {
  ...offline,
  testMatch: ["<rootDir>/server/tests/pairingAdvisorSafety/*.test.ts"],
  moduleNameMapper: {
    // Real Drizzle schema/operators may load; real drivers, clients and providers may not.
    ...Object.fromEntries(Object.entries(offline.moduleNameMapper)
      .filter(([pattern]) => !pattern.includes("drizzle-orm"))),
    "^@aws-sdk(/.*)?$": "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
    "^(express-session|connect-pg-simple|memorystore|connect-redis)$":
      "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "(^|/)db$": "<rootDir>/server/tests/pairingAdvisorSafety/storageStub.cjs",
  },
};
