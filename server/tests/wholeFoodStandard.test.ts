/**
 * Whole-Food Standard governance regression tests.
 *
 * Run: npx jest server/tests/wholeFoodStandard.test.ts
 */

import {
  WHOLE_FOOD_PROMPT_MARKER,
  appendWholeFoodStandardPrompt,
  evaluateWholeFoodCandidate,
} from "../services/wholeFoodStandard";
import {
  buildGuestEnvelope,
  enforceBeforeGenerate,
  scanGeneratedOutput,
} from "../services/protocolEnvelope";

const homemadeShake = {
  name: "Banana protein shake",
  description: "A homemade protein shake with ordinary ingredients.",
  ingredients: ["plain Greek yogurt", "milk", "banana", "oats", "peanut butter"],
  instructions: ["Blend the ingredients.", "Pour the protein shake into a glass."],
};

describe("Whole-Food Standard", () => {
  test.each(["Banana protein shake", "Banana yogurt smoothie"])(
    "allows the same homemade ingredients named %s through the real protocol scan",
    name => {
      const meal = { ...homemadeShake, name };
      const result = scanGeneratedOutput(meal, buildGuestEnvelope(), {
        generatorName: "create_with_chef_beverage",
      });
      expect(result.passed).toBe(true);
      expect(result.wholeFoodDecision?.shouldBlock).toBe(false);
      expect(result.wholeFoodDecision?.classification).toBe("appropriate");
      expect(result.wholeFoodDecision?.matchedTerms).not.toContain("protein shake");
    },
  );

  test("does not invent a processed product classification from a shake name alone", () => {
    const decision = evaluateWholeFoodCandidate({ name: "Banana protein shake" });
    expect(decision.classification).toBe("uncertain");
    expect(decision.shouldBlock).toBe(false);
  });

  test.each([
    { ingredients: ["bottled protein shake", "banana"] },
    { ingredients: [{ name: "bottled protein shake" }, { name: "banana" }] },
    { ingredients: [{ item: "bottled protein shake" }, { item: "banana" }] },
    { ingredientLabel: ["protein shake concentrate"] },
    { isPackagedProduct: true },
  ])("retains documented-purpose requirements for product evidence %j", evidence => {
    const meal = { ...homemadeShake, ...evidence };
    for (const context of [
      {},
      { purposes: ["performance" as const] },
      { purposes: ["clinical" as const], purposefulNeed: "general clinical support" },
    ]) {
      const decision = evaluateWholeFoodCandidate(meal, context);
      expect(decision.shouldBlock).toBe(true);
      expect(decision.matchedTerms).toContain("protein shake");
    }
    const justified = evaluateWholeFoodCandidate(meal, {
      purposes: ["performance"], purposefulNeed: "active performance fueling",
    });
    expect(justified.shouldBlock).toBe(false);
    expect(justified.classification).toBe("purposeful_exception");
  });

  test("still rejects a shake containing a non-exemptable processed product", () => {
    const meal = { ...homemadeShake, ingredients: [...homemadeShake.ingredients, "candy bar"] };
    const envelope = buildGuestEnvelope();
    envelope.performanceOverlay = "competition_prep";
    const result = scanGeneratedOutput(meal, envelope, {
      generatorName: "create_with_chef_beverage",
    });
    expect(result.passed).toBe(false);
    expect(result.primaryViolation?.category).toBe("whole-food-standard");
    expect(result.wholeFoodDecision?.matchedTerms).toContain("candy bar");
  });

  test.each(["Banana protein shake", "Banana yogurt smoothie"])(
    "retains processed shake ingredient rules through the protocol scan even when named %s",
    name => {
      const meal = { ...homemadeShake, name, ingredients: ["bottled protein shake", "banana"] };
      const envelope = buildGuestEnvelope();
      const blocked = scanGeneratedOutput(meal, envelope, {
        generatorName: "create_with_chef_beverage",
      });
      expect(blocked.passed).toBe(false);
      expect(blocked.primaryViolation?.category).toBe("whole-food-standard");
      envelope.performanceOverlay = "performance";
      const justified = scanGeneratedOutput(meal, envelope, {
        generatorName: "create_with_chef_beverage",
      });
      expect(justified.passed).toBe(true);
      expect(justified.wholeFoodDecision?.classification).toBe("purposeful_exception");
    },
  );

  test("retains additive restrictions without granting a title-based purpose exception", () => {
    const decision = evaluateWholeFoodCandidate({
      ...homemadeShake,
      ingredients: [...homemadeShake.ingredients, "artificial flavor", "maltodextrin"],
    }, { purposes: ["performance"], purposefulNeed: "active performance fueling" });
    expect(decision.shouldBlock).toBe(true);
    expect(decision.reasonCode).toBe("UPF_ADDITIVE_PATTERN");
  });

  test.each(["dairy", "peanuts"])("still enforces %s allergy on a homemade shake", allergy => {
    const envelope = buildGuestEnvelope();
    envelope.allergies = [allergy];
    const result = scanGeneratedOutput(homemadeShake, envelope, {
      generatorName: "create_with_chef_beverage",
    });
    expect(result.wholeFoodDecision?.shouldBlock).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category.startsWith("allergy:"))).toBe(true);
  });

  test("still enforces a vegan dietary restriction on a dairy-containing homemade shake", () => {
    const envelope = buildGuestEnvelope();
    envelope.dietaryIdentity = ["vegan"];
    const result = scanGeneratedOutput(homemadeShake, envelope, {
      generatorName: "create_with_chef_beverage",
    });
    expect(result.wholeFoodDecision?.shouldBlock).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => /vegan/.test(v.category))).toBe(true);
  });

  test("prefers meals anchored by recognizable whole foods", () => {
    const decision = evaluateWholeFoodCandidate({
      name: "Salmon and quinoa plate",
      ingredients: ["salmon", "quinoa", "broccoli", "olive oil"],
    });

    expect(decision.classification).toBe("preferred");
    expect(decision.shouldBlock).toBe(false);
  });

  test("allows useful processed foods instead of treating all processing as harmful", () => {
    const decision = evaluateWholeFoodCandidate({
      name: "Quick bean lunch",
      ingredients: ["canned beans", "frozen vegetables", "whole grain bread"],
    });

    expect(decision.classification).toBe("appropriate");
    expect(decision.reasonCode).toBe("USEFUL_PROCESSED_FOOD");
    expect(decision.shouldBlock).toBe(false);
  });

  test("requires substitution for a clearly ultra-processed default", () => {
    const decision = evaluateWholeFoodCandidate({
      name: "Packaged snack cake and sugary soda",
      ingredients: ["packaged snack cake", "sugary soda"],
    });

    expect(decision.classification).toBe("substitute_when_practical");
    expect(decision.shouldSubstitute).toBe(true);
    expect(decision.shouldBlock).toBe(true);
  });

  test("permits a processed product only for a matching purposeful exception", () => {
    const withoutPurpose = evaluateWholeFoodCandidate({
      name: "Post-training protein bar",
    });
    const withPurpose = evaluateWholeFoodCandidate(
      { name: "Post-training protein bar" },
      { purposes: ["performance"], purposefulNeed: "active post-training fueling" },
    );

    expect(withoutPurpose.classification).toBe("substitute_when_practical");
    expect(withoutPurpose.shouldBlock).toBe(true);
    expect(withPurpose.classification).toBe("purposeful_exception");
    expect(withPurpose.exceptionPurpose).toBe("performance");
    expect(withPurpose.shouldBlock).toBe(false);
  });

  test("does not allow a broad performance purpose without a documented product need", () => {
    const decision = evaluateWholeFoodCandidate(
      { name: "Protein bar" },
      { purposes: ["performance"] },
    );

    expect(decision.classification).toBe("substitute_when_practical");
    expect(decision.shouldBlock).toBe(true);
  });

  test("does not let a purposeful product term hide a non-exemptable UPF", () => {
    const decision = evaluateWholeFoodCandidate(
      {
        name: "Candy bar protein bar",
        ingredients: ["high fructose corn syrup", "artificial flavor"],
      },
      {
        purposes: ["performance"],
        purposefulNeed: "active post-training fueling",
      },
    );

    expect(decision.classification).toBe("substitute_when_practical");
    expect(decision.shouldBlock).toBe(true);
    expect(decision.matchedTerms).toContain("candy bar");
  });

  test.each([
    "Energy drink with fruit juice",
    "Sweetened breakfast cereal with whole grain oats",
    "Packaged chips with potato and olive oil",
  ])("recognizes common packaged UPF patterns before benign ingredients: %s", (name) => {
    const decision = evaluateWholeFoodCandidate({ name });
    expect(decision.classification).toBe("substitute_when_practical");
    expect(decision.shouldBlock).toBe(true);
  });

  test("keeps an unknown packaged brand uncertain without a verified label", () => {
    const decision = evaluateWholeFoodCandidate({
      name: "Acme Garden Harvest",
      isPackagedProduct: true,
    });

    expect(decision.classification).toBe("uncertain");
    expect(decision.shouldBlock).toBe(false);
  });

  test("keeps restaurant items uncertain when composition evidence is missing", () => {
    const decision = evaluateWholeFoodCandidate({
      name: "Grilled salmon with broccoli",
      description: "Prepared in the restaurant kitchen",
      preparationEvidence: "unknown",
    });

    expect(decision.classification).toBe("uncertain");
    expect(decision.confidence).toBe("low");
    expect(decision.shouldBlock).toBe(false);
  });

  test("adds the central prompt exactly once", () => {
    const once = appendWholeFoodStandardPrompt("Create a meal.");
    const twice = appendWholeFoodStandardPrompt(once);

    expect(twice).toBe(once);
    expect(twice.split(WHOLE_FOOD_PROMPT_MARKER)).toHaveLength(2);
  });

  test("protocol generation always includes the standard, even for guests", () => {
    const block = enforceBeforeGenerate(buildGuestEnvelope(), {
      generatorName: "whole_food_test",
    });

    expect(block.combined).toContain(WHOLE_FOOD_PROMPT_MARKER);
  });

  test("protocol post-generation scan rejects a clear substitution case", () => {
    const result = scanGeneratedOutput(
      {
        name: "Packaged snack cake plate",
        ingredients: ["packaged snack cake"],
      },
      buildGuestEnvelope(),
      { generatorName: "whole_food_test" },
    );

    expect(result.passed).toBe(false);
    expect(result.primaryViolation?.category).toBe("whole-food-standard");
    expect(result.wholeFoodDecision?.classification).toBe("substitute_when_practical");
  });
});
