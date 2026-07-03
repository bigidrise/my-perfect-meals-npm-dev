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
        "no-restricted-imports": ["error", {
          "paths": [{
            "name": "@/components/ui/dialog",
            "importNames": ["DialogContent"],
            "message": "Do not import DialogContent directly. Use a typed component from @/components/ui/universal-modal instead (FormModal, InformationModal, PickerModal, ConfirmationModal, WorkflowModal, WizardModal, or UniversalDialog). Only universal-modal.tsx may import DialogContent."
          }]
        }],
        "no-restricted-globals": ["error", {
          "name": "fetch",
          "message": "Use apiRequest() from @/lib/queryClient instead of raw fetch(). Raw fetch bypasses auth headers and session tokens."
        }],
        "no-restricted-syntax": ["warn", {
          "selector": "JSXAttribute[name.name='rawLayout']",
          "message": "rawLayout bypasses the Universal Modal layout system. Use a typed component instead (InformationModal, FormModal, ConfirmationModal, WorkflowModal, etc.). Only BreakfastMealsHub and MealHubFactory have documented rawLayout exceptions."
        }]
      }
    },
    {
      files: [
        "client/src/components/ui/universal-modal.tsx",
        "client/src/components/ui/command.tsx"
      ],
      rules: {
        "no-restricted-imports": "off"
      }
    },
    {
      files: [
        "**/BreakfastMealsHub.tsx",
        "**/MealHubFactory.tsx"
      ],
      rules: {
        "no-restricted-syntax": "off"
      }
    },
    {
      files: ["client/src/lib/queryClient.ts"],
      rules: {
        "no-restricted-globals": "off"
      }
    }
  ]
};