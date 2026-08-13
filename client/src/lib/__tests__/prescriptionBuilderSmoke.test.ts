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
