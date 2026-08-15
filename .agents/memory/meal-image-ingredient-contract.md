---
name: Meal image recipe-ingredient contract
description: Image prompts must treat dish name as label only; cache key must hash every prompt-relevant ingredient.
---

Loaded dish names (Niçoise, Cobb, Carbonara…) make DALL-E add traditional ingredients the recipe never included. The fix: prompt demotes the dish name to `DISPLAY NAME:` label and derives a REQUIRED/UNAUTHORIZED ingredient contract from the full canonical recipe list at generation time.

**Why:** the model's learned dish associations outrank an ingredient hint unless the prompt explicitly forbids the traditional composition.

**How to apply:**
- Never cap the allow-list — a partial list makes real recipe ingredients "unauthorized" under the deny clause.
- The image cache key must hash EVERY normalized ingredient, not a prefix — otherwise recipes differing in later ingredients share an image generated under a different contract. Bump the CACHE_VERSION tag in mealImageGenerator whenever prompt format changes.
- Empty ingredient lists get no protection (legacy name-driven prompt); generic image endpoints that forward client-supplied ingredients are the remaining gap.
