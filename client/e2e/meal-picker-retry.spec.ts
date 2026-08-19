/**
 * Playwright — meal picker retry behavior
 *
 * CravingPicker and FixedMenuPicker are standalone components rather than
 * production routes. The webdriver-only harness mounts the real components;
 * this spec intercepts their sole generation request so the test can verify a
 * visible 503 failure followed by a successful retry without creating a meal
 * or calling any external generation service.
 */

import { test, expect, type Page } from "@playwright/test";

const FAKE_USER = {
  id: "e2e-picker-user",
  email: "picker-retry@playwright.example",
  username: "Picker Retry Tester",
  firstName: "Picker",
  lastName: "Tester",
  planLookupKey: "premium",
  entitlements: [],
  subscriptionStatus: "active",
  trialEndsAt: null,
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
  role: "client",
  accessTier: "PREMIUM",
  isAdmin: false,
  isProCare: false,
  isTester: true,
  preferredLanguage: "auto",
  measurementSystem: "imperial",
  countryCode: "US",
  medicalConditions: [],
  specialtyConditions: [],
  labDrivenConditions: [],
  allergies: [],
  dietaryRestrictions: [],
  avoidedFoods: [],
  sweetenerPreferences: [],
  fontSizePreference: "standard",
  narrationSpeedPreference: "1.0",
  physicianLocked: false,
  phase2GateEnabled: false,
  proCareEligible: false,
  monetizationEligible: false,
  isCreator: false,
  builderSwitchUnlocked: false,
  hasAllergyPin: false,
  procareTrainingCompleted: false,
  onboardingCompletedAt: new Date().toISOString(),
  age: 30,
  height: 170,
  weight: 70,
};

const SUCCESSFUL_MEAL = {
  meal: {
    id: "e2e-retry-meal",
    name: "E2E Retry Meal",
    description: "A deterministic meal returned after retrying.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
    ingredients: [],
    instructions: [],
    calories: 400,
    protein: 30,
    carbs: 40,
    fats: 12,
  },
};

const ORG_CONFIG = {
  id: "e2e-picker-org",
  slug: "e2e-picker-org",
  name: "E2E Picker Organization",
  activeStatus: "active",
  organizationType: "public",
  dataAccessMode: "standalone",
  appName: "My Perfect Meals",
  appShortName: "MPM",
  supportEmail: "support@myperfectmeals.ai",
  supportUrl: null,
  primaryColor: "#f97316",
  secondaryColor: "#ea580c",
  accentColor: null,
  logoUrl: null,
  logoDarkUrl: null,
  onboardingHeadline: null,
  poweredByVisible: true,
  customDomain: null,
  featureFlags: {
    whiteLabelMode: false,
    customBranding: false,
    physicianDashboard: false,
    providerMessaging: false,
    medicalRecordIntegration: false,
    diabeticHub: true,
    glp1Support: true,
    partnerMarketplace: false,
    productRecommendations: false,
    oncologySupport: false,
    coachTools: true,
    biometricTracking: true,
    requireAcademy: true,
    requireProfessionalVerification: true,
  },
  isDefault: true,
  isWhiteLabel: false,
};

async function mockHarnessInfrastructure(page: Page) {
  await page.addInitScript((fakeUser) => {
    localStorage.setItem("mpm_auth_token", "e2e-picker-retry-token");
    localStorage.setItem("mpm_current_user", JSON.stringify(fakeUser));
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("mpm.skipWelcomeGate", "true");
  }, FAKE_USER);

  // Prevent the app shell from touching development services during this UI
  // test. One route handler avoids overlapping Playwright route precedence.
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/user/profile"
        ? FAKE_USER
        : path === "/api/auth/session"
          ? { authenticated: true }
          : path === "/api/org/config"
            ? ORG_CONFIG
            : {};

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function mockGenerationFailureThenSuccess(page: Page) {
  let generationCalls = 0;

  await page.route("**/api/meals/craving-creator", (route) => {
    generationCalls += 1;

    if (generationCalls === 1) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "The meal service is temporarily unavailable.",
        }),
      });
    }

    if (generationCalls === 2) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SUCCESSFUL_MEAL),
      });
    }

    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unexpected extra generation request." }),
    });
  });

  return () => generationCalls;
}

async function verifyRetryFlow(
  page: Page,
  openPickerTestId: "open-craving-picker" | "open-fixed-menu-picker",
  initialActionName: string,
) {
  const generationCalls = await mockGenerationFailureThenSuccess(page);

  await page.goto("/__e2e/meal-picker-retry");
  await page.getByTestId(openPickerTestId).click();
  await page.getByRole("button", { name: initialActionName }).click();

  await expect(page.getByText(/Meal generation failed\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  await expect(
    page.getByText("No options fit your current plan"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Try Again" }).click();

  await expect(page.getByText("E2E Retry Meal")).toBeVisible();
  await expect(page.getByText(/Meal generation failed\./)).toHaveCount(0);
  await expect(generationCalls()).toBe(2);
}

test.describe("Meal picker retry behavior", () => {
  test.beforeEach(async ({ page }) => {
    await mockHarnessInfrastructure(page);
  });

  test("CravingPicker gives a clear retryable error and recovers", async ({
    page,
  }) => {
    await verifyRetryFlow(
      page,
      "open-craving-picker",
      "Generate Breakfast Option",
    );
  });

  test("FixedMenuPicker gives a clear retryable error and recovers", async ({
    page,
  }) => {
    await verifyRetryFlow(page, "open-fixed-menu-picker", "Add Meal");
  });
});
