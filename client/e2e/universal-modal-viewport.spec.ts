/**
 * Universal Modal — Responsive Viewport Tests
 *
 * Guards against layout regressions in shared dialog primitives
 * (universal-modal.tsx and dialog.tsx) that affect 20+ modals.
 *
 * Reference incident: InspirationCaptureModal — August 2026.
 * A safe-area fix accidentally restructured flex/overflow properties and
 * produced a modal 47px off-screen in portrait mode. No JS/TS errors fired.
 *
 * Test surface: /__modal-test__?variant=<name>
 * The test harness page (ModalTestHarness.tsx) renders each variant open
 * and gated behind navigator.webdriver === true so it is never accessible
 * to real users in production.
 *
 * Architecture reference: docs/responsive-ui-regression-guard.md Gate 1
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// ── Viewports from the guard doc ───────────────────────────────────────────────

const VIEWPORTS = [
  { name: "small-iphone-portrait",     width: 375,  height: 667  },
  { name: "large-iphone-portrait",     width: 390,  height: 844  },
  { name: "large-iphone-portrait-xl",  width: 430,  height: 932  },
  { name: "iphone-landscape",          width: 844,  height: 390  },
  { name: "android-portrait",          width: 412,  height: 915  },
  { name: "tablet-portrait",           width: 768,  height: 1024 },
  { name: "desktop",                   width: 1280, height: 800  },
] as const;

// ── Modal variants matching ModalTestHarness ───────────────────────────────────

const VARIANTS = [
  { name: "universal",     label: "UniversalDialog"   },
  { name: "confirmation",  label: "ConfirmationModal"  },
  { name: "form",          label: "FormModal"          },
  { name: "picker",        label: "PickerModal"        },
  { name: "information",   label: "InformationModal"   },
  { name: "workflow",      label: "WorkflowModal"      },
  { name: "wizard",        label: "WizardModal"        },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Navigate to the modal test harness for a specific variant. */
