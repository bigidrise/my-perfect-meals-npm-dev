import { starchPreviewGrams, studioStarchDraft, studioStarchPreferencesSchema } from "../../../../shared/starchPreferences";

test.each(["one", "flex"] as const)("legacy %s is a preview only, never a migration", strategy => {
  const saved = { defaultStarchMealsPerDay: null, starchDistributionStrategy: null, starchPlanDefined: false };
  const snapshot = JSON.stringify(saved);
  const draft = studioStarchDraft(saved, strategy);
  expect(draft.defaultStarchMealsPerDay).toBe(strategy === "one" ? 1 : 2);
  expect(draft.legacyPreview).toBe(true);
  expect(JSON.stringify(saved)).toBe(snapshot);
});
test("authoritative preferences win over legacy; saved counts outside UI remain intact", () => {
  for (const count of [0, 3, 8]) {
    const draft = studioStarchDraft({ defaultStarchMealsPerDay: count, starchDistributionStrategy: "evening", starchPlanDefined: true }, "one");
    expect(draft.defaultStarchMealsPerDay).toBe(count);
    expect(draft.starchDistributionStrategy).toBe("evening");
    expect(draft.legacyPreview).toBe(false);
  }
  expect(studioStarchPreferencesSchema.safeParse({ defaultStarchMealsPerDay: 0, starchDistributionStrategy: "even" }).success).toBe(false);
});
test("same calculator preview distributes 84g into three 28g meals and retains rounding remainder", () => {
  expect(starchPreviewGrams(84, 3)).toEqual([28, 28, 28]);
  expect(starchPreviewGrams(85, 3)).toEqual([28, 28, 29]);
  expect(starchPreviewGrams(0, 3)).toEqual([]);
});
