# My Perfect Beginning — Architecture Specification

**Status:** Pre-build specification. No code until this document is reviewed and approved.  
**Feature name:** My Perfect Beginning  
**API namespace:** `/api/my-perfect-beginning/`  
**Core principle:** Improve the food without stealing childhood from the child.

---

## 1. What This Is Not

- Not "Create a Dish with an age dropdown"
- Not a clone of the adult Macro Calculator
- Not a diagnostic tool
- Not a disease-treatment engine
- Not connected to the parent user's macros, GLP-1 status, diabetes settings, or personal health profile
- Not a tool that labels children by body type

The child is a **separate nutrition target** managed by the parent account. Every generation decision is resolved against the child's profile, never the parent's.

---

## 2. ChildNutritionProfile — Complete Data Contract

```typescript
interface ChildNutritionProfile {
  // ── Identity ──────────────────────────────────────────────────────────
  id: string;                         // UUID, generated on creation
  parentUserId: string;               // FK → users.id (the authenticated parent)
  nickname: string;                   // "Emma", "Jackson", "Baby"
  dateOfBirth: string;                // ISO date, YYYY-MM-DD
  currentAgeMonths: number;           // Computed at request time, not stored
  sex: "male" | "female" | "not_specified";  // Used only for growth reference charts
  prematureBirth: boolean;
  gestationalAgeAtBirthWeeks?: number; // Required when prematureBirth = true
  correctedAgeMonths?: number;         // Computed when prematureBirth = true

  // ── Developmental Stage ───────────────────────────────────────────────
  // Confirmed by parent, not auto-assigned from DOB alone
  developmentalStage: DevelopmentalStage;

  // ── Feeding Ability & Safety ──────────────────────────────────────────
  feedingAbility: FeedingAbility;

  // ── Growth ────────────────────────────────────────────────────────────
  growth?: GrowthRecord;

  // ── Activity & Routine ────────────────────────────────────────────────
  activity: ActivityProfile;

  // ── Food Relationship & Eating Behavior ───────────────────────────────
  eatingBehavior: EatingBehaviorProfile;

  // ── Allergies & Intolerances ──────────────────────────────────────────
  allergyProfile: AllergyProfile;

  // ── Household Dietary Pattern ─────────────────────────────────────────
  householdDiet: HouseholdDietProfile;

  // ── Nutrition-Support Goals ───────────────────────────────────────────
  nutritionGoals: NutritionSupportGoal[];

  // ── Diagnosed Medical Conditions (Level C) ───────────────────────────
  diagnosedConditions: DiagnosedCondition[];

  // ── Clinician Instructions ────────────────────────────────────────────
  clinicianInstructions?: string;      // Free text, clinician-provided
  clinicianApprovedProtocols: string[]; // IDs from the Level C protocol registry

  // ── Metadata ──────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

---

## 3. Developmental Stage Registry

The stage drives texture safety, portion size, ingredient restrictions, and prompt instructions. Age ranges are approximate — developmental readiness overrides calendar age.

| Stage ID | Label | Age Range | Recipe Generation |
|---|---|---|---|
| `early_infant` | Early Infant | Birth–~5 months | **Blocked** — education only |
| `beginning_foods` | Beginning Foods | ~6–11 months | Allowed with strict texture/safety rules |
| `young_toddler` | Young Toddler | 12–23 months | Allowed with choking and texture rules |
| `toddler` | Toddler | 2–3 years | Allowed with choking rules |
| `preschool` | Preschool | 4–5 years | Allowed |
| `early_school_age` | Early School Age | 6–8 years | Allowed |
| `growing_child` | Growing Child | 9–12 years | Allowed |

**Stage confirmation rule:** The app derives a *suggested* stage from DOB but always asks the parent to confirm. A premature infant's corrected age governs the stage suggestion, not chronological age.

**Early Infant gate:** If `developmentalStage === "early_infant"`, the recipe generator must not run. The interface shows feeding education, formula/breastfeeding guidance, feeding-cue information, and a list of questions to bring to the pediatrician. No recipe is returned under any condition for this stage.

---

## 4. Supporting Type Definitions

### 4a. FeedingAbility

```typescript
interface FeedingAbility {
  textureLevel:
    | "breast_milk_or_formula_only"   // early_infant — blocks generation
    | "puree_only"
    | "mashed_soft"
    | "soft_pieces"
    | "chopped_family_foods"
    | "regular_family_foods";

