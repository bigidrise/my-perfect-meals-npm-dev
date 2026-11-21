// Synthetic provider inputs only. The real subject resolver, product validators,
// route authentication and Shopping/Saved Groceries persistence still execute.
export async function offlineProductOptions(userId, input) {
  if (process.env.PORT !== "4179" || process.env.SHOPPING_OFFLINE_PRODUCT_FIXTURES !== "true" ||
      process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Offline product providers require the explicit isolated Development launcher.");
  }
  const avocado = /avocado/i.test(input.originalName);
  const kind = avocado ? "avocado" : /tomato sauce/i.test(input.originalName) ? "tomato" :
    /oatmeal/i.test(input.originalName) ? "oatmeal" : /yogurt/i.test(input.originalName) ? "yogurt" :
      /seasoning/i.test(input.originalName) ? "seasoning" : /canned beans/i.test(input.originalName) ? "beans" : "olive";
  const name = avocado ? "100% Pure Avocado Oil" : kind === "olive" ? "Olive Oil" : input.originalName;
  const variant = avocado ? "Original" : "Extra Virgin 500ml";
  const now = new Date().toISOString();
  const brands = avocado ? ["Chosen Foods", "Primal Kitchen", "La Tourangelle"] : ["Synthetic Alpha", "Kirkland Signature", "Synthetic Gamma"];
  const records = brands.map((brand, index) => ({
    source: "usda_branded", sourceRecordId: `offline-shopping-${kind}-${index}`,
    name: avocado && index === 1 ? "Hot Buffalo Sauce Made With Avocado Oil" : avocado && index === 2 ? "Avocado Oil" : name,
    brand, variant, barcode: `00000001901${["olive", "avocado", "tomato", "oatmeal", "yogurt", "seasoning", "beans"].indexOf(kind)}${index}`, market: "United States",
    observedAt: null, identityObservedAt: now, retrievedAt: now,
    exactVariantMatch: true, servingDescription: "14g", packageSize: "500ml",
    facts: [
      { kind: "ingredients", originalStatement: `Synthetic offline fixture only: ${avocado ? "Avocado oil" : name}`, completeness: "unknown" },
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
        category: `${record.brand} ${avocado && record.brand === "Primal Kitchen" ? "Avocado Oil" : record.name}${avocado ? "" : ` ${variant}`}`,
        brand: record.brand, productName: `${avocado && record.brand === "Primal Kitchen" ? "Avocado Oil" : record.name}${avocado ? "" : ` ${variant}`}`,
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
