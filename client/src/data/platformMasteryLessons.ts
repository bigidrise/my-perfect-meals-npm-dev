export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LessonSection {
  heading?: string;
  body: string;
  type?: "blockquote" | "exercise" | "remember" | "callout";
}

export interface PlatformMasteryLesson {
  id: string;
  lessonNumber: number;
  title: string;
  subtitle: string;
  learningObjectives: string[];
  opening: string;
  sections: LessonSection[];
  exercise: {
    steps: string[];
  };
  remember: string;
  closing?: string;
  quiz: QuizQuestion[];
}

export const PLATFORM_MASTERY_LESSONS: PlatformMasteryLesson[] = [
  {
    id: "lesson-01",
    lessonNumber: 1,
    title: "Your Profile Is Your Protocol",
    subtitle: "How onboarding shapes every recommendation you receive",
    learningObjectives: [
      "Identify which onboarding inputs become hard constraints (blocked ingredients, medical guardrails) versus adjustable preferences",
      "Explain the difference between dietary identity and cuisine preferences, and why each matters differently for meal generation",
      "Navigate to My Profile and correctly update a dietary identity, allergen, or health goal after onboarding is complete",
      "Describe the 4-level protocol hierarchy and predict which setting takes precedence when two profile elements conflict",
    ],
    opening:
      "Every recommendation My Perfect Meals makes starts with one thing: understanding you. During setup, you'll answer a series of questions about your goals, preferences, lifestyle, and health. Those answers become the foundation for every meal, shopping list, restaurant recommendation, and nutrition decision the platform makes.",
    sections: [
      {
        heading: "Creating Your Account",
        body: "Open My Perfect Meals and you'll land on the sign-up screen. Create an account with an email address and password, or sign in with Apple or Google.\n\nYour display name is optional. Use a nickname, a first name, or skip it entirely. Whatever you enter here is what the app will use to greet you on the Dashboard.\n\nYou won't be asked for payment during setup. Create your account, complete onboarding, and explore first. Subscription options come later.\n\nOnce you sign in, you move directly into onboarding.",
      },
      {
        heading: "Onboarding — The Most Important Step",
        body: "Onboarding is not a formality. It's the foundation of your entire experience.\n\nEvery question in the onboarding flow feeds directly into your profile. The platform uses that profile every time it generates a meal, calculates your targets, or makes a recommendation. Take your time here. A complete profile means personalized output from the very first meal.\n\nHere's what onboarding captures and why each part matters:\n\n**Basic Information**\nHeight, weight, age, and biological sex. This is how My Perfect Meals calculates your macro targets. You don't enter numbers yourself — the platform does the math.\n\n**Your Health Goal**\nWeight loss, maintenance, muscle gain, performance, or clinical support. This is the single most influential input in your entire profile. Someone building muscle and someone managing blood sugar get fundamentally different meals — even when they ask for the same thing.\n\n**Medical Conditions**\nIf you select a medical condition, My Perfect Meals adjusts future recommendations to better support that condition. You don't have to remind the platform every time you build a meal — it remembers your profile automatically.\n\n**Dietary Identity**\nVegetarian, vegan, pescatarian, keto, carnivore, halal, kosher, and more. This is what kind of food you eat. It's a firm boundary, not a preference. If you're vegetarian, the platform won't generate chicken — full stop.\n\n**Allergies and Intolerances**\nThese become hard blocks. Enter \"shellfish\" and the platform will never generate a meal containing shellfish — not as a warning, as a blocked ingredient.\n\n**Cuisine Preferences**\nThe food cultures and traditions you enjoy. These shape the flavors and ingredients in your meals without overriding what you can or cannot eat.\n\n**Taste and Lifestyle Preferences**\nHeat level, ingredient variety, meal complexity, and how much time you have to cook. These are the details that make meals feel like they were made for you.",
      },
      {
        heading: "Dietary Identity vs. Cuisine Preferences",
        body: "These two things sound similar. They're not.\n\n**Dietary identity** is what kind of food you eat. It draws a firm line the platform never crosses. Vegetarian means no meat. Keto means no high-carb meals.\n\n**Cuisine preferences** are the flavors and food traditions you enjoy within your dietary identity. A vegetarian can love Mexican food, Mediterranean food, Indian food, or all of them at once.\n\nThink of it this way: your dietary identity is the fence. Your cuisine preferences are the garden inside the fence.\n\nBoth are set during onboarding and can be updated anytime.",
      },
      {
        heading: "Safety PIN",
        body: "Your Safety PIN protects your allergy settings from being changed accidentally. If you need to add or update an allergy later, you'll use your Safety PIN to confirm the change.\n\n**To set your Safety PIN:**\n1. Tap **Hub** (top right of the Dashboard)\n2. Tap **My Profile** → **Allergy & Safety**\n3. Confirm your allergens are listed\n4. Set your four-digit PIN",
      },
      {
        heading: "After Onboarding",
        body: "After onboarding, most of your personal settings can be updated anytime from **My Hub** — the panel that opens when you tap the Hub button in the top-right corner of the Dashboard. We'll explore the Hub in detail later in the Academy.",
      },
      {
        heading: "The quality of your nutrition plan begins with the quality of your profile.",
        body: "Before you change meals, builders, or settings — make sure your profile accurately reflects who you are today. Coaches: when a client says their meals don't feel right, check the profile first. An outdated or incomplete profile is almost always the answer.",
      },
    ],
    exercise: {
      steps: [
        "Tap **Hub** in the top-right corner of your Dashboard and open **My Profile**.",
        "Review your profile. Find **Cuisine Preferences** and change at least one preference you haven't set before — or update one that no longer fits. Save your changes.",
        "Return to the Dashboard and open your assigned Meal Builder.",
        "Generate one meal. Look at what came back — the ingredients, the cuisine style, the flavors. Notice how your preferences are already showing up in the output.",
      ],
    },
    remember:
      "Your profile isn't something you fill out once and forget. As your goals and lifestyle change, your profile should change with you.",
    quiz: [
      {
        id: "l1-q1",
        question:
          "A user has Type 2 diabetes selected in her profile and asks My Perfect Meals to create a rice-based dinner. What should she expect?",
        options: [
          "The medical condition is ignored unless she mentions diabetes in the request.",
          "The recommendation will be adjusted to better support her active diabetes profile.",
          "The platform will refuse to generate any meal containing carbohydrates.",
          "She must activate diabetes support separately before every generation.",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q2",
        question:
          "A user's dietary identity is vegetarian. Their cuisine preference is Mexican. They request \"chicken tacos.\" What does the platform generate?",
        options: [
          "A standard chicken taco — the direct request overrides dietary identity.",
          "A vegetarian version of the tacos. The direct request cannot override the dietary identity stored in the profile.",
          "An error, because the request conflicts with the user's profile.",
          "A hybrid option — the platform substitutes half the protein with a plant alternative.",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q3",
        question:
          "A user wants to remove shellfish from her allergy list. What does she need to do first?",
        options: [
          "Contact support to submit a profile change request.",
          "Nothing — any allergy can be removed directly from Edit Profile without a PIN.",
          "Enter her Safety PIN to confirm the change.",
          "Ask a ProCare provider to authorize the removal.",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q4",
        question:
          "A user describes herself this way: \"I'm vegetarian, but I love Mexican food, Indian food, and Italian food.\" How should she fill out her profile?",
        options: [
          "Dietary identity: Mexican, Indian, Italian. No separate dietary identity field needed.",
          "Dietary identity: Vegetarian. Cuisine preferences: Mexican, Indian, Italian.",
          "Dietary identity: Vegetarian. No cuisine preferences — they would conflict with her identity.",
          "Leave dietary identity blank and only select cuisine preferences.",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q5",
        question:
          "A user has shellfish listed as an allergy and requests shrimp scampi. Which result would be acceptable?",
        options: [
          "Shrimp scampi with an allergy warning.",
          "Shrimp scampi after asking for confirmation.",
          "A shellfish-free alternative that respects the allergy setting.",
          "The original shrimp dish, because direct requests override the profile.",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q6",
        question:
          "User A's goal is muscle gain. User B's goal is weight loss. Their other profile settings are identical, and both request grilled chicken with quinoa. What should they expect?",
        options: [
          "Identical meals because the request was identical.",
          "The same meal with only a different description.",
          "Meals adjusted to their different macro targets, portions, and goals.",
          "The platform will ask them to choose a shared goal before generating.",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q7",
        question:
          "A user says their meals feel too complicated and take way too long to prepare. Which profile section is most likely out of alignment?",
        options: [
          "Medical Conditions — a condition may be restricting available ingredients.",
          "Taste Preferences — their seasoning or heat settings may be too high.",
          "Lifestyle Preferences — Cooking Skill and Time Available directly control recipe complexity and prep time.",
          "Cuisine Preferences — some cuisines are naturally more complex to prepare.",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q8",
        question:
          "A user rushes through onboarding and skips the cuisine preferences and lifestyle questions. What should you expect from their first meals?",
        options: [
          "The platform won't generate meals until all sections are completed.",
          "The platform generates generic results that may not match their actual preferences or routine.",
          "The platform defaults to widely liked settings that work for most users.",
          "No impact — those sections are optional and don't affect meal generation.",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q9",
        question:
          "A user updates their spice preference from mild to hot in My Profile. Their next generated meal does not appear to reflect the saved change. What is the most likely cause?",
        options: [
          "Spice preference changes take 24 hours to apply.",
          "They changed the setting but navigated away without saving.",
          "Spice preference only applies to newly created accounts.",
          "The platform overrides spice preference for users with health conditions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q10",
        question:
          "A client says: \"I filled out everything during onboarding six months ago. I haven't touched my profile since.\" What should you tell them?",
        options: [
          "That's fine — onboarding is thorough and rarely needs to be revisited.",
          "They should delete and restart to get an accurate profile.",
          "Their profile reflects who they were six months ago. If their goals, health, or lifestyle have changed, their meals are being built for an outdated version of them.",
          "The platform automatically refreshes profiles every 90 days based on usage patterns.",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "lesson-02",
    lessonNumber: 2,
    title: "Meal Builders — Choosing the Right Tool",
    subtitle: "Every meal creation tool, what it does, and when to reach for it",
    learningObjectives: [
      "Name every meal creation tool on the platform and correctly categorize it as a builder, lifestyle creator, specialty creator, or kitchen tool",
      "Use the scenario matrix to select the correct tool for any given meal situation",
      "Explain the difference between the Meal Planner and the lifestyle creators, and when each is the right choice",
      "Describe what Recipe Maker does and how it differs from Create a Dish and Fridge Rescue",
    ],
    opening:
      "My Perfect Meals includes more than a dozen ways to generate meals and evaluate food. Some are builders — the environments assigned based on your profile. Others are lifestyle creators, scanning tools, or planning aids. This lesson gives you the complete map: every tool, what it does, and when to reach for it.",
    sections: [
      {
        heading: "Your Assigned Builder — The Core Tool",
        body: "Your **assigned builder** is where most of your meal generation happens. It's selected based on your health goal, medical context, and dietary identity — and it's the tool the platform optimizes around your specific situation.\n\nThe six builders:\n\n**My Weekly Meal Builder** — Standard structured planning for users without a specific clinical context.\n\n**Diabetic Hub and Meal Builder** — Glucose-aware generation for Type 1 and Type 2 diabetes. Includes GlucoseGuard.\n\n**Metabolic Medication Hub and Builder** — Appetite-adjusted generation for GLP-1 users. Includes an injection tracker.\n\n**Anti-Inflammatory Meal Builder** — Inflammation-filtered generation for autoimmune conditions, joint issues, and chronic inflammation.\n\n**Performance Nutrition Hub and Builder** — Phase-aware generation for athletes with training-cycle macro adjustments.\n\n**General Nutrition Builder (ProCare)** — Professionally managed builder assigned by a coach or physician.\n\nYour builder handles the weekly plan. Everything else below handles everything else.",
      },
      {
        heading: "Lifestyle Creators — On-Demand Meal Generation",
        body: "**Lifestyle creators** are how you generate meals outside your structured plan — for specific situations, cravings, or creative needs. All of them apply your full profile.\n\n**Create a Dish** — Describe any meal in natural language and get a complete profile-compliant recipe. The most flexible tool on the platform. Use it when you know what you want but need the recipe built around your targets.\n\n**Snack Creator** — Generates profile-aware snacks specifically calibrated to fill macro gaps without disrupting your main meals. Faster and more targeted than asking a builder for a snack.\n\n**Beverage Creator** — Protein shakes, smoothies, wellness drinks, and hot beverages — all adjusted for your dietary identity and macro targets.\n\n**Craving Creator** — You describe what you're craving right now. The platform generates a version that fits your profile. Satisfies the craving; keeps the plan intact.",
      },
      {
        heading: "Specialty Creators",
        body: "Specialty creators generate specific types of meals or experiences beyond everyday cooking.\n\n**Sushi Creator** — Builds complete sushi menus with profile-aware roll combinations, traditional preparation, and macro-matched portions.\n\n**Dessert Creator** — Generates profile-compliant desserts — sweet, satisfying, and designed to fit your remaining daily targets.\n\n**Holiday Feast** — Multi-course meal planning for celebrations and gatherings. Includes full menus across appetizer, main, side, and dessert courses, all coordinated around a single dietary context.",
      },
      {
        heading: "Kitchen and Ingredient Tools",
        body: "**Fridge Rescue** — Enter the ingredients you already have. The platform generates a complete profile-compliant meal from only those items. No grocery run needed. Best when your kitchen has food but no clear plan.\n\n**Recipe Maker** — Paste a URL or enter a recipe's ingredients. The platform rebuilds the recipe around your dietary identity and macro targets. Best when you have a recipe you love but it doesn't fit your current plan.\n\n**MacroScan** — Photograph a nutrition label or packaged food. The platform evaluates the product against your profile. Best for checking whether a packaged item fits your plan before buying or eating it.",
      },
      {
        heading: "Meal Planner",
        body: "**Meal Planner** is the structured planning tool inside your assigned builder. It's not a separate feature — it's the weekly board where you generate meals for each slot across Monday through Sunday.\n\nUnlike the lifestyle creators, the Meal Planner works session by session across an entire week. You fill slots, use Duplicate to copy successful days, and Save Plan to lock the week. Your Shopping List updates when you save.\n\nIf you're not sure which tool to use, the question to ask is: Am I building a structured plan for the week, or am I solving a specific meal situation right now? If it's the week — Meal Planner. If it's a situation — a lifestyle creator.",
      },
      {
        heading: "Scenario Matrix — Which Tool to Reach For",
        body: "Match the situation to the tool:\n\n| Situation | Tool |\n|-----------|------|\n| Building my week of meals | Meal Planner (in your builder) |\n| I know what I want to eat tonight | Create a Dish |\n| I have ingredients but no plan | Fridge Rescue |\n| I have a recipe I love — adapt it | Recipe Maker |\n| I need a quick snack | Snack Creator |\n| I want a protein shake or smoothie | Beverage Creator |\n| I want what I'm craving, on plan | Craving Creator |\n| I want sushi tonight | Sushi Creator |\n| Special occasion or celebration | Holiday Feast |\n| Is this packaged food ok? | MacroScan |\n| I'm going out to eat | Restaurant Guide or Fast Food Guide |\n\nAll tools apply your full profile. The difference is what they're optimized to create.",
      },
    ],
    exercise: {
      steps: [
        "Open the **Lifestyle** page. Identify every creator tool available to you.",
        "Open **Create a Dish**. Describe something you actually want to eat — be specific. Generate the meal. Read the full Meal Card.",
        "Open **Craving Creator**. Enter a real craving. Generate and read the result.",
        "Open **Recipe Maker**. Find a recipe online — paste the URL or enter the ingredients. Review the adapted output.",
        "Open **Snack Creator**. Generate a snack and note how it compares in macro balance to the meals from your builder.",
        "Return to your builder and open the **Meal Planner**. Note the difference in how you use it versus the lifestyle creators.",
      ],
    },
    remember:
      "Every tool applies your full profile. The difference is what each one is optimized to create. Learn the scenario matrix and you'll always know which tool to reach for.",
    quiz: [
      {
        id: "l2-q1",
        question:
          "A user has a recipe she found online that she loves, but it doesn't fit her macro targets. Which tool adapts an existing recipe to fit her plan?",
        options: [
          "Fridge Rescue — she enters the recipe ingredients and it builds a meal from them.",
          "Create a Dish — she describes the recipe and it generates a new version.",
          "Recipe Maker — she pastes the URL or enters ingredients and the platform rebuilds the recipe around her profile.",
          "MacroScan — she photographs the nutrition label to evaluate it.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q2",
        question:
          "A user opens the refrigerator and sees chicken, spinach, and olive oil — no plan, no grocery list. Which tool is designed for this situation?",
        options: [
          "Create a Dish — she describes what she wants using those ingredients.",
          "Fridge Rescue — she enters the ingredients she has and the platform generates a meal from only those items.",
          "Recipe Maker — she enters the ingredients to see if they match a known recipe.",
          "Craving Creator — she types the craving and the platform finds a match.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q3",
        question:
          "A user is craving something sweet after dinner. She doesn't want to just browse — she wants something that fits her remaining macros. Which tool is most appropriate?",
        options: [
          "Snack Creator — it's designed for macro gap filling.",
          "Holiday Feast — it includes dessert generation.",
          "Craving Creator — she describes what she's craving and the platform generates a profile-compliant version.",
          "Create a Dish — she describes the sweet meal she wants.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q4",
        question:
          "A user is at the grocery store and picks up a packaged protein bar. She wants to know if it fits her plan before buying it. Which tool handles this?",
        options: [
          "Recipe Maker — she enters the ingredients from the label.",
          "Smart Scan — she scans the barcode for a shopping evaluation.",
          "MacroScan — she photographs the nutrition label and the platform evaluates it against her profile.",
          "Snack Creator — it generates snack options with similar macro profiles.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q5",
        question:
          "A user wants to plan all seven days of meals before Sunday grocery shopping. Which tool is designed for this use case?",
        options: [
          "Create a Dish — she generates each meal separately and saves them.",
          "The Meal Planner inside her assigned builder — it's the structured weekly planning tool.",
          "Craving Creator — she enters a different craving for each day.",
          "Holiday Feast — it plans meals across multiple days.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q6",
        question:
          "A user on a GLP-1 medication wants a protein shake that accounts for her reduced appetite and portion sensitivity. Which tool is most targeted for this?",
        options: [
          "Create a Dish — she describes the shake in detail.",
          "Snack Creator — it generates low-volume, high-protein snacks.",
          "Beverage Creator — it generates protein shakes, smoothies, and drinks adjusted for her dietary identity and targets.",
          "Fridge Rescue — she enters the shake ingredients she has available.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q7",
        question:
          "A dietitian wants to show a client all the meal creation tools available in My Perfect Meals. Which best describes the correct grouping?",
        options: [
          "Assigned builder (weekly planning), lifestyle creators (Create a Dish, Snack, Beverage, Craving), specialty creators (Sushi, Dessert, Holiday Feast), and kitchen tools (Fridge Rescue, Recipe Maker, MacroScan).",
          "Free tools (Create a Dish, Fridge Rescue) and paid tools (all builders and specialty creators).",
          "AI tools (all generators) and manual tools (MacroScan and Recipe Maker).",
          "Medical tools (builders) and lifestyle tools (everything else in Lifestyle).",
        ],
        correctIndex: 0,
      },
      {
        id: "l2-q8",
        question:
          "A user is planning a Thanksgiving dinner for the family and wants a complete multi-course menu that fits her dietary identity across all dishes. Which tool is designed for this?",
        options: [
          "Create a Dish — she generates each course individually.",
          "Meal Planner — she fills Thursday's slots with each course.",
          "Holiday Feast — it plans full multi-course meals for celebrations and gatherings.",
          "Recipe Maker — she scans each traditional recipe and adapts it.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q9",
        question:
          "What is the core question to ask when choosing between the Meal Planner and a lifestyle creator?",
        options: [
          "Am I a paid subscriber or on the free tier?",
          "Am I building a structured plan for the week, or am I solving a specific meal situation right now?",
          "Is my builder assigned by ProCare or self-assigned during onboarding?",
          "Am I cooking at home or eating out?",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q10",
        question:
          "A client says: 'I knew what I wanted — grilled salmon with a citrus glaze and roasted asparagus — I just needed the recipe built around my macros.' Which tool did she use?",
        options: [
          "Fridge Rescue — she entered salmon and asparagus.",
          "Recipe Maker — she found a salmon recipe online and adapted it.",
          "Create a Dish — she described exactly what she wanted and the platform built the recipe around her targets.",
          "Craving Creator — she typed her craving and got a match.",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "lesson-03",
    lessonNumber: 3,
    title: "Planning Your Week",
    subtitle: "Populating the weekly board and building a plan you will follow",
    learningObjectives: [
      "Navigate the weekly board to generate, replace, duplicate, and save meals across a 7-day plan",
      "Use the Remaining Macros display to identify macro gaps or over-allocation before saving a plan",
      "Explain how Duplicate Day works and describe a situation where it saves time without compromising nutritional variety",
      "Describe what happens to the Smart Grocery List when a plan is saved, modified, and re-saved",
    ],
    opening:
      "Once you're inside your assigned builder, the weekly board is where your plan takes shape. This lesson covers how to populate your week, understand the Remaining Macros bar, use Duplicate and Replace to build efficiently, and save a plan you can actually follow.",
    sections: [
      {
        heading: "The Weekly Board",
        body: "The weekly board is the primary planning interface inside every builder. It has seven day tabs — Monday through Sunday — and five meal slots per day: Breakfast, Morning Snack, Lunch, Afternoon Snack, and Dinner.\n\nWhen you open your builder, you're looking at one day at a time. Tap any day tab to move between days. Tap any empty meal slot to start generating a meal for that slot.",
      },
      {
        heading: "Generating a Meal for a Slot",
        body: "The generation workflow is the same for every slot, every day:\n\n1. Tap an empty meal slot\n2. Type what you want in natural language — \"quick chicken lunch,\" \"something warm for dinner,\" \"high protein, no cooking\"\n3. Tap **Generate**\n4. A Meal Card appears\n5. Read the Meal Card fully before acting\n6. Tap **Add to Plan** to place the meal in that slot\n\nThe description you type, your active builder, and your profile work together. You don't need to specify macros, avoid certain foods, or remember your restrictions — those are already embedded in the generation. Your profile handles that before you type a word.",
      },
      {
        heading: "The Remaining Macros Bar",
        body: "At the bottom of each day, the Remaining Macros bar shows how much of your daily Protein, Carbohydrate, and Fat targets remain as you add meals. It updates in real time.\n\nUse it as a gauge, not a rigid target. The purpose isn't to fill it to exactly zero every day — it's to build a day where your meals collectively fit your targets without leaving large gaps or going significantly over.\n\nAs you fill more slots over several days of planning, you'll develop a sense for how much each meal type typically contributes. That pattern awareness is more useful in practice than hitting exact numbers every day.",
      },
      {
        heading: "Duplicate, Replace, and Save Plan",
        body: "Three tools turn a single day's work into a full week:\n\n**Duplicate** — copies all meals from one day to another day with one tap. If Monday works, duplicate it to Wednesday. Build a few strong days and rotate them throughout the week — this is faster than generating 35 unique meals.\n\n**Replace** — tap any filled slot to generate a new meal for that slot. The slot updates immediately. Use Replace when a meal isn't working, when you've eaten it too often, or when your situation changes mid-week.\n\n**Save Plan** — saves your current weekly board as your active plan. Your Shopping List updates when you save. Save when you're satisfied with the week — not before.",
      },
      {
        heading: "The Meal Card — Read It Before Acting",
        body: "Every generated meal appears as a Meal Card. Before you add it to your plan, read it:\n\n- **Medical Safety Badges** — which protocols this meal satisfies\n- **Active Programs** — which profile programs shaped this meal\n- **Ingredients** — complete list with amounts\n- **Why This Works For You** — why this meal fits your goals and medical context\n\nOnce you've read it, your options:\n- **Add to Plan** — places it on the weekly board in the slot you tapped\n- **Add to Macros** — logs the meal's nutrition to your daily targets\n- **❤️ Favorite** — saves the meal to your collection\n- **Guided Cooking** — step-by-step walk through preparation",
      },
      {
        heading: "Building a Plan You Can Actually Follow",
        body: "A plan that looks nutritionally ideal but requires time you don't have or cooking you won't do is a plan you'll abandon by Wednesday.\n\nAim for a 70% plan — a week where you're confident you'll follow at least five of seven days. That creates real results. A plan you follow imperfectly is more valuable than a plan you don't follow at all.\n\nUse Duplicate liberally. Variation doesn't require 35 different meals — it comes from rotating a few strong days. Consistent planning beats creative planning.",
      },
    ],
    exercise: {
      steps: [
        "Open your builder and tap the **Monday** tab.",
        "Tap an empty **Breakfast** slot. Type something you'd actually want to eat. Tap **Generate**.",
        "When the Meal Card appears, read it fully — check the Medical Safety Badges, the Active Programs section, and the **Why This Works For You** section.",
        "Tap **Add to Plan** to place the meal in Monday's Breakfast slot.",
        "Fill two more meal slots on Monday using the same process.",
        "Observe the **Remaining Macros** bar update as you add each meal.",
        "Tap **Duplicate** and copy Monday's meals to Wednesday.",
        "On Wednesday, tap one of the filled slots and use **Replace** to generate a different meal for that slot.",
        "Tap **Save Plan** to save your current week.",
      ],
    },
    remember:
      "The weekly board, Duplicate, Replace, and Save Plan are the four tools you'll use every week. Learn these once and you've learned the planning workflow for the entire platform.",
    closing:
      "You now know how to build a plan. The next lesson covers what happens between the plan and the store — shopping tools, ingredient scanning, and how to use what you already have.",
    quiz: [
      {
        id: "l3-q1",
        question:
          "A user wants to plan meals for Thursday. What does she do first inside her builder?",
        options: [
          "Tap the Preferences panel to unlock Thursday's slots.",
          "Open Coach's Corner and select Thursday from the schedule.",
          "Tap the Thursday tab, then tap any empty meal slot.",
          "Generate a full week at once using the Save Plan screen.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q2",
        question:
          "The Remaining Macros bar updates as meals are added to a day. What is its purpose?",
        options: [
          "To show the total number of meals remaining to plan for the week.",
          "To display how much of the daily macro targets remain available as meals are filled.",
          "To track the percentage of the shopping list that has been covered.",
          "To indicate whether the current day's plan has been saved.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q3",
        question:
          "A user built a strong Monday with meals she's happy with. She wants something similar on Wednesday. Which feature should she use?",
        options: [
          "Replace — tap each Wednesday slot and generate a similar meal.",
          "Save Plan — it automatically mirrors successful days to the next occurrence.",
          "Duplicate — copy Monday's full meal set to Wednesday with one tap.",
          "Preferences — pre-set Wednesday to match Monday's generation settings.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q4",
        question:
          "A user filled Thursday's Lunch slot with a meal she no longer wants to eat. How does she get a different meal for that slot?",
        options: [
          "Delete the slot and regenerate from the empty slot screen.",
          "Tap the filled slot and use Replace to generate a new meal for it.",
          "Tap Save Plan to refresh all slots.",
          "Open Preferences and select a different meal type for that slot.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q5",
        question:
          "After a user taps Save Plan, what else updates automatically?",
        options: [
          "The Nutrition Personalization Summary",
          "The Macro Calculator targets",
          "The Shopping List",
          "The Biometrics log",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q6",
        question:
          "Why should a user read a Meal Card fully before deciding what to do with it?",
        options: [
          "The platform tracks whether users read the card and adjusts future recommendations accordingly.",
          "Pressing a button before reading locks the meal and prevents changes.",
          "Meal Cards expire if the user doesn't interact with them within a short window.",
          "The card explains what the meal is, why it fits the profile, and what actions are available — reading it first makes every action intentional.",
        ],
        correctIndex: 3,
      },
      {
        id: "l3-q7",
        question:
          "A new user is generating all 35 meal slots individually with completely different meals. What advice would improve her planning approach?",
        options: [
          "She should generate fewer meals — three per day instead of five.",
          "She should use Preferences to pre-set a repeating template for the week.",
          "She should use Duplicate to copy strong days rather than generating 35 unique meals.",
          "She should save each day before moving to the next one.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q8",
        question:
          "What is the difference between Add to Plan and Add to Macros?",
        options: [
          "There is no difference — both do the same thing.",
          "Add to Plan places the meal on the weekly board; Add to Macros logs the meal's nutrition to daily tracking.",
          "Add to Plan logs the meal; Add to Macros saves it to Favorites.",
          "Add to Plan saves it permanently; Add to Macros is only for today.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q9",
        question:
          "Which best describes a realistic and sustainable weekly meal plan for most users?",
        options: [
          "Every slot filled with entirely unique meals and zero repetition across the week.",
          "A plan she is confident she will follow at least five of seven days.",
          "A plan that minimizes cooking time by using only three-ingredient recipes.",
          "A plan that exactly hits 100% of her daily macro targets every single day.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q10",
        question:
          "A user finishes building her week and wants her Shopping List to reflect all the ingredients she'll need. What does she do?",
        options: [
          "Tap Add to Macros for each meal she wants included on the shopping list.",
          "Open Grocery Coach directly — it generates a list independently.",
          "Tap Save Plan — the Shopping List updates when the plan is saved.",
          "Generate a Shopping List manually by entering her meals one at a time.",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "lesson-04",
    lessonNumber: 4,
    title: "Shopping & Your Grocery Scope",
    subtitle: "Smart Grocery List, Grocery Coach, Smart Scan, and Fridge Rescue",
    learningObjectives: [
      "Explain what triggers the Smart Grocery List to populate and what causes it to appear empty",
      "Describe how Grocery Coach provides protocol-aware buying guidance aligned to your active health programs",
      "Use Recipe Maker to adapt a recipe found outside My Perfect Meals to a specific dietary identity and macro target",
      "Distinguish when to use Smart Scan versus Fridge Rescue for a food decision in or around the home",
    ],
    opening:
      "A saved meal plan answers what you should eat. The shopping tools answer how to get that food into your kitchen — and how to evaluate what you already have. This lesson covers the full grocery scope of My Perfect Meals: your Smart Grocery List, Grocery Coach, Smart Scan, Recipe Maker, and Fridge Rescue.",
    sections: [
      {
        heading: "Smart Grocery List — Your Plan Becomes a List",
        body: "When you save your weekly plan, the Smart Grocery List generates automatically. It consolidates all ingredients from every meal in your saved plan, de-duplicates them, and organizes them by grocery category.\n\nIf your Smart Grocery List is empty, no weekly plan has been saved yet. Go to your builder, complete your week, and tap Save Plan. The list populates immediately and stays current — update your plan and the list updates with it.",
      },
      {
        heading: "Grocery Coach",
        body: "Grocery Coach provides protocol-aware guidance on what to buy — not just what's on your ingredient list, but how to stock your kitchen in a way that supports your active nutrition programs.\n\nWhere the Smart Grocery List tells you exactly which ingredients your saved meals require, Grocery Coach answers the broader question: *given your protocol, what kind of kitchen should you maintain?*\n\nBased on your active health programs and dietary identity, Grocery Coach delivers targeted buying guidance:\n\n- **A user on the GLP-1 Builder** receives guidance on keeping high-protein, easy-to-prepare options available for low-appetite windows\n- **A user on an anti-inflammatory protocol** receives guidance on which produce and protein categories to prioritize across the week\n- **A user managing Type 2 diabetes** receives guidance on structuring their kitchen to support glycemic stability throughout the week\n\nGrocery Coach is the strategic guidance layer above your ingredient list. It helps you make protocol-aligned decisions before you get to the store — so your kitchen consistently supports your plan, not just the meals you happened to save this week.",
      },
      {
        heading: "Smart Scan — Ingredient Intelligence in the Store",
        body: "Smart Scan brings profile-aware evaluation to the store shelf. Point your camera at any product barcode and the platform evaluates the nutrition label against your active profile.\n\nWhat Smart Scan checks:\n- Does this product fit your dietary identity?\n- Does it conflict with any medical guardrails?\n- How does it compare to your remaining macro targets?\n\nThe result: compatible, use with caution, or avoid — with the specific reason. Most useful when comparing similar products or evaluating packaged foods you haven't used before.",
      },
      {
        heading: "Recipe Maker — Adapting Recipes You Already Love",
        body: "Recipe Maker adapts recipes you find outside My Perfect Meals — so you don't have to choose between eating what you love and staying on your plan.\n\nHow to use it:\n1. Find a recipe online or in a cookbook\n2. Paste the URL into Recipe Maker, or enter the ingredients manually\n3. The platform rebuilds the recipe around your dietary identity and macro targets\n4. A full Meal Card appears — with your adjusted ingredients, macros, and instructions\n\nRecipe Maker is the bridge between the food world outside My Perfect Meals and your profile inside it. A pasta recipe you love becomes a high-protein, low-glycemic version of itself. A family dish becomes halal-compliant. The dish stays recognizable. The nutrition fits your plan.",
      },
      {
        heading: "Fridge Rescue — Cooking What You Already Have",
        body: "Fridge Rescue solves a specific problem: you have food in the kitchen but don't know what to make with it.\n\nEnter the ingredients currently available. Fridge Rescue generates a complete, profile-compliant meal from only those items — no grocery trip needed.\n\nFridge Rescue applies your full profile: a vegan user won't get a chicken recipe; a diabetic user won't get a high-glycemic suggestion. The meal generated fits who you are, built from what you have.",
      },
      {
        heading: "A Sustainable Shopping Routine",
        body: "The friction that breaks most nutrition plans isn't the food itself — it's running out of the right ingredients.\n\nBefore each shop:\n1. Save your weekly plan in the builder\n2. Open your Smart Grocery List\n3. Review through Grocery Coach — note flags and quantity guidance\n4. Use Smart Scan in the store for unfamiliar products\n\nWhen you find a recipe you love outside the app: Recipe Maker.\nWhen you have ingredients but no plan: Fridge Rescue.",
      },
    ],
    exercise: {
      steps: [
        "Save a weekly plan in your builder — tap **Save Plan**.",
        "Open your **Smart Grocery List**. Review what populated.",
        "Open **Grocery Coach**. Review the organized sections and note any flagged items.",
        "Find a recipe online. Open **Recipe Maker**, paste the URL or enter the ingredients, and generate the adapted version. Read the full Meal Card.",
        "Open **Fridge Rescue**. Enter three ingredients you currently have. Generate and read the Meal Card.",
      ],
    },
    remember:
      "Save your plan → review Grocery Coach → use Smart Scan in-store. When you find a recipe to adapt: Recipe Maker. When you have food but no plan: Fridge Rescue.",
    closing:
      "You now have the tools to plan and shop. The next lesson covers what happens when you're eating away from home.",
    quiz: [
      {
        id: "l4-q1",
        question:
          "A user opens her Smart Grocery List and finds it empty. What should she do first?",
        options: [
          "Contact support — the list requires a feature upgrade.",
          "Open Grocery Coach — it generates a list independently.",
          "Check whether her profile is complete.",
          "Go to her builder, complete her weekly plan, and tap Save Plan.",
        ],
        correctIndex: 3,
      },
      {
        id: "l4-q2",
        question:
          "Which best describes what Grocery Coach adds beyond a standard ingredient list?",
        options: [
          "It ranks items by price from lowest to highest at nearby stores.",
          "It shows which stores have the most items in stock.",
          "It adds profile-aware notes — condition flags, allergy reminders, and quantity guidance — to the shopping list items.",
          "It generates a new meal plan based on what local stores carry.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q3",
        question:
          "A user finds a pasta recipe she loves on a food blog. She wants to adapt it to fit her keto dietary identity and daily macro targets. Which tool does she use?",
        options: [
          "Create a Dish — she describes the pasta dish and the platform builds a new version.",
          "Fridge Rescue — she enters the pasta ingredients she has on hand.",
          "Recipe Maker — she pastes the URL and the platform rebuilds the recipe around her profile.",
          "MacroScan — she photographs the recipe's nutrition panel.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q4",
        question:
          "What factors does Smart Scan evaluate when a user scans a barcode in the store?",
        options: [
          "Store pricing, product reviews, and total calorie count.",
          "Macronutrient totals only, without profile context.",
          "Dietary identity, active medical guardrails, and remaining daily macro targets.",
          "Brand reputation, ingredient sourcing, and shelf life.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q5",
        question:
          "A user scans two protein bars. One is marked compatible and the other use with caution. What determines the difference?",
        options: [
          "The compatible bar has fewer total calories.",
          "The platform compared pricing.",
          "The caution bar conflicts with something in her active profile — her dietary identity, medical guardrails, or macro targets.",
          "The compatible bar had better user ratings on the platform.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q6",
        question:
          "What specific problem does Fridge Rescue solve?",
        options: [
          "Generating a full week of meals with no user input.",
          "Using ingredients already on hand to create a profile-compliant meal without an additional grocery trip.",
          "Scanning leftover packaged food for nutritional information.",
          "Creating a shopping list from meals the user enters manually.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q7",
        question:
          "A user has a traditional family recipe that uses dairy and gluten. She keeps kosher and has celiac disease. What does Recipe Maker do with this recipe?",
        options: [
          "Returns an error — it cannot adapt recipes with allergen conflicts.",
          "Rebuilds the recipe around her kosher dietary identity and celiac medical context — swapping incompatible ingredients for compliant alternatives.",
          "Flags the recipe as unsafe and suggests she avoid it.",
          "Generates a similar but entirely different recipe instead.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q8",
        question:
          "A user wants to compare two brands of keto protein powder before buying. Which tool is most appropriate?",
        options: [
          "Grocery Coach — it has a product comparison database.",
          "Fridge Rescue — she enters the serving size to see how it fits a meal.",
          "Recipe Maker — she enters the supplement facts as ingredients.",
          "Smart Scan — she scans both barcodes in-store to compare them against her profile.",
        ],
        correctIndex: 3,
      },
      {
        id: "l4-q9",
        question:
          "What triggers the Smart Grocery List to update?",
        options: [
          "Opening Grocery Coach from the More page.",
          "Logging a meal via Add to Macros.",
          "Saving or updating a weekly plan in the builder.",
          "Running Smart Scan on an item not already on the list.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q10",
        question:
          "A user finds a recipe from a health influencer online and wants to try it, but it has three ingredients she can't eat due to allergies. What is the right tool and what will it do?",
        options: [
          "Fridge Rescue — she enters only the compatible ingredients and it builds a meal from those.",
          "Recipe Maker — she pastes the recipe and the platform adapts it, substituting or removing ingredients that conflict with her allergy profile.",
          "Create a Dish — she describes the recipe concept and gets a new version.",
          "MacroScan — she photographs the influencer's macros to see if the meal fits.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-05",
    lessonNumber: 5,
    title: "Eating Away From Home",
    subtitle: "Restaurant Guide, Fast Food Guide, and Find Meals Near Me",
    learningObjectives: [
      "Use the Restaurant Guide to identify a compliant meal option at a specific restaurant for a user with a named dietary identity",
      "Explain what factors the platform evaluates when surfacing a compatible restaurant or menu item",
      "Use the Fast Food Guide to locate a compliant option at a quick-service chain within a specific macro target",
      "Describe how Find Meals Near Me uses location context to surface nearby options and what it does when no compliant options are available",
    ],
    opening:
      "Eating out is where most nutrition plans break down — not because one restaurant meal is catastrophic, but because there's no system for it. My Perfect Meals includes three tools specifically for eating outside the home. This lesson covers each one, when to use it, and how your profile applies when you're not in your own kitchen.",
    sections: [
      {
        heading: "Why Eating Out Needs Its Own Tools",
        body: "Most nutrition approaches treat eating out as a deviation from the plan — something to manage through willpower and vague rules like \"order the salad.\" My Perfect Meals treats it differently.\n\nEating out is predictable. It happens on work trips, family dinners, long drives, and busy weeknights. If you don't have a system for it, you'll default to guesswork every time. The three tools in this lesson give you that system.\n\nAll three tools apply your active profile. The same dietary identity, medical constraints, and macro awareness that shapes your home meals shapes every restaurant and fast food recommendation.",
      },
      {
        heading: "Restaurant Guide",
        body: "Restaurant Guide provides profile-aware meal recommendations from a specific restaurant's verified menu.\n\nHow to use it:\n1. Open Lifestyle → Meals Away From Home → Restaurant Guide\n2. Enter the restaurant name or browse by cuisine type\n3. The platform returns items from that restaurant's actual menu that fit your profile — dietary identity, medical guardrails, and current macro targets\n4. Each recommendation includes a disclosure note indicating confidence level, data source, and any ordering considerations\n\nRestaurant Guide does not invent meals. It selects from verified items on the restaurant's real menu. If a restaurant isn't yet supported, you'll see that clearly — with no placeholder or invented recommendations in its place.",
      },
      {
        heading: "Fast Food Guide",
        body: "Fast Food Guide applies the same logic as Restaurant Guide, specialized for quick-service chains — McDonald's, Chick-fil-A, Chipotle, Subway, Wendy's, and others.\n\nFast food is often unavoidable on travel days, busy commutes, and long drives. Fast Food Guide doesn't treat these moments as nutritional failures. It finds the available menu items that fit your profile best, with honest disclosure about the nutritional data limitations of fast food.\n\nA diabetic user won't be pointed toward high-glycemic options. A vegan user won't see meat-based recommendations. Profile constraints apply here the same as everywhere else.",
      },
      {
        heading: "Find Meals Near Me",
        body: "Find Meals Near Me uses your location to surface nearby dining options and, where the platform has menu support, provides restaurant-specific recommendations.\n\nWhen you don't know where you're eating and want to find somewhere that fits your plan rather than compromising it, Find Meals Near Me gives you a starting point. It's most effective in areas with a variety of options and restaurant coverage in the platform's menu database.",
      },
      {
        heading: "What to Expect From Restaurant Recommendations",
        body: "Every Meals Away From Home recommendation includes a disclosure framework. This matters.\n\n**Confidence level** — how reliable the nutrition data is for that item (manufacturer-verified, menu-estimated, or approximated).\n\n**Data source** — where the menu information came from.\n\n**Ordering considerations** — what to watch for when placing the order (preparation methods, portion size, common additions that change the nutrition profile).\n\nOne meal out doesn't require starting over or abandoning your plan. With a profile-aware tool and honest disclosure, it's just another meal — with real options and a clear path back to your plan afterward.",
      },
    ],
    exercise: {
      steps: [
        "Open **Lifestyle** and tap **Meals Away From Home**.",
        "Open **Restaurant Guide**. Enter a restaurant you've visited recently or plan to visit.",
        "Review the recommendations. Read the disclosure note on at least one item — note the confidence level and data source.",
        "Return to Meals Away From Home and open **Fast Food Guide**. Browse a chain you recognize.",
        "Return to Meals Away From Home and open **Find Meals Near Me**. Note what appears based on your current location.",
      ],
    },
    remember:
      "Your profile applies everywhere — including restaurants and fast food chains. Restaurant Guide and Fast Food Guide give you real options from real menus, not invented alternatives.",
    quiz: [
      {
        id: "l5-q1",
        question:
          "A user is planning to eat at a specific restaurant tonight and knows the name. Which Meals Away From Home tool should she use?",
        options: [
          "Find Meals Near Me — it uses location to identify nearby restaurants.",
          "Fast Food Guide — it has the broadest restaurant coverage.",
          "Restaurant Guide — enter the restaurant name and get menu-specific recommendations.",
          "The Lifestyle page overview — browse all available options.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q2",
        question:
          "What does the Restaurant Guide return as recommendations?",
        options: [
          "A general list of healthy foods typically found at restaurants.",
          "Meals invented by the AI that would fit her profile, regardless of the actual menu.",
          "Profile-aware recommendations selected from that restaurant's actual verified menu items.",
          "The most popular dishes at the restaurant, filtered by calorie count.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q3",
        question:
          "A user searches for a restaurant in Restaurant Guide and sees a message that the restaurant is not yet supported. What does this mean?",
        options: [
          "The platform generates a generic meal in that restaurant's cuisine style as a fallback.",
          "The platform shows a clear unavailable state — there are no recommendations, invented or otherwise.",
          "It redirects automatically to Find Meals Near Me.",
          "It asks the user to submit the menu so it can generate recommendations.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q4",
        question:
          "A user with Type 2 diabetes uses Fast Food Guide at a burger chain. What should she expect to see?",
        options: [
          "All menu items ranked by calorie count from lowest to highest.",
          "Only salads and water — the platform avoids fast food for diabetic users.",
          "Items from that menu aligned with her diabetic profile — avoiding high-glycemic and high-carb options.",
          "No recommendations — fast food is not available to users with medical conditions.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q5",
        question:
          "When does Find Meals Near Me work best?",
        options: [
          "When the user already knows exactly which restaurant she wants to visit.",
          "In areas with a variety of restaurant options and platform menu coverage in the area.",
          "When the user wants to compare prices between nearby restaurants.",
          "When the user has previously saved a meal from a nearby restaurant.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q6",
        question:
          "A vegan user uses Fast Food Guide at a chain that serves mostly meat-based items. What should she expect?",
        options: [
          "Meat-based items — fast food menus don't accommodate dietary restrictions.",
          "Only vegan-compatible options from the menu — her dietary identity applies the same as it does at home.",
          "No recommendations — the platform skips fast food for vegan users.",
          "A set of nearby grocery stores where she can find vegan options instead.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q7",
        question:
          "What is the primary distinction between Restaurant Guide and Fast Food Guide?",
        options: [
          "Restaurant Guide works internationally; Fast Food Guide is US-only.",
          "Restaurant Guide uses verified nutrition data; Fast Food Guide uses estimates for all items.",
          "Fast Food Guide is specialized for quick-service chains; Restaurant Guide is for full-service and specialty restaurants.",
          "Fast Food Guide requires more profile setup than Restaurant Guide.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q8",
        question:
          "A recommendation in Restaurant Guide includes a disclosure note about confidence level. What does this indicate?",
        options: [
          "The meal has not been verified and should be avoided.",
          "How reliable the nutrition data is for that item — whether it is manufacturer-verified, menu-estimated, or approximated.",
          "The restaurant has flagged this item as a seasonal special with limited availability.",
          "The user's profile requirements were only partially matched by the available menu items.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q9",
        question:
          "How does a user's profile apply when she uses Meals Away From Home tools?",
        options: [
          "The profile is suspended for restaurant meals — eating out is treated as a free meal.",
          "The profile is applied exactly as it is at home — dietary identity, medical guardrails, and macro awareness all remain active.",
          "Only the dietary identity applies — medical guardrails do not extend to restaurant recommendations.",
          "The platform replaces personal profile data with a generic healthy-eating framework for restaurant situations.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q10",
        question:
          "A user traveling for work has only fast food chains within reach. What does Fast Food Guide help her do?",
        options: [
          "Avoid eating out entirely by generating a packable meal she can prepare at the hotel.",
          "Find the available menu items from those chains that best fit her profile, rather than guessing.",
          "Log her meal after eating and adjust her macro plan retroactively.",
          "Contact a nutrition professional for real-time guidance before ordering.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-06",
    lessonNumber: 6,
    title: "Biometrics & Progress Tracking",
    subtitle: "Logging data, reading trends, and using your Hub",
    learningObjectives: [
      "Interpret a biometric trend chart correctly — distinguishing meaningful directional change from normal daily fluctuation",
      "Explain why a flat weight trend combined with declining body fat percentage indicates progress, not stagnation",
      "Describe how logged blood glucose readings connect to meal generation in the Diabetic Hub through GlucoseGuard",
      "Identify the minimum useful logging cadence for each tracked biometric category (weight, body composition, glucose, wellbeing)",
    ],
    opening:
      "Tracking your biometrics in My Perfect Meals is how your progress becomes visible data — not guesswork. This lesson covers what to track, how to log consistently, and how to read your trends so you understand whether your plan is actually working.",
    sections: [
      {
        heading: "What My Biometrics Tracks",
        body: "**My Biometrics** is accessible from your Dashboard. It captures four categories of data:\n\n**Weight** — Your body weight over time. A single number tells you very little. A consistent trend tells you a great deal.\n\n**Body Composition** — Body fat percentage and muscle mass. Separates fat loss from muscle gain in a way that weight alone cannot. Two people can weigh the same while having completely different health trajectories depending on body composition.\n\n**Blood Glucose** — Daily glucose readings for users managing diabetes or using glucose monitoring. These readings connect directly to GlucoseGuard in the Diabetic Hub Builder, which adjusts meal generation based on your logged readings.\n\n**Daily Wellbeing** — Energy level, sleep quality, stress level, and hydration. These aren't soft metrics — they affect how your body responds to your nutrition plan, and they provide context for interpreting weight and composition trends.",
      },
      {
        heading: "Logging Weight — Trends Over Time",
        body: "Weight fluctuates naturally — by up to 2-3 pounds in a single day based on hydration, digestion, and hormonal cycles. A single weigh-in tells you almost nothing. A trend over two to four weeks tells you whether your plan is working.\n\n**Best practices:**\n- Log at the same time each day (morning, before eating, is most consistent)\n- Use the same scale each time\n- Don't react to single readings — look for the direction over two weeks\n\nThe graph in My Biometrics shows your logged weight over time. You're looking for the direction — not the day-to-day noise. A flat line with normal variation is maintenance. A consistent downward direction is fat loss. An upward direction over multiple weeks without intentional muscle building is worth investigating.",
      },
      {
        heading: "Body Composition Tracking",
        body: "Body fat percentage and muscle mass give you information that weight cannot.\n\nScenario: A user's weight stays flat for six weeks. Disappointing? Maybe not. If her body fat percentage dropped 1.5% while muscle mass increased — she's progressing. She lost fat and gained muscle. Her weight didn't change because the two shifts offset each other.\n\nBody composition logging requires a body fat measurement method — a smart scale with bioelectrical impedance, a DEXA scan, or calipers. Enter what you have. Track the trend, not the absolute number. Measurement methods vary in accuracy — consistency of method matters more than which method you use.",
      },
      {
        heading: "Blood Glucose — Daily Check-In for Diabetic Users",
        body: "For users managing Type 1 or Type 2 diabetes, blood glucose is the most important daily metric.\n\nLog your readings in My Biometrics each day. The Diabetic Hub Builder's GlucoseGuard feature reads those logged values and adjusts meal generation accordingly — a user with elevated readings will see meals generated with tighter glycemic constraints.\n\n**What to log:**\n- Fasting glucose (morning, before eating)\n- Post-meal readings (1-2 hours after eating, if your protocol calls for them)\n\nYour logged readings are visible in your trend chart. They're also visible to any connected ProCare physician or dietitian managing your care.",
      },
      {
        heading: "Daily Wellbeing — Energy, Sleep, Stress, Hydration",
        body: "The Daily Wellbeing check-in is a short four-question log you can complete in under a minute.\n\n- **Energy level** — How your body feels physically (1-5 scale)\n- **Sleep quality** — How you slept the previous night\n- **Stress level** — Psychological and lifestyle stress\n- **Hydration** — Estimated daily water intake\n\nWhy this matters for nutrition:\n\nPoor sleep raises cortisol, which promotes fat storage and increases cravings for high-calorie foods. Chronic stress depletes recovery capacity. Dehydration affects metabolic efficiency and hunger signaling. These factors explain why two people on the same meal plan can experience different results.\n\nCoach's Corner reads your daily wellbeing logs and uses them to contextualize your guidance. Log honestly — it's not a judgment, it's data.",
      },
      {
        heading: "Reading Your Dashboard — Macro Check-In",
        body: "Your Dashboard is where daily nutrition tracking lives. The macro tracker shows your targets and what you've logged so far today via **Add to Macros**.\n\nThe check-in question:\n- Are you hitting your protein target consistently? (If not, protein is typically where to start)\n- Are you significantly over on carbs or fat? (A single day rarely matters — a consistent pattern does)\n- Are your meals landing within 15-20% of your targets most days? (That's a successful plan in practice)\n\nDo not optimize for perfect numbers daily. Optimize for consistent direction over time. A biometric trend that moves in the right direction, combined with macro logs that land in the right range, is a plan that's working.",
      },
      {
        heading: "Logging Cadence — How Often to Track",
        body: "You don't need to log every metric every day to get useful data.\n\n**Minimum useful cadence:**\n- Weight: 3x per week (enough for a meaningful trend without over-monitoring)\n- Body composition: 1x per month (body fat and muscle change slowly)\n- Blood glucose: Daily if prescribed; as directed by your physician or dietitian\n- Daily wellbeing: Daily (the check-in takes under a minute)\n- Macros: Log meals as you eat them via Add to Macros\n\nMore data is usually better — but inconsistent data is often worse than less-frequent-but-consistent data. Pick a cadence you can maintain.",
      },
    ],
    exercise: {
      steps: [
        "Open **My Biometrics** from your Dashboard.",
        "Log your current weight. Note the date and time.",
        "Log a Daily Wellbeing check-in. Answer all four questions honestly.",
        "Navigate to the weight trend chart. If you have previous entries, identify the direction of your trend.",
        "Open the macro tracker on your Dashboard. Note your current Protein, Carbohydrate, and Fat targets. Log one meal you've eaten today using **Add to Macros**.",
      ],
    },
    remember:
      "Single data points tell you almost nothing. Trends over two to four weeks tell you everything. Log consistently, read the direction — not the noise.",
    closing:
      "You now know how to track what matters. The next lesson covers specialized systems — the clinical and performance programs that apply when your situation goes beyond standard nutrition.",
    quiz: [
      {
        id: "l6-q1",
        question:
          "A user weighs herself every day for a week and sees daily fluctuations of 1-2 pounds. She's worried she's not making progress. What is the most accurate interpretation?",
        options: [
          "Daily fluctuations of 1-2 pounds indicate the scale is inaccurate and she should switch scales.",
          "Single daily readings fluctuate naturally — she needs two to four weeks of trend data to evaluate whether her plan is working.",
          "Fluctuations of more than 1 pound indicate the meal plan is not calibrated correctly.",
          "She should switch to weekly weigh-ins — daily weigh-ins are not useful for any user.",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q2",
        question:
          "A user's weight has been flat for six weeks. However, her logged body fat percentage has dropped 1.5% and her muscle mass has increased. What does this data tell her?",
        options: [
          "Her scale is malfunctioning — body fat and weight should move in the same direction.",
          "She is not in a caloric deficit and her plan is not working.",
          "She lost fat and gained muscle simultaneously — the weight stayed flat because the two changes offset each other.",
          "Body fat percentage measurements are unreliable and shouldn't be used to evaluate progress.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q3",
        question:
          "How does a diabetic user's logged blood glucose data connect to their meal generation in My Perfect Meals?",
        options: [
          "Logged glucose data is for personal reference only — it doesn't affect meal generation.",
          "It triggers a weekly summary email from the platform.",
          "GlucoseGuard in the Diabetic Hub Builder reads logged readings and adjusts meal generation based on the user's recent glucose levels.",
          "It unlocks additional meal slots in the builder when readings are in a healthy range.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q4",
        question:
          "Why does My Perfect Meals track daily wellbeing metrics like energy, sleep, stress, and hydration?",
        options: [
          "These are required by the platform's clinical protocols for all users.",
          "They're used to rank users in a community leaderboard.",
          "These factors affect how the body responds to a nutrition plan — they provide context for interpreting biometric trends and inform daily coaching guidance.",
          "They're optional vanity metrics that don't affect any platform functionality.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q5",
        question:
          "A user's blood glucose readings are logged in My Biometrics. Who else can see these readings?",
        options: [
          "No one — biometric data is completely private.",
          "All other users on the platform — biometric data is pooled for research.",
          "Any connected ProCare physician or dietitian managing her care.",
          "The platform's AI only — for meal generation adjustments.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q6",
        question:
          "A user wants to log a meal she just ate to track her macros for the day. What does she tap on the Meal Card?",
        options: [
          "Add to Plan — this logs the meal to her daily totals.",
          "Favorite — this saves the meal and logs the macros.",
          "Add to Macros — this logs the meal's nutrition to her daily targets.",
          "Share — this saves the macros to her weekly summary.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q7",
        question:
          "What is the minimum useful logging cadence for body composition tracking?",
        options: [
          "Daily — body composition changes rapidly and requires frequent measurement.",
          "Weekly — weekly trends show meaningful body composition shifts.",
          "Monthly — body fat and muscle mass change slowly enough that monthly measurement captures the trend.",
          "Quarterly — body composition only meaningfully changes over 3-month periods.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q8",
        question:
          "A user's daily macro logs consistently show she's hitting her carb and fat targets but is 30-40g short on protein every day. What should she take from this?",
        options: [
          "Nothing — single-day macro variation is always within acceptable bounds.",
          "Her protein target is set too high and should be reduced.",
          "She's consistently under on protein — this is a pattern worth addressing by generating higher-protein meals or adding a snack.",
          "She should log her meals more frequently to get a more accurate picture.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q9",
        question:
          "Why does consistent measurement method matter more than which body fat measurement method a user chooses?",
        options: [
          "Different methods use the same algorithm, so the method doesn't matter.",
          "All body fat methods are equally accurate, so consistency is the only variable.",
          "Each method has its own margin of error — using the same method consistently shows the real trend, even if the absolute number isn't perfectly precise.",
          "Measurement consistency is a regulatory requirement for health apps.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q10",
        question:
          "A user has been logging consistently for four weeks. Her weight trend shows a consistent downward direction with normal daily fluctuation. What does this tell her?",
        options: [
          "Her scale is measuring incorrectly — weight can't decrease consistently without plateaus.",
          "Her plan is working — a consistent downward trend over four weeks is the signal she's looking for.",
          "She should reduce her caloric intake further since she's still losing weight.",
          "She needs to log body composition to confirm the weight loss is fat and not muscle.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-07",
    lessonNumber: 7,
    title: "Specialized Health & Performance Systems",
    subtitle: "Clinical programs, performance nutrition, and the protocol priority hierarchy",
    learningObjectives: [
      "Name the five specialized program systems and identify which tier of the 4-level protocol hierarchy each one occupies",
      "Explain how the platform resolves a conflict when two active specialized programs produce contradictory recommendations for the same meal",
      "Describe how Oncology Support is assigned, what it does, and what it explicitly does not do — including why it cannot be self-activated",
      "Explain how GlucoseGuard uses logged glucose readings to dynamically adjust meal generation constraints",
    ],
    opening:
      "My Perfect Meals includes several specialized program systems that go beyond standard meal generation. This lesson covers the major clinical and performance systems active on the platform — what each one does, how it interacts with your profile, and how the platform manages multiple active programs at once.",
    sections: [
      {
        heading: "How Specialized Programs Work",
        body: "Specialized programs are applied to your profile as active constraints — not as themes or suggestions. When a program is active, it shapes every meal generated through your builder.\n\nPrograms don't replace your dietary identity. They layer on top of it in a specific order:\n\n1. **Medical** (highest priority) — clinical conditions, physician-assigned protocols\n2. **Dietary Identity** — vegan, keto, halal, kosher, etc.\n3. **Cultural and Cuisine Preference** — regional cooking styles, flavor profiles\n4. **Behavioral** (lowest priority) — spice level, texture preferences, cooking time\n\nWhen two active programs potentially conflict, the higher-tier program takes precedence. A diabetic user who prefers high-carb cuisine will see diabetic guardrails honored over cuisine preference. A user with an active oncology protocol will see that protocol honored over all other preferences.\n\nThis hierarchy isn't a limitation. It's the safety system.",
      },
      {
        heading: "Diabetic Support — GlucoseGuard",
        body: "The Diabetic Hub and Meal Builder applies blood-glucose-aware constraints to every generated meal.\n\n**GlucoseGuard** is the system within the Diabetic Builder that connects your logged glucose readings to meal generation. When your readings trend higher, GlucoseGuard tightens glycemic constraints. When readings are stable, generation is more flexible within your diabetic profile.\n\nGlucoseGuard considers:\n- Glycemic index and glycemic load of ingredients\n- Carbohydrate quality and fiber content\n- Meal timing and portion calibration for glucose stability\n\nDiabetic users who log glucose readings consistently get more responsive meal generation than those who don't. The system needs data to adapt.",
      },
      {
        heading: "GLP-1 / Metabolic Medication Support",
        body: "The Metabolic Medication Hub and Builder is designed for users on GLP-1 medications — Ozempic, Wegovy, Mounjaro, Zepbound, and similar.\n\nGLP-1 medications change how hunger and satiety work. Standard meal portions can feel too large. Standard protein targets can be hard to reach when appetite is reduced. The Metabolic Medication Builder accounts for this:\n\n- **Reduced-appetite portion calibration** — meals are built for smaller eating windows\n- **Protein density prioritization** — high protein-to-volume ratios so users can meet targets in smaller portions\n- **Tolerance phase tracking** — meals adapted to the tolerance phase the user is currently in (early, building, stabilized)\n\nThe builder also includes an injection tracker for logging medication dosing alongside the nutrition plan.",
      },
      {
        heading: "Anti-Inflammatory Protocol",
        body: "The Anti-Inflammatory Meal Builder filters every generated meal through an inflammation evidence framework.\n\nIngredients associated with pro-inflammatory response — refined sugars, processed seed oils, certain additives — are excluded from generation. Ingredients with documented anti-inflammatory properties — omega-3 sources, polyphenol-rich produce, whole grains — are prioritized.\n\nThe Anti-Inflammatory Builder is appropriate for users with:\n- Autoimmune conditions (Hashimoto's, rheumatoid arthritis, lupus, inflammatory bowel disease)\n- Chronic joint pain\n- Cardiovascular inflammation markers\n- General wellness goals centered on inflammation reduction\n\nUsers with a physician-diagnosed inflammatory condition should confirm their protocol with that physician before relying solely on platform-generated meals.",
      },
      {
        heading: "Oncology Support",
        body: "Oncology Support is the most restricted specialized program on the platform.\n\n**How it's assigned:** Oncology Support is physician-assigned through the ProCare system. A user cannot self-activate this program. A physician connected through ProCare assigns it after reviewing the client's clinical situation.\n\n**What it does:**\n- Hard-blocks a curated list of ingredients associated with adverse interactions during active treatment\n- Prioritizes nutrient-dense, easily-digestible meals appropriate for treatment-phase nutritional support\n- Applies conservative guardrails on preparation methods that might create compounds problematic during treatment\n\n**What it does not do:**\n- Make treatment claims\n- Replace clinical nutritional support from a registered oncology dietitian\n- Override physician-directed nutritional restrictions\n\nOncology Support is designed to keep the platform useful during a difficult time — not to serve as a medical nutrition therapy system.",
      },
      {
        heading: "Performance Nutrition",
        body: "The Performance Nutrition Hub and Builder is designed for athletes managing training-cycle nutrition.\n\n**Training phase awareness:** Macro targets in the Performance Builder shift based on the training phase the user is in — strength/hypertrophy phases have different carbohydrate and protein needs than endurance phases or recovery weeks.\n\n**What the Performance Builder includes:**\n- Phase-aware macro calibration (strength, endurance, active recovery, competition taper)\n- Athlete Meal Picker — structured meal selection for sport-specific fueling\n- Athlete Beverage Creator — performance-focused hydration and recovery drinks\n- Session logging — training sessions logged alongside nutrition for fueling context\n\nThe Performance Builder does not replace a sports dietitian for elite or competitive athletes with complex periodization needs. It provides a strong, evidence-informed foundation for athletes who don't have access to professional sports nutrition support.",
      },
      {
        heading: "When Multiple Programs Are Active",
        body: "Users can have more than one specialized program active simultaneously.\n\nExample: A user managing Type 2 diabetes who is also training for a marathon. Both the Diabetic and Performance programs are active. The platform applies them through the protocol hierarchy — medical (diabetic guardrails) first, then performance targets within those guardrails.\n\nIn practice, this means carbohydrate recommendations are calibrated for both glycemic stability and performance fueling. The meal isn't simply diabetic-appropriate or performance-appropriate — it's both, in that order of priority.\n\nThe Nutrition Personalization Summary on your Dashboard shows every active program. When you see multiple programs listed, each one is actively constraining and shaping your generation — in priority order.",
      },
    ],
    exercise: {
      steps: [
        "Open your Dashboard and tap the **Nutrition Personalization Summary**. Read which programs are currently active in your profile.",
        "Identify the priority tier of each active program (Medical, Dietary Identity, Cultural, Behavioral).",
        "Tap the program you understand least. Read the explanation.",
        "Navigate to your assigned builder and generate one meal. Open the Meal Card and read the **Active Programs** section — note which programs shaped this specific meal.",
      ],
    },
    remember:
      "Specialized programs layer on top of your dietary identity in a fixed priority order: Medical → Dietary Identity → Cultural → Behavioral. When programs could conflict, higher-tier programs always take precedence.",
    quiz: [
      {
        id: "l7-q1",
        question:
          "A user has both a diabetic protocol and a high-carb cuisine preference active in her profile. Which takes precedence when meals are generated?",
        options: [
          "Cuisine preference — it was set more recently during her last profile update.",
          "They are weighted equally — the platform tries to balance both.",
          "Diabetic protocol — medical constraints are higher priority than cultural/cuisine preferences in the protocol hierarchy.",
          "Whichever program was activated first in her profile.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q2",
        question:
          "What does GlucoseGuard do in the Diabetic Hub and Meal Builder?",
        options: [
          "Blocks all carbohydrates from generated meals.",
          "Connects logged blood glucose readings to meal generation — tightening glycemic constraints when readings trend higher and relaxing them when readings are stable.",
          "Sends glucose alerts to a connected physician.",
          "Calculates insulin needs based on each generated meal's carbohydrate content.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q3",
        question:
          "Why does the Metabolic Medication (GLP-1) Builder prioritize high protein-to-volume ratios?",
        options: [
          "GLP-1 medications increase appetite and users need more protein to compensate.",
          "Users on GLP-1 medications often have reduced appetite — high protein density helps them meet targets while eating smaller portions.",
          "GLP-1 medications deplete protein stores and require supplementation.",
          "High protein-to-volume meals are required by the FDA for GLP-1 users.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q4",
        question:
          "How is Oncology Support assigned in My Perfect Meals?",
        options: [
          "A user self-activates it from the Health Profile section during onboarding.",
          "It activates automatically when a user logs a cancer diagnosis.",
          "A physician connected through ProCare assigns it after reviewing the client's clinical situation.",
          "It's available to any user who pays for the Clinical subscription tier.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q5",
        question:
          "A user with rheumatoid arthritis asks which builder is most appropriate for her situation. What do you tell her?",
        options: [
          "My Weekly Meal Builder — it's the most flexible and handles all conditions.",
          "The Anti-Inflammatory Meal Builder — it filters every generated meal through an inflammation evidence framework, appropriate for autoimmune conditions.",
          "The General Nutrition Builder (ProCare) — autoimmune conditions always require physician oversight.",
          "The Diabetic Hub — it has the most conservative ingredient restrictions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q6",
        question:
          "What does the Oncology Support program explicitly NOT do?",
        options: [
          "Hard-block ingredients associated with adverse interactions during treatment.",
          "Prioritize nutrient-dense, easily-digestible meals appropriate for treatment-phase nutrition.",
          "Make treatment claims or replace clinical nutritional support from an oncology dietitian.",
          "Apply conservative guardrails on preparation methods during treatment.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q7",
        question:
          "A marathon runner managing Type 2 diabetes has both the Diabetic and Performance programs active. How does the platform handle their potential conflict over carbohydrate recommendations?",
        options: [
          "The platform prompts the user to choose one program as primary.",
          "Diabetic guardrails are applied first, and performance carbohydrate targets are calibrated within those guardrails — both active, in priority order.",
          "The Performance program takes precedence because athletic performance requires adequate carbohydrates.",
          "The two programs cancel each other out — neither applies until one is deactivated.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q8",
        question:
          "How do macro targets change in the Performance Nutrition Builder across training phases?",
        options: [
          "They stay fixed — the user sets them once during onboarding and they don't change.",
          "They update monthly based on the user's logged weight.",
          "They shift based on the training phase — strength and hypertrophy phases have different carb and protein needs than endurance phases or recovery weeks.",
          "They are set by a ProCare coach and cannot be adjusted by the platform automatically.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q9",
        question:
          "Where does a user see all of their currently active specialized programs?",
        options: [
          "In My Hub under Active Programs.",
          "In the Nutrition Personalization Summary on the Dashboard.",
          "In the App Library under their assigned builder's description.",
          "In the Protocol Status indicator, which is only visible during active meal generation.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q10",
        question:
          "What is the correct protocol priority order in My Perfect Meals?",
        options: [
          "Behavioral → Cultural → Dietary Identity → Medical",
          "Dietary Identity → Medical → Cultural → Behavioral",
          "Cultural → Dietary Identity → Behavioral → Medical",
          "Medical → Dietary Identity → Cultural → Behavioral",
        ],
        correctIndex: 3,
      },
    ],
  },
  {
    id: "lesson-08",
    lessonNumber: 8,
    title: "AI Adaptation & Your Boundaries",
    subtitle: "How the platform learns, what it guarantees, and where you remain in control",
    learningObjectives: [
      "Distinguish what the AI knows explicitly from your profile versus what it estimates through contextual inference",
      "Interpret macro values correctly — distinguish between a null disclosure and a zero value, and act appropriately on incomplete macro information",
      "Identify which profile changes require a new plan generation to take effect versus which apply to the next individual meal",
      "Describe the correct way to override or correct an AI-generated recommendation without breaking your profile's constraints",
    ],
    opening:
      "My Perfect Meals generates thousands of recommendations every day. Each one passes through a layered safety and intelligence system before it reaches a user. This lesson explains how that system works — what it protects, why it's built the way it is, and what it means for professionals and clients who rely on the platform's output.",
    sections: [
      {
        heading: "The Protocol Hierarchy",
        body: "Every meal My Perfect Meals generates is shaped by a four-level constraint hierarchy. Understanding this hierarchy explains why the platform behaves the way it does — and why certain requests can't override certain profile settings.\n\n**Level 1 — Medical (highest priority)**\nIf a user has a medical condition active in their profile — Type 2 diabetes, oncology support, kidney disease, GLP-1 protocol — that condition shapes the output before anything else is considered. Medical constraints cannot be overridden by the user's request, dietary identity, or cuisine preference.\n\n**Level 2 — Dietary Identity**\nThe user's dietary category (vegan, vegetarian, keto, carnivore, halal, kosher, and others) is a firm boundary. A request that conflicts with dietary identity is redirected — not refused — toward a version that fits within that identity.\n\n**Level 3 — Cultural and Cuisine Preference**\nThe user's preferred food traditions and flavors shape the style of what's generated within the limits set by levels 1 and 2.\n\n**Level 4 — Behavioral Preference (lowest priority)**\nHeat level, cooking time, ingredient variety, and similar lifestyle preferences apply last. They influence the experience but yield to every higher-priority constraint.\n\nThis hierarchy is the reason a user with diabetes who requests a high-carb dish gets a medically appropriate alternative — the medical constraint always wins.",
      },
      {
        heading: "SafetyGuard™ — The Allergy Layer",
        body: "SafetyGuard™ is the system that enforces hard ingredient blocks based on the user's allergy profile. It operates at every point where the platform generates or evaluates food.\n\nWhen a user enters an allergy — shellfish, peanuts, tree nuts, dairy, gluten — that allergen becomes a hard block. The platform does not serve it with a warning. It does not ask for confirmation. It does not include it in a modified form. It removes it entirely from consideration.\n\nThis is different from a preference. A user who says \"I don't like cilantro\" may still receive a dish with cilantro if the generation doesn't account for it. A user who says \"I am allergic to cilantro\" will never receive a dish containing it.\n\nFor professionals working with clients who have severe allergies: the allergy list is protected by a Safety PIN. Changes to a client's allergy profile require PIN confirmation. This prevents accidental modification of a safety-critical field.",
      },
      {
        heading: "GlucoseGuard™ — Diabetic Protocol Intelligence",
        body: "GlucoseGuard™ is the glucose-aware nutrition intelligence layer that activates when a user has Type 2 diabetes, pre-diabetes, or glucose management selected in their medical profile.\n\nIt shapes meal generation in several specific ways:\n- High glycemic index foods are flagged or replaced\n- Carbohydrate distribution is adjusted toward slower-digesting sources\n- Portion guidance accounts for glucose load, not just total calories\n- The platform actively tracks patterns in what the diabetic user generates over time\n\nGlucoseGuard™ also enables blood glucose logging in My Biometrics. Users can track their readings over time alongside their meal history — giving both the user and their professional a clearer picture of how the nutrition plan is affecting real-world glucose levels.",
      },
      {
        heading: "How Macro Values Are Reported",
        body: "My Perfect Meals reports macro values exactly as the platform knows them — not more, not less.\n\nWhen you see a macro value in a meal card, it reflects the best available data for that meal. When reliable data is not available, the platform shows an honest blank rather than filling in an estimate that could mislead your nutrition planning.\n\n**What null and zero mean to you**\n- A blank (null) macro value means the platform does not have enough data to report that number confidently. It is an honest disclosure — not an error, and not a zero.\n- A zero macro value means the platform has confirmed that macro is negligibly present in the meal.\n\nThis distinction matters when you're reviewing a client's nutrition closely. A blank calorie count means the data source was incomplete. A zero calorie count means the food genuinely contributes no meaningful calories.\n\n**Using incomplete macro data**\nIf you see blank values in a meal card, you have a few options:\n- Regenerate the meal — the platform will attempt to produce a more complete result\n- Log the meal and note the incomplete macro in your tracking\n- For clients: flag the meal for review rather than treating blanks as zeros\n\nFor professionals: when a client shows you a macro breakdown from My Perfect Meals, any blank values are intentional honesty. The platform surfaces incomplete data so that decisions made by you, the client, or any clinical team are based on real information.",
      },
      {
        heading: "Clinical Mode and Specialty Programs",
        body: "Several features of My Perfect Meals are clinical — they require a physician, dietitian, or certified professional to activate or assign.\n\nExamples include:\n- **Oncology Support**: a program for users in cancer treatment or recovery, assigned by a physician with oncology context. The platform enforces ingredient rules appropriate for this population and does not make treatment claims.\n- **GLP-1 Protocol Support**: specific fueling guidance for users on GLP-1 medications, including portion scaling and protein prioritization.\n- **Anti-Inflammatory Protocol**: dietary guidance built around reducing systemic inflammation, often used in clinical or post-surgical contexts.\n\nThese programs sit at Level 1 in the protocol hierarchy. Assigning them without appropriate credentials is not supported by the platform. If you are a professional assigning clinical programs, ensure you have verified your credentials in your professional account.",
      },
      {
        heading: "What the Platform Cannot Do",
        body: "Understanding the system also means understanding its limits.\n\nMy Perfect Meals does not:\n- Provide medical diagnoses\n- Calculate drug-nutrient interactions\n- Guarantee that a specific meal will produce a specific clinical outcome\n- Replace physician supervision for any clinical nutrition protocol\n- Generate individual meal recommendations based on real-time blood glucose readings (it uses manually logged values, not continuous glucose monitor data)\n\nThe platform generates personalized nutrition guidance. That guidance is built on a user's profile, their active clinical programs, and an honest reporting of what is and is not known. It is not a clinical order, a prescription, or a guarantee.",
      },
      {
        heading: "The platform shows its work so you can trust its output.",
        body: "The Nutrition Personalization Summary on the Dashboard exists because transparency builds trust. Every active protocol, every constraint, every program that shapes a user's meals is visible and named. When a client asks why their meals look a certain way, the platform has already answered the question — they just need to know where to look.",
      },
    ],
    exercise: {
      steps: [
        "Open My Perfect Meals and navigate to your Nutrition Personalization Summary on the Dashboard. Read which programs are currently active in your profile.",
        "Go to your profile's Allergy & Safety section. Review your current allergy list. Note whether a Safety PIN is set.",
        "Generate one meal using your assigned Builder. After it appears, read the macro breakdown carefully. Note any values that are null versus zero.",
        "If you have a client in ProCare Studio: open their profile and review which Level 1 medical constraints are active. Consider whether those constraints are accurately reflected in their current Builder access.",
      ],
    },
    remember:
      "The platform's safety systems work automatically — but they only work as well as the profile data they're built on. Accurate profiles produce accurate safety filtering. Incomplete profiles produce incomplete protection.",
    quiz: [
      {
        id: "l8-q1",
        question:
          "A user with Type 2 diabetes requests a white rice and black bean bowl. The platform returns a brown rice alternative with adjusted portion guidance. Why?",
        options: [
          "The request contained ingredients not supported by the platform's database.",
          "The platform is malfunctioning — it should return exactly what the user requested.",
          "The medical constraint (Type 2 diabetes) operates at the highest level of the protocol hierarchy and shapes the output before the request is considered.",
          "The user's cuisine preference is overriding the dietary request.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q2",
        question:
          "A client has a severe shellfish allergy entered in her profile. She requests shrimp tacos. What does the platform do?",
        options: [
          "Returns shrimp tacos with an allergy warning visible on the meal card.",
          "Asks for PIN confirmation before generating the dish.",
          "Replaces shrimp with a non-shellfish protein and generates a compliant version — the allergy is a hard block, not a warning.",
          "Refuses to generate any taco dish until the allergy is removed.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q3",
        question:
          "A user asks why a macro value in his meal card shows \"null\" instead of a number. What is the accurate explanation?",
        options: [
          "There is a database error — null values are a known bug.",
          "The macro value is zero, displayed differently for formatting reasons.",
          "The platform does not have reliable data for that macro and is disclosing that honestly rather than inventing a number.",
          "The user's subscription tier does not include full macro breakdown.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q4",
        question:
          "In the protocol hierarchy, which constraint type always takes precedence over all others?",
        options: [
          "Dietary Identity — it is set during onboarding and governs all meal decisions.",
          "Behavioral Preference — the user's day-to-day preferences shape every output.",
          "Cuisine Preference — the user's cultural traditions define the style of every meal.",
          "Medical constraints — active health conditions apply first, before dietary identity, cuisine preference, or behavioral preference.",
        ],
        correctIndex: 3,
      },
      {
        id: "l8-q5",
        question:
          "A coach working with a post-surgical client wants to assign an Anti-Inflammatory Protocol. Before doing so, what does the platform require?",
        options: [
          "Nothing — any professional in ProCare Studio can assign any protocol.",
          "The client must request the protocol themselves before the coach can apply it.",
          "The coach must have verified clinical credentials in their professional account — the platform enforces credential requirements on clinical protocol assignment.",
          "A physician must co-sign the protocol assignment through the admin portal.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q6",
        question:
          "A user with GlucoseGuard™ active asks why the platform suggested a smaller portion of pasta than she expected. What is the accurate explanation?",
        options: [
          "The platform has detected a caloric surplus in her recent meal history and is self-correcting.",
          "GlucoseGuard™ adjusts portions to account for glucose load, not just total calories — smaller portions of high-glycemic foods are appropriate for this protocol.",
          "The platform has defaulted to a standard weight-loss portion because her goal setting may have changed.",
          "Pasta is blocked for all users with glucose-related conditions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l8-q7",
        question:
          "A client asks her dietitian: \"Does My Perfect Meals adjust my meals based on my continuous glucose monitor (CGM) readings?\" What is the accurate answer?",
        options: [
          "Yes — the platform integrates with CGM devices via Bluetooth and adjusts recommendations in real time.",
          "Yes — but only for users who have enabled the GlucoseGuard™ premium tier.",
          "No — the platform uses manually logged blood glucose values from My Biometrics, not real-time CGM data.",
          "No — the platform does not support any blood glucose data, manual or automatic.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q8",
        question:
          "A professional working with an oncology client wants to understand what Oncology Support does within the platform. Which statement is accurate?",
        options: [
          "Oncology Support generates treatment plans specific to the client's cancer type and medication.",
          "Oncology Support enforces appropriate ingredient rules and nutritional guidance for this population — it does not make treatment claims and is assigned by a physician.",
          "Oncology Support is a client-facing label only and does not affect meal generation.",
          "Oncology Support replaces the standard meal builder with a physician-curated static menu.",
        ],
        correctIndex: 1,
      },
      {
        id: "l8-q9",
        question:
          "A user's allergy list shows \"peanuts\" and she wants to remove it because she was recently tested and is no longer allergic. What does she need to provide to make the change?",
        options: [
          "Nothing — allergy changes are open in Edit Profile like any other preference.",
          "A note from her physician uploaded through the medical records portal.",
          "Her Safety PIN — allergy modifications are protected to prevent accidental changes to a safety-critical field.",
          "Approval from her connected ProCare professional before the platform will accept the change.",
        ],
        correctIndex: 2,
      },
      {
        id: "l8-q10",
        question:
          "A client says: \"My Perfect Meals told me that following this meal plan will improve my A1C.\" What should the professional's response be?",
        options: [
          "That's accurate — the platform makes evidence-based clinical outcome predictions for diabetic users.",
          "The platform generates personalized nutrition guidance, not clinical outcome guarantees. It cannot promise that following a meal plan will produce a specific clinical result.",
          "The prediction is accurate if the client has GlucoseGuard™ active — that system tracks and projects A1C trends.",
          "The platform only makes predictions for users on physician-assigned protocols.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-09",
    lessonNumber: 9,
    title: "Marketing & Brand Standards",
    subtitle: "Approved language, prohibited claims, social media rules, and how referral tools work",
    learningObjectives: [
      "Identify the approved ways to describe My Perfect Meals and its capabilities",
      "Recognize prohibited claims and understand why they put you and the platform at risk",
      "Apply social media best practices and required disclaimers to your partner content",
      "Understand how referral tracking works so you can explain it accurately to prospects",
    ],
    opening:
      "Every partner message that reaches a prospect is part of the My Perfect Meals brand. When that message is accurate and clear, it builds trust — for you and for the platform. When it overstates what the platform does, it creates risk: legal exposure, regulatory scrutiny, and users whose expectations don't match reality.\n\nThis lesson gives you the complete rulebook. You'll learn exactly which descriptions are approved, which claims are off-limits and why, how to build a compliant social media presence, and how the referral tools in Partner Center work so you can explain them honestly to anyone you bring in.",
    sections: [
      {
        heading: "Approved Descriptions",
        body: "My Perfect Meals is a **personalized nutrition platform** powered by artificial intelligence. That's the foundation every approved description builds from.\n\nThe platform generates meal recommendations based on a user's dietary profile, health goals, and — where applicable — clinical conditions. It does not diagnose, treat, or cure any condition. It does not replace the judgment of a licensed healthcare professional. It is a sophisticated nutrition tool.\n\nApproved ways to describe the platform:\n\n- *\"A personalized nutrition app that builds meal plans around your dietary needs, goals, and lifestyle\"*\n- *\"AI-powered meal planning that adapts to what you eat, your health conditions, and your fitness targets\"*\n- *\"A platform that helps you build and follow a meal plan tailored to your profile — not a generic diet\"*\n- *\"My Perfect Meals uses your dietary identity to generate meals you'll actually want to eat\"*\n\nAll of these are accurate. They describe what the platform does without making clinical promises it cannot keep.\n\nWhen describing specific features — GlucoseGuard™, GLP-1 support, Performance Nutrition — describe them by their function, not their outcome. \"GlucoseGuard adapts meals to support blood sugar management\" is approved. \"GlucoseGuard will lower your A1C\" is not.",
      },
      {
        heading: "Prohibited Claims",
        body: "The following categories of claims are prohibited in all partner marketing, regardless of how they are phrased.\n\n**Clinical outcome guarantees.** You may not promise that using My Perfect Meals will produce a specific health result — weight loss, lower blood sugar, improved cholesterol, better energy, or any other clinical metric. The platform supports your nutrition goals; it does not guarantee outcomes.\n\n**Disease treatment or cure claims.** You may not state or imply that the platform treats, manages, cures, or reverses any condition. Approved language describes the platform as supportive of a user's needs, not as a medical intervention.\n\n**Income or earnings guarantees.** The Partner Program generates referral commissions when your links convert. You may not promise a specific income figure, and you may not present the program as a passive income guarantee.\n\n**Before-and-after medical claims.** You may share personal experiences. You may not attribute specific clinical outcomes (\"I lost 30 pounds because the platform fixed my insulin response\") to the platform in a way that implies medical causation.\n\n**Competitor disparagement.** You may not make false or misleading comparisons to competitor products. Factual, accurate comparisons are acceptable; invented or unverifiable claims are not.\n\nIf you're unsure whether a claim is prohibited, apply this test: *Would a new user's experience be harmed if this claim turned out to be untrue?* If yes, don't use it.",
        type: "callout",
      },
      {
        heading: "Social Media Best Practices",
        body: "Social media is the primary channel through which most partners bring in referrals. The following practices keep your content compliant and effective.\n\n**Always include the required disclaimer.** Any post that promotes My Perfect Meals must include: *\"I am a My Perfect Meals partner and may earn a commission from referrals.\"* This must be visible without expanding the post — it cannot be buried in hashtags or placed below a \"read more\" truncation point.\n\n**Use first-person experience, not third-party promises.** \"I've used the platform for three months and my meal planning is faster\" is compliant. \"This app will change your relationship with food\" makes a promise you cannot keep on behalf of the platform.\n\n**Don't create fake urgency.** Countdown timers, invented limited-time offers, or false scarcity (\"only 3 spots left\") are prohibited unless they reflect actual current promotions published in Partner Center.\n\n**Tag content correctly.** On Instagram and TikTok, use the paid partnership label when applicable. On YouTube, include a verbal disclosure in the first 30 seconds of any video that promotes the platform.\n\n**Respond accurately to questions.** When followers ask what the platform does or whether it will work for their specific condition, direct them to the platform's free trial or the clinical information on the My Perfect Meals website. Don't answer clinical questions yourself.\n\n**Keep screenshots current.** If you post screenshots of the app, they should reflect the current interface. Outdated screenshots that misrepresent the current product are a compliance violation.",
      },
      {
        heading: "How Referral Tools Work",
        body: "Your Partner Center includes a set of referral tools you can use to track and share your link. Understanding how they work lets you explain them accurately to prospects.\n\n**Your referral link.** Every partner has a unique tracking link. When a prospect clicks that link and creates an account, the referral is attributed to you for a 30-day window. If they subscribe within that window, you earn the commission for that subscription. The tracking is cookie-based on the device they used to click your link.\n\n**Attribution window.** The 30-day window begins when the prospect clicks your link. If they return directly to the site or use a different device after the window expires, the referral is not attributed to you. This is standard for affiliate programs and is worth explaining honestly — you're not promising credit for every prospect you send.\n\n**Commission structure.** Commissions are paid on active subscriptions. If a referred subscriber cancels, the commission for that period is reversed. Commissions are paid monthly through the affiliate payment processor after a 30-day holding period.\n\n**The Messaging Guide.** The Messaging Guide tab in Partner Center shows approved language, prohibited claims, and the required disclaimers in one place. Any time you're writing new marketing content, start there. It is updated whenever platform language or compliance requirements change.\n\n**Tracking your performance.** Partner Center shows your click count, conversion rate, active referrals, and commission history. These numbers update in near real-time. If you notice a discrepancy, contact the partner support team — don't manually adjust or estimate your commissions in your own marketing materials.\n\nYou are not permitted to use paid advertising on Google, Meta, or other platforms that targets keywords associated with My Perfect Meals without prior written approval. Paid keyword bidding on brand terms is a violation of the partner agreement.",
      },
      {
        heading: "When You're Not Sure",
        body: "The single most reliable resource for compliance questions is the Messaging Guide in Partner Center. It reflects current, approved language — not this lesson, which covers the rules at a point in time.\n\nIf the Messaging Guide doesn't answer your question:\n\n1. Default to describing the platform by what it does functionally, not by what outcomes it promises\n2. Include the required disclaimer whenever you mention the platform in a promotional context\n3. Contact the partner support team before publishing content that feels borderline\n\nPartner accounts that repeatedly publish prohibited claims are subject to suspension. First violations that are corrected quickly are typically treated as compliance education events. Repeated or intentional violations are treated as agreement violations.\n\nThe goal of these rules is not to limit what you can say — it's to make sure that what you say is true, and that the people you bring in have an accurate picture of what they're signing up for. That's what makes referrals convert and stay.",
      },
    ],
    exercise: {
      steps: [
        "Open the Messaging Guide tab in Partner Center and read the full Approved Language section.",
        "Write three social media captions for My Perfect Meals using only approved language. Include the required disclaimer in each one.",
        "Review your three captions against the Prohibited Claims list. Identify any phrase that could be read as a clinical outcome promise and revise it.",
        "Share your referral link with one person this week and explain the 30-day attribution window honestly before they click.",
      ],
    },
    remember:
      "Accurate language builds lasting trust. Describe what the platform does, include the required disclaimer, and let users form their own outcome expectations — that's the standard every partner post should meet.",
    closing:
      "You've completed the Marketing & Brand Standards lesson. The rules in this lesson, combined with the live Messaging Guide in Partner Center, are your complete compliance framework. Apply them every time you create content, and you'll build a referral presence that's both effective and honest.",
    quiz: [
      {
        id: "l09q01",
        question:
          "Which of the following is an approved way to describe My Perfect Meals?",
        options: [
          "\"My Perfect Meals will lower your blood sugar if you follow the meal plan\"",
          "\"A personalized nutrition platform that adapts meal recommendations to your dietary profile and goals\"",
          "\"The only app clinically proven to reverse metabolic disease\"",
          "\"A guaranteed weight-loss system backed by AI\"",
        ],
        correctIndex: 1,
      },
      {
        id: "l09q02",
        question:
          "A partner posts: \"I used My Perfect Meals for 60 days and my doctor confirmed my A1C dropped — this app treats insulin resistance.\" What is wrong with this post?",
        options: [
          "Nothing is wrong — sharing personal health outcomes is always permitted",
          "The partner should not have mentioned a doctor",
          "The post makes a disease-treatment claim, which is a prohibited claim category regardless of personal experience",
          "The post is only prohibited if the partner didn't include their referral link",
        ],
        correctIndex: 2,
      },
      {
        id: "l09q03",
        question:
          "Where must the required partner disclosure appear in a social media post?",
        options: [
          "It can appear anywhere in the caption, including below hashtags",
          "It must be visible without the user expanding the post — not buried in hashtags or below a truncation point",
          "It only needs to appear in Instagram Stories, not feed posts",
          "It is only required for video content",
        ],
        correctIndex: 1,
      },
      {
        id: "l09q04",
        question:
          "How long is the referral attribution window for My Perfect Meals partner links?",
        options: [
          "7 days from the click",
          "60 days from account creation",
          "90 days from the click",
          "30 days from the click",
        ],
        correctIndex: 3,
      },
      {
        id: "l09q05",
        question:
          "A follower asks: \"Will this app work for my Type 2 diabetes?\" What is the compliant response?",
        options: [
          "\"Yes, it includes GlucoseGuard which is proven to manage Type 2 diabetes\"",
          "\"The platform has a GlucoseGuard system — I'd direct you to the My Perfect Meals website for the clinical detail and recommend you discuss it with your doctor\"",
          "\"It will definitely help — I've seen great results in diabetic users\"",
          "\"I can't comment on that because of HIPAA\"",
        ],
        correctIndex: 1,
      },
      {
        id: "l09q06",
        question:
          "Which of the following is a prohibited claim in partner marketing?",
        options: [
          "\"My Perfect Meals uses AI to personalize your meal plan\"",
          "\"The platform adapts to your dietary identity\"",
          "\"My Perfect Meals will cure your metabolic condition\"",
          "\"I'm a partner and may earn a commission from referrals\"",
        ],
        correctIndex: 2,
      },
      {
        id: "l09q07",
        question:
          "A partner wants to run Google Ads targeting the keyword \"best nutrition app.\" What does the partner agreement say about this?",
        options: [
          "Paid advertising is fully permitted with no restrictions",
          "Paid advertising is permitted only on Meta platforms",
          "Paid keyword advertising on any platform requires prior written approval from My Perfect Meals",
          "Paid advertising is prohibited only if the partner has fewer than 1,000 followers",
        ],
        correctIndex: 2,
      },
      {
        id: "l09q08",
        question: "What happens to a partner's commission if a referred subscriber cancels their subscription?",
        options: [
          "The commission is kept — cancellations after 30 days don't affect earnings",
          "The commission for that subscription period is reversed",
          "The commission is held for 90 days and then released regardless of cancellation",
          "Cancellations have no effect on commission calculations",
        ],
        correctIndex: 1,
      },
      {
        id: "l09q09",
        question:
          "Which social media practice is specifically required for YouTube videos that promote My Perfect Meals?",
        options: [
          "Pinning the referral link as a top comment",
          "Using the paid partnership label in the video thumbnail",
          "Including a verbal disclosure within the first 30 seconds of the video",
          "Uploading a companion blog post with the required disclaimer",
        ],
        correctIndex: 2,
      },
      {
        id: "l09q10",
        question:
          "What is the best first step before publishing any new marketing content about My Perfect Meals?",
        options: [
          "Post the content and monitor for complaints — compliance is reactive",
          "Ask three other partners whether the language seems reasonable",
          "Review the Messaging Guide in Partner Center for current approved language and required disclaimers",
          "Check the My Perfect Meals homepage to see if similar language appears there",
        ],
        correctIndex: 2,
      },
    ],
  },
];

export function getLessonById(id: string): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.id === id);
}

export function getLessonByNumber(
  num: number
): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.lessonNumber === num);
}
