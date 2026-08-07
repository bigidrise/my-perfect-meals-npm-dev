# MPB Resolver Coverage Matrix

> **Last updated:** 2026-08-06 — Phase 2 complete
> **Purpose:** Single-source-of-truth for which child profile fields actually influence the pediatric resolver.
Use this before every resolver sprint to confirm targets and before every UI sprint to confirm collected data is being used.

---

## How to read this

- **Collected** — UI form has a control for this field
- **Stored** — field has a dedicated DB column in `child_profiles`
- **Reaches resolver** — field arrives in the generation pipeline and is read by `resolvePediatricContextFromInput` (primary path) or `buildPediatricGuidanceBlocks` (fallback path)
- **How** — the mechanism: `parentPrefs` = flows into resolver's `systemContextBlock`; `guidance block` = injected as a system prompt directive; `user message` = injected into the user-facing prompt; `condition trigger` = auto-fires a protocol

---

## Full Matrix (Phase 2)

| Profile Field | Collected | Stored Column | Reaches Resolver | How |
|---|---|---|---|---|
| Age / Stage | ✅ | `age_stage` | ✅ | `stageOverride` in resolver input |
| Allergen names | ✅ | `allergies` | ✅ | `allergyOverride` in resolver input; resolver SELECT |
| Allergy severity / EpiPen / cross-contact / clinician notes | ✅ | `allergy_details` | ✅ | guidance block (fallback) + user message (both paths) |
| Dietary preferences | ✅ | `dietary_preferences` | ✅ | resolver's own SELECT |
| Medical conditions | ✅ | `medical_conditions` | ✅ | resolver's own SELECT; condition triggers |
| Feeding concerns | ✅ | `feeding_concerns` | ✅ | resolver's own SELECT; condition triggers |
| Sensory issues | ✅ | `sensory_issues` | ✅ | resolver's own SELECT; condition triggers |
| Dislikes | ✅ | `dislikes` | ✅ | resolver's own SELECT |
| Cultural preferences | ✅ | `cultural_preferences` | ✅ | `parentPrefs.culturalCuisine` (profile default; request overrides) |
| Texture level | ✅ | `feeding_ability` (JSONB) | ✅ | `fetchChildProfileInput` → `feedingAbility.textureLevel` |
| Swallowing difficulty | ✅ | `feeding_ability` (JSONB) | ✅ | `fetchChildProfileInput` → auto-triggers dysphagia protocol |
| G-tube / feeding tube | ✅ | `feeding_ability.hasFeedingTube` *(canonical)* | ✅ | normalized into `medicalConditions`; hard stop gate |
| Choking / gagging history | ✅ | `feeding_ability` (JSONB) | ✅ | `fetchChildProfileInput` → `feedingAbility.historyOfChokingOrGagging` |
| Pediatrician oversight | ✅ | `pediatrician_oversight` | ✅ | `growth.pediatricianConcern` in `ChildProfileInput` |
| Growth concern (underweight / overweight / FTT) | ✅ | `growth_context` (TEXT) | ✅ | mapped to `growth.pediatricianConcern` → protocol triggers (underweight, obesity, FTT) |
| Sex | ✅ | `sex` | ✅ | `ChildProfileInput.sex` → growth reference guidance block |
| Height | ✅ | `height_cm` | ✅ | `ChildProfileInput.heightCm` → growth reference guidance block |
| Weight | ✅ | `weight_kg` | ✅ | `ChildProfileInput.weightKg` → growth reference guidance block |
| Medication affects appetite | ✅ | `medication_affects_appetite` | ✅ | guidance block + `ChildProfileInput.medicationAffectsAppetite` |
| Birth history | ✅ | `birth_history` | ✅ | `ChildProfileInput.birthHistory` (available to guidance blocks; no protocol consumes it yet) |
| Feeding development | ✅ | `feeding_development` | ✅ | `ChildProfileInput.feedingDevelopment` (available to guidance blocks; no protocol consumes it yet) |
| Family goals | ✅ | `family_goals` | ✅ | `parentPrefs.goals` (profile default; request overrides) |
| Kitchen equipment | ✅ | `kitchen_equipment` | ✅ | `ChildProfileInput.kitchenEquipment` → kitchen reality guidance block |
| Kitchen budget | ✅ | `kitchen_budget` | ✅ | `parentPrefs.budgetLevel` (mapped budget→budget_conscious; profile default; request overrides) |
| Kitchen time | ✅ | `kitchen_time_minutes` | ✅ | `parentPrefs.maxCookTimeMinutes` (profile default; request overrides) + guidance block |
| Kitchen skill | ✅ | `kitchen_skill` | ✅ | `ChildProfileInput.kitchenSkill` → kitchen reality guidance block |
| School safe required | ✅ | `school_safe_required` | ✅ | `parentPrefs.requiresSchoolSafe` (ORed with request flag) + school-safe guidance block |
| Emoji | ✅ | `emoji` | ❌ | Display/identity only; no resolver role |
| Date of birth | ✅ | `date_of_birth` | ❌ | Age derivation display only; `age_stage` is the resolver input |

---

## Architecture Notes

### Two resolver paths

**Primary path (resolver):** `resolvePediatricContextFromInput()` receives `parentPrefs` (school-safe, budget, cook time, cultural cuisine, goals) and builds `systemContextBlock` via the rule engine. This is the preferred path.

**Fallback path (guidance blocks):** `buildPediatricGuidanceBlocks()` is called on every request and its output goes into the legacy system prompt when the resolver fails. Phase 2 extended both paths so no context is lost on resolver failure.

### Override policy

For fields that exist on both the child profile and the request body, the rule is:
- `requiresSchoolSafe`: OR (either source activates it)
- `budgetLevel`, `maxCookTimeMinutes`, `culturalCuisine`, `goals`: request value wins if set, child profile value is the default

### Fields that flow via guidance blocks only (not into resolver `parentPrefs`)

These fields arrive at the AI via system prompt directive strings rather than typed resolver fields. They influence generation but are not part of the resolver's structured rule engine:
- `sex`, `heightCm`, `weightKg` — growth reference context (no weight-status labels)
- `allergyDetails` — extended allergy severity / EpiPen / cross-contact / clinician notes
- `medicationAffectsAppetite` — portion density note
- `kitchenEquipment`, `kitchenSkill` — kitchen reality context
- `familyGoals` — also in `parentPrefs.goals`; guidance block for fallback path

### Fields available but not yet consumed by any protocol

`birthHistory` and `feedingDevelopment` are now fetched and passed through `ChildProfileInput`. No existing protocol registry entry reads them yet. They are available for future protocol additions without any DB or loader changes.

### Fixed invariants (must not change)

- G-tube hard stop: `feeding_ability.hasFeedingTube` OR `g_tube` column → `medicalConditions` array → hard stop gate before any AI call
- PKU hard stop: fires from `medicalConditions` before AI call
- Early infant block: fires from `ageStage` before AI call
- All existing 113 scenario tests pass: hard-stop 7/7, soft 106/106
