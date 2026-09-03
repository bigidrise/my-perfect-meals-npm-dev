/**
 * buildTodaysNutritionAdjustment.ts
 *
 * Deterministic helper that converts a check-in + top intervention into a
 * specific, actionable "Today's Nutrition Adjustment" for the dashboard card.
 *
 * CONTRACT:
 * - Pure function — no API calls, no side effects, no AI.
 * - Signal-based overrides take priority over intervention key (e.g. hunger=1
 *   always maps to low-appetite copy regardless of what the engine scored).
 * - Returns null when no intervention is present (neutral/perfect day).
 * - Positive signals never cancel safety-relevant negative signals.
 * - Copy follows the coaching rule: direction + 1–2 examples + Chef handoff.
 * - CTA is action-oriented ("Build My Next Meal"), not navigation-oriented.
 * - Restaurant guide only appears for genuine environment exceptions (travel,
 *   vacation) where the user is away from their normal kitchen.
 */

export type MealMoment = "breakfast" | "lunch" | "snack" | "dinner" | "next meal" | "today";

export interface NutritionAdjustment {
  adjustmentTitle: string;
  adjustmentMessage: string;
  recommendedActionLabel: string;
  recommendedRoute: string;
  recommendedMealMoment: MealMoment;
  returnToPlanGuidance: string;
}

// ─── Time-of-day meal moment ───────────────────────────────────────────────

function currentMealMoment(): MealMoment {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 13) return "lunch";
  if (hour < 17) return "snack";
  if (hour < 21) return "dinner";
  return "next meal";
}

// ─── Adjustment copy map ───────────────────────────────────────────────────
// Coaching rule: direction → 1–2 examples → Chef handoff.
// Never overwhelm. Never be vague. Give enough to unstick, then hand off.

