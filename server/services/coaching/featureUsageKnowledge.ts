import type { CoachDestinationId } from "../../../shared/coaching/navigation";

interface FeatureUsageKnowledge {
  descriptionInput: string;
  controls: string[];
  generationAction: string;
  notes: string[];
  suitability?: Omit<FeatureSuitability, "verifiedSources">;
}

interface FeatureSuitability {
  purpose: string;
  suitableNeeds: string[];
  notFor: string[];
  informationNeeded: string[];
  offerWhen: string;
  deferWhen: string;
  safetyBoundaries: string[];
  relatedFeatures: string[];
  verifiedSources: string[];
}

/**
 * Verified interface facts, not tutorial scripts or new handoff contracts.
 * Sources are the existing creator pages named below. Deliberately omit controls
 * that have not been reviewed; the model must not fill gaps by guessing.
 */
export const FEATURE_USAGE_KNOWLEDGE: Partial<Record<CoachDestinationId, FeatureUsageKnowledge>> = {
  grocery_find_product: {
    descriptionInput: "In Shopping List, select Grocery Store Coach, then Find a Product. Enter the kind of grocery product you want to buy.",
    controls: ["Find a Product is a tab inside Grocery Store Coach, not Product Scan.", "Text and voice input remain owned by Grocery Coach."],
    generationAction: "Submit the request there for three personalized product recommendations using onboarding and the member's nutrition profile.",
    notes: ["Chef opens only Shopping List and must explain these next steps. No automatic tab opening or prefill.", "Existing Pro access and product safeguards govern results. Never invent products, evidence, availability or medical suitability to reach three options."],
  },
  product_scan: {
    descriptionInput: "In Shopping List, select Product Scan and capture the actual grocery product you want evaluated.",
    controls: ["Product Scan is separate from Grocery Store Coach's Find a Product tab."],
    generationAction: "Scan the product there for profile-based evaluation, an explanation of suitability and potentially three alternative products.",
    notes: ["Chef opens only Shopping List, not the scan dialog. No automatic scan or transfer.", "The existing product workflow owns label evidence, nutrition checks and alternatives; Chef must not perform that evaluation in chat."],
  },
  grocery_create_meal: {
    descriptionInput: "In Shopping List, select Grocery Store Coach, then Build a Meal (also called Create a Meal). Describe the meal help you want.",
    controls: ["Build a Meal and Find a Product are separate tabs in the same Coach sheet."],
    generationAction: "Request the meal there to generate a meal and corresponding grocery list.",
    notes: ["Chef opens only Shopping List, not the Coach sheet or its meal tab. No automatic generation or request transfer.", "Existing Pro access, profile and food safeguards remain authoritative."],
  },
  // client/src/pages/lifestyle/MyPerfectGetaway.tsx
  my_perfect_getaway: {
    descriptionInput: "Search location or venue, or choose one of the Tap & Go destinations.",
    controls: ["A matched catalog venue can offer a location or dining-area picker.", "Uncertain locations can be refined and searched again."],
    generationAction: "Follow the location prompts to request personalized food guidance.",
    notes: ["Only select a location or dining area if offered; not every venue has a picker. Suggestions are not verified current menus, ingredients, preparation, availability or nutrition.", "No Chef destination-prefill handoff exists."],
  },
  // client/src/pages/MyPerfectMenu.tsx (the /foods-i-enjoy route)
  my_perfect_menu: {
    descriptionInput: "Pick an idea type: Breakfast, Lunch, Dinner or Snack.",
    controls: ["Choose from the personalized ideas.", "Try 3 More requests different ideas.", "How It Works explains the workflow."],
    generationAction: "Choose an idea and follow the destination's date and meal-slot prompts to create it in the existing builder.",
    notes: ["The destination owns builder resolution, planning and generation; Chef does not select a builder or transfer a planning request."],
  },
  // client/src/pages/Builders.tsx
  meal_builders: {
    descriptionInput: "Review the builder choices on the Meal Builders landing page.",
    controls: ["Choose an available builder card; eligibility and setup can restrict choices."],
    generationAction: "Continue through the selected builder's own setup and meal workflow.",
    notes: ["Do not select or activate a specialized clinical builder for the member, bypass onboarding, or promise locked access."],
  },
  // client/src/pages/SocialRestaurantGuide.tsx
  restaurant_guide: {
    descriptionInput: "Follow the guided ordering flow, beginning with what you are craving.",
    controls: ["The introduction leads into the craving field.", "Later steps collect the restaurant and ZIP code."],
    generationAction: "Follow the guided prompts to request restaurant meal guidance.",
    notes: ["Do not promise Chef has transferred a craving or restaurant. Actual menu availability and accommodations require confirmation with the restaurant."],
  },
  // client/src/pages/SocialFindMeals.tsx
  find_meals_near_me: {
    descriptionInput: "Follow the guided flow, describe the meal you are craving, and enter a ZIP code or use the location control.",
    controls: ["Location sharing can fill the ZIP code.", "The existing price filter is optional."],
    generationAction: "Submit the meal search, then review personalized meal cards for up to three nearby restaurants, with up to two meals per restaurant.",
    notes: ["Location permission may be required. Cuisine-based suggestions do not verify current menu offerings. Favorites, Add to Meal Plan and the Biometrics handoff are available on meal cards; consumption is not logged automatically.",
      "Restaurant discovery is verified; dedicated ice cream shop, bar or grocery-store discovery is not verified. Explain that limit instead of promising comprehensive specialty-shop coverage."],
  },
  // client/src/pages/MyPerfectBuffetPage.tsx
  my_perfect_buffet: {
    descriptionInput: "Describe the foods actually available in the What's at the buffet? field, by typing or using its voice control.",
    controls: ["Add by category is optional.", "Build My Plates requests plate options."],
    generationAction: "Use Build My Plates after entering the available buffet foods.",
    notes: ["The member reviews the options and logs what they actually ate; opening this page does not log consumption."],
  },
  // client/src/pages/lifestyle/GatheringsPage.tsx
  my_perfect_gatherings: {
    descriptionInput: "Start with What's the occasion? and choose the gathering situation.",
    controls: ["The form changes with the selected situation.", "Servings and additional notes are available."],
    generationAction: "Follow the situation-specific form before using the page's creation action.",
    notes: ["Do not invent a universal sequence or promise Chef transferred event details. The destination owns food creation and safety checks."],
  },
  // client/src/pages/craving-creator.tsx
  craving_creator: {
    descriptionInput: "A craving-description text area accepts typing or the existing voice input.",
    controls: [
      "Servings selector: 1 through 10 recipe servings.",
      "Cooking method is optional: Stovetop, Oven, Air Fryer, Grill, Slow Cooker or No-Cook. Selecting the active option again clears it.",
      "Craving Category is optional and has a Clear control.",
      "Diet and cuisine controls; Custom Dietary Restrictions is shown when an explicit diet override is not active.",
      "Flavor Preference uses personal palate preferences or neutral seasoning for others.",
      "Ingredient Control / Keep It Simple controls whether complementary ingredients may be added to what was listed.",
    ],
    generationAction: "Use the Create action beneath the form when ready; the destination performs generation and its safety checks.",
    notes: [
      "Describe the desired craving; Chef does not need to collect every optional control before opening this feature.",
      "Servings describe recipe yield, not a medical portion prescription.",
      "Safety controls and alerts are not instructions to disable protections. Never recommend bypassing an allergy, glucose or clinical warning to generate food.",
    ],
  },
  // client/src/pages/lifestyle/CreateDishPage.tsx
  create_a_dish: {
    descriptionInput: "The dish-description field is editable, including the reviewed idea transferred from Chef.",
    controls: ["Servings selector.", "Cooking preferences and optional notes.", "Ingredient Control / Keep It Simple."],
    generationAction: "Create My Dish starts the destination's creation workflow.",
    notes: ["Review or edit a transferred idea before creating. Opening the page does not automatically generate food."],
  },
  // client/src/pages/fridge-rescue.tsx
  fridge_rescue: {
    descriptionInput: "The ingredient field accepts the ingredients the member already has and wants to use.",
    controls: ["Optional Cooking method choices.", "Servings choices.", "Keep It Simple ingredient control."],
    generationAction: "The page's generation action uses the entered ingredients and selected preferences.",
    notes: ["Enter ingredients on the destination; Chef has no approved ingredient-prefill handoff. Do not promise that missing ingredients will be bought or pantry inventory updated."],
  },
  // client/src/pages/BeverageCreator.tsx
  beverage_creator: {
    descriptionInput: "Describe the drink in the free-text field, or use the drink-type and flavor controls.",
    controls: [
      "Drink Type includes Cocktail and Dive Bar alongside ordinary drink types.",
      "Flavor selector and optional Additional Notes.",
      "Serving Size offers single, two drinks, pitcher or party-batch choices.",
      "Optional Dietary Requirements.",
    ],
    generationAction: "The page's drink-creation action starts beverage generation.",
    notes: ["Description versus selector requirements are validated by the page; do not insist every selector must be filled when a description is provided.", "No ordinary Chef drink-prefill contract exists; do not reuse Hydration's tokens."],
  },
  // client/src/pages/AthleteBeverageCreator.tsx
  athlete_beverage_creator: {
    descriptionInput: "Describe a performance drink in the free-text field.",
    controls: ["Performance Goal, Drink Type and Flavor selectors.", "Optional Additional Notes.", "Serving Size and Dietary Requirements controls."],
    generationAction: "Create My Drink starts the destination's beverage workflow.",
    notes: ["The page validates required inputs. Performance Goal is about the drink's purpose, not permission to invent personal electrolyte, fluid or macro targets."],
  },
  // client/src/pages/HydrationCenter.tsx and components/HydrationFourDoorPanels.tsx
  hydration_center: {
    descriptionInput: "Open My Perfect Hydration Center, then choose the section that matches your need. Chef opens the Hub, not a preselected section.",
    controls: [
      "Everyday Hydration: log fluids, review intake, and use optional preferences and practical barrier support.",
      "Athletic Hydration: supply activity context for practical support and an optional Athlete Beverage Creator handoff, not a fluid-replacement formula.",
      "Sick-Day Hydration: select what makes fluids difficult, review tolerability guidance and heed warning signs. This may help with difficulty tolerating fluids, not every report of nausea.",
      "Liquid Nutrition Support: enter only the explicit temporary liquid-diet instructions received. User-entered instructions remain unverified; Creator handoffs require complete, active, professionally verified instructions.",
    ],
    generationAction: "Hydration Center does not itself generate recipes. Its existing Everyday/Athletic Creator links can lead to beverage creation, which still requires the member's action in the destination.",
    notes: [
      "For making a regular shake, Beverage Creator is more appropriate. A shake is not automatically suitable for nausea or a prescribed liquid diet, and hydration is not a replacement for necessary nutrition.",
      "Chef does not transfer symptoms, prefill requests, select a section, activate protocols or manufacture Hydration handoff tokens. Current access and destination safeguards still apply.",
      "Do not invent fluid/electrolyte prescriptions or comprehensive medication checks. Preserve current clinical instructions; necessary medical assessment or urgent care takes priority over navigation.",
    ],
  },
  // client/src/pages/CravingDessertCreator.tsx
  dessert_creator: {
    descriptionInput: "Describe the dessert or use the dessert-type and flavor controls.",
    controls: [
      "Dessert-type and flavor selections; cake-specific controls appear for the appropriate cake selection.",
      "Additional Notes for requested details.",
      "Recipe yield describes how much the whole recipe makes, not how much one person eats.",
      "Optional Dietary Requirements.",
    ],
    generationAction: "Use the destination's dessert-creation action when ready.",
    notes: ["Yield options depend on the chosen dessert. Do not invent a universal serving range or instruct one person to eat an entire recipe."],
  },
};