  canSitUprightIndependently: boolean;
  canBringFoodToMouth: boolean;
  chewingAbility: "none" | "gumming" | "emerging" | "age_appropriate";
  swallowingDifficulty: boolean;    // true → clinician-defined texture only; blocks AI texture recommendations
  historyOfChokingOrGagging: boolean;
  hasFeedingTube: boolean;
  receivingFeedingTherapy: boolean; // OT / SLP
  clinicianPrescribedTextureLevel?: string; // Overrides AI texture selection when present
}
```

### 4b. GrowthRecord

```typescript
interface GrowthRecord {
  heightCm?: number;
  weightKg?: number;
  measuredAt?: string;              // ISO date
  measurementSource?: "pediatric_office" | "home" | "school" | "other";
  pediatricianConcern?:
    | "none"
    | "slow_growth"
    | "rapid_gain"
    | "underweight"
    | "overweight_concern"
    | "obesity_treatment_plan";
  clinicianDirectedGrowthGoal?: string; // Free text, parent-entered from clinician
  recentUnexplainedWeightChange: boolean;
}
// GOVERNANCE NOTE:
// The app must never compute a weight-status label from parent-entered numbers alone.
// "overweight_concern" and "obesity_treatment_plan" are parent-reported labels from
// a clinician visit, not derived from a BMI calculation in this app.
// Language in the UI must never say "Your child is overweight/obese/fat."
// Approved language: "Your child's clinician has identified a growth concern."
```

### 4c. ActivityProfile

```typescript
interface ActivityProfile {
  typicalActivityLevel: "low" | "moderate" | "active" | "very_active";
  organizedSports: boolean;
  sportNames?: string[];
  trainingDaysPerWeek?: number;
  typicalSessionDurationMinutes?: number;
  breakfastHabits: "eats_regularly" | "skips_often" | "eats_sometimes";
  lunchSource: "school_cafeteria" | "packed_lunch" | "home" | "mixed";
  afterSchoolHungry: boolean;
  typicalBeverages: string[];  // e.g. ["water", "milk", "juice"]
}
```

### 4d. EatingBehaviorProfile

```typescript
interface EatingBehaviorProfile {
  foodsLoved: string[];           // Parent-entered: "pasta", "apples", "grilled chicken"
  foodsAcceptedSometimes: string[];
  foodsBeingIntroduced: string[];
  foodsRefused: string[];
  preferredTextures: string[];    // "crunchy", "soft", "smooth", "mixed"
  preferredTemperatures: ("warm" | "room_temp" | "cold")[];
  preferredColors?: string[];     // Young children; helps presentation
  eatsWithFamily: boolean;
  pickyEater: boolean;
  sensorySensitivities: boolean;
  fearOfNewFoods: boolean;        // Neophobia
  frequentlySweetsRequests: boolean;
  skipsMeals: boolean;
  eatsVeryRapidly: boolean;
  eatsPastFullness: boolean;
  usesFoodForComfort: boolean;
  parentsBiggestFeedingChallenge?: string; // Free text
}
// NOTE: These behavioral fields allow the generator to adapt presentation,
// exposure strategy, and familiarity — not just nutrient density.
// Example: "accepts crunchy beige foods, rejects mixed textures" is more
// actionable than "picky eater."
```

### 4e. AllergyProfile

```typescript
type AllergenId =
  | "peanut" | "tree_nuts" | "milk" | "egg" | "wheat"
  | "soy" | "sesame" | "fish" | "shellfish" | "other";

type AllergySeverity = "confirmed_allergy" | "suspected_reaction" | "intolerance" | "preference_avoid" | "clinician_elimination";

interface AllergyEntry {
  allergenId: AllergenId;
  customAllergenName?: string;     // when allergenId === "other"
  severity: AllergySeverity;
  emergencyMedication: boolean;    // EpiPen prescribed
  crossContactRestrictions: boolean;
  schoolAllergenPolicy?: string;   // e.g. "nut-free school"
}

interface AllergyProfile {
  entries: AllergyEntry[];
  celiacDisease: boolean;
  lactoseIntolerance: boolean;
  nonCeliacFoodIntolerance: boolean;
  intoleranceDetails?: string;
}

// GOVERNANCE RULES:
// - "confirmed_allergy" → hard stop in generation; blocked ingredient cannot appear
// - "suspected_reaction" → soft block + referral message: "This ingredient may cause a reaction.
//   We've removed it but encourage you to discuss with your child's allergist."
// - "clinician_elimination" → treated as confirmed_allergy
// - "preference_avoid" → respected but no clinical language used
// - emergencyMedication === true → UI always displays a preparation reminder
```

### 4f. HouseholdDietProfile

```typescript
interface HouseholdDietProfile {
  dietaryPattern:
    | "omnivore" | "vegetarian" | "vegan"
    | "kosher" | "halal"
    | "dairy_free" | "gluten_free_diagnosed"
    | "other";
  culturalCuisinePreferences: string[];
  budgetLevel: "budget_conscious" | "moderate" | "flexible";
  organicPreference: boolean;
  maxCookTimeMinutes?: number;      // 15 | 30 | 45 | 60 | null
  availableEquipment: string[];     // e.g. ["stovetop", "oven", "microwave", "air_fryer"]
  requiresSchoolSafe: boolean;
  requiresPackable: boolean;
  familyStyleMeals: boolean;
}
```

### 4g. NutritionSupportGoal (Level B)

Parent-selected, non-diagnostic goals that guide generation:

```typescript
type NutritionSupportGoal =
  | "more_balanced_meals"
  | "better_breakfasts"
  | "better_snacks"
  | "lunchbox_support"
  | "more_fruits_vegetables"
  | "more_iron_rich"
  | "more_calcium_rich"
  | "more_fiber"
  | "hydration_support"
  | "active_child_fueling"
  | "picky_eater_support"
  | "texture_progression"
  | "higher_energy_clinician_directed"     // requires clinicianInstructions
  | "lower_sodium_clinician_directed"      // requires clinicianInstructions
  | "healthy_growth_habits"
  | "family_meal_participation"
  | "familiar_food_transformation"
  | "more_variety";
