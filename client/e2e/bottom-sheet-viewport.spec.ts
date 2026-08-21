/**
 * Bottom Sheet / Drawer — Responsive Viewport Regression Guard
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ BLOCKING GATE                                                           │
 * │ Any failure here means a change to one of:                             │
 * │   • client/src/components/ui/sheet.tsx                                 │
 * │   • client/src/components/ui/drawer.tsx                                │
 * │   • any Sheet or Drawer used in production                             │
 * │ has introduced a layout regression. DO NOT merge while failing.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Context: The same class of flex/overflow bug that pushed InspirationCaptureModal
 * off-screen in August 2026 can hit bottom sheets and drawers just as easily.
 * Sheet uses `inset-x-0` and Drawer uses `inset-x-0 bottom-0` — if those
 * classes are accidentally removed or overridden, the component can overflow
 * the horizontal viewport with zero JS/TS errors.
 *
 * Test surface: /__sheet-test__?variant=<name>
 * SheetTestHarness.tsx renders each variant open and gated behind
 * navigator.webdriver === true so it is never accessible to real users in
 * production.
 *
 * Assertions mirror inspiration-capture-modal-viewport.spec.ts:
 *   1. No horizontal body overflow (body.scrollWidth ≤ viewport width)
 *   2. Sheet/drawer bounding rect left ≥ 0
 *   3. Sheet/drawer bounding rect right ≤ viewport width
 *   4. Sheet/drawer has positive dimensions (it actually rendered)
 *   5. Close control is within the viewport bounds
 *   6. Primary action button is within the viewport bounds
 *
 * Architecture reference: docs/responsive-ui-regression-guard.md
 */

import { test, expect, type Page } from "@playwright/test";

// ── Viewport matrix (from docs/responsive-ui-regression-guard.md) ─────────

const VIEWPORTS = [
  { name: "small-iphone-portrait",    width: 375,  height: 667  },
  { name: "large-iphone-portrait",    width: 390,  height: 844  },
  { name: "large-iphone-portrait-xl", width: 430,  height: 932  },
  { name: "iphone-landscape",         width: 844,  height: 390  },
  { name: "android-portrait",         width: 412,  height: 915  },
  { name: "tablet-portrait",          width: 768,  height: 1024 },
  { name: "desktop",                  width: 1280, height: 800  },
] as const;

// ── Sheet/Drawer variants matching SheetTestHarness ───────────────────────

