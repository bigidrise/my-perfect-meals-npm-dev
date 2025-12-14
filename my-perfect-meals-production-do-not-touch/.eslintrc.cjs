module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // No direct OpenAI imports anywhere except our safe wrapper
    "no-restricted-imports": ["error", {
      "paths": [{
        "name": "openai",
        "message": "Import OpenAI only inside server/utils/openaiSafe.ts or mealEngineService tests. Use MealEngineService instead."
      }]
    }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error",
  },
  overrides: [
    {
      files: [
        "server/utils/openaiSafe.ts", 
        "server/tests/**/*",
        "server/services/mealEngineService.ts"
      ],
      rules: { 
        "no-restricted-imports": "off",
        "@typescript-eslint/no-explicit-any": "off"
      }
    },
    {
      files: ["client/**/*"],
      env: {
        browser: true,
        node: false,
      },
      rules: {
        "no-restricted-imports": "off" // Frontend can import what it needs
      }
    }
  ]
};