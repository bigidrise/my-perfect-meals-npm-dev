# My Perfect Meals — Product Features & Implementation Status
**Version:** May 2026 | **Classification:** Internal / Operational Documentation

---

## 1. Core User Features

### Onboarding and Profile System
**What it does:** Collects dietary identity, allergies, medical conditions, cuisine preferences, health goals, household setup, and clinical protocol flags during account creation. Populates the Protocol Envelope that governs all subsequent AI generation.

**How users interact:** Multi-step onboarding flow in `OnboardingV3.tsx`. Extended onboarding available for detailed profile completion post-signup. Profile is editable post-onboarding through the profile section.

**Problem solved:** Ensures every meal generated from the first session reflects the user's complete constraint and preference profile, not a generic default.

**Status:** Fully implemented. `OnboardingV3.tsx` is the only active onboarding path. `onboarding-standalone.tsx` is dead code — do not modify.

---

### Subscription and Access Tiers
**What it does:** Four-tier freemium model (Free, Basic, Premium, Ultimate) with additional ProCare professional tiers and household/family plan variants. Controls feature access via server-side entitlement checks.

**Tiers:**
| Tier | Key Access Gates |
|---|---|
| Free | Fridge Rescue (1x/week), Macro Calculator, MacroScan, Ingredient Intelligence, Biometrics, Copilot Voice, Daily Journal |
| Basic | Create a Dish, unlimited Fridge Rescue, Weekly Meal Board, clinical builders (GLP-1/Diabetic/Anti-Inflammatory), Shopping List, multi-language voice |
| Premium | Craving/Dessert Creator, Beverage Creator, Sushi Creator, Spirits/Wine Hub, Restaurant Guide, Find Meals Near Me, Fast Food Guide, Gatherings, Potluck Planner |
| Ultimate | Athlete Beverage Creator, ProCare access, Beach Body/Competition builders, Lab Metrics |

**ProCare tiers:** 5, 10, 25, 50, 150 client roster sizes.

**Household plans:** Family Base, Family Premium, Family Ultimate — support up to 4 household profiles.

**Status:** Fully implemented. Billing enforcement controlled via `BILLING_ENFORCED` environment variable. When unset, all users receive Ultimate-tier access (pre-launch mode).

**Backend:** `server/services/subscriptionService.ts`, `server/routes/stripeCheckout.ts`, `server/routes/stripeWebhook.ts`, `server/routes/iosVerify.ts`, `shared/planFeatures.ts`.

---

### User Dashboard
**What it does:** Central hub displaying recent meals, macro progress, quick-access generation tools, notifications, and plan status.

**Status:** Fully implemented. `DashboardNew.tsx`.

---

### Saved Meals Library
**What it does:** Allows users to save generated meals for future reference, re-generation, and logging. Saved meals serve as behavioral signal for the preference learning system.

**Status:** Fully implemented. `SavedMeals.tsx`, `server/db/schema/savedMeals.ts`.

---

### Daily Journal and Check-ins
**What it does:** Daily reflection and behavioral check-in system. Users log mood, energy, adherence notes, and goal reflections. Feeds into the Copilot system for context-aware responses.

**Status:** Fully implemented.

---

### Macro Calculator
**What it does:** Computes daily calorie and macronutrient targets based on biometric inputs (height, weight, age, sex), activity level, and goal (weight loss, maintenance, muscle gain, clinical). Available to all tiers including Free.

**Backend:** `server/services/macroCalculatorEngine.ts`, `server/routes/macroCalculatorRoutes.ts`.

**Status:** Fully implemented.

---

## 2. Meal Generation Systems

All generation tools share one universal enforcement architecture: before any AI call, `protocolEnvelope.ts` assembles the user's complete constraint profile. After generation, `scanGeneratedOutput()` validates the result. No generator can bypass this pipeline.

**Constraint hierarchy (enforced in order):**
1. Dietary identity — outer wall; nothing generated outside it
2. Allergies — absolute hard stops inside the identity container
3. Medical hard limits — carb/sodium/nutrient ceilings that cannot be violated
4. Medical optimization — clinical optimization layers inside hard limits
5. Avoidances — user-marked unwanted foods
6. Preferences — flavor, cuisine, convenience — applied last

**Procedural layer (cross-cutting across all tiers):** preparation rules, storage rules, equipment rules, instruction constraints, cross-contamination rules.

---

### Create a Dish
**What it does:** Primary on-demand AI meal generator. User specifies a meal concept, cuisine direction, or specific ingredients and receives a fully structured meal with name, ingredients, macros, and step-by-step instructions.

**Pages:** `client/src/pages/lifestyle/CreateDishPage.tsx`

**Status:** Fully implemented.

---

### Fridge Rescue
**What it does:** User inputs ingredients they currently have available. The system generates a complete meal using only those ingredients, respecting all dietary and medical constraints. Available once per week on Free tier, unlimited on Basic and above.

**Pages:** `client/src/pages/fridge-rescue.tsx`

**Backend:** `server/services/fridgeRescueEngine.ts`, `server/services/fridgeRescueGenerator.ts`

**Status:** Fully implemented.

---

### Craving Creator
**What it does:** User describes a specific craving (e.g., "something like a cheeseburger," "I want pasta"). The system generates a nutritionally optimized version that satisfies the craving within the user's dietary and macro constraints.

**Pages:** `client/src/pages/craving-creator.tsx`, `CravingCreatorLanding.tsx`

**Status:** Fully implemented. Premium tier and above.

---

