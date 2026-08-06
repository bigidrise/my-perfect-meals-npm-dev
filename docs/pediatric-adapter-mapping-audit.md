# Pediatric Resolver Adapter — Mapping Audit

> Every adapter-generated rule, exclusion, protocol, and language flag traced back to its production source.  
> Generated as part of Task #432 — Resolver Inspector review.

---

## How to read this document

| Column | Meaning |
|---|---|
| **Adapter output** | What `resolvePediatricContext` emits in the `PediatricContext` |
| **Production source** | The registry entry or clinical authority backing it |
| **Status** | ✅ Backed by production registry · ⚠️ Clinically grounded but not yet in registry · 🔴 Needs registry entry |

---

## 1. Stage-safety rules (MPB-SXXX)

These are the 23 RULE-XXXX entries from `PEDIATRIC_RULE_REGISTRY`, translated to MPB-SXXX IDs.  
Every single one traces back to a production registry entry with a named clinical source.

| Adapter rule ID | Adapter action | RULE-XXXX | Clinical source |
|---|---|---|---|
| `MPB-S001` | EXCLUDE honey | RULE-0001 | AAP 2023; CDC Botulism Guidelines |
| `MPB-S002` | No cow's milk as main drink | RULE-0002 | AAP Healthy Children; USDA Birth–24mo 2020 |
| `MPB-S003` | EXCLUDE all juice | RULE-0003 | AAP Clinical Report on Fruit Juice 2017 |
| `MPB-S004` | Purée-only texture | RULE-0004 | AAP Starting Solid Foods; WHO CF 2023 |
| `MPB-S005` | EXCLUDE whole nuts | RULE-0005 | AAP Choking Prevention; FDA |
| `MPB-S006` | Grapes quartered | RULE-0006 | AAP Choking Prevention; USDA MyPlate |
| `MPB-S007` | Cherry tomatoes halved | RULE-0007 | AAP Choking Prevention 2022 |
| `MPB-S008` | No raw hard vegetables (beginning_foods) | RULE-0008 | AAP Starting Solid Foods; WHO CF |
| `MPB-S008` | Grate/steam/chop carrots etc (young_toddler) | RULE-0009 | AAP Choking Prevention |
| `MPB-S009` | EXCLUDE popcorn | RULE-0010 | AAP Choking Prevention; FDA |
| `MPB-S010` | EXCLUDE hard candy | RULE-0011 | AAP Choking Prevention |
| `MPB-S011` | Meat finely chopped/shredded | RULE-0014 | AAP Choking Prevention |
| `MPB-S011` | Meat finely puréed (beginning_foods) | RULE-0013 | AAP Starting Solid Foods; WHO CF |
| `MPB-S012` | EXCLUDE mercury fish | RULE-0012 | FDA/EPA Fish Advice 2024; AAP Env Health |
| `MPB-S013` | Iron-rich foods priority | RULE-0019 | AAP Iron Supplementation 2020 |
| `MPB-S014` | LEAP early allergen introduction | RULE-0020 | AAP LEAP Study Guidance 2017; NIAID |
| `MPB-S015` | Never suggest formula modifications | RULE-0017 | FDA Consumer Alert 2023; AAP |
| `MPB-S016` | Limit added sugar | RULE-0015 | AAP Sugar Rec 2016; USDA 2020–2025 |
| `MPB-S017` | Limit sodium | RULE-0016 | USDA 2020–2025; AAP Cardiovascular Health |
| `MPB-S018` | Age-appropriate serving sizes | RULE-0021 | USDA MyPlate for Kids; AAP Nutrition |
| `MPB-S019` | Clinician texture level (IDDSI) | RULE-0022 | ASHA Dysphagia Guidelines; IDDSI 2019 |
| `MPB-S020` | Choking/gagging texture vigilance | RULE-0023 | AAP Choking Prevention; IDDSI |
| `MPB-GATE001` | BLOCK — early infant, no solid food | RULE-0018 | AAP; WHO Exclusive Breastfeeding |

**Result: 23/23 stage-safety rule mappings are ✅ backed by `PEDIATRIC_RULE_REGISTRY` with named clinical sources.**

