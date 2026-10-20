module.exports = {
  rootDir: "../../../..",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/client/src/demo-studio/__tests__/isolation.test.ts",
    "<rootDir>/client/src/demo-studio/__tests__/liveApiBoundary.test.ts",
    "<rootDir>/client/src/demo-studio/__tests__/authProvider.test.tsx",
    "<rootDir>/client/src/demo-studio/__tests__/runtimeBarriers.test.ts",
    "<rootDir>/client/src/demo-studio/__tests__/navigation.test.ts",
    "<rootDir>/client/src/lib/__tests__/fetch-credentials-patch.test.ts",
    "<rootDir>/server/tests/authCredentialPrecedence.test.ts",
    "<rootDir>/server/tests/authSecurityStateIssuance.test.ts",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/src/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
  },
  transform: {
    "^.+/node_modules/react(?:-dom)?/.+\\.js$": "<rootDir>/client/src/demo-studio/__tests__/reactTestTransform.cjs",
    "^.+\\.tsx?$": ["ts-jest", {
    diagnostics: false,
    tsconfig: { isolatedModules: true, target: "ES2022", module: "CommonJS",
      jsx: "react-jsx", esModuleInterop: true, strict: true },
  }] },
  transformIgnorePatterns: ["/node_modules/(?!react/|react-dom/)"],
  clearMocks: true,
  modulePathIgnorePatterns: ["<rootDir>/.local/", "<rootDir>/artifacts/"],
};