### Dessert Creator
**What it does:** Generates nutritionally designed dessert options. Works within macro targets and dietary identity constraints — not a generic recipe generator.

**Pages:** `client/src/pages/CravingDessertCreator.tsx`

**Status:** Fully implemented. Premium tier and above.

---

### Snack Creator
**What it does:** Generates macro-targeted snacks. Available as a modal (`SnackCreatorModal.tsx`) accessible from multiple surfaces in the app.

**Status:** Fully implemented.

---

### Beverage Creator
**What it does:** Custom beverage and drink design — smoothies, functional drinks, hydration, wellness beverages. Respects dietary identity, allergens, and macro targets.

**Pages:** `client/src/pages/BeverageCreator.tsx`, `BeverageCreatorHub.tsx`

**Status:** Fully implemented. Premium tier and above.

---

### Athlete Beverage Creator
**What it does:** Specialized beverage generation for performance and training phases — pre-workout, intra-workout, post-workout, recovery. Takes training phase context as input.

**Pages:** `client/src/pages/AthleteBeverageCreator.tsx`

**Status:** Fully implemented. Ultimate tier.

---

### Sushi Creator
**What it does:** Generates sushi-specific meals — rolls, nigiri, sashimi, and bowls. Handles dietary identity for sushi-specific compliance (raw fish, rice vinegar, etc.).

**Pages:** `client/src/pages/SushiCreator.tsx`

**Status:** Fully implemented. Premium tier and above.

---

### My Perfect Gatherings (Holiday Feast / Potluck Planner)
**What it does:** Multi-course event meal generation for holidays, camping trips, date nights, dinner parties, and social gatherings. Generates coordinated multi-course menus rather than single dishes.

**Pages:** `client/src/pages/lifestyle/GatheringsPage.tsx`

**Backend:** `server/services/holidayFeastService.ts`, `server/routes/holiday-feast.ts`, `server/routes/gatherings.ts`

**Status:** Fully implemented. Premium tier and above.

---

### Chef's Kitchen (Guided Cooking Experience)
**What it does:** A walkthrough cooking experience where the AI guides the user through meal preparation. Distinct from "Create a Dish" — this is about the interactive cooking process, not just meal output.

**Pages:** `client/src/pages/lifestyle/ChefsKitchenPage.tsx`

**Note:** Do not confuse with "Create a Dish" (`CreateDishPage.tsx`) or "Create With Chef" modal (`CreateWithChefModal.tsx`).

**Status:** Fully implemented.

---

### Signature Kitchen (Creator-Branded Generation)
**What it does:** AI meal generation under a chef or creator's branded kitchen identity. Output is styled with the creator's name, description tone, and instruction style. Core dietary and medical guardrails are not affected by creator styling.

**Pages:** `client/src/pages/kitchen/SignatureKitchenPage.tsx`, `SignatureKitchenHubPage.tsx`

**Backend:** `server/db/schema/creatorSystemConfigs.ts`, `server/services/creatorSystems/`

**Status:** Fully implemented.

---

### Weekly Meal Builder
**What it does:** A structured 7-day board where users place, plan, and manage meals by day and meal slot (breakfast, lunch, dinner, snack). Supports coach-assigned meals, locked days, meal replacement, and plan archiving. Available as a user-facing feature on Basic tier and above; coaches can also assign and manage boards for clients via ProCare.

**Pages:** `client/src/pages/WeeklyMealBoard.tsx`

**Backend:** `server/routes/weekBoard.ts`, `server/routes/mealBoards.ts`, `server/routes/proWeekBoard.ts`, `server/services/weekAssembler.ts`, `server/services/weeklyMealPlanningServiceA/B/C.ts`

**Status:** Fully implemented.

---

### Clinical Meal Builders
**What it does:** Condition-specific meal builders that apply dedicated clinical prompt logic for targeted populations.

| Builder | Clinical Target | Tier |
|---|---|---|
| GLP-1 Hub & Meal Builder | Semaglutide / GLP-1 users — reduced appetite, tolerance thresholds, injection tracking | Basic+ |
| Diabetic Hub & Meal Builder | Type 2 diabetes — carbohydrate ceiling enforcement, glycemic index guidance | Basic+ |
| Anti-Inflammatory Meal Builder | Inflammatory conditions — anti-inflammatory ingredient prioritization, pro-inflammatory avoidance | Basic+ |
| Beach Body / Hard Body | Body composition and aesthetics goals — macro ratios for cutting/recomp | Ultimate |
| Competition Prep Builder | Athletic competition preparation — phase-specific macro and timing guidance | Ultimate |
| General Nutrition Builder (Pro) | Coach-assigned general nutrition programming | ProCare |
| Performance & Competition Builder (Pro) | Coach-managed athlete competition prep | ProCare |

**Pages:** `client/src/pages/physician/` directory — GLP-1Hub, DiabeticHub, GLP1MealBuilder, DiabeticMenuBuilder, AntiInflammatoryMenuBuilder, DiabetesSupportPage

**Backend:** Dedicated prompt builders per condition in `server/services/guardrails/prompt/`

**Status:** All listed builders fully implemented.

---

### Kids and Family Meal Generation
**What it does:** Generates age-appropriate meals for children and toddlers. Handles household multi-profile context so generation is calibrated for the child's profile, not the parent's.

**Backend:** `server/services/kidsLunchboxV1.ts`, `server/services/familyNutrition.ts`

**Status:** Implemented. Listed as "Kids & Toddler Meals" on Premium tier iOS display.

