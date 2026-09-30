import type { ProductCandidate, ProductSearchIntent } from "../../../shared/productCandidateContract";
import { scanMealsForAllergenViolations } from "../allergyGuardrails";
import { findForbiddenIdentityTerm, type SavedGroceryItemSlim } from "../savedGroceryCompliance";
import { discoverProductCandidates } from "./discoverProductCandidates";
import type { ProductEvidenceAdapter } from "./productEvidenceAdapters";
import { UNREVIEWED_PRODUCT_POLICY } from "./ruleEvidenceRegistry";
import type { ProductSubjectSnapshot, ProductSubjectSources } from "./subjectAuthority";
import { existingProductSubjectSources } from "./subjectAuthority";
import { createUsdaBrandedAdapter } from "./usdaBrandedAdapter";
import { createOpenFoodFactsSearchAdapter } from "./openFoodFactsSearchAdapter";
import { interpretCatalogProduct } from "./catalogProductInterpretation";

export interface DevelopmentProductMatch {
  productKey: string;
  name: string;
  brand: string;
  barcode: string | null;
  ingredients: string | null;
  serving: string | null;
  catalogDate: string | null;
  source: "USDA FoodData Central" | "Open Food Facts";
  sourceRecordId: string;
  evidenceStatus: "needs_verification";
  verificationMessage: string;
  research: readonly { source: string; result: string }[];
  nutrition: readonly { statement: string; source: string }[];
  allergenInformation: readonly { statement: string; source: string }[];
  profileInsight?: string;
}

function buildIntent(query: string, subject: ProductSubjectSnapshot): ProductSearchIntent {
  const food = query.trim();
  const categories = [food];
  const milkRequest = /^(?:dairy\s+)?milk$/i.test(food);
  const dairyConflict = subject.dietaryIdentity.some((diet) =>
    /vegan|dairy.free|lactose.free/i.test(diet)) ||
    subject.allergies.some((allergy) => /milk|dairy|lactose/i.test(allergy)) ||
    subject.explicitAvoidances.some((avoid) => /^(milk|dairy)$/i.test(avoid.trim()));
  if (milkRequest && dairyConflict) {
    // These are search categories, NOT automatic substitutions or proof of
    // suitability. Evaluate each exact package against the complete profile.
    for (const [term, conflict] of [
      ["oat milk", /oat|gluten|celiac/i],
      ["soy milk", /soy/i],
      ["almond milk", /almond|tree nut/i],
      ["coconut milk", /coconut/i],
    ] as const) {
      if (![...subject.allergies, ...subject.explicitAvoidances]
        .some((value) => conflict.test(value))) categories.push(term);
    }
  }
  return {
    requestedFood: food, purpose: milkRequest ? "drink" : "unknown",
    searchCategories: categories.slice(0, 4).map((category) => ({
      category, preservesPurpose: true, adaptationReasonRequirementIds: [],
    })),
  };
}

/** Only an established *positive* conflict can discard a catalog record. */
function knownIngredientConflict(
  candidate: ProductCandidate,
  subject: ProductSubjectSnapshot,
): string | null {
  const ingredients = candidate.facts
    .filter((fact) => fact.kind === "ingredients").map((fact) => fact.statement).join(", ");
  const declaredAllergens = candidate.facts
    .filter((fact) => fact.kind === "declared_allergens")
    .map((fact) => fact.statement.replace(/\ben:/g, "")).join(", ");
  if (!ingredients && !declaredAllergens) return null;
  const positiveDeclarations = [ingredients, declaredAllergens].filter(Boolean);
  const item: SavedGroceryItemSlim = {
    id: candidate.identity.key, productKey: candidate.identity.key,
    productName: candidate.identity.name, brand: candidate.identity.brand,
    category: null, nutritionJson: null, savedAt: new Date(0),
    ingredients: positiveDeclarations,
  };
  for (const identity of subject.dietaryIdentity) {
    const forbidden = findForbiddenIdentityTerm(item, identity) ||
      // The existing saved-grocery vegan list omits plain "milk"; reuse its
      // established dairy-free evidence rule for this positive dairy conflict.
      (/vegan/i.test(identity) ? findForbiddenIdentityTerm(item, "dairy-free") : null);
    if (forbidden) return `Contains ${forbidden}, conflicting with ${identity}.`;
  }
  const allergen = scanMealsForAllergenViolations(
    [{ name: "", ingredients: positiveDeclarations }], subject.allergies,
  );
  if (allergen.unsafe.length) return "Ingredient declaration conflicts with an allergy or intolerance.";
  for (const avoid of subject.explicitAvoidances) {
    const escaped = avoid.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (escaped && new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i")
      .test(positiveDeclarations.join(", "))) {
      return `Ingredient declaration contains an explicitly avoided food: ${avoid}.`;
    }
  }
  return null;
}

/**
 * Read-only Development integration. No clinical threshold is filled in to
 * make catalog records eligible: matches remain Check the Label leads.
 */
