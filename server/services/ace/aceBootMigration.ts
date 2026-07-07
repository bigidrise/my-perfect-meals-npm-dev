import { db } from "../../db";
import { sql } from "drizzle-orm";
import { coachingInterventions } from "../../db/schema/ace";

const INITIAL_INTERVENTIONS = [
  {
    key: "high_stress",
    situation: "User is experiencing high stress that triggers emotional eating",
    coachingObjective: "Interrupt the stress-to-food coping loop and redirect to constructive strategies",
    strategies: ["Acknowledge the stress explicitly before pivoting to food choices", "Suggest anti-inflammatory meal builds", "Recommend high-magnesium foods (dark leafy greens, seeds)", "Offer a 5-minute grounding prompt before meal selection"],
    avoid: ["Dismissing the emotional state", "Adding more food guilt", "Complex multi-step plans"],
    evidenceTags: ["cortisol", "emotional_eating", "stress_response"],
    suggestedBuilders: ["snack-creator", "beverage-creator", "fridge-rescue"],
    severity: "moderate",
  },
  {
    key: "low_energy",
    situation: "User reports persistent fatigue or low energy throughout the day",
    coachingObjective: "Identify and correct nutritional gaps contributing to energy deficit",
    strategies: ["Screen for iron, B12, and protein intake patterns", "Suggest balanced macros with emphasis on complex carbs", "Recommend consistent meal timing", "Flag dehydration as first check"],
    avoid: ["Overpromising energy fixes", "Stimulant-heavy suggestions", "Skipping the hydration check"],
    evidenceTags: ["fatigue", "macros", "micronutrients", "hydration"],
    suggestedBuilders: ["create-dish", "breakfast", "meal-planner"],
    severity: "low",
  },
  {
    key: "sleep_deficit",
    situation: "User is sleeping fewer than 6 hours or reporting poor sleep quality",
    coachingObjective: "Support recovery and buffer hormone dysregulation caused by sleep loss",
    strategies: ["Increase protein to buffer muscle catabolism", "Suggest magnesium and tryptophan-rich evening foods", "Avoid high-sugar recommendations", "Reduce caffeine timing guidance"],
    avoid: ["Late-night heavy meal suggestions", "High-glycemic evening snacks", "Caffeine after 2pm"],
    evidenceTags: ["sleep", "recovery", "hormones", "cortisol"],
    suggestedBuilders: ["snack-creator", "beverage-creator"],
    severity: "moderate",
  },
  {
    key: "plateau",
    situation: "User reports their weight or progress has stalled for 2+ weeks",
    coachingObjective: "Reframe the plateau as data and introduce a single measurable diet variable change",
    strategies: ["Audit protein adequacy first", "Suggest tracking accuracy review", "Introduce one controlled variation such as a carb cycling day", "Redirect attention from scale to performance markers"],
    avoid: ["Drastic calorie cuts", "Eliminating entire food groups", "Invalidating prior progress"],
    evidenceTags: ["plateau", "metabolic_adaptation", "carb_cycle", "protein"],
    suggestedBuilders: ["meal-planner", "create-dish"],
    severity: "low",
  },
  {
    key: "social_eating",
    situation: "User is navigating social events, restaurants, or peer pressure to eat off-plan",
    coachingObjective: "Build confidence with flexible social-compatible eating strategies",
    strategies: ["Pre-eat a high-protein snack before social events", "Identify 3 safe-order restaurant patterns", "Normalize planned flexibility", "Offer social script framing such as I just ate"],
    avoid: ["All-or-nothing framing", "Shame around social choices", "Unrealistic restriction rules for events"],
    evidenceTags: ["social_eating", "flexibility", "adherence"],
    suggestedBuilders: ["restaurant-guide", "snack-creator"],
    severity: "low",
  },
  {
    key: "meal_skipping",
    situation: "User is regularly skipping meals especially breakfast or lunch",
    coachingObjective: "Identify the root cause and build a sustainable minimum-friction meal anchor",
    strategies: ["Validate intentional IF windows if that is the goal", "For unintentional skipping suggest 5-minute grab-and-go options", "Anchor one mandatory protein-first meal", "Use beverage options if solid food feels hard"],
    avoid: ["Forcing breakfast if they are genuine IF practitioners", "Complex multi-prep solutions for busy users"],
    evidenceTags: ["meal_timing", "intermittent_fasting", "adherence", "protein"],
    suggestedBuilders: ["snack-creator", "beverage-creator", "breakfast"],
    severity: "low",
  },
  {
    key: "late_night_eating",
    situation: "User consistently eats large portions or high-calorie foods after 9pm",
    coachingObjective: "Address the behavioral and physiological drivers of late-night eating",
    strategies: ["Audit daytime under-eating as root cause", "Suggest a designated evening snack with protein and fat", "Introduce a kitchen-closed routine anchor", "Offer a warm beverage ritual as replacement"],
    avoid: ["Blanket stop eating after 8pm rules without addressing root cause", "Shaming the behavior"],
    evidenceTags: ["late_night_eating", "circadian", "adherence", "hormones"],
    suggestedBuilders: ["snack-creator", "beverage-creator"],
    severity: "moderate",
  },
  {
    key: "high_cravings",
    situation: "User reports intense food cravings that override their intentions",
    coachingObjective: "Distinguish physiological from hedonic cravings and address the correct driver",
    strategies: ["Check for protein and fat deficits first as physiological hunger", "Suggest a craving swap using a higher-protein version of the craved food", "Introduce a 15-minute delay rule before indulging", "Flag PMS phase correlation if relevant"],
    avoid: ["Labeling cravings as moral failures", "Strict avoidance as only strategy", "Ignoring hormonal cycles"],
    evidenceTags: ["cravings", "dopamine", "macros", "hormones"],
    suggestedBuilders: ["craving-creator", "snack-creator", "dessert-creator"],
    severity: "low",
  },
  {
    key: "low_motivation",
    situation: "User has lost motivation to cook, meal prep, or follow their plan",
    coachingObjective: "Lower the activation energy required for compliance without compromising nutrition",
    strategies: ["Introduce the lowest-friction viable meal option first", "Celebrate small wins explicitly", "Reconnect to user's stated top motivation", "Suggest a one-week simplified rotation"],
    avoid: ["Adding complexity to re-motivate", "Lecturing about importance of nutrition", "Ignoring the motivational state"],
    evidenceTags: ["motivation", "adherence", "behavior_change", "burnout"],
    suggestedBuilders: ["fridge-rescue", "snack-creator", "create-dish"],
    severity: "low",
  },
  {
    key: "travel",
    situation: "User is traveling or has a significantly disrupted daily routine",
    coachingObjective: "Provide a portable minimal-decision nutrition anchor for the disrupted period",
    strategies: ["Suggest 3 airport or hotel-compatible protein sources", "Anchor hydration as the primary controllable", "Validate relaxed tracking during travel", "Pre-plan one reliable daily protein meal"],
    avoid: ["Rigid meal plans that do not survive airports", "Guilt for flexibility during travel"],
    evidenceTags: ["travel", "flexibility", "adherence", "hydration"],
    suggestedBuilders: ["restaurant-guide", "snack-creator"],
    severity: "low",
  },
  {
    key: "hormonal_shifts",
    situation: "User is experiencing hormonal phase changes such as menstrual cycle, perimenopause, or postpartum",
    coachingObjective: "Adjust nutrition guidance to buffer the specific hormonal phase",
    strategies: ["Increase iron and magnesium in luteal phase", "Support estrogen detox with cruciferous vegetables", "Validate increased hunger in luteal phase as physiological", "Suggest anti-inflammatory fats"],
    avoid: ["Generic advice that ignores hormonal context", "Restricting calories during high-demand phases"],
    evidenceTags: ["hormones", "menstrual_cycle", "perimenopause", "inflammation"],
    suggestedBuilders: ["create-dish", "meal-planner", "snack-creator"],
    severity: "moderate",
  },
  {
    key: "overeating_episode",
    situation: "User has experienced a single significant overeating episode",
    coachingObjective: "Prevent shame spiral and return to baseline within one meal",
    strategies: ["Normalize single episodes as statistically insignificant", "Suggest next-meal reset with protein and vegetables and no extreme restriction", "Identify the trigger for future pattern awareness", "Do not compensate by skipping the next meal"],
    avoid: ["Recommending compensatory restriction", "Labeling the episode as failure", "Skipping meals as punishment"],
    evidenceTags: ["overeating", "shame_spiral", "resilience", "adherence"],
    suggestedBuilders: ["create-dish", "beverage-creator"],
    severity: "low",
  },
  {
    key: "dehydration_pattern",
    situation: "User is chronically under-hydrated consistently below 6 cups per day",
    coachingObjective: "Build a simple hydration anchor that integrates into existing routine",
    strategies: ["Link water intake to existing habits such as morning routine and meals", "Suggest electrolyte-rich foods rather than supplements first", "Recommend starting the day with 16oz before coffee", "Use hydrating foods to supplement"],
    avoid: ["Complex hydration tracking apps as first step", "Shaming for low intake"],
    evidenceTags: ["hydration", "electrolytes", "habit_stacking"],
    suggestedBuilders: ["beverage-creator"],
    severity: "low",
  },
  {
    key: "protein_deficit",
    situation: "User is consistently hitting less than 0.7g protein per pound of body weight",
    coachingObjective: "Increase daily protein intake through the path of least resistance",
    strategies: ["Add one protein anchor per meal targeting 30g minimum per sitting", "Identify their preferred protein source and build around it", "Use beverages for incremental protein such as Greek yogurt smoothies", "Do not alter carb or fat until protein is anchored"],
    avoid: ["Simultaneous macro changes", "Overwhelming with food prep", "Protein powder as first suggestion"],
    evidenceTags: ["protein", "muscle_preservation", "satiety", "macros"],
    suggestedBuilders: ["create-dish", "breakfast", "snack-creator"],
    severity: "moderate",
  },
  {
    key: "fiber_deficit",
    situation: "User is consistently below 20g fiber per day",
    coachingObjective: "Incrementally increase fiber to support gut health and satiety without GI distress",
    strategies: ["Increase by 5g per week maximum to prevent bloating", "Prioritize soluble fiber first such as oats, legumes, and root vegetables", "Pair fiber increases with proportional water increases", "Use whole foods before supplementation"],
    avoid: ["Jumping to 35g or more fiber immediately", "High insoluble fiber on a disrupted gut", "Fiber supplements as first step"],
    evidenceTags: ["fiber", "gut_health", "microbiome", "satiety"],
    suggestedBuilders: ["create-dish", "lunch", "dinner"],
    severity: "low",
  },
  {
    key: "restrictive_spiral",
    situation: "User shows signs of increasingly restrictive thinking about food",
    coachingObjective: "Interrupt the restriction escalation pattern and reintroduce metabolic safety",
    strategies: ["Validate the goal while expanding food flexibility", "Introduce one previously avoided food in a controlled high-protein context", "Redirect to abundance framing focused on what to add not remove", "Flag for clinical team if worsening"],
    avoid: ["Validating additional eliminations", "Calorie reduction suggestions", "Anything that deepens restriction"],
    evidenceTags: ["restriction", "orthorexia_risk", "disordered_eating", "safety"],
    suggestedBuilders: ["create-dish", "meal-planner"],
    severity: "high",
  },
  {
    key: "binge_risk",
    situation: "User signals elevated binge eating risk with multiple restriction days followed by loss of control",
    coachingObjective: "Break the restrict-binge cycle by establishing metabolic adequacy",
    strategies: ["Ensure minimum 1400kcal regardless of goal", "Prioritize three structured meals before any snack reduction", "Remove forbidden food framing", "Escalate to clinical team if pattern continues"],
    avoid: ["Any calorie reduction", "Validating food restriction", "Ignoring the escalation signal"],
    evidenceTags: ["binge_eating", "restriction", "safety", "clinical_escalation"],
    suggestedBuilders: ["meal-planner", "create-dish"],
    severity: "high",
  },
  {
    key: "digestive_distress",
    situation: "User is experiencing bloating, GI discomfort, or digestive irregularity",
    coachingObjective: "Identify and reduce the most likely dietary triggers while maintaining nutrition",
    strategies: ["Suggest temporary low-FODMAP meal options", "Eliminate raw cruciferous as first test", "Increase cooked versus raw vegetables ratio", "Anchor with easy-to-digest proteins"],
    avoid: ["Immediately eliminating entire food categories", "Suggesting elimination of all fiber", "Diagnosing IBD or IBS"],
    evidenceTags: ["gut_health", "fodmap", "digestion", "inflammation"],
    suggestedBuilders: ["create-dish", "lunch", "dinner"],
    severity: "moderate",
  },
  {
    key: "muscle_soreness",
    situation: "User reports high muscle soreness and poor recovery between training sessions",
    coachingObjective: "Optimize post-exercise nutrition to accelerate tissue repair",
    strategies: ["Prioritize 40g protein within 2 hours post-training", "Add tart cherry or anti-inflammatory foods", "Ensure carbohydrate refueling post-glycolytic work", "Review overall caloric adequacy"],
    avoid: ["Low-carb recommendations on heavy training days", "Aggressive calorie deficit during heavy training blocks"],
    evidenceTags: ["recovery", "protein", "inflammation", "performance"],
    suggestedBuilders: ["snack-creator", "create-dish"],
    severity: "low",
  },
  {
    key: "goal_drift",
    situation: "User's food choices are gradually drifting away from their stated goals",
    coachingObjective: "Reconnect user to their primary goal with a single behavioral anchor",
    strategies: ["Name the drift without judgment", "Reconnect to top-stated motivation from onboarding", "Introduce one non-negotiable daily anchor behavior", "Offer a simplified 3-day reset plan"],
    avoid: ["Extended lectures on goal importance", "Overhauling the entire approach", "Assigning blame"],
    evidenceTags: ["adherence", "habit_drift", "motivation", "behavior_change"],
    suggestedBuilders: ["meal-planner", "create-dish"],
    severity: "low",
  },
];

export async function runAceMigration(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS coaching_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL UNIQUE,
      coaching_style text,
      accountability_pref text,
      motivations text[],
      lifestyle_flags text[],
      biggest_challenges text[],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS coaching_interventions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      situation text NOT NULL,
      coaching_objective text NOT NULL,
      strategies text[] NOT NULL DEFAULT '{}',
      avoid text[] NOT NULL DEFAULT '{}',
      evidence_tags text[] NOT NULL DEFAULT '{}',
      suggested_builders text[] NOT NULL DEFAULT '{}',
      severity text NOT NULL DEFAULT 'low',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM coaching_interventions`
  );
  const existing = Number((countResult.rows[0] as any)?.n ?? 0);

  if (existing === 0) {
    await db
      .insert(coachingInterventions)
      .values(INITIAL_INTERVENTIONS)
      .onConflictDoNothing();
    console.log(
      `✅ [ACE] Seeded ${INITIAL_INTERVENTIONS.length} initial interventions`
    );
  }
}
