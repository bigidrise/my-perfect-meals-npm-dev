---
name: Contextual food reasoning limits
description: Why a model's culinary category cannot be the sole authority for small flavorings or material Low Carb sources
---

When evaluating a recipe's carbohydrate-source relevance, use established food roles and measured amounts before calling a model. Ask the model only about remaining source identities, and treat its structured answer as contextual evidence, not a nutrition label or a safety waiver.

**Why:** In anonymous live probes of the same cheesecake-shaped recipe, the model variably called a ground nut ingredient a starch and left a tiny flavoring unresolved. Merely rewriting a prompt or choosing a larger model did not consistently settle the full recipe. A bounded role-and-quantity rule for small flavorings supplied the missing distinction without an ingredient-name exception. Genuinely material uncertain sources still require stronger evidence or repair.

**How to apply:** Keep hard allergy, avoidance, clinical, and known-sugar checks independent. Do not promote unspecified commercial composition or a recipe-level macro estimate into positive day-level allocation proof. Expect some generated desserts with unknown sweeteners to remain blocked until supported evidence exists.

Itemized model nutrition estimates are not guaranteed to cover every ingredient, even for ordinary quantified flavorings. Preserve an unknown nutrient as a failed estimate; repeated prompting or zero-filling is not stronger evidence.

**Why:** Live dessert estimates succeeded at smaller yields but left a quantified lemon-zest calorie value unknown at a larger yield. Chemical starch terminology also elicited unknown values where the application's food-source carbohydrate category was intended.

**How to apply:** Distinguish the application's starchy-carbohydrate source category from laboratory chemical starch. For reliable recovery, seek supported ingredient-composition and quantity evidence rather than forcing complete-looking numbers. Do not claim deterministic tests establish live model reliability.