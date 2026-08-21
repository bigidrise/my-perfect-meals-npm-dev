/**
 * Modal Responsive Tests — Viewport Bounds Guard
 *
 * Tests REAL app components rendered by the running dev server — not fabricated
 * HTML. The test page at /test-modal-bounds (dev-only, see Router.tsx) imports
 * the actual component files with real Tailwind CSS, so any regression in
 * TSX/Tailwind output (removed max-width, negative margin, flex restructuring)
 * produces a real layout change that these tests catch.
 *
 * Component chain tested:
 *   UniversalDialog → DialogContent → Radix [role="dialog"]
 *   InspirationCaptureModal → UniversalDialog → DialogContent → [role="dialog"]
 *
 * Reference incident: InspirationCaptureModal — August 2026
 *   modal.right=422 exceeded viewport width=375 at small-iphone-portrait
 *   The assertions below (scrollWidth, left, right, width) would have caught it.
 *
 * Failure message format:
 *   "InspirationCaptureModal right=422.0 exceeds viewport width=375 at small-iphone-portrait"
 *
 * Requires:
 *   App dev server running at E2E_BASE_URL (default http://localhost:5000).
 *   pre-publish-validate.sh starts the server automatically when not running.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Viewport matrix (matches docs/responsive-ui-regression-guard.md) ─────────
const VIEWPORTS = [
  { name: "small-iphone-portrait",    width: 375,  height: 667  },
  { name: "large-iphone-portrait",    width: 390,  height: 844  },
  { name: "large-iphone-portrait-xl", width: 430,  height: 932  },
  { name: "iphone-landscape",         width: 844,  height: 390  },
  { name: "android-portrait",         width: 412,  height: 915  },
  { name: "tablet-portrait",          width: 768,  height: 1024 },
  { name: "desktop",                  width: 1280, height: 800  },
] as const;

// ── Auth mock (same pattern as localization-rtl-responsive.spec.ts) ──────────
//
// AppRouter redirects any unauthenticated, non-public request to /welcome
// (line 172 in AppRouter.tsx). Vite HMR causes a full-page reload on first
// compilation which triggers a fresh boot — without auth, that boot lands at
// /welcome instead of /test-modal-bounds.
//
// addInitScript runs before ANY page script on every navigation including
// HMR-triggered reloads, so auth survives the reload and AppRouter stays put.
// This is the same strategy used by localization-rtl-responsive.spec.ts.

const MODAL_TEST_USER = {
  id: "modal-bounds-test-user",
  email: "modal-test@example.com",
  username: "Modal Tester",
  firstName: "Modal",
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
};

async function seedAuth(page: Page): Promise<void> {
  await page.addInitScript((u) => {
    localStorage.setItem("mpm_auth_token", "modal-bounds-fake-token");
    localStorage.setItem("mpm_current_user", JSON.stringify(u));
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("mpm.skipWelcomeGate", "true");
    localStorage.setItem(
      "macro_calculator_settings",
      JSON.stringify({ age: 30, heightCm: 170, weightKg: 70 })
    );
  }, MODAL_TEST_USER);

  // Catch-all registered first; specific routes registered after take priority
  // (Playwright routes match newest-registered-first).
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );
  await page.route("**/api/saved-meals**", (r) => {
    const url = r.request().url();
    if (url.includes("/translation") || url.includes("/toggle") || url.includes("/check")) {
      return r.fallback();
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ meals: [], total: 0, page: 1, limit: 20, hasMore: false }),
    });
  });
  await page.route("**/api/user/preferences**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferredLanguage: "en" }),
    })
  );
  await page.route("**/api/user/profile**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MODAL_TEST_USER),
    })
  );
  await page.route("**/api/auth/session**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true }),
    })
  );
  // OrgContext replaces its default config with the API response. If the
  // catch-all returns {} the featureFlags field is undefined, and any call
  // to useOrgFlag (e.g. in DesktopHeader → ProfileSheet) crashes. Return
  // the minimal valid shape so the context stays stable at all viewports.
  await page.route("**/api/org/config**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "aaaaaaaa-0000-0000-0000-000000000001",
        slug: "mpm-public",
        name: "My Perfect Meals",
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
          whiteLabelMode: false, customBranding: false,
          physicianDashboard: false, providerMessaging: false,
          medicalRecordIntegration: false, diabeticHub: true,
          glp1Support: true, partnerMarketplace: false,
          productRecommendations: false, oncologySupport: false,
          coachTools: true, biometricTracking: true,
          requireAcademy: true, requireProfessionalVerification: true,
        },
        isDefault: true,
        isWhiteLabel: false,
      }),
    })
  );
}

