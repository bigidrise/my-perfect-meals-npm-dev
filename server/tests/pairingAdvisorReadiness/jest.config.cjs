const safety = require("../pairingAdvisorSafety/jest.config.cjs");
module.exports = {
  ...safety,
  testMatch: ["<rootDir>/server/tests/pairingAdvisorReadiness/*.test.ts"],
};
