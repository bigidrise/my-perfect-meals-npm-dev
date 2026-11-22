import type { IngredientScanResult, BetterAlternative } from "../ingredientScanService";
import type { UserProtocolEnvelope } from "../protocolEnvelope";
import type { catalogShoppingOptionsDevelopment } from "./catalogShoppingOptionsDevelopment";

export const developmentGroceryVerificationEnabled = () =>
  process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT;

type Lookup = typeof catalogShoppingOptionsDevelopment;

/** One exact-catalog path for every Development grocery recommendation caller. */
export async function verifiedGroceryCatalog(
  userId: string, query: string, lookup?: Lookup,
) {
  const find = lookup ?? (await import("./catalogShoppingOptionsDevelopment")).catalogShoppingOptionsDevelopment;
  const result = await find(userId, { originalName: query.trim(), requirements: [] });
  const products = result.catalogMatches.filter(product =>
    product.shoppingDisplay !== "hidden" &&
    (product.shoppingSelection?.eligible === true || !!product.shoppingReference)).slice(0, 3);
  const alternatives: BetterAlternative[] = products.map(product => {
    const compatible = product.evidenceStatus === "eligible" &&
      product.shoppingSelection?.eligible === true &&
      !product.needsProfileReview && !product.policyUnresolved;
    return {
      category: product.name.toLowerCase().startsWith(product.brand.toLowerCase())
        ? product.name : `${product.brand} ${product.name}`,
      whyBetter: [
        ...(product.ingredients ? [`Catalog ingredients (${product.source}): ${product.ingredients.slice(0, 500)}`] : []),
        ...product.nutrition.slice(0, 2).map(fact => `Catalog nutrition (${product.source}): ${fact.statement}`),
      ],
      targetCriteria: compatible
        ? "Passed the current product checks. Check the current package for changes."
        : "Product details not fully verified. Compatibility is not confirmed.",
      evidenceStatus: compatible ? "eligible" : "needs_verification",
      productKey: product.productKey,
    };
  });
  return { ...result, products, alternatives };
}

/** Never transfer a scanned product's verdict or model praise to an alternative. */
export async function verifyDevelopmentScanResult(
  userId: string, result: IngredientScanResult, envelope: UserProtocolEnvelope | null,
  lookup?: Lookup,
): Promise<IngredientScanResult> {
  let alternatives: BetterAlternative[] = [];
  let compatible = false;
  let conflict = result.verdictLevel === "skip";
  let notice = "Product details could not be verified. Compatibility is unknown.";
  try {
    if (!envelope || envelope.userId === "guest") {
      notice = "Your current food profile could not be confirmed. Compatibility is unknown.";
    } else {
      const { scanGeneratedOutput } = await import("../protocolEnvelope");
      conflict ||= !scanGeneratedOutput({
        name: result.productName, ingredients: result.extractedIngredients,
      }, envelope, { generatorName: "grocery_product_advisor" }).passed;
      const catalog = await verifiedGroceryCatalog(userId, result.productName, lookup);
      alternatives = catalog.alternatives;
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      compatible = catalog.products.some(product =>
        [product.name, `${product.brand} ${product.name}`].some(name =>
          normalize(name) === normalize(result.productName)) &&
        product.shoppingSelection?.eligible === true && product.evidenceStatus === "eligible" &&
        !product.needsProfileReview && !product.policyUnresolved);
      if (!compatible) notice = catalog.catalogMatches.some(product => product.policyUnresolved)
        ? "Applicable product verification rules aren't available. Compatibility is unknown."
        : "Product identity or ingredient/nutrition evidence is insufficient. Compatibility is unknown.";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ProductSubjectContextUnavailableError")
      notice = "Your current food profile could not be confirmed. Compatibility is unknown.";
    // No raw model alternatives survive a failed verification request.
    alternatives = [];
    compatible = false;
  }
  return {
    ...result, betterAlternatives: alternatives,
    ...(!compatible || conflict ? {
      gradeUnavailable: true,
      verdictLevel: conflict ? "skip" as const : "caution" as const,
      verdict: conflict ? "Available information shows a conflict with your food requirements." : notice,
      overallSummary: conflict ? "This product conflicts with your food requirements." : notice,
      scoreCards: {
        kids: { verdict: "neutral" as const, reason: "Compatibility has not been confirmed." },
        adults: { verdict: "neutral" as const, reason: "Compatibility has not been confirmed." },
        diet: { verdict: "neutral" as const, reason: "Compatibility has not been confirmed." },
        fitnessGoal: { verdict: "neutral" as const, reason: "Compatibility has not been confirmed." },
      },
      outcomeCards: [], betterFor: [], profileFactorsUsed: [],
      ingredientConsiderations: [conflict
        ? "Do not use this product while the identified conflict applies." : notice],
      educationalFooter: "Catalog information is not permanent medical or current-package approval.",
    } : {}),
  };
}
