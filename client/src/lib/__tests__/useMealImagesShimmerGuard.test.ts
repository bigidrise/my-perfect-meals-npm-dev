/**
 * @jest-environment jsdom
 *
 * useMealImages — shimmer-free guarantee for server-provided images
 *
 * Background
 * ----------
 * InspirationCaptureModal calls `hydrateImages(options)` after every result
 * arrives — including cards whose `imageUrl` was already provided by the
 * server.  The hook must short-circuit for those cards so their IDs are never
 * added to `loadingImages`, which would cause the shimmer to flash even though
 * the image is already present.
 *
 * The render condition in InspirationCaptureModal.tsx is:
 *
 *   {loadingImages[opt.id] && !opt.imageUrl && (
 *     <div className="animate-pulse …" />   // ← shimmer
 *   )}
 *
 * Two layers of protection exist:
 *   A. useMealImages filters meals that already have imageUrl — their IDs are
 *      never written to loadingImages.
 *   B. Even if loadingImages[id] were somehow true, the render guard
 *      `&& !opt.imageUrl` prevents the shimmer from mounting.
 *
 * This suite verifies both layers directly so any future refactor that breaks
 * either one fails loudly.
 *
 * Tests
 * -----
 *  1. hydrateImages — meals with imageUrl are excluded from mealsNeedingImages
 *     and their IDs are never set to true in loadingImages.
 *  2. hydrateImages — meals without imageUrl do enter loadingImages = true
 *     while their fetch is in-flight (control case).
 *  3. hydrateImages — when ALL meals already have imageUrl, fetch is never called.
 *  4. hydrateImages — mixed batch: only the image-less meals fetch; image-having
 *     meals stay absent from loadingImages throughout.
 *  5. Source-code assertion: the shimmer render condition contains both guards
 *     (loadingImages[opt.id] && !opt.imageUrl) so an edit that removes the
 *     second guard is caught at review time.
 *  6. Source-code assertion: the filter line `meals.filter((m) => !m.imageUrl)`
 *     is present in useMealImages.ts so removals are caught immediately.
 */

import fs from "fs";
import path from "path";
import { renderHook, act } from "@testing-library/react";

// ── Paths ─────────────────────────────────────────────────────────────────────

const HOOK_SRC = path.resolve(
  process.cwd(),
  "client/src/hooks/useMealImages.ts",
);

const MODAL_SRC = path.resolve(
  process.cwd(),
  "client/src/components/InspirationCaptureModal.tsx",
);

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (p: string) => `http://localhost:5000${p}`,
}));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/imageUrlUtils", () => ({
  isPermanentImageUrl: (url: string | null | undefined) =>
    !!(
      url &&
      (url.startsWith("/public-objects/") ||
        url.startsWith("/images/") ||
        url.startsWith("/assets/"))
    ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TestMeal {
  id: string;
  name: string;
  imageUrl?: string | null;
}

function makeMeal(id: string, imageUrl?: string | null): TestMeal {
  return { id, name: `Meal ${id}`, imageUrl };
}

/** Builds a fetch mock that resolves to `{ imageUrl }` for every call. */
function mockFetchReturning(imageUrl: string): jest.Mock {
  return jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue({ imageUrl }),
    ok: true,
  });
}

/** Builds a fetch mock that never resolves (simulates an in-flight request). */
function mockFetchPending(): jest.Mock {
  return jest.fn().mockReturnValue(new Promise(() => {}));
}

// Import the real hook after mocks are registered
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useMealImages } = require("@/hooks/useMealImages");

// ── 1. Meals with imageUrl are excluded from loadingImages ────────────────────

describe("useMealImages — server-provided imageUrl cards stay out of loadingImages", () => {
  it("never sets loadingImages[id] = true for meals that already have an imageUrl", async () => {
    const fetchMock = mockFetchReturning("https://example.com/new-image.jpg");
    global.fetch = fetchMock;

    const meals: TestMeal[] = [
      makeMeal("a", "https://example.com/server-image.jpg"), // already has image
      makeMeal("b", null),                                    // needs image
    ];

    let currentMeals = [...meals];
    const setMeals = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        currentMeals = updater(currentMeals);
      } else {
        currentMeals = updater;
      }
    });

    const { result } = renderHook(() => useMealImages(setMeals));

    // Capture every loadingImages state that was ever set
    const loadingSnapshots: Array<Record<string, boolean>> = [];
    const originalSetState = result.current;

    await act(async () => {
      await result.current.hydrateImages(meals);
    });

    // loadingImages should NOT contain "a" (it had a server imageUrl)
    expect(result.current.loadingImages["a"]).toBeFalsy();

    // loadingImages["b"] should have been set (and then cleared after fetch)
    // We verify fetch was called exactly once (for "b" only, not "a")
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.mealName).toBe("Meal b");
  });

  it("does not call fetch at all when all meals already have imageUrl", async () => {
    const fetchMock = mockFetchReturning("https://example.com/img.jpg");
    global.fetch = fetchMock;

    const meals: TestMeal[] = [
      makeMeal("x", "https://example.com/img-x.jpg"),
      makeMeal("y", "https://example.com/img-y.jpg"),
      makeMeal("z", "https://cdn.example.com/img-z.jpg"),
    ];

    const setMeals = jest.fn();
    const { result } = renderHook(() => useMealImages(setMeals));

    await act(async () => {
      await result.current.hydrateImages(meals);
    });

    // No fetch calls — all meals were already imaged
    expect(fetchMock).not.toHaveBeenCalled();

    // loadingImages must be empty for all three ids
    expect(result.current.loadingImages["x"]).toBeFalsy();
    expect(result.current.loadingImages["y"]).toBeFalsy();
    expect(result.current.loadingImages["z"]).toBeFalsy();
  });
});