```

### 4h. DiagnosedCondition (Level C)

```typescript
interface DiagnosedCondition {
  conditionId: string;             // From Level C protocol registry
  diagnosedByProfessional: boolean; // Parent must confirm
  diagnosingClinicianType?: string; // "pediatrician", "dietitian", "allergist", etc.
  diagnosisDate?: string;
  clinicianInstructions?: string;
  protocolId?: string;             // Approved Level C protocol ID; null until reviewed
}
```

---

## 5. Age-Stage Safety Matrix

Critical ingredient and preparation rules by stage. These are **generation blockers**, not suggestions.

| Rule ID | Rule | Applies To Stages | Severity | Source |
|---|---|---|---|---|
| `MPB-S001` | No honey | `beginning_foods`, `young_toddler` | Hard stop | CDC, AAP | **Strong** |
| `MPB-S002` | No cow's milk as main drink | `beginning_foods` | Hard stop | CDC | **Strong** |
| `MPB-S003` | No juice | `beginning_foods` | Hard stop | CDC, AAP | **Strong** |
| `MPB-S004` | Texture ≤ mashed/soft | `beginning_foods` | Hard stop | CDC | **Strong** |
| `MPB-S005` | No whole nuts or large nut pieces | All stages | Hard stop | AAP, NIAID | **Strong** |
| `MPB-S006` | No whole grapes — must be quartered | `beginning_foods` through `preschool` | Hard stop | CDC | **Strong** |
| `MPB-S007` | No whole cherry tomatoes — halve or quarter | `beginning_foods` through `preschool` | Hard stop | CDC | **Strong** |
| `MPB-S008` | No large pieces of raw carrot, celery, apple | `beginning_foods` through `young_toddler` | Hard stop | CDC | **Strong** |
| `MPB-S009` | No popcorn | All stages through `preschool` | Hard stop | AAP | **Strong** |
| `MPB-S010` | No hard candy | All stages through `early_school_age` | Hard stop | AAP | **Strong** |
| `MPB-S011` | No large chunks of meat — must be finely chopped or shredded | `beginning_foods` through `toddler` | Hard stop | CDC | **Strong** |
| `MPB-S012` | No high-mercury fish (swordfish, shark, king mackerel, tilefish, bigeye tuna) | All stages | Hard stop | FDA/EPA | **Strong** |
| `MPB-S013` | No homemade infant formula recommendations | `early_infant`, `beginning_foods` | Hard stop | FDA, AAP | **Strong** |
| `MPB-S014` | No recipe generation if `swallowingDifficulty === true` without clinicianPrescribedTextureLevel | All stages | Hard stop | Clinical safety | **Strong** |
| `MPB-S015` | No recipe generation if `hasFeedingTube === true` without explicit clinician instructions | All stages | Hard stop | Clinical safety | **Strong** |
| `MPB-S016` | Limit added sugar; no sugary drinks as primary beverage | All stages | Guidance | CDC, AAP | **Strong** |
| `MPB-S017` | Limit sodium; no high-sodium processed foods as primary ingredients | All stages | Guidance | NHLBI, Dietary Guidelines | **Moderate** |
| `MPB-S018` | Serving size must match age-appropriate ranges | All stages | Guidance | CDC, USDA | **Strong** |
| `MPB-S019` | Texture progression strategy (soft → pieces → family foods) | `beginning_foods` through `toddler` | Guidance | CDC | **Strong** |
| `MPB-S020` | Picky eating exposure strategies (repeated neutral exposure) | `toddler` through `early_school_age` | Guidance | AAP | **Moderate** |
| `MPB-S021` | Sensory-based eating adaptation approaches | All stages | Guidance | OT/SLP literature | **Limited** |

(Evidence strength column added per v1.2 review. Reviewers should treat **Limited** rules with heightened scrutiny — language must be appropriately hedged and clinical referral offered.)

**Rule governance fields** (each rule in the rule registry carries):

```typescript
interface SafetyRule {
  ruleId: string;
  description: string;
  stagesApplicable: DevelopmentalStage[];
  conditionsApplicable: string[];    // empty = all
  sourceOrg: string;
  sourcePublication: string;
  sourceUrl: string;
  effectiveDate: string;
  reviewDate: string;
  status: "draft" | "approved" | "pending_review" | "removed";
  clinicalReviewer?: string;
  severity: "guidance" | "hard_stop" | "clinician_required";
  userFacingExplanation: string;
  auditWhenFired: boolean;
}
```

---

## 6. Protocol Levels

### Level A — Universal Developmental & Safety Protocols
Auto-applied to every child based on stage and feedingAbility. No parent opt-out. Contains all rules in Section 5.

### Level B — Parent-Selected Nutrition Support
Not diagnoses. Can safely influence generation. Parent selects from `NutritionSupportGoal[]`. Rules in this level use "guidance" severity only.

### Level C — Diagnosed Conditions (Governed)
Requires:
1. Parent confirms "diagnosed by a healthcare professional"
2. Condition exists in the approved Level C registry
3. Approved protocol has been reviewed by a pediatric clinician before enabling
4. All generation changes from this protocol are audited
5. No medication or dosing advice ever returned

**Level C roadmap — phased, not simultaneous:**

| Priority | Condition | Notes |
|---|---|---|
| Phase 1 | Food allergies (structured) | Build on existing adult allergy engine |
| Phase 1 | Celiac disease | Strict gluten elimination |
| Phase 1 | Lactose intolerance | Dairy substitution rules |
| Phase 2 | Type 1 diabetes | No carb targets without clinician; no insulin advice |
| Phase 2 | Type 2 diabetes | Family-centered, non-stigmatizing |
| Phase 2 | Failure to thrive / faltering growth | Clinician-directed energy goals only |
| Phase 3 | Inflammatory bowel disease | Flare vs. remission states |
| Phase 3 | Chronic kidney disease | Mineral restrictions; strict clinical governance |
| Phase 3 | Congenital heart disease / prescribed cardiac diet | Clinician-prescribed rules only |
| Phase 4 | Cystic fibrosis | High-energy needs; specialist involvement |
| Phase 4 | Metabolic disorders | Cannot be implemented without specialist protocol library |
| Phase 4 | Feeding/swallowing disorders | SLP-governed; AI cannot prescribe texture independently |
| Phase 4 | Tube feeding / formula modification | Outside scope of recipe generation |
| Future | Autism-associated sensory eating | Behavioral + food, not metabolic |
| Future | ADHD routine support | Behavioral framing; no claims food treats ADHD |

---

## 7. Recipe Generation — Context Resolution Order

```
ChildNutritionProfile
  ↓
