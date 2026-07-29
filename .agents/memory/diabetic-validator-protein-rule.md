---
name: Diabetic validator protein-preservation rule
description: How the diabetic post-gen validator should handle craving+diabetes conflicts in restaurant meal generation
---

## The rule
When a diabetic user requests a specific protein (e.g. steak), the validator must NOT substitute the protein when rejecting a meal for high carb count. The carbs come from sides (potatoes, tortillas, rice, bread) — not the protein itself.

**Priority order for compliance:**
1. Keep the requested protein
2. Remove high-carb sides (potatoes, rice, pasta, tortillas, bread, croutons, sugary sauces)
3. Replace with non-starchy sides (spinach, asparagus, zucchini, broccoli, mixed greens, mushrooms)
4. Only substitute the protein if it IS the direct carb source or is medically contraindicated

**Why:** Steak has near-zero glycemic impact. The validator was replacing steak with chicken because the retry prompt had no craving context, defaulting to the AI's "safe" low-carb protein. This is medically wrong and frustrating UX.

**How to apply:**
- `generateRestaurantMealsAI`: original prompt includes diabetic-aware craving modifier when `hasDiabetesForPrompt && cravingContext` are both set
- Retry prompt: `retryProteinInstruction` is built from `cravingContext` before constructing `retryPrompt`
- File: `server/services/restaurantMealGeneratorAI.ts`

**Root cause confirmed by logs:**
- `[DIABETIC VALIDATOR] "Grilled Steak with Roasted Vegetables" failed: Carbohydrate content (35g) exceeds 15g hard limit`
- `[DIABETIC VALIDATOR] Retry succeeded — replaced with "Grilled Chicken Salad with Spinach and Avocado"`
- GPT DID generate steak correctly — the validator killed it, the retry had no craving context