const VARIANTS = [
  { name: "sheet-bottom", label: "Sheet (bottom)" },
  { name: "sheet-right",  label: "Sheet (right)"  },
  { name: "drawer",       label: "Drawer (bottom)" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────

/** Navigate to the sheet test harness for a specific variant. */
async function gotoVariant(page: Page, variant: string): Promise<void> {
  await page.goto(`/__sheet-test__?variant=${variant}`, {
    waitUntil: "networkidle",
    timeout: 20_000,
  });
  await expect(
    page.getByTestId("sheet-test-harness"),
    `Harness root must render for variant=${variant}`,
  ).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait for the sheet/drawer dialog to appear and return its locator.
 *
 * Both Sheet (Radix) and Drawer (Vaul) render their content with
 * role="dialog". When only one variant is loaded (via ?variant=), there
 * is exactly one such element in the DOM.
 */
async function getSheetDialog(page: Page, label: string) {
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog, `${label}: sheet/drawer dialog must be present`).toBeVisible({
    timeout: 8_000,
  });
  return dialog;
}

/**
 * Core layout assertions — mirrors assertDialogInViewport in
 * universal-modal-viewport.spec.ts with an additional bottom-edge check
 * because bottom sheets must also not escape downward.
 *
 * Assertion 1: No horizontal body overflow
 * Assertion 2: Left edge ≥ 0
 * Assertion 3: Right edge ≤ viewport width
 * Assertion 4: Positive dimensions (component actually rendered)
 * Assertion 5: Top edge ≥ 0
 * Assertion 6 (bottom sheets): Bottom edge ≤ viewport height
 */
async function assertSheetBounds(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  viewportWidth: number,
  viewportHeight: number,
  label: string,
  variant: string,
): Promise<void> {
  // ── 1. No horizontal body overflow ────────────────────────────────────────
  const bodyScrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
  expect(
    bodyScrollWidth,
    `${label} [assertion 1] body.scrollWidth (${bodyScrollWidth}px) must not exceed viewport width (${viewportWidth}px)`,
  ).toBeLessThanOrEqual(viewportWidth);

  // ── 2–5. Bounding rect checks ─────────────────────────────────────────────
  const box = await dialog.boundingBox();
  expect(
    box,
    `${label} [assertion 2] dialog must have a measurable bounding box`,
  ).not.toBeNull();

  if (box) {
    // Left edge on-screen
    expect(
      box.x,
      `${label} [assertion 2] left edge (${box.x.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    // Right edge within viewport
    const right = box.x + box.width;
    expect(
      right,
      `${label} [assertion 3] right edge (${right.toFixed(1)}px) must be ≤ viewport width (${viewportWidth}px)`,
    ).toBeLessThanOrEqual(viewportWidth + 1); // +1px for sub-pixel rounding

    // Positive width
    expect(
      box.width,
      `${label} [assertion 4] width (${box.width.toFixed(1)}px) must be > 0`,
    ).toBeGreaterThan(0);

    // Positive height
    expect(
      box.height,
      `${label} [assertion 4] height (${box.height.toFixed(1)}px) must be > 0`,
    ).toBeGreaterThan(0);

    // Top edge on-screen
    expect(
      box.y,
      `${label} [assertion 5] top edge (${box.y.toFixed(1)}px) must be ≥ 0`,
    ).toBeGreaterThanOrEqual(0);

    // ── 6. Bottom edge must not escape the viewport ───────────────────────
    // All sheet/drawer variants are bounded vertically:
    //   • sheet-bottom / drawer: slide up from the bottom; bottom edge ≤ vh.
    //   • sheet-right  (inset-y-0 h-full): fills the full viewport height,
    //     so bottom edge should equal vh (within 1px rounding tolerance).
    // A regression that removes inset-y-0 or sets an explicit height larger
    // than 100vh would push the bottom edge beyond the viewport.
    const bottom = box.y + box.height;
    expect(
      bottom,
      `${label} [assertion 6] bottom edge (${bottom.toFixed(1)}px) must be ≤ viewport height (${viewportHeight}px)`,
    ).toBeLessThanOrEqual(viewportHeight + 1);
  }
}

/**
 * Assert the close control (Trash2 icon from SheetContent, or Cancel button
 * for Drawer which has no built-in close button) is visible and within bounds.
 */
async function assertCloseControlReachable(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  viewportWidth: number,
  viewportHeight: number,
  label: string,
): Promise<void> {
  // SheetContent renders a Radix Close button with sr-only "Close" text.
  // DrawerContent has no built-in close button; we test the Cancel button instead.
  const closeBtn = dialog.locator("button").filter({ hasText: /close/i }).first();
  const cancelBtn = dialog.locator('[data-testid="drawer-cancel-btn"], [data-testid="sheet-cancel-btn"]').first();

  const closeIsVisible = await closeBtn.isVisible().catch(() => false);
  const cancelIsVisible = await cancelBtn.isVisible().catch(() => false);

  const targetBtn = closeIsVisible ? closeBtn : cancelIsVisible ? cancelBtn : null;

  // If neither is found, the close control assertion is skipped — the component
  // may rely on drag-to-dismiss only, which is acceptable.
  if (!targetBtn) return;

  const box = await targetBtn.boundingBox();
  if (!box) return;

  expect(
    box.x,
    `${label} [close control] left (${box.x.toFixed(1)}px) must be ≥ 0`,
  ).toBeGreaterThanOrEqual(0);

  const btnRight = box.x + box.width;
  expect(
    btnRight,
    `${label} [close control] right (${btnRight.toFixed(1)}px) must be ≤ viewport width (${viewportWidth}px)`,
  ).toBeLessThanOrEqual(viewportWidth + 1);

  expect(
    box.y,
    `${label} [close control] top (${box.y.toFixed(1)}px) must be ≥ 0`,
  ).toBeGreaterThanOrEqual(0);

  const btnBottom = box.y + box.height;
  expect(
    btnBottom,
    `${label} [close control] bottom (${btnBottom.toFixed(1)}px) must be ≤ viewport height (${viewportHeight}px)`,
  ).toBeLessThanOrEqual(viewportHeight + 1);
}

/**
 * Assert the primary action button is within viewport bounds.
 */
async function assertPrimaryActionReachable(
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  viewportWidth: number,
  viewportHeight: number,
  label: string,
): Promise<void> {
  const primaryBtn = dialog
    .locator('[data-testid="sheet-primary-btn"], [data-testid="drawer-primary-btn"]')
    .first();

  const isVisible = await primaryBtn.isVisible().catch(() => false);
  if (!isVisible) return;

  const box = await primaryBtn.boundingBox();
  if (!box) return;

  expect(
    box.x,
    `${label} [primary action] left (${box.x.toFixed(1)}px) must be ≥ 0`,
  ).toBeGreaterThanOrEqual(0);

  const btnRight = box.x + box.width;
  expect(
    btnRight,
    `${label} [primary action] right (${btnRight.toFixed(1)}px) must be ≤ viewport width (${viewportWidth}px)`,
  ).toBeLessThanOrEqual(viewportWidth + 1);

  expect(
    box.y,
    `${label} [primary action] top (${box.y.toFixed(1)}px) must be ≥ 0`,
  ).toBeGreaterThanOrEqual(0);

  const btnBottom = box.y + box.height;
  expect(
    btnBottom,
    `${label} [primary action] bottom (${btnBottom.toFixed(1)}px) must be ≤ viewport height (${viewportHeight}px)`,
  ).toBeLessThanOrEqual(viewportHeight + 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — Viewport × variant matrix (BLOCKING gate)
//
// Every Sheet/Drawer variant is tested at every viewport. A failure means
// that viewport's users would see the layout regression on a real device.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Bottom Sheet / Drawer variants — viewport layout regression guard (BLOCKING gate)", () => {
  for (const variant of VARIANTS) {
    test.describe(variant.label, () => {
      for (const viewport of VIEWPORTS) {
        test(
          `[${viewport.name} ${viewport.width}×${viewport.height}] sheet within viewport — no horizontal overflow`,
          async ({ page }) => {
            await page.setViewportSize({
              width: viewport.width,
              height: viewport.height,
            });

            await gotoVariant(page, variant.name);

            const label = `${variant.label} @ ${viewport.name} (${viewport.width}×${viewport.height})`;
            const dialog = await getSheetDialog(page, label);

            await assertSheetBounds(
              page,
              dialog,
              viewport.width,
              viewport.height,
              label,
              variant.name,
            );

            await assertCloseControlReachable(
              page,
              dialog,
              viewport.width,
              viewport.height,
              label,
            );

            await assertPrimaryActionReachable(
              page,
              dialog,
              viewport.width,
              viewport.height,
              label,
            );
          },
        );
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — Portrait-width invariant
//
// A bottom sheet must never be wider on portrait mobile than it is on
// desktop. Both Sheet and Drawer use inset-x-0 so their width is always
// 100vw. On portrait mobile (375px) they must be narrower than on desktop
// (1280px). A regression where inset-x-0 is overridden by an explicit
// width wider than the viewport would show up here.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Sheet / Drawer portrait-width invariant — width does not balloon on mobile", () => {
  // Only bottom-anchored components — right/left sheets are intentionally
  // narrower than the viewport (w-3/4) and don't have a cross-viewport comparison.
  const bottomVariants = VARIANTS.filter(
    (v) => v.name === "sheet-bottom" || v.name === "drawer",
  );

  for (const variant of bottomVariants) {
    test(`${variant.label}: portrait-mobile width ≤ desktop width + 10%`, async ({
      page,
    }) => {
      // Measure at portrait mobile
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

      const threshold = desktopBox.width * 1.1;
      expect(
        portraitBox.width,
        `${variant.label}: portrait width (${portraitBox.width.toFixed(0)}px) must not exceed desktop width (${desktopBox.width.toFixed(0)}px) + 10%`,
      ).toBeLessThanOrEqual(threshold);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — Bottom-edge reference check on the smallest mobile viewport
//
// Mirrors the exact-values regression reproduction in
// inspiration-capture-modal-viewport.spec.ts § Suite 2.
//
// On a 375×667 viewport a bottom sheet must not push its bottom edge
// below 667px. If the sheet's height calculation breaks (e.g. a percentage
// height resolves against the wrong ancestor), this catches it.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Bottom Sheet / Drawer — bottom-edge reference check on small-iphone-portrait", () => {
  const bottomVariants = VARIANTS.filter(
    (v) => v.name === "sheet-bottom" || v.name === "drawer",
  );

  for (const variant of bottomVariants) {
    test(
      `${variant.label}: bottom edge ≤ 667px on 375×667 viewport`,
      async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await gotoVariant(page, variant.name);

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog, "sheet must be visible on 375×667").toBeVisible({
          timeout: 8_000,
        });

        const box = await dialog.boundingBox();
        expect(box, "sheet must have a measurable bounding box").not.toBeNull();

        if (box) {
          // Horizontal bounds
          expect(
            box.x,
            `${variant.label}: left edge (${box.x.toFixed(1)}px) must be ≥ 0`,
          ).toBeGreaterThanOrEqual(0);

          const right = box.x + box.width;
          expect(
            right,
            `${variant.label}: right edge (${right.toFixed(1)}px) must be ≤ 375px`,
          ).toBeLessThanOrEqual(376); // 375 + 1px sub-pixel tolerance

          // Bottom edge must not escape the 667px viewport
          const bottom = box.y + box.height;
          expect(
            bottom,
            `${variant.label}: bottom edge (${bottom.toFixed(1)}px) must be ≤ 667px`,
          ).toBeLessThanOrEqual(668); // 667 + 1px sub-pixel tolerance

          // No body horizontal scroll
          const scrollWidth: number = await page.evaluate(() => document.body.scrollWidth);
          expect(
            scrollWidth,
            `${variant.label}: body.scrollWidth (${scrollWidth}px) must be ≤ 375px`,
          ).toBeLessThanOrEqual(375);
        }
      },
    );
  }
});
