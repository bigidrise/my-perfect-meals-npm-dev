import {
  buildCulinaryFingerprint,
  compareCulinaryFingerprints,
  hasMeaningfulCulinaryRepetition,
  selectCulinarilyBroadConcepts,
  type CulinaryFingerprint,
} from "../../shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "../../shared/myPerfectMenu";

const occasionForms: Record<MyPerfectMenuCategory, string[]> = {
  breakfast: ["bowl", "toast", "omelet", "hash", "pancake", "breakfast sandwich", "baked strata", "congee", "taco", "parfait"],
  lunch: ["bowl", "sandwich", "soup", "flatbread", "stuffed vegetable", "rice paper roll", "mezze plate", "savory tart", "noodle dish", "lettuce cup"],
  dinner: ["bowl", "braise", "roast", "stuffed vegetable", "skewer", "savory pie", "noodle dish", "taco", "curry", "sheet pan meal"],
  snack: ["bowl", "cookie", "parfait", "savory bites", "muffin", "frozen dessert", "toast", "hand pie", "pudding", "crisp"],
};

function concept(
  occasion: MyPerfectMenuCategory,
  dishForm: string,
  index: number,
  overrides: Record<string, unknown> = {},
) {
  const protein = `protein-${index % 7}`;
  const starch = `base-${index % 5}`;
  return {
    title: `${dishForm} concept ${index}`,
    primaryIngredients: [protein, starch, `produce-${index % 9}`, `seasoning-${index % 6}`],
    primaryProtein: protein,
    cuisine: "Mediterranean",
    preparationMethod: `method-${index % 8}`,
    culinaryIdentity: {
      dishForm,
      preparationStyle: `method-${index % 8}`,
      texture: `texture-${index % 5}`,
      temperature: (index % 2 ? "warm" : "chilled") as "warm" | "chilled",
      primaryProteinBase: protein,
      majorStarchBase: starch,
      flavorFamily: `flavor-${index % 7}`,
      cuisineEvidence: "Mediterranean",
      definingComponents: [`component-${index % 11}`],
    },
    occasion,
    ...overrides,
  };
}

