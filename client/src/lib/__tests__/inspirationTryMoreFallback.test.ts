/**
 * @jest-environment jsdom
 *
 * InspirationCaptureModal — handleTryMore localStorage-restore path
 *
 * When the modal is re-opened after a previous scan the component restores
 * `result` from `mpm.recipe.lastScan` (localStorage).  At that point the
 * session image (`capturedBase64`) is gone and `capturedText` is empty.
 * handleTryMore uses `resolveTryMoreRequestBody` to fall back to
 * `result.extractedDescription` so the server receives a non-empty `content`
 * field and does not return a 400.
 *
 * Tests import the real production export — any regression in the component's
 * fallback, guard, or payload logic will break these tests immediately.
 *
 * Three contracts verified:
 *  1. extractedDescription survives the localStorage round-trip.
 *  2. resolveTryMoreRequestBody produces content = extractedDescription when
 *     the session image is absent and capturedText is empty.
 *  3. resolveTryMoreRequestBody returns null (guard fires) when
 *     extractedDescription is also absent from the persisted object.
 */

// ── Module mocks for the component's non-logic dependencies ──────────────────
// resolveTryMoreRequestBody is a pure exported function; it has no React hooks
// or side-effects. We only need mocks so the component module can be imported
// without crashing in jsdom.

jest.mock("wouter", () => ({ useLocation: () => ["/", jest.fn()] }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => ({ open: jest.fn(), setLastResponse: jest.fn() }),
}));
jest.mock("@/components/copilot/CopilotRespectGuard", () => ({
  shouldAllowAutoOpen: () => false,
}));
jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => `http://localhost:5000${path}`,
}));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/sentry", () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));
// UI components the modal renders — not needed for the pure function tests
jest.mock("@/components/ui/universal-modal", () => ({ UniversalDialog: () => null }));
jest.mock("@/components/ui/dialog", () => ({
  DialogHeader: () => null,
  DialogTitle: () => null,
}));
jest.mock("@/components/ui/pill-button", () => ({ PillButton: () => null }));
jest.mock("@/components/AlphaGalBadge", () => () => null);
jest.mock("@/components/ui/CuisineOverrideControl", () => ({
  CuisineOverrideControl: () => null,
}));
jest.mock("@/components/ui/MealImageSlot", () => ({ MealImageSlot: () => null }));

import {
  resolveTryMoreRequestBody,
  type TryMoreContext,
} from "@/components/InspirationCaptureModal";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mpm.recipe.lastScan";

function makeCtx(overrides: Partial<TryMoreContext> = {}): TryMoreContext {
  return {
    mode: "upload",
    capturedBase64: null,
    capturedText: "",
    result: null,
    servings: 2,
    healthMode: "balanced",
    proteinPriority: "standard",
    prepStyle: "any",
    cuisineOverrideEnabled: false,
    cuisineOverrideValue: "",
    ...overrides,
  };
}

const SCAN_WITH_DESCRIPTION = {
  success: true,
  title: "Grilled Salmon",
  extractedDescription:
    "Grilled salmon fillet with lemon butter, served over steamed rice and asparagus",
  mealData: { name: "Grilled Salmon", nutrition: { calories: 520 }, imageUrl: null },
  options: [
    { name: "Grilled Salmon", nutrition: { calories: 520 }, imageUrl: null },
    { name: "Pan-Seared Salmon", nutrition: { calories: 490 }, imageUrl: null },
    { name: "Teriyaki Salmon Bowl", nutrition: { calories: 560 }, imageUrl: null },
  ],
};

const SCAN_WITHOUT_DESCRIPTION = {
  success: true,
  title: "Mystery Meal",
  // extractedDescription intentionally absent — simulates server regression or
  // a scan saved before the field was introduced
  mealData: { name: "Mystery Meal", nutrition: { calories: 400 }, imageUrl: null },
  options: [{ name: "Mystery Meal", nutrition: { calories: 400 }, imageUrl: null }],
};

// ── 1. localStorage round-trip — extractedDescription must survive ────────────

describe("mpm.recipe.lastScan round-trip — extractedDescription persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists extractedDescription through JSON.stringify / JSON.parse", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SCAN_WITH_DESCRIPTION));

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.extractedDescription).toBe(SCAN_WITH_DESCRIPTION.extractedDescription);
  });

  it("preserves extractedDescription alongside stripped base64 imageUrls", () => {
    // The component strips base64 imageUrls before persisting (generate() callback).
    const stripBase64 = (meal: any) => {
      if (!meal) return meal;
      const url = meal.imageUrl ?? "";
      return url.startsWith("data:") ? { ...meal, imageUrl: null } : meal;
    };
    const withBase64 = {
      ...SCAN_WITH_DESCRIPTION,
      mealData: { ...SCAN_WITH_DESCRIPTION.mealData, imageUrl: "data:image/jpeg;base64,/9j/abc" },
    };
    const persistable = { ...withBase64, mealData: stripBase64(withBase64.mealData) };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);

    expect(parsed.mealData.imageUrl).toBeNull();
    expect(parsed.extractedDescription).toBe(SCAN_WITH_DESCRIPTION.extractedDescription);
  });

  it("correctly identifies a scan object that is missing extractedDescription", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SCAN_WITHOUT_DESCRIPTION));
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(parsed.extractedDescription).toBeUndefined();
  });
});