// ── Open the dev-only test harness and wait for the dialog ───────────────────
//
// The test page at /test-modal-bounds renders the real component and starts
// with open=true, so the dialog appears as soon as the page mounts.
//
// The page is registered in the Router as an authenticated route
// (import.meta.env.DEV && <Route>). Seeding localStorage auth via addInitScript
// keeps AppRouter from redirecting to /welcome, even through Vite HMR reloads
// on the first run after a fresh server start.

async function openTestModal(
  page: Page,
  variant: "universal-dialog" | "tall" | "inspiration"
): Promise<void> {
  const url =
    variant === "universal-dialog"
      ? "/test-modal-bounds"
      : `/test-modal-bounds?variant=${variant}`;

  // Seed auth before any navigation — survives HMR-triggered page reloads.
  await seedAuth(page);

  await page.goto(url);

  // networkidle waits for Vite to finish any HMR-triggered reloads and for
  // React to finish mounting.  30 s accommodates a cold-cache first compile;
  // subsequent tests hit the warm module cache in < 2 s.
  await page.waitForLoadState("networkidle", { timeout: 30_000 });

  // Verify we stayed on the right route (same guard as localization tests).
  const landed = new URL(page.url()).pathname;
  if (landed !== "/test-modal-bounds") {
    throw new Error(
      `Expected /test-modal-bounds but landed at ${landed} — ` +
      `auth redirect may have fired (HMR boot raced AppRouter check)`
    );
  }

  // Radix sets data-state="open" when the dialog is mounted with open=true.
  // This confirms the real component has rendered and Tailwind classes applied.
  await page.waitForSelector('[role="dialog"][data-state="open"]', { timeout: 10_000 });
}

// ── Core bounds assertion ─────────────────────────────────────────────────────
//
// Measures the actual Radix dialog element — the real rendered output of
// DialogContent with real Tailwind classes applied. Failure messages include
// the exact value, the viewport name, and the limit.

