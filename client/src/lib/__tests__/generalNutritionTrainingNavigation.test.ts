import fs from "node:fs";
import path from "node:path";
import { resolveTodayTargets } from "../../../../server/services/protocol/performanceProtocolResolver";
import type {
  MacroBaseline,
  PerformanceProtocolConfig,
  SessionType,
  WeeklyTrainingSchedule,
} from "../../../../server/services/protocol/performanceProtocolResolver";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("General Nutrition training schedule connection", () => {
  it("opens the schedule directly above the weekly panel, without toggling mode", () => {
    const source = read("client/src/pages/pro/GeneralNutritionBuilder.tsx");
    const label = source.indexOf(">Training Nutrition Schedule</p>");
    expect(label).toBeGreaterThan(0);
    expect(label).toBeLessThan(source.indexOf("{/* ROW 1: Week Navigation */}"));
    expect(source).toContain('onClick={() => setLocation("/general-nutrition/training")}');
    expect(source).toContain("hidden={!canAccessTrainingNutrition || isProCareMode || !!householdProfileId}");
    expect(source).toContain("const canAccessTrainingNutrition = isClinicalOrAbove(user)");
  });

  it("uses the existing guarded schedule and preserves the edit-save-return path", () => {
    const router = read("client/src/components/Router.tsx");
    expect(router).toContain('<ClinicalGuard component={GeneralNutritionTrainingPage}');
    expect(router).toContain('<Route path="/general-nutrition/training" component={GuardedGeneralNutritionTraining}');
    const wrapper = read("client/src/pages/GeneralNutritionTrainingPage.tsx");
    expect(wrapper).toContain('continueTo="/general-nutrition-builder/build"');
    expect(wrapper).toContain('returnTo="/general-nutrition-builder"');
    const hub = read("client/src/pages/TrainingNutritionHub.tsx");
    expect(hub).toContain('/performance/setup?returnTo=${encodeURIComponent(window.location.pathname)}');
    expect(hub).toContain('onClick={() => setLocation(setupPath)}');
    expect(read("client/src/pages/PerformanceNutritionSetupPage.tsx"))
      .toContain("<PerformanceNutritionSetupForm onSave={() => setLocation(returnTo)}");
    const form = read("client/src/components/performance/PerformanceNutritionSetupForm.tsx");
    expect(form).toContain('apiUrl("/api/performance/schedule")');
    expect(form.indexOf("await refreshUser()")).toBeLessThan(form.indexOf("onSave?.()"));
  });

  it.each([
    "pro/GeneralNutritionBuilder.tsx",
    "physician/AntiInflammatoryMenuBuilder.tsx",
    "physician/DiabeticMenuBuilder.tsx",
    "physician/GLP1MealBuilder.tsx",
  ])("%s resolves the selected day rather than a separate training calculator", (file) => {
    const source = read(`client/src/pages/${file}`);
    expect(source).toMatch(/useDailyNutritionState\(\{\s*dateISO: activeDayISO/);
    expect(source).toContain("prescriptionToTargetsOverride(prescription) ?? nutritionTargets");
    expect(source).toContain("targetsOverride={effectiveTargets}");
    expect(source).toContain("generationContext={generationContext}");
  });
});

describe("Shared training-day target calculation with synthetic data", () => {
  const baseline: MacroBaseline = {
    calories: 2000, proteinG: 120, carbsG: 200, fatG: 70,
    starchyCarbsG: 120, fibrousCarbsG: 80,
  };
  const schedule: WeeklyTrainingSchedule = {
    monday: "strength", tuesday: "off", wednesday: "off",
    thursday: "off", friday: "off", saturday: "off", sunday: "off",
    trainingPhase: "strength", activatedAt: "2026-11-01", updatedAt: "2026-11-01",
  };
  const types: SessionType[] = ["strength", "power", "endurance", "sport_practice", "competition", "recovery", "off"];
  const config: PerformanceProtocolConfig = {
    generatedAt: "2026-11-01",
    sessionModifiers: Object.fromEntries(types.map(type => [
      type,
      { carbsAdjustG: 0, caloriesAdjustKcal: 0, proteinAdjustG: 0 },
    ])) as PerformanceProtocolConfig["sessionModifiers"],
  };
  config.sessionModifiers.strength = {
    carbsAdjustG: 40, caloriesAdjustKcal: 250, proteinAdjustG: 10,
  };

  it("uses the selected day's session and preserves the baseline on an unmodified day", () => {
    const training = resolveTodayTargets(schedule, config, baseline, new Date("2026-11-02T12:00:00Z"));
    const rest = resolveTodayTargets(schedule, config, baseline, new Date("2026-11-03T12:00:00Z"));
    expect(training).toMatchObject({ calories: 2250, proteinG: 130, carbsG: 240, fatG: 70 });
    expect(rest).toMatchObject(baseline);
    expect(training.fibrousCarbsG).toBe(baseline.fibrousCarbsG);
  });

  it("reflects edited sessions and uses the current calculator baseline", () => {
    const edited = { ...schedule, monday: "off" as const };
    const currentBaseline = { ...baseline, calories: 2100, proteinG: 140 };
    expect(resolveTodayTargets(edited, config, currentBaseline, new Date("2026-11-02T12:00:00Z")))
      .toMatchObject(currentBaseline);
  });
});
