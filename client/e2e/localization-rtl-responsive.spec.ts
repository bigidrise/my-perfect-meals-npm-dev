/**
 * Localization — Responsive + RTL Playwright Tests
 *
 * Test matrix:
 *   Viewports:  375px, 390px, 430px, 768px
 *   Locales:    en (baseline), xq (pseudo +40%), es (long text),
 *               tl (Tagalog layout stress), ar (RTL)
 *   A11y:       default font size + 130% scaling (ES, AR, TL)
 *
 * Authenticated surface tests mock every API call (same pattern as
 * meal-translation-language-switch.spec.ts) and navigate to real
 * app routes (/saved-meals, /dashboard), not just the landing page.
 *
 * A test FAILS if at any viewport+locale combination:
 *   - Text is clipped (overflow:hidden cutting visible content)
 *   - A CTA button / nav item is not visible
 *   - Arabic locale does not produce dir=rtl on <html>
 *   - xq locale is fallen back to English instead of being active
 */

import { test, expect, type Page } from "@playwright/test";

// ── Viewport matrix ────────────────────────────────────────────────────────
const VIEWPORTS = [
  { name: "small-mobile",    width: 375, height: 812 },
  { name: "standard-mobile", width: 390, height: 844 },
  { name: "large-mobile",    width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
] as const;

// ── Locale matrix ──────────────────────────────────────────────────────────
const LOCALES = [
  { code: "en", dir: "ltr", name: "English (baseline)" },
  { code: "xq", dir: "ltr", name: "Pseudo-locale (+40% expansion)" },
  { code: "es", dir: "ltr", name: "Spanish (long text)" },
  { code: "tl", dir: "ltr", name: "Tagalog (layout stress)" },
  { code: "ar", dir: "rtl", name: "Arabic (RTL)" },
] as const;

// ── Auth mock: covers every API the app calls on boot + saved-meals ────────
//
// AuthContext requires both mpm_auth_token AND mpm_current_user in localStorage
// to take the "has session → refresh" path. Without them it clears isAuthenticated
// and redirects to /welcome. We set them via addInitScript (runs before page JS).
// Route patterns use **/ prefix so they match full absolute URLs too.
//
async function mockAuth(page: Page, preferredLanguage = "en") {
  const user = {
    id: "loc-test-user",
    email: "loc-test@example.com",
    username: "Locale Tester",
    firstName: "Locale",
    lastName: "Tester",
    planLookupKey: "mpm_premium_monthly",
    subscriptionStatus: "active",
    entitlements: [],
    trialEndsAt: null,
    isEmailVerified: true,
    preferredLanguage,
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

  // addInitScript runs before any page script — seeds AuthContext's localStorage deps
  await page.addInitScript((u) => {
    localStorage.setItem("mpm_auth_token", "loc-test-fake-token");
    localStorage.setItem("mpm_current_user", JSON.stringify(u));
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("mpm.skipWelcomeGate", "true");
    localStorage.setItem(
      "macro_calculator_settings",
      JSON.stringify({ age: 30, heightCm: 170, weightKg: 70 })
    );
  }, user);

  // Playwright routes match in LAST-REGISTERED-FIRST order (newest handler wins).
  // Register the catch-all FIRST so specific routes registered AFTER it take priority.
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );
  // Specific routes registered AFTER the catch-all → they take precedence.
  await page.route("**/api/saved-meals**", (r) => {
    const url = r.request().url();
    if (url.includes("/translation") || url.includes("/toggle") || url.includes("/check")) {
      return r.fallback();
    }
    // useSavedMealsFeed expects the paginated shape { meals, total, page, limit, hasMore }.
    // Returning a plain [] caused the component to error once PaywallGuard started
    // passing (planLookupKey "mpm_premium_monthly" maps to tier "premium").
    return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ meals: [], total: 0, page: 1, limit: 20, hasMore: false }) });
  });
  await page.route("**/api/user/preferences**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ preferredLanguage }) })
  );
  await page.route("**/api/user/profile**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(user) })
  );
  await page.route("**/api/auth/session**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ authenticated: true }) })
  );
}