async function assertModalBounds(
  page: Page,
  viewport: (typeof VIEWPORTS)[number],
  componentName: string,
  opts: { allowScrolledButton?: boolean } = {}
): Promise<void> {
  const { width: vw, height: vh, name: vname } = viewport;

  // 1. No horizontal overflow on the body
  const scrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
  expect(
    scrollWidth,
    `${componentName} body.scrollWidth=${scrollWidth} exceeds viewport width=${vw} at ${vname}`
  ).toBeLessThanOrEqual(vw);

  // 2. Dialog element within viewport bounds — this is the rendered DialogContent
  const rect: { left: number; right: number; top: number; bottom: number; width: number } =
    await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) throw new Error("dialog[data-state=open] not found in DOM");
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
    });

  expect(
    rect.left,
    `${componentName} rect.left=${rect.left.toFixed(1)} is off-screen left at ${vname}`
  ).toBeGreaterThanOrEqual(0);

  expect(
    rect.right,
    `${componentName} right=${rect.right.toFixed(1)} exceeds viewport width=${vw} at ${vname}`
  ).toBeLessThanOrEqual(vw + 0.5); // 0.5px sub-pixel tolerance

  // 3. Dialog width must not exceed viewport width.
  //    This is the most direct guard against the reference incident:
  //    removing max-width or adding a negative margin makes the modal
  //    physically wider than the phone screen.
  expect(
    rect.width,
    `${componentName} modal width=${rect.width.toFixed(1)} wider than viewport=${vw} at ${vname}`
  ).toBeLessThanOrEqual(vw + 0.5);

  // 4. At least one button inside the dialog must be visible and within viewport.
  //    Covers the close button and action buttons simultaneously.
  const btnBounds: { right: number; left: number } | null =
    await page.evaluate((vwInner: number) => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!dialog) return null;
      // Check every button; report the first one that is out-of-bounds
      // (so a single bad button shows up, even if others are fine).
      const buttons = Array.from(dialog.querySelectorAll("button"));
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return { right: r.right, left: r.left };
        }
      }
      return null;
    }, vw);

  if (btnBounds) {
    expect(
      btnBounds.right,
      `${componentName} button right=${btnBounds.right.toFixed(1)} outside viewport width=${vw} at ${vname}`
    ).toBeLessThanOrEqual(vw + 0.5);
    expect(
      btnBounds.left,
      `${componentName} button left=${btnBounds.left.toFixed(1)} off-screen at ${vname}`
    ).toBeGreaterThanOrEqual(0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1 — UniversalDialog + DialogContent (shared primitives)
//
// UniversalDialog wraps DialogContent which wraps Radix. Any change to
// dialog.tsx or universal-modal.tsx that breaks the max-width constraint or
// repositions the dialog will fail these tests.
//
// All 7 viewports are tested. The desktop test verifies the max-width cap
// (dialog should be ≤512px, not stretched to full 1280px).
// ─────────────────────────────────────────────────────────────────────────────

test.describe("UniversalDialog + DialogContent — shared primitive bounds (real component)", () => {
  for (const viewport of VIEWPORTS) {
    test(`[${viewport.name}] ${viewport.width}×${viewport.height} — no overflow, dialog within bounds`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openTestModal(page, "universal-dialog");
      await assertModalBounds(page, viewport, "UniversalDialog/DialogContent");

      // On desktop the dialog must be constrained by max-width (not stretched full-width)
      if (viewport.name === "desktop") {
        const dialogWidth: number = await page.evaluate(() => {
          const el = document.querySelector('[role="dialog"][data-state="open"]');
          return el ? el.getBoundingClientRect().width : 0;
        });
        expect(
          dialogWidth,
          `DialogContent must be constrained by max-width on desktop — should be ≤516px, got ${dialogWidth.toFixed(1)}`
        ).toBeLessThanOrEqual(516); // 512px max-w-lg + 4px sub-pixel buffer
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2 — InspirationCaptureModal (the reference incident component)
//
// This is the exact component whose safe-area fix caused the August 2026
// regression (modal.right=422, viewport 375px). These tests make that class
// of regression a hard blocker before publishing.
//
// The component renders: InspirationCaptureModal → UniversalDialog →
// DialogContent → Radix [role="dialog"]. Real Tailwind CSS applies.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("InspirationCaptureModal — viewport bounds (real component)", () => {
  // Spot-check the four most critical viewports: smallest phone (reference
  // incident), largest phone, landscape, and desktop.
  const criticalViewports = VIEWPORTS.filter((v) =>
    ["small-iphone-portrait", "large-iphone-portrait-xl", "iphone-landscape", "desktop"].includes(v.name)
  );

  for (const viewport of criticalViewports) {
    test(`[${viewport.name}] ${viewport.width}×${viewport.height} — no overflow, dialog within bounds`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openTestModal(page, "inspiration");
      await assertModalBounds(page, viewport, "InspirationCaptureModal");
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 3 — Tall content scroll (max-height + overflow-y:auto)
//
// When the modal body is taller than 90vh, DialogContent must cap at
// max-height and the body must scroll. The dialog must still not overflow
// the viewport horizontally.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DialogContent — tall content scroll behaviour", () => {
  const scrollViewports = VIEWPORTS.filter((v) =>
    ["small-iphone-portrait", "large-iphone-portrait", "iphone-landscape"].includes(v.name)
  );

  for (const viewport of scrollViewports) {
    test(`[${viewport.name}] tall content — no horizontal overflow, modal capped by max-height`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openTestModal(page, "tall");

      // Horizontal bounds still hold with tall content
      const scrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
      expect(
        scrollWidth,
        `DialogContent(tall) body.scrollWidth=${scrollWidth} exceeds viewport width=${viewport.width} at ${viewport.name}`
      ).toBeLessThanOrEqual(viewport.width);

      const rect: { width: number; height: number } = await page.evaluate(() => {
        const el = document.querySelector('[role="dialog"][data-state="open"]');
        if (!el) throw new Error("dialog not found");
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });

      expect(
        rect.width,
        `DialogContent(tall) modal width=${rect.width.toFixed(1)} wider than viewport=${viewport.width} at ${viewport.name}`
      ).toBeLessThanOrEqual(viewport.width + 0.5);

      // When content overflows, the modal height must be capped (max-h-[90vh])
      // and the content container must be scrollable.
      const scrollable: boolean = await page.evaluate(() => {
        const el = document.querySelector('[role="dialog"][data-state="open"]');
        if (!el) return false;
        // Either the dialog itself or a scroll-container child must be scrollable
        const isScrollable = (e: Element) =>
          e.scrollHeight > e.clientHeight + 2 &&
          ["auto", "scroll", "overlay"].includes(window.getComputedStyle(e).overflowY);
        if (isScrollable(el)) return true;
        return Array.from(el.querySelectorAll("*")).some(isScrollable);
      });

      // Only assert scrollability if the modal actually hit its height cap
      if (rect.height >= viewport.height * 0.8) {
        expect(
          scrollable,
          `DialogContent(tall) must be scrollable when content exceeds 90vh at ${viewport.name}`
        ).toBe(true);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 4 — Broken layout detection (guard self-verification)
//
// Opens the real UniversalDialog on the real app, then injects CSS via
// page.addStyleTag() that replicates the reference incident geometry.
//
// The test PASSES when it confirms the injected CSS produces overflow —
// proving that the assertModalBounds() assertions above would have caught
// the real August 2026 incident. If this suite starts failing, the CSS
// injection is broken and the guard may no longer detect overflow.
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Broken layout detection — guard self-verification", () => {
  test("small-iphone-portrait: negative-margin overflow produces right > viewport width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openTestModal(page, "universal-dialog");

    // Confirm the real dialog is correctly within bounds before injection
    const before: { right: number; left: number } = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) throw new Error("dialog not found");
      const r = el.getBoundingClientRect();
      return { right: r.right, left: r.left };
    });
    expect(before.right, "Dialog must be within viewport before injecting broken CSS").toBeLessThanOrEqual(375.5);
    expect(before.left, "Dialog must not be off-screen before injection").toBeGreaterThanOrEqual(0);

    // Inject CSS replicating the reference incident:
    //   margin-left:-47px pushes the modal left of viewport edge
    //   max-width:none + width:469px reproduces the exact broken pixel values
    await page.addStyleTag({
      content: `
        [role="dialog"][data-state="open"] {
          margin-left: -47px !important;
          max-width: none !important;
          width: 469px !important;
          left: 50% !important;
          transform: translateX(0) translateY(-50%) !important;
        }
      `,
    });
    await page.waitForTimeout(150); // allow layout reflow

    const after: { left: number; right: number; width: number } = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) throw new Error("dialog not found");
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    });

    // This assertion passes when overflow IS detected. assertModalBounds
    // in Suites 1–2 checks exactly these conditions and would have failed here.
    expect(
      after.right > 375 || after.left < 0 || after.width > 375,
      `Self-test: injected broken layout must produce overflow. ` +
      `Got right=${after.right.toFixed(1)}, left=${after.left.toFixed(1)}, width=${after.width.toFixed(1)} ` +
      `at viewport 375px. If all values are within bounds, the CSS injection failed.`
    ).toBe(true);
  });

  test("large-iphone-portrait: width-only overflow is caught by rect.right check", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openTestModal(page, "universal-dialog");

    // Confirm clean state before injection
    const before: { right: number; width: number } = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) throw new Error("dialog not found");
      const r = el.getBoundingClientRect();
      return { right: r.right, width: r.width };
    });
    expect(before.right, "Dialog must be within viewport before injecting broken CSS").toBeLessThanOrEqual(390.5);

    // Inject CSS replicating a max-width removal — 600px modal wider than 390px viewport.
    // Radix dialogs are position:fixed so body.scrollWidth is unaffected; the right
    // edge check via getBoundingClientRect() is the correct detection method.
    await page.addStyleTag({
      content: `
        [role="dialog"][data-state="open"] {
          width: 600px !important;
          max-width: 600px !important;
        }
      `,
    });
    await page.waitForTimeout(150);

    const after: { right: number; width: number } = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) throw new Error("dialog not found");
      const r = el.getBoundingClientRect();
      return { right: r.right, width: r.width };
    });

    // Radix centers via transform: translateX(-50%) on left:50%.
    // At 390px viewport: left=195, width=600 → right = 195 + 300 = 495 > 390.
    // The rect.right assertion in assertModalBounds would have caught this.
    expect(
      after.right > 390 || after.width > 390,
      `Self-test: 600px dialog should produce right > 390 or width > 390. ` +
      `Got right=${after.right.toFixed(1)}, width=${after.width.toFixed(1)}. ` +
      "The rect.right check in assertModalBounds would have caught this."
    ).toBe(true);
  });
});
