/**
 * Playwright — SavedMealRow translation language-switch invariants
 *
 * Verifies the lazy-translation + React-Query caching contract across locale
 * switches within a single session:
 *
 *  1. English → no network call, no spinner, canonical text visible immediately.
 *  2. Spanish → spinner shown while API is pending, Spanish name visible after.
 *  3. Chinese → spinner shown while API is pending, Chinese name visible after.
 *  4. Back to English → no spinner, English title shown (hook disabled for 'en').
 *  5. Spanish again → instant (staleTime:Infinity cache hit, no spinner).
 *  6. Ingredient amounts/units are identical in all locales (canonical values
 *     are never sent to the translator).
 *
 * The tests mock every API call so they are fully offline and deterministic.
 */

import { test, expect, type Page } from "@playwright/test";

// ─── Fixture data ─────────────────────────────────────────────────────────────

const MEAL_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MEAL_TITLE_EN = "Grilled Chicken Bowl";
const MEAL_TITLE_ES = "Tazón de Pollo a la Parrilla";
const MEAL_TITLE_ZH = "烤鸡碗";

/** A single saved-meal record with structured ingredients. */
const SAVED_MEAL = {
  id: MEAL_ID,
  title: MEAL_TITLE_EN,
  sourceType: "ai-creator",
  savedFromDiabeticBuilder: false,
  bglBucket: null,
  generatedBglMgdl: null,
  protocolType: null,
  glucoseContext: null,
  dayMismatchNote: null,
  mealData: {
    description: "A balanced bowl with lean protein.",
    nutrition: { calories: 480, protein: 38, carbs: 45, fat: 12 },
    ingredients: [
      { amount: "6", unit: "oz", item: "chicken breast", name: "chicken breast" },
      { amount: "1", unit: "cup", item: "brown rice", name: "brown rice" },
      { amount: "2", unit: "tbsp", item: "olive oil", name: "olive oil" },
    ],
    instructions: ["Grill the chicken.", "Serve over rice.", "Drizzle with oil."],
    imageUrl: null,
    servings: 1,
    servingSize: "1 bowl",
  },
};

/** Spanish translation payload — only text fields, amounts unchanged. */
const ES_TRANSLATION = {
  translatedName: MEAL_TITLE_ES,
  translatedDescription: "Un tazón equilibrado con proteína magra.",
  translatedIngredients: [
    { item: "pechuga de pollo" },
    { item: "arroz integral" },
    { item: "aceite de oliva" },
  ],
  translatedInstructions: [
    "Asa el pollo.",
    "Sirve sobre el arroz.",
    "Rocía con aceite.",
  ],
  locale: "es",
  fromCache: false,
};

/** Chinese translation payload. */
const ZH_TRANSLATION = {
  translatedName: MEAL_TITLE_ZH,
  translatedDescription: "一碗均衡的精益蛋白质碗。",
  translatedIngredients: [
    { item: "鸡胸肉" },
    { item: "糙米" },
    { item: "橄榄油" },
  ],
  translatedInstructions: ["烤鸡。", "放在米饭上。", "淋上油。"],
  locale: "zh",
  fromCache: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mock all auth/session/profile calls so the app boots and PaywallGuard passes. */
async function mockAuth(page: Page) {
  const fakeUser = {
    id: "test-user-translation",
    email: "tl@test.example",
    name: "Translation Tester",
    planLookupKey: "premium",
    subscriptionStatus: "active",
    entitlements: [],
    trialEndsAt: null,
    isEmailVerified: true,
    createdAt: new Date().toISOString(),
  };

  await page.route("/api/user/profile", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeUser) })
  );
  await page.route("/api/auth/session", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true }) })
  );
  await page.route("/api/user/preferences", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ preferredLanguage: "en" }) })
  );
  await page.route("/api/org/config", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ featureFlags: {} }) })
  );
}

/** Mock the saved-meals list to return a single meal. */
async function mockSavedMeals(page: Page) {
  await page.route("/api/saved-meals*", (r) => {
    if (r.request().url().includes("/translation")) return r.fallback();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([SAVED_MEAL]),
    });
  });
}

/**
 * Install a controlled translation route for the given locale.
 * `delayMs > 0` simulates network latency so the spinner is observable.
 * Returns a counter of how many times the route was hit.
 */