const ADJUSTMENT_MAP: Record<string, Omit<NutritionAdjustment, "recommendedMealMoment"> & { mealMoment: MealMoment | "auto" }> = {

  low_appetite: {
    adjustmentTitle: "Start small — don't force a full meal",
    adjustmentMessage:
      "Your appetite is low today. Something small but protein-rich is the right move — don't push through a full plate when your body isn't asking for it. A protein shake or a Greek yogurt bowl are both easy to get down without much effort. If neither sounds right, tell Chef what you feel like and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/beverage-creator",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Once your appetite comes back — usually by the next meal — return to your normal plan. No need to compensate for what you missed.",
  },

  travel: {
    adjustmentTitle: "Find one reliable option — don't aim for perfect",
    adjustmentMessage:
      "Your best move while traveling is finding one high-protein option wherever you land. Aim for 30g+ protein and stay ahead of dehydration. A grilled protein with a side or a high-protein wrap both work well in most travel situations. Use Restaurant Guide to find the best available option that fits your plan.",
    recommendedActionLabel: "Find a Good Option Nearby",
    recommendedRoute: "/social-hub/restaurant-guide",
    mealMoment: "today",
    returnToPlanGuidance:
      "Return to your normal routine once you're home. No reset needed — just pick up where you left off.",
  },

  high_stress: {
    adjustmentTitle: "Keep the next meal simple",
    adjustmentMessage:
      "High stress burns willpower — don't spend it deciding what to eat. The goal right now is high protein, minimal prep, minimal decisions. Build the best option from what's already available and get it done. If you're drawing a blank, tell Chef what you have and Chef will figure out the rest.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Once stress settles, return to your normal plan. One simplified meal isn't a setback — it's a smart call.",
  },

  decision_fatigue: {
    adjustmentTitle: "One decision, then done",
    adjustmentMessage:
      "You've made enough decisions today. The only question you need to answer right now is: what do you have available? Five ingredients or fewer. Tell Chef what's there and Chef will handle the rest.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Once the meal is handled, your full plan resumes tomorrow. Tonight, keep everything as simple as possible.",
  },

  sleep_deficit: {
    adjustmentTitle: "Poor sleep is affecting your hunger signals today",
    adjustmentMessage:
      "After limited sleep, ghrelin rises and cravings hit harder and earlier than usual. Keep protein high and avoid high-sugar options that spike and crash. A steady, balanced meal now is worth more than a perfect one later. If you're not sure what to build, tell Chef what sounds good and Chef will keep it on-plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Stick to your normal plan the rest of the day. Don't overcorrect — consistency matters more than compensation.",
  },

  low_energy: {
    adjustmentTitle: "Hydration first, then food",
    adjustmentMessage:
      "Low energy is often dehydration before it's a food problem. Drink 16oz of water right now, then build something with complex carbs and protein together. A protein smoothie or a balanced meal both cover the bases fast. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/beverage-creator",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Reassess energy after your next meal. Return to your full plan if it rebounds — and it usually does.",
  },

  dehydration_pattern: {
    adjustmentTitle: "Hydration comes before food right now",
    adjustmentMessage:
      "Start with 16oz of water before anything else. Then build something hydrating and easy to drink — something that covers both hydration and protein at once. A coconut water-based smoothie or an electrolyte shake are both solid options. If neither sounds right, tell Chef what sounds good and Chef will build around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/beverage-creator",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Keep drinking consistently through the day and return to your normal eating plan once hydrated.",
  },

  high_cravings: {
    adjustmentTitle: "Get ahead of the craving before it wins",
    adjustmentMessage:
      "Cravings are strongest right before your next meal and when protein is low. Build something high-protein now to take the edge off before the craving overrides your plan. A protein-first option satisfies the physiological hunger that drives most cravings. Tell Chef what you're craving and Chef will build the best version of it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "snack",
    returnToPlanGuidance:
      "Once satisfied, return to your scheduled meal at the normal time. The craving was the signal — protein was the answer.",
  },

  sweet_cravings: {
    adjustmentTitle: "Satisfy the sweet signal the smart way",
    adjustmentMessage:
      "Sweet cravings usually mean protein or fat is running low. Before you reach for something sugary, build something high-protein with a naturally sweet element. A protein shake with fruit or a Greek yogurt bowl both satisfy the craving without derailing the plan. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "snack",
    returnToPlanGuidance:
      "Once satisfied, return to your normal meal plan. The craving was a signal — not a failure.",
  },

  salty_cravings: {
    adjustmentTitle: "Check electrolytes before reaching for snacks",
    adjustmentMessage:
      "Persistent salt cravings often signal dehydration or electrolyte depletion. Start with water, then build something high-protein and savory. Cottage cheese with cucumber or a savory egg dish both satisfy the craving without the processed sodium. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "snack",
    returnToPlanGuidance:
      "Continue hydrating through the day and return to your normal plan at the next scheduled meal.",
  },

  meal_skipping: {
    adjustmentTitle: "Replace it — don't skip it",
    adjustmentMessage:
      "When the schedule is packed, skipping a meal feels like the fastest move — but it costs you later. Grab something portable and high-protein right now. Even a quick protein snack protects your energy and keeps cravings from compounding through the rest of the day. Tell Chef what's available and Chef will make it fast.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Return to your normal meal plan as soon as your schedule opens up.",
  },

  busy_day: {
    adjustmentTitle: "Portable and high-protein — that's the target today",
    adjustmentMessage:
      "Today's goal isn't a perfect meal — it's adequate protein without adding friction. Build the fastest high-protein option available from what you have. A quick egg scramble or a simple protein shake are both enough for today. If neither works, tell Chef what you have available and Chef will build something fast around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Return to your normal plan as soon as the day settles. A simplified day is still a successful day.",
  },

  low_motivation: {
    adjustmentTitle: "Lower the effort — not the standard",
    adjustmentMessage:
      "When motivation is low, the worst outcome is doing nothing. Build whatever decent protein option is already available — don't track today, don't plan ahead. Just eat something good enough, right now. Tell Chef what you have and Chef will figure out the rest.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "If today is rough, that's okay. Your full plan picks back up tomorrow — no reset or catch-up needed.",
  },

  burnout: {
    adjustmentTitle: "Simplify everything today",
    adjustmentMessage:
      "Nutrition fatigue is real. Your only job today is to eat something decent, not something perfect. Pick 3 familiar foods you know work for you and build from there. No tracking, no new rules — just one reasonable meal. Tell Chef what sounds familiar and Chef will keep it simple.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/fridge-rescue",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "When motivation returns — even partially — your normal plan is waiting exactly where you left it.",
  },

  mental_fatigue: {
    adjustmentTitle: "Stable blood sugar is the priority right now",
    adjustmentMessage:
      "Brain fog gets worse on blood sugar swings. Build a meal with protein and complex carbs together — steady fuel, no spikes, no skipping. Salmon and quinoa or eggs with whole grain toast are both strong options for mental clarity. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Return to your normal plan once the fog lifts. Consistent protein and carb timing is the fastest path there.",
  },

  digestive_distress: {
    adjustmentTitle: "Ease up on your digestive system today",
    adjustmentMessage:
      "With digestive discomfort, simpler is always better. Choose an easy-to-digest protein with cooked, gentle vegetables — nothing raw, heavy, or spicy today. Eggs with cooked zucchini or a light chicken and rice dish are both easy on the system. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Return to your normal eating pattern once discomfort subsides — typically within 24 hours.",
  },

  muscle_soreness: {
    adjustmentTitle: "Recovery nutrition is the priority right now",
    adjustmentMessage:
      "Elevated soreness means your muscles need protein and carbohydrates to repair. Target 30–40g protein in your next meal, paired with complex carbs to restore glycogen. A salmon and sweet potato bowl or a chicken and rice dish are both strong recovery options. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Continue with your normal plan after this recovery meal. Stay on top of protein for the rest of today.",
  },

  late_night_eating: {
    adjustmentTitle: "Lock in a satisfying dinner now",
    adjustmentMessage:
      "Late-night eating usually means daytime under-eating finally catches up at 9pm. Build a proper, satisfying dinner right now — high protein, moderate fat — so cravings don't win after the kitchen should be closed. A warm, complete meal is your best protection. Tell Chef what sounds good and Chef will build it around tonight's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "dinner",
    returnToPlanGuidance:
      "Normal plan resumes at breakfast tomorrow. Tonight, focus on eating a complete, satisfying dinner.",
  },

  emotional_eating: {
    adjustmentTitle: "Pause first — then eat well",
    adjustmentMessage:
      "If an emotional trigger is driving the urge to eat, take 10 minutes first — a short walk, water, fresh air. Then build a high-protein meal that genuinely satisfies. You're not suppressing the emotion — you're just not letting it drive the food decision. Tell Chef what sounds good and Chef will build something solid.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/beverage-creator",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "Once you've eaten a solid, complete meal, you're back on track. Normal plan continues from here.",
  },

  overeating_episode: {
    adjustmentTitle: "One meal doesn't change your plan",
    adjustmentMessage:
      "A single episode has no meaningful impact on your progress. Your only job right now is to eat a complete, high-protein next meal without compensating or restricting. No skipping, no punishment — just the next good meal, eaten normally. Tell Chef what sounds right and let Chef build it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "Your plan is already back on track the moment you eat that next solid meal. Nothing was lost.",
  },

  binge_risk: {
    adjustmentTitle: "Eat a complete, satisfying meal right now",
    adjustmentMessage:
      "Your body needs adequate fuel — not more rules. Build a complete, balanced meal with protein, complex carbs, and fat. Three structured meals today takes pressure off the entire system and breaks the restrict-binge cycle. Tell Chef what sounds satisfying and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "Three structured meals today, no restriction. Your plan is intact.",
  },

  restrictive_spiral: {
    adjustmentTitle: "Add, don't remove",
    adjustmentMessage:
      "Today's direction is abundance, not elimination. If you've been cutting foods out, add one back in a satisfying, protein-forward context. Build a complete, nourishing meal — the goal is eating more of the right things, not eating less. Tell Chef what sounds good and Chef will build around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "next meal",
    returnToPlanGuidance:
      "Continue building toward adequate, varied eating. Your plan grows forward from here.",
  },

  goal_drift: {
    adjustmentTitle: "One anchor meal to reset the compass",
    adjustmentMessage:
      "Eating has been drifting from your plan lately — and that's fixable with one intentional meal, not a full overhaul. Build your next meal specifically around your goal. That single deliberate choice is the reset. Tell Chef what fits your goal and Chef will build it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "From here, normal plan. No perfect week needed — just one good meal at a time.",
  },

  protein_deficit: {
    adjustmentTitle: "This meal needs to be protein-first",
    adjustmentMessage:
      "Protein intake has been running low. Target 30g minimum in your next meal — build the entire plate around the protein source first, then fill in around it. Don't change anything else. Tell Chef what protein sounds good and Chef will anchor the meal around it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Hit protein targets consistently for the next 3 meals, then reassess. Nothing else in your plan changes.",
  },

  fiber_deficit: {
    adjustmentTitle: "Add one fiber-rich food to your next meal",
    adjustmentMessage:
      "Fiber intake has been low. Today's goal is simple: add one high-fiber whole food to your next meal without changing anything else. Oats or lentils are both easy to add and pair well with most proteins. If neither works, tell Chef what you're building and Chef will work fiber in around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Aim for 5g more fiber per day, one meal at a time. Normal plan continues — just with better fiber choices.",
  },

  plateau: {
    adjustmentTitle: "Don't change everything — change one thing",
    adjustmentMessage:
      "A plateau is data, not failure. Before adjusting anything, audit protein adequacy today. If protein is hitting target, try a slight carb variation at one meal this week. One variable at a time — not a full overhaul. Tell Chef what you're thinking and Chef will build it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Normal plan continues. One controlled variation at one meal — watch what happens over the next 7 days.",
  },

  social_eating: {
    adjustmentTitle: "Pre-eat before the event, then enjoy freely",
    adjustmentMessage:
      "Before a social event, eat a high-protein snack so hunger doesn't drive decisions when you get there. Then enjoy the meal without guilt. Planned flexibility is part of any sustainable nutrition approach. Tell Chef what sounds like a good pre-event option and Chef will build it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "snack",
    returnToPlanGuidance:
      "Return to your normal plan at the next scheduled meal after the event. No compensation, no restriction.",
  },

  recovery_day: {
    adjustmentTitle: "Nourish, don't restrict — it's a recovery day",
    adjustmentMessage:
      "Recovery days need fuel, not fewer calories. Prioritize something warm, cooked, and anti-inflammatory — your body is repairing and it needs real nourishment. A warm salmon bowl or a chicken and vegetable dish are both strong recovery options. If neither sounds right, tell Chef what you're craving and Chef will build it around today's plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Normal training plan and nutrition resumes when recovery is complete.",
  },

  shift_work: {
    adjustmentTitle: "Anchor meals to your wake cycle — not the clock",
    adjustmentMessage:
      "For shift workers, meal timing follows your body's schedule, not the standard 3-meal clock. Prioritize protein and fat at your first meal of the day regardless of what time it is. Tell Chef what your first meal of the day looks like and Chef will build it around your plan.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Consistent meal timing around your sleep/wake cycle matters more than clock time.",
  },

  hormonal_shifts: {
    adjustmentTitle: "Your body needs more right now — feed it",
    adjustmentMessage:
      "Hormonal phases increase nutritional demand. Increased hunger in the luteal phase is physiological — not a willpower failure. Prioritize iron-rich foods, anti-inflammatory fats, and adequate calories. Don't restrict during this phase. Tell Chef what sounds satisfying and Chef will build around today's needs.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/lifestyle/create-a-dish",
    mealMoment: "auto",
    returnToPlanGuidance:
      "Return to your standard plan after this phase passes. Nutritional needs shift cyclically — this is normal.",
  },

  vacation: {
    adjustmentTitle: "Anchor on breakfast — everything else is flexible",
    adjustmentMessage:
      "On vacation, make breakfast your one controllable meal: high-protein, simple, hotel-compatible. After that, eat and enjoy freely without tracking. Use Restaurant Guide to find something solid for breakfast wherever you are.",
    recommendedActionLabel: "Find a Good Option Nearby",
    recommendedRoute: "/social-hub/restaurant-guide",
    mealMoment: "breakfast",
    returnToPlanGuidance:
      "Pick up your normal plan exactly where you left it the day you return. No adjustment period needed.",
  },

  family_event: {
    adjustmentTitle: "Pre-eat high-protein, then enjoy the event",
    adjustmentMessage:
      "Eat a high-protein snack before the event so hunger doesn't drive decisions at the table. Then enjoy the meal without scoring it. Celebration eating is part of a sustainable plan — one meal at a family event changes nothing. Tell Chef what sounds like a good pre-event option and Chef will build it.",
    recommendedActionLabel: "Build My Next Meal",
    recommendedRoute: "/craving-creator",
    mealMoment: "snack",
    returnToPlanGuidance:
      "Normal plan resumes at your next scheduled meal after the event. No compensation needed.",
  },
};