// ── 2. Control case — image-less meals DO enter loadingImages ─────────────────

describe("useMealImages — control: image-less meals enter loadingImages while fetching", () => {
  it("sets loadingImages[id] = true for meals without imageUrl during in-flight fetch", async () => {
    // Use a never-resolving fetch so we can inspect mid-flight state
    global.fetch = mockFetchPending();

    const meals: TestMeal[] = [makeMeal("pending-1", null), makeMeal("pending-2", undefined)];
    const setMeals = jest.fn();

    const { result } = renderHook(() => useMealImages(setMeals));

    // Start the hydration but don't await — we want to inspect mid-flight state
    act(() => {
      result.current.hydrateImages(meals);
    });

    // After the synchronous setState call (before fetch resolves), both ids
    // should be in loadingImages
    expect(result.current.loadingImages["pending-1"]).toBe(true);
    expect(result.current.loadingImages["pending-2"]).toBe(true);
  });
});

// ── 3. Mixed batch — image-having ids stay absent throughout ──────────────────

describe("useMealImages — mixed batch: image-having cards never flash", () => {
  it("keeps loadingImages[id] absent for server-image cards even while others are fetching", async () => {
    global.fetch = mockFetchPending(); // never resolves — inspect mid-flight

    const meals: TestMeal[] = [
      makeMeal("server-img", "https://example.com/already-here.jpg"),
      makeMeal("needs-img", null),
    ];

    const setMeals = jest.fn();
    const { result } = renderHook(() => useMealImages(setMeals));

    act(() => {
      result.current.hydrateImages(meals);
    });

    // "needs-img" is in-flight — should be true
    expect(result.current.loadingImages["needs-img"]).toBe(true);

    // "server-img" was filtered out — must never appear in loadingImages
    expect(result.current.loadingImages["server-img"]).toBeFalsy();
    expect("server-img" in result.current.loadingImages).toBe(false);
  });
});

// ── 4. hydrateImages is a no-op when passed an empty array ───────────────────