// ── 2. resolveTryMoreRequestBody — image-gone, extractedDescription present ───

describe("resolveTryMoreRequestBody — localStorage-restore path (no image, description present)", () => {
  it("returns content = extractedDescription when capturedBase64 is null and capturedText is empty", () => {
    // Exact state after localStorage restore: mode defaults to "upload",
    // capturedBase64 = null (session image gone), capturedText = "".
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: SCAN_WITH_DESCRIPTION }),
    );

    expect(body).not.toBeNull();
    expect(body!.content).toBe(SCAN_WITH_DESCRIPTION.extractedDescription);
    expect(body!.inputType).toBe("text");   // falls back to text mode, not image mode
    expect(body!.imageBase64).toBeUndefined();
  });

  it("prefers capturedText over extractedDescription when both are present (live session)", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({
        mode: "text",
        capturedText: "I want pasta carbonara",
        result: SCAN_WITH_DESCRIPTION,
      }),
    );

    expect(body!.content).toBe("I want pasta carbonara");
  });

  it("uses capturedBase64 with empty content when the session image is still present", () => {
    const base64 = "data:image/jpeg;base64,/9j/fake-image-data";
    const body = resolveTryMoreRequestBody(
      makeCtx({ capturedBase64: base64, result: SCAN_WITH_DESCRIPTION }),
    );

    expect(body!.imageBase64).toBe(base64);
    expect(body!.content).toBe("");
    expect(body!.inputType).toBe("upload");
  });

  it("always sets skipImages: true so Try 3 More does not wait for DALL-E", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: SCAN_WITH_DESCRIPTION }),
    );
    expect(body!.skipImages).toBe(true);
  });

  it("forwards current option names as excludedOptionNames to request variety", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: SCAN_WITH_DESCRIPTION }),
    );

    expect(body!.excludedOptionNames).toEqual([
      "Grilled Salmon",
      "Pan-Seared Salmon",
      "Teriyaki Salmon Bowl",
    ]);
  });

  it("omits excludedOptionNames when there are no current options", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: { extractedDescription: "Tacos", options: [] } }),
    );
    expect(body!.excludedOptionNames).toBeUndefined();
  });
});

// ── 3. resolveTryMoreRequestBody guard — null when no image AND no description ─

describe("resolveTryMoreRequestBody guard — returns null when no usable content", () => {
  it("returns null when the persisted scan lacks extractedDescription", () => {
    // Simulates a modal re-open where the stored scan has no extractedDescription.
    // capturedBase64 is null (session image gone), capturedText is "" (default).
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: SCAN_WITHOUT_DESCRIPTION }),
    );
    expect(body).toBeNull();
  });

  it("returns null when result is null entirely (fresh unopened modal)", () => {
    const body = resolveTryMoreRequestBody(makeCtx({ result: null }));
    expect(body).toBeNull();
  });

  it("returns null when extractedDescription is an empty string", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: { extractedDescription: "" } }),
    );
    expect(body).toBeNull();
  });

  it("does NOT return null when extractedDescription is a non-empty string", () => {
    const body = resolveTryMoreRequestBody(
      makeCtx({ result: { extractedDescription: "Spaghetti with meatballs" } }),
    );
    expect(body).not.toBeNull();
    expect(body!.content).toBe("Spaghetti with meatballs");
  });
});

// ── 4. Full localStorage-restore simulation ───────────────────────────────────
//
// End-to-end path: write to localStorage → read back → call the real
// resolveTryMoreRequestBody → verify server would receive a valid non-empty body.

describe("Full restore simulation — localStorage → resolveTryMoreRequestBody", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("produces a valid non-empty content field after a realistic localStorage restore", () => {
    // Step 1: simulate the component persisting a scan result
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SCAN_WITH_DESCRIPTION));

    // Step 2: simulate the restore useEffect reading it back
    const restoredResult = JSON.parse(localStorage.getItem(STORAGE_KEY)!);

    // Step 3: modal re-opens; capture state is at defaults (image gone)
    const body = resolveTryMoreRequestBody(
      makeCtx({
        mode: "upload",       // default
        capturedBase64: null, // image is gone — this is the regression case
        capturedText: "",     // not populated on restore
        result: restoredResult,
      }),
    );

    // Step 4: verify the server would receive a valid request
    expect(body).not.toBeNull();
    expect(typeof body!.content).toBe("string");
    expect(body!.content.length).toBeGreaterThan(0);
    expect(body!.content).toBe(SCAN_WITH_DESCRIPTION.extractedDescription);
    expect(body!.inputType).toBe("text");
    expect(body!.skipImages).toBe(true);
  });

  it("returns null when the persisted object lacks extractedDescription (regression guard)", () => {
    // If the server stops emitting extractedDescription (or localStorage silently
    // drops it), resolveTryMoreRequestBody must return null so handleTryMore
    // shows the re-entry toast rather than sending a blank content field.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SCAN_WITHOUT_DESCRIPTION));

    const restoredResult = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(restoredResult.extractedDescription).toBeUndefined(); // confirm field is absent

    const body = resolveTryMoreRequestBody(
      makeCtx({
        mode: "upload",
        capturedBase64: null,
        capturedText: "",
        result: restoredResult,
      }),
    );

    expect(body).toBeNull();
  });
});
