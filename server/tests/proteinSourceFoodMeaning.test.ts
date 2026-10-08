import { FoodMeaningV1Schema, resolveExplicitProteinFoodMeanings } from "../../shared/foodMeaning";
import { proteinSourceIngredientText } from "../../shared/semanticDietaryIngredients";
import { scanForHiddenDietaryViolations, violatesDietaryConstraints } from "../services/allergyGuardrails";
import { buildGuestEnvelope, enforceBeforeGenerate, filterMealsByProtocol, scanGeneratedOutput } from "../services/protocolEnvelope";
import { enforceSafetyProfileSync } from "../services/safetyProfileService";

jest.mock("../db", () => ({ db: {} }));

const originalEnv = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

const meal = (protein: string) => ({
  name: "Scrambled eggs, turkey bacon, hash",
  ingredients: [{ name: "eggs" }, { item: protein }, "potatoes", "olive oil"],
  instructions: ["Scramble the eggs and cook the listed ingredients."],
});
const envelope = () => ({ ...buildGuestEnvelope(), avoidances: ["pork"] });
const profile = (dietaryRestrictions: string[] = [], allergies: string[] = []) => ({
  userId: "fixture-only", dietaryRestrictions, allergies,
  healthConditions: [], avoidIngredients: [],
});

describe("Development protein-source FoodMeaning", () => {
  test.each(["turkey bacon", "beef bacon", "chicken sausage", "turkey sausage", "beef ham"])(
    "preserves %s as an explicit compound identity before applying pork rules", ingredient => {
      const identities = resolveExplicitProteinFoodMeanings(ingredient);
      expect(identities).toHaveLength(1);
      expect(FoodMeaningV1Schema.parse(identities[0].meaning).concept.canonicalName).toBe(ingredient);
      expect(scanForHiddenDietaryViolations(ingredient, [], ["pork"])).toEqual([]);
      expect(violatesDietaryConstraints(ingredient, ["no pork"]).violates).toBe(false);
      expect(enforceSafetyProfileSync(profile(["no pork"]), ingredient).result).toBe("SAFE");
    },
  );

  test.each(["pork bacon", "pork sausage", "pork belly", "lard", "pancetta", "prosciutto"])(
    "continues blocking actual pork: %s", ingredient => {
      expect(scanForHiddenDietaryViolations(ingredient, [], ["pork"]).length).toBeGreaterThan(0);
      expect(scanGeneratedOutput(meal(ingredient), envelope()).passed).toBe(false);
    },
  );

  test.each(["bacon", "sausage", "turkey-flavored bacon", "turkey\nbacon", `turkey${" ".repeat(500)}bacon`])(
    "does not grant permission for an unspecified source: %s", ingredient => {
      const result = scanForHiddenDietaryViolations(ingredient, [], ["pork"]);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(violation => /no specified meat source/.test(violation.reason))).toBe(true);
      expect(scanGeneratedOutput(meal(ingredient), envelope()).passed).toBe(false);
    },
  );

  test.each([
    "turkey bacon and pork fat", "beef bacon with pork casing",
    "turkey bacon | pork bacon", "turkey bacon and regular bacon",
    "beef and pork bacon",
  ])("keeps mixed or separate forbidden ingredients visible: %s", ingredient => {
    expect(scanForHiddenDietaryViolations(ingredient, [], ["pork"]).length).toBeGreaterThan(0);
  });

  test("a turkey-bacon title never sanitizes a pork ingredient", () => {
    expect(scanGeneratedOutput(meal("pork bacon"), envelope()).passed).toBe(false);
  });

  test("direct product avoidance and red-meat avoidance remain independent", () => {
    expect(scanForHiddenDietaryViolations("turkey bacon", [], ["bacon"]).length).toBeGreaterThan(0);
    expect(scanForHiddenDietaryViolations("chicken sausage", [], ["sausage"]).length).toBeGreaterThan(0);
    expect(scanForHiddenDietaryViolations("beef bacon", [], ["red meat"]).length).toBeGreaterThan(0);
    expect(enforceSafetyProfileSync(profile(["no red meat"]), "beef bacon").result).toBe("DIET_ADAPT");
  });

  test.each(["vegan", "vegetarian", "pescatarian"])("does not make turkey bacon compatible with %s", diet => {
    expect(violatesDietaryConstraints("turkey bacon", [diet]).violates).toBe(true);
    expect(scanGeneratedOutput(meal("turkey bacon"), {
      ...envelope(), dietaryIdentity: [diet],
    }).passed).toBe(false);
  });

  test("allergy scanning still examines the original ingredients and derivatives", () => {
    const result = scanGeneratedOutput(meal("turkey bacon, peanut oil"), {
      ...envelope(), allergies: ["peanut"],
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.category.startsWith("allergy:"))).toBe(true);
    expect(enforceSafetyProfileSync(profile(["no pork"], ["peanut"]), "turkey bacon with peanut oil").result).toBe("BLOCKED");
  });

  test("kosher meat/dairy and halal alcohol safeguards remain active", () => {
    expect(scanForHiddenDietaryViolations("turkey bacon and dairy cheese", ["kosher"])
      .some(v => v.term === "meat + dairy combination")).toBe(true);
    expect(scanForHiddenDietaryViolations("turkey bacon and wine", ["halal"]).length).toBeGreaterThan(0);
  });

  test("source spans never conceal other ingredients or interpret chicken-fried steak as chicken", () => {
    expect(proteinSourceIngredientText("Turkey-Bacon | pork fat | chicken fried steak"))
      .toBe("turkey | pork fat | chicken fried steak");
  });

  test.each(["create_with_chef", "craving_creator", "create_a_dish"])(
    "%s shared output gate accepts qualified bacon but rejects actual and unknown pork sources", generatorName => {
      for (const protein of ["turkey bacon", "beef bacon"]) {
        const result = scanGeneratedOutput(meal(protein), envelope(), { generatorName });
        expect(result.violations.filter(v => v.category === "pork")).toEqual([]);
        expect(result.passed).toBe(true);
      }
      for (const protein of ["pork bacon", "bacon"]) {
        expect(scanGeneratedOutput(meal(protein), envelope(), { generatorName }).passed).toBe(false);
      }
    },
  );

  test("the shared creator filtering adapter preserves permitted candidates only", () => {
    const result = filterMealsByProtocol(
      [meal("turkey bacon"), meal("beef bacon"), meal("pork bacon"), meal("bacon")],
      envelope(), { generatorName: "craving_creator" },
    );
    expect(result).toHaveLength(2);
    expect(result.map(candidate => candidate.ingredients[1])).toEqual([
      { item: "turkey bacon" }, { item: "beef bacon" },
    ]);
  });

  test("the generation prompt distinguishes protein identity without weakening other rules", () => {
    const result = enforceBeforeGenerate(envelope(), { generatorName: "create_with_chef" });
    expect(result.combined).toContain("FOOD IDENTITY — PROTEIN SOURCE");
    expect(result.combined).toContain("does not override");
  });

  test("Production keeps its existing behavior and does not receive the new prompt", () => {
    process.env.NODE_ENV = "production";
    expect(scanForHiddenDietaryViolations("turkey bacon", [], ["pork"]).length).toBeGreaterThan(0);
    expect(enforceSafetyProfileSync(profile(["no pork"]), "turkey bacon").result).toBe("DIET_ADAPT");
    expect(enforceBeforeGenerate(envelope(), { generatorName: "create_with_chef" }).combined)
      .not.toContain("FOOD IDENTITY — PROTEIN SOURCE");
  });
});