---

### Specialty Generators (Backend Services Found)
Additional generation services present in the codebase:

| Service | Description | Status |
|---|---|---|
| `pregnancyNutritionGenerator.ts` | Pregnancy-phase nutrition generation | Backend implemented; UI surface TBD |
| `testosteroneNutritionGenerator.ts` | Hormone-support (men's) meal generation | Backend implemented |
| `familyRecipeParser.ts` | Parses and adapts user-submitted family recipes | Implemented |
| `learnToCookService.ts` | Cooking education and tutorial generation | Backend implemented; Premium tier |

---

## 3. Grocery and Shopping Systems

### Shopping List Architecture (V2)

**Two-layer consolidation pipeline:**

**Layer 1 — Server-side normalization (`server/services/shopping-list/`):**
- `builder-v2.ts` — iterates all ingredients from all meals, normalizes name via `canonicalName()`, normalizes unit to lowercase, groups by `name|unit` composite key, sums quantities, tracks source meal names
- `normalizer.ts` — canonical name resolution (removes plurals, common variants)
- `unit-converter.ts` — unit standardization at ingest
- `pantry.ts` — pantry staple identification and handling
- `shoppingListSources` table — tracks which meals produced which list items for deduplication on re-commit

**Layer 2 — Client-side consolidation (`client/src/lib/shoppingConsolidation.ts`):**
- `buildConsolidatedItems(items, options)` — groups by `normalizedName.toLowerCase()` across ALL units (g, mL, count treated as one item)
- Accumulation priority: weight (grams) → volume (mL) → count
- Returns `ConsolidatedItem[]` (extends `ShoppingListItem` with `allIds` and `mergedCount`)
- Handles the cross-unit duplicate problem that server-side grouping misses (e.g., same ingredient appearing as 120g and 60mL)

**Retail Intelligence Layer (`client/src/lib/retailIntelligence.ts`):**
`getRetailQuantity(item: ShoppingListItem): string | null` — authoritative converter from raw quantities to human-readable retail labels. Never returns raw grams or mL.

Conversion logic by category:
- **Produce (weight):** `PRODUCE_WEIGHT_TABLE` — 60+ entries mapping ingredient keywords to `{ purchaseUnit, gramsPerUnit }`. Returns "1 bunch", "2 bags", "3 heads", etc.
- **Meat/Seafood:** gram accumulation → pounds with one decimal ("3.5 lb", "1.2 lb")
- **Grains/Packaged:** container detection by recognizable patterns ("1 box", "1 bag", "1 can")
- **Dairy:** volume conversion via cup/quart/gallon logic
- **Canned legumes:** standard can-count arithmetic
- **Aromatics:** count-based (garlic cloves, onions)
- **Fresh herbs:** bunch/package logic
- **Leafy greens:** bag sizing by volume
- **Frozen items:** "1 bag" default
- **Bakery:** "1 loaf" default
- **Pantry staples / TIER_1_ALWAYS_HIDE:** returns null (name-only display — no unit shown for items like spices, oil, vanilla extract)
- **Final fallback:** returns null — raw numbers never leak to the UI

**Database tables:** `shoppingListItems`, `shoppingListSources` (in `shared/schema.ts`)

**Status:** Fully implemented. Both server-side normalization and client-side consolidation + retail intelligence are live.

---

### Smart Scan / Ingredient Intelligence (MacroScan)

**What it does:** Camera or image-based product label scanning. User photographs a packaged food item; the system extracts the ingredient list via OCR and analyzes it against the user's full Protocol Envelope.

**Output structure:**
- `alignmentGrade`: A / B / C / D overall alignment with user's protocol
- `verdict`: buy / caution / skip
- `verdictLevel`: consumer-facing action guidance
- `scoreCards`: separate thumbs-up/neutral/down verdicts for kids, adults, diet compliance, fitness goal alignment
- `ingredientDecoder`: each ingredient flagged as ok / watch / avoid with plain-language explanation
- `ingredientConsiderations`: specific concerns surfaced for the user's protocols
- `mayNotAlignWith` / `betterFor`: plain-language alignment summary
- `householdNotes`: household-specific considerations if family profiles are active
- `highRiskFindings`: fail-closed flags for ingredients whose risk depends on source and process (gelatin type, fermentation method, refinement level)
- `ocrConfidenceLow`: flag when OCR extraction is uncertain

**Ingredient Intelligence Store (`server/services/ingredientIntelligence.ts`):**
A provenance and certification database for ingredients whose safety depends on source and process, not just name. Tracks:
- `source`: animal / plant / synthetic / derived / unknown
- `process`: slaughter method, fermentation type, refinement level
- `certification`: kosher-certified / halal-certified / both / none / unknown
- `protocolRisk[]`: per-protocol risk level and reason
- `failClosedProtocols[]`: protocols where "unknown" = "unsafe"

**Fail-closed rule:** For strict protocols (Kosher, Halal), if source or certification is unknown, the ingredient is treated as unsafe — never as safe.

**Status:** Fully implemented. Available on Free tier as "MacroScan" / "Ingredient Intelligence."

---

### Grocery Delivery Integration
**What it does:** Connects directly to major grocery delivery retailers. Generates a pre-populated search for each shopping list item on the selected retailer's site.

**Retailers:** Instacart, Walmart, and others (configurable via `GROCERY_RETAILERS` in `client/src/lib/groceryRetailers.ts`).

**Platform restriction:** Available on tablet and desktop only. Mobile displays an informational nudge ("Visit My Perfect Meals on a larger screen to order directly from Instacart, Walmart, and more."). Implementation uses Tailwind responsive breakpoints (`hidden md:block` / `md:hidden`) — no JavaScript detection.

**Status:** Fully implemented.

---

### Shopping List Export
**What it does:** Exports the consolidated shopping list as a PDF or plain text document.

**Pages:** `client/src/components/shopping/GroceryExportModal.tsx`

**Status:** Fully implemented. Uses `buildConsolidatedItems` + `getRetailQuantity` pipeline.

---

## 4. Restaurant and Dining Systems

### Restaurant Guide
**What it does:** AI-filtered restaurant recommendations based on the user's dietary identity, cuisine preferences, and location. Surfaces venues that can accommodate the user's constraints rather than generic "near you" results.

**Pages:** `client/src/pages/RestaurantFinderPage.tsx`, `SocialRestaurantGuide.tsx`

**Backend:** `server/services/restaurantResolver.ts`, `server/services/restaurantScorer.ts`, `server/services/restaurantCuisineArchetype.ts`, `server/services/googlePlacesService.ts`, `server/routes/restaurants.ts`

**Architecture:** User protocol envelope is assembled first. Google Places data is scored against the user's dietary identity and cuisine archetype before results are surfaced.

**Status:** Fully implemented. Premium tier and above.

---

### Find Meals Near Me
**What it does:** Location-aware discovery of menu items at nearby restaurants that align with the user's protocols. More granular than the Restaurant Guide — surfaces specific menu items rather than venues.

**Backend:** `server/services/mealFinderService.ts`, `server/routes/mealFinder.ts`

**Status:** Fully implemented. Premium tier and above.

---

### Fast Food Guide
**What it does:** Smart ordering guidance at major fast food chains. Generates optimized order recommendations at specific chains (McDonald's, Chick-fil-A, and others) based on the user's macro targets and dietary identity.

**Pages:** `client/src/pages/FastFoodGuidePage.tsx`

**Status:** Fully implemented. Premium tier and above.

---

### Social Dining
**What it does:** Community-shared restaurant finds, dining recommendations, and social meal discovery.

**Pages:** `client/src/pages/SocialFindMeals.tsx`, `SocializingHub.tsx`

**Status:** Partially implemented. Infrastructure and routes present; social layer actively expanding.

---

### Pairing Systems
**What it does:** Occasion-based food and beverage pairing guidance across four distinct pairing hubs.

| Hub | Description | Page |
|---|---|---|
| Wine Pairing | Wine selection guidance for meals and occasions | `wine-pairing.tsx` |
| Beer Pairing | Beer style matching for food and occasions | `beer-pairing.tsx` |
| Bourbon & Spirits | Whiskey/bourbon pairing and spirits guidance | `bourbon-spirits.tsx` |
| Spirits & Wine Hub | Unified spirits and wine hub | (within Premium tier access) |
| AI Pairings | AI-generated custom pairing recommendations | `meal-pairing-ai.tsx`, `lifestyle/PairingsAI.tsx` |

**Backend:** `server/routes/ai-pairings.ts`, `server/routes/ai-wine-list-helper.ts`, `server/services/alcoholRecommendations.ts`, `server/services/pairings/`

**Status:** Fully implemented. Premium tier and above.

---

### Reduce Drinking Plan
**What it does:** Structured plan for users looking to reduce alcohol consumption. Generates a personalized reduction schedule and tracks adherence.

**Pages:** `client/src/pages/lifestyle/ReduceDrinkingPlan.tsx`, `weaning-off-tool.tsx`

**Backend:** `server/routes/reduce-drinking-plan.ts`, `server/routes/alcohol-log.ts`

**Status:** Implemented.

---

## 5. Biometrics and Tracking Features

### Biometrics Architecture
The biometrics system uses a payload-based ingest model. Data can come from manual entry, device sync, or external health apps. All values are normalized to canonical units at ingest (weight → kg, waist circumference → cm).

**Database tables:** `biometricSample`, `biometricSource` (in `shared/biometricsSchema.ts`)

**Backend:** `server/routes/biometricsRoutes.ts`, `server/services/biometricsService.ts`

---

### Weight and Body Composition Tracking
**What it does:** Logs weight entries over time. Calculates trend, rate of change, and projected trajectory. Body composition tracking includes body fat percentage, lean mass, and waist circumference.

**Pages:** `client/src/pages/my-biometrics.tsx`, `client/src/pages/biometrics/body-composition.tsx`

**Backend:** `server/routes/bodyComposition.ts`

**Status:** Fully implemented.

---

### Glucose Tracking
**What it does:** Blood glucose log with trend analysis and pattern alerts. Integrated with the Diabetic Hub and GLP-1 systems — glucose readings inform meal generation recommendations in real time.

**Backend:** `server/routes/glucose-logs.ts`, `server/services/diabeticContextService.ts`, `server/services/glycemicSettingsService.ts`, `server/services/patternAlerts.ts`

**Architecture:** `getDiabeticContext()` and `getGlucoseBasedMealGuidance()` are called during Protocol Envelope assembly, meaning active glucose readings actively influence what meals are generated.

**Status:** Fully implemented. Pattern alerts expanding.

---

### GLP-1 Shot Tracker
**What it does:** Tracks GLP-1 medication injections (date, dose, medication type). Adherence data feeds into the GLP-1 meal generation context.

**Pages:** `client/src/pages/glp1/ShotTrackerPanel.tsx`

**Backend:** `server/routes/glp1Shots.ts`

**Status:** Fully implemented.

---

### Blood Pressure and Vitals
**What it does:** Logs systolic/diastolic blood pressure readings over time with trend tracking.

**Backend:** `server/routes/vitals-bp.ts`

**Status:** Fully implemented.

---

### Sleep Tracking
**What it does:** Sleep duration and quality logging.

**Pages:** `client/src/pages/biometrics/sleep.tsx`

**Status:** Fully implemented.

---

### Hormone Tracking
**What it does:** Hormone cycle tracking for both men's and women's contexts. Women's hormones include cycle phase tracking; men's includes testosterone-related tracking.

**Backend:** `server/routes/adherence.ts` (for cycle protocol), `server/services/cycleProtocolService.ts`, `server/services/testosteroneNutritionGenerator.ts`

**Status:** Fully implemented. Gated to Basic tier and above (`hormones_women`, `hormones_men` entitlements).

---

### Macro Logging and Tracking
**What it does:** Daily macro intake logging against targets (calories, protein, carbohydrates, fat). Manual and AI-estimated logging. Feeds compliance scoring.

**Backend:** `server/routes/macroLogs.ts`, `server/routes/manualMacros.ts`, `server/services/macroEstimator.ts`

**Status:** Fully implemented.

---

### Compliance Engine
**What it does:** Computes a composite compliance score from calorie compliance, protein compliance, and logging consistency over a rolling 7 or 30-day window. Powers coach dashboard reporting.

**Formula:** `complianceScore` = weighted average of `calorieCompliance` (target adherence %) + `proteinCompliance` (protein target adherence %) + `loggingCompliance` (days with logs / window days).

**Backend:** `server/services/complianceEngine.ts`

**Status:** Fully implemented.

---

### Lab Metrics
**What it does:** Storage and display of clinical laboratory results (blood panels, metabolic panels, etc.). Allows physicians to view results in context of the patient's nutrition protocol.

**Backend:** `server/routes/clinicalLabs.ts`, `server/db/schema/clinicalLabs.ts`, `server/services/labProtocolOwnership.ts`, `server/services/resolveProtocolFromLabs.ts`

**Architecture:** `resolveProtocolFromLabs.ts` can derive or update clinical protocol assignments based on lab result values — lab results can trigger protocol recommendations.

**Status:** Fully implemented. Ultimate tier.

---

### Progress Analytics
**What it does:** Visual trend analysis across weight, macros, compliance, and biometrics. AI-generated insights on progress patterns.

**Backend:** `server/services/aiHealthMetrics.ts`, `server/routes/myProgress.ts`

**Status:** Fully implemented.

---

### Water Intake Logging
**What it does:** Daily hydration tracking.

**Backend:** `server/routes/waterLogs.ts`

**Status:** Implemented.

---

## 6. Family and Household Features

### Household Architecture
**What it does:** Allows a single subscription to support up to 4 independent user profiles under one account (household plan variants only).

**Database:** `server/db/schema/householdProfiles.ts`

**Backend:** `server/routes/household.ts`, `server/services/profileResolver.ts`

**Profile resolver architecture:** `profileResolver.ts` determines which profile's Protocol Envelope to use for any given generation call. When a child profile is active, generation is calibrated to the child's dietary identity and age context, not the account owner's.

**Status:** Fully implemented.

---

### Profile Switching
**What it does:** UI-level switcher allowing account owner to switch between household member profiles. Each profile maintains its own dietary identity, medical protocols, allergens, preferences, and generation history.

**Pages:** `client/src/pages/HouseholdProfilesPage.tsx`

**Status:** Fully implemented.

---

### Family Plan Tiers
| Plan Key | Base Tier | Max Profiles |
|---|---|---|
| mpm_family_base_monthly | Basic | 4 |
| mpm_family_premium | Premium | 4 |
| mpm_family_all_upgrade_monthly | Premium | 4 |
| mpm_family_all_ultimate_monthly | Ultimate | 4 |

**Status:** Fully implemented.

---

### Family Nutrition Services
**What it does:** Generation services that are aware of multi-profile household context. Can produce coordinated meals that work for multiple household members with different constraints simultaneously.

**Backend:** `server/services/familyNutrition.ts`

**Status:** Implemented.

---

## 7. AI and Copilot Systems

### Copilot (Conversational AI)
**What it does:** In-app voice and text coaching assistant. Responds to user questions, provides guidance, interprets biometric trends, offers motivational context, and delivers proactive nudges. Context-aware: the Copilot knows the user's active protocol, recent meals, macro status, and behavioral history.

**Architecture:** Copilot operates within a "respect guard" — it does not auto-open if the user has selected "Do-It-Yourself" mode. Feature flags in `SERVER_AVATAR_FEATURES` gate capability availability.

**Pages:** `client/src/components/copilot/CopilotSystem.tsx`, `CopilotContext.tsx`, `CopilotGuidedModeContext.tsx`

**Backend:** `server/routes/assistant.ts`, `server/routes/assistant_pipeline.ts`

**Status:** Fully implemented.

---

### Voice Input and Transcription
**What it does:** Audio recording → OpenAI Whisper transcription → command parsing → action execution. Supports meal generation requests, journal entries, and navigation commands by voice.

**Voice command pipeline:**
1. Audio buffer captured in browser/app
2. POST to `/api/voice/transcribe` → Whisper transcription
3. POST to `/api/voice/parse` → `VoiceCommandParser` classifies intent
4. POST to `/api/voice/execute` → `VoiceCommandExecutor` performs the action

**Feature flags:** `SERVER_AVATAR_FEATURES.VOICE_TRANSCRIPTION_ENABLED`, `VOICE_COMMAND_PARSING_ENABLED` — currently gated during alpha.

**Multi-language support:** Input translation pipeline handles non-English voice input and produces English-language meal generation parameters. Listed as "Multi-Language Voice Input & Translation" on Basic tier and above.

**Tablet Voice Notes:** Separate voice note pipeline for ProCare coach-client messaging. Audio uploaded to object storage → `VoiceJobWorker` polls → downloads from S3 → Whisper transcription → content moderation → stored as client note. Worker uses `FOR UPDATE SKIP LOCKED` pattern for safe concurrent processing.

**Backend:** `server/routes/voice.ts`, `server/services/voiceJobWorker.ts`, `server/services/tabletVoiceService.ts`, `server/services/tabletModerationService.ts`

**Status:** Transcription and command infrastructure fully implemented. Alpha feature flags in place.

---

### AI Voice Journal
**What it does:** Dedicated voice journaling experience. User speaks reflections, goals, and check-ins; AI processes the audio, generates a written summary, and adds structured entries to the daily journal.

**Backend:** `server/routes/ai-voice-journal.ts`

**Status:** Fully implemented.

---

### Behavioral Memory Service
**What it does:** Derives a deterministic preference profile from the user's historical meal data — no AI guessing, no writes to the enforcement gateway. Preferences are soft hints injected into generation prompts AFTER enforcement passes.

**Data sources (descending signal strength):**
1. `saved_meals` — "I want this again" signal
2. `user_recipes` — strong intent signal
3. `meal_instances` (status = 'logged') — acceptance signal

**Scoring:** Base score = +1.0 per evidence event × recency decay: `score × e^(−0.025 × daysSince)` (half-life ≈ 28 days). Minimum score to surface: 0.4. Maximum 3 preferences surfaced per category.

**Contract:** This service never touches the enforcement gateway. Preferences are always overridden by protocol constraints.

**Backend:** `server/services/behavioralMemoryService.ts`

**Status:** Fully implemented.

---

### Psychological Profile Service
**What it does:** Maintains a profile of behavioral traits (discipline level, stress coping, motivation type, focus level, procrastination tendency, sleep quality) used to calibrate Copilot coaching tone and pacing.

**Backend:** `server/services/psychProfileService.ts`

**Status:** Implemented with defaults. Deep profile derivation from onboarding data is a roadmap enhancement.

---

### Protocol Envelope (Universal AI Enforcement)
**What it does:** The single canonical constraint object assembled before every AI generation call in the platform. No generator — Create a Dish, Fridge Rescue, Restaurant Guide, Beverage Creator, or any other — produces output without calling `enforceBeforeGenerate()` first and `scanGeneratedOutput()` after.

**Assembly sequence:**
1. Load user dietary identity
2. Expand dietary restrictions (allergy expansion with hidden violation detection)
3. Load medical conditions and derive hard limits
4. Assemble medical optimization layers
5. Load glucose context (for diabetic users)
6. Build universal condition guidance
7. Load avoidances and behavioral preferences
8. Attach procedural rules (preparation, storage, equipment, instruction constraints, cross-contamination)

**Backend:** `server/services/protocolEnvelope.ts`, `server/services/allergyGuardrails.ts`, `server/services/enforcementGateway.ts`, `server/services/guardrails/`

**Status:** Fully implemented. All generators verified against this pipeline.

---

### Macro Truth Contract
**What it does:** Enforces a documented standard for AI macro data integrity across the platform.

**Rules:**
- `null` = unknown (macro value has not been determined)
- `0` = known zero (macro value is confirmed as zero)
- AI is prohibited from inventing macro values
- Macro values may be rejected or trigger regeneration, but are never mutated
- Macro injection is blocked for specific diet types where AI macro generation is unreliable

**Backend:** `server/services/guardrails/macroTruthContract.ts`

**Status:** Fully implemented.

---

## 8. Coach / ProCare Features

### ProCare Platform Overview
A full professional nutrition coaching and clinical management system built into the platform. Coaches and clinicians get a dedicated workspace. Clients access their coach's program directly through their standard subscription interface.

**Access requirement:** No one enters the ProCare queue without completed payment. Attestation (professional credential verification) required before full ProCare access is granted.

---

### Coach Onboarding and Identity
**What it does:** Professional credential attestation, identity verification, and ProCare welcome flow for new coaches joining the platform.

**Pages:** `client/src/pages/procare/ProCareAttestation.tsx`, `ProCareIdentity.tsx`, `ProCareWelcome.tsx`

**Backend:** `server/services/procareActivation.ts` — atomic transaction that creates studio membership + client link in a single operation. Handles reconnect (restores archived membership rather than creating duplicate).

**Status:** Fully implemented.

---

### Coach Dashboard and Portal
**What it does:** Primary professional workspace for trainers. Displays client roster, client progress, compliance scores, board status, and communication summary.

**Pages:** `client/src/pages/pro/ProClients.tsx`, `ProPortal.tsx`, `TrainerClientDashboard.tsx`, `WorkspaceShell.tsx`

**Status:** Fully implemented.

---

### Physician Portal
**What it does:** Separate portal calibrated for clinical practitioners. Displays patient nutrition protocols, lab results, clinical assignments, and protocol change history.

**Pages:** `client/src/pages/pro/PhysicianPortal.tsx`, `ProClientsPhysician.tsx`, `ClinicianClientDashboard.tsx`

**Backend:** `server/routes/patientAssignment.ts`, `server/routes/physicianReports.ts`

**Status:** Fully implemented.

---

### Client Roster Management
**What it does:** Coach manages a list of enrolled clients. Includes intake status, active protocol, compliance score, last activity, and quick access to individual client dashboards.

**Activation contract:** Client activation is atomic — both the studio membership and the client link are created or restored in a single transaction. Activity is logged on every state change.

**Roster sizes:** Plans support 5, 10, 25, 50, or 150 clients.

**Status:** Fully implemented.

---

### Pro Board (Weekly Meal Board for Clients)
**What it does:** Coach can view, edit, assign, lock, and unlock individual days on a client's weekly meal board. Board control system enforces that clients cannot modify coach-locked days.

**Pages:** `client/src/pages/pro/ProBoardViewer.tsx`

**Backend:** `server/routes/proBoardRoutes.ts`, `server/routes/proWeekBoard.ts`, `server/routes/lockedDays.ts`

**Status:** Fully implemented.

---

### Client Communication (Tablet System)
**What it does:** Async coach-client messaging system. Messages can be text, voice notes, or structured check-in entries. Supports entry types with visibility controls (coach-only vs. shared with client).

**Voice note pipeline:** Audio recorded → uploaded to object storage → queued in `tablet_voice_jobs` → `VoiceJobWorker` polls → downloads audio from S3 → transcribes via Whisper → content moderation → stored as `client_notes` record.

**Moderation:** `tabletModerationService.ts` screens voice note transcripts before storage.

**Backend:** `server/routes/proTabletRoutes.ts`, `server/routes/clientTabletRoutes.ts`, `server/services/tabletVoiceService.ts`, `server/services/tabletModerationService.ts`, `server/services/tabletNotificationService.ts`

**Status:** Fully implemented.

---

### Compliance and Adherence Tracking
**What it does:** Coach sees client's compliance score over rolling windows (7 or 30 days). Score reflects calorie adherence, protein adherence, and logging consistency. Pattern deviations are surfaced with context.

**Backend:** `server/services/complianceEngine.ts`, `server/routes/adherence.ts`

**Status:** Fully implemented.

---

### Client Biometrics Access
**What it does:** Coach can view client biometric trends (weight, body composition, glucose, vitals) within the ProCare workspace.

**Backend:** `server/routes/proBiometricsRoutes.ts`

**Status:** Fully implemented.

---

### Studio System
**What it does:** Multi-coach organization management. A studio has an owner, billing record, and memberships. Multiple coaches can be members of the same studio. Studio generator allows branded meal generation under the studio's identity.

**Database:** `server/db/schema/studio.ts` — `studios`, `studioBilling`, `studioMemberships`

**Backend:** `server/routes/studioRoutes.ts`, `server/services/studioBridge.ts`, `server/routes/studioGenerator.ts`

**Status:** Fully implemented.

---

### Creator System (Branded Kitchens)
**What it does:** Coaches and chefs can configure a custom name, description tone, and instruction style that is applied to AI-generated output styling. The medical and dietary constraint layer is never affected by creator configurations — safety guardrails are upstream of any styling.

**Database:** `server/db/schema/creatorSystemConfigs.ts`

**Pages:** `client/src/pages/creator/` — CreatorSetupPage, CreatorStartPage, CreatorStudioLanding, CreatorStudioPage

**Status:** Fully implemented.

---

### Pro Program History
**What it does:** Stores and surfaces the history of nutrition programs delivered to a client. Allows review of previous protocol configurations, macro targets, and plan changes.

**Backend:** `server/routes/proProgramHistory.ts`, `server/services/macroProgramHistory.ts`

**Status:** Fully implemented.

---

### Founders Program
**What it does:** Early-access professional tier for founding coach members. Distinct onboarding and access controls.

**Pages:** `client/src/pages/Founders.tsx`

**Backend:** `server/routes/foundersRoutes.ts`, `server/db/schema/founders.ts`

**Status:** Fully implemented.

---

## 9. Current Feature Status

### Fully Implemented
- All 12+ AI meal generation tools with Protocol Envelope enforcement
- Weekly Meal Board (user and coach-managed)
- Shopping list V2 (server normalization + client consolidation + retail intelligence)
- Retail Intelligence layer (60+ produce entries, meat/grain/dairy converters)
- Grocery delivery retailer integration (tablet/desktop)
- Shopping list export (PDF/text)
- Smart Scan / Ingredient Intelligence / MacroScan
- Ingredient Intelligence Store (fail-closed provenance database)
- Biometrics suite (weight, body comp, glucose, blood pressure, GLP-1 tracking, sleep)
- Compliance Engine (7/30-day rolling windows, composite scoring)
- Clinical protocols: GLP-1, Type 2 diabetes, anti-inflammatory, oncology support, thyroid, kidney disease, heart failure, liver support
- Protocol Envelope with 4-layer constraint hierarchy + procedural rules
- Macro Truth Contract
- Behavioral Memory Service (read-only, decay-scored preference derivation)
- ProCare professional platform (coach portal, physician portal, client dashboard, board system, studio management)
- Client communication tablet system with voice notes, moderation, and notification routing
- Household/family plans (up to 4 profiles, profile switching)
- Copilot conversational AI
- AI Voice Journal
- Multi-language voice input and translation
- Restaurant Guide, Find Meals Near Me, Fast Food Guide
- Pairing hubs (wine, beer, bourbon/spirits, AI pairings)
- Alcohol Hub and beverage systems
- Hormone tracking (men's and women's)
- Lab metrics and lab-to-protocol resolution
- Push notifications (VAPID), SMS (Twilio), email (Resend)
- Stripe subscription billing (web)
- Apple in-app purchase verification (iOS)
- Creator System / Branded Kitchens
- Studio multi-coach management
- Admin dashboard and moderation tools
- Cooking tutorials, cooking classes, cooking challenges
- Supplement education hub
- Daily journal and behavioral check-ins
- Macro logging, macro calculator, macro estimator

### Partially Implemented / In Active Development
- Voice transcription and command execution (infrastructure complete; gated by alpha feature flags)
- Social and community features (routes and data layer present; discovery surface expanding)
- Pattern alerts for glucose/biometric anomalies (logging implemented; alert intelligence expanding)
- Psychological profile service (defaults implemented; deep onboarding derivation in progress)
- Smart Scan OCR confidence and label edge cases (core pipeline complete; accuracy improving)
- Competition prep and beach body builders (implemented; deepening macro phase logic)

### Planned Roadmap
- White-label and multi-tenant enterprise deployment
- Educational institution curriculum bundle (product code provisioning at enrollment)
- EHR / health record system integration
- CGM (continuous glucose monitor) data ingestion
- Wearable device sync (Apple Health, Google Fit, Garmin, Fitbit)
- Registered dietitian and telehealth integration layer
- International cuisine intelligence and localization expansion
- Social meal sharing and community meal board features
- Pregnancy and postpartum nutrition protocol (backend service present; UI surface TBD)

---

## 10. Technical Notes

### Protocol Enforcement Gateway
**Services involved:** `protocolEnvelope.ts`, `allergyGuardrails.ts`, `enforcementGateway.ts`, `guardrails/prompt/*` (condition-specific prompt builders), `promptSanitizer.ts`

**Architecture decision:** Enforcement is pre-generation (prompt construction) AND post-generation (output scan). A meal that passes prompt-level constraints is still scanned after generation. This two-pass model catches AI hallucination of restricted ingredients that might slip past a prompt-only approach.

**Database structures:** User `dietaryIdentity`, `allergies`, `avoidances`, `medicalConditions` fields in `users` table (`shared/schema.ts`). Clinical protocol assignments in `clinicalProtocolRecommendations` schema.

---

### Shopping List Pipeline
**Services involved:** `server/services/shopping-list/builder-v2.ts` (server normalization), `client/src/lib/shoppingConsolidation.ts` (client consolidation), `client/src/lib/retailIntelligence.ts` (retail conversion)

**Architecture decision:** Two-stage consolidation was necessary because server-side grouping uses `name|unit` as a composite key — the same ingredient stored as both grams and mL remains two separate records at the server layer. The client-side consolidation engine resolves cross-unit duplicates at display time by grouping on normalized name regardless of unit, then converting everything through the retail intelligence layer.

**Database structures:** `shoppingListItems`, `shoppingListSources` in `shared/schema.ts`.

---

### Behavioral Memory
**Services involved:** `server/services/behavioralMemoryService.ts`

**Architecture decision:** Read-only, deterministic, evidence-based. The system never writes preferences to any enforcement structure. All preference signals are soft hints that are injected into generation prompts after the enforcement pass. Enforcement always re-runs post-generation regardless of preference hints. This prevents user behavior patterns from weakening safety constraints over time.

**Database structures:** `savedMeals`, `userRecipes`, `mealInstances` (status = 'logged') in `shared/schema.ts`.

---

### ProCare Activation
**Services involved:** `server/services/procareActivation.ts`, `server/services/clientLinkService.ts`, `server/services/studioBridge.ts`, `server/services/activityLog.ts`

**Architecture decision:** Activation is an atomic transaction — studio membership and client link are created or restored together, never partially. Reconnect logic restores archived records rather than creating duplicates, preserving historical compliance and program data. Every state change is written to the activity log for audit purposes.

**Database structures:** `studios`, `studioBilling`, `studioMemberships` in `server/db/schema/studio.ts`; `clientLinks` in `server/db/schema/procare.ts`.

---

### Voice Note Processing
**Services involved:** `server/services/voiceJobWorker.ts`, `server/services/tabletVoiceService.ts`, `server/services/tabletModerationService.ts`

**Architecture decision:** Voice notes are not processed synchronously. Audio is uploaded to object storage, a job is queued in `tablet_voice_jobs`, and the worker polls on an 8-second interval using `FOR UPDATE SKIP LOCKED` for safe concurrent processing. Maximum 3 attempts per job. This prevents timeouts on long transcription calls and supports horizontal scaling of the worker process.

**Database structures:** `tablet_voice_jobs`, `client_notes` tables.

---

### AI Cost Management
**Services involved:** `server/services/aiQuotaService.ts`, `server/services/costGuard.ts`, `server/services/aiTelemetry.ts`

**Architecture decision:** Every AI call is subject to quota enforcement before it executes. `costGuard.ts` provides a hard circuit-breaker layer. `aiTelemetry.ts` records usage per user per endpoint. Free tier has explicit generation limits; paid tiers have higher limits enforced server-side, not client-side.

---

*Document generated from implemented codebase — May 2026.*
*Primary sources: server/services/*, server/routes/*, client/src/pages/*, shared/planFeatures.ts, shared/schema.ts*
