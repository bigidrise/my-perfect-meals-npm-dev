---
name: Snack occasion semantics
description: Product doctrine for snack and dessert identity across recommendation and generation surfaces.
---

Treat snack as an eating occasion, not a narrow nutrition category. Dessert is one legitimate food family that may occupy that occasion alongside savory, fruit-based, dairy or dairy-alternative, grain-based, and other snack foods. Do not force a dessert quota or a sweet/savory rotation.

Preserve recognizable requested food identity through contextual adaptation. If a protected identity cannot be preserved safely, fail explicitly rather than returning an unrelated generic snack.

Do not equate healthier with smaller. Serving amount is one possible contextual variable, never the default solution. Universal calorie ranges, protein/fiber emphasis, “empty carbs” framing, or token portions must not replace person-specific Human Food Context and clinical rules.

**Why:** Blanket “healthy snack alternative” assumptions redirected legitimate dessert requests and treated arbitrary shrinking as the default adaptation even when no person-specific constraint required it.

**How to apply:** Use shared optional food-identity facets for personalization and variety only. Keep allergy, diet, medical, glucose, GLP-1, pregnancy, performance, household isolation, and final validation authoritative.

For My Perfect Menu, the user confirmed an explicit Food Snack / Dessert Snack choice before creating three snack ideas. Reuse the shared Craving Menu culinary concept engine and food/dessert identity rules, but keep My Perfect Menu's own selection, Builder context, persistence, Snack Creator completion, and meal-card path. The explicit identity must persist through Try 3 More, restoration, selection, and final-recipe validation; do not route completion through Craving Creator.

**Why:** The ordinary snack occasion does not enforce dessert identity, and a correct dessert concept can still become an unrelated food at recipe completion if its identity is not carried through.

**How to apply:** Treat the user's choice as authoritative request intent, separate from sweet/savory taste. Preserve the current safety checks and reject a finished recipe whose food identity no longer matches the selected concept.

My Perfect Menu's slot guidance reflects its current completion flow, not a nutritional prohibition on eating snacks or desserts as meals. Use the explicitly selected category, never the recipe name; unknown categories retain existing behavior. Keep unsupported rows visible and give guidance before generation.

**Why:** The user explicitly separated this small destination usability correction from food autonomy and nutrition enforcement. Supporting snacks in other destinations later is an intentional product change, not a reason to invent new food restrictions now.

**How to apply:** Keep destination guidance in the UI. Do not alter generation, dietary rules, or assignment APIs to implement the highlighting.