---
name: Contextual food reasoning limits
description: Why a model's culinary category cannot be the sole authority for small flavorings or material Low Carb sources
---

When evaluating a recipe's carbohydrate-source relevance, use established food roles and measured amounts before calling a model. Ask the model only about remaining source identities, and treat its structured answer as contextual evidence, not a nutrition label or a safety waiver.

**Why:** In anonymous live probes of the same cheesecake-shaped recipe, the model variably called a ground nut ingredient a starch and left a tiny flavoring unresolved. Merely rewriting a prompt or choosing a larger model did not consistently settle the full recipe. A bounded role-and-quantity rule for small flavorings supplied the missing distinction without an ingredient-name exception. Genuinely material uncertain sources still require stronger evidence or repair.

**How to apply:** Keep hard allergy, avoidance, clinical, and known-sugar checks independent. Do not promote unspecified commercial composition or a recipe-level macro estimate into positive day-level allocation proof. Expect some generated desserts with unknown sweeteners to remain blocked until supported evidence exists.