# Pediatric Test Scenario Suite

110 structured scenarios the resolver must pass before any clinical review begins.

## Structure

```
tests/pediatric/
├── README.md
├── types.ts                        Shared interfaces (ChildProfile, PediatricScenario, …)
├── run-scenarios.ts                Test runner (no OpenAI calls)
└── scenarios/
    ├── index.ts                    Barrel — exports ALL_SCENARIOS, HARD_STOP_SCENARIOS, SOFT_SCENARIOS
    ├── 01-healthy-children.ts      S001–S008   (8)  All 8 developmental stages
    ├── 02-peanut-allergy.ts        S009–S015   (7)  Peanut across stages + EpiPen + suspected
    ├── 03-tree-nut-allergy.ts      S016–S020   (5)  Confirmed, intolerance, preference_avoid
    ├── 04-multiple-allergies.ts    S021–S028   (8)  Multi-allergen combos incl. top-8
    ├── 05-celiac-disease.ts        S029–S033   (5)  Celiac + allergy combinations
    ├── 06-type1-diabetes.ts        S034–S038   (5)  T1D carb-consistent, no adult inheritance
    ├── 07-type2-diabetes.ts        S039–S043   (5)  T2D glycemic management, no weight-loss language
    ├── 08-iron-deficiency.ts       S044–S047   (4)  Iron-rich + vitamin C pairing
    ├── 09-failure-to-thrive.ts     S048–S051   (4)  Caloric density, no restrictive language
    ├── 10-pediatric-obesity.ts     S052–S056   (5)  Wellness framing, zero weight-loss language
    ├── 11-adhd-eating.ts           S057–S060   (4)  Structured eating, routine-anchored
    ├── 12-autism-sensory.ts        S061–S064   (4)  Texture constraints, sensory profile
    ├── 13-crohns-disease.ts        S065–S068   (4)  Flare vs remission phases
    ├── 14-ckd.ts                   S069–S072   (4)  Sodium/phosphorus restriction verified
    ├── 15-cystic-fibrosis.ts       S073–S075   (3)  High caloric density verified
    ├── 16-hard-stops.ts            S076–S081   (6)  PKU ×2, G-tube ×2, Early Infant ×2
    ├── 17-behavioral-feeding.ts    S082–S087   (6)  Picky eater, food exposure (30–70%)
    ├── 18-family-meals.ts          S088–S091   (4)  3 children with different conditions
    ├── 19-meal-contexts.ts         S092–S096   (5)  Pantry-only, school lunch, birthday party
    ├── 20-parent-controls.ts       S097–S100   (4)  Parent override, never-recommend-again
    └── 21-multiple-conditions.ts   S101–S110  (10)  Compound condition intersections
```

**Total: 110 scenarios** (within the blueprint's 100–200 range)

## Running

```bash
# Full suite
npx tsx tests/pediatric/run-scenarios.ts

# Single scenario
npx tsx tests/pediatric/run-scenarios.ts --filter S076

# Entire category
npx tsx tests/pediatric/run-scenarios.ts --category hard_stop
```

Or via npm:

```bash
npm run test:pediatric
```

## Pass Thresholds (required before clinical review)

| Group | Scenarios | Required pass rate |
|---|---|---|
| Hard-stop (PKU, G-tube, Early Infant) | S001, S076–S081 | **100%** — zero tolerance |
| All other (soft) scenarios | S002–S075, S082–S110 | **≥ 95%** |

The runner exits with code `0` only when both thresholds are met.

## Scenario Structure

Each scenario is a `PediatricScenario` object:

```ts
{
  id: string;                    // "S001" … "S110"
  description: string;
  category: ScenarioCategory;
  isHardStop: boolean;           // true = 100% threshold applies

  childProfile: ChildProfile;    // ageStage, allergies, medicalConditions, behavioralFlags …
  request: PediatricMealRequest; // foodRequest, mealContext, familyProfiles …

  expectedRulesFired: string[];  // rule IDs that MUST appear in context.rulesFired
  expectedExclusions: string[];  // strings that MUST appear in context.exclusions
  expectedProtocols: string[];   // protocol IDs that MUST appear in context.protocols
  mustFlagLanguage: string[];    // patterns that MUST appear in context.languageFlags
  expectHardStop: boolean;       // context.hardStop must equal this
  expectHardStopReason?: string; // context.hardStopReason must equal this
  expectedMealType?: string;     // optional meal type assertion
}
```

## Resolver Dependency

The runner imports `resolvePediatricContext` from:

```
server/services/pediatric/pediatricResolver.ts
```

If that file does not exist (resolver task not yet merged), the runner exits with a
clear `RESOLVER NOT FOUND` message and code `2` — not a test failure.

## Coverage Map

| Condition | Scenarios |
|---|---|
| Healthy — all 8 stages | S001–S008 |
| Peanut allergy — all non-infant stages | S009–S015 |
| Tree nut allergy | S016–S020 |
| Multiple simultaneous allergies | S021–S028 |
| Celiac disease + allergy combos | S029–S033 |
| Type 1 Diabetes | S034–S038 |
| Type 2 Diabetes | S039–S043 |
| Iron Deficiency Anemia | S044–S047 |
| Failure to Thrive | S048–S051 |
| Pediatric Obesity (no weight-loss language) | S052–S056 |
| ADHD eating | S057–S060 |
| Autism sensory eating | S061–S064 |
| Crohn's Disease (flare + remission) | S065–S068 |
| CKD (sodium/phosphorus verified) | S069–S072 |
| Cystic Fibrosis (caloric density verified) | S073–S075 |
| PKU hard stop | S076–S077 |
| G-tube hard stop | S078–S079 |
| Early Infant hard stop | S001, S080–S081 |
| Picky eater — food chaining | S082–S083, S087 |
| Food exposure tracking (acceptance 30–70%) | S084–S086 |
| Family meal — 3 children, different conditions | S088–S091 |
| Pantry-only mode | S092 |
| School lunch — nut-free rules | S093–S094 |
| Birthday party — group scale | S095–S096 |
| Parent override (substitute verified) | S097, S099–S100 |
| Never-recommend-again (lockout verified) | S098, S100 |
| Multiple conditions simultaneously | S038, S041–S042, S055, S060, S068, S072, S090–S091, S101–S110 |
