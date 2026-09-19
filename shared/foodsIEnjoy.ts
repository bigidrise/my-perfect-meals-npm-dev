import { z } from "zod";

export const FOODS_I_ENJOY_VERSION = 1 as const;
export const FOODS_I_ENJOY_MAX_ITEMS = 100;

export const FOOD_ENJOYMENT_KINDS = [
  "dish",
  "breakfast",
  "protein",
  "produce",
  "snack",
  "dessert",
  "beverage",
  "cuisine",
  "custom",
] as const;
export type FoodEnjoymentKind = (typeof FOOD_ENJOYMENT_KINDS)[number];

export const FOOD_ENJOYMENT_GROUPS = [
  "meals-dishes",
  "breakfast",
  "proteins",
  "fruits-vegetables",
  "snacks-treats",
  "desserts",
  "drinks",
  "cuisines",
] as const;

const localeSchema = z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Invalid locale");

export const foodEnjoymentItemSchema = z.object({
  id: z.string().trim().min(1).max(100),
  conceptId: z.string().trim().min(1).max(100).nullable(),
  kind: z.enum(FOOD_ENJOYMENT_KINDS),
  category: z.string().trim().min(1).max(80),
  displayLabel: z.string().trim().min(1).max(120),
  originalText: z.string().trim().max(240).nullable(),
  locale: localeSchema.nullable(),
  source: z.enum(["catalog", "free_text"]),
  provenance: z.literal("explicit"),
  selectedAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
}).strict().superRefine((item, ctx) => {
  if (item.source === "catalog" && !item.conceptId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["conceptId"], message: "Catalog items require a conceptId" });
  }
  if (item.source === "free_text" && !item.originalText) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["originalText"], message: "Custom items require originalText" });
  }
});

export type FoodEnjoymentItem = z.infer<typeof foodEnjoymentItemSchema>;

export const foodsIEnjoyDocumentSchema = z.object({
  version: z.literal(FOODS_I_ENJOY_VERSION),
  configured: z.boolean(),
  updatedAt: z.string().datetime(),
  items: z.array(foodEnjoymentItemSchema).max(FOODS_I_ENJOY_MAX_ITEMS),
}).strict().superRefine((document, ctx) => {
  const activeIds = document.items.filter((item) => !item.revokedAt).map((item) => item.id);
  if (new Set(activeIds).size !== activeIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Active item IDs must be unique" });
  }
  const activeConcepts = document.items.filter((item) => !item.revokedAt && item.conceptId).map((item) => item.conceptId);
  if (new Set(activeConcepts).size !== activeConcepts.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Active concept IDs must be unique" });
  }
  const activeCustomText = document.items
    .filter((item) => !item.revokedAt && item.source === "free_text")
    .map((item) => (item.originalText ?? item.displayLabel).trim().toLocaleLowerCase());
  if (new Set(activeCustomText).size !== activeCustomText.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Active custom foods must be unique ignoring case and whitespace" });
  }
});

export type FoodsIEnjoyDocument = z.infer<typeof foodsIEnjoyDocumentSchema>;

export const foodsIEnjoyWriteSchema = foodsIEnjoyDocumentSchema;

export const FOODS_I_ENJOY_CATALOG = [
  { conceptId: "dish.pizza", kind: "dish", category: "meals-dishes", label: "Pizza" },
  { conceptId: "dish.tacos", kind: "dish", category: "meals-dishes", label: "Tacos" },
  { conceptId: "dish.pasta", kind: "dish", category: "meals-dishes", label: "Pasta" },
  { conceptId: "dish.curry", kind: "dish", category: "meals-dishes", label: "Curry" },
  { conceptId: "dish.sushi", kind: "dish", category: "meals-dishes", label: "Sushi" },
  { conceptId: "breakfast.eggs", kind: "breakfast", category: "breakfast", label: "Eggs" },
  { conceptId: "breakfast.cereal", kind: "breakfast", category: "breakfast", label: "Cereal" },
  { conceptId: "protein.steak", kind: "protein", category: "proteins", label: "Steak" },
  { conceptId: "protein.chicken", kind: "protein", category: "proteins", label: "Chicken" },
  { conceptId: "produce.mango", kind: "produce", category: "fruits-vegetables", label: "Mango" },
  { conceptId: "produce.broccoli", kind: "produce", category: "fruits-vegetables", label: "Broccoli" },
  { conceptId: "snack.cookies", kind: "snack", category: "snacks-treats", label: "Cookies" },
  { conceptId: "dessert.ice-cream", kind: "dessert", category: "desserts", label: "Ice cream" },
  { conceptId: "beverage.coffee", kind: "beverage", category: "drinks", label: "Coffee" },
  { conceptId: "cuisine.japanese", kind: "cuisine", category: "cuisines", label: "Japanese food" },
  { conceptId: "cuisine.indian", kind: "cuisine", category: "cuisines", label: "Indian food" },
  { conceptId: "cuisine.mexican", kind: "cuisine", category: "cuisines", label: "Mexican food" },
] as const;

export function emptyFoodsIEnjoyDocument(now = new Date()): FoodsIEnjoyDocument {
  return { version: FOODS_I_ENJOY_VERSION, configured: false, updatedAt: now.toISOString(), items: [] };
}