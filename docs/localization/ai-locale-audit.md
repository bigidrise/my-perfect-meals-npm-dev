# AI Locale Propagation Audit

**Status:** Audit complete — no changes made  
**Generated:** 2026-08-14  

## Canonical Reference Implementation

Three files already correctly propagate locale. All others must follow this pattern:

### Pattern (from `server/routes/chef.ts`)
```ts
const rawLang = req.authUser?.preferredLanguage || "auto";
// ... resolve to supported locale ...
const languageInstruction = getLanguageInstruction(rawLang); // from server/utils/languageInstruction.ts
systemPrompt = `${languageInstruction}\n\n${systemPrompt}`;
```

The flow is: `users.preferredLanguage → req.authUser.preferredLanguage → getLanguageInstruction() → system prompt prefix`

## Priority Audit Table

| Priority | File | Feature | Own OpenAI? | Language? | Uses preferredLanguage? |
|---|---|---|---|---|---|
| **P0** | `server/routes/chef.ts` | All meal builders (Chef) | Yes | ✅ Yes | ✅ Yes — reference impl |
| **P0** | `server/services/intelligentMealGenerator.ts` | Intelligent meal generation | Yes | ✅ Yes | ✅ Yes — reference impl |
| **P0** | `server/services/restaurantMealGeneratorAI.ts` | Restaurant/Fast Food guidance | Yes | ✅ Yes | ✅ Yes — reference impl |
| **P0 ❌** | `server/routes/groceryCoach.ts` | Grocery Coach — conversational | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/coachCorner.ts` | Coach's Corner chat | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/coaching/engine.ts` | Coaching engine orchestration | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/coaching/followupWorker.ts` | Automated coaching follow-ups | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/mealRefinement.ts` | Meal refinement chat | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/mealRefinementEngine.ts` | Meal refinement engine | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/pregnancyCoach.ts` | Pregnancy Coach | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/myPerfectBeginning.ts` | Pediatric / My Perfect Beginning | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/my-perfect-beginning.ts` | Pediatric (alternate route) | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/beverage-creator.ts` | Beverage Creator | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/routes/shoppingListV2.ts` | AI Shopping List | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/unifiedMealPipeline.ts` | Craving Creator, Fridge Rescue, unified builders | Yes (multiple) | ❌ No | ❌ No |
| **P0 ❌** | `server/services/fridgeRescueGenerator.ts` | Fridge Rescue | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/universalMealGenerator.ts` | Universal meal generator | Yes | ❌ No | ❌ No |
| **P0 ❌** | `server/services/ingredientScanService.ts` | Recipe/ingredient scan | Shared | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/dessert-creator.ts` | Dessert Creator | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/gatherings.ts` | Event/gathering meal planning | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/getaway.ts` | Travel meal generation | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/inspiration.ts` | Food inspiration | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/holiday-family-recipe.ts` | Holiday/family recipes | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/cookingTutorials.routes.ts` | Cooking tutorials | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/cookingClasses.routes.ts` | Cooking classes | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/mealSummarize.ts` | Meal summarization | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/chef-pairings.ts` | Chef food/drink pairings | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/assistant_legacy.ts` | Legacy assistant | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/companion-nutrition.ts` | Companion/pet nutrition | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/stableMealGenerator.ts` | Stable/template meal generation | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/mealCardFinalizer.ts` | Meal card finalization | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/buffetRecommendationAI.ts` | Buffet recommendations | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/coaching/memoryExtractor.ts` | Coaching memory extraction | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/coaching/conversationSummarizer.ts` | Coaching summaries | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/learnToCookService.ts` | Learn to cook tutorials | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/services/familyRecipeParser.ts` | Family recipe parsing | Yes | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/performanceNutrition.ts` | Performance/athlete coaching | Yes | ⚠️ Partial (languageRules but not DB preference) | ❌ No |
| **P1 ❌** | `server/routes/ai-wine-list-helper.ts` | Wine list helper | Shared | ❌ No | ❌ No |
| **P1 ❌** | `server/routes/reduce-drinking-plan.ts` | Reduce-drinking plan | Shared | ❌ No | ❌ No |
| **P2** | `server/routes/ai-pairings.ts` | Food/wine pairings | Shared | ⚠️ Input-echo only | ❌ No |
| **P2** | `server/routes/biometricsRoutes.ts` | Natural-language macros | Shared | ❌ No | ❌ No |
| **P2** | `server/services/smartCategorization.ts` | Food categorization | Yes | ❌ No | ❌ No |

## Summary

| | Count |
|---|---|
| Files using own OpenAI instance | ~38 |
| Files using shared openaiSafe wrapper | ~8 |
| Files with correct locale propagation | **3** (chef, intelligentMealGenerator, restaurantMealGeneratorAI) |
| P0 gaps (user-facing conversational AI) | **16** |
| P1 gaps (content generation features) | **20** |
| P2 gaps (background/admin features) | **4** |

## Canonical Design

```
User selects locale → stored in users.preferredLanguage
                               ↓
Every authenticated request → req.authUser.preferredLanguage
                               ↓
Server AI handler → getLanguageInstruction(preferredLanguage)
                               ↓
System prompt prefix: "Respond in [Language]. All output must be in [Language]..."
                               ↓
OpenAI response → user's language ✓
```

## Implementation Path (approved before bulk UI migration)

### Phase AI-1 — Shared utility (already exists, extend it)
`server/utils/languageInstruction.ts` — verify it supports all 14 locales, add any missing.

### Phase AI-2 — P0 conversational surfaces (patch individually)
Each route receives `req.authUser.preferredLanguage`. Add the `getLanguageInstruction()` call to the system prompt construction. Pattern is identical in each file — 2-3 lines per route.

Priority order:
1. `groceryCoach.ts` — Grocery Coach (most user-visible)
2. `coachCorner.ts` + `coaching/engine.ts` — Coach's Corner
3. `pregnancyCoach.ts` + `myPerfectBeginning.ts` — clinical/safety critical
4. `mealRefinement.ts` + `mealRefinementEngine.ts`
5. `beverage-creator.ts`
6. `unifiedMealPipeline.ts` + `fridgeRescueGenerator.ts` + `universalMealGenerator.ts`
7. `shoppingListV2.ts`
8. `ingredientScanService.ts`

### Phase AI-3 — P1 content generation surfaces
All remaining routes — same 2-3 line pattern.

### Phase AI-4 — openaiSafe consolidation (longer term)
Consolidate direct `new OpenAI()` instances into openaiSafe. Add `withLocale(systemPrompt, preferredLanguage)` wrapper so future features automatically inherit locale — no per-feature implementation required.
