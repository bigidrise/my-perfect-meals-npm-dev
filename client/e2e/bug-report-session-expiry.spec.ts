/**
 * Playwright — BugReportButton session-expiry invariant
 *
 * The BugReportButton has a documented session guard: `if (!user) return null`.
 * This unmounts the entire component tree (button + any open BugReportModal)
 * whenever the AuthContext user becomes null.
 *
 * These tests verify that behaviour in a real browser:
 *   1. The button renders when the user is authenticated.
 *   2. Clicking the button opens the BugReportModal dialog.
 *   3. When the session expires mid-typing (mpm:polling-auth-rejected event),
 *      React re-renders with user=null and *both* the button and the open dialog
 *      disappear from the DOM — even though no page reload has occurred.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Minimal fake user the mock profile endpoint returns ───────────────────────
const FAKE_USER = {
  id: "test-session-expiry-user",
  email: "session-test@playwright.example",
  username: "Session Tester",
  firstName: "Session",
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

// ── Shared helper: mock the minimum auth + common API routes ─────────────────
async function mockAuthAndCommonRoutes(page: Page) {
  // Profile — the primary auth signal for AuthContext
  await page.route("/api/user/profile", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    })
  );

  // Session probe
  await page.route("/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true }),
    })
  );

  // Silence org / preferences so the dashboard can hydrate
  await page.route("/api/org/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ featureFlags: {} }),
    })
  );
  await page.route("/api/user/preferences", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  // Wildcard fallback for any other /api/* calls the dashboard makes
  await page.route("/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
}

// ── Shared helper: inject an auth token + cached user into localStorage ───────
// AuthContext reads these on mount; we set them before any page script runs.
async function injectAuthToken(page: Page) {
  await page.addInitScript((fakeUser) => {
    localStorage.setItem("mpm_auth_token", "test-token-session-expiry");
    localStorage.setItem("mpm_current_user", JSON.stringify(fakeUser));
    localStorage.setItem("isAuthenticated", "true");
  }, FAKE_USER);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe("BugReportButton — session expiry", () => {
  test("button and open dialog both disappear when user becomes null mid-typing", async ({
    page,
  }) => {
    // ── 1. Set up auth before the page loads ────────────────────────────────
    await injectAuthToken(page);
    await mockAuthAndCommonRoutes(page);

    // ── 2. Navigate; the app starts in an authenticated state ────────────────
    await page.goto("/");

    // ── 3. Bug report button must be visible for an authenticated user ───────
    const bugButton = page.getByTestId("bug-report-button");
    await expect(bugButton).toBeVisible({ timeout: 10_000 });

    // ── 4. Click to open the modal (simulates "mid-typing" state) ────────────
    await bugButton.click();

    // Radix UI Dialog renders with role="dialog" — confirm it is present.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // ── 5. Intercept the /login redirect so the SPA doesn't fully reload ─────
    // When mpm:polling-auth-rejected fires, AuthContext calls setUser(null)
    // and then does `window.location.href = "/login"` (a full page reload).
    // Aborting that network request keeps the React tree alive so we can
    // assert the DOM state produced by the user=null re-render.
    await page.route("**/login**", (route) => route.abort());

    // ── 6. Simulate session expiry ───────────────────────────────────────────
    // Dispatching this event triggers AuthContext's handlePollingAuthRejected,
    // which calls setUser(null), clears the auth token, then attempts the
    // /login redirect (which is now aborted above).
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("mpm:polling-auth-rejected"));
    });

    // ── 7. After React re-renders with user=null, both elements must be gone ─
    await expect(bugButton).not.toBeVisible({ timeout: 5_000 });
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test("button is absent for an unauthenticated user (null guard baseline)", async ({
    page,
  }) => {
    // No auth token, no mocked profile — the app starts unauthenticated.
    await page.route("/api/user/profile", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"Unauthorized"}' })
    );
    await page.route("/api/auth/session", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"Unauthorized"}' })
    );
    await page.route("/api/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    );

    await page.goto("/");

    // Give the page time to finish its auth check
    await page.waitForTimeout(2_000);

    // The bug report button must NOT be present for an unauthenticated visitor.
    await expect(page.getByTestId("bug-report-button")).not.toBeVisible();
  });
});
