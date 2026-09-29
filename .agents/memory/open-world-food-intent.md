---
name: Open-world food intent
description: Governs how unfamiliar natural-language food requests enter Create a Dish without weakening safety.
---

**Rule:** The governed culinary catalog accelerates known normalization but never decides whether a food exists. Catalog misses use a schema-bound semantic interpreter that may classify food intent but cannot create safety evidence or grant permission.

**Why:** Ordinary composed and regional dishes were rejected before AI or meal governance ran solely because their names were absent from a finite alias list.

**How to apply:** Preserve the original wording. Known catalog matches stay deterministic. Only high-confidence semantic food intent becomes recognized; medium/low confidence becomes clarification, while non-food becomes unsupported with low ingredient-recognition confidence. Catalog absence must not remove the preparation experience: semantic choices use server-created preference IDs and remain creative intent, never governed evidence. Non-food and adversarial input stays blocked. Every accepted request still passes the complete dietary, allergy, clinical, Human Food, dish-identity, and final-result validation stack.

**Rule:** Inferred cuisine is a soft association, not a user-selected cuisine instruction. A prepared dish name establishes dish identity, not evidence that an ingredient with that name belongs in the recipe.

**Why:** Generic requests such as gumbo can otherwise be rejected for not spelling out a model-inferred cuisine, or every generated recipe can be rejected for omitting a nonexistent ingredient named after the dish.

**How to apply:** Carry explicit versus inferred provenance through interpretation and handoffs. Only verified user text or an explicit selection may become a hard cuisine instruction. For prepared dishes, evaluate real structured composition and form without inferring ingredient presence or safety from the title alone.