---

## 2. Hard-stop gates

| Adapter rule ID | Condition | Production source |
|---|---|---|
| `MPB-GATE001` | `early_infant` stage | ✅ RULE-0018 — AAP; WHO |
| `MPB-GATE002` | `pku` condition | ⚠️ Not in PROTOCOL_REGISTRY yet. Clinical authority: ACMG PKU Guidelines; ESPKU. Requires metabolic dietitian. **Recommend adding `pku` to PROTOCOL_REGISTRY.** |
| `MPB-GATE003` | `g_tube` condition | ⚠️ Not in PROTOCOL_REGISTRY yet. Clinical authority: ASPEN Enteral Nutrition Guidelines; ASHA. **Recommend adding `g_tube` to PROTOCOL_REGISTRY.** |

---

## 3. Medical condition protocols (MPB-MEDXXX)

| Adapter rule ID | Condition | PROTOCOL_REGISTRY entry | Status |
|---|---|---|---|
| `MPB-MED003` | `type1_diabetes` | COND-0008 | ✅ Backed |
| `MPB-MED004` | `type2_diabetes` | COND-0009 | ✅ Backed |
| `MPB-MED005` | `iron_deficiency_anemia` | COND-0005 (`iron_deficiency`) | ✅ Backed |
| `MPB-MED006` | `failure_to_thrive` | COND-0004 | ✅ Backed |
| `MPB-MED007` | `pediatric_obesity` | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (AAP Bright Futures; USPSTF Obesity Screening 2017) but adapter is sole source. **Action: add `pediatric_obesity` to PROTOCOL_REGISTRY.** |
| `MPB-MED008` | `adhd` | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (AAP ADHD Clinical Guidelines 2019; structured meal timing evidence) but adapter is sole source. **Action: add `adhd` to PROTOCOL_REGISTRY.** |
| `MPB-MED009` | `autism_spectrum` | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (AAP Autism Nutrition Report; ARFID overlap literature) but adapter is sole source. **Action: add `autism_spectrum` to PROTOCOL_REGISTRY.** |
| `MPB-MED010` | `crohns_disease` (flare) | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (ECCO/ESPGHAN Pediatric IBD Guidelines) but adapter is sole source. **Action: add `crohns_disease` to PROTOCOL_REGISTRY.** |
| `MPB-MED011` | `crohns_disease` (remission) | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Same as above. |
| `MPB-MED012` | `ckd` | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (KDOQI Pediatric Nutrition Guidelines) but adapter is sole source. **Action: add `ckd` to PROTOCOL_REGISTRY.** |
| `MPB-MED013` | `cystic_fibrosis` | ❌ Not in PROTOCOL_REGISTRY | ⚠️ Clinically grounded (CFF Nutrition Guidelines; ECFS Standards of Care) but adapter is sole source. **Action: add `cystic_fibrosis` to PROTOCOL_REGISTRY.** |
| `MPB-MED014` | `celiac_disease` | COND-0001 | ✅ Backed |

**Result: 5/13 condition rules backed by PROTOCOL_REGISTRY. 8 conditions have clinically grounded adapter logic that must migrate into PROTOCOL_REGISTRY before this is a permanent architecture.**

---

## 4. Allergen exclusion expansion

The adapter's `ALLERGEN_EXCLUSION_TERMS` expands each allergen to its hidden/derivative ingredient forms.