/**
 * Development-only review of three existing features, not a routing engine.
 * These are source-verified capability facts and judgment guidance, never
 * medical eligibility, consent, or permission to navigate.
 */
const DEVELOPMENT_DRINK_SUITABILITY = {
  beverage_creator: {
    purpose: "Create ordinary beverage recipes for enjoyment, variety or a chosen drink, including smoothies, protein shakes, coffee and low-sugar drink requests.",
    suitableNeeds: ["Ordinary homemade beverage creation or variety, with preparation intent established in context."],
    notFor: ["Assessing impaired food or fluid tolerance, prescribing liquid nutrition, treating illness, or calculating hydration targets.", "Workout-specific formulation belongs to Athlete Beverage Creator."],
    informationNeeded: ["Whether the member wants beverage preparation rather than advice, ordering or buying, only if unresolved.", "Whether a circumstance affecting intake leaves a material safety or usefulness question unresolved; a drink format alone does not settle that."],
    offerWhen: "Offer naturally when ordinary beverage creation is useful and relevant uncertainty is resolved. A useful nutrition answer may include a suitable offer; not every answer needs one.",
    deferWhen: "A shake proposed as a way to cope with difficulty eating or drinking does not by itself establish ordinary beverage creation as the next step. Address the concern and any material uncertainty or necessary care before offering a recipe tool.",
    safetyBoundaries: ["The destination runs current dietary, allergy and clinical checks; a requested shake is not automatically tolerable or nutritionally adequate.", "Low-sugar controls do not guarantee sugar-free output. No medication-specific treatment or new personal targets."],
    relatedFeatures: ["Hydration Center may help an established fluid-intake barrier, not every symptom or drink mention.", "Athlete Beverage Creator serves actual performance-oriented drink creation."],
    verifiedSources: ["client/src/pages/BeverageCreator.tsx", "server/routes/beverage-creator.ts"],
  },
  athlete_beverage_creator: {
    purpose: "Create performance-oriented beverage recipes for training, endurance or recovery; not an individualized hydration prescription.",
    suitableNeeds: ["A member wants to prepare a pre-workout drink, post-workout recovery shake or other performance beverage."],
    notFor: ["Ordinary beverage variety without a performance purpose.", "Fluid-intake tracking, personalized sweat-loss replacement, electrolyte dosing, or treatment of symptoms."],
    informationNeeded: ["Whether the goal is performance beverage creation or help managing hydration around activity, only if context has not settled it.", "The destination collects drink, flavor, serving and preference details; Chef need not interview for all of them."],
    offerWhen: "A clear recovery-shake or other performance drink creation request can receive a natural offer without a detour through Hydration Center.",
    deferWhen: "For difficulty staying hydrated during activity, first consider Athletic Hydration support rather than assuming a recipe request. Defer any offer while a material safety question or necessary care remains.",
    safetyBoundaries: ["Preset macro ranges and electrolyte language in the form are recipe directions, not measured individual requirements or fluid-replacement calculations.", "Current destination dietary, allergy, clinical and access safeguards still apply."],
    relatedFeatures: ["Hydration Center's Athletic Hydration section organizes activity timing, type, optional duration and environment, and can hand off to this Creator.", "Beverage Creator handles ordinary drinks."],
    verifiedSources: ["client/src/pages/AthleteBeverageCreator.tsx", "client/src/components/HydrationFourDoorPanels.tsx", "server/routes/beverage-creator.ts"],
  },
  hydration_center: {
    purpose: "Support fluid intake and practical hydration barriers through Everyday Hydration, Athletic Hydration, Sick-Day Hydration and organization of explicit temporary liquid-diet instructions.",
    suitableNeeds: ["Fluid tracking or practical barriers, including low appetite.", "Difficulty staying hydrated around activity.", "Difficulty tolerating fluids while unwell, when support is appropriate alongside any required care.", "Organizing temporary liquid-diet instructions the member actually received."],
    notFor: ["Ordinary drink creation alone.", "Designing a specialized medical liquid-nutrition plan simply because someone struggles to eat.", "Diagnosis, treatment, comprehensive medication checks or independently prescribed fluid/electrolyte targets."],
    informationNeeded: ["Which underlying fluid-intake or instruction-organization need is present; nausea alone does not establish a hydration goal.", "Clarify food versus fluid tolerance or existing instructions only when it materially changes the next useful recommendation; do not assume a liquid diet was prescribed."],
    offerWhen: "Offer when a verified section addresses the established need and conversational readiness permits it. For long-workout hydration difficulties, Athletic Hydration can be the initial fit; a recovery-shake recipe request instead fits Athlete Beverage Creator.",
    deferWhen: "Prioritize useful coaching, material clarification and necessary medical follow-up over navigation. Do not automatically swap Beverage Creator for Hydration Center after a symptom mention, or repeat an earlier offer after circumstances change.",
    safetyBoundaries: ["Sick-Day Hydration has basic tolerability suggestions and warning signs, not a detailed symptom-adaptive treatment plan.", "Liquid Nutrition Support preserves existing instructions; user confirmation is not professional verification. Creator eligibility requires complete, active, professionally verified instructions; do not promise a complete professional verification workflow or a liquid recipe button.", "No comprehensive medication checks or newly activated pregnancy-specific guidance; preserve existing care instructions and current availability restrictions.", "Necessary care is never delayed for a question, Hub visit or drink recipe."],
    relatedFeatures: ["Everyday support can lead to Beverage Creator and Athletic support can lead to Athlete Beverage Creator through the Hub's own signed handoffs.", "Chef opens the Hub only: no section selection, symptom transfer, protocol activation or manufactured handoff tokens."],
    verifiedSources: ["client/src/pages/HydrationCenter.tsx", "client/src/components/HydrationFourDoorPanels.tsx", "server/services/hydration/hydrationHubService.ts", "shared/hydration/fourDoor.ts", "shared/pregnancyAvailability.ts"],
  },
} satisfies Partial<Record<CoachDestinationId, FeatureSuitability>>;

