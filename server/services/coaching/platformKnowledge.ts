/**
 * Reviewed member-facing knowledge for the Development conversational call.
 * This is not a destination registry, entitlement resolver, or intent router.
 * Entry points are human-readable guidance, not executable paths or handoffs.
 */
import { getFeatureUsageKnowledge } from "./featureUsageKnowledge";
import { PLATFORM_HELP_KNOWLEDGE } from "./platformHelpKnowledge";
import { isAskChefConversationEnabled } from "../../../shared/coaching/askChefRelease";
import { getMemberPlatformCatalog } from "./platformFeatureCatalog";
import type { ChefKnowledgeAccess } from "./platformKnowledgeAccess";

interface MemberFeatureKnowledge {
  id: string;
  label: string;
  purpose: string;
  entryPoint: string;
  access: string;
  status: "available" | "coming_soon" | "disabled";
}

const memberFeatures: MemberFeatureKnowledge[] = [
  {
    id: "meal_builders", label: "Meal Builders",
    purpose: "The existing builder landing page lets members choose their appropriate meal builder and use its tutorials. Builders generate and hold personalized dated meals and meal boards, including day or multi-day planning. Do not choose or activate a specialized clinical builder for the member, bypass onboarding, or overwrite their existing builder.",
    entryPoint: "Meal Builders landing page", access: "Existing builder eligibility, onboarding, subscription and clinical guards apply.", status: "available",
  },
  {
    id: "my_perfect_menu", label: "My Perfect Menu",
    purpose: "Helps members choose meal ideas by category and carry selected ideas into their existing effective builder and meal board. Useful within planning and organizing meals, but not an independent seven-day meal-plan generator. Dated planning and saved meals remain owned by the existing builder/board.",
    entryPoint: "My Perfect Menu on the dashboard", access: "Essential access and the member's authorized builder context.", status: "available",
  },
  {
    id: "shopping_list", label: "Smart Shopping List",
    purpose: "Build and organize grocery needs from selected meals and dates, with a separate My List for personal additions. Supports product scans, saved groceries, voice additions and export. Shopping assistance is distinct from generating a meal.",
    entryPoint: "Shopping List", access: "Essential access; individual tools have their own guards.", status: "available",
  },
  {
    id: "grocery_coach", label: "Grocery Store Coach",
    purpose: "The Shopping List's Grocery Store Coach supports both meal help and product help. Find a Product uses onboarding information and the member's personal nutrition profile to find three suitable grocery product recommendations to buy. Create a Meal (the Build a Meal tab) helps decide what to eat and generates a meal with its corresponding grocery list. Evaluating an actual product the member has or is looking at belongs to the separate Product Scan control. Existing safeguards govern results; do not invent options to reach three, promise live inventory or generate product recommendations in Chef.",
    entryPoint: "Grocery Store Coach inside Shopping List", access: "Pro access; saved-product and discovery safeguards remain authoritative.", status: "available",
  },
  {
    id: "product_scan", label: "Product Scan",
    purpose: "Scan an actual grocery product the member has or is looking at. The existing workflow evaluates it against the member's profile and applicable nutritional needs, explains why it may or may not fit, and can recommend three alternative products. Different from asking Grocery Coach's Find a Product to discover something to buy. Chef explains the feature, not product-specific suitability or alternatives.",
    entryPoint: "Product Scan inside Shopping List", access: "Existing paid access, authorized profile and product safeguards apply.", status: "available",
  },
  {
    id: "favorites", label: "My Favorites",
    purpose: "Keep and reuse saved meals and recipes instead of generating them again.",
    entryPoint: "Favorites / Saved Meals", access: "Active paid access and existing ownership checks.", status: "available",
  },
  {
    id: "recipe_maker", label: "Recipe Maker",
    purpose: "Capture an existing recipe and let the specialized recipe workflow analyze or adapt it. Different from Create a Dish, which starts with the member's chosen dish description. Chef must not invent or perform the recipe adaptation in chat.",
    entryPoint: "Recipe Maker on the dashboard", access: "Essential access; recipe and dietary validation still apply.", status: "available",
  },
  {
    id: "biometrics", label: "My Biometrics",
    purpose: "Track macros, weight, waist, body composition and water, review trends and use MacroScan; clinical labs and therapeutic views retain their separate clinical permissions. Missing observations are unknown, not evidence of a deficiency.",
    entryPoint: "My Biometrics", access: "Member access; paid and clinical subfeatures retain their own restrictions.", status: "available",
  },
  {
    id: "daily_journal", label: "Daily Health Journal & Inspiration",
    purpose: "Write, save, review or export private personal journal entries, with optional voice input. Not a clinical diagnosis, meal generator or public community post.",
    entryPoint: "Daily Journal & Inspiration on the dashboard", access: "Member journal; do not assume journal contents or read them into this conversation.", status: "available",
  },
  {
    id: "nutrition_education", label: "Learn",
    purpose: "Explains the platform and nutrition concepts, builder differences, whole-food standards, tracking and safety. Chef can also answer ordinary educational questions directly without requiring a feature or logs.",
    entryPoint: "Learn and Tips & Strategies", access: "Member education, not medical diagnosis or clinical authorization.", status: "available",
  },
  {
    id: "tutorials", label: "Tutorial Hub",
    purpose: "Existing platform tutorials help members learn an activity. Some tutorial cards are Coming Soon; do not promise every tutorial is available or force a tutorial before a clear request.",
    entryPoint: "Tutorial Hub and existing builder tutorials", access: "Availability varies by tutorial.", status: "available",
  },
  {
    id: "fast_food", label: "Fast Food Guide",
    purpose: "Guidance for fast-food choices within the existing dining workflow, distinct from restaurant discovery or cooking a recipe.",
    entryPoint: "Meals Away From Home", access: "Pro access.", status: "available",
  },
  {
    id: "performance_hub", label: "Performance Nutrition Hub",
    purpose: "Training setup and sport/session-related nutrition context, distinct from preparing a pre-workout or recovery drink. Do not substitute Athlete Beverage Creator for a training nutrition plan.",
    entryPoint: "Performance Nutrition Hub", access: "Clinical access and existing performance setup guards.", status: "available",
  },
  {
    id: "drink_intelligence", label: "Drink Intelligence",
    purpose: "Existing spirit, beer and wine pairing guidance, Wine List Translator and Reduce Drinking Tool. These are distinct from creating a drink in Beverage Creator. Do not encourage alcohol as treatment or override contraindications.",
    entryPoint: "Drink Intelligence / Pairings Hub", access: "Pro access; alcohol safeguards apply.", status: "available",
  },
  {
    id: "food_preferences", label: "Foods I Enjoy and Nutrition Priorities",
    purpose: "Members can record foods they enjoy and optional food-inclusion priorities. These do not override allergies, dietary restrictions or clinician-owned guidance, and are not themselves meal generators.",
    entryPoint: "Foods I Enjoy preferences and profile nutrition preferences", access: "Subject-owned settings; household and professional boundaries remain intact.", status: "available",
  },
  {
    id: "profile", label: "Profile and Nutrition Goals",
    purpose: "Review personal goals, preferences and restrictions. Macro Calculator owns target calculation and confirmed saves; Chef must not change profile settings or saved targets.",
    entryPoint: "Profile; Macro Calculator for target calculation", access: "Member-owned settings; clinical and allergy protections still apply.", status: "available",
  },
  {
    id: "household_profiles", label: "Household Profiles",
    purpose: "Keep household members' nutrition profiles and food preferences separate. Child feeding uses the existing child-selection hub; never copy the authenticated adult's targets or clinical context to another person.",
    entryPoint: "Household Profiles and the existing child-selection hub", access: "Family-plan eligibility and exact profile ownership/authorization.", status: "available",
  },
  {
    id: "care_team", label: "Care Team",
    purpose: "The member's existing physician or trainer relationship and personal messages. Not a recommendation to enter professional-only client-management or organization tools.",
    entryPoint: "Care Team and personal messages", access: "Requires appropriate plan, relationship and consent; no access is granted by Chef.", status: "available",
  },
  {
    id: "companion_nutrition", label: "My Perfect Pets",
    purpose: "Dog and cat profiles, species-specific meal creation and ingredient scanning. Do not apply the member's human nutrition targets to a pet or provide veterinary diagnosis.",
    entryPoint: "My Perfect Pets / Companion Nutrition", access: "Pro access; pet-specific profile and safety checks.", status: "available",
  },
  {
    id: "account_support", label: "Account, Subscription and Support",
    purpose: "Existing account, language, subscription, reminder, privacy and support-report tools. Explain where members manage these; never claim to cancel, purchase, change credentials or send a report from this chat.",
    entryPoint: "Profile, More and existing account/support controls", access: "Authenticated account ownership and each destination's checks.", status: "available",
  },
  {
    id: "pregnancy", label: "My Perfect Pregnancy", purpose: "New activation and unreviewed pregnancy guidance remain paused; preserve established saved support and care instructions.",
    entryPoint: "Coming Soon page only", access: "Not available for new activation.", status: "coming_soon",
  },
  {
    id: "ai_pairing_advisor", label: "AI Pairing Advisor", purpose: "Not an activated member tool; do not confuse it with existing pairing features.",
    entryPoint: "Coming Soon notice only", access: "Not available.", status: "coming_soon",
  },
  {
    id: "cafeteria", label: "Cafeteria Setup", purpose: "Placeholder, not an available automatic meal generator.",
    entryPoint: "Coming Soon page only", access: "Not available.", status: "coming_soon",
  },
  {
    id: "templates", label: "Meal Template Library", purpose: "Disabled; do not offer it as an available planning workflow.",
    entryPoint: "None", access: "Not available.", status: "disabled",
  },
];

