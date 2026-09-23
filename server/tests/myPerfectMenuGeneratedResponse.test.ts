import { normalizeGeneratedMenuResponse } from "../services/myPerfectMenu/normalizeGeneratedConcepts";
import { foodIdentitySchema } from "../../shared/foodIdentity";
import {
  cuisineLabelsCompatible,
  parseGeneratedMenuCandidates,
  rejectionCategoryCounts,
} from "../services/myPerfectMenu/generationContract";

describe("My Perfect Menu generated response normalization", () => {
  it("removes irrelevant snack identity metadata from breakfast concepts", () => {
    const normalized = normalizeGeneratedMenuResponse({
      concepts: [{
        title: "Roasted Tomato Breakfast Toast",
        foodIdentity: {
          foodRole: "general_snack",
          polarity: "savory",
          formatFamily: "toast",
          preparationStyle: "roasted",
        },
      }],
    }, "breakfast") as { concepts: Array<Record<string, unknown>> };

    expect(normalized.concepts[0]).not.toHaveProperty("foodIdentity");
  });

  it("repairs open-world snack formats into the bounded snack identity contract", () => {
    const normalized = normalizeGeneratedMenuResponse({
      concepts: [{
        title: "Crunchy Black Bean Taco",
        description: "A savory taco with cabbage and salsa.",
        primaryIngredients: ["black beans", "corn tortilla", "cabbage", "salsa"],
        foodIdentity: {
          foodRole: "general_snack",
          polarity: "savory",
          formatFamily: "taco",
          preparationStyle: "assembled",
          texture: "crunchy",
        },
      }],
    }, "snack") as { concepts: Array<Record<string, unknown>> };

    expect(foodIdentitySchema.safeParse(normalized.concepts[0].foodIdentity).success).toBe(true);
    expect(normalized.concepts[0].foodIdentity).toEqual(expect.objectContaining({
      foodRole: "general_snack",
      polarity: "savory",
      formatFamily: "general_snack",
    }));
  });

  it("retains valid siblings when one generated concept has malformed metadata", () => {
    const base = {
      title: "Butter-Seared Salmon",
      description: "Salmon seared in butter and finished with salt.",
      primaryIngredients: ["salmon", "butter", "salt"],
      primaryProtein: "salmon",
      produceItems: [],
      cuisine: "American",
      dietaryEvidence: ["animal foods only"],
      preparationMethod: "pan seared",
      signature: "salmon|pan-seared|butter",
      culinaryIdentity: {
        dishForm: "fish fillet",
        preparationStyle: "pan seared",
        temperature: "hot",
        primaryProteinBase: "salmon",
        majorStarchBase: null,
        flavorFamily: "butter salt",
        cuisineEvidence: "American",
        definingComponents: ["salmon", "butter"],
      },
    };
    const parsed = parseGeneratedMenuCandidates({
      concepts: [
        base,
        { ...base, title: "", signature: "broken|candidate" },
        { ...base, title: "Soft-Scrambled Eggs", signature: "eggs|soft-scrambled|butter" },
      ],
    }, "breakfast");

    expect(parsed.candidates.map((candidate) => candidate.title)).toEqual([
      "Butter-Seared Salmon",
      "Soft-Scrambled Eggs",
    ]);
    expect(parsed.rejectionCodes).toEqual(expect.arrayContaining([
      expect.stringContaining("schema_metadata_failure:concept_1"),
    ]));
  });

  it("repairs safely reconstructable metadata without changing the dish", () => {
    const parsed = parseGeneratedMenuCandidates({
      concepts: [{
        title: "Skillet Eggs with Tomatoes",
        description: "Eggs cooked with tomatoes, spinach, and herbs.",
        primaryIngredients: ["eggs", "tomatoes", "spinach", "herbs"],
        primaryProtein: "eggs",
        produceItems: ["tomatoes", "spinach"],
        cuisine: "Mediterranean",
        preparationMethod: "skillet cooked",
      }],
    }, "breakfast");

    expect(parsed.rejectionCodes).toEqual([]);
    expect(parsed.metadataRepairCount).toBe(1);
    expect(parsed.candidates[0]).toEqual(expect.objectContaining({
      title: "Skillet Eggs with Tomatoes",
      primaryIngredients: ["eggs", "tomatoes", "spinach", "herbs"],
      dietaryEvidence: [],
      signature: expect.stringContaining("Skillet Eggs with Tomatoes"),
      culinaryIdentity: expect.objectContaining({
        preparationStyle: "skillet cooked",
        primaryProteinBase: "eggs",
        cuisineEvidence: "Mediterranean",
      }),
    }));
  });

  it("discards malformed advisory evidence and repairs representation-only temperature", () => {
    const parsed = parseGeneratedMenuCandidates({
      concepts: [{
        title: "Roasted Lentil Skillet",
        description: "Lentils with tomatoes and herbs.",
        primaryIngredients: ["lentils", "tomatoes", "herbs"],
        primaryProtein: "lentils",
        produceItems: ["tomatoes"],
        cuisine: "Mediterranean",
        dietaryEvidence: { claim: "vegan" },
        preparationMethod: "roasted",
        signature: "lentils|skillet|roasted",
        culinaryIdentity: {
          dishForm: "skillet",
          preparationStyle: "roasted",
          temperature: "ambient",
          primaryProteinBase: "lentils",
          majorStarchBase: null,
          flavorFamily: "herbs",
          cuisineEvidence: "Mediterranean",
          definingComponents: ["lentils", "tomatoes"],
        },
      }],
    }, "lunch");
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0].dietaryEvidence).toEqual([]);
    expect(parsed.candidates[0].culinaryIdentity.temperature).not.toBe("ambient");
    expect(parsed.candidates[0].primaryIngredients).toEqual(["lentils", "tomatoes", "herbs"]);
  });

  it("does not rescue a candidate whose actual food description is incomplete", () => {
    const parsed = parseGeneratedMenuCandidates({
      concepts: [{
        title: "Mystery Breakfast",
        description: "A breakfast idea.",
        primaryIngredients: ["eggs"],
        cuisine: "American",
        preparationMethod: "cooked",
      }],
    }, "breakfast");

    expect(parsed.candidates).toEqual([]);
    expect(parsed.rejectionCodes).toEqual(expect.arrayContaining([
      expect.stringContaining("schema_metadata_failure"),
    ]));
  });

  it("accepts syntactic cuisine-label variants without weakening cuisine identity", () => {
    expect(cuisineLabelsCompatible("Italian-inspired cuisine", "Italian")).toBe(true);
    expect(cuisineLabelsCompatible("Traditional Japanese cooking", "Japanese cuisine")).toBe(true);
    expect(cuisineLabelsCompatible("Mexican", "Italian")).toBe(false);
  });

  it("reduces retry diagnostics to privacy-limited categories", () => {
    expect(rejectionCategoryCounts([
      "dietary:mustard",
      "forbidden_ingredient:pork",
      "protocol:DIETARY_IDENTITY",
      "schema_metadata_failure:concept_2:title",
    ])).toEqual({
      dietary_violation: 1,
      allergen_or_avoidance_violation: 1,
      protocol_rejection: 1,
      schema_metadata_failure: 1,
    });
  });
});