function installTranslationRoute(
  page: Page,
  locale: string,
  payload: object,
  delayMs = 0
): { callCount: () => number } {
  let count = 0;
  page.route(`**/api/saved-meals/${MEAL_ID}/translation?locale=${locale}`, async (r) => {
    count++;
    if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  return { callCount: () => count };
}

/**
 * Change the active i18next locale from inside the browser context.
 * i18next registers itself on window.i18next when loaded.
 */
async function switchLocale(page: Page, locale: string) {
  await page.evaluate(
    (loc) => (window as any).i18next?.changeLanguage(loc),
    locale
  );
  // Give React a moment to re-render after the locale change
  await page.waitForTimeout(100);
}

/**
 * Click the meal card to expand it (or collapse if already expanded).
 * Waits for the button to be visible first.
 */
async function toggleCard(page: Page) {
  const header = page.getByRole("button").filter({ hasText: MEAL_TITLE_EN }).first();
  // Fall back to a broader selector — the button contains the canonical EN title
  // even while translated (header always shows canonical when collapsed)
  await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("SavedMealRow translation — language switch", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockSavedMeals(page);
  });

  // ── 1. English: no network call, no spinner ──────────────────────────────
  test("English locale: expand shows canonical content without spinner or network call", async ({
    page,
  }) => {
    let translationHit = false;
    await page.route(`**/api/saved-meals/${MEAL_ID}/translation*`, () => {
      translationHit = true;
    });

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    // Expand the card
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Canonical calories visible — meal expanded
    await expect(page.getByText("480")).toBeVisible({ timeout: 5000 });

    // No spinner
    await expect(page.getByText("Translating…")).not.toBeVisible();

    // No network call to translation endpoint
    expect(translationHit).toBe(false);
  });

  // ── 2. Spanish: spinner shown, then translated name appears ─────────────
  test("Spanish locale: shows spinner while fetching, then Spanish name", async ({
    page,
  }) => {
    const esRoute = installTranslationRoute(page, "es", ES_TRANSLATION, 600);

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    await switchLocale(page, "es");

    // Expand the card
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Spinner must appear during the 600 ms delay
    await expect(page.getByText("Translating…")).toBeVisible({ timeout: 3000 });

    // After the API resolves the Spanish name replaces the spinner
    await expect(page.getByText(MEAL_TITLE_ES)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Translating…")).not.toBeVisible();

    // Exactly one network call was made
    expect(esRoute.callCount()).toBe(1);
  });

  // ── 3. Chinese: spinner then Chinese name ────────────────────────────────
  test("Chinese locale: shows spinner while fetching, then Chinese name", async ({
    page,
  }) => {
    installTranslationRoute(page, "es", ES_TRANSLATION, 0);
    const zhRoute = installTranslationRoute(page, "zh", ZH_TRANSLATION, 600);

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    await switchLocale(page, "zh");

    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    await expect(page.getByText("Translating…")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(MEAL_TITLE_ZH)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Translating…")).not.toBeVisible();

    expect(zhRoute.callCount()).toBe(1);
  });

  // ── 4. Back to English: no spinner, English title shown ─────────────────
  test("Back to English from Spanish: no spinner, English title visible", async ({
    page,
  }) => {
    installTranslationRoute(page, "es", ES_TRANSLATION, 0);

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    // Switch to Spanish and expand
    await switchLocale(page, "es");
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
    await expect(page.getByText(MEAL_TITLE_ES)).toBeVisible({ timeout: 5000 });

    // Collapse card
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Switch back to English
    await switchLocale(page, "en");

    let translationHitAfter = false;
    await page.route(`**/api/saved-meals/${MEAL_ID}/translation*`, () => {
      translationHitAfter = true;
    });

    // Expand again
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Canonical calories visible
    await expect(page.getByText("480")).toBeVisible({ timeout: 5000 });
    // No spinner
    await expect(page.getByText("Translating…")).not.toBeVisible();
    // No new network call
    expect(translationHitAfter).toBe(false);
  });

  // ── 5. Cache hit: second Spanish open is instant (no spinner) ────────────
  test("Second Spanish expand is instant — React Query cache hit, no spinner", async ({
    page,
  }) => {
    // First call is instant (0 ms delay) to pre-warm the cache
    const esRoute = installTranslationRoute(page, "es", ES_TRANSLATION, 0);

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    await switchLocale(page, "es");

    // First expand — warms the cache
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
    await expect(page.getByText(MEAL_TITLE_ES)).toBeVisible({ timeout: 5000 });

    // Collapse
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Switch away and back to Spanish
    await switchLocale(page, "en");
    await switchLocale(page, "es");

    // Second expand
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Must resolve immediately — no spinner
    await expect(page.getByText("Translating…")).not.toBeVisible();
    await expect(page.getByText(MEAL_TITLE_ES)).toBeVisible({ timeout: 2000 });

    // Still only one network call (staleTime: Infinity)
    expect(esRoute.callCount()).toBe(1);
  });

  // ── 6. Ingredient amounts identical across all three locales ────────────
  test("Ingredient amounts and units are canonical (identical) in all three locales", async ({
    page,
  }) => {
    installTranslationRoute(page, "es", ES_TRANSLATION, 0);
    installTranslationRoute(page, "zh", ZH_TRANSLATION, 0);

    await page.goto("/saved-meals");
    await expect(page.getByText(MEAL_TITLE_EN)).toBeVisible({ timeout: 8000 });

    async function expandAndGetIngredientText() {
      // Ensure expanded
      await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
      // Wait for content to settle
      await expect(page.getByText("480")).toBeVisible({ timeout: 5000 });
      const ingredientBlock = page.locator(`[id="meal-card-${MEAL_ID}"]`).locator("ul");
      return ingredientBlock.innerText();
    }

    // English
    const enIngredients = await expandAndGetIngredientText();
    expect(enIngredients).toContain("6");
    expect(enIngredients).toContain("oz");

    // Collapse
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Spanish
    await switchLocale(page, "es");
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
    await expect(page.getByText(MEAL_TITLE_ES)).toBeVisible({ timeout: 5000 });
    const ingredientBlock = page.locator(`[id="meal-card-${MEAL_ID}"]`).locator("ul");
    const esIngredients = await ingredientBlock.innerText();

    // Collapse
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();

    // Chinese
    await switchLocale(page, "zh");
    await page.locator(`[id="meal-card-${MEAL_ID}"] button`).first().click();
    await expect(page.getByText(MEAL_TITLE_ZH)).toBeVisible({ timeout: 5000 });
    const zhIngredients = await page
      .locator(`[id="meal-card-${MEAL_ID}"]`)
      .locator("ul")
      .innerText();

    // Amounts ("6 oz") must appear verbatim in all three views
    for (const ingredients of [enIngredients, esIngredients, zhIngredients]) {
      expect(ingredients).toContain("6");
      expect(ingredients).toContain("oz");
      expect(ingredients).toContain("1");
      expect(ingredients).toContain("cup");
      expect(ingredients).toContain("2");
      expect(ingredients).toContain("tbsp");
    }
  });
});