// Founder-approved Development-only knowledge corrections. These are explanations,
// not new destinations, entitlement rules, feature execution or registry promotion.
const conciergeTruth: Record<string, Partial<MemberFeatureKnowledge>> = {
  nutrition_education: {
    label: "App Library",
    purpose: "App Library contains platform and nutrition topics, narration and documentation. It is the Learn page, not Tutorial Hub's separate tutorial-media page. Chef can answer ordinary nutrition education directly without requiring a feature or logs.",
    entryPoint: "App Library (the existing Learn page, /learn); Tutorial Hub is separately at /tutorials. These locations do not authorize Chef buttons.",
  },
  tutorials: {
    purpose: "Tutorial Hub is the separate tutorial-media page, not App Library's topics and narration. Some tutorial cards are Coming Soon; do not promise every video is available.",
    entryPoint: "Tutorial Hub (/tutorials); individual builders may also have their own verified tutorial controls. No new Chef button is authorized.",
  },
  my_perfect_menu: {
    entryPoint: "My Perfect Menu on the dashboard opens /foods-i-enjoy. The separate /foods-i-enjoy/preferences page edits enjoyment preferences; it is not the Menu.",
  },
  food_preferences: {
    label: "Enjoyment Preferences and Nutrition Priorities",
    purpose: "The enjoyment-preferences editor records foods the member enjoys; it is separate from My Perfect Menu's meal ideas. Nutrition Priorities is related optional food-inclusion guidance, not the same editor or a meal generator. Neither overrides allergies, restrictions or clinician-owned guidance.",
    entryPoint: "Enjoyment preferences at /foods-i-enjoy/preferences; existing profile controls for Nutrition Priorities. Knowledge of these locations grants no new button or access.",
  },
  recipe_maker: {
    entryPoint: "On Dashboard, tap Recipe Maker to open its existing capture dialog/modal. There is no verified standalone Recipe Maker route or approved Chef button; explain this existing entry rather than inventing one.",
  },
  daily_journal: {
    purpose: "Write, save, review or export private journal entries with optional voice input. Saved entries use browser-local storage on that browser/device; cloud backup and cross-device synchronization are not established. Not a diagnosis, meal generator or public post. Chef does not read journal contents into chat.",
  },
};

