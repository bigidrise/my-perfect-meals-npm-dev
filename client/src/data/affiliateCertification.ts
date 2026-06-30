export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonSection {
  heading: string;
  text?: string;
  list?: string[];
  tip?: string;
}

export interface CertificationModule {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  sections: LessonSection[];
  quiz: {
    passingScore: number;
    questions: QuizQuestion[];
  };
}

export const AFFILIATE_CERT_TYPE = "affiliate_social";
export const COACHING_CERT_TYPE = "affiliate_coaching";
export const PASSING_SCORE = 80;

export const AFFILIATE_MODULES: CertificationModule[] = [
  {
    id: "module-1",
    title: "What Is My Perfect Meals?",
    description: "By the end of this module, you will be able to explain My Perfect Meals clearly and confidently in a single conversation.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Why This Module Matters",
        text: "Before you can explain My Perfect Meals to someone else, you need to understand what it actually is.\n\nMy Perfect Meals is not a calorie tracker, not a generic meal planner, and not a diet app. It is an AI-powered adaptive nutrition platform designed to help people make better food decisions based on their real life, goals, preferences, and health considerations.\n\nBy the end of this module, you should be able to explain My Perfect Meals in a simple conversation without overcomplicating it.",
      },
      {
        heading: "The Problem My Perfect Meals Solves",
        text: "Most people do not fail with nutrition because they lack information.\n\nThey fail because food decisions are complicated in real life.\n\nPeople have busy schedules. They eat at restaurants. They have families. They have cravings. They have medical concerns. They have food preferences. They have allergies. They have stress. They have habits.\n\nA generic meal plan does not account for all of that.\n\nMy Perfect Meals was built to help solve this problem by creating meal recommendations that fit the person, not forcing the person to fit the plan.",
        tip: "When explaining My Perfect Meals, do not start with features. Start with the problem: most people need nutrition guidance that fits their real life.",
      },
      {
        heading: "What My Perfect Meals Actually Does",
        text: "My Perfect Meals helps users create personalized meals, snacks, restaurant choices, grocery ideas, and meal plans based on their profile.\n\nThe app considers things like goals, food preferences, allergies, medical conditions, diet style, macro targets, restaurant eating, family needs, and lifestyle challenges.\n\nThat means two users can ask for the same type of meal and receive different recommendations because their profiles are different.\n\nThat is the point. My Perfect Meals is designed to personalize nutrition instead of giving everyone the same answer.",
        list: [
          "Goals",
          "Food preferences",
          "Allergies",
          "Medical conditions",
          "Diet style",
          "Macro targets",
          "Restaurant eating",
          "Family needs",
          "Lifestyle challenges",
        ],
        tip: "A simple way to say it is: \"My Perfect Meals helps people eat in a way that fits their body, their goals, and their real life.\"",
      },
      {
        heading: "Why AI Alone Is Not Enough",
        text: "A regular AI chatbot can create a meal idea.\n\nBut if it does not know the user's goals, allergies, health conditions, preferences, and eating patterns, it is mostly guessing.\n\nMy Perfect Meals is different because the app uses the user's profile to guide the recommendations.\n\nThe more accurate the profile, the better the recommendations.\n\nThat is why onboarding matters. That is why preferences matter. That is why health information matters. The app needs the right information to create better results.",
        tip: "If a client says the meals do not feel personalized, check the profile first. Many problems start with incomplete or inaccurate profile information.",
      },
      {
        heading: "What My Perfect Meals Is Not",
        text: "My Perfect Meals is not a medical provider.\n\nIt does not diagnose disease. It does not prescribe treatment. It does not replace a physician, dietitian, or licensed medical professional.\n\nMy Perfect Meals can support nutrition decisions, but medical decisions still belong with the proper professional.\n\nMy Perfect Meals is also not a weight-loss promise.\n\nSome users may lose weight. Some may gain muscle. Some may improve consistency. Some may use it for medical nutrition support, performance, family meals, or restaurant decisions.\n\nThe platform supports goals, but it does not guarantee outcomes.",
        tip: "Never promise weight loss, disease reversal, or medical results. Explain what the platform does, not what you hope it will do.",
      },
      {
        heading: "The Simple Way to Explain My Perfect Meals",
        text: "Here is a simple explanation you can use:\n\n\"My Perfect Meals is an AI-powered adaptive nutrition platform that helps people create meals and food choices based on their goals, preferences, health considerations, and real life. Instead of giving everyone the same meal plan, it personalizes recommendations to the individual.\"\n\nThat is the message.\n\nYou do not need to make it complicated. You do not need to sound like a doctor. You do not need to explain every feature in the first conversation.\n\nYour job is to help people understand that My Perfect Meals was built to make nutrition easier, more personal, and more realistic.",
        tip: "If you cannot explain My Perfect Meals in one minute, you are probably saying too much. Keep it simple first. Details come later.",
      },
      {
        heading: "Key Takeaways",
        list: [
          "My Perfect Meals solves the problem of generic nutrition advice that does not fit real life.",
          "The platform creates personalized meals and food choices based on the user's profile.",
          "Regular AI can generate meal ideas, but My Perfect Meals uses structured user information to personalize recommendations.",
          "My Perfect Meals is not a medical provider and does not replace licensed professionals.",
          "My Perfect Meals is not a weight-loss promise — it supports goals but does not guarantee outcomes.",
          "The best explanation is simple: it helps people make better food choices based on their goals, preferences, health needs, and real life.",
        ],
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m1q1",
          question: "A client asks, \"What is My Perfect Meals?\" What is the best answer?",
          options: [
            "It is a calorie tracker that helps users log meals.",
            "It is an AI-powered adaptive nutrition platform that helps create personalized meals and food choices.",
            "It is a medical app that treats nutrition-related conditions.",
            "It is a weight-loss program.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals is an AI-powered adaptive nutrition platform. It is not a calorie tracker, not a medical app, and not a weight-loss program.",
        },
        {
          id: "m1q2",
          question: "What problem was My Perfect Meals mainly created to solve?",
          options: [
            "People do not have enough diet books.",
            "Most people need nutrition guidance that fits their real life, not generic meal plans.",
            "People need stricter meal plans.",
            "Coaches need to manually create every recipe.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals was built because generic meal plans do not account for the complexity of real life — schedules, preferences, medical concerns, habits, and more.",
        },
        {
          id: "m1q3",
          question: "Why does user profile information matter?",
          options: [
            "It makes the app look more professional.",
            "It helps the app personalize meals based on goals, preferences, allergies, and health considerations.",
            "It allows the coach to avoid talking to the client.",
            "It guarantees weight loss.",
          ],
          correctIndex: 1,
          explanation: "The more accurate the profile, the better the recommendations. My Perfect Meals uses profile information to personalize everything it generates.",
        },
        {
          id: "m1q4",
          question: "A client says, \"Why can't I just ask a regular AI chatbot for meals?\" What is the best response?",
          options: [
            "Regular AI is useless for food.",
            "My Perfect Meals uses the user's profile to guide recommendations, so the meals are more personal to the user.",
            "Chatbots are only for entertainment.",
            "My Perfect Meals guarantees better medical outcomes.",
          ],
          correctIndex: 1,
          explanation: "A general AI chatbot does not know the user's goals, allergies, health conditions, or preferences. My Perfect Meals uses the user's profile to guide and personalize every recommendation.",
        },
        {
          id: "m1q5",
          question: "Which statement is most accurate?",
          options: [
            "My Perfect Meals replaces doctors and dietitians.",
            "My Perfect Meals diagnoses health conditions.",
            "My Perfect Meals supports nutrition decisions but does not replace licensed medical professionals.",
            "My Perfect Meals can cure diet-related diseases.",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals can support nutrition decisions, but medical decisions belong with the proper licensed professional. The platform is not a medical provider.",
        },
        {
          id: "m1q6",
          question: "A user says, \"How much weight will I lose?\" What should you say?",
          options: [
            "Most people lose weight quickly.",
            "The app guarantees results if they follow it.",
            "My Perfect Meals supports personalized nutrition goals, but it does not make weight-loss promises.",
            "They should expect results in 30 days.",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals supports goals but does not guarantee outcomes. Never promise weight loss, disease reversal, or specific results.",
        },
        {
          id: "m1q7",
          question: "A client says the meals do not feel personalized. What should you check first?",
          options: [
            "Whether their profile is complete and accurate.",
            "Whether they need a new phone.",
            "Whether they should stop using the app.",
            "Whether they are using too many features.",
          ],
          correctIndex: 0,
          explanation: "Many personalization problems start with incomplete or inaccurate profile information. The app generates better recommendations when the profile reflects the user accurately.",
        },
        {
          id: "m1q8",
          question: "What is the simplest correct way to describe My Perfect Meals?",
          options: [
            "A strict diet system.",
            "A medical treatment platform.",
            "A personalized nutrition platform that helps people make better food choices based on their goals, preferences, health needs, and real life.",
            "A recipe book.",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals personalizes nutrition to the individual instead of giving everyone the same answer. That is the core message.",
        },
      ],
    },
  },
  {
    id: "module-2",
    title: "How My Perfect Meals Works",
    description: "Understand the major tools inside My Perfect Meals and how to confidently guide someone through the platform.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Why This Module Matters",
        text: "Now that you understand what My Perfect Meals is, it's time to understand how the platform actually works.\n\nOne of the biggest mistakes new coaches and affiliates make is trying to explain every feature at once. You don't need to memorize every button or every builder. You simply need to understand how the platform helps people make better food decisions.\n\nBy the end of this module, you'll understand the major parts of My Perfect Meals, how they work together, and how to confidently guide someone through the platform.",
      },
      {
        heading: "Everything Starts with the Profile",
        text: "Every recommendation inside My Perfect Meals starts with the user's profile.\n\nThe profile tells the platform who the user is before any meals are created.\n\nInformation such as goals, food preferences, dietary style, allergies, health conditions, lifestyle, and other preferences help guide every recommendation the platform makes.\n\nThink of the profile as the foundation of the entire experience.\n\nThe better the profile, the better the recommendations.",
        tip: "If someone tells you the platform \"doesn't know them very well,\" the first thing to check is whether their profile is complete.",
      },
      {
        heading: "Building Meals",
        text: "Once the profile is complete, My Perfect Meals begins creating personalized nutrition.\n\nDepending on the user's needs, they may use different tools across the platform. Not every user will use every feature. The platform is designed so users can choose the tools that fit their lifestyle.\n\nSome people love cooking. Some eat out every day. Some need quick meals. Others want an entire week's worth of planning. My Perfect Meals supports all of those situations.",
        list: [
          "Meal Builders",
          "Weekly Meal Board",
          "Fridge Rescue",
          "Create a Dish",
          "Dessert Creator",
          "Beverage Creator",
          "Restaurant Guide",
          "Fast Food Guide",
          "Grocery and Shopping tools",
        ],
        tip: "Teach clients the features they need today. Don't overwhelm them by demonstrating every tool during the first session.",
      },
      {
        heading: "Personalization Happens Throughout the Platform",
        text: "Personalization does not stop after onboarding.\n\nEvery time a user creates a meal, asks for restaurant recommendations, builds a shopping list, or generates recipes, the platform continues using their profile.\n\nThat means recommendations stay consistent with who the user is.\n\nThe goal isn't to make everyone eat the same foods. The goal is to make healthier food choices easier for each individual.",
        tip: "Remind clients they can update their profile whenever their goals, preferences, or health needs change.",
      },
      {
        heading: "My Perfect Meals Is Built for Real Life",
        text: "Life isn't perfect.\n\nPeople travel. They go to restaurants. They attend parties. They have cravings. They forget to grocery shop. They cook for families.\n\nInstead of expecting users to live inside a perfect meal plan, My Perfect Meals provides tools for real-world situations.\n\nWhether someone is cooking at home, ordering takeout, eating at a restaurant, or trying to use what's already in the refrigerator, the platform helps them make better decisions.",
        tip: "The platform isn't about perfection. It's about helping people make better decisions more consistently.",
      },
      {
        heading: "The Platform Grows with the User",
        text: "Many users start with only one or two features. As they become more comfortable, they naturally begin exploring additional tools.\n\nThere is no \"right\" way to use My Perfect Meals. The platform is designed to grow alongside the user's needs.",
        list: [
          "Biometrics",
          "Shopping Lists",
          "Saved Favorites",
          "Recipe Scan",
          "Ingredient Intelligence",
          "Weekly Meal Planning",
          "Performance Nutrition",
          "Family Features",
          "Professional Coaching",
        ],
        tip: "Success doesn't come from using every feature. Success comes from consistently using the features that help the client most.",
      },
      {
        heading: "Key Takeaways",
        list: [
          "Everything begins with the user's profile.",
          "Different users will naturally use different tools.",
          "Personalization happens throughout the platform, not just during onboarding.",
          "The platform was designed for real life — not perfect situations.",
          "Users should learn the platform one step at a time.",
          "Coaches should simplify the experience instead of overwhelming new users.",
        ],
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m2q1",
          question: "What is the foundation of personalized recommendations in My Perfect Meals?",
          options: [
            "The Weekly Meal Board",
            "The user's profile",
            "The Shopping List",
            "The Restaurant Guide",
          ],
          correctIndex: 1,
          explanation: "Every recommendation inside My Perfect Meals starts with the user's profile. The profile tells the platform who the user is before any meals are created.",
        },
        {
          id: "m2q2",
          question: "A new client wants to learn every feature during their first session. What is the best approach?",
          options: [
            "Demonstrate every feature before they leave.",
            "Focus on the features they need first and introduce additional tools over time.",
            "Tell them to watch YouTube videos.",
            "Skip onboarding and let them explore.",
          ],
          correctIndex: 1,
          explanation: "Teach clients the features they need today. Overwhelming someone with every tool in the first session usually creates confusion, not confidence.",
        },
        {
          id: "m2q3",
          question: "Which statement best describes Meal Builders?",
          options: [
            "They create the same meals for every user.",
            "They generate personalized meals based on the user's profile.",
            "They only work for athletes.",
            "They replace the Weekly Meal Board.",
          ],
          correctIndex: 1,
          explanation: "Meal Builders generate personalized meals based on who the user is — their goals, preferences, dietary style, and health considerations.",
        },
        {
          id: "m2q4",
          question: "A client updates their goals from weight maintenance to muscle gain. What should happen?",
          options: [
            "They need to create a new account.",
            "The platform will use the updated profile when generating future recommendations.",
            "Nothing changes.",
            "They must contact customer support.",
          ],
          correctIndex: 1,
          explanation: "Personalization happens throughout the platform. When a user updates their profile, the platform uses that updated information going forward.",
        },
        {
          id: "m2q5",
          question: "Why does My Perfect Meals include tools like Restaurant Guide and Fridge Rescue?",
          options: [
            "To make the app larger.",
            "Because people make food decisions in many different real-life situations.",
            "To replace grocery shopping.",
            "To eliminate meal planning.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals was built for real life. People travel, eat out, attend events, and cook from what's on hand. The platform provides tools for all of those situations.",
        },
        {
          id: "m2q6",
          question: "Which statement is true?",
          options: [
            "Every user should use every feature.",
            "Every user follows the exact same path.",
            "Different users naturally use different features depending on their lifestyle.",
            "Meal Builders are the only important feature.",
          ],
          correctIndex: 2,
          explanation: "There is no single right way to use My Perfect Meals. The platform is designed to grow alongside each user's needs and lifestyle.",
        },
        {
          id: "m2q7",
          question: "A client says they only use the Weekly Meal Board. How should you respond?",
          options: [
            "Tell them they're using the app incorrectly.",
            "Encourage them to master the features that help them most before exploring others.",
            "Require them to use every Builder.",
            "Tell them to restart onboarding.",
          ],
          correctIndex: 1,
          explanation: "Success comes from consistently using the features that help the client most — not from using every feature. Start with what works and build from there.",
        },
        {
          id: "m2q8",
          question: "What is one of the main goals of My Perfect Meals?",
          options: [
            "Help users follow a perfect diet every day.",
            "Help users make better food decisions in real-life situations.",
            "Replace restaurants.",
            "Eliminate all food cravings.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals is designed to help people make better food decisions consistently — not to create a perfect diet that falls apart the moment real life happens.",
        },
      ],
    },
  },
  {
    id: "module-3",
    title: "Understanding Personalization & Adaptive Nutrition",
    description: "Why every user receives different recommendations and how to explain personalization clearly to clients.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Why This Module Matters",
        text: "One of the questions you'll hear most often is:\n\n\"Why did my meal plan look different from someone else's?\"\n\nThe answer is simple.\n\nMy Perfect Meals is designed to personalize nutrition for each individual. No two people have the same goals, preferences, lifestyle, or health considerations. Because of that, they shouldn't receive the same recommendations.\n\nBy the end of this module, you'll understand why personalization is the foundation of My Perfect Meals and how to explain it clearly to clients.",
      },
      {
        heading: "No Two People Are the Same",
        text: "Imagine two people sitting next to each other. Both are 45 years old. Both weigh the same. Both want to lose weight.\n\nShould they receive the same meal plan?\n\nProbably not.\n\nOne may have Type 2 diabetes. The other may be training for a marathon. One may be vegetarian. The other may have a shellfish allergy.\n\nEven though they have similar goals, their nutritional needs are different. That is why My Perfect Meals personalizes every recommendation instead of giving everyone the same plan.",
        tip: "When clients compare their meals to someone else's, remind them that the platform was designed to create recommendations for them — not for everyone.",
      },
      {
        heading: "What the Platform Considers",
        text: "Before making recommendations, My Perfect Meals looks at the information provided in the user's profile.\n\nThe more complete and accurate the profile, the better the recommendations.",
        list: [
          "Personal goals",
          "Dietary preferences",
          "Food allergies",
          "Lifestyle",
          "Medical conditions",
          "Preferred cuisines",
          "Macro targets",
          "Activity level",
          "Family needs",
          "Other personalization settings",
        ],
        tip: "If something changes in a client's life, encourage them to update their profile. The platform can only personalize using current information.",
      },
      {
        heading: "Personalization Changes Over Time",
        text: "People change. Goals change. Medical conditions change. Activity levels change. Life changes.\n\nMy Perfect Meals is designed to adapt as those changes happen.\n\nSomeone preparing for a marathon may later transition to general fitness. Someone recovering from surgery may eventually return to normal activity. Someone who was focused on weight loss may later focus on maintenance.\n\nUpdating the profile allows the platform to adjust recommendations to match the user's current situation.",
        tip: "Encourage clients to revisit their profile anytime their goals or health status changes.",
      },
      {
        heading: "Adaptive Nutrition in Everyday Life",
        text: "Adaptive Nutrition simply means the platform adjusts recommendations based on the person using it.\n\nThe same request can produce different answers because different people have different needs.\n\nFor example: a user wanting higher protein may receive a different meal than someone managing high blood pressure. A family preparing dinner may receive different suggestions than an athlete preparing for competition.\n\nThe platform is designed to adapt to the user — not force the user to adapt to the platform.",
        tip: "Personalization is one of the biggest strengths of My Perfect Meals. Make sure clients understand that different answers are expected, not mistakes.",
      },
      {
        heading: "Building Trust Through Personalization",
        text: "Some users are surprised when they receive recommendations that are different from a friend or family member. This is a great opportunity to build trust.\n\nExplain that My Perfect Meals doesn't try to make everyone eat the same way. Instead, it considers each person's unique situation before making recommendations.\n\nThat is one of the reasons people continue using the platform. They begin to see that the recommendations are built specifically for them.",
        tip: "When clients understand why the platform personalizes recommendations, they are much more likely to trust and continue using it.",
      },
      {
        heading: "Key Takeaways",
        list: [
          "Every person receives personalized recommendations.",
          "Different recommendations are expected because every profile is different.",
          "The platform uses profile information to guide personalization.",
          "Updating the profile keeps recommendations current.",
          "Adaptive Nutrition means the platform adapts to the user, not the other way around.",
          "Helping clients understand personalization builds confidence and long-term success.",
        ],
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m3q1",
          question: "Two users ask for a chicken dinner but receive different meal recommendations. What is the best explanation?",
          options: [
            "The AI made a mistake.",
            "The platform personalizes recommendations using each person's profile.",
            "One user has a newer version of the app.",
            "Different recipes are selected randomly.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals personalizes every recommendation based on the user's profile. Different results are expected — they reflect different goals, preferences, and health considerations.",
        },
        {
          id: "m3q2",
          question: "Why is a complete profile important?",
          options: [
            "It unlocks more app features.",
            "It helps the platform create recommendations that better match the user.",
            "It makes the app run faster.",
            "It increases the number of saved meals.",
          ],
          correctIndex: 1,
          explanation: "The more complete and accurate the profile, the better the recommendations. My Perfect Meals can only personalize using the information it has.",
        },
        {
          id: "m3q3",
          question: "A client's health condition changes. What should they do?",
          options: [
            "Create a new account.",
            "Update their profile so future recommendations reflect their current situation.",
            "Continue using the old profile.",
            "Delete all saved meals.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals adapts as people change. Updating the profile allows the platform to adjust recommendations to match the user's current situation.",
        },
        {
          id: "m3q4",
          question: "What does Adaptive Nutrition mean?",
          options: [
            "Everyone receives the healthiest meal available.",
            "The platform adjusts recommendations based on each user's individual profile.",
            "The app automatically changes diets every week.",
            "Users receive identical meals with different portion sizes.",
          ],
          correctIndex: 1,
          explanation: "Adaptive Nutrition means the platform adapts to the user — not the other way around. The same request can produce different answers because different people have different needs.",
        },
        {
          id: "m3q5",
          question: "A client says, \"My spouse got completely different meals.\" What should you tell them?",
          options: [
            "The system is inconsistent.",
            "My Perfect Meals personalizes recommendations for each individual, so different results are expected.",
            "Restart the app.",
            "They should both use the same profile.",
          ],
          correctIndex: 1,
          explanation: "Different recommendations are expected — they reflect each person's unique profile. This is a feature, not a problem.",
        },
        {
          id: "m3q6",
          question: "Which of these can influence personalization?",
          options: [
            "Goals",
            "Food preferences",
            "Health considerations",
            "All of the above",
          ],
          correctIndex: 3,
          explanation: "My Perfect Meals considers goals, food preferences, health considerations, allergies, lifestyle, and more when creating personalized recommendations.",
        },
        {
          id: "m3q7",
          question: "When should a user update their profile?",
          options: [
            "Only once during onboarding.",
            "Whenever their goals, lifestyle, or health information changes.",
            "Every day.",
            "Never.",
          ],
          correctIndex: 1,
          explanation: "The platform can only personalize using current information. Updating the profile whenever something changes keeps recommendations accurate.",
        },
        {
          id: "m3q8",
          question: "Why is personalization one of the biggest strengths of My Perfect Meals?",
          options: [
            "It allows the platform to provide recommendations that better fit each individual.",
            "It reduces the number of recipes available.",
            "It guarantees identical results for everyone.",
            "It eliminates the need for coaching.",
          ],
          correctIndex: 0,
          explanation: "Personalization means every user gets recommendations built for them specifically — their goals, their health, their lifestyle. That is what makes the platform different.",
        },
      ],
    },
  },
  {
    id: "module-4",
    title: "The App Handles Food. The Professional Handles People.",
    description: "Understanding the distinction between what the platform does and what the professional does — and why it matters.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "One of the most important concepts in the My Perfect Meals system is understanding the difference between what the platform does and what the professional does.\n\nMany new coaches enter the industry believing their primary responsibility is meal planning.\n\nIt is not.\n\nMeal planning is only one small piece of the process.\n\nPeople rarely fail because they lack meal plans. People fail because they struggle with consistency, behavior, habits, emotions, stress, and decision making.\n\nThe platform helps solve food problems. The professional helps solve people problems.\n\nUnderstanding this distinction is critical to becoming successful with My Perfect Meals.",
      },
      {
        heading: "The Biggest Mistake In Coaching",
        text: "Most new professionals focus almost entirely on food. They focus on:",
        list: [
          "Calories",
          "Macros",
          "Meal timing",
          "Food choices",
          "Supplements",
        ],
      },
      {
        heading: "The Real Problem",
        text: "While these things matter, they are rarely the reason a client succeeds or fails.\n\nMost clients already know what they should be eating.\n\nThe problem is not knowledge.\n\nThe problem is implementation.",
      },
      {
        heading: "The App Handles Food",
        text: "The platform can:",
        list: [
          "Generate meals",
          "Generate recipes",
          "Generate snacks, desserts, and beverages",
          "Generate shopping lists",
          "Generate restaurant options",
          "Adapt meals to medical conditions",
          "Adapt meals to dietary preferences",
          "Adapt meals to cultural cuisines",
          "Adapt meals to allergies and restrictions",
        ],
      },
      {
        heading: "The Professional Handles People",
        text: "The professional's job is different. The professional must understand:",
        list: [
          "Motivation",
          "Behavior",
          "Habits",
          "Compliance",
          "Resistance",
          "Accountability",
          "Communication",
          "Consistency",
        ],
      },
      {
        heading: "What Clients Are Really Saying",
        text: "Clients often say one thing while meaning something very different. A coach must learn to hear both.",
        list: [
          "\"I'll try it for a month\" may mean: \"I've failed before and I'm afraid this won't work.\"",
          "\"Nothing works for me\" may mean: \"I've lost trust in the process.\"",
          "\"I only eat one meal a day\" may mean: \"I've spent years restricting food and damaging my relationship with eating.\"",
          "\"I know what I should be doing\" may mean: \"I understand information but struggle with consistency.\"",
        ],
      },
      {
        heading: "Reasons Versus Excuses",
        text: "One of the most important skills a professional can develop is learning the difference between legitimate obstacles and excuses.\n\nLegitimate obstacles may include:",
        list: [
          "Medical conditions",
          "Hormonal issues",
          "Menopause",
          "Injury",
          "Physical limitations",
          "Medication side effects",
          "Chronic pain",
          "Significant stress",
        ],
      },
      {
        heading: "Common Excuses",
        text: "These statements often protect people from discomfort and change. Good coaches learn to recognize the difference.",
        list: [
          "\"I'm too busy.\"",
          "\"I don't have time.\"",
          "\"I'll start next month.\"",
          "\"I need the perfect plan.\"",
          "\"I'll do it after the holidays.\"",
        ],
      },
      {
        heading: "The Guilt Cycle",
        text: "Many people struggling with food are not actually struggling with food. They are struggling with guilt. The cycle often looks like this:",
        list: [
          "Eat emotionally",
          "Feel guilty",
          "Restrict food",
          "Become frustrated",
          "Overeat again",
          "Feel more guilty",
          "Repeat",
        ],
      },
      {
        heading: "Why My Perfect Meals Changes The Conversation",
        text: "Traditional coaching often forces clients to stop eating foods they enjoy. My Perfect Meals takes a different approach.\n\nInstead of asking: \"What must this person give up?\"\n\nWe ask: \"How can we help this person continue enjoying food while moving toward their goals?\"\n\nThis shift reduces resistance. It improves compliance. It increases consistency.\n\nAnd consistency is what produces results.",
      },
      {
        heading: "Key Takeaway",
        text: "The app handles food.\n\nThe professional handles people.\n\nThe professionals who understand this distinction will consistently create better outcomes than those who focus only on nutrition.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m4q1",
          question: "What is the primary role of the My Perfect Meals platform?",
          options: [
            "Managing human behavior",
            "Managing nutrition complexity",
            "Replacing coaches",
            "Replacing physicians",
          ],
          correctIndex: 1,
          explanation: "The platform's primary role is managing nutrition complexity — generating meals, recipes, shopping lists, and adapting to medical conditions, preferences, and restrictions.",
        },
        {
          id: "m4q2",
          question: "What is the primary role of the professional?",
          options: [
            "Managing people, behavior, and accountability",
            "Writing recipes all day",
            "Building grocery lists",
            "Managing software updates",
          ],
          correctIndex: 0,
          explanation: "The professional's job is managing the human side — motivation, behavior, habits, compliance, accountability, and consistency. The platform handles the food side.",
        },
        {
          id: "m4q3",
          question: "Which statement best describes the relationship between the platform and the professional?",
          options: [
            "The platform replaces the professional",
            "The professional replaces the platform",
            "The platform handles food while the professional helps people succeed",
            "They perform the same function",
          ],
          correctIndex: 2,
          explanation: "The platform and the professional each have a specific role. The platform manages nutrition complexity. The professional helps clients implement, stay consistent, and overcome human challenges.",
        },
        {
          id: "m4q4",
          question: "According to this lesson, why do most clients struggle even when they already know what healthy eating looks like?",
          options: [
            "They do not have access to healthy food options",
            "Their meal plans are not detailed enough",
            "The problem is not knowledge — it is implementation",
            "They need more recipes before they can begin",
          ],
          correctIndex: 2,
          explanation: "Most clients already know what healthy foods look like. The challenge is not knowledge — it is implementation. People fail at nutrition not because they don't know better, but because they struggle to consistently apply what they know in real life.",
        },
        {
          id: "m4q5",
          question: "A client eats emotionally, then feels guilty, restricts food the next day, becomes frustrated, and overeats again. What pattern does this describe?",
          options: [
            "The compliance reset",
            "The motivation loop",
            "The restriction protocol",
            "The guilt cycle",
          ],
          correctIndex: 3,
          explanation: "This is the guilt cycle — a repeating pattern of emotional eating, guilt, restriction, frustration, and overeating. Professionals who recognize this can help clients address the emotional root of their food struggles rather than just adjusting the meal plan.",
        },
      ],
    },
  },
  {
    id: "module-5",
    title: "Using MPM With Clients",
    description: "How to work with clients effectively — starting with who they are, not what they should eat.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "One of the biggest mistakes new professionals make is believing they must completely change how their clients eat.\n\nIn reality, the opposite is often true.\n\nThe fastest way to create resistance is to force people into a lifestyle they do not enjoy.\n\nThe fastest way to improve compliance is to help people continue eating foods they enjoy while making those foods better aligned with their goals.\n\nThis is one of the core principles of the My Perfect Meals system.",
      },
      {
        heading: "Stop Acting Like A Food Police Officer",
        text: "Many professionals enter coaching believing their job is to tell people what they cannot eat. Clients hear:",
        list: [
          "No pizza",
          "No dessert",
          "No fast food",
          "No alcohol",
          "No restaurants",
          "No family meals",
        ],
      },
      {
        heading: "Punishment Is Not A Strategy",
        text: "The result is frustration. Eventually the client feels punished.\n\nPunishment is not a sustainable nutrition strategy.\n\nPeople do not maintain healthy habits because they are forced to. People maintain healthy habits because those habits fit into their lives.",
      },
      {
        heading: "The First Conversation",
        text: "The first conversation should focus less on food rules and more on understanding the client. Ask questions such as:",
        list: [
          "What do you normally eat for breakfast?",
          "What do you normally eat for lunch?",
          "What do you normally eat for dinner?",
          "What snacks do you enjoy?",
          "What desserts do you enjoy?",
          "What restaurants do you visit regularly?",
          "What foods do you dislike?",
          "What foods will you absolutely not give up?",
        ],
      },
      {
        heading: "The Power Of Provider Notes",
        text: "Provider Notes are one of the most valuable tools in the platform. Use them. Document information such as:",
        list: [
          "Favorite foods",
          "Family eating habits",
          "Work schedules",
          "Travel schedules",
          "Stress triggers",
          "Comfort foods",
          "Previous dieting experiences",
          "Foods they refuse to eat",
          "Foods they love",
        ],
      },
      {
        heading: "Build Around What They Already Like",
        text: "A common mistake is creating an entirely new lifestyle for the client. Instead, start with foods they already enjoy. If they enjoy eggs and bacon, chili, tacos, burgers, pizza, pasta, or desserts — use those foods as starting points.\n\nThe platform can modify meals to better fit goals, protocols, and preferences. People are far more likely to follow a plan built around foods they enjoy.",
      },
      {
        heading: "Let The Platform Handle Complexity",
        text: "The platform can account for:",
        list: [
          "Diabetes",
          "Cardiac concerns",
          "Metabolic medication support",
          "Anti-inflammatory protocols",
          "Food allergies",
          "Cultural cuisines",
          "Macro targets",
          "Lifestyle preferences",
        ],
      },
      {
        heading: "Do Not Try To Be The Smartest Person In The Room",
        text: "Many new professionals feel pressure to have every answer. You do not need every answer. You need the right process.\n\nA professional who listens carefully and utilizes the platform effectively will often produce better outcomes than a professional trying to manually solve every problem.\n\nThe goal is not proving how much you know. The goal is helping the client succeed.",
      },
      {
        heading: "Understand Compliance",
        text: "Results cannot be evaluated without understanding compliance. If a client is not following recommendations, the platform is not being tested fairly. A coach must determine:",
        list: [
          "Is the client using the platform?",
          "Are meals being followed?",
          "Are recommendations being followed?",
          "Are habits improving?",
          "Is consistency improving?",
        ],
      },
      {
        heading: "Focus On Habits First",
        text: "Many clients obsess over outcomes. Good coaches focus on habits. Examples include:",
        list: [
          "Eating breakfast consistently",
          "Drinking more water",
          "Increasing protein intake",
          "Reducing mindless snacking",
          "Planning meals in advance",
          "Improving consistency",
        ],
      },
      {
        heading: "Why Clients Choose Safe Goals",
        text: "Clients often set goals that seem smaller than their actual need. A client who needs to lose 80 pounds may say they only want to lose 20.\n\nThis is rarely a lack of ambition.\n\nIt is usually fear of failure.\n\nThey are not choosing 20 pounds because they do not want more. They are choosing 20 pounds because that is a place they have been before. It felt safe. They succeeded there once. And they are afraid that aiming higher means failing again.\n\nThe goal is not always the number.\n\nThe goal is confidence.\n\nA coach who understands this does not push harder for a bigger number. They help the client build trust in the process — and let the results expand from there.",
      },
      {
        heading: "Key Takeaway",
        text: "The best coaches do not force people into completely new lifestyles.\n\nThey help people improve the lifestyle they already have.\n\nThe platform provides the food solutions. The professional provides the guidance, accountability, and support.\n\nWhen both work together, clients achieve better outcomes with less frustration.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m5q1",
          question: "What is one of the biggest mistakes new professionals make when working with clients?",
          options: [
            "Asking too many questions",
            "Focusing on hydration",
            "Believing they must completely change how clients eat",
            "Tracking compliance",
          ],
          correctIndex: 2,
          explanation: "Forcing clients into a completely new lifestyle creates resistance and reduces compliance. The most effective approach starts with understanding and building around what clients already enjoy.",
        },
        {
          id: "m5q2",
          question: "According to the lesson, what should the first conversation focus on?",
          options: [
            "Restricting unhealthy foods",
            "Understanding the client's lifestyle and preferences",
            "Calculating macros immediately",
            "Creating a strict meal plan",
          ],
          correctIndex: 1,
          explanation: "The first conversation should focus on understanding the client — their habits, preferences, schedules, and lifestyle. The goal is understanding the person, not immediately changing them.",
        },
        {
          id: "m5q3",
          question: "What is one of the primary purposes of Provider Notes?",
          options: [
            "Storing payment information",
            "Tracking software updates",
            "Documenting important information about the client",
            "Creating workout plans",
          ],
          correctIndex: 2,
          explanation: "Provider Notes are used to document valuable information about the client — favorite foods, family habits, stress triggers, travel schedules — so the coaching experience feels personal and understood.",
        },
        {
          id: "m5q4",
          question: "When building a nutrition strategy, where should professionals typically start?",
          options: [
            "Foods the client dislikes",
            "Completely new foods",
            "The latest nutrition trends",
            "Foods the client already enjoys eating",
          ],
          correctIndex: 3,
          explanation: "Starting with foods clients already enjoy dramatically improves compliance. The platform can modify those meals to align with goals — there's no need to eliminate what people love.",
        },
        {
          id: "m5q5",
          question: "A client needs to lose approximately 80 pounds but tells you they only want to lose 20. What is the most likely reason?",
          options: [
            "They do not understand how weight loss works",
            "They are trying to avoid accountability",
            "They are choosing a goal that feels achievable because they have succeeded there before and are afraid of failing at a bigger target",
            "They don't care about long-term results",
          ],
          correctIndex: 2,
          explanation: "Clients often choose goals they believe they can safely reach. The issue is frequently fear of failure, not lack of ambition. They remember a version of themselves that felt safe and achievable — and they are protecting themselves from another disappointment. The coach's role is to help them build confidence in the process, not push harder on the number.",
        },
      ],
    },
  },
  {
    id: "module-6",
    title: "Marketing The Right Way",
    description: "Why hype-based marketing fails and how education and trust create lasting business growth.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "One of the biggest reasons people fail in business is because they misunderstand marketing.\n\nMany people believe marketing is convincing people to buy something.\n\nIt is not.\n\nMarketing is helping people understand that a solution exists for a problem they are already experiencing.\n\nThe purpose of marketing is not pressure. The purpose of marketing is education. The purpose of marketing is trust. The purpose of marketing is awareness.\n\nThis philosophy is the foundation of all My Perfect Meals marketing.",
      },
      {
        heading: "The Biggest Marketing Mistake",
        text: "Most health and fitness marketing focuses on outcomes. Examples include:",
        list: [
          "Lose 10 pounds fast",
          "Get shredded in 30 days",
          "Melt belly fat",
          "Drop two dress sizes",
          "Beach body ready",
        ],
      },
      {
        heading: "Why Those Messages Fail",
        text: "The problem is that people have seen these promises thousands of times. Most people no longer trust them. Many have already tried them. Many have already failed with them.\n\nAs a result, these messages often create skepticism rather than trust.",
      },
      {
        heading: "People Buy Because Of Pain",
        text: "People rarely take action because of features. People take action because they are frustrated. They are experiencing pain. Examples include:",
        list: [
          "Constant cravings",
          "Feeling out of control around food",
          "Lack of energy",
          "Meal planning frustration",
          "Family eating challenges",
          "Diabetes concerns",
          "Weight gain",
          "Food guilt",
          "Restaurant struggles",
          "Emotional eating",
        ],
      },
      {
        heading: "Understanding Pain Zones",
        text: "Pain zones are the situations people struggle with most. When people recognize their pain, they become more open to solutions. This is why pain-zone marketing is more effective than hype-based marketing.",
        list: [
          "Cravings",
          "Stress eating",
          "Emotional eating",
          "Restaurant eating",
          "Social events",
          "Family meals",
          "Busy schedules",
          "Food preparation",
          "Shopping confusion",
          "Medical dietary restrictions",
        ],
      },
      {
        heading: "People Buy When They Are Ready",
        text: "You cannot force people to make decisions. You cannot pressure people into long-term commitment. People take action when:",
        list: [
          "The timing is right",
          "The trust is high enough",
          "The pain is significant enough",
          "The solution makes sense",
        ],
      },
      {
        heading: "Why We Do Not Use Weight Loss Marketing",
        text: "My Perfect Meals is not built around weight loss.\n\nWeight loss may occur. Weight gain may occur. Body recomposition may occur. Health improvements may occur.\n\nThose are outcomes. The platform exists to improve nutrition, behavior, consistency, and food decisions.\n\nBecause of this, affiliates and partners should avoid making exaggerated weight loss claims.",
      },
      {
        heading: "Why We Do Not Use Fear Marketing",
        text: "Fear-based marketing often creates short-term attention. It rarely creates long-term trust. Examples include:",
        list: [
          "Limited-time panic offers",
          "Unrealistic promises",
          "False urgency",
          "Manipulative messaging",
        ],
      },
      {
        heading: "The Chef Represents The Brand",
        text: "The Chef is the official personality and mascot of My Perfect Meals. When marketing the platform, affiliates should utilize approved brand assets whenever possible. Consistency strengthens the brand. The Chef represents:",
        list: [
          "Guidance",
          "Education",
          "Simplicity",
          "Creativity",
          "Food enjoyment",
          "Real-life nutrition",
        ],
      },
      {
        heading: "Monthly Marketing Packages",
        text: "Approved affiliates will receive monthly marketing materials. These materials may include:",
        list: [
          "Images",
          "Videos",
          "Social media content",
          "Educational content",
          "Campaign themes",
          "Talking points",
          "Feature highlights",
        ],
      },
      {
        heading: "Marketing Standards",
        text: "Approved marketing should educate, inform, inspire, build trust, highlight solutions, address pain zones, and reflect real-world use.\n\nMarketing should never promise unrealistic results, guarantee outcomes, use deceptive claims, create false urgency, or misrepresent the platform.",
      },
      {
        heading: "Wanting The Result Without Becoming The Person",
        text: "There is a coaching insight that most certifications never teach — and it is the one that separates coaches who get real results from coaches who stay frustrated.\n\nThe real issue is not that people do not want to lose weight.\n\nThe real issue is that people want the result without becoming the person required to get the result.\n\nIf someone truly wanted to lose weight, they would be willing to:\n\n• Walk every day\n• Track their food\n• Be patient\n• Learn new habits\n• Change their routines\n• Stay consistent through difficulty\n\nBut instead, many people are quietly asking a different question:\n\n\"How do I lose weight without changing?\"\n\nThat question drives everything — the cayenne pepper, the detox teas, the fat burners, the cookie diet, the grapefruit diet, the starvation diet, the weight loss injections, the lap band surgery, the gastric sleeve.\n\nNone of those are inherently good or bad by themselves. The coaching insight is understanding why the person is attracted to them.\n\nThe attraction is: \"Can I get the outcome without changing my behavior?\"\n\nThat is the question they are really asking.\n\nThis is also why someone will try a gimmick indefinitely — with no time limit, no hesitation — but will only give 30 days to a structured, proven program. That ceiling tells you everything. They have already mentally prepared to leave before they have even started.\n\nSomeone operating from this mindset will consent to surgery before they will commit to changing what they eat. Not because surgery is easier. Because surgery feels like something happening to them — not something they have to become.\n\nThe role of the coach is not to judge this. It is to recognize it early. To understand where the client actually is — not where they say they are — and to help them get honest about what they are really willing to do before they invest time in a plan they are not ready to follow.",
      },
      {
        heading: "The Outcome vs The Process",
        text: "This distinction has a name: Outcome vs Process.\n\nClients focused on the outcome want the result.\nClients focused on the process want to build the habits that create the result.\n\nNearly every client starts outcome-focused. That is normal. The coaching work is helping them shift toward process-focused thinking — because that is the only place lasting change actually lives.\n\nYou cannot shortcut someone into sustainable health. You can only help them decide that the process is worth it.",
      },
      {
        heading: "Key Takeaway",
        text: "People do not buy because of hype.\n\nPeople buy because they believe a solution can help them solve a problem.\n\nThe role of marketing is to educate, build trust, and help people recognize that solution.\n\nThat philosophy is the foundation of My Perfect Meals marketing.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m6q1",
          question: "According to the My Perfect Meals marketing philosophy, what is the primary purpose of marketing?",
          options: [
            "Convincing people to buy something",
            "Creating pressure and urgency",
            "Helping people understand that a solution exists for a problem they are already experiencing",
            "Generating immediate sales",
          ],
          correctIndex: 2,
          explanation: "Marketing is not about pressure or convincing. It is about education, trust, and awareness — helping people recognize that a solution exists for a problem they are already facing.",
        },
        {
          id: "m6q2",
          question: "Why does My Perfect Meals avoid traditional weight-loss marketing messages?",
          options: [
            "They are expensive to advertise",
            "Most people have already seen similar promises and often do not trust them",
            "They only work for athletes",
            "They are difficult to create",
          ],
          correctIndex: 1,
          explanation: "People have seen outcome-based promises thousands of times. Many have already tried and failed with them. These messages create skepticism rather than trust.",
        },
        {
          id: "m6q3",
          question: "According to this lesson, what should good marketing focus on first?",
          options: [
            "Product features",
            "Discounts and promotions",
            "Competitor comparisons",
            "Understanding the person's pain points and frustrations",
          ],
          correctIndex: 3,
          explanation: "People take action because they are experiencing pain or frustration. Good marketing starts by understanding that pain — then presenting a solution.",
        },
        {
          id: "m6q4",
          question: "Which marketing message best aligns with My Perfect Meals standards?",
          options: [
            "\"Lose 20 pounds in 30 days guaranteed!\"",
            "\"Act now before it's too late!\"",
            "\"Struggling with cravings, meal planning, or consistency? My Perfect Meals was designed to help.\"",
            "\"Results guaranteed or your money back.\"",
          ],
          correctIndex: 2,
          explanation: "This message addresses a real pain zone, speaks to a real problem, and presents a solution without making guarantees or using false urgency.",
        },
        {
          id: "m6q5",
          question: "A client asks about fat burners, detox programs, cayenne pepper, fasting protocols, and multiple other weight loss shortcuts. During the same conversation, they say they are only willing to try a structured nutrition program for 30 days. What is the most important coaching insight here?",
          options: [
            "The client needs more nutrition education",
            "The client has not found the right diet yet",
            "The client is focused on obtaining the outcome while avoiding the behavior changes required to create it",
            "The client needs a more restrictive meal plan",
          ],
          correctIndex: 2,
          explanation: "Many clients are not searching for a better process. They are searching for a way around the process. A client who will try a gimmick indefinitely but only gives 30 days to a structured program has already mentally prepared to leave. The coaching insight is recognizing that this client wants the result without becoming the person required to get it — and the work begins there, not with the meal plan.",
        },
      ],
    },
  },
  {
    id: "module-7",
    title: "Building A Real Business",
    description: "What building a sustainable business actually looks like — and why commitment matters more than motivation.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "Many people enter business ownership believing success happens quickly.\n\nIt rarely does.\n\nThe truth is that most successful businesses are built through consistency, patience, learning, and repeated action over time.\n\nThe My Perfect Meals platform can provide powerful tools, systems, and opportunities. However, no platform can replace effort.\n\nSuccess still requires action. Success still requires commitment. Success still requires consistency.",
      },
      {
        heading: "Before You Continue",
        text: "This certification is intentionally required before becoming an approved My Perfect Meals affiliate, provider, or business partner.\n\nThe reason is simple. We are not looking for the largest number of affiliates. We are looking for the right affiliates.\n\nIf you are unwilling to invest approximately 60 to 90 minutes learning how the platform works, how clients think, how behavior affects results, and how the business operates, it is unlikely that you will invest the time required to build a successful business.\n\nMy Perfect Meals is not designed for people looking for a shortcut. We would rather work with ten committed professionals who are willing to learn and grow than one hundred affiliates who never take action.",
      },
      {
        heading: "Interest Versus Commitment",
        text: "One of the most important lessons in business is understanding the difference between interest and commitment.\n\nInterest sounds like:",
        list: [
          "\"I'll think about it.\"",
          "\"I'll try it.\"",
          "\"Maybe next month.\"",
          "\"Send me some information.\"",
          "\"Let me talk to my spouse.\"",
        ],
      },
      {
        heading: "What Commitment Looks Like",
        text: "Commitment sounds like:",
        list: [
          "Completing onboarding",
          "Learning the system",
          "Taking action",
          "Following the process",
          "Showing up consistently",
        ],
      },
      {
        heading: "Why Most People Fail",
        text: "Most people do not fail because they lack talent. Most people do not fail because they lack intelligence.\n\nMost people fail because they stop.",
        list: [
          "They stop posting",
          "They stop learning",
          "They stop communicating",
          "They stop following up",
          "They stop believing",
        ],
      },
      {
        heading: "Motivation Is Temporary",
        text: "Many people wait to feel motivated. This is a mistake.\n\nMotivation comes and goes. Successful professionals rely on habits, systems, and routines.\n\nThe goal is not feeling motivated. The goal is continuing to take action whether motivation is present or not.",
      },
      {
        heading: "The Reality Of Business Ownership",
        text: "Owning a business is different from having a hobby. Business owners must:",
        list: [
          "Learn continuously",
          "Communicate regularly",
          "Market consistently",
          "Build relationships",
          "Solve problems",
          "Stay accountable",
        ],
      },
      {
        heading: "Building Trust Takes Time",
        text: "Trust is earned. Trust is rarely created in a single conversation.\n\nPeople watch. People observe. People compare. People evaluate. Eventually they decide.\n\nThe most successful professionals understand that trust is built through consistency over time.",
      },
      {
        heading: "Relationships Create Businesses",
        text: "Most successful businesses are built through relationships. People prefer working with people they trust. The strongest opportunities often come from:",
        list: [
          "Existing clients",
          "Referrals",
          "Professional relationships",
          "Community connections",
          "Partnerships",
        ],
      },
      {
        heading: "Success Leaves Clues",
        text: "Successful professionals tend to share common characteristics. They do not look for shortcuts. They focus on execution.",
        list: [
          "Learn continuously",
          "Stay coachable",
          "Follow systems",
          "Communicate professionally",
          "Take responsibility",
          "Remain consistent",
        ],
      },
      {
        heading: "Key Takeaway",
        text: "The My Perfect Meals platform can provide tools, systems, and opportunities. What it cannot provide is commitment.\n\nThat responsibility belongs to the professional.\n\nThe people who learn, apply, and remain consistent will always outperform those who wait for perfect conditions.\n\nBusiness success is not created by motivation. Business success is created by action repeated over time.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m7q1",
          question: "According to this lesson, what is one thing that the My Perfect Meals platform cannot provide?",
          options: [
            "Education",
            "Marketing materials",
            "Commitment",
            "Training",
          ],
          correctIndex: 2,
          explanation: "The platform provides tools, systems, automation, marketing support, and resources. What it cannot provide is commitment — that responsibility belongs entirely to the individual.",
        },
        {
          id: "m7q2",
          question: "According to this lesson, what is the most common reason people fail in business — not lack of talent, but what?",
          options: [
            "Starting before they are fully ready",
            "Spending too much money on advertising early",
            "They stop — posting, learning, communicating, following up, and believing",
            "Choosing the wrong business model",
          ],
          correctIndex: 2,
          explanation: "Most people do not fail because they lack talent or intelligence. They fail because they stop. They stop posting, stop learning, stop communicating, stop following up, and stop believing. Sustained consistent action — not talent — is what separates those who succeed from those who don't.",
        },
        {
          id: "m7q3",
          question: "According to the lesson, what best demonstrates commitment?",
          options: [
            "Thinking about the opportunity",
            "Requesting more information",
            "Taking action and following the process consistently",
            "Waiting for the perfect time to begin",
          ],
          correctIndex: 2,
          explanation: "Commitment is demonstrated through action — completing onboarding, learning the system, following the process, and showing up consistently. Interest remains at the thinking stage.",
        },
        {
          id: "m7q4",
          question: "What does this lesson teach about motivation?",
          options: [
            "Motivation is required every day to succeed",
            "Successful professionals rely on habits, systems, and routines more than motivation",
            "Motivation is more important than consistency",
            "Motivation guarantees success",
          ],
          correctIndex: 1,
          explanation: "Motivation is temporary and unreliable. Successful professionals build habits, systems, and routines that carry them forward regardless of how motivated they feel on any given day.",
        },
        {
          id: "m7q5",
          question: "What is the key difference between someone who is 'interested' and someone who is 'committed,' according to this lesson?",
          options: [
            "Committed people have more money to invest upfront",
            "Interested people are usually more enthusiastic at the start",
            "Interest stays at the level of thinking and waiting; commitment moves into consistent action and follow-through",
            "There is no meaningful practical difference between the two",
          ],
          correctIndex: 2,
          explanation: "Interest sounds like 'I'll think about it' or 'maybe next month.' Commitment looks like completing onboarding, learning the system, taking action, and showing up consistently — even when motivation is not present. My Perfect Meals looks for committed professionals, not interested ones.",
        },
      ],
    },
  },
  {
    id: "module-8",
    title: "Brand Standards & Affiliate Accountability",
    description: "The formal prohibited practices list, brand representation requirements, and the consequences process for non-compliance.",
    estimatedMinutes: 10,
    sections: [
      {
        heading: "Introduction",
        text: "Module 6 explained the philosophy behind My Perfect Meals marketing.\n\nThis module covers the formal standards.\n\nThese are not suggestions. They are requirements.\n\nMy Perfect Meals has built a brand around honesty, clinical integrity, and respect for the people using the platform. Every affiliate and partner represents that brand. How you market My Perfect Meals — in person, on social media, through email, in videos, or anywhere else — either strengthens that brand or damages it.\n\nThis module exists so there is no ambiguity about what is expected and what the consequences are if those expectations are not met.",
      },
      {
        heading: "Prohibited Marketing Practices",
        text: "Affiliates may not, under any circumstances:",
        list: [
          "Make false or misleading claims about results",
          "Guarantee weight loss, disease reversal, or specific health outcomes",
          "Use fear-based, shame-based, or manipulative marketing tactics",
          "Use artificial scarcity, false urgency, or misleading countdown offers that have not been approved by My Perfect Meals",
          "Represent themselves as medical professionals unless properly licensed and authorized to do so",
          "Alter, misrepresent, or contradict official My Perfect Meals product descriptions, features, pricing, or capabilities",
          "Create marketing materials that conflict with official My Perfect Meals branding guidelines",
          "Make medical claims, treatment claims, or disease management claims that the platform has not authorized",
        ],
      },
      {
        heading: "What Affiliates Are Expected To Do",
        text: "All marketing should:",
        list: [
          "Accurately represent what the platform does and does not do",
          "Educate people about the platform's features and real-world applications",
          "Focus on helping individuals make informed decisions",
          "Use approved brand assets and messaging when available",
          "Reflect the My Perfect Meals commitment to honesty and evidence-based nutrition",
          "Direct specific medical, clinical, or legal questions to appropriate professionals",
        ],
      },
      {
        heading: "Non-Compliance: First Violation",
        text: "If an affiliate is found to be violating My Perfect Meals brand standards, marketing guidelines, or compliance requirements, the following process applies.\n\nFirst Violation:\n\nThe affiliate will receive written notice identifying the specific issue. The affiliate will be given a defined timeframe to correct or remove the non-compliant content. This is a one-time opportunity to fix an honest mistake. My Perfect Meals reserves the right to determine what constitutes a correctable violation.",
      },
      {
        heading: "Non-Compliance: Continued Or Serious Violations",
        text: "If violations continue or if the first violation was serious enough to bypass the correction period, the following may occur:",
        list: [
          "Suspension of affiliate privileges",
          "Removal of affiliate commissions associated with non-compliant activity where permitted by law",
          "Permanent termination from the affiliate program",
        ],
      },
      {
        heading: "Immediate Termination Offenses",
        text: "My Perfect Meals may immediately terminate an affiliate relationship without notice or a corrective period in cases involving:",
        list: [
          "Fraud or intentional deception",
          "Unauthorized medical claims or treatment claims",
          "Reputational harm to My Perfect Meals, its clients, or its partners",
          "Conduct that endangers the health or safety of users",
          "Serious misconduct of any kind",
        ],
      },
      {
        heading: "Why These Standards Exist",
        text: "These standards are not designed to control affiliates.\n\nThey exist to protect the people using the platform.\n\nMany of the individuals who come to My Perfect Meals are managing real health challenges — diabetes, obesity, oncology support needs, metabolic conditions. They are looking for honest information and real help.\n\nThey deserve to be told the truth.\n\nAny affiliate who markets My Perfect Meals using false promises, exaggerated claims, or manipulative tactics is not just violating a business agreement — they are exploiting people who are already struggling.\n\nThat is not who My Perfect Meals is. That is not who our affiliates are.\n\nParticipation in the affiliate program constitutes agreement to follow all current and future brand, compliance, and marketing standards established by My Perfect Meals.",
      },
      {
        heading: "Key Takeaway",
        text: "The rules are simple.\n\nTell the truth. Represent the platform accurately. Do not make promises you cannot keep.\n\nIf you make an honest mistake, you will get a chance to fix it.\n\nIf you intentionally deceive people, you will lose the relationship.\n\nEvery affiliate who holds this standard makes My Perfect Meals stronger for everyone — including themselves.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m8q1",
          question: "Which of the following is explicitly prohibited under My Perfect Meals affiliate standards?",
          options: [
            "Sharing a personal story about using the platform",
            "Explaining how the meal builder works",
            "Guaranteeing a client will lose a specific amount of weight",
            "Using approved brand assets in a social post",
          ],
          correctIndex: 2,
          explanation: "Guaranteeing weight loss, disease reversal, or specific health outcomes is explicitly prohibited. Affiliates may share their personal experiences and explain how the platform works, but they may never guarantee outcomes.",
        },
        {
          id: "m8q2",
          question: "An affiliate posts a video making misleading claims about the platform. It is their first violation. What happens next?",
          options: [
            "Immediate termination without notice",
            "A written notice identifying the issue and a defined timeframe to correct or remove the content",
            "Nothing — first violations are ignored",
            "Suspension of commissions for 12 months",
          ],
          correctIndex: 1,
          explanation: "On a first violation, My Perfect Meals provides written notice identifying the issue and gives the affiliate a defined timeframe to correct or remove the non-compliant content. This is a one-time opportunity to fix an honest mistake.",
        },
        {
          id: "m8q3",
          question: "Which situation would result in immediate termination without a corrective period?",
          options: [
            "Accidentally using an outdated price in a post",
            "Sharing the platform without using official brand assets",
            "Intentional fraud or unauthorized medical claims",
            "Posting about the platform without prior approval",
          ],
          correctIndex: 2,
          explanation: "Fraud, intentional deception, and unauthorized medical claims are immediate termination offenses. There is no corrective period for intentional misconduct. Accidental errors — like an outdated price — would follow the standard first-violation process.",
        },
        {
          id: "m8q4",
          question: "Why do My Perfect Meals brand standards prohibit false urgency and artificial scarcity tactics?",
          options: [
            "Because they are difficult to implement correctly",
            "Because they violate advertising platform policies",
            "Because they are manipulative — and many platform users are managing serious health challenges and deserve honest information",
            "Because they only work for physical product businesses",
          ],
          correctIndex: 2,
          explanation: "Many My Perfect Meals users are managing diabetes, metabolic conditions, oncology support needs, and other real health challenges. They deserve to be told the truth. Manipulative marketing tactics exploit people who are already vulnerable. That is why the standards exist.",
        },
        {
          id: "m8q5",
          question: "By participating in the My Perfect Meals affiliate program, what does an affiliate agree to?",
          options: [
            "Only the specific rules listed at the time of sign-up",
            "Marketing guidelines as they existed when they first joined, but not future updates",
            "All current and future brand, compliance, and marketing standards established by My Perfect Meals",
            "A fixed set of marketing rules that cannot be updated without their consent",
          ],
          correctIndex: 2,
          explanation: "Participation in the affiliate program constitutes agreement to follow all current and future brand, compliance, and marketing standards established by My Perfect Meals. Affiliates are expected to stay informed and maintain compliance as the brand evolves.",
        },
      ],
    },
  },
  {
    id: "final-assessment",
    title: "Final Assessment",
    description: "Comprehensive assessment covering all seven modules. Passing score: 80%.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Final Assessment",
        text: "Congratulations on completing the My Perfect Meals Business Success Certification Course.\n\nThis assessment is designed to verify that you understand the principles, philosophy, systems, and expectations required to represent My Perfect Meals professionally.\n\nThe purpose is not to trick you. The purpose is to ensure that you understand how the platform works, how clients think, and how My Perfect Meals should be presented to the public.\n\nMinimum passing score: 80%.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "fq1",
          question: "Which tool or capability is available to Coaching Affiliates but NOT to Referral Affiliates?",
          options: [
            "Sharing the platform on social media",
            "Referring new users to the platform",
            "ProCare, Client Dashboards, and Compliance Monitoring",
            "Explaining what My Perfect Meals is and does",
          ],
          correctIndex: 2,
          explanation: "Coaching Affiliates work directly with clients and use professional tools like ProCare, Client Dashboards, and Compliance Monitoring. Referral Affiliates introduce people to the platform without managing ongoing coaching relationships.",
        },
        {
          id: "fq2",
          question: "A new affiliate has no formal background in nutrition. According to the certification, what does this mean for their ability to succeed?",
          options: [
            "They cannot coach clients without nutrition credentials",
            "They must partner with a licensed nutritionist to support their clients",
            "They will need to complete nutrition coursework before onboarding any clients",
            "My Perfect Meals was designed so professionals do not need to be nutrition experts — the platform handles the technical complexity",
          ],
          correctIndex: 3,
          explanation: "The platform was designed specifically so professionals can succeed without being nutrition experts. It handles meal generation, macro calculation, medical protocols, and dietary alignment automatically — allowing coaches to focus on people, not formulas.",
        },
        {
          id: "fq3",
          question: "According to the My Perfect Meals system, why do most people fail at nutrition programs?",
          options: [
            "They don't have access to quality food options",
            "They lack enough information about nutrition",
            "They struggle with consistency and behavior — not knowledge",
            "Their meal plans are not specific enough",
          ],
          correctIndex: 2,
          explanation: "Most people already know what healthy eating looks like. The failure point is not knowledge — it is behavioral consistency. My Perfect Meals was built to address the compliance and behavior gap that traditional nutrition programs do not solve.",
        },
        {
          id: "fq4",
          question: "An experienced coach hears a client say: 'I'll try My Perfect Meals for 30 days.' What does this signal?",
          options: [
            "Full confidence and genuine commitment to the process",
            "One foot out the door — this person is treating it like another temporary experiment, not a lifestyle commitment",
            "A clear understanding of how the platform works",
            "Strong intrinsic motivation to succeed long-term",
          ],
          correctIndex: 1,
          explanation: "Language like 'I'll try it' or 'for 30 days' signals someone who is testing, not committing. They have likely attempted other programs before. An experienced coach hears this and understands the real work is helping this person move from experimentation to genuine commitment.",
        },
        {
          id: "fq5",
          question: "A client's weight trend is moving in the wrong direction despite claiming full compliance. What should the coach investigate first?",
          options: [
            "Whether to immediately change the meal plan",
            "Whether the client needs to add a gym membership",
            "Whether to recommend supplements",
            "Whether the actual compliance data in the platform matches what the client is reporting",
          ],
          correctIndex: 3,
          explanation: "Good coaching is data-driven. Before changing the plan or making assumptions, the coach should verify whether the compliance data — what the platform actually recorded — aligns with what the client says they are doing. The data tells the story.",
        },
        {
          id: "fq6",
          question: "What is the coach's primary role within the My Perfect Meals Coaching System?",
          options: [
            "Recipe creator and meal planner",
            "Nutrition calculator and macro manager",
            "Behavior coach, accountability partner, and human support system",
            "Software administrator and technical support",
          ],
          correctIndex: 2,
          explanation: "The platform handles the technical nutrition work. The coach's primary role is human — helping clients change behavior, stay consistent, recover from setbacks, and feel supported through the process.",
        },
        {
          id: "fq7",
          question: "According to My Perfect Meals, why do most clients struggle even when they already know what healthy eating looks like?",
          options: [
            "They don't have access to quality ingredients",
            "Their macro targets are set too high",
            "They lack more detailed or complex meal plans",
            "The problem is not knowledge — it is implementation and behavioral consistency",
          ],
          correctIndex: 3,
          explanation: "Knowledge is rarely the missing ingredient. Most clients have tried diets, read articles, and watched videos. What they struggle with is applying what they know consistently in real life — which is exactly what the MPM system is designed to support.",
        },
        {
          id: "fq8",
          question: "A client eats emotionally on Thursday, feels ashamed on Friday, severely restricts food through the weekend, becomes frustrated, and overeats on Monday. What does this pattern represent?",
          options: [
            "Normal nutritional fluctuation across the week",
            "The compliance reset cycle",
            "The motivation loop",
            "The guilt cycle",
          ],
          correctIndex: 3,
          explanation: "This is the guilt cycle — a self-reinforcing pattern of emotional eating, guilt, restriction, frustration, and overeating. Coaches who recognize this cycle can help clients address the emotional root of their food struggles rather than simply adjusting the meal plan.",
        },
        {
          id: "fq9",
          question: "A client needs to lose approximately 80 pounds but tells you they only want to lose 20. What is the most likely explanation?",
          options: [
            "They do not understand how weight loss works",
            "They are trying to avoid accountability",
            "They are choosing a goal that feels safe because they have succeeded there before and fear failing at a bigger target",
            "They are simply not motivated to achieve more",
          ],
          correctIndex: 2,
          explanation: "Clients often choose goals they believe they can safely reach. This is usually fear of failure, not lack of ambition. They remember a version of themselves that felt achievable — and they are protecting themselves from another disappointment. A skilled coach helps them build confidence in the process and lets the results expand from there.",
        },
        {
          id: "fq10",
          question: "A new client loves pizza, tacos, burgers, and fast food. What should a professional do first?",
          options: [
            "Tell them to eliminate fast food before starting the program",
            "Create a strict whole-foods meal plan and explain why their current diet must change",
            "Build nutrition strategies around the foods they already enjoy, using the platform to align those meals with their goals",
            "Refer them to a registered dietitian before beginning",
          ],
          correctIndex: 2,
          explanation: "Forcing clients into a completely new way of eating creates resistance and reduces compliance. The platform can work with the foods clients already enjoy. Starting where the client is — not where a perfect plan would have them be — is what creates lasting behavior change.",
        },
        {
          id: "fq11",
          question: "A client asks about fat burners, detox programs, cayenne pepper, fasting protocols, and multiple other weight loss shortcuts. During the same conversation, they say they are only willing to try a structured nutrition program for 30 days. What is the most important coaching insight?",
          options: [
            "The client needs more nutrition education",
            "The client has not found the right diet yet",
            "The client is focused on obtaining the outcome while avoiding the behavior changes required to create it",
            "The client needs a more restrictive meal plan",
          ],
          correctIndex: 2,
          explanation: "Many clients are not searching for a better process. They are searching for a way around the process. Effective coaches learn to recognize when someone wants the result but has not yet committed to the behaviors required to achieve it. The 30-day ceiling on a structured program — while placing no time limit on gimmicks that never worked — reveals exactly where the client's commitment actually stands.",
        },
        {
          id: "fq12",
          question: "What is the key difference between someone who 'wants to lose weight' and someone who 'wants the weight off'?",
          options: [
            "There is no meaningful difference — both want the same outcome",
            "Someone who wants the weight off is focused on short-term results; the other is focused on long-term",
            "Someone who wants the weight off is ready to commit to the full process; someone who just 'wants to lose weight' is still looking for a way to get the result without embracing the work",
            "Someone who wants to lose weight is more internally motivated",
          ],
          correctIndex: 2,
          explanation: "This is one of the most important distinctions in coaching. Most people want the result. Far fewer want the process. Someone who wants the weight off has accepted the consistency, discomfort, and patience required. Coaches who can identify which stage a client is in can meet them where they are — rather than pushing a program before the person is truly ready.",
        },
        {
          id: "fq13",
          question: "According to the final module, what is the most common reason people fail in business — not lack of talent, but what?",
          options: [
            "Starting before they are fully prepared",
            "Choosing the wrong target market",
            "They stop — posting, learning, communicating, following up, and believing",
            "Not investing enough in paid advertising",
          ],
          correctIndex: 2,
          explanation: "Most people do not fail because they lack talent or the right opportunity. They fail because they stop. Consistent action — even imperfect action — over time is what builds a real business. Waiting for motivation is a strategy that does not work.",
        },
        {
          id: "fq14",
          question: "A potential business partner says: 'I love this — I'll probably join next month when things slow down.' What does this reflect?",
          options: [
            "A strong and thoughtful commitment to the opportunity",
            "A well-planned, cautious approach to business decisions",
            "Interest, not commitment — commitment requires action now, not waiting for a perfect moment",
            "An appropriate level of research before making a decision",
          ],
          correctIndex: 2,
          explanation: "Things rarely slow down. 'Next month' is how people stay interested but never committed. Commitment looks like completing onboarding, learning the system, and taking action — even when the timing is not perfect. Coaches and affiliates who build real businesses are the ones who start before they feel completely ready.",
        },
        {
          id: "fq15",
          question: "Why does My Perfect Meals require certification before approving affiliates and business partners?",
          options: [
            "To collect licensing fees and generate platform revenue",
            "To identify serious, committed professionals who are willing to invest time learning the system correctly",
            "To make the onboarding process as difficult as possible",
            "To limit the total number of affiliates on the platform",
          ],
          correctIndex: 1,
          explanation: "Certification is a filter — not a barrier. If someone is unwilling to invest time learning how the system works, they are unlikely to invest the effort required to build a real business. The certification identifies the people who are serious, committed, and ready to represent the brand correctly.",
        },
      ],
    },
  },
];

export function getModuleById(moduleId: string): CertificationModule | undefined {
  return AFFILIATE_MODULES.find((m) => m.id === moduleId);
}

export function getModuleIndex(moduleId: string): number {
  return AFFILIATE_MODULES.findIndex((m) => m.id === moduleId);
}

export function getNextModuleId(moduleId: string): string | null {
  const idx = getModuleIndex(moduleId);
  if (idx === -1 || idx >= AFFILIATE_MODULES.length - 1) return null;
  return AFFILIATE_MODULES[idx + 1].id;
}

export function getPrevModuleId(moduleId: string): string | null {
  const idx = getModuleIndex(moduleId);
  if (idx <= 0) return null;
  return AFFILIATE_MODULES[idx - 1].id;
}