| Allergen | Example adapter exclusions | Production registry | Status |
|---|---|---|---|
| `peanut` | peanut sauce, satay, groundnut, arachis oil | `ALLERGEN_HIDDEN_SOURCES["peanut"]`: mixed nut oils, peanut flour, some Asian sauces (satay, hoisin) | ✅ Aligned — adapter is a superset |
| `tree_nuts` | walnut, cashew, almond, pesto, macadamia | `ALLERGEN_HIDDEN_SOURCES["tree_nuts"]`: almond flour, marzipan, praline, pesto | ✅ Aligned — adapter is a superset |
| `milk` | casein, whey, butter, cheese, cream, yogurt | `ALLERGEN_HIDDEN_SOURCES["milk"]`: casein, whey, lactalbumin, ghee, some margarines | ✅ Aligned — adapter is a superset |
| `egg` | albumin, mayonnaise, egg white/yolk | `ALLERGEN_HIDDEN_SOURCES["egg"]`: mayo, bread glazes, meringue, egg wash | ✅ Aligned |
| `wheat` | gluten, barley, rye, flour, bread, **flour tortillas**, soy sauce | `ALLERGEN_HIDDEN_SOURCES["wheat"]`: soy sauce, seitan, some oats, some condiments | ✅ Aligned — adapter is a superset. `flour tortillas` is a correct extension. |
| `soy` | tofu, edamame, tempeh, miso, soy milk | `ALLERGEN_HIDDEN_SOURCES["soy"]`: tofu, edamame, miso, tempeh, some Asian sauces | ✅ Aligned |
| `sesame` | tahini, sesame oil, sesame seeds | `ALLERGEN_HIDDEN_SOURCES["sesame"]`: tahini, hummus, some bread toppings | ✅ Aligned |
| `fish` | tuna, salmon, cod, anchovy, sardine | `ALLERGEN_HIDDEN_SOURCES["fish"]`: Worcestershire sauce, Caesar dressing, fish sauces | ✅ Aligned |
| `shellfish` | shrimp, lobster, crab, clam, oyster | `ALLERGEN_HIDDEN_SOURCES["shellfish"]`: some Asian sauces, oyster sauce, shrimp paste | ✅ Aligned |

**Result: All allergen expansions are ✅ aligned with or a clinically sound superset of `ALLERGEN_HIDDEN_SOURCES`.**

---

## 5. Allergen-severity protocols

| Adapter protocol | Maps to | Production source |
|---|---|---|
| `confirmed-allergy-exclusion` | `resolveAllergenRemovals` action `HARD_STOP` | ✅ Production resolver — `AllergenRemoval.action = "HARD_STOP"` for confirmed/clinician_elimination |
| `suspected-allergen-exclusion` | `resolveAllergenRemovals` action `SOFT_BLOCK` | ✅ Production resolver |
| `intolerance-exclusion` | `resolveAllergenRemovals` action `EXCLUDE` | ✅ Production resolver |
| `preference-exclusion` | `resolveAllergenRemovals` action `PREFER_AVOID` | ✅ Production resolver |
| `allergen-alert-required` | `AllergenRemoval.crossContactWarning` | ✅ Production resolver — `crossContactWarning = true` for HARD_STOP/SOFT_BLOCK |
| `multi-allergen-compound-check` | Multiple confirmed allergens | ✅ Production resolver fires `resolveAllergenRemovals` for each allergen |
| `epinephrine-preparation-reminder` | `AllergenRemoval.emergencyMedication = true` | ✅ Production resolver — `emergencyMedication` field on allergen |
| `top8-maximum-exclusion` | `confirmedAllergies ≥ 4` (counting celiac as +1) | ⚠️ Adapter-derived threshold; not a named entity in production resolver. Grounded in FDA Top-8 Major Allergens framework. **Recommend adding as a named rule to PROTOCOL_REGISTRY or rule registry.** |

---

## 6. School / context protocols (MPB-CTX)

| Adapter rule ID | Adapter protocols | Production source | Status |
|---|---|---|---|
| `MPB-CTX001` | `school-safe-protocol`, `packable-lunch` | `SchoolRules.requiresSchoolSafe` → `schoolSafeConstraints`; `SchoolRules.requiresPackable` → `packableConstraints` | ✅ Production resolver has `schoolRules` field — adapter exposes as MPB-CTX001 |
| `MPB-CTX002` | `pantry-only-constraint`, `pantry-ingredient-restriction` | `parentPrefs` / `pantryIngredients` input field | ⚠️ Adapter-only; production resolver has no pantry-only mode yet. **Recommend adding pantry mode to production resolver.** |
| `MPB-CTX003` | `party-group-scale`, `allergen-alert-required` | `input.servings` + allergen rules | ⚠️ Adapter-only; production resolver uses `input.servings` but has no birthday-party context logic. **Recommend adding context mode to production resolver.** |
| `nut-free-school-zone` | Added when nut allergy + school/requiresSchoolSafe | `schoolRules.schoolSafeConstraints` includes "No tree nuts in any form" | ✅ Semantically backed — adapter exposes as a named protocol |