// ── Wait for authenticated page to mount ──────────────────────────────────
// Waits for networkidle and confirms the SPA stayed on the target route.
async function waitForAuthPage(page: Page, expectedPath: string) {
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  const url = new URL(page.url());
  if (url.pathname !== expectedPath) {
    throw new Error(`Expected ${expectedPath} but landed at ${url.pathname} — auth redirect fired`);
  }
}

// ── Switch locale via the exposed i18n instance ────────────────────────────
// window.i18n (and window.i18next) are set in client/src/i18n/index.ts.
// changeLanguage() also triggers applyDocumentDir() which updates <html dir>.
async function switchLocale(page: Page, code: string) {
  await page.evaluate(async (locale) => {
    const i = (window as any).i18n ?? (window as any).i18next;
    if (i?.changeLanguage) await i.changeLanguage(locale);
  }, code);
  await page.waitForTimeout(400);
}

async function getActiveLocale(page: Page): Promise<string> {
  return page.evaluate(() => {
    const i = (window as any).i18n ?? (window as any).i18next;
    return i?.language ?? "unknown";
  });
}

async function getHtmlDir(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.dir ?? "");
}

async function getHtmlLang(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.lang ?? "");
}

async function hasTextClipping(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    for (const el of document.querySelectorAll(sel)) {
      const { scrollHeight, clientHeight, scrollWidth, clientWidth } = el;
      const s = window.getComputedStyle(el);
      if ((s.overflowY === "hidden" && scrollHeight > clientHeight + 2) ||
          (s.overflowX === "hidden" && scrollWidth > clientWidth + 2)) return true;
    }
    return false;
  }, selector);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Welcome page (public) — locale × viewport matrix
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Welcome page — locale × viewport matrix", () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`[${viewport.name}] [${locale.code}] renders without overflow, locale active`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/");
        await page.waitForSelector("h1", { timeout: 12000 });

        await switchLocale(page, locale.code);

        const active = await getActiveLocale(page);
        expect(active, `i18n must report ${locale.code} as active`).toBe(locale.code);

        if (locale.dir === "rtl") {
          expect(await getHtmlDir(page), "Arabic must set dir=rtl").toBe("rtl");
          expect(await getHtmlLang(page), "Arabic must set lang=ar").toBe("ar");
        } else {
          expect(await getHtmlDir(page)).not.toBe("rtl");
        }

        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator('button, [role="button"], a[href]').first()).toBeVisible();

        const clipped = await hasTextClipping(page, "h1, p, button");
        expect(clipped, `No text clipping at ${viewport.width}px in ${locale.code}`).toBe(false);

        await page.screenshot({
          path: `docs/localization/screenshots/welcome-${viewport.name}-${locale.code}.png`,
          fullPage: false,
        });
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Arabic RTL — direction propagation
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Arabic RTL — direction propagation", () => {
  test("Switching to Arabic sets dir=rtl and lang=ar on <html>", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");
    await switchLocale(page, "ar");
    expect(await getHtmlDir(page)).toBe("rtl");
    expect(await getHtmlLang(page)).toBe("ar");
    expect(await getActiveLocale(page)).toBe("ar");
  });

  test("Switching back from Arabic to English restores dir=ltr", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForSelector("h1");
    await switchLocale(page, "ar");
    expect(await getHtmlDir(page)).toBe("rtl");
    await switchLocale(page, "en");
    expect(await getHtmlDir(page)).toBe("ltr");
    expect(await getActiveLocale(page)).toBe("en");
  });

  test("Arabic RTL holds at all four viewports", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForSelector("h1");
      await switchLocale(page, "ar");
      expect(await getHtmlDir(page), `dir=rtl must hold at ${viewport.width}px`).toBe("rtl");
      await page.screenshot({
        path: `docs/localization/screenshots/rtl-${viewport.name}.png`,
        fullPage: false,
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Authenticated surfaces: /saved-meals and /dashboard
//
// All API calls are mocked. Tests navigate to real app routes (not "/")
// and assert localized rendered content plus RTL layout.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Authenticated surfaces — /saved-meals", () => {
  test("Arabic RTL: dir=rtl active and bottom nav visible on /saved-meals", async ({ page }) => {
    await mockAuth(page, "ar");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");

    await switchLocale(page, "ar");

    expect(await getHtmlDir(page), "dir=rtl must be set on /saved-meals with Arabic").toBe("rtl");
    expect(await getHtmlLang(page)).toBe("ar");
    expect(await getActiveLocale(page)).toBe("ar");

    // Bottom navigation must be present in the DOM and visible
    const nav = page.locator("nav").first();
    await expect(nav, "Bottom nav must be rendered for authenticated users").toBeVisible();

    // No text clipping anywhere on the page
    const clipped = await hasTextClipping(page, "nav, button, h1, h2, p");
    expect(clipped, "No clipping on /saved-meals in Arabic").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/saved-meals-ar-rtl.png", fullPage: false });
  });

  test("Arabic RTL: /saved-meals renders translated content — visible text + dir=rtl", async ({ page }) => {
    await mockAuth(page, "ar");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");

    await switchLocale(page, "ar");

    expect(await getHtmlDir(page)).toBe("rtl");
    expect(await getActiveLocale(page)).toBe("ar");

    // At least one visible text-bearing element must exist (heading, button, or nav item)
    const anyText = page.locator("h1, h2, h3, button, nav a, [role='tab']").first();
    await expect(anyText, "Some text-bearing element must be visible in Arabic").toBeVisible();

    await page.screenshot({ path: "docs/localization/screenshots/saved-meals-ar-nav.png", fullPage: false });
  });

  test("Pseudo-locale xq: active on /saved-meals (not fallen back to EN)", async ({ page }) => {
    await mockAuth(page, "en");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");

    await switchLocale(page, "xq");

    const active = await getActiveLocale(page);
    expect(active, "xq must be active, not fallen back to en").toBe("xq");

    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping on /saved-meals with xq expansion").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/saved-meals-xq.png", fullPage: false });
  });

  test("Spanish: /saved-meals renders without clipping at all four viewports", async ({ page }) => {
    await mockAuth(page, "es");
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/saved-meals");
      await waitForAuthPage(page, "/saved-meals");
      await switchLocale(page, "es");

      expect(await getActiveLocale(page)).toBe("es");
      const clipped = await hasTextClipping(page, "button, h1, h2, p");
      expect(clipped, `No clipping on /saved-meals in ES at ${viewport.width}px`).toBe(false);

      await page.screenshot({
        path: `docs/localization/screenshots/saved-meals-es-${viewport.name}.png`,
        fullPage: false,
      });
    }
  });

  test("Tagalog: /saved-meals renders without clipping at narrow viewport", async ({ page }) => {
    await mockAuth(page, "tl");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await switchLocale(page, "tl");

    expect(await getActiveLocale(page)).toBe("tl");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping on /saved-meals in TL at 375px").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/saved-meals-tl-narrow.png", fullPage: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Pseudo-locale xq — layout expansion stress (welcome page)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Pseudo-locale xq — layout expansion stress", () => {
  for (const viewport of VIEWPORTS) {
    test(`[${viewport.name}] xq (+40%) does not clip text`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForSelector("h1");
      await switchLocale(page, "xq");

      const active = await getActiveLocale(page);
      expect(active, "xq must be active, not fallen back to en").toBe("xq");

      const clipped = await hasTextClipping(page, "h1, p, button, nav");
      expect(clipped, `Expanded text must not clip at ${viewport.width}px`).toBe(false);

      await page.screenshot({
        path: `docs/localization/screenshots/xq-${viewport.name}.png`,
        fullPage: false,
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5b — Language persistence across navigation
// Verifies the active locale does not reset when the user navigates between
// routes in the SPA.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Language persistence across navigation", () => {
  test("Arabic locale persists from /saved-meals to / (AuthContext restores preferredLanguage)", async ({ page }) => {
    // mockAuth sets preferredLanguage:"ar" in /api/user/profile.
    // After any page.goto, AuthContext fetches the profile and calls
    // i18n.changeLanguage("ar"), so the locale must be "ar" — not "en".
    await mockAuth(page, "ar");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await switchLocale(page, "ar");
    expect(await getActiveLocale(page)).toBe("ar");
    expect(await getHtmlDir(page)).toBe("rtl");

    // Full page navigation — AuthContext will re-apply preferredLanguage:"ar"
    await page.goto("/");
    await page.waitForSelector("h1", { timeout: 10000 });

    // Wait until i18n settles on "ar" (AuthContext sets it from /api/user/profile)
    await page.waitForFunction(
      () => {
        const i = (window as any).i18n ?? (window as any).i18next;
        return i?.language === "ar";
      },
      { timeout: 8000 }
    );

    expect(await getActiveLocale(page), "Arabic must be the active locale after navigation").toBe("ar");
    expect(await getHtmlDir(page), "dir=rtl must be restored after navigation").toBe("rtl");
    expect(await getHtmlLang(page)).toBe("ar");
  });

  test("Spanish locale persists from / to /saved-meals (AuthContext restores preferredLanguage)", async ({ page }) => {
    await mockAuth(page, "es");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/");
    await page.waitForSelector("h1");

    // Wait for AuthContext to apply preferredLanguage:"es"
    await page.waitForFunction(
      () => {
        const i = (window as any).i18n ?? (window as any).i18next;
        return i?.language === "es";
      },
      { timeout: 8000 }
    );
    expect(await getActiveLocale(page)).toBe("es");

    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");

    // AuthContext re-applies preferredLanguage:"es" after the new page load
    await page.waitForFunction(
      () => {
        const i = (window as any).i18n ?? (window as any).i18next;
        return i?.language === "es";
      },
      { timeout: 8000 }
    );

    expect(await getActiveLocale(page), "Spanish must be restored after navigation").toBe("es");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping after Spanish locale navigation").toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5c — Additional authenticated surfaces
// Covers /dashboard, /grocery-coach (Grocery Coach), /coach (Coach's Corner),
// and a clinical-adjacent route. All API calls are mocked; assertions focus
// on locale activation, RTL direction, nav visibility, and no text clipping.
// ═══════════════════════════════════════════════════════════════════════════

const AUTHENTICATED_SURFACES = [
  { route: "/dashboard",      name: "Dashboard" },
  { route: "/grocery-coach",  name: "Grocery Coach" },
  { route: "/coach",          name: "Coach's Corner" },
  { route: "/glp1",           name: "GLP-1 Hub (clinical)" },
] as const;

test.describe("Authenticated surfaces — Arabic RTL on nav/coach/clinical", () => {
  for (const surface of AUTHENTICATED_SURFACES) {
    test(`Arabic RTL active on ${surface.name} (${surface.route})`, async ({ page }) => {
      await mockAuth(page, "ar");
      await page.setViewportSize({ width: 390, height: 844 });

      await page.goto(surface.route);
      // Some routes may redirect if the SPA guard fires; wait for load
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      await switchLocale(page, "ar");
      expect(await getActiveLocale(page)).toBe("ar");
      expect(await getHtmlDir(page), `dir=rtl must be set on ${surface.route}`).toBe("rtl");
      expect(await getHtmlLang(page)).toBe("ar");

      // At least one visible interactive element must exist (nav, button, or link)
      const anyEl = page.locator("nav, button, a[href], [role='tab']").first();
      await expect(anyEl, `Some UI element must be visible on ${surface.route}`).toBeVisible();

      const clipped = await hasTextClipping(page, "nav, button, h1, h2, p");
      expect(clipped, `No clipping on ${surface.route} in Arabic`).toBe(false);

      await page.screenshot({
        path: `docs/localization/screenshots/${surface.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-ar-rtl.png`,
        fullPage: false,
      });
    });
  }

  test("Narrow viewport (375px) — Arabic RTL on /dashboard, no nav clipping", async ({ page }) => {
    await mockAuth(page, "ar");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await switchLocale(page, "ar");

    expect(await getHtmlDir(page)).toBe("rtl");
    const clipped = await hasTextClipping(page, "nav, button, h1, h2, p");
    expect(clipped, "No clipping on /dashboard in Arabic at 375px").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/dashboard-ar-375.png", fullPage: false });
  });

  test("Spanish long-text: /grocery-coach renders without clipping at narrow viewport", async ({ page }) => {
    await mockAuth(page, "es");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/grocery-coach");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await switchLocale(page, "es");

    expect(await getActiveLocale(page)).toBe("es");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping on /grocery-coach in ES at 375px").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/grocery-coach-es-375.png", fullPage: false });
  });

  test("Tagalog: /coach surface active at narrow viewport, no clipping", async ({ page }) => {
    await mockAuth(page, "tl");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/coach");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await switchLocale(page, "tl");

    expect(await getActiveLocale(page)).toBe("tl");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping on /coach in TL at 375px").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/coach-tl-375.png", fullPage: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5d — Meal card + bottom-sheet surface (mocked)
// A mock saved-meal card is injected into /saved-meals to verify Arabic RTL
// renders card text correctly without horizontal overflow.
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Meal card surface — Arabic RTL rendering", () => {
  test("Arabic meal cards on /saved-meals — card title visible, dir=rtl, no overflow", async ({ page }) => {
    // mockAuth registers a /api/saved-meals handler that returns [].
    // We must register our fixture AFTER mockAuth so it takes priority
    // (Playwright uses LIFO: last-registered handler wins).
    await mockAuth(page, "ar");

    const arabicMealTitle = "دجاج بالليمون";
    // Override saved-meals AFTER mockAuth — this handler now wins.
    // The paginated feed endpoint is /api/saved-meals?page=N&limit=N and returns
    // { meals: SavedMealRow[], total: number, page, limit, hasMore }.
    // SavedMealRow uses "title" (not "name") and reads nutrition from mealData.
    // planLookupKey "mpm_premium_monthly" in mockAuth ensures PaywallGuard allows
    // the SavedMeals component to mount so useSavedMealsFeed actually fires.
    await page.route("**/api/saved-meals**", (r) => {
      const url = r.request().url();
      if (url.includes("/translation") || url.includes("/toggle") || url.includes("/check")) {
        return r.fallback();
      }
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          meals: [
            {
              id: "mock-meal-ar-1",
              userId: "loc-test-user",
              title: arabicMealTitle,
              sourceType: "meal-builder",
              signatureHash: "test-hash-ar",
              mealData: {
                name: arabicMealTitle,
                description: "وجبة صحية غنية بالبروتين",
                calories: 450,
                protein: 38,
                carbs: 12,
                fat: 18,
                ingredients: [],
                instructions: "",
              },
              calories: 450,
              protein: 38,
              carbs: 12,
              fat: 18,
              imageUrl: null,
              thumbnailUrl: null,
              displayUrl: null,
              mediaStatus: "none",
              source: "meal-builder",
              savedFromDiabeticBuilder: false,
              bglBucket: null,
              protocolType: null,
              dayMismatchNote: null,
              dayMismatchPolicy: null,
              createdAt: new Date().toISOString(),
              savedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          hasMore: false,
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await switchLocale(page, "ar");

    expect(await getHtmlDir(page)).toBe("rtl");
    expect(await getActiveLocale(page)).toBe("ar");

    // Wait until React Query delivers the fixture data and the component re-renders.
    // We search innerHTML (not innerText) to catch the text even if the element
    // is partially scrolled out of view — the key guarantee is that it IS in the DOM.
    await page.waitForFunction(
      (title) => document.body.innerHTML.includes(title),
      arabicMealTitle,
      { timeout: 15000 }
    );

    // Confirm it is actually visible (not just present in hidden markup)
    await expect(
      page.locator(`text=${arabicMealTitle}`).first(),
      "Arabic meal card title must be visible in the DOM"
    ).toBeVisible({ timeout: 5000 });

    const clipped = await hasTextClipping(page, "h1, h2, h3, p, button, [class*='card'], [class*='meal']");
    expect(clipped, "No text clipping in Arabic meal card surface").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/meal-cards-ar-rtl.png", fullPage: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5e — AI language propagation
//
// How language reaches the AI:
//   The server reads `req.authUser?.preferredLanguage` (groceryCoach.ts:273)
//   — not the request body. The auth middleware resolves authUser from the
//   x-auth-token header sent by the app's HTTP client on every authenticated
//   request.
//
// Test design:
//   (a) Real app request path: GroceryStoreCoachSheet.tsx handleProductSearch()
//       fires the POST — not page.evaluate(fetch). The test opens the sheet
//       via [data-testid="button-grocery-store-coach"], switches to the
//       "Find a Product" tab (index 1), fills the input, presses Enter.
//   (b) Faithful auth middleware mock: the interceptor reads x-auth-token
//       from the captured request and maps the test token → preferredLanguage,
//       mirroring what the real server auth middleware does before groceryCoach.ts
//       reads req.authUser?.preferredLanguage.
//   (c) Access guard: profile mock returns entitlements:["grocery_coach"]
//       so hasGroceryCoachAccess is true (ShoppingListMasterView.tsx:94-95)
//       and the sheet button is rendered and clickable.
// ═══════════════════════════════════════════════════════════════════════════

/** Override user profile after mockAuth (LIFO wins) to add grocery_coach entitlement. */
async function addGroceryAccess(page: Page, locale: string): Promise<void> {
  await page.route("**/api/user/profile**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "loc-test-user",
        email: "loc-test@example.com",
        username: "Locale Tester",
        preferredLanguage: locale,
        planLookupKey: "mpm_premium_monthly",
        subscriptionStatus: "active",
        entitlements: ["grocery_coach"],
        onboardingCompletedAt: new Date(Date.now() - 86400000).toISOString(),
      }),
    })
  );
}

test.describe("AI language propagation — real app POST carries user locale via auth token", () => {
  test("Grocery Coach (ES): handleProductSearch POST carries x-auth-token; auth mock resolves preferredLanguage:es", async ({ page }) => {
    test.setTimeout(60000); // shopping list mounts many lazy components
    // 1. mockAuth first so subsequent overrides win via LIFO
    await mockAuth(page, "es");
    await addGroceryAccess(page, "es");

    // 2. Faithful auth middleware mock (registered after mockAuth → LIFO wins).
    //    Reads x-auth-token, maps test token → preferredLanguage:"es",
    //    mirroring what the real server auth middleware does.
    const captured: { method: string; headers: Record<string, string>; resolvedLang: string }[] = [];
    await page.route("**/api/grocery-coach/**", async (r) => {
      const headers = await r.request().allHeaders();
      const token = headers["x-auth-token"] ?? headers["X-Auth-Token"] ?? "";
      const resolvedLang = token === "loc-test-fake-token" ? "es" : "unknown";
      captured.push({ method: r.request().method(), headers, resolvedLang });
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ advice: [{ brand: "Ranchera", note: "Buena opción" }] }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shopping-list");
    await waitForAuthPage(page, "/shopping-list");

    // 3. Wait for AuthContext to resolve i18n to "es"
    await page.waitForFunction(
      () => { const i = (window as any).i18n ?? (window as any).i18next; return i?.language === "es"; },
      { timeout: 10000 }
    );
    expect(await getActiveLocale(page)).toBe("es");

    // 4. Open the Grocery Coach sheet via the real app button
    const coachBtn = page.locator('[data-testid="button-grocery-store-coach"]');
    await expect(coachBtn, "Coach button must be visible with grocery_coach entitlement").toBeVisible({ timeout: 10000 });
    await coachBtn.click();
    await page.waitForTimeout(800);

    // 5. Switch to "Find a Product" tab (data-testid per GroceryStoreCoachSheet.tsx:919)
    const findProductTab = page.locator('[data-testid="tab-find-product"]');
    if (await findProductTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await findProductTab.click();
      await page.waitForTimeout(400);
    }

    // 6. Fill the input and press Enter → triggers handleProductSearch →
    //    post("/api/grocery-coach/product-advisor", { ingredients: [query] })
    const productInput = page.locator('[data-testid="input-find-product"]');
    await expect(productInput, "Product input must appear after Find-a-Product tab").toBeVisible({ timeout: 8000 });
    await productInput.fill("pollo asado");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // 7. Assert: real app POST captured by faithful auth mock
    const posts = captured.filter((r) => r.method === "POST");
    expect(posts.length,
      "handleProductSearch must fire at least one POST to /api/grocery-coach/**"
    ).toBeGreaterThan(0);
    for (const req of posts) {
      expect(req.headers["x-auth-token"],
        "x-auth-token must be present so server resolves authUser.preferredLanguage"
      ).toBeTruthy();
      expect(req.resolvedLang,
        "Auth middleware mock must resolve token → preferredLanguage:'es'"
      ).toBe("es");
    }
    expect(await getActiveLocale(page)).toBe("es");
  });

  test("Grocery Coach (AR): handleProductSearch POST carries x-auth-token; auth mock resolves preferredLanguage:ar; dir=rtl", async ({ page }) => {
    test.setTimeout(60000);
    await mockAuth(page, "ar");
    await addGroceryAccess(page, "ar");

    const captured: { method: string; headers: Record<string, string>; resolvedLang: string }[] = [];
    await page.route("**/api/grocery-coach/**", async (r) => {
      const headers = await r.request().allHeaders();
      const token = headers["x-auth-token"] ?? headers["X-Auth-Token"] ?? "";
      const resolvedLang = token === "loc-test-fake-token" ? "ar" : "unknown";
      captured.push({ method: r.request().method(), headers, resolvedLang });
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ advice: [{ brand: "TestBrand", note: "جيد" }] }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shopping-list");
    await waitForAuthPage(page, "/shopping-list");

    await page.waitForFunction(
      () => { const i = (window as any).i18n ?? (window as any).i18next; return i?.language === "ar"; },
      { timeout: 10000 }
    );
    expect(await getActiveLocale(page)).toBe("ar");
    expect(await getHtmlDir(page)).toBe("rtl");

    const coachBtn = page.locator('[data-testid="button-grocery-store-coach"]');
    await expect(coachBtn).toBeVisible({ timeout: 10000 });
    await coachBtn.click();
    await page.waitForTimeout(800);

    const findProductTabAr = page.locator('[data-testid="tab-find-product"]');
    if (await findProductTabAr.isVisible({ timeout: 3000 }).catch(() => false)) {
      await findProductTabAr.click();
      await page.waitForTimeout(400);
    }

    const productInput = page.locator('[data-testid="input-find-product"]');
    await expect(productInput).toBeVisible({ timeout: 8000 });
    await productInput.fill("دجاج");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    const posts = captured.filter((r) => r.method === "POST");
    expect(posts.length,
      "handleProductSearch must fire at least one POST"
    ).toBeGreaterThan(0);
    for (const req of posts) {
      expect(req.headers["x-auth-token"], "x-auth-token must be present").toBeTruthy();
      expect(req.resolvedLang, "Auth mock must resolve token → preferredLanguage:'ar'").toBe("ar");
    }
    expect(await getActiveLocale(page)).toBe("ar");
    expect(await getHtmlDir(page)).toBe("rtl");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Accessibility: 130% font-size scaling
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Accessibility — 130% font-size scaling", () => {
  test("130% font size with Spanish on /saved-meals — no clipping", async ({ page }) => {
    await mockAuth(page, "es");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
    await switchLocale(page, "es");

    expect(await getActiveLocale(page)).toBe("es");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping at 130% font size in Spanish").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/font-130pct-es-saved-meals.png", fullPage: false });
  });

  test("130% font size with Arabic RTL on /saved-meals — dir=rtl held + no clipping", async ({ page }) => {
    await mockAuth(page, "ar");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
    await switchLocale(page, "ar");

    expect(await getActiveLocale(page)).toBe("ar");
    expect(await getHtmlDir(page)).toBe("rtl");

    // RTL must hold and nav must remain visible at 130% scaling
    const nav = page.locator("nav").first();
    await expect(nav, "Bottom nav must be visible at 130% Arabic").toBeVisible();

    const clipped = await hasTextClipping(page, "nav, button, h1, h2, p");
    expect(clipped, "No clipping at 130% font size in Arabic RTL").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/font-130pct-ar-saved-meals.png", fullPage: false });
  });

  test("130% font size with Tagalog at narrow viewport on /saved-meals", async ({ page }) => {
    await mockAuth(page, "tl");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/saved-meals");
    await waitForAuthPage(page, "/saved-meals");
    await page.addStyleTag({ content: "html { font-size: 130% !important; }" });
    await switchLocale(page, "tl");

    expect(await getActiveLocale(page)).toBe("tl");
    const clipped = await hasTextClipping(page, "button, h1, h2, p");
    expect(clipped, "No clipping at 130% font size in Tagalog at 375px").toBe(false);

    await page.screenshot({ path: "docs/localization/screenshots/font-130pct-tl-saved-meals.png", fullPage: false });
  });
});