describe("My Perfect Menu shared culinary breadth", () => {
  it.each(["breakfast", "lunch", "dinner", "snack"] as MyPerfectMenuCategory[])(
    "sustains more than 20 selected %s concepts without collapsing into wording-only variety",
    (occasion) => {
      let history: CulinaryFingerprint[] = [];
      const selectedAcrossCycles: ReturnType<typeof concept>[] = [];
      const forms = occasionForms[occasion];

      for (let cycle = 0; cycle < 10; cycle += 1) {
        const repetitiveBowls = [0, 1, 2].map((offset) =>
          concept(occasion, "bowl", cycle * 10 + offset, {
            title: `${["Rustic", "Bright", "Garden"][offset]} ${occasion} bowl ${cycle}`,
            primaryProtein: `rotating-protein-${cycle}-${offset}`,
            culinaryIdentity: {
              ...concept(occasion, "bowl", cycle * 10 + offset).culinaryIdentity,
              dishForm: "bowl",
              preparationStyle: "assembled",
              majorStarchBase: "grain",
              primaryProteinBase: `rotating-protein-${cycle}-${offset}`,
              flavorFamily: "herb-citrus",
            },
          }),
        );
        const varied = [0, 1, 2].map((offset) => {
          const form = forms[(cycle * 3 + offset + 1) % forms.length];
          return concept(occasion, form, 100 + cycle * 3 + offset);
        });

        const selected = selectCulinarilyBroadConcepts(
          [...repetitiveBowls, ...varied],
          occasion,
          history,
          3,
        );
        expect(selected).toHaveLength(3);
        selectedAcrossCycles.push(...selected);
        history = [
          ...selected.map((item) => buildCulinaryFingerprint(item, occasion)),
          ...history,
        ].slice(0, 96);
      }

      expect(selectedAcrossCycles).toHaveLength(30);
      expect(new Set(selectedAcrossCycles.map((item) => item.culinaryIdentity.dishForm)).size).toBeGreaterThanOrEqual(9);
      expect(selectedAcrossCycles.filter((item) => item.culinaryIdentity.dishForm === "bowl").length).toBeLessThan(10);
    },
  );

  it("recognizes protein-swapped bowls as structurally similar", () => {
    const salmon = concept("dinner", "bowl", 1, {
      primaryProtein: "salmon",
      culinaryIdentity: {
        ...concept("dinner", "bowl", 1).culinaryIdentity,
        dishForm: "grain bowl",
        preparationStyle: "assembled",
        majorStarchBase: "brown rice",
        primaryProteinBase: "salmon",
        flavorFamily: "ginger sesame",
      },
    });
    const shrimp = {
      ...salmon,
      title: "Bright Shrimp Rice Bowl",
      primaryProtein: "shrimp",
      primaryIngredients: ["shrimp", "brown rice", "cabbage", "ginger", "sesame"],
      culinaryIdentity: { ...salmon.culinaryIdentity, primaryProteinBase: "shrimp" },
    };
    const similarity = compareCulinaryFingerprints(
      buildCulinaryFingerprint(salmon, "dinner"),
      buildCulinaryFingerprint(shrimp, "dinner"),
    );
    expect(similarity.nearDuplicate).toBe(true);
    expect(similarity.structural).toBeGreaterThanOrEqual(0.73);
  });

  it("does not let cuisine and protein labels disguise repeated salad structure", () => {
    const first = concept("lunch", "salad", 1, {
      cuisine: "Mexican",
      culinaryIdentity: {
        ...concept("lunch", "salad", 1).culinaryIdentity,
        dishForm: "chopped salad",
        preparationStyle: "tossed",
        majorStarchBase: "black beans",
        cuisineEvidence: "Mexican",
      },
    });
    const second = {
      ...first,
      title: "Mediterranean Chicken Chopped Salad",
      cuisine: "Mediterranean",
      primaryProtein: "chicken",
      culinaryIdentity: {
        ...first.culinaryIdentity,
        cuisineEvidence: "Mediterranean",
        primaryProteinBase: "chicken",
      },
    };
    expect(hasMeaningfulCulinaryRepetition([first, second], "lunch")).toBe(true);
  });

  it("canonicalizes common dish-form synonyms before comparison", () => {
    const riceBowl = concept("dinner", "rice bowl", 8, {
      culinaryIdentity: {
        ...concept("dinner", "rice bowl", 8).culinaryIdentity,
        dishForm: "rice bowl",
      },
    });
    const powerBowl = concept("dinner", "power bowl", 8, {
      culinaryIdentity: {
        ...concept("dinner", "power bowl", 8).culinaryIdentity,
        dishForm: "power bowl",
      },
    });
    const similarity = compareCulinaryFingerprints(
      buildCulinaryFingerprint(riceBowl, "dinner"),
      buildCulinaryFingerprint(powerBowl, "dinner"),
    );
    expect(similarity.nearDuplicate).toBe(true);
  });

  it("distinguishes meaningful changes in form, preparation, and ingredients", () => {
    const braise = concept("dinner", "braise", 4);
    const skewer = concept("dinner", "skewer", 17);
    const similarity = compareCulinaryFingerprints(
      buildCulinaryFingerprint(braise, "dinner"),
      buildCulinaryFingerprint(skewer, "dinner"),
    );
    expect(similarity.nearDuplicate).toBe(false);
  });

  it("keeps repetition permissible when the candidate universe reflects a strong preference", () => {
    const toastOnly = [1, 2, 3].map((index) => concept("breakfast", "toast", index));
    expect(selectCulinarilyBroadConcepts(toastOnly, "breakfast", [], 3)).toHaveLength(3);
  });

  it("keeps each person's compact culinary history isolated", () => {
    const bowl = concept("lunch", "bowl", 1);
    const soup = concept("lunch", "soup", 2);
    const sandwich = concept("lunch", "sandwich", 3);
    const profileAHistory = [buildCulinaryFingerprint(bowl, "lunch")];
    const profileBHistory = [buildCulinaryFingerprint(soup, "lunch")];

    const forA = selectCulinarilyBroadConcepts([bowl, soup, sandwich], "lunch", profileAHistory, 1)[0];
    const forB = selectCulinarilyBroadConcepts([bowl, soup, sandwich], "lunch", profileBHistory, 1)[0];

    expect(forA.culinaryIdentity.dishForm).not.toBe("bowl");
    expect(forB.culinaryIdentity.dishForm).not.toBe("soup");
  });
});