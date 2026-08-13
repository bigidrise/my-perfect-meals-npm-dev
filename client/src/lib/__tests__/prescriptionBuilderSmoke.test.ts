/**
 * prescriptionBuilderSmoke.test.ts
 *
 * Structural smoke tests that verify each builder's prescription wiring
 * by reading its actual source file.
 *
 * These tests catch the class of regression that broke the original feature:
 *   - A builder stops importing the shared adapter and hand-rolls a field mapping
 *   - A builder passes targetsOverride to DailyTargetsCard but forgets RemainingMacrosFooter
 *   - The adapter import path is changed without updating all consumers
 *
 * Tests run in the Node environment so they use `fs` to read source files directly.
 * No React rendering or hook mocking is required.
 *
 * ── Builder topology (as of last audit) ──────────────────────────────────────
 *   DiabeticMenuBuilder          — DailyTargetsCard + RemainingMacrosFooter
 *   GLP1MealBuilder              — DailyTargetsCard + RemainingMacrosFooter
 *   AntiInflammatoryMenuBuilder  — DailyTargetsCard + RemainingMacrosFooter
 *   GeneralNutritionBuilder      — DailyTargetsCard + RemainingMacrosFooter
 *   BeachBodyMealBoard           — DailyTargetsCard + RemainingMacrosFooter
 *   WeeklyMealBoard              — RemainingMacrosFooter only (no DailyTargetsCard)
 *   PerformanceCompetitionBuilder— DailyTargetsCard + RemainingMacrosFooter
 */

import fs from "fs";
import path from "path";

// ── Paths ─────────────────────────────────────────────────────────────────────

const CLIENT_PAGES = path.resolve(process.cwd(), "client/src/pages");

const BUILDER_FILES: Record<
  string,
  {
    relPath: string;
    hasDailyTargetsCard: boolean;
    hasRemainingMacrosFooter: boolean;
  }