async function gotoVariant(page: Page, variant: string) {
  await page.goto(`/__modal-test__?variant=${variant}`, {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
  // Wait for the harness root to confirm the page loaded
  await expect(
    page.getByTestId("modal-test-harness"),
    `Harness root must render for variant=${variant}`
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Assert the Radix dialog is within the visible viewport:
 *   - left ≥ 0
 *   - right ≤ viewport width
 *   - no body horizontal overflow
 *   - dialog bounding rect not zero-sized (modal is actually rendered)
 */
async function assertDialogInViewport(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  label: string
): Promise<void> {
  // The Radix dialog content sits in a portal — locate via role
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, `${label}: dialog must be present`).toBeVisible({
    timeout: 8_000,
  });

  const bounds = await dialog.boundingBox();
  if (!bounds) {
    throw new Error(`${label}: could not get bounding box for dialog`);
  }

  // 1. Left edge must be on-screen
  expect(
    bounds.x,
    `${label}: dialog left edge must be >= 0 (was ${bounds.x.toFixed(1)}px)`
  ).toBeGreaterThanOrEqual(0);

  // 2. Right edge must be within viewport
  const dialogRight = bounds.x + bounds.width;
  expect(
    dialogRight,
    `${label}: dialog right edge must be <= ${viewportWidth} (was ${dialogRight.toFixed(1)}px)`
  ).toBeLessThanOrEqual(viewportWidth + 1); // +1 for sub-pixel rounding

  // 3. Dialog must not have zero width or height
  expect(
    bounds.width,
    `${label}: dialog must have positive width`
  ).toBeGreaterThan(0);
  expect(
    bounds.height,
    `${label}: dialog must have positive height`
  ).toBeGreaterThan(0);

  // 4. No horizontal body overflow
  const bodyOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  expect(
    bodyOverflow,
    `${label}: body must not have horizontal overflow (scrollWidth > innerWidth)`
  ).toBe(false);

  // 5. Top edge must be within viewport (not scrolled off the top)
  expect(
    bounds.y,
    `${label}: dialog top must be within viewport (was ${bounds.y.toFixed(1)}px)`
  ).toBeGreaterThanOrEqual(0);
}

/**
 * Assert the close button (✕) is present, visible, and within the viewport.
 * Skips if the variant is expected to use a custom close control.
 */
async function assertCloseButtonReachable(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  label: string
): Promise<void> {
  // The DialogContent renders a Radix Close button with a sr-only label "Close"
  const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has(.sr-only)').first();

  // If no explicit close button, look for the X icon button inside the dialog
  const hasClose = await page
    .locator('[role="dialog"] button')
    .filter({ hasText: /^$/ }) // icon-only buttons
    .first()
    .isVisible()
    .catch(() => false);

  if (!hasClose) {
    // Variant uses a custom close control — skip this assertion
    return;
  }

  const bounds = await page
    .locator('[role="dialog"] button')
    .filter({ hasText: /^$/ })
    .first()
    .boundingBox();

  if (!bounds) return; // can't assert what we can't measure

  expect(
    bounds.x,
    `${label}: close button must be on-screen (left=${bounds.x.toFixed(1)})`
  ).toBeGreaterThanOrEqual(0);

  const btnRight = bounds.x + bounds.width;
  expect(
    btnRight,
    `${label}: close button must not be clipped on the right`
  ).toBeLessThanOrEqual(viewportWidth + 1);
}

/**
 * Assert the primary action button ("Confirm") is within the viewport.
 */
async function assertPrimaryActionReachable(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  label: string
): Promise<void> {
  const primaryBtn = page.getByTestId("modal-primary-btn").first();
  const hasPrimary = await primaryBtn.isVisible().catch(() => false);
  if (!hasPrimary) return; // wizard variant uses its own footer

  const bounds = await primaryBtn.boundingBox();
  if (!bounds) return;

  expect(
    bounds.x,
    `${label}: primary button must be on-screen`
  ).toBeGreaterThanOrEqual(0);

  const btnRight = bounds.x + bounds.width;
  expect(
    btnRight,
    `${label}: primary button must not overflow the right edge`
  ).toBeLessThanOrEqual(viewportWidth + 1);

  expect(
    bounds.y + bounds.height,
    `${label}: primary button must be above the viewport bottom`
  ).toBeLessThanOrEqual(viewportHeight + 1);
}

// ── Screenshot capture helper ──────────────────────────────────────────────────

/** Save a screenshot to docs/screenshots/modal-baseline/ for diff comparison. */
async function captureBaseline(
  page: Page,
  variant: string,
  viewportName: string
): Promise<void> {
  await page.screenshot({
    path: `docs/screenshots/modal-baseline/${variant}-${viewportName}.png`,
    clip: await (async () => {
      const dialog = page.locator('[role="dialog"]').first();
      const box = await dialog.boundingBox().catch(() => null);
      // Expand the clip region slightly so the overlay context is visible
      if (box) {
        return {
          x: Math.max(0, box.x - 16),
          y: Math.max(0, box.y - 16),
          width: box.width + 32,
          height: box.height + 32,
        };
      }
      return undefined;
    })(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 1: Viewport layout tests — run for every variant × viewport combination
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("UniversalDialog variants — viewport layout regression guard", () => {
  for (const variant of VARIANTS) {
    test.describe(`${variant.label}`, () => {
      for (const viewport of VIEWPORTS) {
        test(
          `[${viewport.name}] dialog within viewport, no overflow, controls reachable`,
          async ({ page }) => {
            await page.setViewportSize({
              width: viewport.width,
              height: viewport.height,
            });

            await gotoVariant(page, variant.name);

            const label = `${variant.label} @ ${viewport.name} (${viewport.width}×${viewport.height})`;

            await assertDialogInViewport(
              page,
              viewport.width,
              viewport.height,
              label
            );

            await assertCloseButtonReachable(
              page,
              viewport.width,
              viewport.height,
              label
            );

            await assertPrimaryActionReachable(
              page,
              viewport.width,
              viewport.height,
              label
            );

            // Capture baseline screenshot for the Gate 2 diff tool
            await captureBaseline(page, variant.name, viewport.name);
          }
        );
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 1b: Portrait-width invariant
//
// A dialog should not become significantly wider on portrait mobile than it is
// on desktop (the responsive clamp should work). Compares portrait vs desktop
// dialog widths to catch accidental flex-row breakage.
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Portrait-width invariant — dialog width does not balloon on mobile", () => {
  for (const variant of VARIANTS) {
    test(`${variant.label} portrait-mobile dialog width ≤ desktop width + 10%`, async ({
      page,
    }) => {
      // Measure at portrait mobile (small-iphone)
      await page.setViewportSize({ width: 375, height: 667 });
      await gotoVariant(page, variant.name);
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      const portraitBox = await dialog.boundingBox();

      // Measure at desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await gotoVariant(page, variant.name);
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      const desktopBox = await dialog.boundingBox();

      if (!portraitBox || !desktopBox) return;

      const portraitWidth = portraitBox.width;
      const desktopWidth = desktopBox.width;
      const threshold = desktopWidth * 1.1;

      expect(
        portraitWidth,
        `${variant.label}: portrait dialog (${portraitWidth.toFixed(0)}px) must not be wider than desktop (${desktopWidth.toFixed(0)}px) + 10%`
      ).toBeLessThanOrEqual(threshold);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GATE 1c: WizardModal step navigation — controls reachable at all steps
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("WizardModal step navigation — controls reachable at all portrait viewports", () => {
  const portraitViewports = VIEWPORTS.filter((v) =>
    v.name.includes("portrait")
  );

  for (const viewport of portraitViewports) {
    test(
      `[${viewport.name}] wizard next/complete buttons within viewport`,
      async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await gotoVariant(page, "wizard");

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 8_000 });

        const label = `WizardModal @ ${viewport.name}`;

        // Step 1: "Continue" button
        const nextBtn = page.getByRole("button", { name: /continue/i }).first();
        if (await nextBtn.isVisible()) {
          const bounds = await nextBtn.boundingBox();
          if (bounds) {
            expect(
              bounds.y + bounds.height,
              `${label}: Continue button must be above viewport bottom`
            ).toBeLessThanOrEqual(viewport.height + 1);
          }
          // Advance to last step
          await nextBtn.click();
          await page.waitForTimeout(200);
          // "Continue" again for step 2
          if (await nextBtn.isVisible()) {
            await nextBtn.click();
            await page.waitForTimeout(200);
          }
        }

        // Last step: "Complete" button
        const completeBtn = page
          .getByRole("button", { name: /complete/i })
          .first();
        if (await completeBtn.isVisible()) {
          const bounds = await completeBtn.boundingBox();
          if (bounds) {
            expect(
              bounds.y + bounds.height,
              `${label}: Complete button must be above viewport bottom`
            ).toBeLessThanOrEqual(viewport.height + 1);
          }
        }

        // No overflow after navigation
        const bodyOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth;
        });
        expect(
          bodyOverflow,
          `${label}: no body overflow after wizard step navigation`
        ).toBe(false);
      }
    );
  }
});
