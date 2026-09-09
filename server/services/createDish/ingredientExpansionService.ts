import { z } from "zod";
import {
  ExpandIngredientResponseSchema,
  ExpansionOptionSchema,
  CookingMethodIdSchema,
  type ExpandIngredientRequest,
  type ExpandIngredientResponse,
  type ExpansionDimension,
  type ExpansionOption,
} from "../../../shared/createDishIngredientExpansion";
import {
  CREATE_DISH_CULINARY_ENTRIES,
  METHOD_TEXTURES,
  type CreateDishCulinaryEntry,
} from "../../../shared/catalog/createDishCulinary.catalog";
import {
  INGREDIENT_TECHNIQUE_MAPPINGS,
  type IngredientTechniqueMapping,
} from "../../../shared/catalog/ingredientTechniqueMappings.catalog";
import {
  getTechniqueById,
  type CookingMethodId,
} from "../../../shared/catalog/techniques.catalog";

export interface AiExpansionProvider {
  expand(input: {
    canonicalIngredient: string;
    category: string;
    knownMethodIds: CookingMethodId[];
    blockedMethodIds: CookingMethodId[];
    governedFormIds: string[];
    requestedDimensions: ExpansionDimension[];
    maximumOptionsPerDimension: number;
  }): Promise<unknown>;
}

export interface IngredientExpansionContext {
  allergyTags?: string[];
  aiProvider?: AiExpansionProvider;
}

const AMBIGUOUS: Record<
  string,
  { status: "clarification_required" | "clarification_recommended"; question: string; choices: [string, string][] }
> = {
  steak: {
    status: "clarification_required",
    question: "What kind of steak would you like to use?",
    choices: [
      ["beef", "Beef"],
      ["tuna", "Tuna"],
      ["cauliflower", "Cauliflower"],
      ["other", "Something Else"],
    ],
  },
  fish: {
    status: "clarification_recommended",
    question: "Do you have a particular fish in mind?",
    choices: [
      ["salmon", "Salmon"],
      ["cod", "Cod"],
      ["tilapia", "Tilapia"],
      ["surprise", "Surprise Me"],
    ],
  },
};

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const toMappingId = (value: string) => normalize(value).replace(/\s+/g, "_");