// ─── Fallback for unknown intervention keys ────────────────────────────────

const FALLBACK_ADJUSTMENT: Omit<NutritionAdjustment, "recommendedMealMoment"> & { mealMoment: MealMoment | "auto" } = {
  adjustmentTitle: "Keep the next meal simple and protein-forward",
  adjustmentMessage:
    "Today's signals call for a straightforward approach. Build a high-protein meal with ingredients you know work for you — keep prep minimal and stay consistent. Tell Chef what sounds right and Chef will build it around today's plan.",
  recommendedActionLabel: "Build My Next Meal",
  recommendedRoute: "/lifestyle/create-a-dish",
  mealMoment: "auto",
  returnToPlanGuidance: "Return to your normal plan after this meal.",
};

// ─── Main export ───────────────────────────────────────────────────────────

export function buildTodaysNutritionAdjustment(
  checkin: Record<string, unknown>,
  interventionKey: string | null,
): NutritionAdjustment | null {
  if (!interventionKey) return null;

  const get = (f: string): number | null => {
    const v = checkin[f];
    return typeof v === "number" ? v : null;
  };
  const schedule = checkin["schedule"] as string | null | undefined;

  // ── Signal-based overrides (highest priority) ──────────────────────────
  // These fire regardless of what the Decision Engine scored, because the
  // signal is clear enough to dictate the specific adjustment.

  let resolvedKey = interventionKey;

  if ((get("hunger") ?? 3) === 1) {
    resolvedKey = "low_appetite";
  } else if (schedule === "travel") {
    resolvedKey = "travel";
  }

  // ── Lookup ─────────────────────────────────────────────────────────────

  const entry = ADJUSTMENT_MAP[resolvedKey] ?? FALLBACK_ADJUSTMENT;
  const mealMoment: MealMoment =
    entry.mealMoment === "auto" ? currentMealMoment() : entry.mealMoment;

  return {
    adjustmentTitle: entry.adjustmentTitle,
    adjustmentMessage: entry.adjustmentMessage,
    recommendedActionLabel: entry.recommendedActionLabel,
    recommendedRoute: entry.recommendedRoute,
    recommendedMealMoment: mealMoment,
    returnToPlanGuidance: entry.returnToPlanGuidance,
  };
}