---

## 7. Behavioral flag rules (MPB-BEH)

| Adapter rule ID | Flag | BEHAVIOR_REGISTRY entry | Status |
|---|---|---|---|
| `MPB-BEH001` | `picky_eater` | BEH-0001 triggers: `picky_eater`, `neophobia`, `fear_of_new_foods` | ✅ Backed |
| `MPB-BEH002` | `food_neophobia` | BEH-0001 — same triggers as above | ✅ Backed (neophobia IS a BEH-0001 trigger) |
| `MPB-BEH002` | `food_exposure_tracking` | BEH-0001 adjacent — exposure tracking is the clinical intervention for neophobia | ⚠️ Not a named trigger in BEHAVIOR_REGISTRY. Clinically grounded (Satter Division of Responsibility; ARFID exposure hierarchy) but adapter is sole source. **Recommend adding `food_exposure_tracking` as a trigger in BEH-0001 or a new BEH-0005 entry.** |
| `MPB-BEH003` | `sensory_integration_needs` | BEH-0002 triggers: `sensory_processing`, `texture_sensitivity` | ✅ Backed |
| `MPB-BEH004` | `mealtime_anxiety` | BEH-0004 triggers: `appetite_variability`, `small_appetite` | ⚠️ Partial — BEH-0004 is calorie-dense strategy, not specifically mealtime anxiety. **Recommend adding `mealtime_anxiety` as BEH-0005 in BEHAVIOR_REGISTRY.** |
| `MPB-BEH005` | `limited_food_repertoire` | BEH-0003 triggers: `food_jags`, `only_eats_few_foods` | ✅ Backed — limited repertoire = food jag/restricted eating |
| `MPB-BEH005` | `sensory_texture_restriction` | BEH-0002 triggers: `texture_sensitivity`, `mixed_texture_aversion` | ✅ Backed — texture restriction IS a BEH-0002/BEH-0003 pattern |
| `MPB-BEH005` | `low_food_acceptance` | BEH-0003 | ✅ Backed |

---

## 8. Condition language flags

Language flags are not part of any production registry — they are an adapter-layer safety net that prevents the AI prompt from using clinically inappropriate language (weight-loss framing for FTT, insulin terminology for children, etc.).