/** Source-reviewed activity distinctions; never keyword routing or new access. */
const DEVELOPMENT_FOOD_SUITABILITY = {
  create_a_dish: {
    purpose: "Create recipes for a chosen dish or full meal the member wants to prepare, rather than plan a grocery-shopping trip.",
    suitableNeeds: ["Preparation help for a particular dish, such as making chicken soup; the activity, not the food name, establishes fit."],
    notFor: ["Planning what groceries to purchase for a meal, product discovery, product-label evaluation, or choosing restaurant food.", "Existing dedicated creators still own small cravings, larger desserts, sushi and drinks."],
    informationNeeded: ["Whether the goal is preparing a dish or shopping for a meal, only if unresolved in the member's words and history.", "The destination collects servings and preparation preferences; do not interview for these before offering it."],
    offerWhen: "A chosen dish and preparation intent are sufficient for a relevant offer. Do not divert a clear cooking request to Grocery Store Coach or ask a shopping question already answered.",
    deferWhen: "Clarify only a genuinely unresolved activity or destination choice, and prioritize necessary care or safety concerns.",
    safetyBoundaries: ["Existing recipe, dietary, allergy, clinical and physician safeguards remain authoritative.", "The approved handoff carries only a member-grounded editable idea; opening does not generate food or grant access."],
    relatedFeatures: ["Grocery Store Coach > Build a Meal serves grocery-shopping meal planning.", "Find a Product discovers groceries to buy; Product Scan evaluates an actual product."],
    verifiedSources: ["client/src/pages/lifestyle/CreateDishPage.tsx", "server/routes.ts", "server/services/coaching/conciergeGoal.ts", "shared/coaching/navigation.ts"],
  },
  grocery_create_meal: {
    purpose: "Grocery Store Coach > Build a Meal helps plan a meal and the ingredients to purchase, with a generated meal and corresponding shopping list.",
    suitableNeeds: ["Grocery shopping or planning what to purchase for a meal, including a named dish when shopping is the actual goal."],
    notFor: ["Merely wanting to prepare a chosen dish without a shopping goal.", "Finding a packaged product, scanning a label, or generating a weekly meal board."],
    informationNeeded: ["Whether the member needs meal-shopping help rather than dish preparation, only if context has not settled it.", "How many people? and the meal request are entered in the destination; Chef need not collect them first."],
    offerWhen: "Recommend when the member's shopping or purchase-planning goal is clear; the exact UI tab is Build a Meal, not Create a Meal.",
    deferWhen: "Do not infer grocery shopping from soup or another food mention. Ask one activity question only when needed; use prior answers.",
    safetyBoundaries: ["Existing Pro access, authorized nutrition context, dietary, allergy, clinical and final food validation remain authoritative.", "Chef opens Shopping List only: no automatic Coach sheet, tab selection, request transfer, list writes or meal generation."],
    relatedFeatures: ["Create a Dish serves a chosen dish preparation request.", "Find a Product is the other Grocery Store Coach tab; Product Scan is separate."],
    verifiedSources: ["client/src/components/shopping/GroceryStoreCoachSheet.tsx", "client/src/i18n/locales/en.json", "server/routes/groceryCoach.ts", "server/routes.ts", "shared/coaching/navigation.ts"],
  },
  grocery_find_product: {
    purpose: "Grocery Store Coach > Find a Product discovers grocery products to buy using the member's onboarding and nutrition profile.",
    suitableNeeds: ["Locating or choosing a type of grocery product while shopping or planning a purchase."],
    notFor: ["Evaluating the label of an actual product the member has or is considering; that is Product Scan.", "Preparing a recipe, meal-shopping planning, or verifying live retailer inventory."],
    informationNeeded: ["Discovery of something to buy versus evaluation of an actual product, only if genuinely unresolved.", "The member enters the product request in Find a Product; Chef does not collect every product detail."],
    offerWhen: "The goal is grocery product discovery, not merely a food or brand mention. Explain that the member opens Grocery Store Coach and selects Find a Product after arriving in Shopping List.",
    deferWhen: "Clarify discovery versus label evaluation only when needed. Do not replace a clear meal or dish request with product search.",
    safetyBoundaries: ["Grocery Store Coach's Pro entry and the product endpoint's active-access, current-profile and evidence safeguards still apply.", "The workflow seeks three suitable recommendations; never invent products to reach three, guarantee medical suitability or promise stock. No Chef product prefill or automatic tab opening."],
    relatedFeatures: ["Build a Meal plans a meal and ingredients to purchase.", "Product Scan is a separate Shopping List control for actual-product evaluation."],
    verifiedSources: ["client/src/components/shopping/GroceryStoreCoachSheet.tsx", "client/src/i18n/locales/en.json", "server/routes/biometricsRoutes.ts", "shared/coaching/navigation.ts"],
  },
} satisfies Partial<Record<CoachDestinationId, FeatureSuitability>>;

const DEVELOPMENT_FEATURE_SUITABILITY = {
  ...DEVELOPMENT_DRINK_SUITABILITY,
  ...DEVELOPMENT_FOOD_SUITABILITY,
};

export function getFeatureUsageKnowledge(environment: string | undefined) {
  if (environment !== "development") return FEATURE_USAGE_KNOWLEDGE;
  const knowledge = { ...FEATURE_USAGE_KNOWLEDGE };
  // Correct member-facing terminology only in this authorized Development review.
  knowledge.grocery_create_meal = {
    ...FEATURE_USAGE_KNOWLEDGE.grocery_create_meal!,
    descriptionInput: "In Shopping List, select Grocery Store Coach, then Build a Meal. Describe the meal you want shopping help with.",
  };
  for (const id of Object.keys(DEVELOPMENT_FEATURE_SUITABILITY) as Array<keyof typeof DEVELOPMENT_FEATURE_SUITABILITY>) {
    // Source evidence is maintained here, not sent to the conversation model.
    const { verifiedSources: _sources, ...suitability } = DEVELOPMENT_FEATURE_SUITABILITY[id];
    knowledge[id] = { ...knowledge[id]!, suitability };
  }
  return knowledge;
}
