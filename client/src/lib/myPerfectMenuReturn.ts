import {
  isMyPerfectMenuBuilderKey,
  type MyPerfectMenuBuilderKey,
} from "@shared/builderNamespaces";
import {
  myPerfectMenuCategorySchema,
  myPerfectMenuMealSlotSchema,
  type MyPerfectMenuCategory,
  type MyPerfectMenuMealSlot,
} from "@shared/myPerfectMenu";

const RETURN_PATH = "/foods-i-enjoy";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CONCEPT_ID_RE = /^[A-Za-z0-9_-]{8,100}$/;
const ALLOWED_KEYS = new Set([
  "builder",
  "category",
  "householdProfileId",
  "destinationDate",
  "destinationSlot",
  "selectedConceptId",
]);

export type MyPerfectMenuReturnContext = {
  builderKey: MyPerfectMenuBuilderKey;
  category: MyPerfectMenuCategory;
  householdProfileId?: string;
  destinationDate?: string;
  destinationSlot?: MyPerfectMenuMealSlot;
  selectedConceptId?: string;
};

export function buildMyPerfectMenuReturnTarget(context: MyPerfectMenuReturnContext): string {
  const params = new URLSearchParams();
  params.set("builder", context.builderKey);
  params.set("category", context.category);
  if (context.householdProfileId && UUID_RE.test(context.householdProfileId)) {
    params.set("householdProfileId", context.householdProfileId);
  }
  if (context.destinationDate && DATE_RE.test(context.destinationDate)) {
    params.set("destinationDate", context.destinationDate);
  }
  if (context.destinationSlot && myPerfectMenuMealSlotSchema.safeParse(context.destinationSlot).success) {
    params.set("destinationSlot", context.destinationSlot);
  }
  if (context.selectedConceptId && CONCEPT_ID_RE.test(context.selectedConceptId)) {
    params.set("selectedConceptId", context.selectedConceptId);
  }
  return `${RETURN_PATH}?${params.toString()}`;
}

export function sanitizeMyPerfectMenuReturnTarget(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(`${RETURN_PATH}?`) || value.startsWith("//")) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, "https://my-perfect-menu.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "https://my-perfect-menu.invalid" || parsed.pathname !== RETURN_PATH) return null;
  if ([...parsed.searchParams.keys()].some((key) => !ALLOWED_KEYS.has(key))) return null;

  const builderKey = parsed.searchParams.get("builder");
  const category = parsed.searchParams.get("category");
  if (!isMyPerfectMenuBuilderKey(builderKey)) return null;
  const parsedCategory = myPerfectMenuCategorySchema.safeParse(category);
  if (!parsedCategory.success) return null;

  const householdProfileId = parsed.searchParams.get("householdProfileId") ?? undefined;
  const destinationDate = parsed.searchParams.get("destinationDate") ?? undefined;
  const destinationSlot = parsed.searchParams.get("destinationSlot") ?? undefined;
  const selectedConceptId = parsed.searchParams.get("selectedConceptId") ?? undefined;
  if (householdProfileId && !UUID_RE.test(householdProfileId)) return null;
  if (destinationDate && !DATE_RE.test(destinationDate)) return null;
  if (destinationSlot && !myPerfectMenuMealSlotSchema.safeParse(destinationSlot).success) return null;
  if (selectedConceptId && !CONCEPT_ID_RE.test(selectedConceptId)) return null;

  return buildMyPerfectMenuReturnTarget({
    builderKey,
    category: parsedCategory.data,
    householdProfileId,
    destinationDate,
    destinationSlot: destinationSlot as MyPerfectMenuMealSlot | undefined,
    selectedConceptId,
  });
}