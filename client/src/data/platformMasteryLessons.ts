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
    title: "Builder Selection",
    subtitle: "How builder assignment works and what each builder is designed to create",
    opening:
      "The Builders page is the functional core of My Perfect Meals. After onboarding sets your profile, the Builders tab is where that profile translates into your actual meal plan. This lesson covers how builder assignment works, what each builder is designed to create, and how to navigate your assigned environment before generating your first meal.",
    sections: [
      {
        heading: "What a Builder Is",
        body: "A builder is the meal generation environment assigned to your account. It's not just a label — it's the specific tool, with its own targeting rules, medical protocols, and generation logic, that the platform uses to create your meals.\n\nThe key distinction: builders are profile-aware. They don't generate meals to satisfy any request in isolation. They generate meals designed for your specific situation — your goal, your medical context, your dietary identity.",
      },
      {
        heading: "How Builder Assignment Works",
        body: "Your builder is assigned, not chosen. The platform selects it based on three factors:\n\n**Your health goal** — Weight loss, maintenance, muscle gain, performance, and clinical support each point toward different builder environments.\n\n**Your medical context** — Any condition entered in your Health Profile (Type 2 diabetes, GLP-1 protocol, oncology support, etc.) influences or overrides the goal-based assignment.\n\n**Your dietary identity** — Vegan, keto, halal, and other dietary identities are applied within whatever builder you're assigned.\n\nIf you're connected to a ProCare professional — a coach, dietitian, or physician — your builder may be assigned or adjusted by that professional rather than auto-assigned by your profile alone.\n\nThis assignment mechanism is what makes the platform produce consistent, medically appropriate results. It's not a limitation — it's the point.",
      },
      {
        heading: "The Complete Builder Library",
        body: "Every builder available on My Perfect Meals:\n\n**My Weekly Meal Builder** — The standard builder for users without a specific medical context. Generates daily meal plans aligned with your goal, macros, and dietary identity.\n\n**Diabetic Hub and Meal Builder** — Built for Type 1 and Type 2 diabetes management. Includes GlucoseGuard, which adjusts meal generation based on logged blood glucose readings.\n\n**Metabolic Medication Hub and Builder** — Designed for users on GLP-1 medications (Ozempic, Wegovy, Mounjaro). Meals are appetite-adjusted for reduced hunger and portion sensitivity, with an injection tracker built in.\n\n**Anti-Inflammatory Meal Builder** — For users with autoimmune conditions, joint issues, or chronic inflammation. Every generated meal avoids ingredients associated with inflammatory response.\n\n**Performance Nutrition Hub and Builder** — For athletes. Macro targets shift based on training phase. Includes the Athlete Meal Picker, Athlete Beverage Creator, and session logging.\n\n**General Nutrition Builder (ProCare)** — A flexible builder assigned and guided by a coach or physician through ProCare Studio. Users on this builder have a professional actively managing their nutrition strategy.",
      },
      {
        heading: "The Builder Screen — What You See Before Generating",
        body: "Before generating your first meal, take 30 seconds to understand the builder interface. This layout is consistent across every builder.\n\n**At the top:**\n- **Protocol Status** — shows which active programs are currently shaping your generation in this session\n- **Preferences** — one-time session adjustments (heat level, ingredient restrictions, etc.) without modifying your permanent profile\n\n**The weekly board:**\n- **Day selector** — tabs for Monday through Sunday\n- **Meal slots** — Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner; tap any empty slot to generate a meal\n- **Remaining Macros** — a real-time bar showing how much Protein, Carbs, and Fat remain for the current day\n\n**Board controls:**\n- **Save Plan** — locks your current week and updates your Shopping List\n- **Duplicate** — copies a full day's meals to another day",
      },
      {
        heading: "When Your Builder May Change",
        body: "Your builder follows your profile. When your profile changes significantly — a new medical condition, a goal shift from weight loss to athletic performance, a physician assigning you to ProCare — your builder assignment may update to reflect that change.\n\nIf you're unsure which builder is right for your current situation and you're not under ProCare, update your Health Profile and Health Goal to reflect your current context. The platform will resolve the appropriate assignment from there.",
      },
    ],
    exercise: {
      steps: [
        "Open the **Builders** tab at the bottom of the screen.",
        "Identify your assigned builder. Note its name.",
        "Tap into the builder and locate the **Protocol Status** indicator at the top. Tap it to read which programs are currently active.",
        "Tap the **Preferences** panel and read through the one-time adjustment options available for this session.",
        "Without generating a meal yet, review the builder's weekly board — count the day tabs and meal slots available.",
      ],
    },
    remember:
      "Your builder is assigned, not chosen — and that assignment is based on your profile. Understanding your builder is the first step before generating anything.",
    quiz: [
      {
        id: "l2-q1",
        question:
          "Which of the following best explains how a user's builder is selected?",
        options: [
          "She picks it from a list during onboarding.",
          "It rotates weekly based on the platform's recommendations.",
          "The platform assigns it based on her health goal, medical context, and dietary identity.",
          "It defaults to the General Nutrition Builder for all new users.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q2",
        question:
          "A user who has recently started Ozempic completes onboarding and enters her GLP-1 medication. Which builder is she most likely to be assigned?",
        options: [
          "My Weekly Meal Builder — the default for most new users.",
          "Metabolic Medication Hub and Builder — designed specifically for GLP-1 users.",
          "Anti-Inflammatory Meal Builder — GLP-1 reduces inflammation.",
          "General Nutrition Builder — since she has a physician managing her medication.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q3",
        question:
          "A user under ProCare notices her builder was changed without her doing anything. What is the most likely explanation?",
        options: [
          "The platform rotates builders automatically each month.",
          "Her ProCare professional adjusted her builder assignment through ProCare Studio.",
          "She accidentally tapped a setting that switched her builder.",
          "The platform assigned a new builder because she missed too many meals.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q4",
        question:
          "What does the Protocol Status indicator at the top of the builder show?",
        options: [
          "A summary of the user's progress toward her weekly goals.",
          "A timer showing when the next meal generation will expire.",
          "Which saved meal plans are currently active.",
          "Which active profile programs are currently shaping meal generation in that session.",
        ],
        correctIndex: 3,
      },
      {
        id: "l2-q5",
        question:
          "A user wants to adjust the heat level of her next generated meal without changing her permanent profile preferences. Where does she do this?",
        options: [
          "Edit Profile — update her spice preference permanently.",
          "The Preferences panel inside the builder — one-time session adjustments.",
          "Coach's Corner — submit the adjustment request.",
          "My Hub — adjust the heat setting from her account page.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q6",
        question:
          "The Diabetic Hub and Meal Builder includes a feature called GlucoseGuard. What does it do?",
        options: [
          "Adjusts meal generation based on the user's logged blood glucose readings.",
          "Blocks any meal that contains natural sugars.",
          "Calculates insulin needs before each meal and displays a recommendation.",
          "Sends the user's glucose data to her physician.",
        ],
        correctIndex: 0,
      },
      {
        id: "l2-q7",
        question:
          "A user with no medical conditions and a goal of weight loss completes onboarding. Which builder is she most likely assigned?",
        options: [
          "Anti-Inflammatory Meal Builder — it's the most conservative option.",
          "My Weekly Meal Builder — the standard builder for users without a specific medical context.",
          "General Nutrition Builder — the default for all first-time users.",
          "Performance Nutrition Hub and Builder — it works for any fitness goal.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q8",
        question:
          "A user's goal shifts from maintenance to competitive athletics. She updates her Health Goal in her profile. What should she expect?",
        options: [
          "No change — builders are permanent once assigned.",
          "Her builder may update to reflect the new goal and context.",
          "She must contact support to request a builder reassignment.",
          "The platform will send her a notification asking her to choose a new builder.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q9",
        question:
          "What is the key difference between a builder and a general AI food tool?",
        options: [
          "Builders include more recipe options and a larger food database.",
          "Builders cost more per month and require a subscription.",
          "Builders are profile-aware — they generate meals designed for a specific person's situation, not just any request.",
          "Builders only work when the user has an active weekly plan saved.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q10",
        question:
          "A coach reads that builders are \"assigned, not chosen.\" A client asks why she can't just use the Performance Builder instead of her assigned Weekly Meal Builder. What is the correct answer?",
        options: [
          "She can switch at any time from the Builders tab settings menu.",
          "She needs to pay for an upgraded subscription to unlock additional builders.",
          "Builder assignment is based on her profile — switching without a matching profile context won't produce results designed for her situation.",
          "The Performance Builder is only available to users over 18.",
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
    opening:
      "A saved meal plan answers what you should eat. The shopping tools answer how to get that food into your kitchen. This lesson covers the full grocery scope of My Perfect Meals: your Smart Grocery List, Grocery Coach, Smart Scan, and Fridge Rescue — the tools that close the gap between your plan and what actually ends up in your cart and refrigerator.",
    sections: [
      {
        heading: "Smart Grocery List — Your Plan Becomes a List",
        body: "When you save your weekly plan, the Smart Grocery List generates automatically. It consolidates all ingredients from every meal in your saved plan, de-duplicates them, and organizes them by grocery category.\n\nIf your Smart Grocery List is empty, no weekly plan has been saved yet. Go to your builder, fill your week, and tap Save Plan. The list populates immediately.\n\nThe list stays current. Update your plan mid-week and the list updates with it. Delete a meal and that meal's ingredients are removed. Add a replacement and they appear.",
      },
      {
        heading: "Grocery Coach",
        body: "Grocery Coach is the shopping tool that adds profile-aware context to your list.\n\nWhen you open Grocery Coach, you're viewing your shopping plan through your active profile. It organizes items by store section (produce, proteins, pantry, dairy) and adds:\n\n- **Condition-relevant notes** — a user managing blood sugar sees a flag on high-glycemic ingredients; a user with celiac sees a gluten alert on any relevant item\n- **Allergy reminders** — flagged at the specific items that trigger the concern\n- **Quantity guidance** — how much of each ingredient you need based on the portions in your plan\n\nThe list isn't just a shopping catalog. It's profile-aware guidance for what to buy, how much to buy, and what to watch for.",
      },
      {
        heading: "Smart Scan — Ingredient Intelligence in the Store",
        body: "Smart Scan brings profile-aware evaluation directly to the store shelf. Point your camera at any product barcode and the platform reads the nutrition label and evaluates it against your active profile.\n\nWhat Smart Scan checks:\n- Does this product fit your dietary identity?\n- Does it conflict with any medical guardrails?\n- How does it compare to your remaining macro targets for the day?\n\nThe result is an instant signal: compatible, use with caution, or avoid — with the specific reason. Smart Scan is most useful when comparing similar products or evaluating packaged foods you haven't used before. Two protein bars, two pasta sauces, two snack options — scan both and see which fits your profile better.",
      },
      {
        heading: "Fridge Rescue — Cooking What You Already Have",
        body: "Fridge Rescue solves a specific problem: you have food in the kitchen but don't know what to make with it.\n\nEnter the ingredients currently available in your kitchen. Fridge Rescue generates a complete, profile-compliant meal using only those items — no additional grocery trip needed.\n\nFridge Rescue applies your full profile:\n- A vegan user won't get a chicken recipe\n- A diabetic user won't get a high-glycemic suggestion\n- A user with a nut allergy won't get a peanut-based meal\n\nThe meal generated fits who you are, built from what you have. It's also one of the most effective tools for reducing food waste while staying on plan.",
      },
      {
        heading: "A Sustainable Shopping Routine",
        body: "The friction that breaks most nutrition plans isn't the food itself — it's running out of the right ingredients. A saved plan, reviewed through Grocery Coach and shopped from a complete list, removes most of that friction.\n\nBefore each shop:\n1. Save your weekly plan in the builder\n2. Open your Smart Grocery List\n3. Review it through Grocery Coach — note flags and quantity adjustments\n4. Use Smart Scan in the store when evaluating unfamiliar products\n\nThis routine takes less time than most people expect and is significantly more effective than making grocery decisions on the spot.",
      },
    ],
    exercise: {
      steps: [
        "Save a weekly plan in your builder if you haven't already — tap **Save Plan**.",
        "Open your **Smart Grocery List** from the Dashboard or builder. Review what populated.",
        "Open **Grocery Coach**. Read through the organized sections and note any flagged items or quantity guidance.",
        "Return to Lifestyle and tap **Fridge Rescue**. Enter three ingredients you currently have available. Generate a meal and read the full Meal Card.",
      ],
    },
    remember:
      "Save your plan → review Grocery Coach → use Smart Scan in the store. That four-step routine closes the gap between your meal plan and your refrigerator.",
    closing:
      "You now have the tools to plan and shop. The next lesson covers what happens when you're not at home — Restaurant Guide, Fast Food Guide, and meals on the go.",
    quiz: [
      {
        id: "l4-q1",
        question:
          "A user opens her Smart Grocery List and it is empty. What should she do first?",
        options: [
          "Contact support — the list requires a feature upgrade.",
          "Open Grocery Coach — it generates a list independently of the meal plan.",
          "Check whether her profile is fully completed.",
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
          "It shows which store carries the most items on the list.",
          "It adds profile-aware notes — condition flags, allergy reminders, and quantity guidance — to the items on the list.",
          "It generates a new meal plan based on available ingredients at local stores.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q3",
        question:
          "A user with a sesame allergy opens Grocery Coach and sees a flag on a tahini product. What does that flag indicate?",
        options: [
          "The product is outside of her typical budget range.",
          "The product contains an allergen from her profile and Grocery Coach is calling that out.",
          "The product has a higher calorie count than expected for that ingredient.",
          "Her ProCare coach has recommended avoiding sesame-based products.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q4",
        question:
          "What factors does Smart Scan evaluate when a user scans a product barcode?",
        options: [
          "Store pricing, product reviews, and total calorie count.",
          "Macronutrient totals only, regardless of the user's active profile.",
          "Dietary identity, active medical guardrails, and remaining daily macro targets.",
          "Brand reputation, ingredient sourcing, and shelf life.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q5",
        question:
          "A user scans two similar protein bars. One is marked compatible and the other use with caution. What determines the difference?",
        options: [
          "The compatible bar has fewer total calories.",
          "The platform compared pricing and selected the more affordable option.",
          "The caution bar conflicts with something in her active profile — dietary identity, medical guardrails, or macro targets.",
          "The compatible bar was rated higher by other users on the platform.",
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
          "A vegan user with Type 2 diabetes uses Fridge Rescue and enters chicken, rice, and broccoli. What will the platform generate?",
        options: [
          "A chicken bowl — the most common meal from those ingredients.",
          "A rice and broccoli dish, excluding chicken because of her vegan dietary identity.",
          "A full meal using all three ingredients, following her preference but ignoring medical guardrails.",
          "An error — Fridge Rescue does not work for users with dietary restrictions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q8",
        question:
          "A user wants to compare two brands of keto protein powder before buying one. Which tool is most appropriate?",
        options: [
          "Grocery Coach — it has a product database with macro ratings.",
          "Fridge Rescue — enter the serving size to see how it fits a meal.",
          "The Macro Calculator — enter the macros manually to check.",
          "Smart Scan — scan both barcodes in-store to compare them against her profile.",
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
          "Which best describes a sustainable pre-shopping routine using the platform's grocery tools?",
        options: [
          "Generate meals on demand daily and buy ingredients as needed each day.",
          "Save the weekly plan, review Grocery Coach, then use Smart Scan in-store to evaluate unfamiliar products.",
          "Create a generic grocery list from memory and cross-reference it with the Macro Calculator.",
          "Shop once per month and rely on Fridge Rescue for the remainder.",
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
    opening:
      "Throughout this Academy, you've learned how to use My Perfect Meals. This final lesson shows you where to go whenever you need help, want to learn something new, personalize your experience, or manage your account. My Hub is your personal control center. Tap the Hub button in the top-right corner of your Dashboard and it opens — a single panel that connects you to everything that supports your life on the platform.",
    sections: [
      {
        heading: '"I need to update my information."',
        body: "**My Profile** is where your personal information, goals, and preferences live. If your weight changes, your goal shifts, or your lifestyle changes — this is where you come. You learned how your profile shapes your experience in Lesson 1. My Hub is simply where you return whenever something in your life changes.\n\n**Health Profile** is where your medical conditions, allergies, and clinical context are stored. Keeping this accurate matters — it's the information that keeps your meals safe and relevant to your actual situation. If a physician changes your care plan, you're prescribed a new medication, or a health condition improves or changes, update it here.",
      },
      {
        heading: '"I want my coaching experience to feel more like me."',
        body: "**AI Coaching Preferences** lets you personalize how the platform supports and communicates with you.\n\nEveryone uses My Perfect Meals differently. Some users want frequent check-ins and active guidance. Others prefer a quieter experience. Some want coaching focused on performance. Others want to stay focused on habits and consistency.\n\nAs more coaching features become available, this is where you'll personalize how the platform supports and communicates with you. If your coaching experience ever feels like it could fit you better, this is where you adjust it.",
      },
      {
        heading: '"My goals have changed."',
        body: "**Meal Builder Exchange** is where you go when your health situation or nutrition goals shift significantly enough to need a different builder.\n\nEach builder represents a different nutrition strategy — built specifically for a different set of health needs, goals, and clinical considerations. Your builder was chosen at onboarding because it matched your situation at that time. It's doing real work behind every meal you generate.\n\nBecause each builder is a distinct nutrition strategy, switching between them frequently would undermine the consistency that makes the platform work. That's why the number of exchanges available each year is limited.\n\nChanging builders doesn't erase your account or start you over. It simply changes the nutrition strategy used for future meal generation.\n\n**When should you consider a change?**\n- Your health situation changes significantly (a new diagnosis, a resolved condition, a new medication)\n- Your primary goal shifts in a meaningful way (from weight loss to athletic performance, for example)\n- A physician or coach recommends a different clinical approach\n\nIf you're a ProCare client, your coach manages your builder assignment — contact them directly rather than initiating an exchange yourself.",
      },
      {
        heading: '"I want to understand the platform better."',
        body: "**App Library** is your knowledge center.\n\nEverything in this Academy taught you how to use My Perfect Meals. The App Library teaches you how it works — and continues teaching as the platform grows. Whenever you're curious about why something behaves a certain way, or want to go deeper on any system, feature, or concept, start here.\n\nThe App Library is organized into six sections:\n\n**Start Here** — Begin here if you're new or want to understand the philosophy behind it. Covers why My Perfect Meals exists, why you're on your specific builder, and what makes this platform different.\n\n**Core Systems** — The major systems that work together: how meals are generated, how macro targets are calculated, how coaching works.\n\n**Nutrition Strategy** — The nutrition principles that influence your meals — the tools the platform uses to keep your eating satisfying, consistent, and effective.\n\n**Health & Safety** — SafetyGuard™, GlucoseGuard™, specialty nutrition support, and the tools that keep your recommendations aligned with your profile.\n\n**Specialized Systems** — The lifestyle tools and specialty creators available throughout the app.\n\n**Performance Modes** — How the platform adapts for athletic training, competition preparation, and performance nutrition goals.\n\nThe Academy teaches you how to use My Perfect Meals. The App Library continues teaching you as the platform grows.\n\nThe App Library is a living knowledge base. When features like Pro Tips, Coach's Corner, or new A.I. systems evolve, the App Library is updated so you always have the latest guidance in one place.",
      },
      {
        heading: '"I want professional help."',
        body: "**Hire a Professional** connects you with certified coaches, dietitians, trainers, and physicians who use My Perfect Meals professionally. Every professional listed has completed the required My Perfect Meals certification program — which means they know the platform, understand how it works with their clients, and can guide your experience from inside the app.\n\nIf you ever feel like your nutrition needs are beyond what self-guided use can address, this is where you find someone qualified to help.\n\n**Team My Perfect Meals** is where you meet the people who built the platform — their backgrounds, their mission, and why this app exists.",
      },
      {
        heading: '"I need help managing my account."',
        body: "Everything account-related lives in My Hub:\n\n**Subscription** — View your current plan, upgrade, or make changes to your membership.\n\n**Restore Purchases** — If you've switched devices or reinstalled the app, use this to restore an active subscription.\n\n**Contact Support** — Questions, bugs, or feedback. Use this when something isn't working the way you expect.\n\n**Privacy & Security** — Manage your privacy settings and review how your data is handled.\n\n**Terms of Service** — Review the platform's terms and conditions.\n\nThese are here when you need them.",
      },
      {
        heading: "Continue Exploring",
        body: "My Perfect Meals is continuously growing.\n\nNew builders, new AI systems, new educational resources, new specialties, and new capabilities will continue to be added over time. As My Perfect Meals evolves, your Academy and App Library will evolve with it.\n\nYou don't need to know everything today. The platform will keep meeting you where you are.",
      },
    ],
    exercise: {
      steps: [
        "Tap **Hub** to open My Hub.",
        "Tap **AI Coaching Preferences**. Read through the available settings. Don't change anything yet — just become familiar with what's there.",
        "Return to My Hub and tap **Meal Builder Exchange**. Read the available builders. Take note of which one is currently assigned to you and why. Return without making any changes.",
        "Tap **App Library**. Open **Start Here**. Read one article — any of the three.",
        "Before you return, think about one feature or system you encountered in this Academy that you'd like to understand better. That's your next stop in the App Library.",
      ],
    },
    remember:
      "Whenever you have a question about My Perfect Meals, start with My Hub.",
    closing:
      "Congratulations on completing the My Perfect Meals Platform Mastery Academy. You now understand how to navigate the platform, build personalized nutrition plans, adapt those plans to real life, and use the tools that make My Perfect Meals unique. Whether you're here for your own health, your family, or your clients — you have the foundation to use the platform with confidence. This is only the beginning. Welcome to My Perfect Meals.",
    quiz: [
      {
        id: "l6-q1",
        question: "How do you open My Hub?",
        options: [
          "Tap your profile photo in the bottom navigation.",
          "Tap the Hub button in the top-right corner of the Dashboard.",
          "Tap More → My Hub.",
          "Long-press the Dashboard to open the control panel.",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q2",
        question:
          "A user was recently diagnosed with Type 2 diabetes by her physician. Her original onboarding had no medical conditions selected. Where in My Hub should she go to update this?",
        options: [
          "My Profile — that's where she updates medical conditions, allergies, and clinical context.",
          "AI Coaching Preferences — medical context affects how the coaching system responds.",
          "Health Profile — a separate clinical section accessible from My Hub.",
          "Meal Builder Exchange — a new diagnosis automatically triggers a builder change.",
        ],
        correctIndex: 0,
      },
      {
        id: "l6-q3",
        question:
          "A client has been on a weight loss program for eight months and has decided to focus on athletic performance. She wants to shift her entire nutrition strategy. What does she do in My Hub?",
        options: [
          "Update her goal in My Profile — changing the goal automatically switches her builder.",
          "Go to Meal Builder Exchange — her goals have shifted significantly enough to need a different builder.",
          "Contact support — builder changes require staff authorization.",
          "Start a new account — her current account is calibrated for weight loss and can't change.",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q4",
        question:
          "Why is the number of builder exchanges available each year limited?",
        options: [
          "It prevents free users from accessing premium builders.",
          "It's a technical limitation of the system architecture.",
          "Each builder is a distinct nutrition strategy that needs time to work — switching frequently would undermine the consistency that makes My Perfect Meals effective.",
          "It protects against accidental builder changes by new users.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q5",
        question:
          "A ProCare client wants to switch to the Performance Nutrition Hub after reading about it in the App Library. She opens Meal Builder Exchange to initiate the change herself. What should she do instead?",
        options: [
          "Go ahead — ProCare clients can change their own builders at any time through the Exchange.",
          "Contact support to override her ProCare assignment.",
          "Contact her coach. ProCare builders are managed by the coach, not through self-service Builder Exchange.",
          "Wait until her next session, then ask her coach to perform the exchange for her.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q6",
        question:
          "A user finishes the Academy and wants to understand more about how SafetyGuard™ works. Which section of the App Library should she open?",
        options: [
          "Start Here — for users who are new to the app.",
          "Core Systems — how the major systems work together.",
          "Health & Safety — covers SafetyGuard™, GlucoseGuard™, and the tools that keep recommendations aligned with her profile.",
          "Performance Modes — for athletic and advanced nutrition goals.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q7",
        question:
          "What is the difference between the Academy and the App Library?",
        options: [
          "The Academy is for coaches; the App Library is for personal users.",
          "The Academy teaches you how to use My Perfect Meals. The App Library helps you continue learning about the app and new features as it grows.",
          "The Academy is free; the App Library requires a paid subscription to access.",
          "There's no meaningful difference — they cover the same content in different formats.",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q8",
        question:
          "A user's nutrition needs have become more complex than she can manage on her own — she has Type 2 diabetes, recently became postmenopausal, and just started a strength training program. She wants qualified help from someone who actually knows My Perfect Meals. Where does she go in My Hub?",
        options: [
          "My Profile — she can request a professional be assigned to her account.",
          "AI Coaching Preferences — to upgrade her coaching tier.",
          "Hire a Professional — to find certified coaches, dietitians, trainers, and physicians who have completed My Perfect Meals certification.",
          "More → Working With a Professional — to set up a coaching connection.",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q9",
        question:
          "A user reinstalled My Perfect Meals on a new phone and her subscription shows as inactive — even though she never cancelled it. Where does she go in My Hub?",
        options: [
          "Subscription — to repurchase her current plan.",
          "Contact Support — to report the issue to the team.",
          "Privacy & Security — account restoration is managed there.",
          "Restore Purchases — designed to restore an active subscription after switching devices or reinstalling.",
        ],
        correctIndex: 3,
      },
      {
        id: "l6-q10",
        question:
          "A user says: \"I've been using My Perfect Meals for three months and I still feel like I don't know where to find things when I have a question.\" What's the best response?",
        options: [
          "Revisit all six Academy lessons until everything feels familiar.",
          "Whenever you have a question about My Perfect Meals, start with My Hub. Your profile, your builder, the App Library, professional support, and your account are all in one place — it's designed to be your first stop.",
          "The help documentation lives on the website, not inside the app.",
          "Most users take six months to feel fully comfortable — just keep using it and it will click.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-07",
    lessonNumber: 7,
    title: "Specialized Systems",
    subtitle: "Clinical programs, coaching tools, and advanced platform features",
    opening:
      "ProCare Studio is the professional layer of My Perfect Meals. It's where coaches, dietitians, trainers, and physicians manage their clients' nutrition journeys. If you're completing this Academy as a professional, this lesson covers what ProCare Studio gives you — and what it doesn't. Understanding the boundaries is as important as understanding the tools.",
    sections: [
      {
        heading: "What ProCare Studio Is",
        body: "ProCare Studio is a separate professional environment within My Perfect Meals. It's not a feature you activate — it's a role. Once your professional account is set up and your Phase 1 certification is complete, ProCare Studio becomes accessible from your professional dashboard.\n\nFrom ProCare Studio, you can:\n- View all connected clients in one place\n- Review each client's profile, active programs, and nutrition history\n- Leave notes that appear on the client's tablet\n- Adjust which builders your clients have access to (Board Control)\n- Assign or modify nutrition protocols for clients in your care\n- Monitor client biometric trends over time",
      },
      {
        heading: "Connecting With Clients",
        body: "Clients connect to you through My Perfect Meals — not through an external system. A client who wants to work with you will find your profile in the Hire a Professional directory and send a connection request. You receive that request in ProCare Studio and choose to accept or decline.\n\nOnce connected, the client appears in your client list. Their profile, preferences, and history become visible to you — within the limits of what they have shared. Clients retain control of their own accounts. You are a professional connected to their journey, not an owner of their data.",
      },
      {
        heading: "Tablet Notes — Professional Communication",
        body: "The primary communication tool in ProCare Studio is Tablet Notes. When you write a note from your professional dashboard, it appears on your client's tablet — a visible card on their experience that delivers your guidance in the context of their daily use.\n\nTablet Notes are not a chat system. They're structured one-way guidance from professional to client. Think of them as clinical notes that the client can see — a place to leave instructions, observations, encouragement, or protocol updates.\n\nWrite notes the way you'd want a client to read them: clearly, specifically, and actionably.",
      },
      {
        heading: "Board Control — What It Is and What It's For",
        body: "Board Control is a professional-only feature that lets you determine which Builders a client sees and can access. By default, clients have access to the full Builder library. If a client's protocol requires a focused approach — for example, a clinical client who should only use the Anti-Inflammatory Builder during an active protocol — you can limit their Builder access from ProCare Studio.\n\nBoard Control is not a lock that prevents clients from eating what they want outside the app. It's a professional tool for keeping the platform experience aligned with the clinical or coaching protocol you've assigned. Use it deliberately.",
      },
      {
        heading: "Nutrition Protocol Assignment",
        body: "Professionals with clinical credentials can assign specific nutrition protocols to clients from ProCare Studio. A protocol assignment means the platform will apply that clinical framework to the client's meal generation — not just as a preference, but as a directive that shapes every Builder the client uses.\n\nProtocol assignment is a significant action. Assigning an Anti-Inflammatory Protocol to a client means every meal they generate will be filtered through that clinical framework. Before assigning, confirm that the protocol is appropriate for the client's current health status, goals, and medications.\n\nIf you are not a licensed clinical professional, do not assign clinical protocols. The platform enforces credential requirements on protocol assignment endpoints.",
      },
      {
        heading: "What the Platform Is Not",
        body: "ProCare Studio is a nutrition management tool. It is not a medical records system, a telehealth platform, or a substitute for a clinical relationship governed by your professional license.\n\nMy Perfect Meals does not store medical diagnoses, prescriptions, or clinical notes in a HIPAA-compliant record. Client data in the platform is nutrition and lifestyle data — not protected health information in the clinical sense.\n\nAs a professional using ProCare Studio, you remain responsible for maintaining your own clinical documentation outside the platform for any clients you work with in a licensed professional capacity.",
      },
      {
        heading: "A professional tool is only as good as the professional using it.",
        body: "ProCare Studio gives you visibility, communication tools, and control over the platform experience for your clients. None of those tools replace clinical judgment. Use the platform to extend and support your professional relationship — not to substitute for it.",
      },
    ],
    exercise: {
      steps: [
        "Open ProCare Studio from your professional dashboard. Find your client list.",
        "Select one client. Review their profile — note their active programs, dietary identity, and current macro targets.",
        "Write a Tablet Note for that client. Make it specific and actionable — something they can act on today.",
        "Review that client's Builder access under Board Control. Note which Builders they currently have available.",
      ],
    },
    remember:
      "ProCare Studio makes you more effective with your clients — it doesn't make you responsible for decisions outside your scope. Know the tool, know its limits.",
    quiz: [
      {
        id: "l7-q1",
        question:
          "A coach wants to write a personalized message that her client will see the next time they open My Perfect Meals. Which ProCare Studio feature does she use?",
        options: [
          "Direct Message — a real-time chat thread inside the professional dashboard.",
          "Board Control — toggle a message card from the builder settings.",
          "Tablet Notes — a structured note that appears on the client's app experience.",
          "Protocol Assignment — the protocol description field accepts coaching notes.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q2",
        question:
          "A physical therapist connected to a post-surgical client wants to limit the client to the Anti-Inflammatory Builder only during recovery. Which feature supports this?",
        options: [
          "Board Control — lets the professional determine which Builders the client can access.",
          "Protocol Assignment — assigning a protocol automatically removes other Builders.",
          "Tablet Notes — the coach instructs the client in writing to avoid other Builders.",
          "Client Profile Lock — prevents the client from changing their own Builder preferences.",
        ],
        correctIndex: 0,
      },
      {
        id: "l7-q3",
        question:
          "A new client sends a ProCare connection request. Where does the professional receive and accept the request?",
        options: [
          "In the client's profile — the request appears as a pending notification.",
          "Via email — connection requests are sent outside the platform.",
          "In ProCare Studio — incoming connection requests appear in the professional's client management dashboard.",
          "Through the Admin Portal — only admins can approve client connections.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q4",
        question:
          "A registered dietitian wants to assign an Anti-Inflammatory Protocol to a client. What must be true before she can do this?",
        options: [
          "The client must have completed at least three months of platform use.",
          "Her professional account must have verified clinical credentials — the platform enforces credential requirements on protocol assignment.",
          "The client must be on a paid subscription tier that includes clinical protocol support.",
          "She must send a Tablet Note first requesting the client's consent.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q5",
        question:
          "A coach reviews a connected client's profile in ProCare Studio and notices the client's dietary identity is set to Vegan but their cuisine preference includes a cuisine traditionally heavy in meat. What should the coach do?",
        options: [
          "Change the client's dietary identity to better match the cuisine preference.",
          "Remove the cuisine preference — it will cause conflicts.",
          "Leave the profile as-is — the platform respects dietary identity as a hard boundary and generates vegan versions of any cuisine.",
          "Flag the profile as inconsistent and open a support ticket.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q6",
        question:
          "A professional completes Phase 1 Academy certification and expects to immediately access ProCare Studio. The access gate is active. What does this mean for the professional?",
        options: [
          "There is a system error — certification should automatically unlock ProCare Studio.",
          "The professional must also purchase a separate ProCare Studio subscription.",
          "Phase 1 certification is a prerequisite but ProCare Studio access still requires account setup and approval.",
          "Phase 1 certification is the only requirement — ProCare Studio should now be accessible.",
        ],
        correctIndex: 3,
      },
      {
        id: "l7-q7",
        question:
          "A coach uses ProCare Studio to monitor a client's biometric trends. The client's weight has been rising for three weeks while following the meal plan. What is the appropriate next step?",
        options: [
          "Immediately assign a caloric restriction protocol via ProCare Studio.",
          "Use Tablet Notes to flag the trend and schedule a conversation outside the platform to discuss the client's current protocol and goals.",
          "Remove the client's access to high-calorie Builders via Board Control.",
          "Adjust the client's macro targets directly through the ProCare Studio profile editor.",
        ],
        correctIndex: 1,
      },
      {
        id: "l7-q8",
        question:
          "A professional asks: \"Does My Perfect Meals store client data in a HIPAA-compliant medical record?\" What is the accurate answer?",
        options: [
          "Yes — all client data in ProCare Studio is stored as protected health information.",
          "Yes — but only for professionals with verified clinical credentials.",
          "No — My Perfect Meals stores nutrition and lifestyle data, not protected health information in the clinical sense. Professionals must maintain separate clinical documentation.",
          "No — client data is deleted from the platform after 90 days for privacy.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q9",
        question:
          "A trainer in ProCare Studio wants to see a client's full meal history, biometrics, and active protocols in one place. Where does he go?",
        options: [
          "The client's Tablet Notes — all activity is logged there.",
          "The platform's Dashboard — it shows everything when viewed from the professional role.",
          "The client's profile within ProCare Studio — it surfaces their active programs, dietary identity, biometrics, and macro targets.",
          "The Admin Portal — only admins have access to full client histories.",
        ],
        correctIndex: 2,
      },
      {
        id: "l7-q10",
        question:
          "A coach writes a Tablet Note that says \"Try the salmon dish from yesterday for lunch again.\" The client reads it and immediately has a question. How does the client reply?",
        options: [
          "Through the built-in Tablet Note reply thread — clients can respond directly.",
          "Tablet Notes are one-directional — the client cannot reply within the platform. Follow-up communication happens outside the app.",
          "Through the Coach's Corner messaging module.",
          "By flagging the note with a thumbs-down, which sends an alert to the professional.",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-08",
    lessonNumber: 8,
    title: "AI Adaptation & Your Boundaries",
    subtitle: "How the platform learns, what it guarantees, and where you remain in control",
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
        heading: "The Macro Truth Contract",
        body: "One of the most important guarantees My Perfect Meals makes is about macro accuracy: the platform will never invent macro values it does not know.\n\nThis principle is called the Macro Truth Contract. It has two rules:\n\n**Rule 1 — Null means unknown, zero means known zero.** If the platform does not have reliable macro data for an ingredient or dish, it returns null — not a guess. A null value is clearly disclosed to the user. A zero means the platform has confirmed there is no meaningful amount of that macro.\n\n**Rule 2 — Macros are never mutated.** If the platform is uncertain about a macro value, it rejects or regenerates the recommendation rather than adjusting a value to make it look complete. The user always sees real data or an honest disclosure — never a number that was filled in to look complete.\n\nFor professionals: when a client shows you a macro breakdown from My Perfect Meals, any null values are intentional honesty, not an error. They mean the platform didn't have enough data to give a reliable number.",
      },
      {
        heading: "Clinical Mode and Specialty Programs",
        body: "Several features of My Perfect Meals are clinical — they require a physician, dietitian, or certified professional to activate or assign.\n\nExamples include:\n- **Oncology Support**: a program for users in cancer treatment or recovery, assigned by a physician with oncology context. The platform enforces ingredient rules appropriate for this population and does not make treatment claims.\n- **GLP-1 Protocol Support**: specific fueling guidance for users on GLP-1 medications, including portion scaling and protein prioritization.\n- **Anti-Inflammatory Protocol**: dietary guidance built around reducing systemic inflammation, often used in clinical or post-surgical contexts.\n\nThese programs sit at Level 1 in the protocol hierarchy. Assigning them without appropriate credentials is not supported by the platform. If you are a professional assigning clinical programs, ensure you have verified your credentials in your professional account.",
      },
      {
        heading: "What the Platform Cannot Do",
        body: "Understanding the system also means understanding its limits.\n\nMy Perfect Meals does not:\n- Provide medical diagnoses\n- Calculate drug-nutrient interactions\n- Guarantee that a specific meal will produce a specific clinical outcome\n- Replace physician supervision for any clinical nutrition protocol\n- Generate individual meal recommendations based on real-time blood glucose readings (it uses manually logged values, not continuous glucose monitor data)\n\nThe platform generates personalized nutrition guidance. That guidance is built on a user's profile, their active clinical programs, and the Macro Truth Contract. It is not a clinical order, a prescription, or a guarantee.",
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
];

export function getLessonById(id: string): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.id === id);
}

export function getLessonByNumber(
  num: number
): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.lessonNumber === num);
}
