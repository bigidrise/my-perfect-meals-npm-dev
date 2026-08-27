import {
  buildBeverageAlternativePrompt,
  getBeverageRejectionKind,
  getKnownBeverageProtocolName,
  shouldOfferBeverageAlternatives,
  type BeverageProtocolRejection,
} from "../services/beverageAlternativeSupport";
import { containsAlcoholContent } from "../services/guardrails/beverageMedicalRules";

describe("Beverage alternative support", () => {
  const macroRejection: BeverageProtocolRejection = {
    error: "PROTOCOL_VIOLATION",
    message: "Generated beverage exceeds GLP-1 clinical limits: fat is too high.",
    retryable: true,
    rejectionKind: "macro_noncompliant",
    protocolName: "GLP-1",
    violations: ["fat is too high"],
  };

  test("uses only server-known builder context for protocol naming", () => {
    expect(getKnownBeverageProtocolName("glp1", false)).toBe("GLP-1");
    expect(getKnownBeverageProtocolName(null, true)).toBe("GLP-1");
    expect(getKnownBeverageProtocolName("diabetic", false)).toBe("diabetes");
    expect(getKnownBeverageProtocolName("weekly", false)).toBeNull();
  });

  test("enables the offer flow in development only", () => {
    expect(shouldOfferBeverageAlternatives("development")).toBe(true);
    expect(shouldOfferBeverageAlternatives("production")).toBe(false);
    expect(shouldOfferBeverageAlternatives(undefined)).toBe(false);
  });

  test("classifies alcohol introduced only in preparation instructions", () => {
    const includesAlcohol = containsAlcoholContent({
      name: "Citrus Highball",
      ingredients: [{ name: "club soda" }, { name: "lime juice" }],
      instructions: ["Build over ice, then float one ounce of rum on top."],
    });

    expect(includesAlcohol).toBe(true);
    expect(
      getBeverageRejectionKind(
        includesAlcohol ? [{ isAlcohol: true }] : undefined,
        "protocol",
      ),
    ).toBe("alcohol_forbidden");
  });

  test("only marks alcohol as forbidden when the validator tags an alcohol violation", () => {
    expect(
      getBeverageRejectionKind([{ isAlcohol: true }], "clinical"),
    ).toBe("alcohol_forbidden");
    expect(
      getBeverageRejectionKind([{ isAlcohol: false }], "clinical"),
    ).toBe("other");
    expect(getBeverageRejectionKind(undefined, "macro")).toBe(
      "macro_noncompliant",
    );
  });

  test("preserves Dive Bar, fruity tequila intent for a macro-only rejection", () => {
    const prompt = buildBeverageAlternativePrompt({
      originalPrompt: "Base beverage prompt",
      requestedCategoryLabel: "Dive Bar",
      effectiveCategoryLabel: "Dive Bar",
      flavorLabel: "Tropical",
      specificDrink: "fruity tequila highball",
      rejection: macroRejection,
    });

    expect(prompt).toContain("Requested category: Dive Bar");
    expect(prompt).toContain("Requested flavor direction: Tropical");
    expect(prompt).toContain("Named drink request: fruity tequila highball");
    expect(prompt).toContain("ordinary neighborhood-bar");
    expect(prompt).toContain("Alcohol is not automatically prohibited");
    expect(prompt).toContain("do not turn every conflict into sparkling water with lime");
  });

  test("requires an alcohol-free full alternative only for an alcohol rejection", () => {
    const prompt = buildBeverageAlternativePrompt({
      originalPrompt: "Base beverage prompt",
      requestedCategoryLabel: "Dive Bar",
      effectiveCategoryLabel: "Mocktail",
      flavorLabel: "Citrus",
      rejection: {
        ...macroRejection,
        error: "CLINICAL_VIOLATION",
        rejectionKind: "alcohol_forbidden",
      },
    });

    expect(prompt).toContain("Create only alcohol-free alternatives");
    expect(prompt).toContain("Requested category: Dive Bar");
    expect(prompt).toContain("Safety-adjusted category: Mocktail");
    expect(prompt).toContain("Dive Bar request should still feel like a practical neighborhood-bar non-alcoholic drink");
  });
});