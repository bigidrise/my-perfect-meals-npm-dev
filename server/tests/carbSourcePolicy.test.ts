import {
  buildLowCarbSourceGuidance as buildSharedLowCarbSourceGuidance,
  classifyCarbohydrateSource,
} from "../../shared/carbSourcePolicy";
import {
  buildLowCarbSourceGuidance,
  evaluateLowCarbSourceEvidence,
} from "../services/foodAdaptation/lowCarbPolicy";

const nutrition = {
  calories: 420,
  protein: 32,
  carbs: 18,
  fat: 24,
};

describe("canonical carbohydrate source classification", () => {
  it.each(["cauliflower", "cauliflower rice", "broccoli", "spinach", "zucchini", "asparagus", "bell pepper"])(
    "classifies %s as a non-starchy/fibrous food source",
    (ingredient) => {
      expect(classifyCarbohydrateSource(ingredient).category).toBe("non_starchy_fibrous");
    },
  );

  it.each(["brown rice", "pasta", "whole wheat bread", "flour tortilla", "potato", "corn"])(
    "classifies %s as starchy/concentrated",
    (ingredient) => {
      expect(classifyCarbohydrateSource(ingredient).category).toBe("starchy_concentrated");
    },
  );

  it.each(["sugar", "honey", "maple syrup", "sweetened sauce"])(
    "keeps %s separate as added/concentrated sugar",
    (ingredient) => {
      expect(classifyCarbohydrateSource(ingredient).category).toBe("added_sugar");
    },
  );

  it.each([
    ["strawberries", "fruit"],
    ["black beans", "legume"],
    ["plain yogurt", "dairy_carbohydrate"],
    ["barbecue sauce", "sauce_condiment"],
    ["buffalo chicken cauliflower casserole", "mixed_food"],
  ] as const)("routes %s to its explicit-review category", (ingredient, category) => {
    expect(classifyCarbohydrateSource(ingredient)).toMatchObject({
      category,
      requiresExplicitEvidence: true,
    });
  });

  it("does not guess a generic root-vegetable or unknown ingredient into the fibrous group", () => {
    expect(classifyCarbohydrateSource("root vegetables").category).toBe("unknown");
    expect(classifyCarbohydrateSource("unlisted ingredient").category).toBe("unknown");
    expect(classifyCarbohydrateSource("").category).toBe("unknown");
  });

  it("keeps unsweetened sauces explicit rather than claiming their nutrition is known", () => {
    expect(classifyCarbohydrateSource("unsweetened barbecue sauce")).toMatchObject({
      category: "sauce_condiment",
      requiresExplicitEvidence: true,
    });
  });

  it.each(["plain cheddar cheese", "shredded cheddar cheese", "plain cream cheese", "blue cheese"])(
    "classifies %s as an explicit dairy source outside the 70/30 vegetable/starch groups",
    (ingredient) => {
      expect(classifyCarbohydrateSource(ingredient)).toMatchObject({
        category: "dairy_source",
        requiresExplicitEvidence: false,
      });
    },
  );

  it("keeps flavored or otherwise unspecified cheese products under review", () => {
    expect(classifyCarbohydrateSource("pepper jack cheese")).toMatchObject({
      category: "dairy_carbohydrate",
      requiresExplicitEvidence: true,
    });
  });
});