1. Stage gate — is generation allowed? (early_infant → blocked)
2. Feeding ability gate — texture level, swallowing check
3. Allergy hard stops — confirmed + clinician-eliminated allergens removed
4. Level A universal safety rules — choking, honey, juice, age-restricted items
5. Level C diagnosed-condition protocol rules
6. Level B parent-selected nutrition-support goals
7. Household constraints — diet, culture, budget, time, equipment, school-safe
8. Eating behavior and sensory preferences — texture, presentation, familiarity
9. Requested food — always central, never replaced with an unrecognizable substitute
   ↓
Kid-friendly recipe
```

**Core generation mandate (system prompt anchor):**
> Create a version of the requested food that remains recognizable and enjoyable for children while improving nutritional quality where appropriate. Preserve the identity of the requested food. Apply age-specific ingredient safety, texture, portion, allergy, and developmental guidance. Do not unnecessarily remove foods children enjoy. Improve the recipe rather than replacing it.

---

## 8. Recipe Response Schema

```typescript
interface ChildRecipeResponse {
  recipeName: string;              // Playful and age-appropriate
  ageStageSuitability: string;     // Human-readable: "Suitable for Preschool (ages 4–5)"
  ingredients: ChildIngredient[];
  instructions: string[];
  servingGuidance: string;         // "About ½ cup per serving for a 4-year-old"
  textureAndChokingPreparation: string; // "Halve grapes lengthwise; cut chicken into ½-inch pieces"
  allergenAlerts: AllergenAlert[];
  whyThisVersionIsBetter: string;  // Non-shaming: "This version uses whole-grain pasta..."
  serveSuggestion: string;         // "Pairs well with steamed broccoli florets and milk"
  funPresentationIdea: string;     // "Cut into dinosaur shapes using cookie cutters"
  storageAndLunchboxGuidance?: string;
  askPediatricianNote?: string;    // Present only when a medical issue affects the answer
  rulesFireLog: RuleFiredEntry[];  // Audit: which Level A/B/C rules shaped this output
}

interface ChildIngredient {
  name: string;
  quantity: string;
  unit?: string;
  prepNote?: string;               // "finely diced", "mashed", "quartered"
  substitutionNote?: string;       // "Use oat milk if dairy-free"
}

interface AllergenAlert {
  allergenId: string;
  message: string;
  severity: "confirmed_removed" | "suspected_removed" | "clinician_eliminated" | "cross_contact_warning";
}

