# Ask Chef — Conversational Navigation and Platform Intelligence

## Scope and evidence

Development-only foundation review, 2026-11-01. This document is a read-only
coverage inventory: it does not add runtime knowledge, routes, permissions,
pricing, enrollment, or business functionality. No paid model calls or live
workflow acceptance tests were performed.

**Implemented in this increment:** narrow conversational instruction refinement;
source-reviewed suitability for Create a Dish, Grocery Store Coach > Build a Meal,
and Grocery Store Coach > Find a Product; exact Development terminology; mocked
regression coverage. Existing beverage/hydration suitability remains intact.

**Not implemented:** new professional, Business Suite, affiliate, white-label or
organization navigation, expanded clinical data, extra model calls, or additional
request-transfer contracts.

“Verified knowledge” below means source-reviewed facts in the existing knowledge
records, not a claim that every page was newly exercised end-to-end or that a live
model consistently chooses it. A registered route alone is insufficient evidence
of operational enrollment or availability for a particular account.

## Focused workflow verification

| Workflow | Verified inputs and outputs | Entry and access | Boundaries |
|---|---|---|---|
| **Create a Dish** | Editable dish description, servings, optional cooking preferences/notes and Ingredient Control / Keep It Simple. **Create My Dish** initiates the creator. The page also has a Create a Dish Menu and ingredient-expansion controls; these remain destination-owned, not prerequisites Chef must collect. Returns generated recipe/meal options through the existing human-food creator pipeline. | Approved `create_a_dish` → `/lifestyle/create-a-dish`. Chef's navigation class is authenticated; the page's `chefsKitchen` gate and generation guards still apply. | Suitable for preparing a chosen dish or meal, not automatically shopping. Only the existing member-grounded editable-idea transfer is authorized; opening is not generation. Authentication, authoritative food context, dietary/allergy/clinical checks and physician precedence remain unchanged. |
| **Grocery Store Coach → Build a Meal** | The visible tab is **Build a Meal**, not “Create a Meal.” It collects **How many people?** and a free-text meal request, retaining conversation context. `/api/grocery-coach/recommend` returns a meal, purchase list and explicitly owned ingredients. `/finalize-card` builds the recipe-card representation; the UI exposes list additions and refinements separately. | Both approved Grocery Coach destination IDs open `/shopping-list-v2`. Select **Grocery Store Coach**, then **Build a Meal**. Shopping List has its own access guard; Coach uses Pro/authorized full access. The meal API mount enforces authentication and Pro access. | Suitable when grocery shopping or planning what ingredients to purchase for a meal, including a named dish. Not the default for “I want to make chicken soup.” Current food-context, GLP-1, dietary, allergy, protocol and final-validation guards remain unchanged. No automatic sheet/tab opening, request transfer, generation or list write from Chef. |
| **Grocery Store Coach → Find a Product** | Separate **Find a Product** tab, typed/voice-populated product request. Calls `/api/biometrics/ingredient-scan-by-name`; the endpoint requires authentication and active access. Uses the current profile and knowledge-based product suggestions, aiming for three suitable recommendations, not verified live stock. | Approved `grocery_find_product` opens Shopping List only. Coach entry retains its own Pro guard in addition to endpoint access. | Discovery of products to buy, not full label verification or guaranteed allergy/medical clearance. Do not invent products to reach three. An actual product's label evaluation belongs to the separate **Product Scan** control. |

### Source evidence

- UI and wording: `client/src/pages/lifestyle/CreateDishPage.tsx`,
  `client/src/components/shopping/GroceryStoreCoachSheet.tsx`,
  `client/src/pages/ShoppingListMasterView.tsx`,
  `client/src/i18n/locales/en.json`, `client/src/components/Router.tsx`.
- Backend: `server/routes.ts`, `server/routes/groceryCoach.ts`,
  `server/routes/biometricsRoutes.ts`, `server/services/ingredientScanService.ts`.
- Authority: `shared/coaching/navigation.ts`,
  `server/services/coaching/conciergeGoal.ts`,
  `server/services/coaching/capabilityRegistry.ts`,
  `server/services/coaching/platformKnowledgeAccess.ts`.
- Existing knowledge: `featureUsageKnowledge.ts`, `platformKnowledge.ts`,
  `platformFeatureCatalog.ts`, `platformHelpKnowledge.ts`, and
  `conciergeInstructions.ts` under `server/services/coaching/`.

## Existing approved destinations and suitability coverage

The current allowlist contains **20 destinations**. Knowledge does not grant
subscription, onboarding, professional, household or clinical access.