function recognize(input: string) {
  const normalized = normalize(input);
  const ambiguous = AMBIGUOUS[normalized];
  if (ambiguous) {
    return {
      submittedText: input,
      status: ambiguous.status,
      canonicalId: null,
      canonicalName: null,
      category: null,
      confidence: "medium" as const,
      clarification: {
        question: ambiguous.question,
        choices: ambiguous.choices.map(([id, label]) => ({ id, label })),
      },
    };
  }

  const entry = CREATE_DISH_CULINARY_ENTRIES.find((candidate) =>
    candidate.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return normalizedAlias === normalized ||
        new RegExp(`\\b${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized);
    }),
  );
  if (!entry) {
    return {
      submittedText: input,
      status: "unsupported" as const,
      canonicalId: null,
      canonicalName: null,
      category: null,
      confidence: "low" as const,
    };
  }
  return {
    submittedText: input,
    status: "recognized" as const,
    canonicalId: entry.id,
    canonicalName: entry.name,
    category: entry.category,
    confidence: "high" as const,
  };
}

function inferSelectionIds(
  input: string,
  options: ExpansionOption[],
): Partial<Record<ExpansionDimension, string>> {
  const normalized = normalize(input);
  const inferred: Partial<Record<ExpansionDimension, string>> = {};
  const aliases: Record<string, string[]> = {
    thigh: ["thigh", "thighs"],
    breast: ["breast", "breasts"],
    cubed: ["cubed", "cube", "cubes", "diced"],
    cubes: ["cubed", "cube", "cubes", "diced"],
    strips: ["strip", "strips", "sliced"],
    "steak-cut": ["steak", "steaks"],
    "pan-seared": ["pan seared", "seared", "sear"],
    "stir-fried": ["stir fried", "stir fry", "stir-fry"],
    "air-fried": ["air fried", "air fry", "air-fried"],
    "crispy-exterior": ["crispy"],
    crispy: ["crispy"],
  };
  for (const candidate of options) {
    if (inferred[candidate.dimension]) continue;
    const terms = [
      normalize(candidate.id),
      normalize(candidate.label),
      ...(aliases[candidate.id] ?? []),
    ];
    if (terms.some((term) =>
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized)
    )) {
      inferred[candidate.dimension] = candidate.id;
    }
  }
  return inferred;
}

function mappingsFor(entry: CreateDishCulinaryEntry): IngredientTechniqueMapping[] {
  const preferredIds: Record<string, string[]> = {
    chicken: ["chicken_breast", "chicken_thighs"],
    beef: ["lean_beef", "ground_beef"],
    pork: ["pork_tenderloin"],
  };
  const ids = preferredIds[entry.id] ?? [toMappingId(entry.name)];
  return INGREDIENT_TECHNIQUE_MAPPINGS.filter((mapping) =>
    ids.includes(mapping.ingredientId),
  );
}

function option(
  dimension: ExpansionDimension,
  id: string,
  label: string,
  source: ExpansionOption["source"],
  extra: Partial<ExpansionOption> = {},
): ExpansionOption {
  return ExpansionOptionSchema.parse({
    id,
    label,
    dimension,
    source,
    confidence: source === "validated_ai" ? "medium" : "high",
    ...extra,
  });
}

function allowedAiForms(entry: CreateDishCulinaryEntry) {
  return new Set(entry.forms.map((form) => form.id));
}

function validateAiOptions(
  raw: unknown,
  entry: CreateDishCulinaryEntry,
  methodIds: CookingMethodId[],
): ExpansionOption[] {
  const AiCandidateSchema = ExpansionOptionSchema.omit({ source: true });
  const AiResponseSchema = z
    .object({
      forms: z.array(AiCandidateSchema).max(6).optional(),
      methods: z.array(AiCandidateSchema).max(6).optional(),
      textures: z.array(AiCandidateSchema).max(6).optional(),
      flavors: z.array(AiCandidateSchema).max(6).optional(),
      cuisines: z.array(AiCandidateSchema).max(6).optional(),
    })
    .strict();
  const parsedResponse = AiResponseSchema.parse(raw);
  const expectedDimension: Record<string, ExpansionDimension> = {
    forms: "form",
    methods: "method",
    textures: "texture",
    flavors: "flavor",
    cuisines: "cuisine",
  };
  const flat = Object.entries(parsedResponse).flatMap(([container, values]) =>
    (values ?? []).map((value) => ({ container, value })),
  );
  const seen = new Set<string>();
  const forms = allowedAiForms(entry);

  return flat.map(({ container, value: candidate }) => {
    if (candidate.dimension !== expectedDimension[container]) {
      throw new Error(`Dimension ${candidate.dimension} is invalid in ${container}`);
    }
    const parsed = ExpansionOptionSchema.parse({
      ...candidate,
      source: "validated_ai",
    });
    const key = `${parsed.dimension}:${parsed.id}`;
    if (seen.has(key)) throw new Error(`Duplicate AI option ${key}`);
    seen.add(key);
    if (
      parsed.dimension === "method" &&
      (!CookingMethodIdSchema.safeParse(parsed.id).success ||
        !methodIds.includes(parsed.id as CookingMethodId))
    ) {
      throw new Error(`Unsupported technique ${parsed.id}`);
    }
    if (parsed.dimension === "form" && !forms.has(parsed.id)) {
      throw new Error(`Unsupported form ${parsed.id}`);
    }
    if (
      parsed.compatibleMethodIds?.some(
        (methodId) => !methodIds.includes(methodId),
      )
    ) {
      throw new Error(`Texture references unsupported method`);
    }
    if (
      /\b(calorie|carb|sodium|sugar|fat|protein|diabetes|glp-?1|medical|heart[- ]healthy|weight loss|low[- ](?:carb|sodium|sugar|fat))\b/i.test(
        parsed.label,
      )
    ) {
      throw new Error("AI option contains a medical or nutrition claim");
    }
    return parsed;
  });
}

function findOption(
  options: ExpansionOption[],
  id: string | null | undefined,
  dimension: ExpansionDimension,
) {
  if (!id) return null;
  const found = options.find(
    (candidate) => candidate.id === id && candidate.dimension === dimension,
  );
  if (!found) throw new Error(`UNKNOWN_OPTION_ID:${dimension}:${id}`);
  return found;
}

function resolveCombination(
  options: ExpansionOption[],
  request: ExpandIngredientRequest,
) {
  const policy = request.surprisePolicy;
  if (!policy) return null;
  const delegated = new Set(policy.delegatedDimensions);
  const dimensions: ExpansionDimension[] = [
    "form",
    "method",
    "texture",
    "flavor",
    "cuisine",
  ];
  const result: Record<ExpansionDimension, ExpansionOption | null> = {
    form: null,
    method: null,
    texture: null,
    flavor: null,
    cuisine: null,
  };
  const selectionSource = {} as Record<
    ExpansionDimension,
    "user_selected" | "system_selected" | "not_applicable"
  >;

  for (const dimension of dimensions) {
    const selectedId = policy.selectedOptionIds[dimension];
    if (selectedId) {
      result[dimension] = findOption(options, selectedId, dimension);
      selectionSource[dimension] = "user_selected";
    } else if (delegated.has(dimension)) {
      result[dimension] =
        options.find((candidate) => candidate.dimension === dimension) ?? null;
      selectionSource[dimension] = result[dimension]
        ? "system_selected"
        : "not_applicable";
    } else {
      selectionSource[dimension] = "not_applicable";
    }
  }

  if (
    result.texture &&
    result.method &&
    result.texture.compatibleMethodIds &&
    !result.texture.compatibleMethodIds.includes(result.method.id as CookingMethodId)
  ) {
    if (selectionSource.texture === "user_selected") {
      throw new Error("NO_COMPATIBLE_COMBINATION:texture_method");
    }
    result.texture = options.find(
      (candidate) =>
        candidate.dimension === "texture" &&
        candidate.compatibleMethodIds?.includes(
          result.method!.id as CookingMethodId,
        ),
    ) ?? null;
  }
  if (result.flavor?.cuisineId) {
    if (result.cuisine && result.cuisine.id !== result.flavor.cuisineId) {
      if (selectionSource.cuisine === "user_selected") {
        throw new Error("NO_COMPATIBLE_COMBINATION:flavor_cuisine");
      }
      result.cuisine = options.find(
        (candidate) =>
          candidate.dimension === "cuisine" &&
          candidate.id === result.flavor!.cuisineId,
      ) ?? null;
      selectionSource.cuisine = result.cuisine
        ? "system_selected"
        : "not_applicable";
    } else if (!result.cuisine && delegated.has("cuisine")) {
      result.cuisine = options.find(
        (candidate) =>
          candidate.dimension === "cuisine" &&
          candidate.id === result.flavor!.cuisineId,
      ) ?? null;
      selectionSource.cuisine = result.cuisine
        ? "system_selected"
        : "not_applicable";
    }
  }

  return { ...result, selectionSource };
}

export async function expandCreateDishIngredient(
  request: ExpandIngredientRequest,
  context: IngredientExpansionContext = {},
): Promise<ExpandIngredientResponse> {
  if (request.creator !== "create_a_dish") {
    throw new Error("CREATE_DISH_SCOPE_REQUIRED");
  }

  const ingredient = recognize(request.ingredientInput);
  const warnings: ExpandIngredientResponse["warnings"] = [];
  if (ingredient.status !== "recognized") {
    warnings.push({
      code:
        ingredient.status === "unsupported"
          ? "UNSUPPORTED_INGREDIENT"
          : "CLARIFICATION_REQUIRED",
      message:
        ingredient.status === "unsupported"
          ? "The ingredient could not be recognized confidently."
          : ingredient.clarification?.question ?? "Clarification is required.",
    });
    return ExpandIngredientResponseSchema.parse({
      ingredient,
      options: { forms: [], methods: [], textures: [], flavors: [], cuisines: [] },
      resolvedCombination: null,
      inferredSelectionIds: {},
      warnings,
    });
  }

  const entry = CREATE_DISH_CULINARY_ENTRIES.find(
    (candidate) => candidate.id === ingredient.canonicalId,
  )!;
  const mappings = mappingsFor(entry);
  const blockedMethodIds = new Set(
    mappings.flatMap((mapping) => mapping.blockedMethods ?? []),
  );
  const methodIds = Array.from(
    new Set(
      mappings.length
        ? [
            ...mappings.flatMap((mapping) => mapping.validMethods),
            ...(entry.additionalMethodIds ?? []),
          ]
        : entry.methodIds ?? [],
    ),
  ).filter((id) => !blockedMethodIds.has(id));
  const allergyTags = new Set((context.allergyTags ?? []).map(normalize));

  const forms = entry.forms.map((form) =>
    option("form", form.id, form.label, "catalog"),
  );
  const methods = methodIds.flatMap((id) => {
    const technique = getTechniqueById(id);
    return technique
      ? [
          option(
            "method",
            technique.id,
            technique.name,
            mappings.some((mapping) => mapping.validMethods.includes(id))
              ? "ingredient_technique_mapping"
              : "category_default",
          ),
        ]
      : [];
  });
  const textureMap = new Map<string, ExpansionOption>();
  for (const methodId of methodIds) {
    for (const texture of METHOD_TEXTURES[methodId] ?? []) {
      const existing = textureMap.get(texture.id);
      if (existing) {
        existing.compatibleMethodIds = Array.from(
          new Set([...(existing.compatibleMethodIds ?? []), methodId]),
        );
      } else {
        textureMap.set(
          texture.id,
          option("texture", texture.id, texture.label, "catalog", {
            compatibleMethodIds: [methodId],
          }),
        );
      }
    }
  }
  const textures = Array.from(textureMap.values());
  const flavors = entry.flavors
    .filter(
      (flavor) =>
        !flavor.allergenTags?.some((tag) => allergyTags.has(normalize(tag))),
    )
    .map((flavor) =>
      option("flavor", flavor.id, flavor.label, "catalog", {
        cuisineId: flavor.cuisineId,
        allergenTags: flavor.allergenTags,
      }),
    );
  const cuisines = Array.from(
    new Set(entry.flavors.map((flavor) => flavor.cuisineId).filter(Boolean)),
  ).map((cuisineId) =>
    option(
      "cuisine",
      cuisineId!,
      cuisineId!
        .split("-")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" "),
      "catalog",
    ),
  );

  let allOptions = [...forms, ...methods, ...textures, ...flavors, ...cuisines];
  const needsAiGapFilling =
    forms.length < 3 ||
    methods.length < 3 ||
    flavors.length < 4 ||
    cuisines.length < 2;
  if (request.useAiForGaps && context.aiProvider && needsAiGapFilling) {
    try {
      const raw = await context.aiProvider.expand({
        canonicalIngredient: entry.name,
        category: entry.category,
        knownMethodIds: methodIds,
        blockedMethodIds: Array.from(blockedMethodIds),
        governedFormIds: entry.forms.map((form) => form.id),
        requestedDimensions: ["form", "method", "texture", "flavor", "cuisine"],
        maximumOptionsPerDimension: 6,
      });
      const aiOptions = validateAiOptions(raw, entry, methodIds).filter(
        (candidate) =>
          !candidate.allergenTags?.some((tag) => allergyTags.has(normalize(tag))),
      );
      const existing = new Set(
        allOptions.map((candidate) => `${candidate.dimension}:${candidate.id}`),
      );
      allOptions = [
        ...allOptions,
        ...aiOptions.filter(
          (candidate) => !existing.has(`${candidate.dimension}:${candidate.id}`),
        ),
      ];
    } catch {
      warnings.push({
        code: "AI_VALIDATION_FAILED",
        message: "AI-assisted options were discarded; governed options remain available.",
      });
    }
  }

  if (!forms.length) {
    warnings.push({
      code: "NO_GOVERNED_FORMS",
      message: "No governed forms are available for this ingredient.",
    });
  }

  let resolvedCombination = null;
  try {
    resolvedCombination = resolveCombination(allOptions, request);
  } catch (error) {
    if (String(error).includes("UNKNOWN_OPTION_ID")) throw error;
    warnings.push({
      code: "NO_COMPATIBLE_COMBINATION",
      message: "No coherent combination could be resolved.",
    });
  }

  return ExpandIngredientResponseSchema.parse({
    ingredient,
    options: {
      forms: allOptions.filter((item) => item.dimension === "form"),
      methods: allOptions.filter((item) => item.dimension === "method"),
      textures: allOptions.filter((item) => item.dimension === "texture"),
      flavors: allOptions.filter((item) => item.dimension === "flavor"),
      cuisines: allOptions.filter((item) => item.dimension === "cuisine"),
    },
    resolvedCombination,
    inferredSelectionIds: inferSelectionIds(request.ingredientInput, allOptions),
    warnings,
  });
}
