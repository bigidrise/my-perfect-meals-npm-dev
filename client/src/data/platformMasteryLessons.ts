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
        question:
          "A coach glances at a client's screen and notices the client's Dashboard looks completely different from the coach's own — different cards, different information. What explains this?",
        options: [
          "The client is using an older version of the app.",
          "The Dashboard shows a loading error when too many features are active.",
          "The Dashboard is personalized — what you see reflects your profile, active programs, and relationship with the platform.",
          "The coach has admin access that unlocks extra cards.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q2",
        question:
          "A client asks: \"Why does my meal plan keep avoiding certain things even when I don't mention them?\" Which Dashboard feature gives the clearest answer?",
        options: [
          "My Biometrics — it shows what the platform has been tracking.",
          "The Nutrition Personalization Summary — it shows which programs are actively shaping the client's meals right now.",
          "Coach's Corner — it explains the day's decisions.",
          "The Macro Calculator — it lists all active restrictions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q3",
        question:
          "A client's Nutrition Personalization Summary shows \"Anti-Inflammatory Protocol Active\" and \"GLP-1 Metabolic Support Active.\" What does this mean?",
        options: [
          "The programs conflict and one must be removed.",
          "Both programs are active and may influence the client's meals and nutrition guidance.",
          "The client has selected them, but they are not active yet.",
          "Only the program listed first affects recommendations.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q4",
        question:
          "A user opens the app in the morning and Coach's Corner asks a short question about her energy and sleep from the night before. What should she do?",
        options: [
          "Skip it — it's not related to meal planning.",
          "Answer it honestly so the platform has current information about her energy, sleep, and daily experience.",
          "Log her biometrics first, then return to Coach's Corner.",
          "It's a bug — Coach's Corner only shows advice, not questions.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q5",
        question:
          "A client says she follows her meal plan but doesn't actually know what her Protein, Carbohydrate, and Fat targets are. Where should you send her?",
        options: [
          "My Biometrics — it tracks what she's been eating.",
          "Edit Profile to review her health goals.",
          "The Macro Calculator — it shows her current daily macro targets.",
          "Coach's Corner — the platform will tell her in the next check-in.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q6",
        question:
          "A client with Type 2 diabetes wants to track his blood glucose levels over time alongside his meal plan. Which Dashboard feature supports this?",
        options: [
          "The Nutrition Personalization Summary — it confirms the diabetic protocol is active.",
          "My Biometrics — it includes blood glucose as a daily logging category.",
          "MacroScan — it evaluates foods for glucose impact before consumption.",
          "The Smart Grocery List — it flags high-glycemic ingredients automatically.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q7",
        question:
          "A user opens her Smart Grocery List and finds it empty. What should she check first?",
        options: [
          "Whether her subscription includes shopping tools.",
          "Whether she has added meals or ingredients that should populate the list.",
          "Whether the list only refreshes on Sundays.",
          "Whether her profile is complete.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q8",
        question:
          "A client finds a recipe online she'd like to keep eating, but she wants it adjusted to fit her dietary identity and macro targets. Which Dashboard tool is designed for this?",
        options: [
          "Create a Dish — describe the recipe in words.",
          "Fridge Rescue — enter the ingredients she already has.",
          "Recipe Scan — input the recipe and the platform adapts it to her profile.",
          "MacroScan — scan the nutritional info from the recipe page.",
        ],
        correctIndex: 2,
      },
      {
        id: "l2-q9",
        question:
          "A user wants a quick overview before making food decisions for the day. Which Dashboard areas should she review first?",
        options: [
          "Favorites, Business Suite, and Account Security.",
          "Nutrition Personalization Summary, Coach's Corner, and current macro targets.",
          "Recipe Scan, MacroScan, and Household Profiles.",
          "App Library, Terms of Service, and Subscription.",
        ],
        correctIndex: 1,
      },
      {
        id: "l2-q10",
        question:
          "A user sees a Dashboard card she doesn't understand and wants a deeper explanation. What is the best next step?",
        options: [
          "Ignore it unless it blocks meal generation.",
          "Delete the card from the Dashboard.",
          "Open the relevant feature or use the App Library to learn more about it.",
          "Re-run onboarding so the Dashboard resets.",
        ],
        correctIndex: 2,
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
      {
        heading: "Pro Tips — Short Coaching Lessons",
        body: "Throughout the Builders you'll see **Pro Tips**. These are short audio coaching lessons that teach techniques, shortcuts, and best practices for getting better results from My Perfect Meals.\n\nTap **Listen** to start. Each Pro Tip is broken into short sections — you can pause, rewind, or read along.\n\n- **10s Back** — rewinds the audio ten seconds if you missed something, without losing your place\n- **Transcript** — displays the full text of the current section so you can read along or read instead of listening\n- **Start Over** — replays the section from the beginning\n\nPro Tip sections stand on their own — you don't have to listen in order. Your narration speed preference from My Hub applies automatically.",
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
        "Scroll to find the **Pro Tip** card at the bottom of your builder. Tap **Listen** and let it play through one section. Tap **10s Back** to rewind and hear it again. Then tap **Transcript** to read along while it plays.",
      ],
    },
    remember:
      "Every builder follows the same workflow. Once you know how to use one builder and read one Meal Card, you've learned the foundation of every builder in My Perfect Meals.",
    closing:
      "You now understand the most important part of My Perfect Meals. Every lesson from this point forward builds on what you've learned here.",
    quiz: [
      {
        id: "l3-q1",
        question:
          "A new user completing her profile wonders why she was assigned the Diabetic Hub and Meal Builder instead of the standard Weekly Meal Builder. What is the most accurate explanation?",
        options: [
          "She chose it manually during onboarding.",
          "Her builder is assigned based on her health goal, medical context, and dietary identity — the Diabetic Hub is the right tool for her situation.",
          "The Diabetic Hub is the default builder for all new users.",
          "She needs to contact support to be assigned a different builder.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q2",
        question:
          "A user fills several meal slots on Monday. She notices the Remaining Macros section changes as meals are added. What is it showing?",
        options: [
          "Her overall weekly progress toward her nutrition goals.",
          "How many empty meal slots she has left to fill today.",
          "How much of her daily macro targets remain available as meals are added.",
          "Her shopping list progress for the week.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q3",
        question:
          "A client wants all her meals planned at the start of the week so she's not making food decisions every day. Which features of the Weekly Meal Builder support this directly?",
        options: [
          "Guided Cooking — walks her through each meal as she prepares it.",
          "Add to Macros — logs each meal as she eats it throughout the week.",
          "The daily board with five meal slots per day, Save Plan, and Duplicate to copy a day that's working to another day.",
          "The Preferences panel — pre-sets all seven days at once from a single screen.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q4",
        question:
          "A client's Meal Card shows a badge that says \"Hormone Support.\" She asks what it means. What do you tell her?",
        options: [
          "She needs to see a doctor before eating this meal.",
          "The platform added Hormone Support to her profile automatically based on her age.",
          "That program is active in her profile, and the meal was personalized using the Hormone Support program that's active in her profile.",
          "It's a promotional label — it means the meal is particularly good for hormone health generally.",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q5",
        question:
          "A coach reads the \"Why This Works For You\" section on a Meal Card before sending it to a client. Why is this a good coaching habit?",
        options: [
          "It tells the coach what the client's protein target is.",
          "It explains why this meal is a good fit for the person's profile, making it easier for the coach to explain the recommendation.",
          "It lists which ingredients the client needs to buy.",
          "It shows what the meal would look like if the client had a different dietary identity.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q6",
        question:
          "A client adds a meal to her weekly board for Thursday dinner, then later logs the same meal as eaten that day. Which buttons did she use — in order?",
        options: [
          "Add to Macros first, then Add to Plan.",
          "Add to Plan first, then Add to Macros.",
          "Guided Cooking first, then Favorite.",
          "Favorite first, then Add to Plan.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q7",
        question:
          "After generating a meal, a client wants step-by-step help preparing it. Where does she go?",
        options: [
          "Open a separate cooking guide from the main navigation.",
          "Open the Builders menu and select a cooking mode.",
          "Tap Guided Cooking on the Meal Card.",
          "Return to the home screen and tap \"Start Cooking.\"",
        ],
        correctIndex: 2,
      },
      {
        id: "l3-q8",
        question:
          "A client generated a meal she loved, then closed the app without saving it. Now she can't find it. What happened?",
        options: [
          "It moved to her Dashboard under recent activity.",
          "The meal was not saved to Favorites and is no longer available.",
          "It was automatically added to her weekly board.",
          "She can recover it by contacting support with the date and time.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q9",
        question:
          "A client asks: \"Is one builder smarter than another? Should I switch to get better meals?\" What is the correct answer?",
        options: [
          "Yes — some builders use more advanced generation than others.",
          "No — every builder follows the same workflow. The difference is what each one is designed to create, not the intelligence behind it.",
          "Yes — the ProCare builders check more of the client's health data.",
          "No — all builders generate the same meals; the names are just organizational labels.",
        ],
        correctIndex: 1,
      },
      {
        id: "l3-q10",
        question:
          "Why should users read a Meal Card fully before deciding what to do with it?",
        options: [
          "Pressing a button before reading locks the meal and prevents changes.",
          "The Meal Card explains what the meal is, why it fits their profile, and what actions are available — reading it first means every action they take is intentional.",
          "The platform tracks whether users read the card and adjusts future recommendations accordingly.",
          "Meal Cards expire if you don't interact with them within a short window.",
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
        question:
          "Before opening the Lifestyle page, what is the most useful question to ask yourself?",
        options: [
          "\"Which meal am I planning next?\"",
          "\"What situation am I in right now?\"",
          "\"How many macros do I have left today?\"",
          "\"Which builder should I switch to?\"",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q2",
        question:
          "A client texts you: \"I want to make shakshuka for lunch — can I get a recipe that works for my plan?\" Which Lifestyle tool is the right fit?",
        options: [
          "Fridge Rescue — enter the ingredients for shakshuka.",
          "Create a Dish — she knows exactly what she wants and needs a version built around her profile.",
          "Craving Creator — she has a craving for a specific dish.",
          "Snack Creator — for a quick meal that fits remaining macros.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q3",
        question:
          "It's 6pm. A client opens the fridge, sees chicken thighs, sweet potatoes, and spinach, and has no idea what to cook. Which Lifestyle tool was built for this exact situation?",
        options: [
          "Create a Dish — describe \"chicken thighs with sweet potato and spinach.\"",
          "Craving Creator — enter what she's in the mood for.",
          "Fridge Rescue — enter the three ingredients she has and generate a meal from what's on hand.",
          "Snack Creator — for quick meals using available items.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q4",
        question:
          "A client's dinner is already planned, but she wants something sweet afterward that doesn't push her over her daily targets. Which Specialty Creator is designed for this?",
        options: [
          "Craving Creator — she's craving something sweet.",
          "Dessert Creator — dessert built around her dietary identity and macro targets.",
          "Snack Creator — between-meal nutrition designed to fit remaining macros.",
          "Beverage Creator — for sweet drinks and smoothies.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q5",
        question:
          "A client has macros remaining before dinner and needs something to hold her over. Which Specialty Creator is designed specifically for this situation?",
        options: [
          "Craving Creator — enter what she's in the mood for.",
          "Dessert Creator — if she wants something sweet.",
          "Snack Creator — between-meal nutrition designed to fit her remaining macros for the day.",
          "Beverage Creator — for a filling drink option.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q6",
        question:
          "A client is eating at a restaurant tonight and wants to know which menu items fit her profile before she arrives. Which Lifestyle tool helps?",
        options: [
          "Create a Dish — describe what the restaurant typically serves.",
          "Fridge Rescue — enter the restaurant name to see what it generates.",
          "The Restaurant Guide in the Socializing Hub — get profile-aligned recommendations from that restaurant's menu.",
          "Find Meals Near Me — to locate the restaurant by proximity.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q7",
        question:
          "A coach explains the Socializing Hub to a client who worries that eating out always ruins her plan. What is the most accurate description of what the Socializing Hub does?",
        options: [
          "It helps clients avoid restaurants entirely when they're on a strict plan.",
          "It helps clients make the best decision available when eating out — so they stay connected to their plan instead of abandoning it.",
          "It replaces the weekly builder for clients who travel frequently.",
          "It automatically sends restaurant recommendations to the client's phone.",
        ],
        correctIndex: 1,
      },
      {
        id: "l4-q8",
        question:
          "A client is 22 weeks pregnant and asks whether My Perfect Meals has anything designed to support her nutrition during pregnancy. Which Lifestyle Collection is relevant?",
        options: [
          "My Perfect Getaway — for managing nutrition during physically demanding periods.",
          "My Perfect Gatherings — for planning meals around family needs.",
          "My Perfect Pregnancy — prenatal nutrition support with trimester-aware recommendations and food safety guidance.",
          "None — pregnancy nutrition requires a separate medical app.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q9",
        question:
          "A client is hosting Thanksgiving for 12 people — some vegan, some keto, some with gluten intolerance. Which Lifestyle Collection was built for this?",
        options: [
          "Craving Creator — plan multiple dishes based on what guests are craving.",
          "My Perfect Getaway — for managing group situations outside normal routine.",
          "My Perfect Gatherings — generates menus for events and group meals that accommodate multiple dietary identities at once.",
          "The Restaurant Guide — to find a venue that works for every guest.",
        ],
        correctIndex: 2,
      },
      {
        id: "l4-q10",
        question:
          "A new user says: \"I'm overwhelmed. There are so many things on the Lifestyle page. I don't know where to start.\" What's the best response?",
        options: [
          "Start with Create a Dish — it's the most powerful and covers the most situations.",
          "You don't need most of it. Identify what situation you're in right now, and use the tool that fits that situation. You don't have to learn them all at once.",
          "Work through each tool in order until you find one you like.",
          "The app automatically selects the right Lifestyle tool based on your profile.",
        ],
        correctIndex: 1,
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
      {
        heading: "Accessibility & Experience",
        body: "My Hub includes two global preferences that apply throughout the entire app.\n\n**Text Size** — Choose from Standard, A+, or A++. Once set, every screen in My Perfect Meals displays at that size.\n\n**Narration Speed** — Choose from 0.75×, 1×, 1.25×, or 1.5×. Your narration speed is used throughout My Perfect Meals — including Pro Tips, Copilot guidance, and every other narrated experience in the app. Set it once and it applies everywhere, automatically.",
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
        "In My Hub, find **Text Size**. Try a different size and see how it feels. Then find **Narration Speed** — choose the speed that feels most natural to you when listening.",
      ],
    },
    remember:
      "The More page isn't somewhere you'll spend most of your time. It's where you'll find the tools that support everything else you do in My Perfect Meals.",
    closing:
      "You've now explored every major navigation area in My Perfect Meals. In the final lesson, you'll go beyond navigation and learn how the platform brings everything together behind the scenes — through My Hub and the intelligent systems that personalize your experience.",
    quiz: [
      {
        id: "l5-q1",
        question:
          "What is the best way to think about the More page?",
        options: [
          "The place to generate meals and track daily nutrition.",
          "Your personal toolbox — where you manage your account, access saved meals, connect with professionals, and find learning resources.",
          "The settings menu for adjusting your builder and profile.",
          "An advanced section only coaches and professionals need.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q2",
        question:
          "A user generates a meal she loves and wants to save it for later. She's not ready to add it to today's plan or log it yet. Which button should she tap?",
        options: [
          "Add to Plan — it saves the meal for a future day.",
          "Add to Macros — it records the meal in her nutrition log.",
          "❤️ Favorite — it saves the meal to her collection without affecting her plan or daily tracking.",
          "Share — it creates a copy she can find later.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q3",
        question:
          "What is the difference between Favorite, Add to Plan, and Add to Macros?",
        options: [
          "They're three names for the same action — all three save the meal to the account.",
          "Favorite saves the meal to a collection. Add to Plan places it on the weekly board. Add to Macros logs it to daily nutrition tracking. They're three separate actions.",
          "Favorite is for coaches; Add to Plan and Add to Macros are for clients only.",
          "Add to Plan and Add to Macros must be tapped together, or neither takes effect.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q4",
        question:
          "A parent cooks for herself, her husband (managing high cholesterol), and her teenage son (lactose intolerant). She wants My Perfect Meals to generate appropriate meals for each of them from a single account. Which More page feature supports this?",
        options: [
          "Business Suite — for managing multiple accounts.",
          "Household Profiles — each family member keeps their own goals, dietary identity, allergies, and preferences.",
          "Connect With Your Provider — her husband's physician can set guidance for him.",
          "Favorites — she can tag saved meals for different family members.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q5",
        question:
          "A new client wants to connect her My Perfect Meals account to the coach she just hired. What does she need to do?",
        options: [
          "The coach links her automatically — she doesn't need to do anything.",
          "Tap 'Connect With Your Provider' on the More page and enter the access code her coach provides.",
          "Email support with her coach's name and the accounts will be linked within 24 hours.",
          "Upgrade her subscription to enable coaching connections.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q6",
        question:
          "A certified nutrition coach wants to start using My Perfect Meals professionally — including access to professional coaching tools and business resources. Where does she go on the More page?",
        options: [
          "Learning Resources — it contains coaching tools and certifications.",
          "Account & Security — professional accounts are configured there.",
          "Business Suite — designed for coaches, trainers, clinics, and partners who use My Perfect Meals as part of their professional work.",
          "Household Profiles — coaches manage clients through multi-profile setups.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q7",
        question:
          "A user wants to learn more about GlucoseGuard after seeing it mentioned during the Academy. Where should they go?",
        options: [
          "Repeat Lesson 3 — the builders section covers it.",
          "Business Suite — it contains advanced feature documentation.",
          "The App Library — where every major system in My Perfect Meals is explained in more detail and updated as new features are added.",
          "Coach's Corner — it explains features through daily guidance.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q8",
        question:
          "A user is prompted to set up two-factor authentication during the exercise for this lesson. Why does the lesson specifically call it out?",
        options: [
          "Two-factor authentication unlocks premium features in the app.",
          "It's required before connecting with a ProCare provider.",
          "It adds a second layer of protection to an account that stores personal health and nutrition data.",
          "Notifications won't work without it.",
        ],
        correctIndex: 2,
      },
      {
        id: "l5-q9",
        question:
          "A health professional has been using My Perfect Meals for her own nutrition for a year and now wants to start offering it to her clients. She's not sure where to begin. Where on the More page should she look first?",
        options: [
          "Learning Resources — specifically the Academy, to earn her certification.",
          "Tap 'Become a Provider' on the More page — that's where setting up a professional workspace begins.",
          "Account & Security — professional permissions are enabled there.",
          "Household Profiles — professionals manage clients through multi-profile setups.",
        ],
        correctIndex: 1,
      },
      {
        id: "l5-q10",
        question:
          "A new user says: \"There are so many sections on the More page. I don't think I need most of it.\" What's the best response?",
        options: [
          "You need to go through all of it to use My Perfect Meals correctly.",
          "That's right — you won't use all of it every day. The More page is where these tools live when you need them. You don't have to explore it all at once.",
          "Start with Business Suite — it's the most important section for all users.",
          "The More page is mostly for coaches and professionals — personal users can ignore most of it.",
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
];

export function getLessonById(id: string): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.id === id);
}

export function getLessonByNumber(
  num: number
): PlatformMasteryLesson | undefined {
  return PLATFORM_MASTERY_LESSONS.find((l) => l.lessonNumber === num);
}
