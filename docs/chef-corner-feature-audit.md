# Chef's Corner: verified feature intelligence

Development review only. This audit does not authorize Production release or add
navigation destinations. Access classes below are the current Chef click-time
checks, not grants; destination page/API guards remain authoritative.

## Missing chicken Caesar action: findings and correction

The supplied live reply establishes that the action was missing, but does not
include the raw model decision. Its exact historical cause cannot be identified
from that prose alone. No live-model or account/database inspection was performed.

The active code had two demonstrated gaps:

1. JSON-object mode guaranteed JSON, not a recommendation contract. An absent or
   invalid `conciergeDecision` was silently converted to `undefined`.
2. A valid `food_assistance` goal with a null destination was returned unchanged,
   even when the existing readiness predicates matched exactly one available
   feature. Rendering correctly requires a destination and matching action item.

The Development correction uses the existing provider's strict structured-output
format in the same single call. Actions are validated after care escalation.
Ordinary conversation requires no action. A missing ID may be completed only
from a valid semantic goal that matches exactly one available, allowlisted feature
under the existing readiness predicates. It never classifies words, guesses
preparation from a food mention, repairs a rejected explicit destination, or picks
between multiple matches. Historical structured-engine validation keeps its old
behavior; completion is opt-in on the Development conversational path.

Instructions now distinguish selecting a dish during food discovery from merely
discussing it or asking about nutrition. A chosen chicken Caesar salad completes
discovery for Create a Dish, without assuming location, portions or ingredients.
The editable handoff remains grounded in the member's statements.

Runtime revision: `conversation-outcomes-v1`. Privacy-limited decision-outcome logs
distinguish model destinations, completed goals, no-navigation turns and invalid
decisions; they do not contain conversation or clinical data.

## Verified breakfast-shake runtime failure

The Development log matching the supplied breakfast-and-shake transcription records
`decision_outcome=goal_not_ready`, followed by a successful HTTP response containing
the retry message. That marker is emitted only after the provider returns, JSON
and the conversational payload parse, and decision validation rejects a proposed
destination. The exact proposed ID/goal values were not logged; do not infer them.
This was not evidence of an OpenAI outage, strict-schema rejection or render error.

The defect was treating action readiness as a prerequisite for a whole successful
conversation. Valid no-navigation replies were already accepted, but the rejected
action branch threw away the entire reply. The revised single-call contract makes
the action nullable and includes an independent model-authored conversational
continuation. If an action is rejected, only that independent continuation can be
used; the unchecked pitch and handoff are discarded. Its output must contain no
known feature names/routes or navigation links. If no safe continuation is present,
the response remains an explicit failure rather than a fabricated successful reply.
Provider failures and malformed conversational payloads still fail explicitly,
with privacy-limited failure-stage and HTTP-status diagnostics.

This does not introduce another call, hidden retry, intent keyword router,
automatic navigation, direct creator execution, new handoffs or new permissions.

## Approved Chef destinations

All are existing routes, not newly created features. "No Chef prefill" means no
reviewed general conversational request transfer, not that the feature cannot
accept manually entered descriptions.