export async function findProductDevelopment(
  userId: string,
  query: string,
  options: {
    sources?: ProductSubjectSources;
    adapter?: ProductEvidenceAdapter;
    fallbackAdapter?: ProductEvidenceAdapter;
    interpret?: typeof interpretCatalogProduct;
  } = {},
): Promise<{
  catalogMatches: DevelopmentProductMatch[];
  searched: number;
  rejected: number;
  sourceFailures: string[];
  catalogSearchAvailable: boolean;
  unresolved: string[];
  profileUsed: string[];
}> {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("Development product discovery is not available in Production.");
  }
  const food = query.trim();
  if (!food || food.length > 80) throw new Error("Enter a product category (up to 80 characters).");
  const sources = options.sources ?? existingProductSubjectSources;
  let dateISO: string;
  if (options.sources) {
    // Injected tests supply their own exact subject context.
    dateISO = new Date().toISOString().slice(0, 10);
  } else {
    const { db } = await import("../../db");
    const { users } = await import("../../../shared/schema");
    const { eq } = await import("drizzle-orm");
    const [user] = await db.select({ timezone: users.timezone })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("Nutrition subject not found.");
    dateISO = new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
  // Resolve once to determine only functional search categories. The bounded
  // discovery re-resolves before assessing evidence; no stale profile is used.
  const { resolveProductSubjectAuthority } = await import("./subjectAuthority");
  const initial = await resolveProductSubjectAuthority({
    actorUserId: userId, subjectUserId: userId, subjectKind: "account",
    dateISO,
  }, sources);
  if (initial.status !== "resolved") {
    throw new Error("Nutrition subject context is unavailable; no products were evaluated.");
  }
  const intent = buildIntent(food, initial);
  const evaluated = await discoverProductCandidates({
    subject: {
      actorUserId: userId, subjectUserId: userId, subjectKind: "account",
      dateISO: initial.dateISO,
    },
    sources,
    intent,
    registry: UNREVIEWED_PRODUCT_POLICY,
    adapters: options.adapter
      ? [options.adapter, ...(options.fallbackAdapter ? [options.fallbackAdapter] : [])]
      : [createUsdaBrandedAdapter(), createOpenFoodFactsSearchAdapter()],
    evaluatedAt: new Date().toISOString(),
    maxCandidates: 24, maxPages: 4, targetCount: 3,
    maxEvaluatedCandidates: 5,
    allowUnresolvedLeads: true,
    knownConflict: knownIngredientConflict,
  });
  if (evaluated.status === "authority_unresolved") {
    throw new Error("Nutrition subject context is unavailable; no products were evaluated.");
  }
  const presentable = evaluated.evaluatedCandidates
    .filter(({ decision }) => decision.status === "needs_verification")
    .slice(0, 5);
  const catalogMatches = presentable.map(({ candidate }): DevelopmentProductMatch => ({
      productKey: candidate.identity.key,
      name: candidate.identity.name,
      brand: candidate.identity.brand,
      barcode: candidate.identity.barcode ?? null,
      ingredients: candidate.facts.find((fact) => fact.kind === "ingredients")?.statement ?? null,
      serving: candidate.identity.servingDescription ?? null,
      catalogDate: candidate.identity.provenance.observedAt || null,
      source: candidate.identity.provenance.source === "open_food_facts"
        ? "Open Food Facts" : "USDA FoodData Central",
      sourceRecordId: candidate.identity.provenance.sourceRecordId,
      evidenceStatus: "needs_verification",
      research: candidate.research ?? [],
      nutrition: candidate.facts.filter((fact) => fact.kind === "nutrition")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
      allergenInformation: candidate.facts.filter((fact) =>
        fact.kind === "declared_allergens" || fact.kind === "precautionary_allergens")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
      verificationMessage: evaluated.unresolved.some((issue) => issue.id === "identity:freshness")
        ? "We researched this GTIN, but current formulation and applicable product-policy evidence remain unverified. Check the current package label."
        : "Material product evidence remains unverified. Check the current package label.",
    }));
  if (!options.sources || options.interpret) {
    await Promise.all(presentable.slice(0, 2).map(async ({ candidate }, index) => {
      catalogMatches[index].profileInsight =
        await (options.interpret ?? interpretCatalogProduct)(userId, initial.subjectId, candidate) ?? undefined;
    }));
  }
  return {
    catalogMatches,
    searched: evaluated.inspectedCount,
    rejected: evaluated.rejectedCount,
    sourceFailures: evaluated.sourceFailures.map((failure) => failure.reason),
    catalogSearchAvailable: evaluated.successfulSearchPages > 0,
    unresolved: evaluated.unresolved.map((issue) => issue.id),
    profileUsed: [
      ...initial.dietaryIdentity.map((value) => `Dietary: ${value}`),
      ...initial.allergies.map((value) => `Allergy: ${value}`),
    ],
  };
}