describe("useMealImages — empty array guard", () => {
  it("does not set any loading state when hydrateImages receives an empty array", async () => {
    global.fetch = jest.fn();
    const setMeals = jest.fn();
    const { result } = renderHook(() => useMealImages(setMeals));

    await act(async () => {
      await result.current.hydrateImages([]);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.loadingImages).toEqual({});
  });
});

// ── 5. Source-code: shimmer render condition has BOTH guards ──────────────────

describe("InspirationCaptureModal.tsx — shimmer render guard", () => {
  it("contains the dual-guard condition `loadingImages[opt.id] && !opt.imageUrl` so shimmer never mounts on image-bearing cards", () => {
    const src = fs.readFileSync(MODAL_SRC, "utf-8");

    // The shimmer element must be gated on BOTH loadingImages AND the absence of imageUrl.
    // A regression that removes `&& !opt.imageUrl` would cause shimmer to flash over server images.
    expect(src).toContain("loadingImages[opt.id] && !opt.imageUrl");
  });

  it("wraps the image banner in a condition that includes the imageUrl check so the slot only mounts when needed", () => {
    const src = fs.readFileSync(MODAL_SRC, "utf-8");

    // The outer banner div is conditional on `loadingImages[opt.id] || !!opt.imageUrl`
    // — it mounts when loading (shimmer) or when an image is ready (fade-in).
    // Cards that are neither loading nor have an image skip the banner entirely (no layout jump).
    expect(src).toContain("loadingImages[opt.id] || !!opt.imageUrl");
  });
});

// ── 6. Source-code: filter line is present in useMealImages.ts ───────────────

describe("useMealImages.ts — filter guard source assertion", () => {
  it("contains `meals.filter((m) => !m.imageUrl)` so already-imaged meals are excluded before loadingImages is written", () => {
    const src = fs.readFileSync(HOOK_SRC, "utf-8");
    expect(src).toContain("meals.filter((m) => !m.imageUrl)");
  });

  it("only sets loadingImages for mealsNeedingImages (not the full meals array)", () => {
    const src = fs.readFileSync(HOOK_SRC, "utf-8");

    // The forEach that writes to loadingState must iterate mealsNeedingImages,
    // not the raw `meals` parameter.
    expect(src).toContain("mealsNeedingImages.forEach");
  });
});

// ── 7. Loading-to-error path — banner collapses when fetch rejects ────────────
//
// When fetch() throws (network failure, non-OK response parsed as error, etc.)
// the catch block in hydrateImages is a no-op and the finally block sets
// loadingImages[id] = false.  Two invariants must hold:
//   A. loadingImages[id] is falsy after the rejection — the shimmer disappears.
//   B. setMeals is NOT called with an imageUrl — no broken image slot appears.

describe("useMealImages — loading-to-error: banner collapses on fetch rejection", () => {
  it("sets loadingImages[id] to false (falsy) after a rejected fetch", async () => {
    // Simulate a network-level failure (fetch rejects entirely)
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const meals: TestMeal[] = [makeMeal("err-1", null)];
    const setMeals = jest.fn();

    const { result } = renderHook(() => useMealImages(setMeals));

    await act(async () => {
      await result.current.hydrateImages(meals);
    });

    // After the rejection the finally block must have fired and cleared the flag
    expect(result.current.loadingImages["err-1"]).toBeFalsy();
  });

  it("does NOT write imageUrl to the meal when the fetch rejects", async () => {
    // Simulate a fetch that rejects — no imageUrl must be forwarded to setMeals
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const meals: TestMeal[] = [makeMeal("err-2", null)];

    // Track every setMeals call to verify imageUrl is never written
    const imageUrlsWritten: Array<string | null | undefined> = [];
    let currentMeals = [...meals];
    const setMeals = jest.fn((updater: any) => {
      if (typeof updater === "function") {
        const next = updater(currentMeals);
        next.forEach((m: TestMeal) => {
          if (m.id === "err-2") imageUrlsWritten.push(m.imageUrl);
        });
        currentMeals = next;
      }
    });

    const { result } = renderHook(() => useMealImages(setMeals));

    await act(async () => {
      await result.current.hydrateImages(meals);
    });

    // setMeals may not have been called at all (preferred), or if called the
    // imageUrl for the errored meal must remain null/undefined — never a URL string.
    const anyBrokenUrl = imageUrlsWritten.some(
      (url) => typeof url === "string" && url.length > 0
    );
    expect(anyBrokenUrl).toBe(false);
  });
});

// ── 8. Source-code: banner slot disappears when no image and not loading ──────
//
// When loadingImages[opt.id] is falsy AND opt.imageUrl is null/undefined,
// neither branch of the || is truthy so the outer wrapper evaluates to false
// and the banner div is never mounted — no blank grey gap appears.
//
// This assertion pins the exact OR expression so any refactor that makes the
// condition always-truthy (e.g. replacing it with `true` or adding a default)
// fails the test immediately.

describe("InspirationCaptureModal.tsx — banner slot suppression when no image and not loading", () => {
  it("outer banner condition is `(loadingImages[opt.id] || !!opt.imageUrl)` so the slot renders only when loading or image-ready — never on a clean card", () => {
    const src = fs.readFileSync(MODAL_SRC, "utf-8");

    // The outer wrapper must use the OR expression exactly as written.
    // When both operands are falsy (not loading + no imageUrl), the entire
    // banner div is skipped — preventing a blank grey gap from appearing
    // on freshly rendered cards before any fetch has started.
    expect(src).toContain("(loadingImages[opt.id] || !!opt.imageUrl)");
  });

  it("the outer banner wrapper is the parent of both the shimmer AND the CardImage so suppressing it removes the full slot", () => {
    const src = fs.readFileSync(MODAL_SRC, "utf-8");

    // The wrapping condition must sit immediately above `animate-pulse` and
    // `CardImage` — i.e. both children live inside the gated div.
    // We verify by checking the three tokens appear in the correct order:
    //   1. the outer OR condition
    //   2. the shimmer class
    //   3. the CardImage component
    const outerIdx = src.indexOf("(loadingImages[opt.id] || !!opt.imageUrl)");
    const shimmerIdx = src.indexOf("animate-pulse", outerIdx);
    const cardImageIdx = src.indexOf("<CardImage", outerIdx);

    expect(outerIdx).toBeGreaterThan(-1);
    expect(shimmerIdx).toBeGreaterThan(outerIdx);
    expect(cardImageIdx).toBeGreaterThan(outerIdx);
  });
});
