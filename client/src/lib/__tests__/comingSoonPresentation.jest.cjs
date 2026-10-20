module.exports = {
  ...require("../../../../server/tests/pairingAdvisorOffline/jest.config.cjs"),
  rootDir: "../../../..",
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/client/src/lib/__tests__/comingSoonPresentation.test.tsx",
    "<rootDir>/client/src/lib/__tests__/pregnancyAvailability.test.tsx",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/src/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transform: {
    "^.+/node_modules/react(?:-dom)?/.+\\.js$": "<rootDir>/artifacts/mockup-sandbox/tests/reactFixtureTransform.cjs",
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