interface RuleFiredEntry {
  ruleId: string;
  level: "A" | "B" | "C";
  description: string;
  action: string;  // "blocked_ingredient", "modified_texture", "added_preparation_note", etc.
}
```

---

## 9. Intake Flow Design

The intake is a **guided multi-step flow**, not a single form. Use cards, short questions, and conditional follow-ups. Sections are grouped so a parent can complete a useful minimum quickly and return to add detail.

### Minimum viable intake (unlock generation):
- Stage or date of birth → confirm developmental stage
- Food allergies (structured selector)
- Food request

### Full intake sections (can be completed over multiple sessions):

**Section 1 — About Your Child**
- Nickname
- Date of birth
- Confirm developmental stage (suggested, parent confirms)
- Premature birth? → if yes: gestational age, corrected age

**Section 2 — How They Eat**
- Texture level (conditional: required for beginning_foods and young_toddler)
- Swallowing difficulty? → if yes: requires clinician-defined texture, blocks AI texture
- Feeding therapy? (OT/SLP)
- Conditional: only asked for stages where relevant

**Section 3 — Food Preferences**
- Foods they love (quick chips)
- Foods they refuse (optional)
- Picky eater? → if yes: sensory sensitivity toggle, fear of new foods toggle
- Parent's biggest feeding challenge (optional free text)

**Section 4 — Allergies & Intolerances**
- Structured allergen selector (Big 9 + celiac + lactose)
- For each confirmed allergy: emergency medication (EpiPen)?
- School allergen policy?

**Section 5 — Household Setup**
- Dietary pattern
- Budget level
- Max cook time
- School-safe / packable
- Cultural cuisines (optional)

**Section 6 — Goals (optional)**
- Multi-select from NutritionSupportGoal list

**Section 7 — Medical Conditions (optional, Level C)**
- "Has a healthcare professional diagnosed your child with a medical condition that affects eating?" → gated

**Section 8 — Activity (optional)**
- Sports / active child?
- School lunch type

**Section 9 — Growth (optional, context-aware)**
- Only prompted when goals include growth-related support or a clinician concern is reported
- Never prompted to diagnose; always framed as "optional — helps personalize servings"

---

## 10. Conditional Follow-Up Logic

| Trigger | Follow-Up |
|---|---|
| `developmentalStage === "early_infant"` | Block generation; show feeding education screen |
| `prematureBirth === true` | Ask gestational age; compute corrected age; re-suggest stage |
| `swallowingDifficulty === true` | Block AI texture selection; require clinicianPrescribedTextureLevel |
| `hasFeedingTube === true` | Block generation; prompt for clinician instructions |
| `allergyEntry.severity === "suspected_reaction"` | Show referral message: discuss with allergist |
| `allergyEntry.emergencyMedication === true` | Show persistent reminder on every recipe |
| `diagnosedConditions.length > 0` | Confirm professional diagnosis; check if approved protocol exists |
| `pediatricianConcern === "obesity_treatment_plan"` | Only show language from clinician goal; never generate weight-loss language autonomously |
| `receivingFeedingTherapy === true` | Add "Ask your feeding therapist" note to texture guidance |
| Any Level C condition without an approved protocol | Block condition-specific generation; show: "Your child's condition requires clinical review before we can apply specialized rules. Standard age-appropriate recipes still apply." |

---

## 11. Red Flags and Escalation Logic

These conditions trigger an escalation message and suppress normal generation:

| Condition | Escalation Message |
|---|---|
| `developmentalStage === "early_infant"` | "Babies under 6 months receive all nutrition from breast milk or formula. We can help you with feeding education and questions to ask your pediatrician." |
| `swallowingDifficulty === true` AND no clinician texture level | "A swallowing difficulty requires guidance from a speech-language pathologist or feeding therapist. We've paused texture recommendations until you add clinician instructions." |
| `hasFeedingTube === true` | "Tube feeding requires a specialized nutrition plan from your child's medical team. We're not able to generate general recipes for tube-fed children without clinician instructions." |
| Parent enters symptoms (blood in stool, significant vomiting, rapid weight loss, severe feeding refusal) | "These symptoms need prompt attention from your child's doctor. Please contact your pediatrician today." |
| Any request for infant formula modification or homemade formula | "Modifying infant formula can be dangerous. Please speak with your child's pediatrician or registered dietitian." |
| Any request involving colic treatment plan | "Colic can have many causes. We can share general information, but a change to formula or your nursing diet should be discussed with your pediatrician." |

---

## 12. Clinical Source Registry

Every rule must cite a source from this list (or request addition of a new source with URL and evidence level):

| Source ID | Organization | Resource | URL | Notes |
|---|---|---|---|---|
| `CDC-ITN-001` | CDC | Infant and Toddler Nutrition — When, What, and How to Introduce Solid Foods | cdc.gov/infant-toddler-nutrition | Primary texture/timing reference |
| `CDC-ITN-002` | CDC | Foods and Drinks to Avoid or Limit | cdc.gov/infant-toddler-nutrition | Hard-stop ingredient rules |
| `CDC-ITN-003` | CDC | Foods and Drinks to Encourage | cdc.gov/infant-toddler-nutrition | Positive food framing |
| `CDC-ITN-004` | CDC | How Much and How Often to Feed | cdc.gov/infant-toddler-nutrition | Portion and feeding frequency |
| `AAP-001` | American Academy of Pediatrics | HealthyChildren.org — Choking Prevention | healthychildren.org | Choking hazard rules |
| `AAP-002` | American Academy of Pediatrics | HealthyChildren.org — Smoothies | healthychildren.org | Beverage and smoothie guidance |
| `AAP-003` | American Academy of Pediatrics | Evaluating and Treating Obesity in Children | healthychildren.org | Anti-stigma obesity language |
| `AAP-004` | American Academy of Pediatrics | Early Childhood nutrition | aap.org | Development and nutrition |
| `AAP-005` | American Academy of Pediatrics | Colic | healthychildren.org | Colic escalation rules |
| `NIAID-001` | NIH/NIAID | Addendum Guidelines for Prevention of Peanut Allergy | niaid.nih.gov | Peanut allergy introduction guidance |
| `FDA-EPA-001` | FDA/EPA | Advice About Eating Fish | fda.gov | Mercury fish restrictions |
| `USDA-001` | USDA | MyPlate for Families with Young Children | myplate.gov | Positive food groups |
| `DGA-001` | ODPHP | Dietary Guidelines for Americans | health.gov | Current federal nutrition framework |
| `NHLBI-001` | NIH/NHLBI | Integrated Pediatric Cardiovascular Risk Guidelines | nhlbi.nih.gov | Sodium/fat/cholesterol thresholds in children |

---

## 13. Phased Implementation Plan

### Phase 0 — Foundation (no user-facing features)
- Define TypeScript interfaces for all types above
- Build rule registry (Level A rules only)
- Build source registry
- Build audit logger for rule firings
- Write unit tests for every Level A hard stop

### Phase 1 — V1 Feature (minimum viable My Perfect Beginning)
**Stages unlocked:** Beginning Foods through Growing Child  
**Intake:** Stage + allergies (structured) + food request  
**Protocols:** Level A only + allergies  
**Goals:** Basic NutritionSupportGoal multi-select  
- Page: `MyPerfectBeginningPage.tsx` (Clone of Create a Dish, child-context form)
- Server: `POST /api/my-perfect-beginning/create-dish`
- Prompt builder accepts `ChildContext` object (subset of full ChildNutritionProfile)
- Returns full `ChildRecipeResponse` schema
- Early Infant gate: education screen instead of generator
- No DB storage of child profiles yet (session-only)

### Phase 2 — Child Profile Storage
- DB table: `child_nutrition_profiles`
- Parent can save and switch between multiple child profiles
- Profile builder wizard (full intake flow, Sections 1–9)
- Profile appears in a "Nutrition Profiles" switcher on the home screen

### Phase 3 — Level B Goals
- All NutritionSupportGoal values integrated into prompt context
- Eating behavior profile (picky eating, sensory)
- Household constraints (budget, school-safe, pack-able)
- Full activity profile

### Phase 4 — Level C Conditions (one at a time, with clinical review)
- Food allergies (structured, building on Phase 1 allergy hard stops)
- Celiac disease
- Lactose intolerance
- Each subsequent condition requires its own approved protocol before enabling

### Phase 5 — Coach & Interaction Layer
- AI chat for parents ("Why did you change the recipe?", "My son won't eat this")
- Lunchbox planner
- Weekly meal planning for children
- Shopping list integration

---

## 14. What Must Not Happen

1. **Never inherit the parent's profile.** No GLP-1, no diabetes macros, no adult body composition targets.
2. **Never generate a recipe for early_infant (0–5 months).** Hard gate, no override.
3. **Never replace the requested food with something unrecognizable.** Mac and cheese stays mac and cheese.
4. **Never diagnose weight status from a parent-entered number.** No BMI label, no "your child is obese" output.
5. **Never generate formula modifications or homemade formula.** Escalate to pediatrician.
6. **Never give dosing, medication, or clinical treatment instructions.** Out of scope.
7. **Never use adult body-type categories ("ectomorph", "endomorph")** for children.
8. **Never apply Level C protocols without a confirmed approved protocol in the registry.** Default to Level A + B only.

---

---

## 15. Pediatric Protocol Registry

My Perfect Beginning must have its own **Pediatric Protocol Registry**, completely separate from the adult protocol registry. No pediatric protocol is allowed to inherit an adult protocol by default. Every pediatric protocol must be independently reviewed against pediatric-specific guidance, even when the disease name is the same as an adult condition.

### Architecture

```
My Perfect Beginning
        ↓
