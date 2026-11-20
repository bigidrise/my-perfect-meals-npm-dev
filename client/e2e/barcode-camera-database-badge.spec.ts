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
import type { IngredientScanResult } from "../src/lib/photoIngredientCapture";

// Synthetic 32-byte base64url token matching the real session CSRF contract.
const FAKE_CSRF_TOKEN = Buffer.alloc(32, 0x42).toString("base64url");

// ── Shared fake user ──────────────────────────────────────────────────────────

const FAKE_USER = {
  id: "test-barcode-badge-user",
  email: "barcode-badge@playwright.example",
  username: "Barcode Tester",
  firstName: "Barcode",
  lastName: "Tester",
  planLookupKey: "mpm_premium",
  entitlements: ["grocery_coach"],
  subscriptionStatus: "active",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  hasSavedMacroProfile: true,
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

// ── Complete scan result the barcode API returns ──────────────────────────────

function makeBarcodeScanResult(
  overrides: Partial<IngredientScanResult> = {}
): IngredientScanResult {
  const productName = overrides.productName ?? "Organic Whole Milk";
  const verificationNote =
    "Name-based product guidance, not a verified label scan. Check the current ingredient list, allergens, nutrition label, and serving size.";
  return {
    productName,
    alignmentGrade: "B",
    gradeUnavailable: true,
    overallSummary: `${productName}: product information is unverified until the current package label is checked.`,
    verdict: "For consideration only — confirm the current label before choosing.",
    verdictLevel: "caution",
    analysisMethod: "by_name",
    scoreCards: {
      kids:        { verdict: "neutral", reason: "Check the current label and each child's needs." },
      adults:      { verdict: "neutral", reason: "Review ingredients and serving size." },
      diet:        { verdict: "neutral", reason: "Dietary fit requires the current ingredient label." },
      fitnessGoal: { verdict: "neutral", reason: "Confirm nutrition values before assessing goal fit." },
    },
    outcomeCards: [],
    analysisProfile: [],
    ingredientDecoder: [],
    ingredientConsiderations: [verificationNote],
    mayNotAlignWith: [],
    betterFor: [],
    householdNotes: [],
    educationalFooter: `${verificationNote} General wellness education, not medical advice.`,
    extractedIngredients: [],
    highRiskFindings: [],
    ocrConfidenceLow: false,
    fallbackUsed: false,
    isFrontLabel: false,
    productNameMissing: false,
    betterAlternatives: [],
    profileFactorsUsed: [],
    whatMattersMost: [],
    ...overrides,
  };
}

// ── Route helpers ─────────────────────────────────────────────────────────────

/** Mock all auth + infrastructure routes so the page can mount. */
async function mockInfraRoutes(page: Page) {
  // Playwright evaluates the last matching handler first. Register the
  // fallback before specific mocks so it cannot shadow authentication.
  await page.route("/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    })
  );

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

  await page.route("/api/auth/csrf", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ csrfToken: FAKE_CSRF_TOKEN }),
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

}

/** Complete the normal first-session welcome choice before opening Shopping List. */
async function openShoppingListAfterWelcome(page: Page) {
  await page.goto("/shopping-list");
  await page.getByRole("button", { name: /Explore on My Own/ }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[?#].*)?$/, { timeout: 10_000 });
  await page.goto("/shopping-list");
  await expect(page.getByTestId("button-barcode-scan")).toBeVisible({ timeout: 10_000 });
}

/** Expand the sheet's existing disclosure before checking its barcode badge. */
async function expandIngredientAnalysisDetails(page: Page) {
  const details = page.getByRole("button", { name: /More Analysis Details/i });
  await expect(details).toBeVisible({ timeout: 8_000 });
  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("analysis-details")).toBeVisible();
}

/** Open the Scan Barcode modal and switch to Camera mode. */
async function openBarcodeModalCameraMode(page: Page) {
  await page.click('[data-testid="button-barcode-scan"]');
  // The modal appears — switch to camera mode
  await page.getByText("Camera").click();
}

/**
 * Open the Scan Barcode modal in Manual (default) mode.
 * The modal always opens in manual mode, so no tab switch is needed.
 */
async function openBarcodeModalManualMode(page: Page) {
  await page.click('[data-testid="button-barcode-scan"]');
  // The modal opens in manual mode by default — input is immediately visible
  await expect(page.getByTestId("input-barcode")).toBeVisible({ timeout: 5_000 });
}

/**
 * Type a barcode into the manual input and click "Look Up".
 */
async function typeAndSubmitBarcode(page: Page, code: string) {
  await page.getByTestId("input-barcode").fill(code);
  await page.getByTestId("button-add-barcode").click();
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

      await openShoppingListAfterWelcome(page);

      // Wait for the page shell to be ready
      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      await openBarcodeModalCameraMode(page);

      // Simulate a camera barcode detection
      await fireCameraBarcode(page, "012000030901");

      await expandIngredientAnalysisDetails(page);

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

      await openShoppingListAfterWelcome(page);

      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      await openBarcodeModalCameraMode(page);

      await fireCameraBarcode(page, "099999999999");

      await expandIngredientAnalysisDetails(page);

      // IngredientIntelligenceSheet should open and show the AI estimate badge
      await expect(
        page.getByText("Not in database · AI estimate")
      ).toBeVisible({ timeout: 8_000 });
    }
  );
});

// ── Manual barcode entry tests ─────────────────────────────────────────────────

test.describe("Manual barcode entry → BarcodeDatabaseBadge", () => {
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

      await openShoppingListAfterWelcome(page);

      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      // Open the modal in manual (default) mode
      await openBarcodeModalManualMode(page);

      // Type the barcode and submit via the "Look Up" button
      await typeAndSubmitBarcode(page, "012000030901");

      await expandIngredientAnalysisDetails(page);

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

      await openShoppingListAfterWelcome(page);

      await expect(
        page.getByTestId("button-barcode-scan")
      ).toBeVisible({ timeout: 10_000 });

      // Open the modal in manual (default) mode
      await openBarcodeModalManualMode(page);

      // Type the barcode and submit by pressing Enter
      await page.getByTestId("input-barcode").fill("099999999999");
      await page.getByTestId("input-barcode").press("Enter");

      await expandIngredientAnalysisDetails(page);

      // IngredientIntelligenceSheet should open and show the AI estimate badge
      await expect(
        page.getByText("Not in database · AI estimate")
      ).toBeVisible({ timeout: 8_000 });
    }
  );
});
