import {
  hasConcreteDishIngredients,
  hasConcreteSelectedIngredients,
  missingSelectedIngredientPositions,
} from "../services/oneTouch/selectedIngredientEvidence";

describe("selected Menu ingredient evidence", () => {
  it("matches inflected names within one real structured ingredient, not arbitrary substrings", () => {
    expect(missingSelectedIngredientPositions(
      ["collard greens", "onions", "tomatoes"],
      ["chopped collard greens", "red onion", "diced tomato"],
    )).toEqual([]);
    expect(missingSelectedIngredientPositions(["ham", "rice"], ["hamburger", "licorice"])).toEqual([0, 1]);
  });

  it("cannot prove abstract card ingredients from a spice or wording in instructions", () => {
    expect(hasConcreteSelectedIngredients(["collard greens", "onions", "spices"])).toBe(false);
    expect(missingSelectedIngredientPositions(["spices"], ["turmeric", "ginger"])).toEqual([0]);
    expect(hasConcreteSelectedIngredients(["collard greens", "red onion", "turmeric"])).toBe(true);
  });

  it.each([
    "mixed vegetables", "assorted vegetables", "frozen mixed vegetables", "fresh herbs",
    "mix of vegetables", "vegetable blend",
    "verduras mixtas", "vegetales mixtos", "verduras variadas", "verduras congeladas",
    "mezcla de verduras", "hierbas frescas", "especias", "condimentos", "proteínas",
  ])("does not promise the unspecified ingredient group %s", name => {
    expect(hasConcreteDishIngredients(["chicken", name])).toBe(false);
    expect(missingSelectedIngredientPositions([name], ["chicken", "carrot", "cabbage"])).toEqual([0]);
  });

  it("keeps concrete Spanish soup ingredients and named prepared foods valid", () => {
    const names = ["pollo", "fideos de arroz", "jengibre", "cebollino", "caldo de pollo", "zanahoria", "col"];
    expect(hasConcreteDishIngredients(names)).toBe(true);
    expect(missingSelectedIngredientPositions(names, names)).toEqual([]);
    expect(hasConcreteDishIngredients([
      "vegetable oil", "vegetable stock", "green curry paste", "herbes de Provence",
      "mixed berry jam", "salsa de soya", "caldo de verduras",
    ])).toBe(true);
  });

  it("does not change the existing Craving ingredient matching contract", () => {
    expect(hasConcreteSelectedIngredients(["mixed vegetables"])).toBe(true);
    expect(missingSelectedIngredientPositions(["mixed vegetables"], ["frozen mixed vegetables"])).toEqual([]);
  });

  it("requires the actual selected food, not a flavored product or unauthorized substitute", () => {
    expect(missingSelectedIngredientPositions(
      ["niter kibbeh", "onions", "turmeric"],
      ["olive oil", "onion-free sauce", "ginger", "collard greens"],
    )).toEqual([0, 1, 2]);
    expect(missingSelectedIngredientPositions(["onions"], ["onion powder"])).toEqual([0]);
    expect(missingSelectedIngredientPositions(["cocoa"], ["unsweetened cocoa powder"])).toEqual([]);
  });

  it.each([
    "Sichuan peppercorns", "ground Sichuan peppercorn", "crushed Szechuan peppercorns",
  ])("recognizes the reviewed peppercorn name %s", name => {
    expect(missingSelectedIngredientPositions(["Szechuan peppercorns"], [name])).toEqual([]);
  });

  it("supports the spelling alias in both directions without erasing a promised preparation", () => {
    expect(missingSelectedIngredientPositions(["Sichuan peppercorns"], ["Szechuan peppercorns"])).toEqual([]);
    expect(missingSelectedIngredientPositions(["ground Sichuan peppercorns"], ["Szechuan peppercorns"])).toEqual([0]);
  });

  it.each([
    "beef sirloin", "thinly sliced beef top sirloin", "sirloin beef",
    "top sirloin beef steak",
  ])("recognizes explicit beef sirloin wording %s without relaxing cut identity", name => {
    expect(missingSelectedIngredientPositions(["Beef sirloin"], [name])).toEqual([]);
  });

  it.each([
    "beef flank steak", "pork sirloin", "beef sirloin tip", "beef tip sirloin",
    "black peppercorns", "Sichuan pepper sauce", "tamari", "coconut aminos",
  ])("does not treat %s as all of the promised foods", name => {
    expect(missingSelectedIngredientPositions(
      ["Beef sirloin", "Szechuan peppercorns", "soy sauce"], [name],
    )).toEqual([0, 1, 2]);
  });

  it.each(["gluten-free soy sauce", "wheat-free soy sauce", "low-sodium soy sauce"])(
    "does not confuse an unrelated qualifier in %s with soy absence", name => {
      expect(missingSelectedIngredientPositions(["soy sauce"], [name])).toEqual([]);
    },
  );

  it.each([
    "soy-free soy sauce", "gluten-free soy-free soy sauce", "gluten-free soy-flavored sauce",
    "gluten-free tamari", "soy sauce seasoning", "soy sauce extract",
  ])("does not approve a soy sauce substitute or absence claim: %s", name => {
    expect(missingSelectedIngredientPositions(["soy sauce"], [name])).toEqual([0]);
  });

  it("does not generalize the qualifier exception to safety-sensitive replacements", () => {
    expect(missingSelectedIngredientPositions(["butter"], ["dairy-free butter"])).toEqual([0]);
    expect(missingSelectedIngredientPositions(["onions"], ["gluten-free onion-free sauce"])).toEqual([0]);
  });
});