| Feature / verified route | Purpose and output; recommend when | Member inputs | Handoff / current navigation access | Do not recommend when |
|---|---|---|---|---|
| Create a Dish — `/lifestyle/create-a-dish` | Creates meal options for a specific chosen dish/full-meal request. A selected chicken Caesar salad is sufficient. | Dish description; creator collects servings/preferences. | Reviewed editable `idea` prefill; authenticated navigation, then existing `chefsKitchen` page gate and generation safeguards. | Mere dish discussion, nutrition education, undecided food preference, eating out, or a dedicated sushi/dessert/drink request. |
| Craving Creator — `/craving-creator` | Generates a small savory craving/snack or smaller meal from the member's description, without needing a finished recipe. | Craving text, servings, optional category/preferences. | No Chef prefill. `replace`/`name` are replacement context. Pro navigation/page guard. | Hunger/light/flavor preference alone; full chosen meal, dessert, sushi, beverage, or restaurant request. Existing readiness contract uses snack occasion for this small savory path. |
| Dessert Creator — `/craving-desserts` | Generates desserts, including larger cakes, pies and pans, from an idea or selections. | Free-text idea or type/flavor/style, serving size and optional preferences. | No Chef prefill; Pro. | A savory craving, sweet preference without dessert preparation intent, restaurant dessert ordering, or nutrition education alone. |
| Sushi Creator — `/lifestyle/sushi-creator` | Generates sushi options from the member's sushi request. | Sushi description, servings, preferences. | No Chef prefill; replacement context is separate; Pro. | Eating sushi out, nutrition education or merely mentioning sushi. |
| Beverage Creator — `/lifestyle/beverage-creator` | Generates regular drinks, smoothies, shakes, cocktails/mocktails. | Free text or type/flavor, serving size/preferences. | Hydration-specific resolver exists; no general Chef handoff. Pro. | Workout-specific drinks, hydration prescriptions or a nutrition question alone. |
| Athlete Beverage Creator — `/lifestyle/athlete-beverage-creator` | Generates pre/post-workout or performance drinks. | Description or performance goal/type/flavor, serving size/preferences. | Hydration-specific resolver exists; no general Chef handoff. Pro. | Ordinary drinks, general training plans or medical fluid/electrolyte targets. |
| Fridge Rescue — `/fridge-rescue` | Creates food from ingredients the member actually wants to use. | Available ingredients and meal preferences. | No Chef prefill. Authenticated navigation; existing generation active-access/safety checks remain. | Home eating, hunger, indecision or meal planning without ingredient-use intent. |
| Restaurant Guide / Assistant — `/social-hub/restaurant-guide` | Helps choose an order at an already selected restaurant, using restaurant evidence. | Food/craving, selected restaurant, location/ZIP as needed. | No Chef prefill; Pro. | Finding a restaurant, cooking, or promising unavailable menu facts. |
| Find Meals Near Me — `/social-hub/restaurant-finder` | Discovers nearby restaurants/food sources. | ZIP or permitted location; preferences as supported by the destination. | No Chef prefill; Pro. | The restaurant is already chosen and order assistance is needed. Discovery is not a guarantee of verified live menu availability. |
| My Perfect Buffet — `/my-perfect-buffet` | Recommends choices from available buffet foods. | Buffet description/type or food categories, appetite/context. | No Chef prefill; Pro. | Restaurant discovery, invented buffet offerings, recipes or a meal board. |
| Hydration Center — `/hydration` | Hydration education/support using member context and verified guidance. | Destination-owned hydration context/preferences. | No arbitrary text prefill. Dedicated purchased-feature check, plus page guard. | Inventing targets, changing treatment or using its tokens for unrelated drinks. |
| Macro Calculator — `/macro-counter` | Calculates baseline nutrition targets in its existing workflow. | Measurements, activity and goals. | No Chef prefill; authenticated navigation and destination-owned save flow. | An explanation alone answers the question, or a tool would overwrite saved targets without confirmation. |
| My Perfect Beginnings — `/lifestyle/my-perfect-beginning` | Child-selection hub before child-specific assistance. | Authorized child selection. | No Chef prefill; Pro navigation and destination child authorization. | No child selected/authorized, or inventing child context. |
| My Perfect Getaway — `/lifestyle/my-perfect-getaway` | Travel-related food assistance. | Travel situation/location and preferences in destination. | No Chef prefill; Clinical navigation/page check. | General cravings, unrelated meal planning or a substitute clinical hub. |
| My Perfect Gatherings — `/lifestyle/my-perfect-gatherings` | Gathering/hosting food planning. | Occasion, guests, preferences/constraints in destination. | No Chef prefill; Pro. | Personal weekly boards or an individual craving without gathering intent. |

## Verified workflows without approved Chef buttons

These capabilities are supplied to Chef as knowledge-only limitations, not
available destinations. No allowlist or entitlement expansion was made.

