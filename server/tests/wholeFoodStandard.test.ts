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

describe("Whole-Food Standard", () => {
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
