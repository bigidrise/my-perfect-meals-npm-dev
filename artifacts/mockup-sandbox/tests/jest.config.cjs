const offline = require("../../../server/tests/pairingAdvisorOffline/jest.config.cjs");
module.exports = {
  ...offline,
  rootDir: "../../..",
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/artifacts/mockup-sandbox/tests/*.test.ts", "<rootDir>/artifacts/mockup-sandbox/tests/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/artifacts/mockup-sandbox/tests/setup.cjs"],
  moduleNameMapper: {
    ...offline.moduleNameMapper,
    "^@/(.*)$": "<rootDir>/artifacts/mockup-sandbox/src/$1",
    "\\.css$": "<rootDir>/artifacts/mockup-sandbox/tests/styleStub.cjs",
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
};
