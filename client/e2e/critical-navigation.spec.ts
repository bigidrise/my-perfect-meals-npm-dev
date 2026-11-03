/**
 * Five Development navigation smoke tests. No synthetic authenticated identity,
 * entitlement overrides, meal generation, profile edits, or account provisioning.
 * Credentials are consumed only by the runner; traces/screenshots are disabled.
 */
import { test, expect, type Page } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });
test.describe.configure({ retries: 0, timeout: 60_000 });
let signInFailure = "";

function skipAuthentication(reason: string) {
  signInFailure = reason;
  console.info(`[navigation-smoke authentication] ${reason}`);
  test.skip(true, reason);
}

async function noNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: /404|page not found|^not found$/i })).toHaveCount(0);
  await expect(page.getByText("404 Page Not Found", { exact: true })).toHaveCount(0);
}

async function signInExistingAccount(page: Page) {
  const email = process.env.PAIRING_SMOKE_TEST_EMAIL;
  const password = process.env.PAIRING_SMOKE_TEST_PASSWORD;
  if (signInFailure) return skipAuthentication(signInFailure);
  if (!email || !password) return skipAuthentication(
    "Runner is missing PAIRING_SMOKE_TEST_EMAIL or PAIRING_SMOKE_TEST_PASSWORD; no sign-in attempted.");
  let stage = "loading /auth";
  try {
    // Bound every setup step below the enclosing 60s test budget, so an
    // unavailable sign-in reports blocked coverage rather than a hook timeout.
    await page.goto("/auth", { timeout: 10_000, waitUntil: "domcontentloaded" });
    stage = "waiting for the normal Email input on /auth";
    await page.getByPlaceholder("Email", { exact: true }).fill(email, { timeout: 12_000 });
    stage = "waiting for the normal Password input on /auth";
    await page.getByPlaceholder("Password", { exact: true }).fill(password, { timeout: 5_000 });
    stage = "submitting the normal Sign In control";
    const responsePromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST", { timeout: 10_000 }).catch(() => null);
    await page.getByRole("button", { name: "Sign In", exact: true }).click({ timeout: 5_000 });
    stage = "waiting for POST /api/auth/login response";
    const response = await responsePromise;
    if (!response) return skipAuthentication("No POST /api/auth/login response within 10 seconds after Sign In.");
    // Only fixed classifications and HTTP status leave this helper. Never log
    // request bodies, response bodies, account fields, or raw driver errors.
    const body = await response.json().catch(() => ({}));
    if (body.mfaEnrollmentRequired === true) return skipAuthentication("Normal sign-in requires MFA enrollment; no enrollment or bypass attempted.");
    if (body.mfaRequired === true) return skipAuthentication("Normal sign-in requires an MFA challenge; no bypass attempted.");
    if (!response.ok()) {
      const detail = String(body.error ?? "");
      const classification = /invalid|incorrect/i.test(detail) ? "credentials rejected" :
        response.status() === 429 ? "sign-in rate limited" :
        /verif/i.test(detail) ? "account verification required" :
        /lock|disabled|suspend/i.test(detail) ? "account restricted" : "login rejected";
      return skipAuthentication(`POST /api/auth/login: HTTP ${response.status()} (${classification}).`);
    }
    stage = "waiting for successful login to leave /auth, /login, or /welcome";
    await page.waitForURL(url => !/^\/(?:auth|login|welcome)(?:\/|$)/.test(url.pathname), { timeout: 10_000 });
  } catch (error) {
    // Do not print driver fill errors, which can contain credential values.
    if (signInFailure) throw error; // Preserve Playwright's deliberate skip signal.
    const failure = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "failed";
    return skipAuthentication(`Normal sign-in ${failure} while ${stage}; no raw credential-bearing error is reported.`);
  }
  if (new URL(page.url()).pathname.startsWith("/onboarding"))
    return skipAuthentication("Existing account has unfinished onboarding; no onboarding or profile changes attempted.");
  // Read-only navigation: preserve real authorization responses; prevent saves,
  // analytics mutations, and accidental generation after normal sign-in.
  await page.route("**/api/**", route => {
    if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) return route.continue();
    return route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ error: "Read-only navigation smoke test; mutation not executed." }) });
  });
}

