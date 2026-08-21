/**
 * InspirationCaptureModal — Responsive Viewport Regression Guard
 *
 * Reference incident: August 2026
 * A safe-area padding fix to InspirationCaptureModal also restructured the
 * flex/overflow/height on the modal container. The modal compiled cleanly —
 * zero JS errors, zero TS errors — but overflowed the phone screen horizontally
 * in portrait orientation (left: −47px, right: 422px on a 375 px viewport).
 * Only visible on a real phone.
 *
 * This suite measures modal bounds relative to the viewport so that class of
 * regression is caught before it reaches any device.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ BLOCKING GATE                                                           │
 * │ Any failure here means a change to one of:                             │
 * │   • client/src/components/InspirationCaptureModal.tsx                  │
 * │   • client/src/components/ui/universal-modal.tsx                       │
 * │   • client/src/components/ui/dialog.tsx                                │
 * │ has introduced a layout regression. DO NOT merge while failing.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Architecture reference: docs/responsive-ui-regression-guard.md
 */

import { test, expect, type Page } from "@playwright/test";

// ── Viewport matrix (from docs/responsive-ui-regression-guard.md) ─────────
const VIEWPORTS = [
  { name: "small-iphone-portrait", width: 375,  height: 667  },
  { name: "large-iphone-portrait", width: 390,  height: 844  },
  { name: "iphone-portrait-xl",    width: 430,  height: 932  },
  { name: "iphone-landscape",      width: 844,  height: 390  },
  { name: "android-portrait",      width: 412,  height: 915  },
  { name: "tablet",                width: 768,  height: 1024 },
  { name: "desktop",               width: 1280, height: 800  },
] as const;

// ── Authenticated user with a plan that grants Recipe Maker access ─────────
const FAKE_USER = {
  id: "e2e-viewport-test-user",
  email: "viewport-test@playwright.example",
  username: "Viewport Tester",
  firstName: "Viewport",
  lastName: "Tester",
  planLookupKey: "mpm_premium_monthly",
  subscriptionStatus: "active",
  entitlements: [],
  trialEndsAt: null,
  isEmailVerified: true,
  preferredLanguage: "en",
  onboardingCompletedAt: new Date(Date.now() - 86400000).toISOString(),
  age: 30,
  height: 170,
  weight: 70,
  role: "client",
  isProCare: false,
  activeBoard: "weekly",
  selectedMealBuilder: "weekly",
  isTester: false,
  createdAt: new Date().toISOString(),
  medicalConditions: [],
  specialtyConditions: [],
  labDrivenConditions: [],
  allergies: [],
  dietaryRestrictions: [],
  avoidedFoods: [],
  physicianLocked: false,
  phase2GateEnabled: false,
  proCareEligible: false,
  monetizationEligible: false,
  hasAllergyPin: false,
  procareTrainingCompleted: false,
};

// ── Set up auth + API mocks ────────────────────────────────────────────────
// Playwright route handlers use LIFO order: the last-registered handler for a
// pattern wins. Register the catch-all FIRST so specific overrides registered
// AFTER it take precedence.
async function mockAuth(page: Page): Promise<void> {
  // Seed localStorage before any page JS runs
  await page.addInitScript((u) => {
    localStorage.setItem("mpm_auth_token", "viewport-test-fake-token");
    localStorage.setItem("mpm_current_user", JSON.stringify(u));
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("mpm.skipWelcomeGate", "true");
  }, FAKE_USER);

  // Catch-all: return 200 {} for any API we haven't explicitly stubbed
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );

  // Specific stubs (registered after catch-all → take priority)
  await page.route("**/api/user/profile**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_USER),
    })
  );
  await page.route("**/api/auth/session**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true }),
    })
  );
  await page.route("**/api/saved-meals**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ meals: [], total: 0, page: 1, limit: 20, hasMore: false }),
    })
  );
}

// ── Navigate to /dashboard and open InspirationCaptureModal ───────────────
// Returns the [role="dialog"] locator once it is visible on screen.
async function openModal(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 15000 });

  // The Recipe Maker card has data-testid="card-recipe-scan" on /dashboard.
  // Clicking it calls setShowInspirationModal(true) when the user has
  // at least Essential plan access (mpm_premium_monthly qualifies).
  const recipeScanCard = page.locator('[data-testid="card-recipe-scan"]');
  await expect(recipeScanCard, "Recipe Maker card must be visible on /dashboard").toBeVisible({
    timeout: 10000,
  });
  await recipeScanCard.click();

  // Wait for Radix UI to mount the dialog in the portal
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog, "InspirationCaptureModal must open after clicking Recipe Maker card").toBeVisible({
    timeout: 8000,
  });

  return dialog;
}