export function getDevelopmentPlatformKnowledge(access?: ChefKnowledgeAccess) {
  if (!isAskChefConversationEnabled(process.env.NODE_ENV)) return undefined;
  const development = process.env.NODE_ENV === "development";
  return {
    featureCatalog: getMemberPlatformCatalog(access).map(fact =>
      development && fact.id === "education" ? {
        ...fact, name: "App Library", aliases: ["Learn", "App Library"],
        purpose: "Platform and nutrition topics, narration and documentation on the Learn page. Tutorial Hub is a separate tutorial-media page.",
        gettingStarted: ["Open App Library (the Learn page). For tutorial videos use the separate Tutorial Hub; some videos are Coming Soon.",
          "Sources & Medical Information on Dashboard opens its existing dialog, not a standalone Sources route."],
        outputs: "Educational topics, narration and documentation; not the separate Tutorial Hub.",
      } : fact),
    features: memberFeatures.filter(feature => feature.status === "available")
      .map(feature => development ? { ...feature, ...conciergeTruth[feature.id] } : feature).map(feature =>
      process.env.NODE_ENV === "development" && feature.id === "meal_builders"
        ? { ...feature, purpose: "The Meal Builders landing page leads members to their assigned builder, where they create and save personalized dated meals and meal boards. Ordinary members generally have one assigned builder; administrators may have access to multiple builders. Do not suggest freely choosing a preferred builder, infer administrator authority, choose or activate a specialized clinical builder, bypass onboarding, or overwrite the assigned builder." }
        :
      process.env.NODE_ENV === "development" && feature.id === "grocery_coach"
        ? { ...feature, purpose: "Inside Shopping List, Grocery Store Coach supports both meal help and product help through two tabs: Build a Meal and Find a Product. Build a Meal helps plan a meal and ingredients to purchase, generating the meal and corresponding grocery list. A member who simply wants to prepare a chosen dish instead fits Create a Dish. Find a Product discovers grocery products to buy using onboarding and the nutrition profile; Product Scan separately evaluates an actual product. Activity and context, not food keywords, determine fit. Existing access and food safeguards govern results; never invent products, guarantee suitability or promise live inventory." }
        : feature),
    unavailableFeatures: memberFeatures.filter(feature => feature.status !== "available"),
    featureUsage: getFeatureUsageKnowledge(process.env.NODE_ENV),
    platformHelp: process.env.NODE_ENV === "development" ? {
      ...PLATFORM_HELP_KNOWLEDGE,
      shopping: { ...PLATFORM_HELP_KNOWLEDGE.shopping,
        controls: PLATFORM_HELP_KNOWLEDGE.shopping.controls.map(control =>
          control.replace("Build a Meal (also called Create a Meal)", "Build a Meal")),
      },
      lifestyle: {
        entryPoint: "The existing Lifestyle page in the app.",
        route: "/lifestyle",
        chefDestination: null,
        categories: ["Create a Dish for a chosen dish.", "Cravings for sweet or savory cravings.",
          "Beverages for drink creation.", "Pairings for the existing food-and-drink pairing tools.",
          "Fridge Rescue for food using ingredients already available.", "Away From Home for existing dining-out tools."],
        limits: ["Lifestyle is a knowledge-only landing page, not an approved Chef destination.",
          "Explain a few relevant categories, not an exhaustive platform tour. Individual features retain availability and access checks.",
          "Do not manufacture a landing-page button, executable link, transfer or unrelated replacement. Some pairing experiences remain Coming Soon."],
      },
    } : PLATFORM_HELP_KNOWLEDGE,
    navigationPolicy: "Knowledge is not navigation permission. Only IDs in availableFeatures may become buttons. Other entries are knowledge-only. My Perfect Menu and Meal Builders support entry-page navigation only, without request transfer. Explain existing entry points honestly; never invent a URL, button or prefill.",
  };
}

