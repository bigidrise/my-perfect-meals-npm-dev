import type { ProductCandidate, ProductSearchIntent } from "../../../shared/productCandidateContract";
import { scanMealsForAllergenViolations } from "../allergyGuardrails";
import { findForbiddenIdentityTerm, type SavedGroceryItemSlim } from "../savedGroceryCompliance";
import { discoverProductCandidates } from "./discoverProductCandidates";
import type { ProductEvidenceAdapter } from "./productEvidenceAdapters";
import type { ProductSubjectSnapshot, ProductSubjectSources } from "./subjectAuthority";
import { existingProductSubjectSources } from "./subjectAuthority";
import { createUsdaBrandedAdapter } from "./usdaBrandedAdapter";
import { createOpenFoodFactsSearchAdapter } from "./openFoodFactsSearchAdapter";
import { interpretCatalogProduct } from "./catalogProductInterpretation";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "./ruleEvidenceRegistry";

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
  evidenceStatus: "eligible" | "needs_verification";
  verificationMessage: string;
  needsProfileReview: boolean;
  research: readonly { source: string; result: string }[];
  nutrition: readonly { statement: string; source: string }[];
  allergenInformation: readonly { statement: string; source: string }[];
  profileInsight?: string;
}

export class ProductSubjectContextUnavailableError extends Error {
  constructor(message = "Your current food profile could not be resolved for this search.") {
    super(message);
    this.name = "ProductSubjectContextUnavailableError";
  }
}

function unresolvedReason(id: string, reason: string): string {
  if (id === "dietary_identity:low_carb" || id === "dietary_identity:low carb") {
    return `${id}: Low-carb fit depends on the day's carbohydrate and food-source allocation; catalog carbohydrates alone do not establish it.`;
  }
  if (id.startsWith("allergy:")) {
    return `${id}: Catalog declarations cannot establish current-package ingredients and cross-contact absence.`;
  }
  if (id.startsWith("explicit_avoidance:")) {
    return `${id}: A catalog ingredient list cannot prove that the current package omits this food.`;
  }
  return `${id}: ${reason}`;
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
  const declaredTraces = candidate.facts
    .filter((fact) => fact.kind === "precautionary_allergens" &&
      fact.precautionaryStatus === "declared_present")
    .map((fact) => fact.statement.replace(/\ben:/g, "")).join(", ");
  if (!ingredients && !declaredAllergens && !declaredTraces) return null;
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
    [{ name: "", ingredients: [...positiveDeclarations, declaredTraces].filter(Boolean) }], subject.allergies,
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
 * Read-only Development integration. An observed exact catalog identity is
 * distinct from evidence that today's package contains the same formulation.
 * Unreviewed hard product rules cannot be turned into approvals.
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
  excludedReasons: string[];
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
    throw new ProductSubjectContextUnavailableError();
  }
  const intent = buildIntent(food, initial);
  const evaluated = await discoverProductCandidates({
    subject: {
      actorUserId: userId, subjectUserId: userId, subjectKind: "account",
      dateISO: initial.dateISO,
    },
    sources,
    intent,
    registry: DEVELOPMENT_CATALOG_IDENTITY_POLICY,
    adapters: options.adapter
      ? [options.adapter, ...(options.fallbackAdapter ? [options.fallbackAdapter] : [])]
      : [createUsdaBrandedAdapter(), createOpenFoodFactsSearchAdapter()],
    evaluatedAt: new Date().toISOString(),
    useCurrentEvaluationTime: true,
    maxCandidates: 24, maxPages: 4, targetCount: 3,
    maxEvaluatedCandidates: 12,
    allowUnresolvedLeads: true,
    knownConflict: knownIngredientConflict,
    minimumEvidence: (candidate) => {
      const missing = [
        !candidate.facts.some((fact) => fact.kind === "ingredients" && fact.statement.trim()) && "ingredients",
        !candidate.facts.some((fact) => fact.kind === "nutrition" && fact.statement.trim()) && "nutrition",
      ].filter(Boolean);
      return missing.length
        ? `The exact catalog record is missing ${missing.join(" and ")} needed to describe this product. Check the current package label.`
        : null;
    },
  });
  if (evaluated.status === "authority_unresolved") {
    throw new ProductSubjectContextUnavailableError();
  }
  // HumanFoodContext fingerprints include a fresh generation-chain ID and
  // resolution timestamp. Two healthy reads of the same profile necessarily
  // differ. Only compare the search intent, which is the part built from the
  // initial snapshot; all safety decisions use the later resolved subject.
  if (!evaluated.subject || JSON.stringify(buildIntent(food, evaluated.subject)) !== JSON.stringify(intent)) {
    throw new ProductSubjectContextUnavailableError(
      "Your product search preferences changed during the search. Please try again.",
    );
  }
  const presentable = evaluated.evaluatedCandidates
    .filter(({ decision }) => decision.status !== "rejected")
    .sort((a, b) => Number(b.decision.status === "eligible") -
      Number(a.decision.status === "eligible"))
    .slice(0, 5);
  const unresolvedHard = evaluated.unresolved.filter((issue) => issue.classification !== "support_context");
  const catalogMatches = presentable.map(({ candidate, decision }): DevelopmentProductMatch => ({
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
      evidenceStatus: decision.status === "eligible" ? "eligible" : "needs_verification",
      needsProfileReview: decision.status !== "eligible" &&
        unresolvedHard.some((issue) => issue.classification === "hard" || issue.classification === "authority"),
      research: candidate.research ?? [],
      nutrition: candidate.facts.filter((fact) => fact.kind === "nutrition")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
      allergenInformation: candidate.facts.filter((fact) =>
        fact.kind === "declared_allergens" || fact.kind === "precautionary_allergens")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
      verificationMessage: decision.status === "eligible"
        ? "Exact barcode record and ingredient/nutrition facts found; no unresolved hard product rule applies to this profile. This is catalog evidence, not a guarantee about today's package."
        : unresolvedHard.length
          ? `Cannot recommend: ${unresolvedHard.map((issue) =>
            unresolvedReason(issue.id, issue.reason)).join(" ")} A package label alone may not resolve a missing profile rule.`
          : decision.reasons.map((reason) => reason.detail).join(" "),
    }));
  if ((!options.sources || options.interpret) && evaluated.subject) {
    await Promise.all(presentable.slice(0, 2).map(async ({ candidate, decision }, index) => {
      if (decision.status !== "eligible") return;
      catalogMatches[index].profileInsight =
        await (options.interpret ?? interpretCatalogProduct)(userId, evaluated.subject!, candidate, decision) ?? undefined;
    }));
  }
  return {
    catalogMatches,
    searched: evaluated.inspectedCount,
    rejected: evaluated.rejectedCount,
    excludedReasons: evaluated.knownConflicts.map((conflict) => conflict.reason),
    sourceFailures: evaluated.sourceFailures.map((failure) => failure.reason),
    catalogSearchAvailable: evaluated.successfulSearchPages > 0,
    unresolved: evaluated.unresolved.map((issue) => issue.id),
    profileUsed: [
      ...initial.dietaryIdentity.map((value) => `Dietary: ${value}`),
      ...initial.allergies.map((value) => `Allergy: ${value}`),
    ],
  };
}