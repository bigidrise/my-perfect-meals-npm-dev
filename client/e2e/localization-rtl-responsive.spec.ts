/**
 * Phase 0 — Localization Responsive + RTL Playwright Tests
 *
 * Test matrix per shared component:
 *   Viewports:  375px, 390px, 430px, 768px
 *   Locales:    en (baseline), xq (pseudo +40%), es (long text), ar (RTL)
 *   A11y:       default font size + 130% scaling
 *
 * A component FAILS if at any viewport+locale combination:
 *   - Text is clipped (overflow hidden cutting content)
 *   - A button is inaccessible (too small, hidden, overlapped)
 *   - Navigation overflows without graceful handling
 *   - RTL has directional artifacts (wrong padding, wrong icon orientation)
 */

import { test, expect, Page } from "@playwright/test";

// ── Viewport matrix ───────────────────────────────────────────────────────
const VIEWPORTS = [
  { name: "small-mobile", width: 375, height: 812 },
  { name: "standard-mobile", width: 390, height: 844 },
  { name: "large-mobile", width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
] as const;

// ── Locale matrix ─────────────────────────────────────────────────────────
const LOCALES = [
  { code: "en", dir: "ltr", name: "English (baseline)" },
  { code: "xq", dir: "ltr", name: "Pseudo-locale (+40% expansion)" },
  { code: "es", dir: "ltr", name: "Spanish (long text)" },
  { code: "ar", dir: "rtl", name: "Arabic (RTL)" },
] as const;

// ── Helper: switch locale via i18n ────────────────────────────────────────
async function switchLocale(page: Page, code: string) {
  await page.evaluate((locale) => {
    // Access i18n instance via window (set in i18n/index.ts)
    const i18n = (window as any).i18n;
    if (i18n?.changeLanguage) {
      return i18n.changeLanguage(locale);
    }
    // Fallback: set localStorage and reload
    localStorage.setItem("mpm_lang", locale);
  }, code);
  // Short settle time
  await page.waitForTimeout(300);
}

// ── Helper: check for text overflow / clipping ────────────────────────────
async function checkNoTextClipping(page: Page, selector: string) {
  const isClipped = await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    for (const el of elements) {
      const { scrollHeight, clientHeight, scrollWidth, clientWidth } = el;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      if (
        (overflowY === "hidden" && scrollHeight > clientHeight + 2) ||
        (overflowX === "hidden" && scrollWidth > clientWidth + 2)
      ) {
        return true;
      }
    }
    return false;
  }, selector);
  return isClipped;
}

// ── Helper: check RTL document direction ─────────────────────────────────
async function checkRTLDirection(page: Page) {
  return page.evaluate(() => document.documentElement.dir);
}

// ── Welcome page — Phase 0 smoke tests ───────────────────────────────────
test.describe("Welcome Page — Localization Responsive Tests", () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`[${viewport.name}] [${locale.code}] Welcome page renders without overflow`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        await page.goto("/");
        await page.waitForSelector("h1", { timeout: 10000 });

        await switchLocale(page, locale.code);

        // RTL direction check for Arabic
        if (locale.dir === "rtl") {
          const dir = await checkRTLDirection(page);
          expect(dir, `Arabic should set dir=rtl on <html>`).toBe("rtl");
        }

        // Check main heading is visible
        const heading = page.locator("h1").first();
        await expect(heading).toBeVisible();

        // Check CTA button is accessible
        const cta = page.locator('button, [role="button"]').first();
        await expect(cta).toBeVisible();

        // No clipping on key containers
        const clipped = await checkNoTextClipping(page, "h1, p, button");
        expect(clipped, `Text should not be clipped at ${viewport.width}px in ${locale.code}`).toBe(false);

        // Screenshot for visual review
        await page.screenshot({
          path: `docs/localization/screenshots/welcome-${viewport.name}-${locale.code}.png`,
          fullPage: false,
        });
      });
    }
  }
});

// ── RTL: Arabic direction propagation ────────────────────────────────────
test.describe("Arabic RTL — Direction Propagation", () => {
  test("Switching to Arabic sets dir=rtl on html element", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");

    await switchLocale(page, "ar");

    const dir = await checkRTLDirection(page);
    expect(dir).toBe("rtl");

    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(lang).toBe("ar");
  });

  test("Switching back from Arabic to English restores dir=ltr", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");

    await switchLocale(page, "ar");
    await switchLocale(page, "en");

    const dir = await checkRTLDirection(page);
    expect(dir).toBe("ltr");
  });
});

// ── Pseudo-locale: layout stress ─────────────────────────────────────────
test.describe("Pseudo-locale — Layout Expansion Stress", () => {
  for (const viewport of VIEWPORTS) {
    test(`[${viewport.name}] Pseudo-locale (+40%) does not clip text on welcome page`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForSelector("h1");

      await switchLocale(page, "xq");
      await page.waitForTimeout(300);

      const clipped = await checkNoTextClipping(page, "h1, p, button, nav");
      expect(clipped, `Expanded text should not clip at ${viewport.width}px`).toBe(false);
    });
  }
});

// ── Accessibility: text scaling ───────────────────────────────────────────
test.describe("Accessibility — Text Size Scaling", () => {
  test("Page is usable at 130% font size with Spanish locale", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");

    // Inject 130% font scaling
    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });

    await switchLocale(page, "es");
    await page.waitForTimeout(300);

    const cta = page.locator('button').first();
    await expect(cta).toBeVisible();

    const clipped = await checkNoTextClipping(page, "h1, p, button");
    expect(clipped, "Text should not clip at 130% font size in Spanish").toBe(false);
  });

  test("Page is usable at 130% font size with Arabic RTL", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");

    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });

    await switchLocale(page, "ar");
    await page.waitForTimeout(300);

    const dir = await checkRTLDirection(page);
    expect(dir).toBe("rtl");

    const cta = page.locator('button').first();
    await expect(cta).toBeVisible();
  });
});
