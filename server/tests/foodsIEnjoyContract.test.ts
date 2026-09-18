import {
  emptyFoodsIEnjoyDocument,
  foodsIEnjoyDocumentSchema,
  FOODS_I_ENJOY_MAX_ITEMS,
} from "../../shared/foodsIEnjoy";

describe("Foods I Enjoy contract", () => {
  it("starts empty and does not import legacy likes", () => {
    const document = emptyFoodsIEnjoyDocument();
    expect(document).toEqual(expect.objectContaining({ version: 1, configured: false, items: [] }));
  });

  it("rejects unknown fields, invalid kinds, and duplicate active concepts", () => {
    const item = {
      id: "item-1",
      conceptId: "dish.pizza",
      kind: "dish",
      category: "meals-dishes",
      displayLabel: "Pizza",
      originalText: null,
      locale: "en-US",
      source: "catalog",
      provenance: "explicit",
      selectedAt: new Date().toISOString(),
      revokedAt: null,
    };
    expect(foodsIEnjoyDocumentSchema.safeParse({
      version: 1,
      configured: true,
      updatedAt: new Date().toISOString(),
      items: [item, { ...item, id: "item-2" }],
    }).success).toBe(false);
    expect(foodsIEnjoyDocumentSchema.safeParse({
      version: 1,
      configured: true,
      updatedAt: new Date().toISOString(),
      items: [{ ...item, kind: "unknown", unexpected: true }],
    }).success).toBe(false);
  });

  it("allows a free-text item without silently cataloging it", () => {
    const result = foodsIEnjoyDocumentSchema.safeParse({
      version: 1,
      configured: true,
      updatedAt: new Date().toISOString(),
      items: [{
        id: "custom-1",
        conceptId: null,
        kind: "custom",
        category: "custom",
        displayLabel: "Grandma's chicken stew",
        originalText: "Grandma's chicken stew",
        locale: "en-US",
        source: "free_text",
        provenance: "explicit",
        selectedAt: new Date().toISOString(),
        revokedAt: null,
      }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items[0].conceptId).toBeNull();
  });

  it("rejects active custom duplicates after trim and case folding", () => {
    const item = {
      id: "custom-1",
      conceptId: null,
      kind: "custom",
      category: "custom",
      displayLabel: "Grandma's stew",
      originalText: " Grandma's Stew ",
      locale: null,
      source: "free_text",
      provenance: "explicit",
      selectedAt: new Date().toISOString(),
      revokedAt: null,
    };
    expect(foodsIEnjoyDocumentSchema.safeParse({
      version: 1,
      configured: true,
      updatedAt: new Date().toISOString(),
      items: [item, { ...item, id: "custom-2", displayLabel: "grandma's stew", originalText: "grandma's stew" }],
    }).success).toBe(false);
  });

  it("enforces the bounded item count", () => {
    const item = {
      id: "item",
      conceptId: null,
      kind: "custom",
      category: "custom",
      displayLabel: "Food",
      originalText: "Food",
      locale: null,
      source: "free_text",
      provenance: "explicit",
      selectedAt: new Date().toISOString(),
      revokedAt: null,
    };
    const result = foodsIEnjoyDocumentSchema.safeParse({
      version: 1,
      configured: true,
      updatedAt: new Date().toISOString(),
      items: Array.from({ length: FOODS_I_ENJOY_MAX_ITEMS + 1 }, (_, index) => ({ ...item, id: `item-${index}`, originalText: `Food ${index}` })),
    });
    expect(result.success).toBe(false);
  });
});