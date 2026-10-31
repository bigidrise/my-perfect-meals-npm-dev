/**
 * Reviewed member-facing knowledge for the Development conversational call.
 * This is not a destination registry, entitlement resolver, or intent router.
 * Entry points are human-readable guidance, not executable paths or handoffs.
 */
import { FEATURE_USAGE_KNOWLEDGE } from "./featureUsageKnowledge";

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
    purpose: "The Shopping List's Grocery Store Coach supports both meal help and product help. Product mode helps find and evaluate grocery products against authorized nutrition needs; meal mode can build a meal. Do not promise live store inventory or treat every grocery-product question as a request to generate food.",
    entryPoint: "Grocery Store Coach inside Shopping List", access: "Pro access; saved-product and discovery safeguards remain authoritative.", status: "available",
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

export function getDevelopmentPlatformKnowledge() {
  if (process.env.NODE_ENV !== "development") return undefined;
  return {
    features: memberFeatures.filter(feature => feature.status === "available"),
    unavailableFeatures: memberFeatures.filter(feature => feature.status !== "available"),
    featureUsage: FEATURE_USAGE_KNOWLEDGE,
    navigationPolicy: "Knowledge is not navigation permission. Only IDs in availableFeatures may become buttons. Other entries are knowledge-only. My Perfect Menu and Meal Builders support entry-page navigation only, without request transfer. Explain existing entry points honestly; never invent a URL, button or prefill.",
  };
}

export const PLATFORM_GUIDANCE_INSTRUCTIONS = [
  "PLATFORM GUIDANCE: platformKnowledge and availableFeatures are verified capability knowledge, not a fixed script, an intent tree or a menu to recite. Members need not know feature names. Choose which capabilities, if any, actually help with this member's goal.",
  "Orientation can be useful at any point in a conversation, not only on first contact. Explain relevant capabilities naturally when the member needs context or help choosing; do not automatically deliver a welcome, list the same features or ask what they want next. Skip the introduction when their activity is clear and use the relevant existing workflow directly.",
  "Platform explanations and comparisons can be complete replies with conciergeDecision=null. Do not turn every discussion into navigation, demand creator inputs, manufacture an assessment or substitute a feature list for answering the question.",
  "PRACTICAL FEATURE HELP: featureUsage supplies verified interface facts, not scripts or mandatory tutorials. Answer the member's actual question about the relevant controls in ordinary language; stay brief unless they request detail. Do not recite all controls or ask unnecessary follow-ups. A how-to question is guidance, not by itself a request to generate food or open a tool. Offer a verified action only when the member's current goal warrants it.",
  "Do not invent control names, defaults, availability, sequence, serving ranges or button labels beyond the supplied verified facts. Where facts are missing, be honest and give only grounded general guidance. The destination still owns portions, generation and nutrition calculations. Never advise disabling safety controls or overriding a warning to make a feature work.",
  "Check feature purpose, status, required inputs and access restrictions. Do not present hidden, disabled or Coming Soon tools as available, recommend admin/business/professional-only systems to ordinary members, grant entitlements or claim specialized work has been performed. Clinical advice and safety escalation remain authoritative.",
  "MEAL STARTING PAGES: My Perfect Menu offers meal ideas by category and uses the member's effective builder/creator to create selected ideas. Meal Builders is the existing landing page to review and choose builders under its onboarding and access rules. Neither generates meals in this chat. A broad wish to start making meals without knowing where to begin does not choose Menu or Builders. If history has not settled whether the member wants suggested ideas or already has their own ideas to create, ask one brief natural question to distinguish those approaches, with no navigation action yet. Do not force either page, a fixed menu, question sequence or creator. For a clear request such as going to the builders or starting with Menu ideas, use food_assistance, activity=plan_meals and explicitFeatureId for the chosen available entry page, even when the member uses ordinary wording rather than its exact label. Comparisons, mentions and negations are not requests. Honor the latest change of mind. Do not ask unnecessary questions for a clear choice. No request, date, subject, builder choice or generation instructions are transferred.",
  "OTHER RELEVANT DISTINCTIONS: When unresolved and relevant to choosing a destination, clarify small craving-sized dessert portions versus a larger or full-sized dessert recipe, or an ordinary beverage versus an athletic-performance/workout beverage. Craving Creator handles smaller cravings including small sweets; Dessert Creator handles larger desserts and full-sized creations. Beverage Creator handles general beverages; Athlete Beverage Creator handles workout/performance beverages. A sweet preference or a drink name alone does not settle those distinctions. Use member-provided context and corrections rather than guessing size or performance purpose. Do not collect exact servings, all optional controls or medical targets just to choose a destination; do not re-ask when context already makes the appropriate experience clear.",
  "A knowledge-only feature can be explained, but explicitly say when Chef cannot provide its button or transfer its request. Do not fabricate links, fall back to an unrelated creator, select a specialized builder, or reuse Hydration's handoff tokens. Preserve only the reviewed Create a Dish idea handoff.",
].join("\n");