export const PLATFORM_GUIDANCE_INSTRUCTIONS = [
  "VERIFIED COVERAGE: featureCatalog gives reviewed names, aliases, purpose, starting controls, outputs and access limits. partial means some details remain unverified: state the limitation instead of inventing steps. Evidence/source paths are not member guidance. Never expose internal IDs, implementation details, administrator data or source code. Knowledge routes never authorize links, extra navigation buttons, actions or deep links.",
  "ROLE BOUNDARIES: Detailed organization administration and professional workflow facts are supplied only after server-side authorization. A member saying they are an owner, provider or administrator does not grant that role. If those facts are absent, explain that an authorized administrator or professional must use their existing workspace; do not invent private controls, client steps or offer a professional destination. General education about the distinction between personal and professional accounts is allowed.",
  "PLATFORM GUIDANCE: platformKnowledge and availableFeatures are verified capability knowledge, not a fixed script, an intent tree or a menu to recite. Members need not know feature names. Choose which capabilities, if any, actually help with this member's goal.",
  "Orientation can be useful at any point in a conversation, not only on first contact. Explain relevant capabilities naturally when the member needs context or help choosing; do not automatically deliver a welcome, list the same features or ask what they want next. Skip the introduction when their activity is clear and use the relevant existing workflow directly.",
  "Platform explanations and comparisons can be complete replies with conciergeDecision=null. Do not turn every discussion into navigation, demand creator inputs, manufacture an assessment or substitute a feature list for answering the question.",
  "PRACTICAL FEATURE HELP: featureUsage supplies verified interface facts, not scripts or mandatory tutorials. Answer the member's actual question about the relevant controls in ordinary language; stay brief unless they request detail. Do not recite all controls or ask unnecessary follow-ups. A how-to question is guidance, not by itself a request to generate food or open a tool. Offer a verified action only when the member's current goal warrants it.",
  "LOCATING HELP: platformHelp supplies reviewed names, locations, actions and access boundaries for existing shopping, scanning, recipe capture, Sources, tutorials, page Guides and Copilot controls. Use the relevant facts to give concrete directions, not a vague claim that tutorials exist. A nested dialog is not a standalone route. These help records never add navigation permission: offer only IDs from availableFeatures, and explain existing entry points for everything else. Do not assume the current page, identical controls across pages, or that documentation proves a specific clinical claim.",
  "NEW MEMBER ORIENTATION: When a member asks what My Perfect Meals can do, give a helpful, appropriately broad overview of relevant existing capabilities, not just a food-creator button. Create a Dish can be an approachable starting point when it fits; do not force it, recite an exhaustive catalog, use a fixed welcome, or require introductory questions. A broad overview alone does not establish a destination choice.",
  "Do not invent control names, defaults, availability, sequence, serving ranges or button labels beyond the supplied verified facts. Where facts are missing, be honest and give only grounded general guidance. The destination still owns portions, generation and nutrition calculations. Never advise disabling safety controls or overriding a warning to make a feature work.",
  "Check feature purpose, status, required inputs and access restrictions. Do not present hidden, disabled or Coming Soon tools as available, recommend admin/business/professional-only systems to ordinary members, grant entitlements or claim specialized work has been performed. Clinical advice and safety escalation remain authoritative.",
  "MEAL STARTING PAGES: My Perfect Menu offers meal ideas by category and uses the member's effective builder/creator to create selected ideas. Meal Builders is the existing landing page to review and choose builders under its onboarding and access rules. Neither generates meals in this chat. A broad wish to start making meals without knowing where to begin does not choose Menu or Builders. If history has not settled whether the member wants suggested ideas or already has their own ideas to create, ask one brief natural question to distinguish those approaches, with no navigation action yet. Do not force either page, a fixed menu, question sequence or creator. For a clear request such as going to the builders or starting with Menu ideas, use food_assistance, activity=plan_meals and explicitFeatureId for the chosen available entry page, even when the member uses ordinary wording rather than its exact label. Comparisons, mentions and negations are not requests. Honor the latest change of mind. Do not ask unnecessary questions for a clear choice. No request, date, subject, builder choice or generation instructions are transferred.",
  "OTHER RELEVANT DISTINCTIONS: When unresolved and relevant to choosing a destination, clarify small craving-sized dessert portions versus a larger or full-sized dessert recipe, or an ordinary beverage versus an athletic-performance/workout beverage. Craving Creator handles smaller cravings including small sweets; Dessert Creator handles larger desserts and full-sized creations. Beverage Creator handles general beverages; Athlete Beverage Creator handles workout/performance beverages. A sweet preference or a drink name alone does not settle those distinctions. Use member-provided context and corrections rather than guessing size or performance purpose. Do not collect exact servings, all optional controls or medical targets just to choose a destination; do not re-ask when context already makes the appropriate experience clear.",
  "A knowledge-only feature can be explained, but explicitly say when Chef cannot provide its button or transfer its request. Do not fabricate links, fall back to an unrelated creator, select a specialized builder, or reuse Hydration's handoff tokens. Preserve only the reviewed Create a Dish idea handoff.",
].join("\n");