Child Nutrition Profile
        ↓
Pediatric Protocol Registry
        ↓
Protocol Resolver
        ↓
Meal Generator
```

This mirrors exactly how the adult system works: user profile → protocol registry → resolver → generator. The Pediatric Protocol Registry is a parallel registry, not a subset or extension of the adult one.

### Protocol Governance Fields

Every entry in the Pediatric Protocol Registry carries:

```typescript
interface PediatricProtocol {
  protocolId: string;              // e.g. "MPB-PROTO-T1D-001"
  pediatricSpecialty: string;      // e.g. "Pediatric Endocrine"
  displayName: string;
  applicableStages: DevelopmentalStage[];
  supportedDiagnoses: string[];
  nutritionGoals: string[];
  safetyGuardrails: string[];      // Rule IDs from the safety matrix
  foodsToEncourage: string[];
  foodsToLimit: string[];          // Only when evidence supports it
  escalationCriteria: string[];
  clinicalReferences: string[];    // Source IDs from the source registry
  version: string;
  effectiveDate: string;
  reviewDate: string;
  clinicalApprovalStatus: "draft" | "pending_review" | "approved" | "removed";
  clinicalReviewer?: string;
  parentAdultProtocolId?: string;  // Reference only — never inherit rules from it
  inheritanceRule: "none";         // Always "none" — explicit, enforced

