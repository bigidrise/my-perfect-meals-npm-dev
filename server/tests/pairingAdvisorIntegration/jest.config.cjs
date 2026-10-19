const offline = require("../pairingAdvisorOffline/jest.config.cjs");
module.exports = {
  ...offline,
  testMatch: ["<rootDir>/server/tests/pairingAdvisorIntegration/*.test.ts"],
  moduleNameMapper: {
    ...offline.moduleNameMapper,
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "(^|/)(db|storage|auditLog|safetyPinService)$":
      "<rootDir>/server/tests/pairingAdvisorOffline/forbidden-module.cjs",
  },
};
