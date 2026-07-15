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
    title: "What is My Perfect Meals?",
    description: "A practical introduction to the platform — what it does, who it serves, and what your role looks like.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "My Perfect Meals is an AI-powered nutrition platform that helps people eat better without overhauling their entire lives.\n\nThe platform generates personalized meals, recipes, snacks, beverages, and shopping lists — adapted to each person's goals, health conditions, dietary preferences, and real-world lifestyle.\n\nBefore you can share it effectively, you need to understand what it actually does.",
      },
      {
        heading: "Who Uses My Perfect Meals",
        text: "The platform is designed for a wide range of people, including:",
        list: [
          "People trying to lose weight or improve body composition",
          "People managing diabetes, heart disease, or metabolic conditions",
          "People on GLP-1 medications who need nutrition support",
          "Athletes optimizing performance nutrition",
          "People who simply want better eating habits without constant meal planning",
          "Families trying to eat healthier together",
        ],
      },
      {
        heading: "There Are Two Types of Affiliates",
        text: "Not everyone who joins My Perfect Meals serves the same function. Understanding which type you are determines how you use the system.\n\nCoaching Affiliates work directly with clients. Examples include personal trainers, nutrition coaches, dietitians, nurse practitioners, and health coaches. They use tools like ProCare, client dashboards, biometrics, meal builders, and progress tracking.\n\nReferral Affiliates do not provide nutrition coaching. Examples include life coaches, business owners, influencers, content creators, and existing users. Their role is to understand the platform, explain it clearly, and refer potential users.",
      },
      {
        heading: "What the Platform Does for Users",
        text: "When a user signs up, the platform collects detailed information about them — goals, health conditions, dietary restrictions, cuisine preferences, food allergies, lifestyle, and more. From that profile, it generates:",
        list: [
          "Personalized macro targets based on their goals and body metrics",
          "Meal recommendations tailored to their preferences and restrictions",
          "Full recipes with ingredients and instructions",
          "Snacks, beverages, and desserts they can actually enjoy",
          "Restaurant guidance so eating out doesn't derail progress",
          "A weekly meal board they can plan and follow",
          "A shopping list based on their selected meals",
        ],
      },
      {
        heading: "What the Platform Does NOT Do",
        text: "My Perfect Meals is a nutrition tool, not a medical provider. It does not diagnose conditions, prescribe treatments, or replace clinical care. It also does not replace the human relationship between a coach and a client. It makes that relationship more effective.",
      },
      {
        heading: "Your Job as an Affiliate",
        text: "Your job is not to become a nutrition expert. The platform handles the nutrition mechanics.\n\nYour job is to:\n\n1. Understand the platform well enough to explain it clearly.\n2. Identify people who would benefit from it.\n3. Connect them to the solution — whether you coach them directly or simply refer them.\n\nThe best affiliates are not the ones who know the most about nutrition. They are the ones who understand the people they are talking to.",
      },
      {
        heading: "Key Takeaway",
        text: "My Perfect Meals helps real people eat better in real life — without demanding perfection or eliminating the foods they love.\n\nCoaching Affiliates use the platform to guide clients. Referral Affiliates use it to introduce people to a solution.\n\nUnderstanding which role you play is the foundation of everything else in this certification.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m1q1",
          question: "A personal trainer wants to help clients improve their nutrition between sessions. Based on this module, which affiliate type does this describe?",
          options: [
            "Referral Affiliate — they are only introducing people to the platform",
            "Coaching Affiliate — they work directly with clients and would use tools like ProCare and client dashboards",
            "Neither — personal trainers are not permitted to use nutrition platforms",
            "Referral Affiliate — nutrition is outside the scope of personal training",
          ],
          correctIndex: 1,
          explanation: "A personal trainer working directly with clients on nutrition is a Coaching Affiliate. This role uses tools like ProCare, meal builders, biometrics, and client dashboards to guide clients through the platform.",
        },
        {
          id: "m1q2",
          question: "A friend asks you what My Perfect Meals actually does. Which answer best reflects what you learned in this module?",
          options: [
            "It is a calorie tracking app that counts everything you eat",
            "It is a meal kit delivery service that ships food to your door",
            "It is an AI nutrition platform that generates personalized meals, recipes, and shopping lists adapted to each person's goals, health conditions, and lifestyle",
            "It is a fitness app that creates workout plans and meal timing schedules",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals is an AI-powered nutrition platform that generates personalized meals, recipes, snacks, beverages, shopping lists, and restaurant guidance — all adapted to each person's specific goals, health conditions, dietary preferences, and lifestyle.",
        },
        {
          id: "m1q3",
          question: "Someone with type 2 diabetes wants to improve their eating habits but feels overwhelmed by nutrition information. According to this module, is this person a good candidate for the platform?",
          options: [
            "No — the platform is only for healthy people trying to lose weight",
            "Yes — the platform is designed for people managing conditions like diabetes and adapts meals to their specific needs",
            "No — people with medical conditions should only use clinically supervised meal plans",
            "Only if they are already using medication to manage their condition",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals is specifically designed for people managing conditions like diabetes, heart disease, and metabolic conditions. The platform adapts meal recommendations to their health profile — this is one of its core use cases.",
        },
        {
          id: "m1q4",
          question: "A content creator with 50,000 followers wants to earn affiliate income by sharing My Perfect Meals with their audience. They have no interest in coaching anyone directly. Which role fits them?",
          options: [
            "Coaching Affiliate — all affiliates are expected to coach clients",
            "Neither role — affiliate partners must be licensed health professionals",
            "Referral Affiliate — their role is to understand the platform, explain it clearly, and refer potential users",
            "Coaching Affiliate — content creators always coach through their content",
          ],
          correctIndex: 2,
          explanation: "A Referral Affiliate's role is to understand the platform, share it effectively, and refer people. They are not expected to coach clients, create meal plans, or adjust macros. A content creator fits this role perfectly.",
        },
        {
          id: "m1q5",
          question: "According to this module, what is the most important quality of an effective affiliate — regardless of whether they are a Coaching or Referral Affiliate?",
          options: [
            "Deep knowledge of nutrition science and macro calculations",
            "A large social media following",
            "Understanding the people they are talking to and connecting them to the right solution",
            "Experience working in a clinical health setting",
          ],
          correctIndex: 2,
          explanation: "The best affiliates are not the ones who know the most about nutrition. They are the ones who understand the people they are talking to. Knowing your audience — their frustrations, goals, and challenges — is what makes explaining and sharing the platform effective.",
        },
      ],
    },
  },
  {
    id: "module-2",
    title: "How the Platform Works",
    description: "A practical walkthrough of the key features users and coaches interact with every day.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "To explain My Perfect Meals to someone else, you need to understand how it actually works.\n\nThis module walks through the core features of the platform from a practical standpoint — not theory, but the real tools users and coaches interact with every day.",
      },
      {
        heading: "Step 1: Onboarding",
        text: "When a new user signs up, the platform guides them through a detailed onboarding process. This collects information used to personalize everything.\n\nOnboarding captures:",
        list: [
          "Goals (weight loss, muscle building, maintenance, health management, etc.)",
          "Current weight, height, age, and activity level",
          "Medical conditions (diabetes, heart disease, PCOS, oncology support, etc.)",
          "Dietary identity (omnivore, vegetarian, vegan, keto, gluten-free, etc.)",
          "Food allergies and hard restrictions",
          "Cuisine preferences (Italian, Mexican, Asian, Southern, etc.)",
          "Lifestyle preferences (meal prep style, cooking skill, family situation, etc.)",
        ],
      },
      {
        heading: "Step 2: The Macro Calculator",
        text: "After onboarding, the platform calculates personalized macro targets — daily goals for calories, protein, carbohydrates, and fat.\n\nThese targets are based on the user's body metrics, goals, and activity level. For most users, the generated targets are a strong starting point that can be followed without any adjustments.\n\nCoaches have the ability to view and adjust macro targets, but should only do so after reviewing compliance, progress, and outcomes — not immediately when a client starts.",
      },
      {
        heading: "Step 3: Meal Builders",
        text: "The meal builders are the core of the user experience. Users can generate meals through multiple entry points:",
        list: [
          "Create a Dish — builds a complete meal around any ingredient or craving",
          "Chef's Kitchen — a guided experience that walks through a full meal creation",
          "Fridge Rescue — generates a meal using ingredients the user already has at home",
          "Snack Creator — generates on-target snacks based on remaining macros",
          "Beverage Creator — creates drinks and smoothies within their nutrition targets",
          "Craving Creator — helps satisfy a craving while staying close to their goals",
          "Recipe Scan — the user photographs or enters a recipe and the platform adapts it",
          "Meal Planner — plans multiple meals across a week or specific time window",
        ],
      },
      {
        heading: "Step 4: The Weekly Meal Board",
        text: "The Weekly Board is where users organize their meal plan for the week. Each day of the week has slots for breakfast, lunch, dinner, and snacks.\n\nUsers can add generated meals to the board, rearrange them, and plan ahead. Coaches with ProCare access can view and interact with a client's board to monitor what they are eating and how planned meals align with their macro targets.",
      },
      {
        heading: "Step 5: The Shopping List",
        text: "When a user adds meals to their board, the platform automatically generates a shopping list based on the ingredients required. Items can be checked off as they are purchased, and the list can be shared or exported.\n\nThis removes one of the most common friction points in nutrition — knowing what to buy.",
      },
      {
        heading: "Step 6: The Restaurant Guide",
        text: "The Restaurant Guide helps users make better choices when eating out — one of the most common reasons people fall off track.\n\nUsers enter a restaurant or cuisine type, and the platform provides guidance on menu options that align with their macro targets and dietary preferences. This makes real-world eating a supported part of the plan, not a failure.",
      },
      {
        heading: "Step 7: Favorites and Recipe Scan",
        text: "When users find meals they love, they can save them as Favorites. Saved meals can be added back to the board quickly without regenerating.\n\nRecipe Scan allows users to take any recipe — from a website, a cookbook, or a family tradition — and have the platform adapt it to better fit their nutrition targets and restrictions.",
      },
      {
        heading: "Key Takeaway",
        text: "The platform is designed to support every real-world eating scenario — cooking at home, eating at restaurants, craving something specific, or rescuing leftovers from the fridge.\n\nOnce you understand these tools, you can explain the platform confidently to anyone — and help coaches use it effectively with their clients.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m2q1",
          question: "A new user finishes onboarding and wants to know why the platform asked so many questions about their health conditions, food preferences, and lifestyle. What is the correct explanation?",
          options: [
            "The questions are required for legal compliance purposes only and do not affect the platform experience",
            "The onboarding information is used to personalize everything — macro targets, meal recommendations, restaurant guidance, and dietary adaptations",
            "The platform uses the same meal plan for everyone but adjusts the portion sizes based on weight",
            "The questions help the platform connect users with a registered dietitian for a custom plan",
          ],
          correctIndex: 1,
          explanation: "Onboarding data is the foundation of personalization. Goals, health conditions, dietary identity, allergies, cuisine preferences, and lifestyle all feed into macro calculations, meal generation, restaurant guidance, and clinical adaptations. The more accurate the profile, the better the results.",
        },
        {
          id: "m2q2",
          question: "A client opens their fridge and sees leftover chicken, bell peppers, and black beans. They want to make something for dinner without going to the store. Which platform feature is designed for this exact situation?",
          options: [
            "Recipe Scan — to photograph the ingredients and find a match online",
            "Chef's Kitchen — to walk through a guided meal experience",
            "Fridge Rescue — to generate a meal using ingredients already on hand",
            "Craving Creator — to identify what the client is in the mood for",
          ],
          correctIndex: 2,
          explanation: "Fridge Rescue is designed specifically for situations where a user wants to build a meal from ingredients they already have. They enter what's available, and the platform generates a complete meal that aligns with their nutrition targets.",
        },
        {
          id: "m2q3",
          question: "A coach just connected a new client to the platform. The client's macro targets were auto-generated during onboarding. The coach wants to change the targets immediately. According to this module, what is the appropriate approach?",
          options: [
            "Adjust the targets right away — the coach always knows better than the algorithm",
            "Do not adjust targets until after reviewing the client's compliance, progress, and outcomes over time",
            "Delete the auto-generated targets and build new ones from scratch during the first session",
            "Ask the client what targets they prefer and enter those instead",
          ],
          correctIndex: 1,
          explanation: "The Macro Calculator provides a strong personalized starting point. Coaches should not adjust targets immediately just because they have access to the controls. Changes should follow a review of compliance, progress, weight trends, body composition, and overall outcomes.",
        },
        {
          id: "m2q4",
          question: "A user is going out to dinner at an Italian restaurant and is worried about staying on track. Which feature is designed to help them navigate this situation?",
          options: [
            "Meal Planner — to pre-log the restaurant meal in advance",
            "Recipe Scan — to scan the restaurant's menu items",
            "Restaurant Guide — to get guidance on menu options aligned with their macro targets and preferences",
            "Snack Creator — to eat a snack before going so they eat less at the restaurant",
          ],
          correctIndex: 2,
          explanation: "The Restaurant Guide is specifically designed for eating out. Users enter a restaurant or cuisine type and receive guidance on menu options that align with their nutrition targets and dietary preferences — making restaurant meals a supported part of the plan.",
        },
        {
          id: "m2q5",
          question: "A client finds a family lasagna recipe they want to keep using, but it doesn't fit their current macro targets. Which platform feature is best suited to help?",
          options: [
            "Fridge Rescue — to rebuild the recipe from available ingredients",
            "Create a Dish — to generate a new lasagna from scratch",
            "Recipe Scan — to enter or photograph the recipe and have the platform adapt it to their nutrition targets",
            "Favorites — to save the existing recipe without any changes",
          ],
          correctIndex: 2,
          explanation: "Recipe Scan allows users to take any existing recipe — from a website, a cookbook, or a family tradition — and have the platform adapt it to better fit their macro targets and dietary restrictions. The user keeps eating what they love, just in a version that supports their goals.",
        },
      ],
    },
  },
  {
    id: "module-3",
    title: "Adaptive Nutrition",
    description: "How My Perfect Meals personalizes nutrition for real life — and why adaptation is more effective than restriction.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "Most traditional nutrition programs share a common flaw: they were designed around ideal conditions.\n\nThey assume people will follow instructions perfectly. They assume food choices will always be optimal. They assume life won't get in the way.\n\nReal life doesn't work like that.\n\nMy Perfect Meals was built around a different principle: the most effective nutrition system is not the most restrictive one — it is the one a person can actually follow.",
      },
      {
        heading: "What Adaptive Nutrition Means",
        text: "Adaptive Nutrition means the platform tailors recommendations to each person individually — not just their goals, but the full picture of who they are and how they live.\n\nThis includes:",
        list: [
          "Medical conditions that require specific dietary protocols",
          "Dietary identity and personal food philosophies",
          "Cultural and cuisine preferences they grew up with",
          "Food allergies and hard restrictions",
          "Lifestyle factors like cooking ability, family situation, and schedule",
          "Behavioral patterns around food",
        ],
      },
      {
        heading: "The Four-Layer Hierarchy",
        text: "When generating meals, the platform follows a strict priority order to resolve conflicts between different needs.\n\nLayer 1 — Medical: Clinical safety always comes first. If a user has diabetes, cardiac concerns, oncology support needs, or is on GLP-1 medication, the platform enforces appropriate dietary guardrails automatically.\n\nLayer 2 — Dietary Identity: The user's core dietary philosophy (vegetarian, vegan, keto, paleo, etc.) shapes what types of foods and meal structures are generated.\n\nLayer 3 — Cultural and Cuisine: Preferences for specific cuisines (Italian, Mexican, Southern, Asian, etc.) are applied within the boundaries of their health and dietary identity.\n\nLayer 4 — Behavioral: Personal preferences, comfort foods, spice tolerance, meal size, and similar factors are the most flexible layer — they adapt continuously.",
      },
      {
        heading: "Why Medical Always Comes First",
        text: "A user's personal preferences never override clinical safety. This is not negotiable.\n\nIf a user with kidney disease requests high-protein meals, the platform will not generate them. If a user on a cardiac protocol requests high-sodium foods, the platform will not comply — even if the user selects those preferences.\n\nThis automatic enforcement is one of the reasons professionals trust My Perfect Meals with clients who have serious health conditions.",
      },
      {
        heading: "Working With Real Life, Not Against It",
        text: "Many nutrition programs create conflict with real life — special foods, complicated prep, restricted restaurants, family meals that feel impossible.\n\nMy Perfect Meals takes the opposite approach. Instead of asking what a person must give up, the platform asks how to help them eat better versions of what they already enjoy.\n\nA person who loves tacos still gets tacos. Someone who eats at fast food restaurants gets guidance on better choices at those restaurants. Someone who hates cooking gets quick, simple meals that require minimal prep.",
      },
      {
        heading: "Consistency Is the Goal",
        text: "The strongest nutrition system is not the one with the most restrictions. It is the one a person can follow day after day, week after week.\n\nA plan followed consistently at 80% will almost always outperform a technically perfect plan followed for two weeks before being abandoned.\n\nAdaptive Nutrition exists to make consistency achievable — not by lowering standards, but by removing friction.",
      },
      {
        heading: "The Role of the Coach in Adaptive Nutrition",
        text: "When a coach understands the adaptive framework, they stop trying to manually override everything and start using the platform the way it was designed.\n\nThe platform handles nutrition complexity automatically. The coach focuses on understanding the person — their habits, triggers, schedule, and emotional relationship with food — and uses that understanding to guide the platform's personalization more accurately.",
      },
      {
        heading: "Key Takeaway",
        text: "Adaptive Nutrition is the reason My Perfect Meals works for such a wide range of people. The platform does not force people into a single nutrition philosophy. It meets people where they are and builds a plan around their real life.\n\nMedical safety is non-negotiable. Everything else adapts.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m3q1",
          question: "A user with heart disease sets up their profile and selects high-sodium cuisine preferences. According to the adaptive nutrition hierarchy, what happens?",
          options: [
            "The platform generates high-sodium meals because user preferences are respected above all else",
            "The platform asks the user to consult a physician before generating any meals",
            "Medical guardrails take priority — the platform enforces cardiac-appropriate dietary parameters regardless of the user's stated cuisine preferences",
            "The platform generates two meal options: one that follows cardiac guidelines and one that matches the user's preference",
          ],
          correctIndex: 2,
          explanation: "Medical needs sit at Layer 1 of the adaptive hierarchy and always override lower layers. A user's cuisine preferences are Layer 3. When there is a conflict, the platform enforces clinical safety automatically — user preferences never override medical guardrails.",
        },
        {
          id: "m3q2",
          question: "A coach is working with a vegan client who loves Mexican food and is managing prediabetes. In what order does the platform apply these factors when generating meals?",
          options: [
            "Mexican cuisine first, then vegan, then prediabetes management",
            "Prediabetes management first, then vegan dietary identity, then Mexican cuisine preferences",
            "Vegan dietary identity first, then prediabetes, then Mexican cuisine",
            "All three factors are weighted equally and averaged together",
          ],
          correctIndex: 1,
          explanation: "The four-layer hierarchy is: (1) Medical, (2) Dietary Identity, (3) Cultural/Cuisine, (4) Behavioral. Prediabetes is a medical condition and takes Layer 1 priority. Vegan is a dietary identity at Layer 2. Mexican cuisine preference is Layer 3. The platform applies them in that order.",
        },
        {
          id: "m3q3",
          question: "A client tells their coach they hate cooking and can't follow complicated meal plans. According to the adaptive nutrition model, how should the coach respond?",
          options: [
            "Tell the client they need to develop better cooking skills to make progress",
            "Switch the client to a pre-made meal delivery service instead",
            "Recognize this as a behavioral preference the platform can accommodate — and configure the platform to generate quick, simple meals that require minimal prep",
            "Accept that this client is not a good fit for the platform",
          ],
          correctIndex: 2,
          explanation: "Lifestyle factors like cooking ability are a Layer 4 behavioral preference — and the most flexible part of the adaptive system. The platform can generate simple, quick meals that require minimal prep. Coaches should configure the platform to work with the client's real situation, not demand the client change to fit the plan.",
        },
        {
          id: "m3q4",
          question: "Why does My Perfect Meals focus on consistency rather than demanding perfect adherence?",
          options: [
            "Because most users are not capable of following a strict plan",
            "Because consistent adherence at a sustainable level will almost always outperform a perfect plan that gets abandoned after a few weeks",
            "Because the platform cannot generate meals that are healthy enough to require strict adherence",
            "Because consistency only matters for weight loss, not for other health goals",
          ],
          correctIndex: 1,
          explanation: "Adaptive Nutrition exists to make consistency achievable. A plan followed at 80% consistency over months will outperform a technically perfect plan followed for two weeks. The platform removes friction — not standards — so people can sustain progress over time.",
        },
        {
          id: "m3q5",
          question: "A referral affiliate is explaining the platform to a potential user who says: 'I love pasta, pizza, and Mexican food — I could never follow a diet.' What is the most accurate response based on adaptive nutrition principles?",
          options: [
            "'You're right — this platform works best for people who are already eating healthy.'",
            "'The platform would require you to give up pasta and pizza, but Mexican food is fine in moderation.'",
            "'My Perfect Meals works with foods you already enjoy — it generates better versions of those meals that fit your nutrition targets, rather than eliminating them.'",
            "'Pasta and pizza are not compatible with any nutrition program, but the platform can help with other foods.'",
          ],
          correctIndex: 2,
          explanation: "Adaptive Nutrition works with preferences, not against them. The goal is not eliminating what people love — it is helping them eat better versions of those foods. This principle is central to the My Perfect Meals approach and is what separates it from traditional restrictive diet programs.",
        },
      ],
    },
  },
  {
    id: "module-4",
    title: "Marketing MPM",
    description: "How to explain and share My Perfect Meals effectively — and the standards every affiliate must follow.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "There is a common misunderstanding about what marketing actually is.\n\nMany people think marketing means convincing people to buy something.\n\nIt doesn't.\n\nMarketing is helping people understand that a solution exists for a problem they are already experiencing. The purpose is education, trust, and awareness — not pressure.\n\nThis philosophy shapes everything about how My Perfect Meals expects affiliates to represent the platform.",
      },
      {
        heading: "Start With the Problem, Not the Product",
        text: "People rarely take action because of features. They take action because they are frustrated. They are experiencing pain.\n\nCommon pain points that lead people to My Perfect Meals:",
        list: [
          "Feeling out of control around food",
          "Spending hours trying to plan meals each week",
          "Falling off track every time they eat at a restaurant",
          "Managing a health condition and not knowing what to eat",
          "Trying dozens of diets without lasting results",
          "Feeling guilty after eating certain foods",
          "Wanting to eat healthier but not knowing where to start",
        ],
        tip: "Never promise an outcome you cannot guarantee. Promise the experience — not the result.",
      },
      {
        heading: "Education-First Marketing",
        text: "The most effective way to share My Perfect Meals is to educate people about the specific problem the platform solves.\n\nInstead of: 'Sign up for My Perfect Meals today!' \n\nTry: 'If you've ever struggled to stay on track when eating out, there's a restaurant guide inside the platform that gives you macro-aligned options at almost any restaurant.'\n\nThe second message addresses a real experience. It makes a specific promise. It creates relevance before asking for anything.",
      },
      {
        heading: "What You Can Say",
        text: "When sharing My Perfect Meals, affiliates may accurately describe what the platform does:",
        list: [
          "It generates personalized meals, recipes, and shopping lists",
          "It adapts to medical conditions, dietary preferences, and food restrictions",
          "It provides restaurant guidance for eating out",
          "It includes tools for tracking macros, planning meals, and supporting consistency",
          "It supports users managing specific conditions like diabetes, inflammation, or GLP-1 medication use",
          "You can share your personal experience using the platform",
        ],
      },
      {
        heading: "What You Cannot Say",
        text: "My Perfect Meals affiliates are prohibited from:",
        list: [
          "Guaranteeing weight loss, disease reversal, or specific health outcomes",
          "Making medical claims the platform has not authorized",
          "Using false urgency, artificial scarcity, or misleading countdown offers",
          "Misrepresenting the platform's features, pricing, or capabilities",
          "Using shame-based, fear-based, or manipulative messaging",
          "Representing themselves as medical professionals unless properly licensed and authorized",
        ],
      },
      {
        heading: "Why We Don't Use Weight-Loss Hype",
        text: "My Perfect Meals is not a weight-loss program. Weight loss may occur. So may weight gain (for those building muscle), body recomposition, or improved lab values.\n\nThe platform exists to improve nutrition, behavior, consistency, and food decisions — not to guarantee a specific outcome.\n\nSlogans like 'Lose 20 pounds in 30 days!' have two problems: they create skepticism because people have heard them thousands of times, and they promise something the platform cannot guarantee for every individual.",
      },
      {
        heading: "Brand Accountability",
        text: "Every affiliate represents the My Perfect Meals brand. How you market — in person, on social media, through email, or in videos — either builds the brand or damages it.\n\nFirst violation: Written notice and an opportunity to correct or remove non-compliant content.\n\nContinued or serious violations: Suspension of affiliate privileges, removal of commissions, or permanent termination from the program.\n\nImmediate termination (no corrective period): Fraud, intentional deception, unauthorized medical claims, or conduct that endangers users.",
      },
      {
        heading: "Key Takeaway",
        text: "Effective marketing is honest, specific, and grounded in a real problem the audience is experiencing.\n\nEducate before you promote. Build trust before you ask for action. Represent the platform accurately — including what it does and what it does not guarantee.\n\nAffiliate marketing that follows this model creates referrals that last. Hype-based marketing creates refunds.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m4q1",
          question: "An affiliate creates a post that says: 'My Perfect Meals will help you lose 30 pounds in 60 days — guaranteed!' Which affiliate standard does this violate?",
          options: [
            "None — this is an acceptable and effective way to share the platform",
            "It violates the prohibition on guaranteeing specific weight loss outcomes",
            "It only violates brand standards if the affiliate used the platform logo without permission",
            "It is acceptable as long as the affiliate personally lost 30 pounds using the platform",
          ],
          correctIndex: 1,
          explanation: "Affiliates are explicitly prohibited from guaranteeing weight loss, disease reversal, or specific health outcomes. The platform improves nutrition and consistency — outcomes vary by individual. Even if the affiliate personally achieved this result, they cannot guarantee it for others.",
        },
        {
          id: "m4q2",
          question: "You are explaining My Perfect Meals to a potential user who manages type 2 diabetes. Which message best reflects the education-first approach?",
          options: [
            "'Sign up today — limited spots available before the price goes up.'",
            "'My Perfect Meals can cure diabetes if you follow the meal plan consistently.'",
            "'If managing blood sugar makes it hard to know what to eat, the platform generates meals adapted to your specific condition and adjusts recommendations as your goals change.'",
            "'Every diabetic I know who tried this platform was able to stop taking medication within 3 months.'",
          ],
          correctIndex: 2,
          explanation: "Education-first marketing addresses a real pain point (managing blood sugar, knowing what to eat) and accurately describes what the platform does (generates meals adapted to their condition). It makes no false urgency claims, no cure claims, and no guarantees — it builds relevance and trust.",
        },
        {
          id: "m4q3",
          question: "A first-time affiliate posts a video containing a misleading feature claim about the platform. This is their first violation. What is the consequence according to the brand accountability process?",
          options: [
            "Immediate termination from the affiliate program",
            "A written notice identifying the issue and a defined timeframe to correct or remove the content",
            "A 12-month suspension of affiliate commissions",
            "No consequence for a first violation — only repeat violations are addressed",
          ],
          correctIndex: 1,
          explanation: "The first violation process gives affiliates a chance to fix honest mistakes. They receive written notice identifying the specific issue and a defined timeframe to correct or remove the non-compliant content. Immediate termination is reserved for fraud, intentional deception, and unauthorized medical claims.",
        },
        {
          id: "m4q4",
          question: "Why does My Perfect Meals advise against traditional weight-loss marketing messages like 'Lose 10 pounds fast' or 'Melt belly fat in 30 days'?",
          options: [
            "Because those messages are too expensive to advertise on social platforms",
            "Because they only work for people who are already in good physical condition",
            "Because most people have seen these claims many times, many have already failed with similar promises, and the messages create skepticism rather than trust",
            "Because weight loss is not a supported goal on the platform",
          ],
          correctIndex: 2,
          explanation: "Outcome-based hype marketing has been overused in the health industry. Most people have already tried multiple programs promising quick results. These messages create skepticism — not trust. My Perfect Meals marketing is designed to build genuine trust through education and accurate representation.",
        },
        {
          id: "m4q5",
          question: "A potential user asks an affiliate: 'Does this platform work for people who eat out a lot? I travel every week for work.' Which response is both accurate and effective?",
          options: [
            "'The platform only works well if you cook at home at least 5 days per week.'",
            "'Yes — there is a Restaurant Guide built into the platform that provides macro-aligned guidance for eating out at almost any restaurant, which makes it especially useful for frequent travelers.'",
            "'Restaurant eating is a known obstacle — you might want to wait until your travel schedule slows down.'",
            "'It works for eating out, but results will not be as good as for people who meal prep at home.'",
          ],
          correctIndex: 1,
          explanation: "The Restaurant Guide is a real, specific platform feature designed for exactly this use case. Mentioning it by name, describing what it does, and connecting it to the person's specific situation is education-first marketing at its best — accurate, relevant, and useful.",
        },
      ],
    },
  },
  {
    id: "module-5",
    title: "Working With Clients",
    description: "How coaching professionals use My Perfect Meals to support clients from onboarding through ongoing management.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "Coaching Affiliates use My Perfect Meals differently than Referral Affiliates.\n\nThey are not just sharing the platform — they are using it as the infrastructure for a professional coaching practice.\n\nThis module walks through how coaches set up clients, monitor their progress, communicate effectively, and use the platform's tools to guide better outcomes.",
      },
      {
        heading: "Step 1: The ProCare Dashboard",
        text: "ProCare is the professional coaching hub inside My Perfect Meals. It gives coaches access to the tools they need to manage client relationships.\n\nFrom the ProCare dashboard, coaches can:\n\n• Send client invitations\n• View all connected clients\n• Monitor client progress and compliance\n• Access client meal boards, biometrics, and notes\n• Communicate with clients\n• Assign builders and create meal content for clients",
      },
      {
        heading: "Step 2: Inviting and Connecting Clients",
        text: "Before a coach can access any client information, the client must accept an invitation.\n\nThe process is:\n\n1. The coach sends an invitation from the ProCare dashboard.\n2. The client receives the invitation (by email or link).\n3. The client accepts — this connects them to the coach's studio.\n4. The coach now has access to the client's folder.\n\nNo information is visible before the client accepts. This protects client privacy and ensures informed consent.",
      },
      {
        heading: "Step 3: The Client Folder",
        text: "Once a client is connected, their Client Folder becomes the coach's primary workspace for that client.\n\nThe folder contains:",
        list: [
          "Profile and onboarding data",
          "Macro targets and nutrition goals",
          "Meal board (current and historical)",
          "Biometrics and body composition data",
          "Compliance and tracking history",
          "Provider Notes",
          "Communication tools",
        ],
      },
      {
        heading: "Step 4: Provider Notes",
        text: "Provider Notes are one of the most valuable tools in the platform — and one of the most underused.\n\nProvider Notes allow coaches to document information about the client that the platform can use to personalize meal generation further. This includes:\n\n• Foods the client loves\n• Foods the client refuses to eat\n• Family eating habits and meal prep constraints\n• Work and travel schedules\n• Stress triggers and emotional eating patterns\n• Previous dieting history\n• Progress milestones and notable events\n\nA coach who documents this information thoroughly gives every meal generation a better starting point — and builds a coaching relationship that feels personal, not transactional.",
      },
      {
        heading: "Step 5: Using the Weekly Board as a Coaching Tool",
        text: "The Weekly Meal Board is not just a planning tool for users — it is a window into the coaching relationship.\n\nCoaches can view what a client has planned, what they have actually eaten, and how closely their actual intake aligns with their targets. This data replaces guesswork with evidence.\n\nGood coaching questions to ask based on the board:\n\n• 'I noticed you planned dinner for Monday but nothing was logged — what happened?'\n• 'Your breakfast choices this week were very consistent — what made that easier?'\n• 'You logged three restaurant meals this week — were you able to use the Restaurant Guide?'",
      },
      {
        heading: "Step 6: Compliance Before Adjustments",
        text: "The most common mistake coaches make is adjusting macro targets or meal plans before understanding compliance.\n\nIf a client is not seeing results, the first question should never be 'Do the targets need to change?' The first question should be 'Is the client following the current plan?'\n\nCompliance tells you whether the plan is being tested. A plan that isn't being followed hasn't failed — it hasn't been tried.\n\nReview compliance data, ask about barriers, and address behavioral obstacles before making changes to the nutrition strategy.",
      },
      {
        heading: "Step 7: Coaching Is Behavior, Not Meal Planning",
        text: "The platform handles meal planning. The coach's most important work is behavior change.\n\nMost clients already know what healthy eating looks like. The challenge is consistency — and consistency is disrupted by stress, habits, emotions, schedule, and environment.\n\nThe coaches who produce the best outcomes are the ones who ask better questions, listen carefully, identify behavioral barriers early, and help clients stay in the process long enough for habits to form.",
      },
      {
        heading: "Key Takeaway",
        text: "Working with clients on My Perfect Meals follows a clear process: invite them, connect them, document their situation thoroughly, monitor compliance, and coach the person — not just the plan.\n\nThe platform handles the nutrition complexity. The coach handles the human complexity.\n\nWhen both work together effectively, clients achieve better results with less frustration.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m5q1",
          question: "A new coaching client has accepted their invitation and joined the studio. The coach wants to view the client's meal board and biometrics. Where do they access this information?",
          options: [
            "The coach cannot access client information — clients manage their own data independently",
            "The Client Folder, accessible from the ProCare dashboard after the client accepts the invitation",
            "The ProCare dashboard main screen, where all client data is displayed side by side",
            "A separate client portal that requires the coach to log in with the client's credentials",
          ],
          correctIndex: 1,
          explanation: "After a client accepts the invitation and connects to the studio, the Client Folder becomes the coach's primary workspace. It contains the client's profile, macro targets, meal board, biometrics, compliance history, and communication tools. No information is accessible before the client accepts the invitation.",
        },
        {
          id: "m5q2",
          question: "During an intake conversation, a client mentions they always eat out for lunch, hate cooking on weekdays, and refuse to give up their Friday night pizza tradition. What is the best use of this information?",
          options: [
            "Tell the client these habits will need to change before they can use the platform effectively",
            "Create a strict meal plan that avoids restaurants and pizza entirely to build better habits from the start",
            "Document all of it in Provider Notes so the platform can personalize meal generation around the client's real life, and configure the platform to work with these preferences",
            "Note that the client may not be ready to commit and suggest starting when their schedule is more cooperative",
          ],
          correctIndex: 2,
          explanation: "Provider Notes allow coaches to document exactly this kind of information — eating habits, schedule constraints, food preferences, and non-negotiables. Using Provider Notes to capture this and configure the platform accordingly is how coaches deliver personalized coaching at scale. The platform should adapt to the client, not the other way around.",
        },
        {
          id: "m5q3",
          question: "A client has been on the platform for three weeks and is not losing weight. The coach is considering lowering the client's calorie targets. What should the coach do first?",
          options: [
            "Lower the calorie targets immediately — the current targets are clearly not working",
            "Add a daily exercise requirement to accelerate results",
            "Check compliance data — determine whether the client is actually following the current plan before changing anything",
            "Switch the client to a different dietary protocol to create a new stimulus",
          ],
          correctIndex: 2,
          explanation: "Compliance must be evaluated before adjustments. A plan that isn't being followed hasn't failed — it hasn't been tested. If the client is not following the current targets, changing the targets doesn't address the real problem. The coach should first understand what barriers are preventing compliance, then decide whether an adjustment is warranted.",
        },
        {
          id: "m5q4",
          question: "A coach notices that a client planned meals for every day this week but only logged entries on two days. What is the most useful coaching response?",
          options: [
            "Reduce the client's meal plan complexity so there are fewer things to log",
            "Use the board data as a conversation starter — ask the client directly what happened on the days they didn't log, and listen for behavioral barriers",
            "Assume the client is not serious and reduce the coaching attention allocated to them",
            "Delete the unlogged days from the board and start fresh next week",
          ],
          correctIndex: 1,
          explanation: "The Weekly Board shows coaches what was planned versus what was actually logged. This is data, not judgment. A coach who uses the board as a conversation starter — asking what happened on the unlogged days — is likely to uncover real behavioral barriers like stress, schedule disruption, or social situations. That information is what drives effective coaching.",
        },
        {
          id: "m5q5",
          question: "What is the correct sequence for connecting a new client to a coach's studio on My Perfect Meals?",
          options: [
            "Client creates a profile → coach finds them in search → coach adds them to the studio → client is automatically connected",
            "Coach sends an invitation → client receives and accepts it → client is connected to the studio → coach gains access to the client folder",
            "Client requests to join the studio → coach reviews and approves the request → client completes a questionnaire → coaching begins",
            "Coach purchases a client seat → enters client contact information → platform automatically creates the client's account and connects them",
          ],
          correctIndex: 1,
          explanation: "The connection process is: (1) coach sends an invitation from ProCare, (2) client receives the invitation, (3) client accepts — which connects them to the studio, (4) coach can now access the client's folder. No client information is visible before acceptance. This sequence ensures informed consent and protects client privacy.",
        },
      ],
    },
  },
];