  // ── Protocol Objective (required) ────────────────────────────────────
  objective: ProtocolObjective;

  // ── Exit Conditions ───────────────────────────────────────────────────
  exitConditions: ProtocolExitCondition[];

  // ── Evidence Strength ─────────────────────────────────────────────────
  evidenceStrength: "strong" | "moderate" | "limited" | "consensus";
  evidenceNotes?: string;  // Explains why strength is limited/consensus
}

interface ProtocolObjective {
  primaryObjective: string;
  secondaryObjectives: string[];
  notIntendedToDo: string[];  // Explicit scope boundary — shown to clinical reviewers
}

// Examples:
// Type 1 Diabetes:
//   primaryObjective: "Maintain meal consistency that supports the child's diabetes management plan"
//   notIntendedToDo: ["Adjust insulin", "Replace diabetes education", "Treat emergencies", "Override clinician instructions"]
//
// Picky Eating:
//   primaryObjective: "Increase dietary variety while preserving positive food experiences"
//   notIntendedToDo: ["Force eating", "Diagnose ARFID", "Replace feeding therapy"]

type ProtocolExitTrigger =
  | "child_advances_to_next_stage"   // Automatic — stage-based protocols only
  | "parent_removes_protocol"
  | "clinician_removes_protocol"
  | "clinician_indicates_resolved"
  | "child_reaches_age"              // e.g. allergy introduction window closes
  | "manual_review_required";        // Flags for human decision

interface ProtocolExitCondition {
  trigger: ProtocolExitTrigger;
  description: string;           // Human-readable explanation
  automatic: boolean;            // true = system acts; false = notification only
  notifyParent: boolean;
  notifyClinician: boolean;
}

// Examples:
// Beginning Foods:
//   { trigger: "child_advances_to_next_stage", automatic: true, description: "Expires when parent confirms child has moved to Young Toddler stage" }
//
// Constipation Support:
//   { trigger: "parent_removes_protocol", automatic: false, description: "Parent manually removes when no longer needed" }
//   { trigger: "clinician_removes_protocol", automatic: false }
//
// Iron Support:
//   { trigger: "clinician_indicates_resolved", automatic: false, description: "Clinician indicates iron levels normalized" }
//   { trigger: "parent_removes_protocol", automatic: false }
```

**The `inheritanceRule: "none"` field is required and immutable.** It documents the architectural decision and makes it impossible to accidentally wire up adult rule inheritance.

### Protocol Registry — Separated by Population

```
Adult Protocols (existing system)
  • GLP-1
  • Diabetes
  • Cardiac
  • Renal
  • Liver
  • Anti-inflammatory

────────────────────────────────
Pediatric Protocols (My Perfect Beginning)
  • Healthy Growth
  • Type 1 Diabetes in Children
  • Type 2 Diabetes in Youth
  • Childhood Obesity Support (family-centered)
  • Pediatric Cardiac
  • Pediatric Renal
  • Pediatric Liver
  • Celiac Disease
  • Food Allergies (integrates with adult allergy engine — same data, different rules)
  • Picky Eating / Selective Eating
  • Sensory Eating Support
  • Active Child / Youth Sports
  • Constipation-Supportive Nutrition
  • Lunchbox Nutrition
  • Pediatric IBD
  • Gastroesophageal Reflux in Children
  • Feeding Disorders (with SLP boundary)
  • ADHD Routine Support (behavioral framing only — no treatment claims)
  • Autism Spectrum Sensory Eating Support (behavioral + food, not metabolic)
