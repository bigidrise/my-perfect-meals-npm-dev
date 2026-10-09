---
name: Recipe carbohydrate categories
description: Preserve genuine recipe carbohydrate source estimates without conflating them with dietary fiber or changing legacy adapters.
---

Fibrous carbohydrate source grams and dietary fiber nutrient grams are separate concepts. Preserve explicitly estimated recipe starchy/fibrous values through saving and logging; missing estimates remain unknown, not fabricated zero.

**Why:** Legacy shared nutrition documentation equated fibrous carbs with dietary fiber, while Biometrics accepts explicit carbohydrate source categories. That mismatch led the common logging adapter to discard a real recipe split.

**How to apply:** Follow the actual consuming contract when connecting a food card to Biometrics. Do not replace legacy dietary-fiber fallback policy in unrelated adapters as part of a card continuity fix. Preserve total carbohydrates even when some carbohydrate remains unclassified.

Recipe-total Grocery Coach nutrition must be converted to one serving before both personal-budget and GLP-1 comparisons, including retries. Display normalization alone is not sufficient.

**Why:** Explicit total-recipe generation exposed a comparison against personal remaining allowances that could reject a compliant multi-serving meal with HTTP 422.

**How to apply:** Keep saved/returned nutrition as recipe totals, normalize only at personal validation boundaries, and retain privacy-limited failed-check codes in logs.
