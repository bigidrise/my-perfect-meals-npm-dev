# GLP-1 cheese: portion-aware adaptation

## Authority and boundaries

Cheese recognition is culinary classification, never clinical clearance. A
cheese name, full-fat/reduced-fat qualifier, brand or scan verdict cannot prove
that a product or meal fits a person. There is no universal cheese amount:
three ounces was an example, not a prescribed serving.

Generation must preserve the requested dish, choose a cheese type and an exact
positive measured amount, and evaluate whole-meal nutrition per actual serving.
Existing patient-specific fat ceilings, protein requirements, allergies,
dietary exclusions, explicit avoidances, physician restrictions and PIN scope
remain authoritative. No thresholds or activation rules changed.

The shared interpretation contract covers direct Builder prompts, stacked
GLP-1 prompts, recommendation guidance used by Grocery Coach, both human
Product Scan prompt families, and shopping/catalog explanations. English and
Spanish cheese recognition take the same measured-quantity path. Existing
language instructions own generated explanations; safe verification-failure
messages support English and Spanish without exposing exception details.

## Evidence, portions, and shopping

- Recipe ingredient quantities are totals; normalize meal nutrition by the
  requested serving count exactly once.
- Compare exact-product facts on the same declared nutrition basis.
- Label serving size is not automatically the amount in a recipe or eaten.
  Use a supported dimensional conversion; do not assume a slice's weight or
  infer cheese volume density.
- Missing intended amount, label facts, formulation evidence or current
  authority remains unverified. A useful comparison is not compatibility.
- Current product-evidence reducers still block known conflicts and withhold
  unresolved compatibility, including unresolved GLP-1 packaged-product policy.
  This change does not supply that missing clinical authority.
- Shopping tips do not mutate recipe amounts, qualifiers, saved identity,
  original evidence, source provenance or meal-to-list repeat protection.
- An optional ingredient canonical metadata object is descriptive only; this
  change does not activate a canonical ingredient engine or replace macros.

## Future From Scratch consumer contract

Do not build or activate From Scratch under this correction. When separately
approved, it should consume this same cheese guidance and the finalized
recipe's typed ingredient amounts, units, serving count, product evidence and
provenance. Its save/retrieval and shopping handoffs must preserve those values.
It must run the same final safety checks; cheese recognition is not a waiver.

## Existing non-cheese restrictions: inventory for separate review

These remain unchanged. Listing them does not establish that each categorical
block is clinically justified, nor authorize removing it.

| Existing category | Current enforcement | Separate review question |
| --- | --- | --- |
| Mayonnaise, aioli and named rich dressings/sauces | Ingredient-name blocks; includes blue-cheese dressing | Which are genuine individual restrictions versus portion/composition guidance? |
| Fried/breaded foods and preparations | Ingredient and instruction-text blocks | How should actual preparation, negation, and language be distinguished? |
| Named fatty/processed meats | Ingredient-name blocks | Which choices can be adapted without violating independent restrictions? |
| Raw cruciferous vegetables | Ingredient-name blocks | Which symptom/tolerance contexts justify avoiding a specific form? |
| Beans and lentils | Ingredient-name blocks, although prompt discusses large amounts | How should preparation, portion and individual tolerance determine advice? |
| Dried fruit, fruit juice and concentrated fruit products | Ingredient-name blocks | Distinguish quantity, preparation and independent glucose/dietary restrictions. |
| Carbonated beverages | Ingredient-name blocks | Review current symptom-specific authority without changing beverage safeguards here. |
| Oversized/thick beverages and selected snack types | Ingredient/snack-term blocks | Review actual volume, ingredients and tolerance rather than name alone. |
| Broad categories such as greasy or ultra-processed foods | Category/prompt guidance | Reconcile with the existing Whole-Food policy and individually applicable limits. |

Other protocols' dairy/cheese restrictions are independent and untouched.

## Verification scope

Use offline model fixtures for real pipeline normalization, bounded retry and
final-validation behavior; pure fixtures for patient ceilings, serving counts,
measurement aliases and product uncertainty. No fixture establishes clinical
validation or proves a live model will always choose an acceptable recipe.
No shared-database writes, paid-provider calls, Production changes, publishing
or future-workflow activation are authorized by these tests.