| Group | Approved destinations | Knowledge coverage and remaining limitations |
|---|---|---|
| Focused food/shopping | Create a Dish; Grocery Store Coach — Build a Meal; Find a Product | Source-reviewed purpose, exclusions, missing-information judgment, offer/defer timing, safety and related-workflow guidance added in Development. Grocery destinations remain parent-page handoffs. |
| Beverages/hydration | Beverage Creator; Athlete Beverage Creator; Hydration Center | Existing Development suitability retained: ordinary drinks, performance drinks, fluid support and organization of explicit liquid instructions remain distinct. Hydration does not independently generate recipes or authorize treatment. |
| Other creators | Craving Creator; Dessert Creator; Fridge Rescue; Sushi Creator | Existing activity/readiness descriptions distinguish small cravings, larger desserts, using available ingredients and sushi. First three have reviewed usage controls; Sushi lacks a dedicated usage record. No new rich suitability records or transfers added here. |
| Dining/lifestyle | Restaurant Guide; Find Meals Near Me; My Perfect Buffet; My Perfect Getaway; My Perfect Gatherings | Existing purpose/readiness and usage facts cover ordering at a chosen restaurant, restaurant discovery, buffet choices, travel dining and gatherings. No live menus, specialty-store completeness, availability or universal restaurant accommodations are verified. |
| Meal starting pages | My Perfect Menu; Meal Builders | Reviewed entry-page guidance distinguishes suggested ideas from builder selection. Destination-owned subject/date/builder resolution and onboarding remain authoritative. No Chef planning payload or clinical-builder activation. |
| Other approved entries | Macro Calculator; My Perfect Beginnings | Existing description/readiness and access boundaries, but no dedicated usage-control records. Calculator does not automatically replace saved targets. Beginnings opens the child-selection hub, never an inferred child's context. |

Detailed decision/timing suitability is now present for six destinations in
Development. Other allowlisted destinations have varying existing descriptive
knowledge, not equivalent new suitability review. The allowlist and access
classes were not expanded or replaced.

## Knowledge-only, role-limited, missing and unverified pathways

| Area | Existing knowledge / implementation evidence | Chef navigation and remaining gap |
|---|---|---|
| Consumer tools | Existing member knowledge describes Smart Shopping List, Favorites, Recipe Maker, Biometrics, journals, Learn/tutorials, preferences, household profiles, personal Care Team, pets and account/support controls. | Most are informational only. Recipe Maker and Sources are dialogs, not guessed standalone routes. Coverage does not imply detailed control verification or a handoff for every subfeature. |
| Clinical and performance hubs | Existing catalog marks clinical hubs partial; existing knowledge describes Performance Hub. Destination-specific support, physician instructions, consent and protocol eligibility remain authoritative. | No new hub or specialized-builder navigation. A shared condition name does not justify common controls, clinical activation, inferred labs or targets. |
| Professional onboarding / Studios | Existing catalog has partial, role-filtered Professional ProCare Studios guidance. Router registers guarded physician/client/workspace routes. | Informational only; no approved Chef Studio or professional enrollment destination. Trainer self-description is not server-verified professional authority. Onboarding sequence, readiness and applicable entry controls need a focused future review. |
| Existing organization administration | Catalog has verified, server-role-filtered Business Suite Client Invitations guidance, with exact workspace and invitation limits. Router has Business Start/Setup/Dashboard and join entries. | No Chef action to create a business, select an organization, invite clients or grant access. Existing administrator information must not be presented as new-organization enrollment or general membership authority. |
| Affiliates | Router registers gated affiliate overview, choice, paths, certification and dashboard pages. | No approved Chef affiliate destination or dedicated suitability facts. Route registration is not proof of eligibility, commissions, enrollment availability or completed enrollment. Keep informational; future review must trace actual UI and backend. |
| White-label partnerships | Router registers a gated White Label Solutions page; `client/src/pages/WhiteLabelSolutions.tsx` contains information/application-related content. | No approved Chef white-label action or dedicated runtime suitability record. Active submission, review, pricing, partner eligibility and availability were not verified in this increment. Do not invent an application link or promise a partnership. |
| Organizational service inquiries | Business/organization entry routes and existing invitation facts are distinct from a commercial intake workflow for a large new organization. | No verified Chef inquiry, quoting or enrollment handoff. New-organization suitability and public versus authorized-admin pathways remain uncovered. |
| Unavailable features | Existing knowledge explicitly marks pregnancy activation/AI Pairing Advisor/cafeteria placeholders and disabled templates unavailable. | Do not offer these as active destinations. Preserve previously saved support and current care instructions. |

## Recommended future coverage order

These are inventory recommendations, not authorization to implement or run live
tests:

1. Founder-approved live acceptance of this narrow food/activity distinction,
   using conversation history and first-confirmation behavior; include ambiguous
   and safety-sensitive cases. Mocked preservation tests cannot establish model
   judgment.
2. Review professional onboarding and Studio entry separately from personal
   consumer nutrition, using verified server roles and the actual onboarding
   sequence.
3. Review affiliate, white-label and new-organization inquiries against their
   actual frontend/backend and access boundaries. Distinguish public information,
   applications and authorized management before proposing any navigation.
4. Fill remaining approved-destination usage/suitability gaps and knowledge-only
   consumer workflows where member need warrants it.
5. Review clinical/performance guidance individually under existing medical,
   physician, relationship and consent boundaries; never expand by analogy.

Production instructions and knowledge remain unchanged. Controlled live model
testing and any release require separate founder approval.