export const COACHING_MODULES: CertificationModule[] = [
  {
    id: "coaching-module-1",
    title: "The My Perfect Meals Philosophy",
    description: "Why My Perfect Meals exists — and why understanding that changes every coaching conversation you'll ever have.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "The Problem with Nutrition Advice Today",
        text: "Most people aren't uninformed about nutrition. They're overwhelmed by it.\n\nOne source says keto. Another says vegan. Another says carnivore. Another says intermittent fasting. Another says just count calories. And every few months, something that was supposed to be true turns out to be wrong.\n\nThe problem isn't that people don't care. The problem is that they don't know what's true — and they don't know which advice applies to them specifically.\n\nThat's the environment your clients are living in. Before you explain what My Perfect Meals does, you need to understand the problem it was designed to solve.",
      },
      {
        heading: "We're Not Building Another Diet",
        text: "My Perfect Meals is not a diet.\n\nIt doesn't tell everyone to eat keto. It doesn't require you to go vegan. It doesn't hand you a 30-day plan and tell you to follow it.\n\nMost nutrition products give everyone the same answer and ask them to fit their life into it. My Perfect Meals asks a different question first: Who are you?\n\nYour goals. Your health conditions. Your medications. Your dietary identity. Your allergies. Your preferences. Your lifestyle. The restaurants near you. The foods you actually enjoy.\n\nAnd then it builds around that.",
      },
      {
        heading: "The Central Message",
        text: "Here is the sentence that defines everything about My Perfect Meals:\n\n\"We're not asking people to become nutrition experts. We're asking them to trust a system that already contains that expertise.\"\n\nThat's a different message than almost every other nutrition company.\n\nInstead of teaching users about protein absorption, glycemic index, or macro ratios — My Perfect Meals says: you don't need to know any of that. We've already built that knowledge into the system. Your job is to honestly tell the app who you are, and let it do what it was designed to do.\n\nPeople understand this immediately. And it immediately separates My Perfect Meals from everything else.",
      },
      {
        heading: "What the App Does — So You Don't Have To",
        text: "Every time a user generates a meal, the app is doing significant work behind the scenes:\n\nIt considers their primary health goal. It applies their medical conditions. It respects their dietary identity as an absolute boundary. It blocks their allergies. It incorporates their cuisine preferences. It accounts for their biometrics. It observes their patterns over time. It adapts restaurant recommendations to their profile. It remembers what they've asked for and what they've ignored.\n\nNone of that requires the user to understand nutrition science.\nNone of it requires the coach to calculate macros or design meal plans.\n\nThe system handles the expertise. The user handles the honesty. The coach handles the human side.",
      },
      {
        heading: "Your Role in the Philosophy",
        text: "Once you understand why My Perfect Meals exists, your role becomes clear.\n\nYou're not here to teach people about nutrition. The app does that.\nYou're not here to design meal plans. The app does that.\nYou're not here to police what someone eats. That's not coaching — that's control.\n\nYou're here to help people trust the process.\n\nWhen someone is confused, you explain. When someone is frustrated, you problem-solve. When someone is tempted to quit, you remind them what they're building. When someone is using the app in a way that's working against them, you help them use it better.\n\nThat's what a My Perfect Meals coach does.",
        tip: "The goal isn't to teach every user everything we know about nutrition. The goal is to build enough intelligence into My Perfect Meals that people can stop worrying about nutrition and start trusting the decisions the app helps them make.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "cm1q1",
          question: "What specific problem does My Perfect Meals exist to solve?",
          options: [
            "People lack access to affordable groceries.",
            "People are overwhelmed by conflicting nutrition advice and don't know what actually applies to their specific situation.",
            "People don't have enough healthy recipes to choose from.",
            "People eat too many processed foods and need a stricter diet.",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals wasn't built because people don't know what food is — it was built because they've heard too many conflicting answers and can't tell which one applies to them. Understanding that problem is what shapes everything about how you explain and coach the platform.",
        },
        {
          id: "cm1q2",
          question: "Which statement best captures the central message of My Perfect Meals?",
          options: [
            "We've built the most advanced calorie tracker available.",
            "We teach people the right way to eat so they never have to guess again.",
            "We're not asking people to become nutrition experts — we're asking them to trust a system that already contains that expertise.",
            "We provide a proven 90-day meal plan that works for everyone.",
          ],
          correctIndex: 2,
          explanation: "This is the single most important sentence in the My Perfect Meals philosophy. It explains why the platform is different: it doesn't ask users to learn nutrition science. It asks them to trust a system that has already done that work. Everything else follows from this.",
        },
        {
          id: "cm1q3",
          question: "A potential client says: \"I've tried every diet. Nothing sticks for me.\" Which response reflects the My Perfect Meals philosophy?",
          options: [
            "\"You probably haven't been disciplined enough. This app will help you stay accountable.\"",
            "\"Most diets fail because they ask you to follow a plan someone else built. My Perfect Meals works differently — it builds a plan around who you actually are.\"",
            "\"My Perfect Meals is a scientifically proven diet that gets results in 30 days.\"",
            "\"The problem is probably your consistency. Once you commit, this will work.\"",
          ],
          correctIndex: 1,
          explanation: "The philosophy-aligned response doesn't blame the person or promise a quick fix. It explains the real difference: My Perfect Meals doesn't hand everyone the same answer and ask them to conform. It starts with who the person is. That's the message that resonates with someone who has been let down before.",
        },
        {
          id: "cm1q4",
          question: "What is the coach's primary responsibility under the My Perfect Meals philosophy?",
          options: [
            "To calculate and verify clients' macro targets.",
            "To design personalized meal plans that override the app's recommendations.",
            "To help clients trust the process and use the app honestly.",
            "To teach clients about protein synthesis, glycemic load, and nutrient timing.",
          ],
          correctIndex: 2,
          explanation: "The app handles the nutrition science. The coach's job is not to replicate that work — it's to help people engage honestly with the system and trust that it's doing what it was designed to do. When clients are confused, frustrated, or tempted to quit, the coach is the human presence that keeps them moving.",
        },
        {
          id: "cm1q5",
          question: "My Perfect Meals is described as fundamentally different from traditional nutrition programs. What is that core difference?",
          options: [
            "It's cheaper than other nutrition apps on the market.",
            "It uses artificial intelligence, which other apps don't.",
            "Instead of giving everyone the same plan and asking them to conform, it starts with who the person actually is and builds around that.",
            "It doesn't require users to log their meals like other apps do.",
          ],
          correctIndex: 2,
          explanation: "Traditional nutrition programs hand everyone the same answer and ask them to fit into it. My Perfect Meals inverts this: it starts with the individual — their goals, conditions, preferences, and lifestyle — and builds around that. This distinction is the foundation of every coaching conversation you'll have.",
        },
      ],
    },
  },
  {
    id: "coaching-module-2",
    title: "How to Talk About My Perfect Meals",
    description: "How to explain what makes My Perfect Meals different — starting with the person in front of you, not the app.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Start With the Person, Not the App",
        text: "The most common mistake people make when sharing something they believe in is leading with features.\n\n\"It uses AI.\" \"It tracks macros.\" \"It has a restaurant feature.\"\n\nNone of those statements create connection. People don't care about features. They care about their problem.\n\nBefore you say a single word about My Perfect Meals, find out what's actually hard for the person in front of you. Ask questions. Listen. Let them tell you what they're dealing with.\n\nThen My Perfect Meals becomes the solution to their specific problem — not a product you're trying to sell.",
      },
      {
        heading: "The Three-Part Structure",
        text: "When you're ready to explain My Perfect Meals, use this structure:\n\n**Pain Zone → My Perfect Meals → Solution**\n\n**Pain Zone** is the specific struggle this person is experiencing. Not a generic problem — their problem. \"You mentioned you eat out constantly and feel like your nutrition falls apart every time.\" That's a Pain Zone.\n\n**My Perfect Meals** is why the app was built for exactly that. \"That's one of the things My Perfect Meals was designed for — it gives you personalized restaurant recommendations based on your goals and preferences, so eating out doesn't mean starting over.\"\n\n**Solution** is what changes when that problem is solved. \"Imagine never having to choose between your social life and your nutrition plan.\" That's the outcome they actually want.",
      },
      {
        heading: "Finding the Pain Zone",
        text: "Real problems create real connection. Here are conversation starters that work:\n\n\"How many times have you started over because life got busy?\"\n\n\"Have you ever been at a restaurant and felt like your whole nutrition plan fell apart?\"\n\n\"Wouldn't it be nice if there was something that could help you whether you're cooking at home, eating fast food, traveling, or celebrating a birthday?\"\n\n\"What's the hardest part of eating well for you right now?\"\n\nThese questions aren't manipulation — they're honest curiosity. When someone answers, you find out what they actually need. That's the basis of a real coaching conversation.",
      },
      {
        heading: "What to Avoid",
        text: "A few things that consistently kill My Perfect Meals conversations before they start:\n\n**Leading with features before the problem.** \"It uses AI\" means nothing to someone who doesn't yet care.\n\n**Overwhelming people with everything the app does.** Pick the one or two things that directly address what they just told you.\n\n**Using the word \"algorithm.\"** No one knows what to do with that in a conversation about food.\n\n**Talking price before value.** Once someone understands what changes for them, price becomes a much smaller conversation.\n\n**Explaining instead of asking.** The more you talk, the less you learn. Let them tell you what matters.",
      },
      {
        heading: "The Message That Separates My Perfect Meals",
        text: "If you take only one idea from this lesson into every conversation, make it this:\n\nMy Perfect Meals doesn't ask people to change who they are. It learns who they are and works with that.\n\nThat message is fundamentally different from every other nutrition product.\n\nMost nutrition programs hand people a plan and ask them to comply. My Perfect Meals asks: what do you like? What's your life actually like? What do you eat? What do you avoid? What are you dealing with medically?\n\nAnd then it builds a plan for that person.\n\nWhen you communicate that clearly, people lean in. Because most of them have been trying to fit themselves into someone else's plan — and it hasn't worked.",
        tip: "Personalization is the hardest thing to communicate and the most important. The simplest explanation: 'It's not a meal plan someone else built. It's built for you, using your goals, your health, your preferences, and the way you actually live.'",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "cm2q1",
          question: "A friend tells you: \"I eat out all the time. I travel constantly. I could never do a healthy eating program.\" What is the correct My Perfect Meals response?",
          options: [
            "\"Then this probably isn't the right time for you to start.\"",
            "\"My Perfect Meals actually has tools specifically for that — restaurant recommendations personalized to your goals, so eating out doesn't have to mean falling off track.\"",
            "\"You should try to cook more at home. This app will help with that.\"",
            "\"The app works best for people who have a more consistent home routine.\"",
          ],
          correctIndex: 1,
          explanation: "Eating out frequently isn't a disqualifier — it's a use case. My Perfect Meals is designed for real-world eating, including restaurants. The correct response turns what sounds like an obstacle into a reason the app was built for them specifically.",
        },
        {
          id: "cm2q2",
          question: "Which of these is the best opening for a My Perfect Meals conversation?",
          options: [
            "\"This app uses AI to track your macros and generate personalized meals based on your goals.\"",
            "\"How many times have you started a nutrition plan and then had to start over because life got in the way?\"",
            "\"My Perfect Meals is $14.99 a month and has a free trial period.\"",
            "\"It's an app for people who want to lose weight.\"",
          ],
          correctIndex: 1,
          explanation: "Starting with a problem creates connection. Starting with features or pricing creates sales resistance. The question about starting over resonates immediately because almost everyone has experienced it. It opens a real conversation rather than triggering a polite decline.",
        },
        {
          id: "cm2q3",
          question: "What does the framework Pain Zone → My Perfect Meals → Solution guide you to do?",
          options: [
            "Identify what's painful about the app experience, report it to support, and wait for a solution.",
            "Identify the person's specific struggle → connect it to why My Perfect Meals was built for exactly that → describe what changes when that problem is solved.",
            "Sell the three subscription tiers in sequence, starting with the free option.",
            "Follow a scripted three-step onboarding call with every new prospect.",
          ],
          correctIndex: 1,
          explanation: "The framework keeps your conversation grounded in the other person's experience. You're not presenting a product — you're connecting their real problem to a solution that was built for it. That's the difference between a pitch and a conversation.",
        },
        {
          id: "cm2q4",
          question: "Which of the following should you avoid when explaining My Perfect Meals to someone for the first time?",
          options: [
            "Asking what's currently hard for them.",
            "Sharing something the app does that directly addresses a problem they mentioned.",
            "Explaining the AI algorithms, macro science, and personalization engine in technical detail.",
            "Mentioning that the app adapts to their actual lifestyle.",
          ],
          correctIndex: 2,
          explanation: "Technical explanations create distance. People don't need to understand how the technology works — they need to understand what changes for them. Lead with the problem and the outcome. Save technical depth for the rare person who specifically asks for it.",
        },
        {
          id: "cm2q5",
          question: "What is the most important message to communicate about how My Perfect Meals works?",
          options: [
            "It has one of the largest food databases of any nutrition app.",
            "It was developed with input from certified dietitians and physicians.",
            "Unlike programs that hand everyone the same plan, My Perfect Meals learns who you actually are and builds around that.",
            "It integrates with most major fitness trackers and health platforms.",
          ],
          correctIndex: 2,
          explanation: "This is the message that separates My Perfect Meals from everything else. Most people have tried programs that handed them a fixed plan and asked them to fit into it. The idea that the plan is built for them — not for a generic user — is the message that makes people lean in.",
        },
      ],
    },
  },
  {
    id: "coaching-module-3",
    title: "Coaching the My Perfect Meals Way",
    description: "Understanding your real role as a coach — and the clear line between what the app handles and what you handle.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "What the App Handles",
        text: "My Perfect Meals was built to carry a significant load — and it does. Before you spend time worrying about what you're supposed to do as a coach, understand what you are not responsible for:\n\n**Nutrition science.** The app knows the nutritional properties of thousands of ingredients. You don't need to.\n\n**Macro calculations.** Every user's targets are calculated by the system based on their profile. You don't verify or adjust these.\n\n**Recipe adaptation.** If a user is keto, every generated meal is keto. If they're vegetarian, every meal is vegetarian. The system enforces this.\n\n**Allergy blocking.** Hard allergens are blocked at the system level. You don't track them manually.\n\n**Behavioral patterns over time.** The platform observes what users generate, save, and act on — and adapts accordingly.\n\nYour clients don't need you to manage any of this. The app does it.",
      },
      {
        heading: "What You Handle",
        text: "The app cannot call someone who is having a hard week.\nThe app cannot notice that someone is skipping every meal it generates.\nThe app cannot ask why someone keeps struggling on weekends.\nThe app cannot hear that a client is going through something difficult and adjust accordingly.\n\nThat's you.\n\nYour job is the human side of the coaching relationship:\n\n**Attention.** Noticing what the app can't see — emotional state, life circumstances, consistency patterns.\n\n**Questions.** Asking what's actually happening, not assuming.\n\n**Presence.** Being someone the client can be honest with about what's working and what isn't.\n\n**Accountability.** Following up. Checking in. Staying engaged.\n\nThe app does the nutrition. You do the coaching.",
      },
      {
        heading: "The Questions That Matter",
        text: "Effective My Perfect Meals coaching starts with behavioral questions — not nutritional ones.\n\n\"Are you actually eating the meals you generate?\"\n\"Are you enjoying what the app is making for you?\"\n\"What situations keep causing you to eat off-plan?\"\n\"Are you using the restaurant feature when you eat out?\"\n\"What happened last week when you didn't log anything?\"\n\"What's going on in your life right now that's making this harder?\"\n\nThese questions are not about macros. They're about reality.\n\nWhen you know what's actually happening in your client's life, you can actually help. When you only know their macro targets, you can't.",
      },
      {
        heading: "How a My Perfect Meals Coach Responds",
        text: "One of the clearest illustrations of the coaching philosophy is this scenario:\n\nA client says: \"I hate broccoli. Every meal I generate has broccoli in it.\"\n\nThe wrong response: \"Broccoli is high in fiber and very important for your goals. Try roasting it — you might like it better.\"\n\nThe right response: \"Great. Let's update your profile so it stops showing up. The app will still build everything correctly — it just won't use broccoli.\"\n\nThat's it.\n\nMy Perfect Meals can build a complete, nutritionally sound meal plan without a single ingredient the client dislikes. Your job is not to convince people to tolerate foods they hate. Your job is to help them use the app honestly — which means making sure their profile reflects who they actually are.\n\nWhen the profile is accurate, the meals are accurate. When the meals are accurate, people eat them.",
      },
      {
        heading: "The Coaching Philosophy in One Sentence",
        text: "Your job isn't to force people to follow a meal plan.\nYour job is to help them build one they'll actually follow.\n\nThat distinction is everything.\n\nA plan that someone will realistically follow — even if it's imperfect by some external standard — produces better outcomes than a technically perfect plan that sits ignored.\n\nMy Perfect Meals can adapt to almost any realistic lifestyle. Your job is to make sure the app knows who your client actually is. When it does, it builds something they'll genuinely use. That's where results come from.",
        tip: "The most effective thing you can do as a My Perfect Meals coach is make someone feel understood — not lectured. When people feel understood, they open up. When they open up, you find out what's actually getting in the way. When you know that, you can actually help.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "cm3q1",
          question: "Which of the following is the app's responsibility — NOT the coach's?",
          options: [
            "Noticing that a client hasn't logged a meal in three days.",
            "Calculating macro targets based on a client's goals, profile, and body composition.",
            "Understanding why a client keeps struggling on weekends.",
            "Recognizing that a client is emotionally stressed and eating off-plan.",
          ],
          correctIndex: 1,
          explanation: "Macro calculations are the app's job. Coaches do not verify or adjust these — the system handles that based on the client's profile. The coach's role is behavioral and relational: noticing patterns, asking the right questions, and helping clients use the app honestly.",
        },
        {
          id: "cm3q2",
          question: "A client says: \"I hate chicken. Every meal I generate has chicken in it.\" What is the correct coaching response?",
          options: [
            "\"Chicken is an excellent lean protein. Try a different preparation — you might like it more.\"",
            "\"Let's update your profile so chicken is excluded. The app will still generate nutritionally complete meals — it just won't use it.\"",
            "\"The app's recommendations are nutritionally optimized. I'd encourage you to follow them.\"",
            "\"I'll request a custom meal plan from the support team.\"",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals generates meals based on the profile. If a client keeps seeing an ingredient they dislike, the profile doesn't reflect who they are. Update the profile. The app will still build nutritionally sound meals — it simply won't use the disliked ingredient. The coach's job is to help clients use the app honestly, not to convince them to eat things they hate.",
        },
        {
          id: "cm3q3",
          question: "A client hasn't logged anything in five days. You reach out and they say: \"I was traveling.\" What is the most effective coaching response?",
          options: [
            "\"You need to stay consistent even while traveling. Skipping five days is a setback.\"",
            "\"That's okay — just start fresh today.\"",
            "\"Tell me about the trip — were you using the restaurant feature, or did you feel like you had no options while you were away?\"",
            "\"I'll reset your weekly targets to account for the missed days.\"",
          ],
          correctIndex: 2,
          explanation: "Effective coaching investigates what actually happened. Travel is a situation My Perfect Meals has tools for — restaurant recommendations, personalized to the client's profile. If those tools weren't used, the coach has an opportunity to close that gap. Judgment doesn't move anyone forward. Understanding does.",
        },
        {
          id: "cm3q4",
          question: "What does \"help them build a plan they'll actually follow\" mean in practice?",
          options: [
            "Allow clients to eat whatever they want as long as they feel good about it.",
            "Give clients a strict meal plan and hold them accountable to following it exactly.",
            "Ensure the client's profile accurately reflects their real lifestyle, preferences, and constraints — so the app generates meals they can genuinely sustain.",
            "Create custom meal plans using external tools that override the app's recommendations.",
          ],
          correctIndex: 2,
          explanation: "The philosophy isn't permissiveness — it's realism. A plan only works if a person will actually follow it. My Perfect Meals can adapt to almost any realistic lifestyle. The coach's job is to make sure the app knows who this person really is — not an idealized version of who they hope to become. When the profile is honest, the output is usable.",
        },
        {
          id: "cm3q5",
          question: "Which best describes the division of labor between the coach and My Perfect Meals?",
          options: [
            "The coach designs the nutrition plan; the app delivers it.",
            "The coach and app share equal responsibility for all aspects of a client's nutrition.",
            "The coach provides the nutrition expertise the app lacks, while the app tracks compliance.",
            "The app manages nutrition science, calculations, and personalization; the coach manages the human side — behavior, consistency, and real-life obstacles.",
          ],
          correctIndex: 3,
          explanation: "This is the core division of labor. The app doesn't need the coach to verify its nutrition recommendations — the system handles that. The coach brings what the app cannot: human presence, behavioral observation, empathy, and real-time responsiveness to what's happening in a client's life.",
        },
      ],
    },
  },
  {
    id: "coaching-module-4",
    title: "Building Trust",
    description: "How to represent My Perfect Meals honestly, set realistic expectations, and earn the trust that builds a lasting coaching practice.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Set Realistic Expectations From the Start",
        text: "Every coaching relationship starts with a set of expectations. Your job is to make sure those expectations are honest.\n\nMy Perfect Meals is a powerful personalized nutrition tool. It helps people make better food decisions consistently, over time. That's a real and meaningful benefit.\n\nIt does not guarantee specific weight loss by a specific date. It does not replace a physician or registered dietitian for medical conditions. It does not produce dramatic transformation in two weeks.\n\nWhat it does — consistent, personalized nutrition support over time — is genuinely valuable. And it's enough. You don't need to add anything to make it compelling.\n\nClients who enter the relationship with honest expectations stay. Clients who were promised something the platform couldn't deliver leave — and often say so publicly.",
      },
      {
        heading: "Represent My Perfect Meals Accurately",
        text: "There are things My Perfect Meals does and things it doesn't do. Know the difference, and never blur that line.\n\n**What it does:**\nGenerates personalized meals, snacks, beverages, and shopping lists. Adapts to goals, medical profiles, dietary identity, and lifestyle. Provides restaurant recommendations aligned to the user's profile. Tracks macros and nutrition over time. Supports clinical nutrition strategies for specific conditions.\n\n**What it doesn't do:**\nDiagnose or treat medical conditions. Replace a physician's care. Guarantee specific health outcomes. Provide emergency nutrition support.\n\nEvery claim you make creates an expectation. Claims you can stand behind build trust. Claims you can't eventually damage it — and your reputation along with it.",
      },
      {
        heading: "Never Overpromise Results",
        text: "The fastest way to lose a client's trust is to promise something the platform — or you — can't deliver.\n\nResults vary. Individual outcomes depend on many factors: starting point, adherence, health conditions, consistency, and more. The honest version of this conversation is also the more powerful one:\n\n\"My Perfect Meals is designed to help you make better food decisions, consistently, over time. That consistency is what produces real results — not a 30-day sprint.\"\n\nThat's true. And it resonates with anyone who has been let down by a dramatic promise before — which is most of the people you'll talk to.",
      },
      {
        heading: "Focus on Consistency, Not Quick Fixes",
        text: "People want fast results. That's human. And it's your job to gently redirect that toward something that will actually work.\n\nThe platform is designed for the long term. Position it that way.\n\nA client who achieves modest, real progress — and understands why — will stay, grow, and refer others. A client who expected dramatic results in two weeks and got steady improvement instead will feel disappointed, even if the steady improvement is exactly what was needed.\n\nYour job is to help clients understand what they're actually building: a sustainable relationship with food. That's worth more than a quick fix — and it lasts.",
      },
      {
        heading: "Trust Is Earned Through Results, Not Promises",
        text: "Your reputation as a coach is built one honest result at a time.\n\nWhen a client succeeds — even modestly — they talk about it. That word of mouth is worth more than any marketing campaign you'll ever run. When a client feels misled, they also talk about it.\n\nThe most powerful marketing tool you have is a client who genuinely improved their life and wants others to experience the same thing.\n\nYou build that by helping people honestly. By representing the platform accurately. By setting expectations they can realistically meet. By celebrating consistent progress.\n\nThat's not just ethics — it's strategy.",
        tip: "If you don't know the answer to a client's question, say so. 'I'm not sure — let me find out' builds more trust than a confident answer that turns out to be wrong.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "cm4q1",
          question: "A potential client asks: \"How much weight will I lose in the first month?\" What is the correct response?",
          options: [
            "\"Most users lose between 8 and 12 pounds in the first month.\"",
            "\"Results vary because every person's body, goals, and starting point are different. What I can tell you is that My Perfect Meals helps you make better food decisions consistently — and consistency is what produces real results over time.\"",
            "\"The app is scientifically proven to produce results within 30 days.\"",
            "\"You'll definitely see results. Everyone I've coached has.\"",
          ],
          correctIndex: 1,
          explanation: "Individual results vary significantly. Promising specific outcomes is both inaccurate and harmful to trust. The honest answer — that consistency produces results over time — is also the more resonant one for someone who has been let down by dramatic promises before.",
        },
        {
          id: "cm4q2",
          question: "Which of the following accurately represents what My Perfect Meals does?",
          options: [
            "\"This app will reverse your diabetes if you follow it correctly.\"",
            "\"My Perfect Meals is a personalized nutrition tool that helps you make better food decisions based on your goals, health profile, and real-life lifestyle — consistently, over time.\"",
            "\"Everyone who uses this app sees significant health improvement. It's guaranteed.\"",
            "\"This replaces the need to see a doctor or nutritionist.\"",
          ],
          correctIndex: 1,
          explanation: "Accurate representation describes what the app actually does: personalized nutrition support for better, more consistent food decisions. It doesn't make medical claims, guarantee outcomes, or overstate its role relative to healthcare professionals. Every claim you make sets an expectation — only make claims you can stand behind.",
        },
        {
          id: "cm4q3",
          question: "Why should coaches focus on consistency rather than quick results?",
          options: [
            "Quick results are physiologically unhealthy and should be avoided.",
            "Regulatory requirements prevent coaches from discussing rapid transformation.",
            "Clients who achieve real, consistent progress stay longer, trust more, and refer others — while clients who expected dramatic results and got steady improvement often feel disappointed and leave.",
            "My Perfect Meals is not optimized for rapid results at any timeline.",
          ],
          correctIndex: 2,
          explanation: "Focusing on consistency isn't just ethical — it's strategic. Clients who experience real, gradual progress understand what they're building and stick with it. Clients chasing quick fixes often quit when results slow down and blame the coach or product. The long-term relationship is built on honest, sustainable progress.",
        },
        {
          id: "cm4q4",
          question: "A client shows you a dramatic before/after photo they found online and asks: \"Will I get results like that?\" What is the appropriate coaching response?",
          options: [
            "\"Absolutely — those results are typical for people who commit to My Perfect Meals.\"",
            "\"Results like that are possible, but individual outcomes vary based on goals, starting point, consistency, and health factors. What I can tell you is what My Perfect Meals actually does and how to use it well.\"",
            "\"Those results are probably exaggerated. Don't compare yourself to that.\"",
            "\"That person worked with a coach. That's exactly why you're working with me.\"",
          ],
          correctIndex: 1,
          explanation: "You can't validate someone else's results as typical — because they're not. The honest response acknowledges that significant results are possible while setting accurate expectations. This protects both the client and the coaching relationship.",
        },
        {
          id: "cm4q5",
          question: "What is the most durable source of trust in a coaching relationship?",
          options: [
            "Sharing impressive credentials and professional certifications.",
            "Providing detailed nutrition science explanations that demonstrate expertise.",
            "Helping clients achieve genuine improvement — honestly, consistently, and without overpromising.",
            "Maintaining frequent social media presence that demonstrates coaching authority.",
          ],
          correctIndex: 2,
          explanation: "Trust is built through results, not promises or credentials. When someone's life genuinely improves, they trust the person who helped them get there. That trust is what generates referrals, longevity, and a coaching reputation that grows over time.",
        },
      ],
    },
  },
  {
    id: "coaching-module-5",
    title: "Growing Your Business",
    description: "Practical tools and the mindset for building a My Perfect Meals coaching practice — starting with one person.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Start With One",
        text: "The most common mistake new coaches make is trying to build a system before they have a client.\n\nThey want the perfect pitch, the polished social media presence, the professional website, the booking system, the intake forms — all before they've coached a single person.\n\nNone of that matters yet.\n\nStart with one person. Someone you know. Someone in your life who is struggling with nutrition right now. Offer to help them — not as a transaction, but as an act of coaching.\n\nHelp them honestly. Help them well. Let that be the foundation.\n\nOne real result — one person who says \"this actually worked for me\" — creates more momentum than the most polished launch you'll ever execute.",
      },
      {
        heading: "Where Your First Clients Come From",
        text: "Your first clients almost always come from your existing network. People who already know you, already trust you, and are more likely to take a chance on a new service.\n\n**Your personal network.** Who in your life is actively struggling with nutrition right now? That's your starting point.\n\n**Your existing professional relationships.** If you already work in a health, fitness, or wellness role, you already have a warm audience.\n\n**Your own visible results.** When people see that something is working for you, they ask. Have an honest answer ready.\n\n**Online communities.** Groups where your target audience spends time — fitness communities, health-focused forums, local Facebook groups. Be genuinely helpful there before you ever mention My Perfect Meals.",
      },
      {
        heading: "Using Your Affiliate Tools",
        text: "You have specific tools available to you as a My Perfect Meals affiliate coach. Use them.\n\n**Your promo code.** Share it with people who are genuinely interested. It gives them an incentive to try My Perfect Meals and ties their account to your affiliate record. Think of it as a gift, not a sales tactic.\n\n**The marketing library.** Monthly marketing resources are available to you — graphics, copy, and templates designed to be shared. Use them as-is or adapt them for your specific audience. You don't need to create everything from scratch.\n\n**Your affiliate dashboard.** This shows who has signed up through your link, what actions they've taken, and how your network is growing. Check it. Use it to understand what's working.",
      },
      {
        heading: "Building Referrals",
        text: "Referrals don't happen automatically. They happen when you ask — at the right moment, in the right way.\n\n**Ask at the right moment.** When a client shares good news — a milestone, a compliment, a week that finally clicked — that's your moment. \"Would you know anyone who might benefit from something like this?\"\n\n**Make it easy.** \"I have a promo code you can share with them — it gives them a discount to get started.\" One sentence. That's it.\n\n**Follow up once.** If a client mentioned someone who was interested, check back in a week. One follow-up often makes the difference between a warm lead and a converted one.\n\nReferrals aren't aggressive. They're a natural extension of something that's working. When your clients are genuinely succeeding, asking feels easy because you're offering something real.",
      },
      {
        heading: "Let Results Become Your Marketing",
        text: "Every successful client is a story.\n\nNot a case study. Not a testimonial you manufactured. A real person who experienced real improvement — and now talks about it because they want other people to experience the same thing.\n\nYou don't need to manufacture urgency. You don't need bold claims or transformation photos. You need to help people genuinely — and let that speak.\n\nMy Perfect Meals is growing. The coaching platform is expanding. Coaches who are excellent and honest now will be well-positioned as the network grows and the platform becomes better known.\n\nThe business you build through genuine results compounds over time. Every client who succeeds becomes a source of referrals. Every referral becomes a potential client. Every client who succeeds becomes another source.\n\nThat's the model. Start with one. Help them well. Everything else follows.",
        tip: "Don't wait until you have a perfect marketing plan or a fully built social presence. Start by helping one person. Everything else follows from that.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "cm5q1",
          question: "What is the most important thing a new My Perfect Meals coach should focus on first?",
          options: [
            "Building a social media following before taking on any clients.",
            "Designing a professional website, booking system, and intake forms.",
            "Helping one real person achieve genuine improvement — and letting that become the foundation everything else builds on.",
            "Completing every available certification before coaching anyone.",
          ],
          correctIndex: 2,
          explanation: "The foundation of a coaching business is a real result. Before systems, marketing, and social presence — you need one person whose life improved because of your coaching. That result is your proof of concept and your most powerful referral story. Everything else is easier once you have that.",
        },
        {
          id: "cm5q2",
          question: "A client tells you: \"I had a great week — I actually enjoyed what I was eating for the first time in years.\" What is the right coaching response?",
          options: [
            "\"Great! Keep it up.\"",
            "\"That's exactly what My Perfect Meals is designed to do — would you know anyone who might benefit from something like this? I have a promo code they can use to get started.\"",
            "\"That's just the beginning — wait until you see what happens at 90 days.\"",
            "\"Tell me about your macros this week.\"",
          ],
          correctIndex: 1,
          explanation: "Positive momentum is exactly the right moment to ask for a referral — naturally and without pressure. Offering your promo code makes it easy for the client to share. Referrals grow from real results. This is how.",
        },
        {
          id: "cm5q3",
          question: "What is the correct use of a My Perfect Meals promo code?",
          options: [
            "Post it publicly everywhere to maximize reach.",
            "Reserve it for clients who specifically ask for a discount.",
            "Share it with people who are genuinely interested — it gives them an incentive to try and ties their account to your affiliate record.",
            "Use it internally to unlock premium features for your existing clients.",
          ],
          correctIndex: 2,
          explanation: "Your promo code serves two purposes: it gives potential clients a reason to act, and it connects their account to your affiliate record. Share it with people who are genuinely curious — and frame it as a gift, not a tactic. That framing makes it far more effective.",
        },
        {
          id: "cm5q4",
          question: "A new coach asks: \"I have no clients yet. Where do I start?\" What is the best answer?",
          options: [
            "\"Build your social media presence first so people can find you.\"",
            "\"Get more certifications. The more credentials you have, the easier it is.\"",
            "\"Start with your existing network. Who in your life is struggling with nutrition right now? Offer to genuinely help them. One real result creates more momentum than any marketing launch.\"",
            "\"Focus on paid advertising — organic growth takes too long to build a real business.\"",
          ],
          correctIndex: 2,
          explanation: "The first client almost always comes from the coach's existing network. Someone who already knows and trusts you is more likely to take a chance on something new. Start by genuinely helping someone — not as a transaction, but as an act of coaching. A real result is the most powerful thing you can have.",
        },
        {
          id: "cm5q5",
          question: "Which statement best describes what \"let results become your marketing\" means in practice?",
          options: [
            "Collect client testimonials and run them as paid social media ads.",
            "Build a documented case study library for your website.",
            "Help clients achieve genuine improvement — and allow their authentic enthusiasm to generate referrals naturally, without manufactured urgency or bold claims.",
            "Ask every client to post about their progress on social media weekly.",
          ],
          correctIndex: 2,
          explanation: "Real results, honestly achieved, create authentic word-of-mouth. When someone's life genuinely improves, they talk about it without being prompted — and that unsolicited recommendation carries more credibility than any campaign. Your job is to produce the result. The marketing follows from that.",
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

export function getCoachingModuleById(moduleId: string): CertificationModule | undefined {
  return COACHING_MODULES.find((m) => m.id === moduleId);
}

export function getCoachingModuleIndex(moduleId: string): number {
  return COACHING_MODULES.findIndex((m) => m.id === moduleId);
}

export function getNextCoachingModuleId(moduleId: string): string | null {
  const idx = getCoachingModuleIndex(moduleId);
  if (idx === -1 || idx >= COACHING_MODULES.length - 1) return null;
  return COACHING_MODULES[idx + 1].id;
}

export function getPrevCoachingModuleId(moduleId: string): string | null {
  const idx = getCoachingModuleIndex(moduleId);
  if (idx <= 0) return null;
  return COACHING_MODULES[idx - 1].id;
}
