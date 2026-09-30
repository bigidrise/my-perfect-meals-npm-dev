export interface ChoiceCandidate {
  name?: string;
  ingredients?: unknown[];
  instructions?: string | string[];
}

export interface FinalChoiceResult<T> {
  choices: T[];
  refillCalls: number;
  timedOut: boolean;
}

/** One release path for every candidate in a replacement batch. A rejected
 * candidate never skips ahead to formatting or acquires final-choice status. */
export async function releaseCreateDishReplacementBatch<
  Raw extends ChoiceCandidate,
  Final extends ChoiceCandidate,
>(candidates: Raw[], gates: {
  clinical: (candidate: Raw) => boolean;
  protocol: (candidates: Raw[]) => Raw[];
  allergen: (candidates: Raw[]) => Raw[];
  transform: (candidates: Raw[]) => Promise<Raw[]>;
  humanFood: (candidate: Raw) => boolean;
  dishIntent: (candidate: Raw) => boolean;
  format: (candidate: Raw) => Final;
  finalFood: (candidate: Final) => boolean;
  finalDishIntent: (candidate: Final) => boolean;
}): Promise<Final[]> {
  const clinical = candidates.filter(gates.clinical);
  const protocol = gates.protocol(clinical);
  const allergens = gates.allergen(protocol);
  const transformed = await gates.transform(allergens);
  const humanFood = transformed.filter(gates.humanFood);
  const intent = humanFood.filter(gates.dishIntent);
  const formatted = intent.map(gates.format);
  return formatted.filter(candidate =>
    gates.finalFood(candidate) && gates.finalDishIntent(candidate)
  );
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function recipeSignature(candidate: ChoiceCandidate): string | null {
  const ingredients = candidate.ingredients?.map(ingredient =>
    typeof ingredient === "string"
      ? normalize(ingredient)
      : ingredient && typeof ingredient === "object"
        ? normalize(String((ingredient as { name?: string; item?: string }).name ??
            (ingredient as { item?: string }).item ?? ""))
        : ""
  ).filter(Boolean).sort().join("|");
  // Paraphrased instructions or renamed titles do not make an otherwise
  // identical ingredient composition a materially different recipe.
  return ingredients || null;
}

/**
 * Counts only fully released choices. The caller owns the complete, identical
 * safety/dish/post-format validation for each replacement batch.
 */
export async function fillFinalCreateDishChoices<T extends ChoiceCandidate>(input: {
  initial: T[];
  initialCandidates: ChoiceCandidate[];
  excludedNames?: string[];
  deadlineAt: number;
  maxRefillCalls: number;
  generate: (call: number, excludedNames: string[], signal: AbortSignal) => Promise<ChoiceCandidate[]>;
  validate: (candidates: ChoiceCandidate[]) => Promise<T[]>;
  now?: () => number;
}): Promise<FinalChoiceResult<T>> {
  const now = input.now ?? Date.now;
  const choices: T[] = [];
  const names = new Set<string>();
  const signatures = new Set<string>();
  const excluded = new Set(
    (input.excludedNames ?? []).map(normalize).filter(Boolean),
  );
  const excludedOriginalNames = new Set(
    (input.excludedNames ?? []).map(name => name.trim()).filter(Boolean),
  );

  function add(candidate: T): void {
    if (choices.length >= 3) return;
    const name = normalize(candidate.name ?? "");
    const signature = recipeSignature(candidate);
    if (!name || !signature || names.has(name) || signatures.has(signature)) return;
    names.add(name);
    excludedOriginalNames.add(candidate.name!.trim());
    signatures.add(signature);
    choices.push(candidate);
  }

  input.initial.forEach(add);
  for (const candidate of input.initialCandidates) {
    if (candidate.name?.trim()) {
      excludedOriginalNames.add(candidate.name.trim());
      if (!names.has(normalize(candidate.name))) excluded.add(normalize(candidate.name));
    }
  }
  let refillCalls = 0;
  let timedOut = false;
  while (choices.length < 3 && refillCalls < input.maxRefillCalls) {
    const remaining = input.deadlineAt - now();
    if (remaining <= 0) {
      timedOut = true;
      break;
    }
    refillCalls++;
    const controller = new AbortController();
    let rejectDeadline!: (error: Error) => void;
    const deadline = new Promise<never>((_resolve, reject) => {
      rejectDeadline = reject;
    });
    const timer = setTimeout(() => {
      controller.abort();
      rejectDeadline(new Error("Create a Dish refill time budget exceeded"));
    }, remaining);
    try {
      const candidates = await Promise.race([
        input.generate(refillCalls, [...excludedOriginalNames], controller.signal),
        deadline,
      ]);
      for (const candidate of candidates) {
        if (candidate.name?.trim()) excludedOriginalNames.add(candidate.name.trim());
      }
      if (controller.signal.aborted || now() >= input.deadlineAt) {
        timedOut = true;
        break;
      }
      const validated = await Promise.race([input.validate(candidates), deadline]);
      if (controller.signal.aborted || now() >= input.deadlineAt) {
        timedOut = true;
        break;
      }
      const validNames = new Set(validated.map(candidate => normalize(candidate.name ?? "")));
      for (const candidate of candidates) {
        const name = normalize(candidate.name ?? "");
        if (name && !validNames.has(name)) excluded.add(name);
      }
      for (const candidate of validated) {
        if (excluded.has(normalize(candidate.name ?? ""))) continue;
        add(candidate);
      }
      if (now() >= input.deadlineAt && choices.length < 3) {
        timedOut = true;
        break;
      }
    } catch (error) {
      if (controller.signal.aborted || now() >= input.deadlineAt) {
        timedOut = true;
        break;
      }
      console.warn("[CreateDish] Final-choice refill failed; retaining verified choices", error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { choices, refillCalls, timedOut };
}