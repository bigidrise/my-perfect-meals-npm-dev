import { answerNutritionPriorityCopilotQuestion } from "@/lib/nutritionPriorityCopilot";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "@shared/nutritionPriorities";

describe("Nutrition Priority Copilot education", () => {
  it("answers from the bounded registry projection, not a concept name alone", () => {
    const response = answerNutritionPriorityCopilotQuestion(
      "Why would I choose Fiber-Rich Foods?",
    )!;
    expect(response.title).toBe("Fiber-Rich Foods");
    expect(response.description).toContain(
      FOOD_INCLUSION_PRIORITY_REGISTRY.fiber_rich_foods.whyChooseIt,
    );
    expect(response.tips).toContain(
      `Sources: ${FOOD_INCLUSION_PRIORITY_REGISTRY.fiber_rich_foods.citations
        .map((citation) => citation.title)
        .join("; ")}`,
    );
  });

  it("preserves optional behavior and does not mutate targets", () => {
    expect(
      answerNutritionPriorityCopilotQuestion(
        "Does Protein-Rich Foods change my protein target?",
      )!.description,
    ).toMatch(/without creating, increasing, or replacing any macro target/i);
    expect(
      answerNutritionPriorityCopilotQuestion(
        "Will fermented foods be in every meal?",
      )!.description,
    ).toMatch(/not a requirement.*guarantee/i);
  });

  it("explains deferred concepts without making them selectable or prohibited", () => {
    const response = answerNutritionPriorityCopilotQuestion(
      "Why isn't turmeric one of the Nutrition Priorities?",
    )!;
    expect(response.description).toMatch(/not currently offered as a selectable/i);
    expect(response.description).toMatch(/does not mean the food is medically prohibited/i);
    expect(response).not.toHaveProperty("action");
  });

  it("uses only approved pediatric projection copy in child context", () => {
    const adult = FOOD_INCLUSION_PRIORITY_REGISTRY.omega_3_food_sources;
    const response = answerNutritionPriorityCopilotQuestion(
      "My child doesn't like fish. What happens if I choose Omega-3?",
      "pediatric",
    )!;
    expect(response.description).toContain(adult.pediatricProjection.whatMpmDoes);
    expect(response.description).not.toContain(adult.whatMpmDoes);
    expect(response.description).not.toMatch(/child will (eat|accept)/i);
  });

  it("declines unsupported medical claims from the approved boundary", () => {
    for (const query of [
      "Will magnesium-rich foods treat my anxiety?",
      "Will magnesium-rich foods help sleep or cramps?",
      "Will calcium-rich foods prevent osteoporosis?",
      "Will fermented foods improve my microbiome?",
      "Are omega-3 foods equivalent to a supplement dose?",
      "Can magnesium-rich foods treat anxiety?",
      "Can protein-rich foods build muscle?",
      "Can calcium-rich foods make my bones stronger?",
      "Can fermented foods treat anxiety and make me healthier?",
    ]) {
      expect(answerNutritionPriorityCopilotQuestion(query)!.description).toMatch(
        /does not establish that claim/i,
      );
    }
  });

  it("does not intercept ordinary meal-building commands", () => {
    for (const query of [
      "Make me a protein-rich meal",
      "Can you make me a protein-rich meal?",
      "Add fermented foods to dinner",
      "Could you add fermented foods to dinner?",
    ]) {
      expect(answerNutritionPriorityCopilotQuestion(query)).toBeNull();
    }
  });

  it("answers evidence distinctions directly", () => {
    expect(
      answerNutritionPriorityCopilotQuestion(
        "Are all fermented foods probiotics?",
      )!.description,
    ).toMatch(/does not automatically mean probiotic/i);
    expect(
      answerNutritionPriorityCopilotQuestion(
        "What's the difference between EPA DHA and ALA omega-3 food sources?",
      )!.description,
    ).toMatch(/ALA is not equivalent to EPA\/DHA/i);
  });

  it("does not add selection or profile mutation authority", () => {
    for (const query of [
      "Select Fiber-Rich Foods for me",
      "Remove Omega-3 Food Sources",
      "Change my protein target",
    ]) {
      const response = answerNutritionPriorityCopilotQuestion(query);
      if (response) expect(response).not.toHaveProperty("action");
    }
  });

  it("answers the required medical-protocol comparison intent", () => {
    expect(
      answerNutritionPriorityCopilotQuestion(
        "What's the difference between choosing this and a medical protocol?",
      )!.description,
    ).toMatch(/do not create a medical protocol/i);
  });

  it("answers the required context-only every-meal follow-up", () => {
    expect(
      answerNutritionPriorityCopilotQuestion(
        "Will you put this in every meal?",
        "pediatric",
        { hasNutritionPriorityContext: true },
      )!.description,
    ).toMatch(/not a requirement.*guarantee/i);
    expect(
      answerNutritionPriorityCopilotQuestion(
        "Will you put this in every meal?",
        "pediatric",
      ),
    ).toBeNull();
  });
});