// ── Core layout assertions shared across all viewports ────────────────────
//
// Implements assertions 1–5 from docs/responsive-ui-regression-guard.md
// §"Assertions for every modal/dialog". Each assertion names the measured value
// so a failure message is immediately actionable without opening the trace.
async function assertModalBounds(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  viewportWidth: number,
  viewportHeight: number,
): Promise<void> {
  // ── 1. No horizontal body scroll ─────────────────────────────────────────
  // document.body.scrollWidth > window.innerWidth means something pushed the
  // page wider than the viewport — the reference regression produced this.
  const bodyScrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
  expect(
    bodyScrollWidth,
    `[assertion 1] body.scrollWidth (${bodyScrollWidth}px) must not exceed viewport width (${viewportWidth}px)`,
  ).toBeLessThanOrEqual(viewportWidth);

  // ── 2. Dialog bounding rect is fully within the viewport ──────────────────
  const box = await dialog.boundingBox();
  expect(box, "[assertion 2] dialog must have a measurable bounding box (is it in a portal?)").not.toBeNull();

  if (box) {
    // Left edge must be on-screen (reference regression: −47px)
    expect(
      box.x,
      `[assertion 2] dialog left edge (${box.x.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    // Right edge must not escape the viewport (reference regression: 422px on 375px screen)
    const right = box.x + box.width;
    expect(
      right,
      `[assertion 2] dialog right edge (${right.toFixed(1)}px) must be ≤ viewport width (${viewportWidth}px)`,
    ).toBeLessThanOrEqual(viewportWidth + 1); // +1px tolerance for sub-pixel rounding

    // Dialog must not be wider than the viewport itself
    expect(
      box.width,
      `[assertion 2] dialog width (${box.width.toFixed(1)}px) must not exceed viewport width (${viewportWidth}px)`,
    ).toBeLessThanOrEqual(viewportWidth + 1);
  }

  // ── 3. Close / discard control is within bounds ───────────────────────────
  // InspirationCaptureModal renders a Trash2 icon button with title="Discard"
  // in the header for all phases except the 3-card preview. In capture phase
  // (the initial state) it is always present.
  // Note: showCloseButton={false} suppresses the built-in Radix X button;
  // this Trash2 button is the sole close control on this modal.
  const discardButton = dialog.locator("button[title]").first();
  await expect(
    discardButton,
    "[assertion 3] discard/close button (Trash2 with title attr) must be visible",
  ).toBeVisible();

  const discardBox = await discardButton.boundingBox();
  if (discardBox) {
    expect(
      discardBox.x,
      `[assertion 3] discard button left (${discardBox.x.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    const btnRight = discardBox.x + discardBox.width;
    expect(
      btnRight,
      `[assertion 3] discard button right (${btnRight.toFixed(1)}px) must fit within viewport (${viewportWidth}px)`,
    ).toBeLessThanOrEqual(viewportWidth + 1);

    // Entire button must be on-screen vertically — top and bottom edges
    expect(
      discardBox.y,
      `[assertion 3] discard button top (${discardBox.y.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    const btnBottom = discardBox.y + discardBox.height;
    expect(
      btnBottom,
      `[assertion 3] discard button bottom (${btnBottom.toFixed(1)}px) must be ≤ viewport height (${viewportHeight}px)`,
    ).toBeLessThanOrEqual(viewportHeight + 1);
  }

  // ── 4. Primary CTA (upload zone) is reachable ─────────────────────────────
  // In capture phase with the default upload mode, the primary interactive
  // surface is the gallery upload zone. It is marked with
  // data-testid="inspiration-upload-cta" (set in InspirationCaptureModal.tsx).
  // This div contains the file input that the user taps to pick a photo.
  // We check its bounding box — not just visibility — so an off-screen but
  // technically visible element still fails if it's outside the viewport.
  const uploadCta = dialog.locator('[data-testid="inspiration-upload-cta"]');
  await expect(
    uploadCta,
    "[assertion 4] upload zone (data-testid=inspiration-upload-cta) must be visible",
  ).toBeVisible();

  const ctaBox = await uploadCta.boundingBox();
  if (ctaBox) {
    expect(
      ctaBox.x,
      `[assertion 4] upload zone left (${ctaBox.x.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    const ctaRight = ctaBox.x + ctaBox.width;
    expect(
      ctaRight,
      `[assertion 4] upload zone right (${ctaRight.toFixed(1)}px) must be ≤ viewport width (${viewportWidth}px)`,
    ).toBeLessThanOrEqual(viewportWidth + 1);

    // Entire upload zone must be on-screen vertically — top and bottom edges.
    // A control whose bottom edge is below the fold is not reachable by the user.
    expect(
      ctaBox.y,
      `[assertion 4] upload zone top (${ctaBox.y.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    const ctaBottom = ctaBox.y + ctaBox.height;
    expect(
      ctaBottom,
      `[assertion 4] upload zone bottom (${ctaBottom.toFixed(1)}px) must be ≤ viewport height (${viewportHeight}px)`,
    ).toBeLessThanOrEqual(viewportHeight + 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — Viewport × bounds matrix
//
// Each viewport opens the modal in its default "capture" phase and runs all
// four core assertions. A failure in any viewport means that viewport's users
// would see the regression on a real device.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("InspirationCaptureModal — viewport bounds matrix (BLOCKING gate)", () => {
  for (const vp of VIEWPORTS) {
    test(
      `[${vp.name} ${vp.width}×${vp.height}] modal stays within viewport — no horizontal overflow`,
      async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await mockAuth(page);

        const dialog = await openModal(page);

        await assertModalBounds(page, dialog, vp.width, vp.height);
      },
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — Reference incident reproduction (exact August 2026 values)
//
// This test reproduces the exact regression that motivated this suite.
// If this test fails, the bug is back.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("InspirationCaptureModal — reference incident reproduction (small-iphone-portrait)", () => {
  test("modal left ≥ 0 and right ≤ 375 on 375×667 (was left: −47px, right: 422px in regression)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockAuth(page);

    const dialog = await openModal(page);
    const box = await dialog.boundingBox();

    expect(box, "dialog must have a measurable bounding box").not.toBeNull();
    if (box) {
      // Exact values from the regression incident
      expect(
        box.x,
        `dialog left was ${box.x.toFixed(1)}px — must be ≥ 0 (regression value: −47px)`,
      ).toBeGreaterThanOrEqual(0);

      const right = box.x + box.width;
      expect(
        right,
        `dialog right was ${right.toFixed(1)}px — must be ≤ 375px (regression value: 422px)`,
      ).toBeLessThanOrEqual(376);
    }

    // Body must not scroll horizontally
    const scrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
    expect(
      scrollWidth,
      `body.scrollWidth was ${scrollWidth}px — must be ≤ 375px (regression caused horizontal body scroll)`,
    ).toBeLessThanOrEqual(375);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — Assertion 4 from architecture doc: no accidental multi-column layout
//
// The dialog on desktop is capped at max-w-lg (~512px) and already at its CSS
// maximum. If a layout bug (e.g. accidental flex-row) causes the mobile dialog
// to be wider than the desktop dialog, something has gone wrong — the mobile
// viewport is 375px, so no correct layout should produce a modal wider than
// the desktop's max-width cap.
//
// Note: it is expected and correct for mobile to be narrower than desktop
// (mobile is constrained by w-[calc(100vw-2rem)]). This test only catches
// the pathological case where mobile becomes WIDER than desktop, which
// indicates a layout explosion.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("InspirationCaptureModal — no accidental layout explosion on mobile vs desktop", () => {
  test("mobile dialog must not be wider than the desktop dialog (catches flex-row / overflow accidents)", async ({
    page,
  }) => {
    await mockAuth(page);

    // Measure dialog width at desktop — it will be capped at max-w-lg (~512px)
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopDialog = await openModal(page);
    const desktopBox = await desktopDialog.boundingBox();
    expect(desktopBox, "desktop dialog must have a measurable bounding box").not.toBeNull();

    // Close the modal, then reopen at portrait phone
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400); // let close animation settle

    await page.setViewportSize({ width: 375, height: 667 });
    const mobileDialog = await openModal(page);
    const mobileBox = await mobileDialog.boundingBox();
    expect(mobileBox, "mobile dialog must have a measurable bounding box").not.toBeNull();

    if (desktopBox && mobileBox) {
      // The mobile dialog must NOT be wider than the desktop dialog.
      // The desktop dialog is already at its CSS maximum (max-w-lg = ~512px).
      // A mobile dialog exceeding the desktop width means the layout has exploded
      // (e.g. width no longer constrained by the viewport or by max-w-*).
      expect(
        mobileBox.width,
        `mobile dialog width (${mobileBox.width.toFixed(1)}px) must not exceed desktop dialog width (${desktopBox.width.toFixed(1)}px) — this indicates a layout explosion`,
      ).toBeLessThanOrEqual(desktopBox.width + 1); // +1px for sub-pixel rounding

      // Also assert: mobile dialog must not exceed its own viewport
      expect(
        mobileBox.width,
        `mobile dialog width (${mobileBox.width.toFixed(1)}px) must not exceed mobile viewport (375px)`,
      ).toBeLessThanOrEqual(376);
    }
  });
});