| Flag set | Source | Grounding |
|---|---|---|
| `type1_diabetes` flags ("GLP-1", "insulin", "semaglutide", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: GLP-1 agonists and semaglutide are not appropriate for children with T1D without specialist oversight (Endocrine Society Guidelines). **These belong in a Language Safety Registry that does not yet exist.** |
| `failure_to_thrive` flags ("low calorie", "diet", "lose weight", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: caloric restriction language is actively harmful for FTT (COND-0004 hardLimit: "Do NOT reduce calories"). **Should be derived from COND-0004.hardLimits — not duplicated in the adapter.** |
| `pediatric_obesity` flags ("obese", "fat", "calorie deficit", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: AAP Bright Futures weight stigma guidance; AAP 2023 Obesity CPG. **Should be derived from PROTOCOL_REGISTRY once `pediatric_obesity` is added.** |
| `autism_spectrum` flags ("ABA", "disguise food", "trick", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: AAP Autism Toolkit; OT/SLP feeding therapy guidance. |
| `adhd` flags ("Ritalin", "Adderall", "behavior modification", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: AAP ADHD CPG 2019; stimulant medication guidance. |
| `crohns_disease` flags ("immunosuppressant", "biologics", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: ECCO/ESPGHAN IBD Guidelines. |
| `ckd` flags ("dialysis", "kidney transplant", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: KDOQI Guidelines. |
| `cystic_fibrosis` flags ("CFTR modulator", "enzyme", …) | Adapter `CONDITION_LANGUAGE_FLAGS` | ⚠️ Adapter-only. Clinically grounded: CFF Nutrition Guidelines. |

**Result: Language flag logic is entirely adapter-invented but clinically grounded. It should migrate into a Language Safety Registry once the system matures.**

---

## 9. Family meal / intersection logic

| Adapter behavior | Production source | Status |
|---|---|---|
| `most-restrictive-governs` — most allergenic/restrictive rules applied to shared meal | `computeFamilyIntersection` in production resolver | ✅ Backed — production resolver has this function |
| `family-meal-intersection` protocol | `resolveFamily` function in production resolver | ✅ Backed — production resolver has a `resolveFamily` path |
| `MPB-FAMILY-INTERSECTION` rule | `isFamilyMealMode = true` in production resolver | ✅ Backed |
| Language flag propagation from family members | ❌ Not in production resolver | ⚠️ Adapter-only — production `resolveFamily` merges allergens and protocols but not language flags. **Recommend adding language flag propagation to `resolveFamily`.** |
| Wellness rule from family member conditions | ❌ Not in production resolver | ⚠️ Adapter-only. **Recommend adding to `resolveFamily`.** |
| `individual-portion-adaptation` (FTT + obesity co-exist) | ❌ Not in production resolver | ⚠️ Adapter-only. Sound clinical logic (each child gets density-adapted portions). **Recommend adding conflict resolution case to `detectAndResolveConflicts`.** |

---

## 10. Summary — what must move into the production registry

The following adapter-invented items are clinically grounded but not yet backed by a production registry entry. They must migrate before the adapter can be retired.

### Priority 1 — PROTOCOL_REGISTRY additions (blocks AI from generating unsafe content)

| Condition | Recommended COND-ID |
|---|---|
| `pediatric_obesity` | COND-0014 |
| `adhd` | COND-0015 |
| `autism_spectrum` | COND-0016 |
| `crohns_disease` (flare + remission) | COND-0017 |
| `ckd` | COND-0018 |
| `cystic_fibrosis` | COND-0019 |
| `pku` (hard stop + metabolic dietitian note) | COND-0020 |
| `g_tube` (hard stop + enteral nutrition) | COND-0021 |

### Priority 2 — RULE_REGISTRY additions

| Logic | Recommended RULE-ID |
|---|---|
| Top-8 compound allergen review threshold | RULE-0024 |
| Wellness framing mandate (weight-sensitive conditions) | RULE-0025 |

### Priority 3 — BEHAVIOR_REGISTRY additions

| Trigger | Recommended BEH-ID |
|---|---|
| `food_exposure_tracking` | BEH-0005 |
| `mealtime_anxiety` | BEH-0006 |

### Priority 4 — Language Safety Registry (new registry)

Create a `LANGUAGE_SAFETY_REGISTRY` that maps `conditionId → forbidden_terms[]` and derive the adapter's `CONDITION_LANGUAGE_FLAGS` from it, so there is a single source of truth.

---

## Verdict

| Category | Items | Backed | Adapter-only but grounded | Needs action |
|---|---|---|---|---|
| Stage-safety rules (MPB-SXXX) | 23 | 23 ✅ | 0 | 0 |
| Hard-stop gates | 3 | 1 ✅ | 2 ⚠️ | Add PKU + G-tube to PROTOCOL_REGISTRY |
| Medical condition protocols | 13 | 5 ✅ | 8 ⚠️ | Add 8 conditions to PROTOCOL_REGISTRY |
| Allergen expansions | 9 | 9 ✅ | 0 | 0 |
| Allergen-severity protocols | 8 | 7 ✅ | 1 ⚠️ | Add top8 threshold as named rule |
| Context protocols (school/party/pantry) | 4 | 2 ✅ | 2 ⚠️ | Add pantry + party modes to production |
| Behavioral flags | 8 | 6 ✅ | 2 ⚠️ | Add 2 BEH entries |
| Condition language flags | 8 sets | 0 — no registry | 8 ⚠️ | Create Language Safety Registry |
| Family meal intersection logic | 6 behaviors | 3 ✅ | 3 ⚠️ | Promote 3 behaviors to resolveFamily |

**The adapter is not inventing clinical reasoning.** Every adapter-only item is grounded in a named clinical guideline. The audit surfaces exactly which items need to migrate from the adapter into the production resolver before the adapter can be removed.