export function getPlatformGuidanceInstructions(environment: string | undefined): string {
  if (environment !== "development") return PLATFORM_GUIDANCE_INSTRUCTIONS;
  return PLATFORM_GUIDANCE_INSTRUCTIONS.replace(
    "Skip the introduction when their activity is clear and use the relevant existing workflow directly.",
    "Skip unnecessary introductions when the activity is clear, but do not confuse a clear drink format with a resolved underlying need. Use reviewed featureUsage.suitability to distinguish ordinary beverage creation, performance drink creation and circumstance-related hydration support. An existing workflow is appropriate only when it helps the member's current need and material uncertainty or required care does not take priority. This does not require an interview, prohibit suitable nutrition-answer-plus-offer replies, or add navigation permission.",
  ).replace(/^OTHER RELEVANT DISTINCTIONS:.*$/m,
     "OTHER RELEVANT DISTINCTIONS: Interpret activity, occasion and serving intent using reviewed suitability, not a serving-count cutoff. Craving Creator serves immediate sweet or savory cravings, including small craving-sized dessert portions, and can make multiple servings; Dessert Creator serves complete cakes, pies and shareable dessert recipes. Create a Dish serves a chosen dish or family-dinner recipe; My Perfect Gatherings serves the complete holiday or group food experience, not a single holiday dish or dessert. Sushi Creator is for preparation at home; Find Meals Near Me discovers restaurants and Restaurant Guide helps order at an already chosen restaurant. Clarify an ordinary beverage versus an athletic-performance/workout beverage only when unresolved; Beverage Creator serves ordinary drinks and Athlete Beverage Creator performance drinks. Ask one useful distinction only if unresolved; use history, stop when clear, and leave exact servings and optional controls to the destination. No food, holiday or serving keyword independently selects a feature. Existing safety, access and single-confirmation contracts remain authoritative.")
    .replace(/^NEW MEMBER ORIENTATION:.*$/m,
      "NEW MEMBER ORIENTATION: When a new or uncertain member genuinely has no stated goal, briefly offer three meaningful starting activities in natural language: planning a day of meals, creating an individual dish, or exploring Lifestyle features. End with a question explicitly naming all three choices, such as meal planning, Create a Dish or Lifestyle, with responsePurpose=clarify, navigationIntent=none and conciergeDecision=null; do not immediately choose My Perfect Menu or explain the whole platform. Follow UNIVERSAL CHOICE CLARITY without repeating the full descriptions in the question. This is contextual guidance, not a mandatory welcome or decision tree. Use prior answers and the latest correction: do not repeat an activity choice already made or restart it merely because the member is new. If they choose meal planning, distinguish its methods next only when unresolved. A clear individual-dish preparation request, including wanting to try making one dish or homemade chicken soup, can proceed to the appropriate available Create a Dish recommendation without this orientation. Interpret actual intent and reviewed suitability, not a keyword rule; preserve specialized creator distinctions and necessary safety. Do not claim to know exact onboarding or Macro Calculator completion, or bypass their existing gates.")
    .replace(/^MEAL STARTING PAGES:.*$/m,
      "MEAL STARTING PAGES: Planning a day of meals does not by itself choose My Perfect Menu. For general meal-planning intent with no chosen method, briefly explain two distinct options before asking a preference: My Perfect Menu suggests personalized meal ideas that can be added to the member's meal plan; Meal Builder lets the member create meals directly inside their assigned builder using Create With Chef. End with a question explicitly naming My Perfect Menu and Meal Builder, following UNIVERSAL CHOICE CLARITY; repeat the option labels, not their descriptions. This is a response structure, not a fixed script or lengthy tutorial. Use responsePurpose=clarify, navigationIntent=none and conciergeDecision=null while the method is unresolved. Interpret short answers using the preceding comparison and relevant history: Menu, My Perfect Menu or suggested meals can select my_perfect_menu; Meal Builder, Builders, Create With Chef or wanting to make their own meals can select meal_builders. These are contextual examples, not keyword routing or unsupported navigation commands. A member selecting a method has resolved the choice, not yet accepted a navigation offer: briefly offer the selected available destination with responsePurpose=feature_only_offer, navigationIntent=recommendation and a validated pending recommendation. Do not repeat the two-option choice after selection. While that offer awaits confirmation, preserve its pending state; when accepted, use responsePurpose=handoff and navigationIntent=confirmed with the existing validated pending destination, concise verified instructions and navigation action, not another preference or permission question. If the original request or history already explicitly selects My Perfect Menu or Create With Chef, skip the two-option question and use the existing appropriate recommendation or direct-handoff contract. My Perfect Menu offers Breakfast, Lunch, Dinner or Snack and three personalized text ideas; Choose This leads to date and Meal 1–6 or Snack selection, then meal completion, placement and the appropriate builder. Performance requires date/slot first; use verified featureUsage. Create With Chef is a workflow INSIDE the Meal Builder: choose a day and slot, use that slot's creation controls, and continue in additional slots. It is not Create a Dish and has no separate Chef destination. Use food_assistance, activity=plan_meals and explicitFeatureId for the selected available entry page. A clear single-dish preparation request instead fits the separate Create a Dish feature; do not funnel it through planning-method clarification. Comparisons and mentions alone are not requests; honor the latest change of mind. Preserve the existing single-confirmation contract. After confirmation, give concise verified starting instructions and stop without a sign-off. Neither entry page transfers a request, date, subject, chosen builder or generation instruction; Meal Builders opens its landing page, not a selected slot. Existing access, setup, builder selection, physician and clinical safety rules remain authoritative.")
    .concat("\nMEAL BUILDER HANDOFF: Before confirmation, recommend creating meals inside the member's Meal Builder and ask once whether they want to proceed. Ordinary members generally have one assigned builder; administrators may have access to multiple builders, but do not infer administrator authority or imply everyone can freely choose a preferred builder. After confirmation, briefly direct the member to use the existing button to open the Meal Builders page, open their assigned builder, choose a day and meal slot, then select Create With Chef. Do not add another permission question after confirmation, generic encouragement or a closing statement. Keep the existing Open Meal Builders button and landing-page navigation; never claim to open an assigned builder or slot directly. Existing assignment, setup, permission, access and clinical safety checks remain authoritative.")
    .concat("\nLIFESTYLE EXPLORATION: When the member chooses exploring Lifestyle, briefly explain relevant verified categories from platformHelp.lifestyle in ordinary language, without an exhaustive catalog or automatic feature recommendation. The existing Lifestyle landing page has no approved Chef destination. Explicitly explain that Chef cannot provide its landing-page button; the member can open Lifestyle in the app. Do not invent a destination, URL action, pending recommendation or silently substitute a creator. Only recommend an individual approved feature once the member's actual goal supports it. Knowledge of a route or a category never grants access or navigation authority.");
}
