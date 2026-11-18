---
name: Measurement preference authority
description: Country-based Auto and manual measurement intent, separate from language and canonical data.
---

Automatic measurements follow the user's selected country: United States defaults
to U.S. customary; metric countries default to metric. Users can manually select
U.S. customary or Metric regardless of country. Preserve the selected preference
across sessions and devices.

**Why:** The founder requested these product behaviors independently of the
English/Spanish localization work.

**How to apply:** Reuse existing country, measurement-preference and conversion
systems rather than adding another engine or duplicate preference. Measurement
preferences must remain completely independent of English/Spanish selection.

Apply the resolved system consistently across Macro Calculator, Biometrics,
recipes, meal builders, shopping, Grocery Coach, Product Scan and relevant
clinical/professional screens. Preserve original product-label quantities and
units where needed for accurate interpretation.

**Why:** The founder requires consistent presentation without changing the
meaning of product evidence or clinical/nutrition data.

**How to apply:** Convert display only; preserve canonical nutrition data,
calculations, thresholds, ingredient identity and stored values. Keep
implementation Development-only unless publication is separately authorized.