| Workflow | Verified entry routes / availability | Purpose, inputs and limits |
|---|---|---|
| Builder selection and weekly meal planning | `/builders`, `/weekly`, `/weekly-meal-board`; existing builder/plan guards. `/planner` redirects to `/builders`. | Select the correct builder, subject, date and meal slots; manage saved boards. Chef has no reviewed hub navigation or request-transfer contract. Do not substitute Create a Dish for weekly planning. |
| My Perfect Menu | `/foods-i-enjoy` renders `MyPerfectMenu` under `PaywallGuard`. | Category ideas and selection tied to the server-resolved effective builder, subject/date and opaque context authority. Its own creator/builder handoffs are not a general Chef request interface. |
| General nutrition | `/general-nutrition-builder` guarded entry; `/general-nutrition-builder/build` is the actual builder. | Baseline nutrition setup and destination-owned builder context. Ordinary nutrition education remains conversational; do not bypass entry or saved-target confirmation. |
| Diabetes | `/diabetic-hub`, `/diabetes-support`, `/diabetic-builder` entry; `/diabetic-menu-builder` is guarded builder. | Requires authorized diabetes context; the destination owns glucose and protocol governance. No Chef clinical activation, glucose inference or direct builder navigation. |
| GLP-1 | `/glp1-hub`, `/glp1-builder` entry; `/glp1-meal-builder` is guarded builder. | Destination-owned medication/support context, tolerance and nutrition safety. No Chef activation, invented targets or deep-link bypass. |
| Anti-inflammatory / clinical builders | `/anti-inflammatory-builder` entry; `/anti-inflammatory-menu-builder` guarded builder. | Destination-specific eligibility/protocols. Existing professional `/pro/clients/:id/...` routes require exact professional/client authorization, never inferred from conversation. |
| Performance Hub | `/performance`, `/performance/setup`; existing Performance guards. | Training/sport context and fueling setup. Athlete Beverage Creator is not a replacement for a training plan. |

## Evidence reviewed

- Routing and guards: `client/src/components/Router.tsx`,
  `shared/coaching/navigation.ts`, `server/routes/coachingNavigation.ts`.
- Creator inputs/handoffs: `client/src/pages/lifestyle/CreateDishPage.tsx`,
  `client/src/pages/craving-creator.tsx`, `CravingDessertCreator.tsx`,
  `SushiCreator.tsx`, `BeverageCreator.tsx`, `AthleteBeverageCreator.tsx`.
- Dining inputs: `client/src/pages/SocialRestaurantGuide.tsx`,
  `RestaurantFinderPage.tsx`, `MyPerfectBuffetPage.tsx`.
- Governance/generation wiring: `server/routes/craving-creator.ts`,
  `dessert-creator.ts`, `beverage-creator.ts`, `fridgeRescue.ts`, `buffet.ts`;
  buffet resolves active nutrition, remaining macros, protocol and GLP-1 context.
  Creators retain their own allergy/diet/starch/clinical validation rather than
  accepting Chef text as authorization.
- Menu authority: `client/src/pages/MyPerfectMenu.tsx`,
  `server/routes/myPerfectMenu.ts`.
- Active recommendation and display contracts:
  `server/services/coaching/conciergeConversation.ts`, `conciergeGoal.ts`,
  `capabilityRegistry.ts`, and `client/src/components/coaching/CoachBubble.tsx`.

## Verification boundaries

Deterministic tests mock the model and persistence, execute the active engine,
exercise the exact supplied dialogue, omit its destination ID deliberately, and
check that one available creator and the grounded `Chicken Caesar salad` request
survive persistence and rendered click-time navigation. Additional cases cover
supported categories, education, discussion, ambiguity, unavailable/unsupported
features, strict response structure, safety escalation, and existing access checks.

These prove contract handling, not that every live semantic classification will
be correct. Paid live-model testing and authenticated end-to-end acceptance
remain separately authorized. No historical raw model output was available.
