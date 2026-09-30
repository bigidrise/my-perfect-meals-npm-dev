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
  policyUnresolved: boolean;
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

type EvaluatedProduct = Awaited<ReturnType<typeof discoverProductCandidates>>["evaluatedCandidates"][number];

function brandKey(brand: string, productName: string): string | null {
  const normalize = (value: string) => value.toLowerCase().normalize("NFKD")
    .replace(/\b(incorporated|inc|llc|ltd)\b/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const parts = brand.split(",").map(normalize).filter(Boolean);
  const key = parts.sort((a, b) => a.length - b.length)[0] ?? "";
  // Catalogs occasionally put the generic product description in "brand".
  return key && key !== normalize(productName) ? key : null;
}

function comparableCarbohydrates(candidate: ProductCandidate): number | null {
  const fact = candidate.facts.find((item) =>
    item.kind === "nutrition" && item.target === "carbs_g_per_100g" &&
    item.nutritionMeasurement?.basis === "per_100g" &&
    item.nutritionMeasurement.unit.toLowerCase() === "g" &&
    Number.isFinite(item.nutritionMeasurement.value) && item.nutritionMeasurement.value >= 0);
  return fact?.nutritionMeasurement?.value ?? null;
}

function selectDistinctProducts(
  products: readonly EvaluatedProduct[],
  subject: ProductSubjectSnapshot,
): EvaluatedProduct[] {
  const chosen: EvaluatedProduct[] = [];
  const seenBrands = new Set<string>();
  const lowCarb = subject.dietaryIdentity.some((diet) => /low.?carb|keto/i.test(diet));
  for (const distinct of [true, false]) {
    for (const status of ["eligible", "needs_verification"] as const) {
      const sameStatus = products.filter(({ decision }) => decision.status === status)
        .sort((a, b) => {
          const completeness = (item: EvaluatedProduct) =>
            Number(item.candidate.facts.some((f) => f.kind === "ingredients")) +
            Number(item.candidate.facts.some((f) => f.kind === "nutrition"));
          const evidenceDifference = completeness(b) - completeness(a);
          if (evidenceDifference) return evidenceDifference;
          // Relative comparison among like-for-like catalog measurements, not
          // an intrinsic low-carb cutoff or a substitute for daily allocation.
          return lowCarb
            ? (comparableCarbohydrates(a.candidate) ?? Infinity) -
              (comparableCarbohydrates(b.candidate) ?? Infinity)
            : 0;
        });
      for (const item of sameStatus) {
        const key = brandKey(item.candidate.identity.brand, item.candidate.identity.name);
        if (chosen.includes(item) || (distinct && (!key || seenBrands.has(key)))) continue;
        chosen.push(item);
        if (key) seenBrands.add(key);
        if (chosen.length === 3) return chosen;
      }
    }
  }
  return chosen;
}

function explainCatalogChoice(
  candidate: ProductCandidate,
  subject: ProductSubjectSnapshot,
  status: "eligible" | "needs_verification",
): string {
  const lowCarb = subject.dietaryIdentity.some((diet) => /low.?carb|keto/i.test(diet));
  const carbohydrate = candidate.facts.find((fact) =>
    fact.kind === "nutrition" && /carbohydrate|carbs/i.test(fact.statement));
  const nutrition = carbohydrate ?? candidate.facts.find((fact) => fact.kind === "nutrition");
  const factor = subject.profileFactors[0] || subject.dietaryIdentity[0] ||
    subject.medicalOptimizationNames[0];
  const context = lowCarb ? "your low-carb pattern" : factor ? `your ${factor.toLowerCase()}` : "your food search";
  const carbohydrateAmount = comparableCarbohydrates(candidate);
  const fact = lowCarb && carbohydrateAmount !== null
    ? `the catalog lists about ${carbohydrateAmount.toFixed(1)} g carbohydrate per 100 g`
    : nutrition
      ? `the catalog lists ${nutrition.statement}`
    : candidate.facts.some((item) => item.kind === "ingredients")
      ? "the catalog has an ingredient declaration, but no comparable nutrition"
      : "the catalog lacks enough ingredients and nutrition to compare";
  const dailyFit = lowCarb
    ? "Serving and today's meals still determine low-carb fit. " : "";
  return status === "eligible"
    ? `For ${context}, ${fact}. ${dailyFit}Check the current package before buying.`
    : `For ${context}, ${fact}. ${dailyFit}This is a profile-guided comparison, not an allergen or product-policy clearance; see the review note below.`;
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
      : [
        // A small sample per category prevents one provider's first same-brand
        // page from consuming the entire search budget before other categories.
        createOpenFoodFactsSearchAdapter(fetch, intent.searchCategories.length === 1 ? 4 : 1, 8),
        createUsdaBrandedAdapter(),
      ],
    evaluatedAt: new Date().toISOString(),
    useCurrentEvaluationTime: true,
    // Explore beyond the first same-brand variants; keep source requests bounded.
    maxCandidates: 40, maxPages: 6, targetCount: 9,
    maxEvaluatedCandidates: 24,
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
  const presentable = selectDistinctProducts(evaluated.evaluatedCandidates, evaluated.subject);
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
       needsProfileReview: evaluated.subject!.status !== "resolved",
       policyUnresolved: decision.status !== "eligible" && unresolvedHard.length > 0,
      research: candidate.research ?? [],
      nutrition: candidate.facts.filter((fact) => fact.kind === "nutrition")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
      allergenInformation: candidate.facts.filter((fact) =>
        fact.kind === "declared_allergens" || fact.kind === "precautionary_allergens")
        .map((fact) => ({ statement: fact.statement, source: fact.provenance.source })),
        profileInsight: explainCatalogChoice(candidate, evaluated.subject!, decision.status as "eligible" | "needs_verification"),
       verificationMessage: decision.status === "eligible"
        ? "Exact barcode record and ingredient/nutrition facts found; no unresolved hard product rule applies to this profile. This is catalog evidence, not a guarantee about today's package."
        : unresolvedHard.length
           ? `Product eligibility is not cleared: ${unresolvedHard.map((issue) =>
             unresolvedReason(issue.id, issue.reason)).join(" ")} Your saved profile was resolved; this is a product-policy gap. A package label alone may not resolve it.`
          : decision.reasons.map((reason) => reason.detail).join(" "),
    }));
  if ((!options.sources || options.interpret) && evaluated.subject) {
     await Promise.all(presentable.map(async ({ candidate, decision }, index) => {
      if (decision.status !== "eligible") return;
      catalogMatches[index].profileInsight =
         await (options.interpret ?? interpretCatalogProduct)(userId, evaluated.subject!, candidate, decision) ??
           catalogMatches[index].profileInsight;
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
       ...evaluated.subject.profileFactors,
       ...evaluated.subject.allergies.map((value) => `Allergy: ${value}`),
       ...evaluated.subject.explicitAvoidances.map((value) => `Avoid: ${value}`),
     ],
  };
}