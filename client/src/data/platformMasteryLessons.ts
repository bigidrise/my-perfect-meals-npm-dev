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
    title: "Getting Started",
    subtitle: "Setting up your profile and account",
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
        question: "What is your Safety PIN used for?",
        options: [
          "Logging into the app securely",
          "Protecting your allergy settings from accidental changes",
          "Locking your meal plan for the week",
          "Confirming subscription payments",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q2",
        question:
          "During onboarding, what does entering a medical condition do?",
        options: [
          "Removes all food options associated with that condition",
          "Adds a warning label to every meal card",
          "Adjusts future recommendations to better support that condition",
          "Requires physician approval before proceeding",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q3",
        question:
          'Which of the following best describes "dietary identity" in My Perfect Meals?',
        options: [
          "The cuisines and food traditions you enjoy",
          "A firm boundary the platform never crosses, such as vegetarian or keto",
          "Your preferred cooking style and kitchen skills",
          "The number of meals per day you prefer",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q4",
        question: "When during account setup are you asked for payment?",
        options: [
          "Before entering onboarding",
          "During the account creation step",
          "Immediately after completing onboarding",
          "Payment options come after you create your account and explore the app",
        ],
        correctIndex: 3,
      },
      {
        id: "l1-q5",
        question:
          "What does your basic information (height, weight, age) allow the platform to do?",
        options: [
          "Display your BMI on the Dashboard",
          "Calculate your macro targets",
          "Recommend a specific builder immediately",
          "Set your Safety PIN automatically",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q6",
        question:
          "Which of the following is an example of dietary identity?",
        options: [
          "Preferring Mexican cuisine",
          "Liking spicy food",
          "Being vegetarian",
          "Cooking at home more than eating out",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q7",
        question:
          "Where can you find and update your profile settings after onboarding?",
        options: [
          "The Builders page",
          "My Hub",
          "The More page under Account Settings",
          "The Dashboard sidebar",
        ],
        correctIndex: 1,
      },
      {
        id: "l1-q8",
        question:
          "What is your display name used for in My Perfect Meals?",
        options: [
          "It appears on your certification",
          "It's required to complete onboarding",
          "It's how the app greets you on the Dashboard",
          "It's visible to your coach or provider by default",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q9",
        question: "What are cuisine preferences in My Perfect Meals?",
        options: [
          "The firm boundary that determines what you can and cannot eat",
          "Your preferred cooking methods and techniques",
          "The flavors and food traditions you enjoy within your dietary identity",
          "A list of restaurants you prefer",
        ],
        correctIndex: 2,
      },
      {
        id: "l1-q10",
        question:
          "If your lifestyle or goals change after onboarding, what should you do?",
        options: [
          "Create a new account to start fresh",
          "Contact support to update your profile",
          "Update your profile to reflect who you are today",
          "Nothing — the platform updates automatically over time",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "lesson-02",
    lessonNumber: 2,
    title: "Understanding Your Dashboard",
    subtitle: "Your daily starting point for nutrition",
    opening:
      "The Dashboard is the first thing you see every time you open My Perfect Meals. It's not a home screen in the traditional sense — it's your daily starting point for nutrition. Everything important begins here.\n\nWhen you open the app each day, there's one question worth asking: What am I looking at, and what should I do first? This lesson answers that question.",
    sections: [
      {
        heading: "Your Dashboard Changes With You",
        body: "No two users see the same Dashboard.\n\nSomeone managing diabetes sees tools and information relevant to blood glucose tracking. Someone on a GLP-1 medication sees guidance specific to that protocol. Someone connected to a ProCare provider may see additional coaching information from their professional. Someone in a performance nutrition program sees different cards entirely.\n\nThe Dashboard is personalized — just like the meals are. What you see reflects your profile, your active programs, and your relationship with the platform. That's worth remembering the first time you look at someone else's screen and notice it looks different from yours.",
      },
      {
        heading: "Nutrition Personalization Summary — Start Here",
        body: "The most important card on your Dashboard is the **Nutrition Personalization Summary**.\n\nIt answers a question most apps never ask: What is actually shaping my meals right now?\n\nEvery meal My Perfect Meals generates is influenced by the active programs in your profile — your dietary identity, your health goal, any medical conditions you've entered, your macro targets. The Nutrition Personalization Summary makes all of that visible in one place.\n\nYou might see entries like:\n- *Anti-Inflammatory Protocol Active*\n- *GLP-1 Metabolic Support Active*\n- *Diabetic-Aware Generation Active*\n- *Performance Fueling — Strength Phase*\n\nEach entry is a program the platform is actively applying to your meals. Tap the card for a brief explanation of what each one means and why it's there.\n\nWhen someone asks why their meals look a certain way, this card has the answer. It's not the platform guessing — it's the platform showing its work.",
      },
      {
        heading: "Coach's Corner — Your Daily Guidance",
        body: "Below the Personalization Summary, you'll find **Coach's Corner**.\n\nThis is your daily check-in with the platform's coaching system. Each morning, Coach's Corner may ask you a quick question about your energy, sleep, stress, or how yesterday went. Your answers shape the guidance you see for that day.\n\nCoach's Corner is designed to provide guidance based on your activity and your experience using the platform. As you continue using My Perfect Meals, the guidance becomes more personalized.\n\nMake it a habit to open Coach's Corner when you start your day. We'll explore the coaching system in full in Lesson 6.",
      },
      {
        heading: "Macro Calculator — Your Nutrition Foundation",
        body: "Your macro targets are the foundation of My Perfect Meals. Every meal the platform creates is designed around those targets — Protein, Carbohydrates, and Fat.\n\nTap **Macro Calculator** on the Dashboard to see your current daily targets. If your goals or body measurements change significantly over time, you can update your information and generate new recommendations.\n\nUnderstanding your macro targets makes every other part of the platform easier to use. They show up in Meal Cards, in the Meal Builder, and in your biometric tracking. You'll encounter them throughout the Academy.",
      },
      {
        heading: "My Biometrics — Tracking What Matters",
        body: "**My Biometrics** is where you log health data over time.\n\nWhat you can track here:\n- Weight\n- Body composition (body fat, muscle mass)\n- Blood glucose — an essential daily input for diabetic users\n- Daily wellbeing (energy, sleep, stress, hydration)\n\nMy Biometrics helps you track your progress over time and gives both you and your coach a clearer picture of what's working. Consistent logging — even once a week — builds a real trend you can actually act on.",
      },
      {
        heading: "Smart Grocery List",
        body: "Every time you build or update your meal plan, your Shopping List updates automatically. Instead of creating a grocery list yourself, the platform organizes the ingredients you'll need — consolidated, de-duplicated, and sorted by category.\n\nIf your Shopping List looks empty right now, it's because your weekly meal plan hasn't been built yet. You'll learn how to build it in Lesson 3.",
      },
      {
        heading: "MacroScan and Recipe Scan",
        body: "Two more tools live on the Dashboard that you'll reach for regularly.\n\n**MacroScan** helps you understand packaged food products — scan a barcode or photograph a nutrition label and the platform evaluates it against your profile.\n\n**Recipe Scan** helps you adapt recipes you already love — paste a URL or enter ingredients and the platform rebuilds the recipe around your dietary identity and macro targets.\n\nBoth are covered in detail in the App Library, accessible through My Hub.",
      },
      {
        heading: "The Dashboard Is a Daily Habit",
        body: "The learners who get the most from My Perfect Meals treat the Dashboard like a morning check-in — not just a launch screen.\n\nOpen it. Glance at your Nutrition Personalization Summary. Read your Coach's Corner. Know where your macros stand. That's 60 seconds that sets the direction for the day.",
      },
    ],
    exercise: {
      steps: [
        "Open your Dashboard. Find and tap the **Nutrition Personalization Summary** card. Read which programs are currently active in your profile.",
        "Tap **Coach's Corner**. Read today's guidance.",
        "Tap **Macro Calculator**. Note your current Protein, Carbohydrates, and Fat targets.",
        "Locate **My Biometrics**. Take note of where it lives and what categories are available to track.",
        "Locate your **Smart Grocery List**. Note whether it's populated or empty.",
      ],
    },
    remember:
      "The Dashboard reflects your profile, your programs, and your progress. Two users won't see the same thing — and that's the point. What you see is built around you.",
    quiz: [
      {
        id: "l2-q1",
        question: "What does the Nutrition Personalization Summary show you?",
        options: [
          "Your daily macro progress toward your targets",
          "What programs are actively shaping your meals right now",
          "A history of all the meals you've generated",
          "Your grocery list for the week",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q2",
        question: "Why do two users see different Dashboards?",
        options: [
          "They're on different subscription tiers",
          "They chose different layout options in settings",
          "Each Dashboard is personalized based on the user's profile, programs, and progress",
          "The app randomizes the layout periodically",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q3",
        question: "What is Coach's Corner?",
        options: [
          "A directory of professional coaches you can hire",
          "Your daily check-in with the platform's coaching system",
          "A messaging tool for connecting with your ProCare coach",
          "A video tutorial section for new users",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q4",
        question: "What does My Biometrics help you do?",
        options: [
          "Generate meals based on your current vitals",
          "Track health data over time",
          "Connect with an external fitness tracker",
          "Calculate your macro targets from biometric data",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q5",
        question: "What does the Smart Grocery List contain?",
        options: [
          "Popular recipes curated by nutritionists",
          "Ingredients from your meal plan, organized and de-duplicated",
          "Products recommended by your coach",
          "A random sample of healthy foods for the week",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q6",
        question:
          "If your Smart Grocery List looks empty, what does that most likely mean?",
        options: [
          "You need to update your profile first",
          "Your weekly meal plan hasn't been built yet",
          "You've already shopped for this week",
          "Your subscription doesn't include shopping features",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q7",
        question: "What does MacroScan help you understand?",
        options: [
          "The macros in meals at restaurants near you",
          "Packaged food products by scanning a barcode or photographing a label",
          "The overall macro balance of your entire meal plan",
          "Hidden ingredients in generated recipes",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q8",
        question:
          "What is described as the most important card on your Dashboard?",
        options: [
          "My Biometrics",
          "Smart Grocery List",
          "Nutrition Personalization Summary",
          "Macro Calculator",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q9",
        question: "Which types of data can you track in My Biometrics?",
        options: [
          "Steps and sleep only",
          "Weight, body composition, blood glucose, and daily wellbeing",
          "Meal plan adherence and recipe ratings",
          "Weekly calorie balance and hydration only",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q10",
        question:
          "What should you do with Coach's Corner when you start your day?",
        options: [
          "Close it — it's designed for coaches, not personal users",
          "Open it and read your daily guidance",
          "Use it to log your meals for the day",
          "Set it to silent mode to avoid interruptions",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-03",
    lessonNumber: 3,
    title: "Builders: Creating Your Nutrition",
    subtitle: "The platform's core meal generation system",
    opening:
      "The Builders page is where My Perfect Meals becomes a working nutrition tool. Everything in Lessons 1 and 2 — your profile, your active programs, your macro targets — was setup. This is where that setup starts paying off. Builders are how you actually generate meals, track what you eat, and build a plan you can follow.",
    sections: [
      {
        heading: "Why Builders Exist",
        body: "Most nutrition apps ask one question: What do you want to eat?\n\nMy Perfect Meals asks a different one: What are you trying to accomplish — and what's the right tool for that situation?\n\nWhen you tap **Builders** at the bottom of the screen, you'll see every builder on the platform. While everyone can see the available builders, your profile determines which one is active for you. This keeps all of your nutrition recommendations consistent instead of allowing multiple nutrition strategies to overlap.\n\nYour builder is assigned based on your health goal, medical context, and dietary identity. Someone managing Type 2 diabetes gets a different builder than someone in an athletic performance phase. Someone under a ProCare coach gets a builder chosen by that coach. Not because the platform is limiting you — because the right tool for your situation produces better results.\n\nIf you haven't completed your profile, you'll see a prompt to do that first. Builders unlock once your profile is complete.",
      },
      {
        heading: "The Builder Screen — Learn This Once",
        body: "Before you generate your first meal, take 30 seconds to understand what you're looking at inside the builder. This layout is the same everywhere.\n\n**At the top:**\n- **Protocol Status** — a compact indicator showing which active programs are currently shaping your generation\n- **Preferences** — tap to adjust one-time settings for this generation without changing your full profile\n\n**The weekly board:**\n- **Day selector** — tabs for Monday through Sunday; you're always looking at one day at a time\n- **Meal slots** — Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner; tap any empty slot to generate a meal for it\n- **Remaining Macros** — a bar at the bottom of each day showing how much Protein, Carbs, and Fat you have left as you fill slots\n\n**Board controls:**\n- **Save Plan** — locks your current week so it's ready to shop and follow\n- **Duplicate** — copies one day's meals to another day with one tap\n\nThat's the screen. You won't need to relearn it.",
      },
      {
        heading: "Every Builder Works the Same Way",
        body: "This is the most important thing in this lesson: every builder follows the same workflow. Once you learn one builder, you've learned how to use all of them. The difference isn't how they work — it's what they're designed to create.\n\n**The generation workflow:**\n1. Tap an empty meal slot\n2. Describe what you want — type it in natural language (\"quick chicken lunch,\" \"something warm for dinner,\" \"high protein, no cooking\")\n3. Tap **Generate**\n4. A Meal Card appears\n\nThat's it. The description, your profile, and your assigned builder work together to produce a meal that fits you.",
      },
      {
        heading: "What Makes Each Builder Different",
        body: "Same workflow. Different situations. Here's what you need to know about each:\n\n**My Weekly Meal Builder**\nThe core planning tool for users building structured weekly meal plans. The most commonly assigned builder for users without a specific medical context.\n\n**Diabetic Hub and Meal Builder**\nEvery meal is designed to support stable blood glucose. Includes GlucoseGuard, which adjusts meal generation based on your logged glucose readings.\n\n**Metabolic Medication Hub and Builder**\nBuilt for users on GLP-1 medications — Ozempic, Wegovy, Mounjaro, and similar. Meals are appetite-adjusted for reduced hunger and portion sensitivity, with an injection tracker built in.\n\n**Anti-Inflammatory Meal Builder**\nEvery generated meal avoids ingredients associated with inflammation. Designed for users with autoimmune conditions, joint issues, or chronic inflammation.\n\n**Performance Nutrition Hub and Builder**\nAthlete-focused generation with targets that shift based on your training phase. Includes the Athlete Meal Picker, Athlete Beverage Creator, and session logging.\n\n**General Nutrition Builder** (ProCare)\nA flexible builder guided by a coach or physician through ProCare. Users don't select this — it's assigned by their professional.\n\nThree of these builders include an additional Hub — the Diabetic Hub, the Metabolic Medication (GLP-1) Hub, and the Performance Nutrition Hub. These Hubs provide additional education, tracking tools, and resources specific to that program.",
      },
      {
        heading: "Understanding a Meal Card — Read Every Line",
        body: "Every meal you generate appears as a Meal Card. This is the standard format across every builder, hub, and creator on the platform.\n\nHere it is, top to bottom:\n\n**The meal itself:**\n- Image — a visual of the finished dish\n- Meal name and description\n- Medical Safety Badges — which protocols this meal satisfies\n- Dietary Identity — confirms compliance with your dietary identity\n- Active Programs — which programs shaped this meal\n- Ingredients — the complete list with amounts\n- Cooking Instructions — step-by-step preparation\n- Why This Works For You — why this meal fits your goals and medical context\n\n**What you can do with it:**\n- ❤️ **Favorite** — saves the meal to your Favorites collection\n- **Delete** — removes the meal\n- **Add to Plan** — places the meal into a specific slot on your weekly board\n- **Add to Macros** — logs this meal's macros to your daily targets\n- **Share** — sends the recipe to someone else\n- **Translate** — converts the full recipe to another language\n- **Guided Cooking** — walks you through the recipe one step at a time\n\nNo matter which builder you use, the Meal Card stays consistent. Once you understand one Meal Card, you'll know how to read them all.",
      },
      {
        heading: "Building Your Week",
        body: "**The planning board:**\n- Seven tabs — Monday through Sunday\n- Each day has five meal slots (Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner)\n- The Remaining Macros bar at the bottom updates in real time as you fill slots\n- Tap any empty slot → describe what you want → Generate → Add to Plan\n\n**Managing your week:**\n- **Duplicate** — copy any day's full meal set to another day\n- **Replace** — tap any filled slot and generate something new\n- **Save Plan** — saves your current week; your Shopping List updates\n- **Shopping List** — accessible from the builder or from the Smart Grocery List on your Dashboard\n\nThe goal isn't a perfect week on paper. Build a plan you can actually follow.",
      },
    ],
    exercise: {
      steps: [
        "Open the **Builders** page and tap your active builder.",
        "Tap an empty meal slot — pick any day, any meal.",
        "Type something you'd actually want to eat right now. Tap **Generate**.",
        "When the Meal Card appears, spend one minute reading the entire card from top to bottom. Read the Medical Safety Badges, the Active Programs, the ingredients, and the **Why This Works For You** section.",
        "Tap **Guided Cooking**. Read through the first two steps. Come back.",
        "Tap **❤️ Favorite** to save the meal.",
        "Tap **Add to Plan** and place it in today's slot.",
        "Tap **Add to Macros** to log it.",
        "Tap **Duplicate** to copy today's meals to tomorrow.",
        "Open tomorrow's plan and tap one filled slot. Generate a different meal to replace it.",
        "Tap **Save Plan**.",
      ],
    },
    remember:
      "Every builder follows the same workflow. Once you know how to use one builder and read one Meal Card, you've learned the foundation of every builder in My Perfect Meals.",
    closing:
      "You now understand the most important part of My Perfect Meals. Every lesson from this point forward builds on what you've learned here.",
    quiz: [
      {
        id: "l3-q1",
        question: "How is your active builder assigned?",
        options: [
          "You choose it from the full list during onboarding",
          "It's assigned based on your health goal, medical context, and dietary identity",
          "Your subscription tier determines your builder",
          "You switch builders every week based on your current goals",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q2",
        question:
          "What happens after you tap an empty meal slot in a builder?",
        options: [
          "The app generates a random meal for you automatically",
          "You're prompted to enter a description, then tap Generate",
          "A list of your saved meals appears",
          "The slot fills with a recommended meal from your plan",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q3",
        question: 'What does "Add to Macros" do?',
        options: [
          "Saves the meal to your Favorites collection",
          "Places the meal on your weekly planning board",
          "Logs the meal's macros to your daily targets",
          "Updates your macro targets permanently based on this meal",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q4",
        question: "What does Guided Cooking do?",
        options: [
          "Shows a video tutorial for the recipe",
          "Translates the recipe to another language",
          "Walks you through the recipe one step at a time",
          "Calculates exactly how long the meal takes to prepare",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q5",
        question: "What is the Protocol Status indicator in the builder?",
        options: [
          "A progress bar showing how many meals you've planned this week",
          "A compact indicator showing which active programs are shaping your generation",
          "Your current subscription level and feature access",
          "The number of remaining meal generations this month",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q6",
        question:
          "Which builder includes tools specifically for users on GLP-1 medications?",
        options: [
          "Anti-Inflammatory Meal Builder",
          "Performance Nutrition Hub and Builder",
          "Metabolic Medication Hub and Builder",
          "General Nutrition Builder",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q7",
        question: 'What does the "Duplicate" feature in the weekly board do?',
        options: [
          "Creates two versions of the same meal for comparison",
          "Copies one day's meals to another day with one tap",
          "Regenerates all meals using the same descriptions",
          "Backs up your meal plan to your account",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q8",
        question: "What is consistent across all builders in My Perfect Meals?",
        options: [
          "The specific meal types and ingredients generated",
          "The AI model and data source being used",
          "The builder screen layout and generation workflow",
          "The number of meal slots available each day",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q9",
        question: 'What does "Save Plan" do?',
        options: [
          "Downloads your meal plan as a PDF file",
          "Shares your plan directly with your coach",
          "Locks your current week so it's ready to shop and follow",
          "Archives your current plan and starts a new blank one",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q10",
        question: 'What is the "Remaining Macros" bar?',
        options: [
          "A chart showing your macro goals for the entire month",
          "A real-time bar showing how much Protein, Carbs, and Fat you have left for the day",
          "A comparison tool between two meal options",
          "A summary of macros consumed so far this week",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-04",
    lessonNumber: 4,
    title: "Lifestyle: Everyday Nutrition for Real Life",
    subtitle: "Flexible tools for when life doesn't follow the plan",
    opening:
      "Your weekly meal plan gives you structure. The Lifestyle page gives you flexibility. Life doesn't always go according to plan. You travel, eat out, open the refrigerator and have no idea what to cook, or simply want something different. The Lifestyle page is where My Perfect Meals helps you adapt without starting over.",
    sections: [
      {
        heading: "Understanding the Lifestyle Page",
        body: "The Builders page is for your structured plan. The Lifestyle page is for everything else.\n\nThe shift in thinking is simple:\n\nInstead of asking: What meal should I generate?\n\nAsk: What situation am I in?\n\nEvery feature on the Lifestyle page was built to answer a specific kind of situation. When you match the situation to the right tool, the platform does the rest.",
      },
      {
        heading: "Create a Dish",
        body: "**Create a Dish** is the most flexible tool in the app.\n\nYou describe any meal in natural language — exactly what you want, as specifically or as vaguely as you like — and the platform generates a complete recipe with macros, adjusted for your profile.\n\n**When to use it:**\n- You already know what you want to eat and just need the recipe built around your targets\n- A client has a specific meal in mind and wants to know if it fits their plan\n- You want to experiment with something that isn't in your regular rotation\n\nDescribe what you're looking for as naturally as possible. The more helpful information you provide, the more personalized the result will be.",
      },
      {
        heading: "Fridge Rescue",
        body: "**Fridge Rescue** solves one of the most common daily nutrition problems: I have food, but I don't know what to make with it.\n\nEnter the ingredients you already have. Fridge Rescue generates a complete meal using only those items — no additional grocery run needed. Fridge Rescue is one of the easiest ways to reduce food waste while still staying on your nutrition plan.",
      },
      {
        heading: "Specialty Creators",
        body: "My Perfect Meals includes a set of specialty creators for specific types of food and drink. They all work the same way — describe what you want, generate, get a result built around your profile. Here's how to think about which one to reach for:\n\n**When you're craving something**\n- **Craving Creator** — you're not hungry for a meal, you're hungry for something specific; the platform builds a version of it that fits your targets\n- **Dessert Creator** — dessert, built around your dietary identity and macros\n\n**When you need something quick**\n- **Snack Creator** — between-meal nutrition designed to fit your remaining macros for the day\n- **Beverage Creator** — smoothies, protein shakes, coffee drinks, mocktails, cocktails, and sports drinks generated around your profile\n\n**When you're looking for something specific**\n- **Sushi Creator** — specialty generation for sushi and Japanese-inspired meals, with dietary and allergy compliance built in\n- **Spirit & Wine Pairing Hub** — pairs food with wine or spirits, and includes a drink reduction tool",
      },
      {
        heading: "Socializing Hub",
        body: "One meal away from home shouldn't make you feel like you've failed.\n\nWhether you're eating at a restaurant, grabbing fast food, or looking for healthy options nearby, the **Socializing Hub** helps you make the best decision available instead of giving up on your plan.\n\nInside, you'll find three tools:\n\n**Restaurant Guide** — Enter where you're going or browse by cuisine, and get meal recommendations from that restaurant's menu that fit your profile.\n\n**Fast Food Guide** — The same guidance for fast food and quick-service chains. Useful when there aren't better options.\n\n**Find Meals Near Me** — Uses your location to surface nearby dining options with meals that match your profile.\n\nThe Socializing Hub isn't about being perfect when you eat out. It's about staying connected to your plan in the situations where most people abandon it.",
      },
      {
        heading: "Lifestyle Collections",
        body: "Four features on the Lifestyle page serve specific life situations. Each one is a complete tool — worth knowing, worth exploring when it applies.\n\n**My Perfect Pregnancy** — Prenatal nutrition support with trimester-aware recommendations and food safety guidance.\n\n**My Perfect Pets** — Personalized meal generation for dogs, with ingredient safety scanning and pet wellness nutrition.\n\n**My Perfect Getaway** — Nutrition guidance for travel: airports, Disney parks, cruises, theme parks. Built for when your usual options aren't available.\n\n**My Perfect Gatherings** — Meal planning for events, holidays, and group meals. Generates menus that accommodate multiple dietary identities at once.",
      },
    ],
    exercise: {
      steps: [
        "Open the **Lifestyle** page.",
        "Tap **Create a Dish**. Describe any meal you'd actually want to eat and generate it. When the Meal Card appears, read the entire card from top to bottom — the description, the badges, the ingredients, and the **Why This Works For You** section.",
        "Return to Lifestyle and tap **Fridge Rescue**. Enter three ingredients you have available. Generate a meal from them.",
        "Return to Lifestyle and tap the **Socializing Hub**. Open the **Restaurant Guide** and browse it — enter a cuisine or restaurant type to see how it responds.",
      ],
    },
    remember:
      "The Lifestyle page isn't for everyday meal planning. It's where you go when life doesn't fit your normal routine.",
    closing:
      "You've now learned how to navigate the parts of My Perfect Meals you'll use most often. Next, you'll explore the More page — your personal toolbox for Favorites, ProCare connections, Business Suite, Household Profiles, and account settings.",
    quiz: [
      {
        id: "l4-q1",
        question: "What is the Lifestyle page designed for?",
        options: [
          "Building your structured weekly meal plan",
          "Situations where life doesn't fit your regular routine",
          "Managing your biometrics and health data",
          "Reviewing saved meals and favorites",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q2",
        question: "When should you use Create a Dish?",
        options: [
          "When you want to explore the weekly planning board",
          "When you already know what you want to eat and need a recipe built around your targets",
          "When you have leftover ingredients to use up",
          "When you're eating at a restaurant",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q3",
        question: "What does Fridge Rescue solve?",
        options: [
          "Running out of ideas for restaurant orders",
          "Having food available but not knowing what to make with it",
          "Generating meals for a specific medical condition",
          "Meal planning for a week when you're traveling",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q4",
        question:
          "Which creator would you use when you're craving something specific, but not a full meal?",
        options: [
          "Snack Creator",
          "Beverage Creator",
          "Craving Creator",
          "Dessert Creator",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q5",
        question: "What does the Socializing Hub help with?",
        options: [
          "Generating meals for group events at home",
          "Staying connected to your plan when eating out",
          "Finding other My Perfect Meals users nearby",
          "Sharing your meal plan with friends and family",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q6",
        question:
          "Which Lifestyle feature would you use to get meal recommendations while at a specific restaurant?",
        options: [
          "Find Meals Near Me",
          "Fast Food Guide",
          "Restaurant Guide",
          "Socializing Hub homepage",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q7",
        question: "What does My Perfect Pregnancy provide?",
        options: [
          "Meal planning for pediatric and children's nutrition",
          "Prenatal nutrition support with trimester-aware recommendations and food safety guidance",
          "Postpartum exercise and recovery guidance",
          "General women's health tracking features",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q8",
        question: "What is My Perfect Getaway for?",
        options: [
          "Planning meals for special celebrations at home",
          "Nutrition guidance for travel — airports, theme parks, and cruises",
          "Finding healthy meal options at sporting events",
          "Generating travel-inspired international recipes",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q9",
        question: "What is the Snack Creator designed for?",
        options: [
          "Generating desserts aligned with your dietary profile",
          "Creating beverages and smoothies",
          "Between-meal nutrition designed to fit your remaining macros for the day",
          "Quick breakfast ideas for busy mornings",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q10",
        question:
          "What is the key question to ask yourself when using the Lifestyle page?",
        options: [
          "What meal do I want to generate today?",
          "What is my current macro balance?",
          "What situation am I in?",
          "Which builder am I currently assigned to?",
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: "lesson-05",
    lessonNumber: 5,
    title: "Your Personal Toolbox",
    subtitle: "Everything on the More page and why it matters",
    opening:
      "By now you've learned how to build meals, adapt them to real life, and track your progress. The More page is where you manage your experience with My Perfect Meals. Think of it as your personal toolbox — a place to find saved meals, connect with professionals, manage your account, and access the resources that support everything else you do in the app.",
    sections: [
      {
        heading: "Favorites — Save What Works",
        body: "One of the biggest advantages of My Perfect Meals is that you never have to recreate a meal you love.\n\nEvery time you tap ❤️ on a Meal Card, that meal is saved to your **Favorites**. From the More page, Favorites gives you instant access to every meal you've ever saved — ready to add to your plan, log to your macros, or regenerate with a single tap.\n\nOver time, your Favorites become your personal recipe collection, making it faster to build meal plans using foods you already know you enjoy.\n\nA few distinctions worth knowing:\n- **Favorite** saves the meal to your collection — it doesn't affect your plan or your daily tracking\n- **Add to Plan** places the meal on a specific day and slot in your weekly board\n- **Add to Macros** logs the meal's nutrition to your daily targets\n\nThese three actions work together. Favorite first, then decide what to do with it.",
      },
      {
        heading: "Household Profiles",
        body: "Many people cook for more than themselves.\n\n**Household Profiles** let you manage nutrition for multiple family members from a single account. Each person keeps their own goals, dietary identity, allergies, and preferences — separate from yours.\n\nThis feature is designed for anyone who makes food decisions for others: parents, caregivers, or anyone cooking for a household where the nutritional needs don't all match. If that's you, Household Profiles is worth exploring in detail.",
      },
      {
        heading: "Working With a Professional",
        body: "If you're working with a coach, trainer, physician, or dietitian, this is where you'll connect your account so you can work together inside My Perfect Meals.\n\nFrom the More page you can:\n\n- **Connect With Your Provider** — enter an access code to link your account with a professional who uses the platform. Once connected, your provider can guide your nutrition plan, review your progress, and send you guidance directly through the app.\n\n- **Become a Provider** — if you're a trainer, dietitian, or health professional, this is where you begin setting up a professional workspace.\n\n- **Switch Workspace** — professionals with both a personal account and a professional workspace can move between them here.\n\nWorking with a professional through My Perfect Meals has its own dedicated certification and training track, separate from this Academy.",
      },
      {
        heading: "Business Suite",
        body: "**Business Suite** is designed for coaches, trainers, clinics, Founding Partners, and organizations using My Perfect Meals as part of a professional practice or business. Inside, you'll find affiliate tools, coaching resources, academy access, and partnership management.\n\nIf you're using My Perfect Meals for your own nutrition today, you may never need to open this section. But it's worth knowing it exists — many users who start with the app for their own health eventually become coaches, trainers, or partners who use it professionally.",
      },
      {
        heading: "Learning Resources",
        body: "When you want to learn more about My Perfect Meals, the More page is where you'll find the platform's educational resources:\n\n**Tips & Strategies** — a curated collection of shortcuts, hidden features, and coaching techniques; practical things that are easier to learn from a list than by exploring on your own.\n\n**Academy** — the Platform Mastery Academy you're currently in, along with any additional courses and certifications available on the platform.\n\n**App Library** — an in-depth reference covering every system and feature in My Perfect Meals, organized for when you want to go deeper than a lesson covers. You'll explore this in Lesson 6.\n\nReturn to these resources as your experience grows. The platform has more depth than any single walkthrough can cover, and these are where you'll find it.",
      },
      {
        heading: "Account & Security",
        body: "The account and security section handles the practical essentials:\n\n- **Password** — update your login credentials\n- **Two-Factor Authentication** — add a second layer of protection to your account\n- **Notifications** — control what the app communicates to you and how\n- **Privacy** — manage your data and privacy preferences\n\nIf you haven't set up two-factor authentication yet, it's worth doing before you continue.",
      },
    ],
    exercise: {
      steps: [
        "Open the **More** page.",
        "Tap **Favorites**. If you already have a meal saved, open it and take a moment to recognize the Meal Card elements you learned in Lesson 3 — the badges, the active programs, the Why This Works For You section. Return.",
        "Tap **Household Profiles**. Review the feature. Return.",
        "Tap **Business Suite**. Take note of what's inside. Return.",
        "Locate **Connect With Your Provider** on the More page.",
        "Locate **Account Security**. Confirm two-factor authentication is set up, or note to do it before continuing.",
      ],
    },
    remember:
      "The More page isn't somewhere you'll spend most of your time. It's where you'll find the tools that support everything else you do in My Perfect Meals.",
    closing:
      "You've now explored every major navigation area in My Perfect Meals. In the final lesson, you'll go beyond navigation and learn how the platform brings everything together behind the scenes — through My Hub and the intelligent systems that personalize your experience.",
    quiz: [
      {
        id: "l5-q1",
        question: "What does tapping ❤️ on a Meal Card do?",
        options: [
          "Logs the meal's macros to your daily targets",
          "Places the meal on a specific slot in your weekly board",
          "Saves the meal to your Favorites collection",
          "Shares the meal with your coach or provider",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q2",
        question: "What is Household Profiles designed for?",
        options: [
          "Sharing a subscription with multiple users",
          "Managing nutrition for multiple family members from a single account",
          "Creating separate login accounts for children",
          "Splitting a weekly grocery list across a household",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q3",
        question:
          "Which of the following correctly describes the difference between Favorite, Add to Plan, and Add to Macros?",
        options: [
          "They are three different ways to delete a meal from your history",
          "Favorite saves it to your collection, Add to Plan places it on your board, Add to Macros logs it to your daily targets",
          "Add to Plan and Add to Macros do the same thing",
          "Favorite and Add to Plan both place the meal on your weekly board",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q4",
        question:
          "Where do you go to connect your account with a professional using ProCare?",
        options: [
          "My Hub → Health Profile",
          "The Builders page",
          "The More page → Connect With Your Provider",
          "The Dashboard → Coach's Corner",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q5",
        question: "What is Business Suite for?",
        options: [
          "Managing your personal subscription and billing",
          "Coaches, trainers, clinics, and partners using My Perfect Meals professionally",
          "Advanced biometric tracking for competitive athletes",
          "Meal planning for corporate nutrition programs",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q6",
        question:
          "Where can you find Tips & Strategies in the app?",
        options: [
          "The Academy section",
          "My Hub → App Library",
          "The More page",
          "The Dashboard",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q7",
        question:
          "If you save a meal to Favorites, what happens to your daily tracking?",
        options: [
          "The meal's macros are automatically logged to your daily targets",
          "The meal is added to your weekly plan for today",
          "Nothing — Favorite saves it to your collection without affecting tracking",
          "Your macro targets are updated to reflect the meal",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q8",
        question: "What is the App Library?",
        options: [
          "A collection of recipes recommended by certified coaches",
          "An in-depth reference covering every system and feature in My Perfect Meals",
          "The full lesson content of the Platform Mastery Academy",
          "A database of saved meals from other users",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q9",
        question:
          "Where do you go to set up or manage two-factor authentication?",
        options: [
          "My Hub → My Profile",
          "The More page → Account Security",
          "The Dashboard settings panel",
          "The Builders page → Preferences",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q10",
        question: "What will you find inside Business Suite?",
        options: [
          "Your macro targets and current weekly meal plan",
          "Affiliate tools, coaching resources, academy access, and partnership management",
          "Client profiles and medical records",
          "Your personal subscription and payment history",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: "lesson-06",
    lessonNumber: 6,
    title: "My Hub: Your Personal Control Center",
    subtitle: "Where to go when you need anything",
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
        body: "**App Library** is your knowledge center.\n\nEverything in this Academy taught you how to use My Perfect Meals. The App Library teaches you how it works — and continues teaching as the platform grows. Whenever you're curious about why something behaves a certain way, or want to go deeper on any system, feature, or concept, start here.\n\nThe App Library is organized into six sections:\n\n**Start Here** — Begin here if you're new or want to understand the philosophy behind it. Covers why My Perfect Meals exists, why you're on your specific builder, and what makes this platform different.\n\n**Core Systems** — The major systems that work together: how meals are generated, how macro targets are calculated, how coaching works.\n\n**Nutrition Strategy** — The nutrition principles that influence your meals — the tools the platform uses to keep your eating satisfying, consistent, and effective.\n\n**Health & Safety** — SafetyGuard™, GlucoseGuard™, specialty nutrition support, and the tools that keep your recommendations aligned with your profile.\n\n**Specialized Systems** — The lifestyle tools and specialty creators available throughout the app.\n\n**Performance Modes** — How the platform adapts for athletic training, competition preparation, and performance nutrition goals.\n\nThe Academy teaches you how to use My Perfect Meals. The App Library continues teaching you as the platform grows.",
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
          "Tap your profile photo on the Dashboard",
          "Tap the Hub button in the top-right corner of the Dashboard",
          "Swipe left from the main menu",
          "Navigate through More → Settings",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q2",
        question: "What does My Profile in My Hub contain?",
        options: [
          "Your certification records and quiz scores",
          "Your personal information, goals, and preferences",
          "Your biometric history and health data",
          "Your active subscriptions and payment information",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q3",
        question: "What is Meal Builder Exchange for?",
        options: [
          "Trading meal plans with other users in the app",
          "Generating multiple versions of the same meal for comparison",
          "Switching to a different builder when your health situation or goals change significantly",
          "Resetting your entire profile for a complete fresh start",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q4",
        question:
          "Why is the number of builder exchanges per year limited?",
        options: [
          "Server capacity limits how often you can change builders",
          "Changing builders frequently undermines the consistency that makes the platform work",
          "Exchanges require professional approval each time you switch",
          "The platform doesn't allow switching builders after onboarding",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q5",
        question:
          "What does the App Library teach you, compared to the Academy?",
        options: [
          "The Academy covers platform philosophy; the App Library covers history",
          "The Academy teaches how to use My Perfect Meals; the App Library teaches how it works and continues growing with the platform",
          "They teach the same content at different experience levels",
          "The App Library is for coaches and professionals only",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q6",
        question: "What is Health Profile in My Hub used for?",
        options: [
          "Setting display preferences and notification options",
          "Managing subscription and payment methods",
          "Storing your medical conditions, allergies, and clinical context",
          "Tracking your biometric data over time",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q7",
        question:
          "What does \"Hire a Professional\" in My Hub connect you with?",
        options: [
          "Personal shoppers who build your grocery list",
          "The My Perfect Meals customer support team",
          "Certified coaches, dietitians, trainers, and physicians who use the platform professionally",
          "AI coaching powered by your profile data",
        ],
        correctIndex: 2,
      },
      {
        id: "l6-q8",
        question:
          "What should you do if a physician changes your care plan or you're prescribed a new medication?",
        options: [
          "Create a new account with your updated health information",
          "Update your Health Profile in My Hub",
          "Contact support to have the change applied to your account",
          "Wait for the platform to detect the change automatically",
        ],
        correctIndex: 1,
      },
      {
        id: "l6-q9",
        question:
          "Which section of the App Library covers meal generation, macro calculations, and coaching systems?",
        options: [
          "Start Here",
          "Nutrition Strategy",
          "Health & Safety",
          "Core Systems",
        ],
        correctIndex: 3,
      },
      {
        id: "l6-q10",
        question:
          "If you're a ProCare client and want to change your builder, what should you do?",
        options: [
          "Use Meal Builder Exchange to initiate the change yourself",
          "Contact the platform's support team directly",
          "Contact your coach — they manage your builder assignment",
          "Wait until your current builder stops generating relevant meals",
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