describe("Low Carb source-policy guidance and evidence", () => {
  it("describes 70/30 source allocation without converting it into fiber grams or changing macro targets", () => {
    const guidance = buildLowCarbSourceGuidance();
    expect(guidance).toContain("70% non-starchy/fibrous");
    expect(guidance).toContain("30% starchy/concentrated");
    expect(guidance).toContain("does not recalculate");
    expect(guidance).toContain("Do not force an exact 70/30 ratio into each individual meal");
    expect(guidance).toContain("plain, unflavored cheese in its explicit dairy source class");
    expect(guidance).toContain("sauce is resolved only when its recipe components are explicitly available and classifiable");
    expect(guidance).not.toMatch(/\b70\s*g(?:rams?)?\s+(?:of\s+)?(?:dietary\s+)?fiber\b/i);
    expect(buildSharedLowCarbSourceGuidance()).toBe(guidance);
  });

  it("supports complete, explicit cauliflower-based source evidence without claiming a daily ratio", () => {
    const evidence = evaluateLowCarbSourceEvidence(
      ["chicken breast", "cauliflower", "broccoli", "olive oil", "black pepper"],
      nutrition,
    );
    expect(evidence).toMatchObject({
      status: "pass",
      ingredientsComplete: true,
      nutritionValuesFinite: true,
      dailySourceDistributionVerified: false,
      totalCarbohydrateTargetChanged: false,
      nutritionEvidenceBasis: "provided_values_unverified",
    });
    expect(evidence.ingredientEvidence.find(({ ingredient }) => ingredient === "cauliflower")?.category)
      .toBe("non_starchy_fibrous");
  });

  it("requires review for missing ingredients, missing nutrition, and ambiguous foods", () => {
    expect(evaluateLowCarbSourceEvidence([], nutrition).status).toBe("review_required");
    expect(evaluateLowCarbSourceEvidence(["cauliflower"], { ...nutrition, carbs: Number.NaN }))
      .toMatchObject({
        status: "review_required",
        nutritionValuesFinite: false,
        nutritionEvidenceBasis: "missing_or_invalid",
      });
    expect(evaluateLowCarbSourceEvidence(["chicken breast", "barbecue sauce"], nutrition).status)
      .toBe("review_required");
    expect(evaluateLowCarbSourceEvidence(["chicken breast", "beans"], nutrition).status)
      .toBe("review_required");
  });

  it("flags added sugar for adaptation rather than misclassifying it as fibrous or approving it", () => {
    const evidence = evaluateLowCarbSourceEvidence(
      ["chicken breast", "cauliflower", "honey"],
      nutrition,
    );
    expect(evidence.status).toBe("adaptation_required");
    expect(evidence.ingredientEvidence.find(({ ingredient }) => ingredient === "honey")?.category)
      .toBe("added_sugar");
    expect(evidence.dailySourceDistributionVerified).toBe(false);
  });

  it("supports a buffalo-style casserole from named recipe components without special-casing its dish name", () => {
    const evidence = evaluateLowCarbSourceEvidence(
      [
        "chicken breast",
        "cauliflower",
        "plain cream cheese",
        "shredded cheddar cheese",
        {
          name: "homemade unsweetened buffalo-style sauce",
          components: [
            {
              name: "hot sauce",
              components: ["red chili peppers", "distilled white vinegar", "salt"],
            },
            "unsalted butter",
            "garlic powder",
          ],
        },
      ],
      nutrition,
    );

    expect(evidence).toMatchObject({
      status: "pass",
      ingredientsComplete: true,
      expandedSauceComponentGroups: 2,
      dailySourceDistributionVerified: false,
    });
    expect(evidence.ingredientEvidence.map(({ category }) => category))
      .toContain("dairy_source");
    expect(evidence.ingredientEvidence
      .filter(({ category }) => category === "dairy_source")
      .every(({ category }) => category !== "non_starchy_fibrous")).toBe(true);
    expect(evidence.ingredientEvidence.some(({ ingredient }) =>
      /buffalo-style sauce|homemade|hot sauce/i.test(ingredient)
    )).toBe(false);
  });

  it.each([
    "homemade unsweetened buffalo-style sauce",
    "sugar-free branded buffalo sauce",
  ])("keeps %s under review without explicit recipe components", (sauce) => {
    expect(evaluateLowCarbSourceEvidence(["chicken breast", "cauliflower", sauce], nutrition).status)
      .toBe("review_required");
  });

  it("requires review when a sauce component list is missing, empty, or structurally invalid", () => {
    expect(evaluateLowCarbSourceEvidence([
      "chicken breast",
      { name: "homemade buffalo-style sauce" },
    ], nutrition).status).toBe("review_required");
    expect(evaluateLowCarbSourceEvidence([
      "chicken breast",
      { name: "homemade buffalo-style sauce", components: [] },
    ], nutrition).status).toBe("review_required");
    expect(evaluateLowCarbSourceEvidence([
      "chicken breast",
      { name: "homemade buffalo-style sauce", components: [""] },
    ], nutrition).status).toBe("review_required");
  });

  it("finds sugar inside the explicit recipe components and requires adaptation", () => {
    const evidence = evaluateLowCarbSourceEvidence(
      [
        "chicken breast",
        "cauliflower",
        {
          name: "homemade buffalo-style sauce",
          components: [
            { name: "hot sauce", components: ["red chili peppers", "distilled white vinegar", "salt"] },
            "unsalted butter",
            "brown sugar",
          ],
        },
      ],
      nutrition,
    );
    expect(evidence.status).toBe("adaptation_required");
    expect(evidence.ingredientEvidence.find(({ ingredient }) => ingredient === "brown sugar")?.category)
      .toBe("added_sugar");
  });

  it("does not let components on a mixed-dish label substitute for a named sauce recipe", () => {
    expect(evaluateLowCarbSourceEvidence([
      {
        name: "Buffalo chicken cauliflower casserole",
        components: ["chicken breast", "cauliflower"],
      },
    ], nutrition).status).toBe("review_required");
  });
});