```

### Phase Roadmap for Protocol Release

**Phase 1 — Highest value, strongest evidence base:**
- Healthy growth
- Picky eating / selective eating
- Food allergies (Big 9, structured)
- Celiac disease
- Type 1 diabetes in children
- Childhood obesity support (family-centered, non-stigmatizing)
- Active child / youth sports nutrition
- Constipation-supportive nutrition
- Lunchbox nutrition

**Phase 2 — Requires specialist review:**
- Pediatric kidney disease
- Pediatric liver disease
- Pediatric cardiac conditions
- Inflammatory bowel disease in children
- Failure to thrive / faltering growth
- Feeding disorders (with SLP governance boundary)
- Sensory eating support

**Phase 3 — Specialized metabolic and rare conditions:**
- Developed with appropriate clinical oversight; scope defined at time of build.

### The Non-Inheritance Rule

> **No pediatric protocol is allowed to inherit an adult protocol by default. Every pediatric protocol must be independently reviewed against pediatric guidance, even if the disease name is the same.**

This principle protects the quality and safety of My Perfect Beginning as it grows. Pediatric nutritional protocols, safety considerations, growth needs, and evidence bases differ from adult protocols even when the condition shares a name. A child with Type 1 diabetes has different carbohydrate targets, growth requirements, and safety considerations than an adult. A child with kidney disease is still growing. A child with a cardiac condition requires pediatric-specific reference ranges.

Violation of this rule is a blocking issue in any Phase 2+ protocol implementation review.

---

## 16. Developmental Milestone Registry

Developmental milestones are **not diseases and not protocols**. They are nutrition-relevant developmental events that can influence meal generation independently of any condition. They sit alongside the Protocol Registry as a separate data source fed into the Protocol Resolver.

```
Child Nutrition Profile
        ↓
        ├── Pediatric Protocol Registry  (condition-based rules)
        └── Developmental Milestone Registry  (event-based rules)
                ↓
        Protocol Resolver (merges both)
                ↓
        Meal Generator
```

### What Belongs in the Milestone Registry

These are events in a child's feeding development that carry specific nutrition guidance:

| Milestone ID | Milestone | Typical Age | Nutrition Influence |
|---|---|---|---|
| `MPB-M001` | Beginning solid foods | ~6 months | Texture: purée only; iron-rich first foods; single-ingredient introduction |
| `MPB-M002` | Texture progression — soft lumps | ~7–9 months | Advance from smooth purée; soft mashed pieces; spoon self-feeding begins |
| `MPB-M003` | Finger foods introduction | ~8–10 months | Small soft pieces; pincer grasp foods; self-feeding practice |
| `MPB-M004` | Cup introduction | ~6–12 months | Introduces sips of water; breast milk / formula remains primary drink |
| `MPB-M005` | Transition off formula/breast milk | ~12 months | Cow's milk (or alternative) becomes acceptable; juice still limited |
| `MPB-M006` | Self-feeding emerging | ~12–18 months | Utensil use beginning; messier meals expected; family food textures |
| `MPB-M007` | Family food participation | ~12–24 months | Child eating versions of family meals; portion adaptation |
| `MPB-M008` | Picky eating peak | ~18 months–3 years | Food neophobia common; exposure over pressure; familiar + one new |
| `MPB-M009` | Snack structure | ~12 months onward | 3 meals + 2–3 snacks; structured eating windows |
| `MPB-M010` | Preschool food independence | ~3–5 years | Self-serving small portions; color/shape presentation matters |
| `MPB-M011` | School lunch independence | ~5–6 years | Packable foods; school-safe allergen requirements; peer eating context |
| `MPB-M012` | After-school fueling | ~6+ years | Energy timing for activity; snack before sports |
| `MPB-M013` | Youth sports nutrition | ~6+ years | Pre/post-activity fueling; hydration; recovery foods |

### Milestone Schema

```typescript
interface DevelopmentalMilestone {
  milestoneId: string;
  label: string;
  typicalAgeRangeMonths: [number, number];
  stagesApplicable: DevelopmentalStage[];
  nutritionInfluences: string[];       // What changes in generation
  textureImplications?: string;
  servingImplications?: string;
  ingredientInfluences?: string[];     // Foods to introduce or adapt
  presentationGuidance?: string;       // How to present food for this stage
  parentGuidanceNote: string;          // Shown in UI
  evidenceStrength: "strong" | "moderate" | "limited" | "consensus";
  sourceIds: string[];                 // From source registry
  activeWhen: MilestoneActivationRule;
  exitConditions: ProtocolExitCondition[];
}

type MilestoneActivationRule =
  | { type: "stage_based"; stages: DevelopmentalStage[] }         // Auto-active for stage
  | { type: "parent_confirms"; description: string }               // Parent taps "Yes, we're here"
  | { type: "age_range"; minMonths: number; maxMonths: number };   // Age window
```

### Key Design Rule

Milestone rules carry guidance-level severity only — they inform the generator but never hard-block it the way Level A safety rules do. A child at the "picky eating peak" milestone gets exposure-friendly presentation suggestions; a child with the honey hard stop (`MPB-S001`) is blocked regardless of milestone state.

Milestones can **co-exist with protocols**. A child with celiac disease (Level C protocol) can also be at the "school lunch independence" milestone — both inform the same generation request simultaneously.

---

*Document version: 1.2 | Status: Awaiting review before implementation begins*
*v1.0 — Initial specification*
*v1.1 — Added Pediatric Protocol Registry (Section 15), non-inheritance rule, phase roadmap, and protocol governance schema*
*v1.2 — Added protocol objectives + "not intended to do" fields, exit conditions, evidence strength column across safety matrix and protocol schema, Developmental Milestone Registry (Section 16)*