> = {
  DiabeticMenuBuilder: {
    relPath: "physician/DiabeticMenuBuilder.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
  GLP1MealBuilder: {
    relPath: "physician/GLP1MealBuilder.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
  AntiInflammatoryMenuBuilder: {
    relPath: "physician/AntiInflammatoryMenuBuilder.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
  GeneralNutritionBuilder: {
    relPath: "pro/GeneralNutritionBuilder.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
  BeachBodyMealBoard: {
    relPath: "BeachBodyMealBoard.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
  WeeklyMealBoard: {
    relPath: "WeeklyMealBoard.tsx",
    hasDailyTargetsCard: false,   // intentional — this builder has no DailyTargetsCard
    hasRemainingMacrosFooter: true,
  },
  PerformanceCompetitionBuilder: {
    relPath: "pro/PerformanceCompetitionBuilder.tsx",
    hasDailyTargetsCard: true,
    hasRemainingMacrosFooter: true,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBuilder(relPath: string): string {
  const absPath = path.join(CLIENT_PAGES, relPath);
  expect(fs.existsSync(absPath)).toBe(true); // fail fast if file moves
  return fs.readFileSync(absPath, "utf-8");
}

/**
 * True when the source contains `targetsOverride={effectiveTargets}` adjacent
 * to a component usage.  The JSX prop can be split across lines, so we check
 * for the prop key and the value separately within the same file.
 */
function hasTargetsOverrideWired(src: string): boolean {
  // Both the prop name and the effectiveTargets variable must appear in the file.
  return /targetsOverride=\{effectiveTargets\}/.test(src);
}

/**
 * True when `DailyTargetsCard` receives `targetsOverride={effectiveTargets}`.
 * We locate the DailyTargetsCard JSX block and confirm it contains the prop.
 */
function dailyTargetsCardIsWired(src: string): boolean {
  // Find every occurrence of <DailyTargetsCard and check the immediately
  // following prop list for targetsOverride={effectiveTargets}.
  const chunks = src.split("<DailyTargetsCard");
  // chunk[0] is the part before the first usage; skip it.
  for (let i = 1; i < chunks.length; i++) {
    // Grab text up to the closing /> or > to stay within the same element.
    const closing = chunks[i].search(/\/>|(?<!\=)>/);
    const props = closing >= 0 ? chunks[i].slice(0, closing) : chunks[i].slice(0, 600);
    if (/targetsOverride=\{effectiveTargets\}/.test(props)) return true;
  }
  return false;
}

/**
 * True when `RemainingMacrosFooter` receives `targetsOverride={effectiveTargets}`.
 */
function remainingMacrosFooterIsWired(src: string): boolean {
  const chunks = src.split("<RemainingMacrosFooter");
  for (let i = 1; i < chunks.length; i++) {
    const closing = chunks[i].search(/\/>|(?<!\=)>/);
    const props = closing >= 0 ? chunks[i].slice(0, closing) : chunks[i].slice(0, 600);
    if (/targetsOverride=\{effectiveTargets\}/.test(props)) return true;
  }
  return false;
}

// ── calories_kcal structural checks ───────────────────────────────────────────
//
// The prescriptionAdapter maps caloriesTarget → calories_kcal and the
// MacroTargets interface (exported from RemainingMacrosFooter) declares the
// field as optional.  TypeScript alone won't catch a silent drop of the field
// because:
//   (a) the field is optional so removing it causes no type error on callers
//       that don't read it, and
//   (b) the adapter object literal is not structurally validated at the call
//       site unless someone explicitly checks for the key.
//
// These tests read the source files directly and fail the moment either the
// interface declaration or the adapter mapping is removed.

const REMAINING_MACROS_FOOTER_SRC = path.resolve(
  process.cwd(),
  "client/src/components/biometrics/RemainingMacrosFooter.tsx",
);
const PRESCRIPTION_ADAPTER_SRC = path.resolve(
  process.cwd(),
  "client/src/lib/prescriptionAdapter.ts",
);

describe("calories_kcal — MacroTargets interface structural check", () => {
  let footerSrc: string;

  beforeAll(() => {
    expect(fs.existsSync(REMAINING_MACROS_FOOTER_SRC)).toBe(true);
    footerSrc = fs.readFileSync(REMAINING_MACROS_FOOTER_SRC, "utf-8");
  });

  it("MacroTargets interface in RemainingMacrosFooter.tsx declares calories_kcal", () => {
    // The field must appear inside the MacroTargets interface block.
    // Matching the interface body (between the braces) is fragile; instead we
    // require the field to appear in the file at all — it can only be inside
    // MacroTargets because it does not appear anywhere else in this component.
    expect(footerSrc).toMatch(/calories_kcal\s*\??\s*:/);
  });

  it("MacroTargets is exported so consumers can import the type", () => {
    expect(footerSrc).toMatch(/export\s+interface\s+MacroTargets/);
  });
});

describe("calories_kcal — prescriptionAdapter mapping structural check", () => {
  let adapterSrc: string;

  beforeAll(() => {
    expect(fs.existsSync(PRESCRIPTION_ADAPTER_SRC)).toBe(true);
    adapterSrc = fs.readFileSync(PRESCRIPTION_ADAPTER_SRC, "utf-8");
  });

  it("prescriptionAdapter.ts maps calories_kcal in the returned object literal", () => {
    // The return statement must contain a calories_kcal key assignment.
    // This fails if the key is renamed or removed from the return value.
    expect(adapterSrc).toMatch(/calories_kcal\s*:/);
  });

  it("prescriptionAdapter.ts reads caloriesTarget from the prescription input", () => {
    // The source field on the prescription must still be caloriesTarget.
    // This fails if the server-side field is renamed and the adapter is not
    // updated in lockstep.
    expect(adapterSrc).toMatch(/prescription\.caloriesTarget/);
  });

  it("calories_kcal is assigned from prescription.caloriesTarget (mapping is intact)", () => {
    // Belt-and-suspenders: confirm both sides of the mapping appear on the
    // same logical line (within 120 chars of each other in the source).
    const idx = adapterSrc.indexOf("calories_kcal");
    expect(idx).toBeGreaterThan(-1);
    const snippet = adapterSrc.slice(Math.max(0, idx - 10), idx + 120);
    expect(snippet).toMatch(/prescription\.caloriesTarget/);
  });
});

describe("calories_kcal — end-to-end adapter value smoke", () => {
  // Import the real adapter so this test fails if the runtime value is wrong
  // even when the source text looks correct (e.g. the wrong variable is
  // assigned to calories_kcal).
  // We use require() here because Jest runs in CJS mode for these node tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prescriptionToTargetsOverride } = require("../prescriptionAdapter") as typeof import("../prescriptionAdapter");

  it("calories_kcal is non-zero when a prescription carries caloriesTarget", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 65,
      caloriesTarget: 1850,
      source: "clinical",
    });
    expect(result).toBeDefined();
    // This is the key assertion: the field must be present AND non-zero.
    // It fails if calories_kcal is removed from the return shape OR if the
    // wrong source field is read (e.g. a renamed calorieTarget without the 's').
    expect(result!.calories_kcal).toBe(1850);
  });

  it("calories_kcal is undefined (not 0) when caloriesTarget is absent — field is never silently zeroed", () => {
    const result = prescriptionToTargetsOverride({
      proteinTarget: 160,
      carbsTarget: 180,
      fatTarget: 65,
      // caloriesTarget intentionally absent
    });
    expect(result).toBeDefined();
    // Must be undefined, not 0.  If the adapter ever starts returning 0 when
    // the field is absent it would look like a zero-calorie target to
    // any consumer that checks calories_kcal > 0.
    expect(result!.calories_kcal).toBeUndefined();
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Builder prescription wiring — structural smoke tests", () => {
  for (const [builderName, meta] of Object.entries(BUILDER_FILES)) {
    describe(builderName, () => {
      let src: string;

      beforeAll(() => {
        src = readBuilder(meta.relPath);
      });

      it("imports prescriptionToTargetsOverride from the shared adapter", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*prescriptionToTargetsOverride[^}]*\}\s*from\s*["']@\/lib\/prescriptionAdapter["']/,
        );
      });

      it("computes effectiveTargets via prescriptionToTargetsOverride", () => {
        // The variable name the advisor mandated so the ?? fallback pattern is consistent.
        expect(src).toMatch(/\beffectiveTargets\b/);
        expect(src).toMatch(/prescriptionToTargetsOverride\s*\(/);
      });

      if (meta.hasDailyTargetsCard) {
        it("passes effectiveTargets to DailyTargetsCard via targetsOverride", () => {
          expect(dailyTargetsCardIsWired(src)).toBe(true);
        });
      } else {
        it("does not render DailyTargetsCard (topology: footer-only builder)", () => {
          expect(src).not.toMatch(/<DailyTargetsCard/);
        });
      }

      if (meta.hasRemainingMacrosFooter) {
        it("passes effectiveTargets to RemainingMacrosFooter via targetsOverride", () => {
          expect(remainingMacrosFooterIsWired(src)).toBe(true);
        });
      }
    });
  }
});