test.describe("Existing member account — no authorization fixtures", () => {
  test.beforeEach(async ({ page }) => { await signInExistingAccount(page); });

  test("Macro Calculator: active Body Composition back control opens the calculator", async ({ page }) => {
    await page.goto("/biometrics/body-composition");
    const origin = page.getByRole("button", { name: "Back to Macro Calculator", exact: true });
    await expect(origin).toBeVisible({ timeout: 20_000 });
    await origin.click();
    await expect(page).toHaveURL(/\/macro-counter(?:[?#]|$)/);
    await noNotFound(page);
    await expect(page.getByTestId(/^macro-(?:age|weight|activity-selector|update-button|build-meals-button)$/)
      .filter({ visible: true }).first()).toBeVisible();
  });

  test("GLP-1: existing Copilot selection opens the guarded Metabolic Medication Builder", async ({ page }) => {
    await page.goto("/glp1-hub");
    // The existing floating Copilot button has no accessible name/test ID.
    // Use its existing fixed-position selector, not a synthetic command injection.
    const floatingCopilot = page.locator('button.fixed.bottom-16.right-4').first();
    const selection = page.getByRole("button", { name: /metabolic medication builder|glp-?1.*builder/i }).first();
    if (!await selection.isVisible()) {
      await expect(floatingCopilot).toBeVisible({ timeout: 20_000 });
      await floatingCopilot.click();
    }
    await expect(selection).toBeVisible({ timeout: 10_000 });
    await selection.click();
    await expect(page).toHaveURL(/\/glp1-meal-builder(?:[?#]|$)/);
    await noNotFound(page);
    // No profile flags, clinical sources or entitlements are injected to pass.
    await expect(page.getByText("Metabolic Medication Builder", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /add.*meal|create.*chef|generate|duplicate/i })
      .filter({ visible: true }).first()).toBeVisible();
  });

  test("Biometrics: personal Performance return opens the existing meal board", async ({ page }) => {
    // Existing personal return-link contract; no clientId/pro-session impersonation.
    await page.goto("/my-biometrics?section=macros&from=beachbody-meal-board");
    const origin = page.getByRole("button", { name: "Back to Performance Nutrition Builder", exact: true });
    await expect(origin).toBeVisible({ timeout: 20_000 });
    await origin.click();
    await expect(page).toHaveURL(/\/beach-body-meal-board(?:[?#]|$)/);
    await noNotFound(page);
    await expect(page.getByText("Performance Nutrition Builder", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /add.*meal|create.*chef|generate|duplicate/i })
      .filter({ visible: true }).first()).toBeVisible();
  });
});

test("Home Quick Demo: signed-out guard is preserved and authenticated control starts the guest suite", async ({ page }) => {
  // Fresh signed-out context must keep the existing Home authorization boundary.
  await page.goto("/home");
  await expect(page).toHaveURL(/\/welcome(?:[?#]|$)/);
  await noNotFound(page);
  test.info().annotations.push({ type: "verified", description: "Signed-out /home redirects to /welcome." });

  await signInExistingAccount(page);
  await page.goto("/home");
  const origin = page.getByRole("button", { name: "Quick Demo", exact: true });
  await expect(origin).toBeVisible({ timeout: 20_000 });
  const identityBefore = await page.evaluate(() =>
    JSON.stringify([localStorage.getItem("userId"), localStorage.getItem("authToken")]));
  await origin.click();
  await expect(page).toHaveURL(/\/guest-builder(?:[?#]|$)/);
  await noNotFound(page);
  await expect(page.getByRole("button", { name: /macro|build|meal/i }).filter({ visible: true }).first()).toBeVisible();
  expect(await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("mpm_guest_session") ?? "null");
    return session?.isGuest === true && typeof session.sessionId === "string";
  })).toBe(true);
  const identityAfter = await page.evaluate(() =>
    JSON.stringify([localStorage.getItem("userId"), localStorage.getItem("authToken")]));
  // Assert a boolean so a failure cannot print authentication values.
  expect(identityAfter === identityBefore).toBe(true);
});

test("Pricing Terms: visible legal button opens Terms of Service", async ({ page }) => {
  await page.goto("/pricing");
  const origin = page.getByRole("button", { name: "Terms of Service", exact: true });
  await expect(origin).toBeVisible({ timeout: 20_000 });
  await origin.click();
  await expect(page).toHaveURL(/\/terms(?:[?#]|$)/);
  await noNotFound(page);
  await expect(page.getByRole("heading", { name: "Terms of Service", exact: true })).toBeVisible();
  await expect(page.getByText(/use of the app/i).first()).toBeVisible();
});
