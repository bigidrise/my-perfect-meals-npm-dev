const offline = require("../../../../scripts/tests/auth-validation-safety.jest.cjs");
module.exports = {
  ...offline,
  rootDir: "../../../..",
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/client/src/lib/__tests__/comingSoonPresentation.test.tsx",
    "<rootDir>/client/src/lib/__tests__/pregnancyAvailability.test.tsx",
  ],
  moduleNameMapper: {
    ...offline.moduleNameMapper,
    "^@/(.*)$": "<rootDir>/client/src/$1",
  },
  transform: {
    "^.+/node_modules/react(?:-dom)?/.+\\.js$": "<rootDir>/scripts/tests/react-fixture-transform.cjs",
    "^.+\\.tsx?$": ["ts-jest", {
      diagnostics: false,
      tsconfig: {
        isolatedModules: true, target: "ES2022", module: "CommonJS",
        jsx: "react-jsx", esModuleInterop: true, strict: true,
      },
    }],
  },
  transformIgnorePatterns: ["/node_modules/(?!react/|react-dom/)"],
  clearMocks: true,
};
