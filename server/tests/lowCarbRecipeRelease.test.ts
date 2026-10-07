import type { HumanFoodCandidate } from "@shared/humanFoodValidation";
import type { HumanFoodContext } from "@shared/humanFoodContext";
import { assessLowCarbRecipeRelease } from "../services/oneTouch/lowCarbRecipeRelease";

const context = {
  status: "resolved", subjectUserId: "subject",
  nutrition: {
    prescription: { source: "user_default" },
    subject: { userId: "subject" },
    remaining: { calories: 700, carbs: 50, fat: 35 },
    activeConstraints: { consumedStarchExhausted: false },
  },
} as HumanFoodContext;
const candidate = (names: string[], starchyCarbs = 0, carbs = 12): HumanFoodCandidate => ({
  name: "Generic meal",
  ingredients: names.map((name) => ({ name, quantity: "1", unit: "cup" })),
  nutrition: { calories: 320, protein: 15, carbs, fat: 22, starchyCarbs },
});

describe("generic Low Carb recipe release is not positive source proof", () => {
  it.each([undefined, NaN, Infinity])("unknown/nonfinite starch stays evidence-unavailable: %s", starchyCarbs => {
    const meal=candidate(["chicken breast","cauliflower"]);
    meal.nutrition!.starchyCarbs=starchyCarbs;
    expect(assessLowCarbRecipeRelease(meal,context)).toBe("evidence_unavailable");
  });
  it("accepts bounded generic-product uncertainty without certifying a product label", () => {
    expect(assessLowCarbRecipeRelease(candidate(["unsweetened almond milk", "cauliflower"]), context))
      .toBe("no_known_conflict");
    expect(assessLowCarbRecipeRelease(candidate(["plain milk", "zucchini noodles"]), context))
      .toBe("no_known_conflict");
    expect(assessLowCarbRecipeRelease(candidate(["chicken breast", "cauliflower rice"]), context))
      .toBe("confirmed_compatible");
  });

  it("does not excuse sugars, ambiguous mixtures, unknown sweeteners, or hidden starch", () => {
    expect(assessLowCarbRecipeRelease(candidate(["unsweetened almond milk", "brown sugar"]), context))
      .toBe("repair_required");
    expect(assessLowCarbRecipeRelease(candidate(["sweetened almond milk"]), context))
      .toBe("repair_required");
    for (const name of ["mystery sweetener", "bottled sauce", "unsweetened oat milk"]) {
      expect(assessLowCarbRecipeRelease(candidate([name]), context)).toBe("evidence_unavailable");
    }
  });

  it("checks named starch against estimate and exhausted allocation without demanding an entire-day ratio", () => {
    expect(assessLowCarbRecipeRelease(candidate(["brown rice", "broccoli"], 9), context))
      .toBe("no_known_conflict");
    expect(assessLowCarbRecipeRelease(candidate(["brown rice", "broccoli"], 0), context))
      .toBe("repair_required");
    expect(assessLowCarbRecipeRelease(candidate(["brown rice"], 9), {
      ...context, nutrition: { ...context.nutrition!, activeConstraints: { consumedStarchExhausted: true } },
    } as HumanFoodContext)).toBe("repair_required");
  });

  it("requires complete schema, valid estimates, subject authority and an available budget", () => {
    expect(assessLowCarbRecipeRelease(candidate([""]), context)).toBe("evidence_unavailable");
    expect(assessLowCarbRecipeRelease(candidate(["unsweetened almond milk"], 0, NaN), context))
      .toBe("evidence_unavailable");
    expect(assessLowCarbRecipeRelease(candidate(["unsweetened almond milk"], 0, 60), context))
      .toBe("repair_required");
    expect(assessLowCarbRecipeRelease(candidate(["unsweetened almond milk"]), {
      ...context, subjectUserId: "someone-else",
    })).toBe("evidence_unavailable");
  });
});