/**
 * Playwright — Camera barcode scan → BarcodeDatabaseBadge invariant
 *
 * Verifies that the camera-scan path (MobileBarcodeCamera → onBarcode →
 * lookupAndOpenBarcode) correctly stamps resolvedFromDb onto the result so
 * IngredientIntelligenceSheet renders the right badge:
 *
 *   Case 1 (resolvedFromDb: true)  → "Database match · Open Food Facts" (green)
 *   Case 2 (resolvedFromDb: false) → "Not in database · AI estimate"    (amber)
 *
 * MobileBarcodeCamera requires real hardware / BarcodeDetector API, so the
 * test drives the camera path via window.__mpmFireCameraBarcode — a hook wired
 * by ShoppingListMasterView exclusively when navigator.webdriver === true
 * (Playwright's automation flag).  The hook calls the same lookupAndOpenBarcode
 * function that onBarcode invokes, so all downstream logic is exercised.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Shared fake user ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: "test-barcode-badge-user",
  email: "barcode-badge@playwright.example",
  username: "Barcode Tester",
  firstName: "Barcode",
  lastName: "Tester",
  planLookupKey: "premium",
  entitlements: ["grocery_coach"],
  subscriptionStatus: "active",
  trialEndsAt: null,
  isEmailVerified: true,
  createdAt: new Date().toISOString(),
  role: "client",
  accessTier: "PREMIUM",
  isAdmin: false,
  isProCare: false,
  isTester: false,
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
};

// ── Minimal scan result the barcode API returns ───────────────────────────────

function makeBarcodeScanResult(overrides: Record<string, unknown> = {}) {
  return {
    productName: "Organic Whole Milk",
    alignmentGrade: "B",
    verdictLevel: "buy",
    analysisMethod: "by_label",
    scoreCards: {
      kids:        { verdict: "thumbsUp", reason: "Good calcium source" },
      adults:      { verdict: "thumbsUp", reason: "Whole-food dairy" },
      diet:        { verdict: "neutral",  reason: "Fits most diets" },
      fitnessGoal: { verdict: "thumbsUp", reason: "Protein and fat balance" },
    },
    outcomeCards: [],
    goodThings: [],
    watchOut: [],
    profileInsights: [],
    ingredientDecoder: [],
    betterAlternatives: [],
    profileFactors: [],
    whatMattersMost: [],
    ...overrides,
  };
}

// ── Route helpers ─────────────────────────────────────────────────────────────

/** Mock all auth + infrastructure routes so the page can mount. */
async function mockInfraRoutes(page: Page) {
  await page.route("/api/user/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    })
  );

  await page.route("/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true }),
    })
  );

  await page.route("/api/org/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ featureFlags: {} }),
    })
  );

  await page.route("/api/user/preferences", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    })
  );

  // Shopping list — return empty so the page hydrates quickly
  await page.route("/api/shopping-list", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  await page.route("/api/shopping-list-v2/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  // Saved groceries — not relevant to this test
  await page.route("/api/saved-groceries", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  // Catch-all for any other API route (walking-tour, feature flags, etc.)
  await page.route("/api/**", (route) => {
    // Only fulfill if not already handled
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

/** Open the Scan Barcode modal and switch to Camera mode. */
async function openBarcodeModalCameraMode(page: Page) {
  await page.click('[data-testid="button-barcode-scan"]');
  // The modal appears — switch to camera mode
  await page.getByText("Camera").click();
}

/**
 * Simulate MobileBarcodeCamera firing onBarcode(code) by calling the test
 * hook that ShoppingListMasterView exposes when navigator.webdriver is true.
 */
async function fireCameraBarcode(page: Page, code: string) {
  await page.evaluate((barcode: string) => {
    const hook = (window as any).__mpmFireCameraBarcode;
    if (typeof hook !== "function") {
      throw new Error(
        "__mpmFireCameraBarcode hook not found — " +
        "ShoppingListMasterView only exposes it when navigator.webdriver === true"
      );
    }
    hook(barcode);
  }, code);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Camera barcode scan → BarcodeDatabaseBadge", () => {
  test(
    'shows "Database match · Open Food Facts" badge when resolvedFromDb is true',
    async ({ page }) => {
      await mockInfraRoutes(page);

      // Mock barcode API — product found in Open Food Facts
      await page.route("/api/biometrics/ingredient-scan-by-barcode", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            resolvedFromDb: true,
            resolvedName: "Organic Whole Milk (Open Food Facts)",
            result: makeBarcodeScanResult(),
          }),
        })
      );

      await page.goto("/shopping-list");

      // Wait for the page shell to be ready
      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      await openBarcodeModalCameraMode(page);

      // Simulate a camera barcode detection
      await fireCameraBarcode(page, "012000030901");

      // IngredientIntelligenceSheet should open and show the DB match badge
      await expect(
        page.getByText("Database match · Open Food Facts")
      ).toBeVisible({ timeout: 8_000 });
    }
  );

  test(
    'shows "Not in database · AI estimate" badge when resolvedFromDb is false',
    async ({ page }) => {
      await mockInfraRoutes(page);

      // Mock barcode API — barcode not found in DB, AI estimate used
      await page.route("/api/biometrics/ingredient-scan-by-barcode", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            resolvedFromDb: false,
            resolvedName: null,
            result: makeBarcodeScanResult({ productName: "Unknown Brand Crackers" }),
          }),
        })
      );

      await page.goto("/shopping-list");

      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      await openBarcodeModalCameraMode(page);

      await fireCameraBarcode(page, "099999999999");

      // IngredientIntelligenceSheet should open and show the AI estimate badge
      await expect(
        page.getByText("Not in database · AI estimate")
      ).toBeVisible({ timeout: 8_000 });
    }
  );
});
