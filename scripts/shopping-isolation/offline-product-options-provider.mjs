// Synthetic provider inputs only. The real subject resolver, product validators,
// route authentication and Shopping/Saved Groceries persistence still execute.
export async function offlineProductOptions(userId, input) {
  if (process.env.PORT !== "4179" || process.env.SHOPPING_OFFLINE_PRODUCT_FIXTURES !== "true" ||
      process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Offline product providers require the explicit isolated Development launcher.");
  }
  const avocado = /avocado/i.test(input.originalName);
  const name = avocado ? "100% Pure Avocado Oil" : "Olive Oil";
  const variant = avocado ? "Original" : "Extra Virgin 500ml";
  const now = new Date().toISOString();
  const records = [avocado ? "Chosen Foods" : "Synthetic Alpha", "Kirkland Signature", "Synthetic Gamma"].map((brand, index) => ({
    source: "usda_branded", sourceRecordId: `offline-shopping-${avocado ? "avocado" : "olive"}-${index}`,
    name, brand, variant, barcode: `00000001901${avocado ? "1" : "0"}${index}`, market: "United States",
    observedAt: null, identityObservedAt: now, retrievedAt: now,
    exactVariantMatch: true, servingDescription: "14g", packageSize: "500ml",
    facts: [
      { kind: "ingredients", originalStatement: avocado ? "Avocado oil" : "Olive oil", completeness: "unknown" },
      { kind: "nutrition", target: "fat_g_per_100g", originalStatement: "Fat 100 g per 100g",
        completeness: "unknown", nutritionMeasurement: { value: 100, unit: "g", basis: "per_100g" } },
    ],
  }));
  const adapter = {
    source: "usda_branded",
    search: async () => ({ references: records.map(record => ({ source: record.source, sourceRecordId: record.sourceRecordId })), nextCursor: null }),
    read: async reference => {
      const record = records.find(item => item.sourceRecordId === reference.sourceRecordId);
      if (!record) throw new Error("Unexpected offline product reference");
      return structuredClone(record);
    },
  };
  console.log("[shopping-offline] Synthetic providers supplied; real profile, evidence and persistence gates remain active.");
  return {
    recommend: async () => ({
      analysisMethod: "by_name", fallbackUsed: false,
      betterAlternatives: records.map(record => ({
        // Real recommendations often omit package/variant words. Exercise that
        // actual review-only renderer rather than manufacturing exact matches.
        category: `${record.brand} ${name}${avocado ? "" : ` ${variant}`}`, brand: record.brand, productName: `${name}${avocado ? "" : ` ${variant}`}`,
        whyBetter: ["Synthetic product option for isolated workflow verification."],
        targetCriteria: "Available at synthetic test retailers. Offline fixture — not a real catalog listing or medical verification.",
      })),
      educationalFooter: "Offline fixture — check the current package label.", verdictLevel: "caution",
    }),
    discoveryOptions: { adapter, fallbackAdapter: {
      source: "open_food_facts",
      search: async () => ({ references: [], nextCursor: null }),
      read: async () => { throw new Error("Unexpected offline fallback record"); },
    } },
  };
}
