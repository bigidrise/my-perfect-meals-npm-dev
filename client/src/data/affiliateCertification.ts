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

// ─── MARKETING & COACHING CERTIFICATION ──────────────────────────────────────

export const MARKETING_COACHING_MODULES: CertificationModule[] = [
  {
    id: "marketing-module-1",
    title: "Building Your Brand",
    description: "How to position yourself as a nutrition professional before you ever open your mouth — and what it actually means to earn trust.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "You Are the Brand Before the Platform Is",
        text: "Before a prospect decides whether to try My Perfect Meals, they decide whether to trust you.\n\nThat's the order. Always.\n\nCredentials matter less than most coaches think in those early moments. What matters is whether the person in front of you feels like you understand their situation, like you're someone they could be honest with, like you've actually done the work to help people like them.\n\nYour brand isn't your logo or your social media feed. Your brand is the impression you leave every single time someone encounters you — in a conversation, in a post, in the way you follow up, in whether you show up consistently.\n\nThe platform becomes powerful once that trust is established. Until then, you're selling yourself first.",
      },
      {
        heading: "Who Do You Serve?",
        text: "Most new coaches try to reach everyone. That's the fastest way to reach no one.\n\nThe more specifically you can describe the person you help, the more that person will feel you're talking directly to them.\n\nInstead of: \"I help people improve their nutrition.\"\n\nTry: \"I work with people in their 40s and 50s who've tried every diet and need something that fits their real life.\"\n\nOr: \"I specialize in nutrition support for people managing Type 2 diabetes who want to feel normal around food again.\"\n\nThose sentences land differently. The person who fits them feels found — not marketed to.\n\nYour niche doesn't close doors. It opens the right ones.",
      },
      {
        heading: "Consistency Is the Only Strategy That Compounds",
        text: "Visibility in nutrition coaching is not built through viral moments. It's built through consistency over time.\n\nEvery time you show up — a post, a conversation, a follow-up, a check-in — you're making a deposit into a trust account. None of those deposits feel significant in the moment. The account balance only becomes visible after months.\n\nThis is why most coaches quit too early. They post for three weeks, don't see results, and conclude it isn't working. They were three months away from the compound effect starting to show.\n\nConsistency beats talent. Consistency beats strategy. Consistency is the only thing in coaching that reliably grows over time.",
        tip: "Your consistency is the proof you're selling. If a prospect scrolls your last 90 days and sees someone who showed up regularly, they already have evidence that you follow through. That's the brand.",
      },
      {
        heading: "Authenticity Beats Perfection",
        text: "The most polished coaches are not always the most trusted ones.\n\nPeople can sense when something has been over-manufactured. The perfectly lit photo, the perfectly scripted reel, the post that feels like a press release — these create distance, not connection.\n\nWhat creates connection is being a real person who has genuinely helped real people.\n\nYou don't need to pretend you know everything. You don't need a perfect before/after transformation story. You don't need a studio setup to record content.\n\nYou need to be consistently honest about what you do, what you know, and what your clients experience. That kind of authenticity is impossible to fake — and extremely hard to compete against.",
      },
      {
        heading: "What People Actually Buy",
        text: "When someone hires a nutrition coach, they are not buying a meal plan.\n\nThey are not buying macros. They are not buying a subscription to an app.\n\nThey are buying:\n\n**Confidence** — the belief that they can actually do this.\n**Hope** — that their situation can be different than it's been.\n**Accountability** — someone who will notice if they disappear.\n**Understanding** — a person who gets what their life actually looks like.\n**Solutions** — not theories, but something that will work for them specifically.\n\nMy Perfect Meals is an extraordinary tool for delivering all of those things. But the tool doesn't create the desire to buy. You do.\n\nUnderstand what your client is really asking for, and you'll never struggle to communicate your value.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "Your brand positioning should shape how you introduce My Perfect Meals to every client.\n\nIf you serve people who have failed at traditional diets, lead with the fact that My Perfect Meals doesn't give everyone the same plan — it builds around who the person actually is. That message directly addresses the reason previous diets didn't work.\n\nIf you serve people with medical conditions, lead with the clinical nutrition support the platform provides. Show how their profile — their actual medical context — is part of every meal generated.\n\nIf you serve busy professionals, lead with the restaurant feature and the simplicity of generation. They're not looking for a new thing to manage — they're looking for something that removes friction.\n\nThe same platform, positioned differently for each type of client. That's what a brand does.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm1q1",
          question: "When a person decides whether to hire a nutrition coach, what do they evaluate first?",
          options: [
            "The coach's certifications and credentials.",
            "Whether the tools and platform the coach uses are proven.",
            "Whether they trust the person in front of them.",
            "The pricing structure and what's included in each package.",
          ],
          correctIndex: 2,
          explanation: "Trust comes first. Always. Before credentials, before pricing, before platform features — the prospect is deciding whether this person understands them and whether they could be honest with them. Your brand is the impression you leave before the conversation about tools or packages ever starts.",
        },
        {
          id: "mm1q2",
          question: "Why is niche positioning more effective than trying to appeal to everyone?",
          options: [
            "Specialty coaching commands higher prices in every market.",
            "Speaking specifically to one person's real problem creates connection. Generic messaging creates distance.",
            "Broad messaging attracts too much volume to manage.",
            "Niche coaches face less competition on social media platforms.",
          ],
          correctIndex: 1,
          explanation: "When someone reads your positioning and feels like you're describing them — their specific situation, their specific frustration — they stop scrolling. Generic messaging about \"helping people improve their nutrition\" creates no connection because it doesn't feel personal to anyone. Specific positioning reaches fewer people and converts far more of them.",
        },
        {
          id: "mm1q3",
          question: "A new coach posts consistently for three weeks, sees no new clients, and stops. What principle did they violate?",
          options: [
            "Quality over quantity — fewer, better posts perform better.",
            "Consistency, which compounds over months, not weeks. Three weeks is not enough for trust to accumulate.",
            "Content personalization — posts need to be targeted by audience segment.",
            "Platform selection — the wrong platform may explain the lack of response.",
          ],
          correctIndex: 1,
          explanation: "Visibility in coaching is a long-game. Trust accumulates over months of consistent presence — three weeks barely registers. Most coaches quit just before the compound effect starts showing. The coaches who build practices are the ones who keep showing up when nothing visible is happening yet.",
        },
        {
          id: "mm1q4",
          question: "What does 'authenticity beats perfection' mean for a nutrition professional building a presence?",
          options: [
            "You can skip editing and quality standards since personality matters more than production.",
            "Real, honest content about actual results builds more durable trust than polished content that feels manufactured.",
            "Personal stories are always more effective than professional advice or clinical information.",
            "Credentials matter less than likability in nutrition coaching.",
          ],
          correctIndex: 1,
          explanation: "People can sense over-manufactured content. Perfectly scripted, perfectly lit, perfectly polished — it creates distance. Genuine content about real client experiences, real insights, real moments from your practice builds the kind of trust that polished content cannot replicate. Authenticity is a quality, not a substitute for quality.",
        },
        {
          id: "mm1q5",
          question: "When someone decides to invest in nutrition coaching, what are they actually paying for?",
          options: [
            "Macro calculations, meal plans, and a structured approach to eating.",
            "Access to nutrition science, a curated recipe database, and weekly assessments.",
            "Confidence, hope, accountability, understanding, and a solution that works for them specifically.",
            "A subscription to a personalized nutrition platform with coaching oversight.",
          ],
          correctIndex: 2,
          explanation: "Nobody buys a meal plan. They buy the feeling that their situation can change, that someone actually understands what they're dealing with, and that they won't be doing this alone. The meal plan, the macros, the app — those are the delivery mechanism. The real purchase is emotional. Understand that, and your value becomes impossible to understate.",
        },
      ],
    },
  },
  {
    id: "marketing-module-2",
    title: "Finding Your Clients",
    description: "Where clients actually come from — and why the coaches who quit too early never find out.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Social Media Works — But Only If You're Consistent",
        text: "Social media is the most misunderstood lead generation tool in coaching.\n\nMost coaches expect it to work fast. They post for a few weeks, don't see results, conclude it isn't working, and stop.\n\nSocial media is a trust-building mechanism, not a vending machine. When someone follows you for months and consistently sees you show up with useful, honest content, they begin to feel like they know you. That familiarity is what drives the inquiry — not any single post.\n\nThe math: a coach who posts three times a week for twelve months has shown up 150+ times for their audience. By that point, when someone in their network needs help, that coach is the first person they think of.\n\nConsistency isn't about the algorithm. It's about becoming the obvious answer before anyone asks the question.",
      },
      {
        heading: "Referrals Convert Better Than Cold Leads",
        text: "No lead source in coaching outperforms a genuine referral.\n\nHere's why: when someone refers a friend to you, they transfer their trust. The prospect arrives pre-convinced that you're credible, because someone they trust said so. That shortcut is worth more than any campaign you'll ever run.\n\nCold leads — people who discover you through a post or an ad without a personal connection — require you to build trust from scratch. Referrals let you skip most of that work.\n\nThe practical implication: your best marketing strategy is to do excellent work with the clients you already have. A client who genuinely improved their life will tell people. Often without being asked.",
        tip: "Ask for referrals at the right moment — when a client shares a win, a milestone, or something that clicked. 'Would you know anyone who might benefit from this?' That's the entire ask.",
      },
      {
        heading: "Networking Compounds Over Time",
        text: "Networking isn't about collecting contacts at events. It's about building a web of professional relationships that remember you when the right person shows up.\n\nA relationship with a primary care physician can send you a steady stream of patients managing metabolic conditions. A relationship with a personal trainer can generate clients who are training hard but eating poorly. A relationship with an HR director can lead to corporate wellness programs.\n\nThese relationships don't pay off immediately. They pay off over years — and they compound. A physician who's referred three clients to you will refer three more. The longer the relationship, the higher the volume.\n\nEvery relationship you build today is a potential client pipeline tomorrow. Treat every professional interaction accordingly.",
      },
      {
        heading: "Most Coaches Quit Too Early",
        text: "This is the most important thing in this module.\n\nThe coaches who fail don't fail because they lacked skill. They fail because they stopped before consistency had time to work.\n\nClient acquisition through content, referrals, and networking is slow in the beginning. The first 60 to 90 days almost always feel like nothing is happening. Most coaches interpret that silence as proof it isn't working — and they quit.\n\nThe coaches who keep going past that point almost universally find that something changes. A referral comes in. A post lands differently. A former contact reaches out. The compound interest starts paying dividends.\n\nThe hardest part of building a coaching practice is the gap between beginning and traction. The only way through it is consistency.",
      },
      {
        heading: "Content Builds Trust Before the First Conversation",
        text: "When someone considers reaching out to a coach, the first thing they do is look them up.\n\nWhat they find in those next five minutes determines whether they contact you. If they find consistent, useful, credible content over a long period, they arrive at the conversation already convinced you're legitimate.\n\nIf they find nothing — or three posts from eight months ago — they move on.\n\nContent doesn't need to be elaborate. A short, honest post about something you've observed in your clients. A practical tip someone can actually use. A question that makes someone stop and think about their own situation.\n\nDone consistently, that accumulates into a body of evidence that you are who you say you are.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "Every satisfied client in your My Perfect Meals practice is a referral asset.\n\nWhen a client sees results — better biometrics, meals they actually enjoy, a nutrition strategy that doesn't collapse on weekends — they tell people. Your job is to make sure they have the language to describe what changed and a simple way to help someone they care about get started.\n\nFor content, the most effective approach is specificity. A post about what happens when a real client updates their profile and suddenly gets meals they actually look forward to — that resonates more than a general post about personalized nutrition.\n\nThe platform gives you concrete things to point to: the restaurant feature, the biometric tracking, the clinical support. Use those specifics. Vague claims about 'personalized nutrition' are everywhere. Specific stories about specific outcomes are not.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm2q1",
          question: "Why do referrals convert at a higher rate than cold social media leads?",
          options: [
            "Referrals tend to have more disposable income and take health more seriously.",
            "Cold leads are usually not ready to invest — referrals are pre-qualified by their financial situation.",
            "The trust a mutual contact has in you transfers to the prospect before you've spoken a word. They arrive pre-convinced.",
            "Referral programs typically include a discount that cold leads don't receive.",
          ],
          correctIndex: 2,
          explanation: "Trust is the most valuable asset in coaching. Referrals arrive with it already established — someone the prospect respects told them you're worth talking to. Cold leads require you to build that trust from zero. That difference explains why referral conversion rates typically far exceed cold acquisition rates.",
        },
        {
          id: "mm2q2",
          question: "A coach has been posting consistently for two months with no new clients. What is the most accurate assessment?",
          options: [
            "The content quality isn't good enough — they need to redesign their approach.",
            "They're in the wrong niche — this market isn't profitable for coaching.",
            "This is normal. Content-driven client acquisition typically takes 6 to 12 months of consistent effort before it produces reliable results.",
            "They should switch platforms immediately — the audience isn't on this channel.",
          ],
          correctIndex: 2,
          explanation: "Two months of consistent posting is still early. Most coaches who successfully build a content-driven practice describe the same experience: months of showing up to apparent silence, followed by a tipping point where referrals, inquiries, and recognition start compounding. Quitting at two months means quitting before the investment has had time to pay off.",
        },
        {
          id: "mm2q3",
          question: "What does 'every satisfied client becomes a potential marketing asset' mean in practice?",
          options: [
            "Ask clients to post weekly progress photos on social media to generate organic visibility.",
            "Document client results and use them in paid advertising campaigns.",
            "A client whose life genuinely improved will tell others naturally — that authentic word-of-mouth carries more credibility than any campaign you could run.",
            "Offer satisfied clients a referral incentive program tied to their subscription discount.",
          ],
          correctIndex: 2,
          explanation: "The most powerful marketing in coaching has always been a real person telling a real person what changed for them. No ad budget buys that credibility. It comes from doing excellent work and creating the conditions where satisfied clients feel compelled to share — which happens naturally when the results are genuine.",
        },
        {
          id: "mm2q4",
          question: "Why does content build trust before the first conversation even happens?",
          options: [
            "Content with keywords improves search ranking so more people discover you organically.",
            "When someone has followed your content for weeks or months, they arrive at the first conversation already feeling like they know you — trust doesn't start from zero.",
            "Algorithmic distribution ensures your content reaches people at the exact moment they're ready to buy.",
            "Content demonstrates regulatory compliance and professional standing.",
          ],
          correctIndex: 1,
          explanation: "Content is a pre-frame. By the time someone reaches out to a coach whose content they've followed consistently, they've already decided they trust you — they're reaching out to confirm the fit, not to evaluate from scratch. That head start changes the entire nature of the first conversation.",
        },
        {
          id: "mm2q5",
          question: "What is the most common reason skilled coaches fail to build a client base?",
          options: [
            "Overpricing their services in a competitive market.",
            "Insufficient credentials or certifications for the clients they're trying to reach.",
            "They stop before consistency has time to compound — most quit in the first 60 to 90 days, just before traction begins.",
            "Choosing platforms with the wrong audience demographics.",
          ],
          correctIndex: 2,
          explanation: "The failure isn't usually skill — it's timing. Client acquisition through content and referrals is slow at the start and then accelerates. Most coaches experience the slow start, interpret it as failure, and stop just before the acceleration would have become visible. Persistence through the quiet period is the single most reliable predictor of coaching practice success.",
        },
      ],
    },
  },
  {
    id: "marketing-module-3",
    title: "Sales & Discovery Calls",
    description: "How to turn a conversation about someone's goals into a natural decision to work with you — without pressure, scripts, or tactics.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Don't Try to Sell My Perfect Meals. Tell Them About It.",
        text: "There is a fundamental difference between selling a product and helping someone understand whether it solves their problem.\n\nSelling puts the product at the center. The coach talks about features, explains the platform, describes the subscription tiers, and waits for the prospect to decide.\n\nTelling puts the person at the center. The coach asks questions, listens to what's actually hard, and then explains the specific ways My Perfect Meals addresses what they heard.\n\nThe same information lands completely differently depending on which frame it comes from.\n\nWhen you lead with the product, people feel sold to. When you lead with their problem and use the product to address it, people feel helped. Those are not the same experience — and they don't produce the same results.",
        tip: "If you find yourself explaining features before you've asked a single question, you've started in the wrong place. Features are answers. Find out the questions first.",
      },
      {
        heading: "The Discovery Call: Ask First, Talk Second",
        text: "A discovery call is not a pitch. It's a conversation designed to find out if there's a real fit.\n\nThe most effective discovery calls follow a simple structure:\n\n**Ask** — What's going on for this person right now? What have they tried? What got in the way before? What are they actually hoping to change?\n\n**Listen** — Not to form a response, but to understand. What are they really describing? What's the emotion underneath the stated problem?\n\n**Reflect** — Show them you understood. \"So it sounds like the biggest issue isn't that you don't know what to eat — it's that you can't stay consistent when work gets busy.\"\n\n**Help** — Now, if there's a fit, explain how My Perfect Meals and your coaching address what you heard. Not the whole platform. The parts that matter for this person.\n\nThat sequence changes the entire dynamic of the conversation.",
      },
      {
        heading: "Questions That Open Real Conversations",
        text: "The questions you ask determine the quality of the conversation you have.\n\nThese open conversations rather than closing them:\n\n\"How many times have you started a nutrition plan and had to start over because life got in the way?\"\n\n\"What's the part of eating well that consistently falls apart for you?\"\n\n\"If you could change one thing about your relationship with food, what would it be?\"\n\n\"Have you ever felt like a nutrition plan was working for someone else's life but not yours?\"\n\n\"What would it mean for you — practically, day to day — if this actually worked?\"\n\nNone of these are tricks. They're honest curiosity. When someone answers them, you find out what they actually need. That's the foundation of everything that follows.",
      },
      {
        heading: "Help People Decide. Don't Push Them.",
        text: "Pressure closes deals and kills relationships.\n\nA prospect who feels pressured into signing up arrives with resentment instead of commitment. They're less likely to engage honestly, less likely to do the work, and more likely to blame you when things get hard.\n\nThe goal of a discovery call is not to get a yes at all costs. It's to help a person understand whether this is genuinely the right thing for them right now — and to help them make that decision with clarity.\n\nWhen you operate from that frame, something interesting happens: the people who say yes are genuinely ready. And genuine readiness produces better outcomes, more engagement, and more referrals than any conversion tactic ever will.\n\nHelp people decide. Don't decide for them.",
      },
      {
        heading: "What to Do When They Say No",
        text: "\"No\" in a discovery call is almost always \"not yet.\"\n\nSomething isn't quite right — the timing, the price, the readiness, the trust level. Your job is to understand which one without making the person feel interrogated.\n\n\"I completely understand. Can I ask — is there anything specific that made this feel like not the right fit right now?\"\n\nThat one question, asked without defensiveness, tells you everything. Sometimes the answer changes the conversation. Sometimes it confirms the no. Either way, you've handled it with professionalism — which means that person remembers you well when the timing does change.\n\nThe coaching practices with the most referrals are the ones that treat no's with the same care as yes's.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "The discovery call is where My Perfect Meals becomes a solution instead of a product.\n\nOnce you understand what's actually hard for this person, you can be specific. If they mention that eating out always derails their progress, show them the restaurant feature — not as a feature, but as the direct answer to what they just said.\n\nIf they mention that every plan they've tried treated them like a generic person, walk them through the onboarding. Show them how their medical conditions, their allergies, their cuisine preferences, and their lifestyle all become the inputs — not constraints on a standard plan, but the building blocks of something made for them.\n\nYou're not demonstrating software. You're showing someone their problem has a specific solution. That's an entirely different conversation.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm3q1",
          question: "What is the most important thing to do at the start of a discovery call?",
          options: [
            "Present your credentials and explain your coaching philosophy before anything else.",
            "Walk through the pricing options so the prospect can make an informed financial decision.",
            "Ask questions and genuinely listen — understand what this specific person is dealing with before you say a word about your services.",
            "Show a demonstration of My Perfect Meals to establish the platform's credibility.",
          ],
          correctIndex: 2,
          explanation: "The discovery call is a conversation, not a presentation. Before you can help someone understand whether My Perfect Meals and your coaching solves their problem, you need to know what their problem actually is. Features and pricing are answers. Ask the questions first.",
        },
        {
          id: "mm3q2",
          question: "A prospect says 'I need to think about it.' What is the most effective coaching response?",
          options: [
            "'If you don't decide this week, the price may change.'",
            "'Totally understand. What specifically would help you feel more confident about making a decision?'",
            "'Most people who say that end up not doing anything about their health. I don't want that for you.'",
            "'The program is nearly full right now, so I'd encourage you to decide soon.'",
          ],
          correctIndex: 1,
          explanation: "Pressure tactics produce resentful clients. 'I need to think about it' almost always means something specific isn't sitting right — timing, price, trust, readiness. Asking what would help them feel confident invites them to tell you what's actually in the way, which is the only information that matters.",
        },
        {
          id: "mm3q3",
          question: "What is the correct meaning of 'don't try to sell My Perfect Meals — tell them about it'?",
          options: [
            "Never mention pricing during a discovery conversation.",
            "Focus on features and benefits, and let prospects self-select.",
            "Find out what the person actually needs first — then explain how My Perfect Meals specifically addresses what you heard. Not the other way around.",
            "Keep the conversation informal and avoid structured sales language.",
          ],
          correctIndex: 2,
          explanation: "The sequence matters. Leading with the product puts it at the center of the conversation — people feel sold to. Leading with the person's real problem and then connecting it to specific solutions makes the product feel like an answer, not an ask. Same information, completely different dynamic.",
        },
        {
          id: "mm3q4",
          question: "During a 30-minute discovery call, a coach talks for 25 minutes. What is the likely result?",
          options: [
            "The prospect is impressed by the depth of expertise demonstrated.",
            "The coach provides enough context for a fully informed decision.",
            "The coach learns very little about the prospect and the conversation feels like a pitch — which reduces the chance of a good outcome.",
            "This is the ideal ratio for building credibility on a first call.",
          ],
          correctIndex: 2,
          explanation: "The more you talk, the less you learn. A prospect who leaves a discovery call feeling like they were listened to is far more likely to move forward than one who received an extensive presentation. Understanding what they actually need is both the ethical and effective foundation of the call.",
        },
        {
          id: "mm3q5",
          question: "Which opening question is most likely to start a productive discovery conversation?",
          options: [
            "'Have you heard of My Perfect Meals before?'",
            "'What's your current calorie target and macro split?'",
            "'How many times have you started a nutrition plan and had to start over because life got in the way?'",
            "'Are you primarily looking for weight loss or performance nutrition?'",
          ],
          correctIndex: 2,
          explanation: "This question works because almost everyone can answer yes — and answering it opens up the real conversation about what's actually been hard. It creates immediate resonance by acknowledging a near-universal experience, which signals that you understand people like them before you've said anything about your services.",
        },
      ],
    },
  },
  {
    id: "marketing-module-4",
    title: "Pricing & Packaging",
    description: "Why undercharging hurts your clients as much as it hurts your business — and how to structure services that reflect real value.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Pricing Is a Mindset Problem Before It's a Math Problem",
        text: "Most coaches underprice their services. Not because the market won't support higher rates — but because they don't believe their help is worth more.\n\nThat's an internal problem, not an external one.\n\nNew coaches often feel like impostors. They haven't worked with enough clients yet. They're still learning. They're not sure they can deliver. So they set prices that reflect their uncertainty rather than their actual value.\n\nThe problem: underpriced services attract undercommitted clients. When someone pays a meaningful amount for coaching, they treat it seriously. When they pay almost nothing, they treat it accordingly.\n\nYour pricing is a statement about how seriously you take what you do. Price from confidence, not from doubt.",
        tip: "If your price feels uncomfortable to say out loud, that's often the right price. The discomfort is the old belief being updated.",
      },
      {
        heading: "What New Coaches Get Wrong About Money",
        text: "New coaches make three pricing mistakes with nearly universal consistency.\n\n**They discount before they're asked.** Offering a lower rate preemptively signals that you don't believe your full rate is justified. Let the prospect respond to the full price first. Most won't push back the way you're afraid they will.\n\n**They give too much away.** Unlimited messaging, extra check-ins, free resources, revised meal plans — when you're not confident in your rate, you compensate with volume. This leads to burnout and trains clients to expect endless access for a fixed fee.\n\n**They set prices that don't sustain the work.** If your rate means you need 40 clients to pay your bills, you will burn out before you reach 20. Sustainable practices are built on rates that let you serve clients deeply, not rates that require scale to survive.",
      },
      {
        heading: "Package Your Services, Not Your Hours",
        text: "Hourly pricing is the wrong model for coaching.\n\nWhen you charge by the hour, clients think about how many hours they're getting. You think about how many hours you're spending. The conversation becomes about time — not about outcomes.\n\nClients are not buying your hours. They are buying results. They want to feel better, lose weight, manage their condition, perform at a higher level. Those outcomes have nothing to do with how many hours you spent.\n\nPackage your services around outcomes:\n\n**Three-month transformation program** — X check-ins, ongoing support, full platform access.\n\n**Quarterly health strategy engagement** — Clinical review, customized protocol setup, monthly support calls.\n\n**90-day kickstart** — Onboarding, weekly check-ins, progress review at 30/60/90 days.\n\nWhen clients buy a program, they're buying the result. That framing is honest and effective.",
      },
      {
        heading: "Charging What You're Worth Protects Your Clients",
        text: "This is counterintuitive but true: coaches who charge appropriately produce better client outcomes than coaches who undercharge.\n\nHere's why.\n\nA coach who undercharges needs volume to survive. Volume means more clients than they can serve well. More clients than they can serve well means attention gets thin. Attention gets thin and results suffer.\n\nA coach who charges appropriately serves fewer clients more deeply. They follow up more. They notice more. They invest more in each relationship because each relationship represents meaningful revenue.\n\nWhen you charge what you're worth, you have the financial security to actually show up for your clients. That's not a benefit to you. That's a benefit to them.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "My Perfect Meals makes your pricing case for you — if you use it correctly.\n\nThe platform demonstrates its value in the first session. Show a prospect the onboarding flow. Let them see that their medical conditions, allergies, dietary identity, and lifestyle preferences all become inputs. Show them what the app generates when it actually knows who they are.\n\nThat demonstration answers the question 'why does this cost this much?' before they ask it. They can see the system. They can see what you're providing. They can see that this is not a generic nutrition plan being handed to everyone.\n\nThe platform is evidence. Use it. A coach who can show exactly what the client gets — not just describe it — is in a completely different pricing conversation than one who is asking someone to trust a verbal promise.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm4q1",
          question: "Why do new coaches consistently undercharge for their services?",
          options: [
            "The nutrition coaching market is too competitive to command premium pricing.",
            "They haven't completed enough certifications to justify higher rates yet.",
            "Undercharging reflects an internal belief that their help isn't worth the price — not an accurate read of market conditions.",
            "Early-stage coaching clients expect discounted rates while the relationship is being established.",
          ],
          correctIndex: 2,
          explanation: "Underpricing is almost always an inside job. The market will often bear higher rates than new coaches believe — but the coach sets a low price because they're uncertain about their own value. That uncertainty tends to be self-fulfilling: low prices attract undercommitted clients, which produces mediocre outcomes, which reinforces the belief that higher pricing isn't justified.",
        },
        {
          id: "mm4q2",
          question: "A new coach says: 'I'll raise my prices once I have more experience and more clients.' What is wrong with this logic?",
          options: [
            "Price increases can damage relationships with existing clients who enrolled at a lower rate.",
            "Undercharging attracts clients who don't take the process seriously — and coaches who undervalue their work rarely build the confidence to raise prices through volume alone.",
            "Experience is the only legitimate basis for charging more, so the timing is actually correct.",
            "Market rates should always determine pricing, not individual coach experience levels.",
          ],
          correctIndex: 1,
          explanation: "The logic is backwards. Undercharging doesn't build confidence — it erodes it, because the clients it attracts tend to be less committed, which produces worse outcomes, which reinforces the belief that the work isn't worth more. Pricing from confidence, even before you feel fully ready, is part of building the practice that justifies it.",
        },
        {
          id: "mm4q3",
          question: "Why is packaging your services around a program or outcome better than charging hourly?",
          options: [
            "Programs are more straightforward to advertise than per-session pricing models.",
            "Hourly billing creates scope disputes that damage the coaching relationship.",
            "Clients aren't buying your time — they're buying a result. Outcome-based packaging keeps the conversation where it belongs: on what changes for them.",
            "Per-hour pricing is not legally appropriate in some coaching markets.",
          ],
          correctIndex: 2,
          explanation: "Hourly pricing centers the conversation on time. Outcome packaging centers it on results. Clients don't want 10 hours of coaching — they want to feel better, lose weight, manage their condition. Package around what they're actually buying, and both the value proposition and the pricing conversation become much cleaner.",
        },
        {
          id: "mm4q4",
          question: "How does charging appropriately actually benefit your clients — not just your business?",
          options: [
            "Higher prices attract clients with more disposable income, who tend to be more disciplined.",
            "Coaches who charge appropriately serve fewer clients more deeply — more attention, more follow-through, better outcomes. Underpriced coaches need volume and spread themselves thin.",
            "Appropriate pricing allows coaches to invest in better tools and resources for clients.",
            "Premium pricing signals higher quality to skeptical prospects who might otherwise doubt the coaching's effectiveness.",
          ],
          correctIndex: 1,
          explanation: "A coach who needs 40 clients to make ends meet can't serve 40 clients well. A coach who charges rates that make 15 to 20 clients sustainable can go deep with each one — noticing more, following up more, investing more in each relationship. That depth is what produces results. It's not a luxury. It's the work.",
        },
        {
          id: "mm4q5",
          question: "A prospect says: 'That's more than I was expecting to spend.' What is the most effective response?",
          options: [
            "'I can offer you a discounted rate if you commit today.'",
            "'This is what the market charges for this level of professional coaching.'",
            "'I understand. What would feel worth it to you — if you actually reached your goal?'",
            "'Most people spend more than that on things that don't produce any results.'",
          ],
          correctIndex: 2,
          explanation: "Bringing the question back to the outcome shifts the frame from 'is this expensive?' to 'what is the result worth to me?' Most people who say something costs more than expected haven't fully connected the price to the outcome. This question helps them do that — without pressure and without discounting.",
        },
      ],
    },
  },
  {
    id: "marketing-module-5",
    title: "Results That Market Themselves",
    description: "The most powerful marketing you'll ever do happens after a client succeeds — if you build the relationship that makes them want to share it.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Underpromise. Overdeliver. Always.",
        text: "The simplest marketing strategy in coaching has nothing to do with social media.\n\nIt's this: make a modest promise and then exceed it.\n\nEvery time you overdeliver, you produce a client who is genuinely surprised by what happened. Surprised clients talk. They don't just leave a polite five-star review — they tell specific people in their lives about what changed, because it exceeded what they expected.\n\nThe math works in reverse too: every time you overpromise, you produce a client who was disappointed by what happened. Disappointed clients also talk.\n\nThe coaches with the most referrals are almost never the ones who made the biggest promises. They're the ones who made honest ones — and then showed up beyond them.",
        tip: "This applies to your My Perfect Meals clients specifically: never promise a specific outcome ('you'll lose 20 pounds in 60 days'). Promise the process — 'I'm going to do everything I can to help you build something that actually works for your life.' Then exceed that promise. The outcome often follows.",
      },
      {
        heading: "Communicate Often — Not Just When Something Goes Wrong",
        text: "Most coaches go silent between sessions.\n\nA client doesn't hear from them unless they reach out, unless something breaks down, unless there's a scheduled check-in coming up. This is a missed opportunity — and a retention risk.\n\nProactive communication signals that you're thinking about your client between sessions. It doesn't have to be elaborate:\n\n\"Hey, you mentioned you had a work event this week — how did it go?\"\n\n\"I noticed you've been consistent all week. Keep that going.\"\n\n\"Thinking about what we discussed last time. Let me know if you want to talk through it.\"\n\nThese moments cost almost nothing. They produce the feeling that someone is paying attention — which is exactly what clients are paying for.",
      },
      {
        heading: "Celebrate Wins Out Loud",
        text: "Clients almost never acknowledge their own milestones.\n\nThey hit a goal and immediately move to the next problem. They break a habit they've had for years and treat it like it was expected. They have a week where everything clicked and don't even mention it to you.\n\nYour job is to notice and name those moments before they pass.\n\n\"You've been consistent for four weeks straight. Do you understand how unusual that is?\"\n\n\"You lost four pounds without feeling deprived for the first time ever. That's not a small thing.\"\n\n\"You made a good decision at a restaurant without thinking about it. That's the habit forming.\"\n\nWhen coaches celebrate client wins loudly, two things happen: the client actually believes the progress is real, and the coaching relationship deepens. Both of those drive retention and referrals.",
      },
      {
        heading: "Asking for Testimonials the Right Way",
        text: "Testimonials don't appear automatically. You have to create the conditions for them.\n\nThe conditions are simple:\n1. A client achieves something meaningful.\n2. They feel genuinely proud of it.\n3. You ask — at that moment, not six weeks later.\n\n\"You just said this is the first time eating well has felt sustainable for you. Would you be willing to share that somewhere? It would mean a lot — and it might help someone who's exactly where you were a few months ago.\"\n\nThat ask works because it's honest and it gives the client a reason beyond your benefit. They're not doing you a favor. They're potentially helping someone who needs it.\n\nThe most effective testimonials are specific. \"For the first time, I actually enjoyed what I was eating\" is worth ten times more than \"great program, highly recommend.\"",
      },
      {
        heading: "The Referral Ask: Natural, Not Awkward",
        text: "Most coaches are uncomfortable asking for referrals. They feel like they're imposing, selling, asking for something they haven't earned.\n\nReframe it: when your client is succeeding, you're not asking them to do you a favor. You're asking them if they know anyone else who deserves the same thing they just experienced.\n\n\"You've had a lot of success with this. Would you know anyone who might benefit from something like this? I have a promo code they can use to get started.\"\n\nThat's the entire ask. One sentence. No pressure, no urgency, no manufactured scarcity.\n\nTiming is everything. Ask at a peak moment — when they just shared a win, when they're feeling the progress, when the coaching relationship is at its strongest. That's when the referral feels natural, because it comes from genuine enthusiasm rather than obligation.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "The platform gives you concrete things to celebrate and specific results to point to.\n\nBiometrics are a particularly powerful tool here. When a client's numbers change — weight, body composition, glucose trends — that data is evidence of real progress that exists independent of anyone's memory or interpretation. It's hard to dismiss.\n\n\"Look at your glucose trend from six weeks ago versus now. That's not the app doing that — that's you making different decisions consistently, supported by the app.\"\n\nFor testimonials and referrals, the platform's specificity is your advantage. Instead of vague outcomes, your clients can describe exactly what changed: \"I stopped getting overwhelmed by eating out because the app tells me what to order at the actual restaurant I'm at.\" That specificity is compelling because it describes something real that other people can picture.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm5q1",
          question: "When is the best time to ask a client for a testimonial?",
          options: [
            "At the end of the enrollment call, while enthusiasm about getting started is high.",
            "After exactly 90 days, regardless of whether they've hit any specific milestones.",
            "Right after a genuine win — a milestone they hit, a week that finally clicked, something they're proud of.",
            "During the offboarding process, when the coaching relationship is formally concluding.",
          ],
          correctIndex: 2,
          explanation: "Timing determines the quality of a testimonial. The best ones come from a moment of genuine pride — when a client has just experienced something that surprised them. That's when the words are specific and authentic. Ask six weeks later and you'll get something polished but vague.",
        },
        {
          id: "mm5q2",
          question: "A client loses four pounds in their first month. You made no specific promises. How should you frame this moment?",
          options: [
            "'That's slightly below average for the first month — let's look at what we can adjust.'",
            "'We should verify that against your full biometric picture before drawing conclusions.'",
            "'That's four pounds you didn't have to white-knuckle your way through. That's what consistent looks like. It builds from here.'",
            "'Great start — just keep going and we'll hit your goal eventually.'",
          ],
          correctIndex: 2,
          explanation: "The framing matters as much as the number. Four pounds isn't just a number — it's evidence that the process works for this person's real life. Naming that specifically ('you didn't have to deprive yourself to make this happen') connects the outcome to the method, which is what makes a client want to continue and tell others.",
        },
        {
          id: "mm5q3",
          question: "What makes a coaching testimonial most effective?",
          options: [
            "It was recorded on video, which is more credible than written testimonials.",
            "It mentions specific platform features the client found most useful.",
            "It describes a specific, real outcome in the client's own words — not a general positive statement.",
            "It includes a before/after comparison with measurable numbers.",
          ],
          correctIndex: 2,
          explanation: "Specificity is credibility. 'Great coach, highly recommend' tells a prospective client nothing actionable. 'For the first time in my life, I actually look forward to eating — and I've stopped feeling guilty about restaurants' tells them exactly what changed. Specific testimonials resonate because they describe something the reader can picture for themselves.",
        },
        {
          id: "mm5q4",
          question: "Why should coaches communicate proactively rather than waiting for clients to reach out?",
          options: [
            "Proactive communication is legally required for coaches working with clients who have medical conditions.",
            "Clients who aren't followed up with consistently tend to cancel their subscriptions faster.",
            "Proactive contact signals genuine investment — clients feel cared for, not just enrolled. Coaches who only appear when something breaks feel transactional.",
            "Regular contact is required to maintain accurate coaching logs and compliance records.",
          ],
          correctIndex: 2,
          explanation: "Clients pay for someone who is paying attention. A coach who only appears at scheduled sessions or when problems arise communicates, implicitly, that the client's progress doesn't occupy space in the coach's attention between meetings. Small, proactive touchpoints change that perception — and they change the coaching relationship.",
        },
        {
          id: "mm5q5",
          question: "A client hits a small milestone and doesn't mention it. What should the coach do?",
          options: [
            "Wait — if it were meaningful to them, they would have brought it up.",
            "Point it out directly: 'I noticed you hit your consistency goal four weeks in a row. That's not nothing.'",
            "Log it for future reference but don't interrupt their natural communication pattern.",
            "Wait until the next scheduled check-in and mention it as part of the overall progress review.",
          ],
          correctIndex: 1,
          explanation: "Clients almost never acknowledge their own progress. They're too close to it, too focused on the next problem, too used to minimizing what they've accomplished. Your job is to name what they're not naming — specifically and directly. When coaches celebrate what clients miss, it creates the belief that the progress is real. That belief drives everything else.",
        },
      ],
    },
  },
  {
    id: "marketing-module-6",
    title: "Client Retention",
    description: "Long-term clients are built one relationship moment at a time — and the coaches who understand that have practices that grow on their own.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Retention Is About the Relationship, Not the Subscription",
        text: "Coaches who think about retention as a business problem try to solve it with tactics: loyalty programs, automatic renewals, re-engagement emails.\n\nCoaches who understand retention as a relationship problem solve it by being genuinely good at their job.\n\nThe clients who stay the longest are not the ones who feel locked in. They're the ones who can't imagine going back to navigating their nutrition without someone in their corner.\n\nThat feeling doesn't come from a contract or a discount. It comes from months of being listened to, being seen, being supported through the hard weeks, and watching your life actually change as a result.\n\nRetention isn't something you do after the client enrolls. It's something you build from the very first conversation.",
      },
      {
        heading: "Accountability Done Right: Present, Not Punishing",
        text: "Most clients have experienced accountability that feels like surveillance.\n\nA coach who tracks every missed meal, questions every deviation, and treats a rough week as a failure — that's not accountability. That's pressure with a professional title.\n\nReal accountability is the feeling that someone will notice if you disappear — and will reach out with curiosity rather than judgment.\n\n\"I noticed you've been quiet this week. Not checking in to scold you. Just making sure you're okay and that life hasn't gotten in the way of something that was working.\"\n\nThat message, sent without an agenda, does more for retention than any re-engagement campaign ever will. It tells the client: I'm not just watching your metrics. I'm watching out for you.",
        tip: "The check-in that isn't required is the one that matters most. When coaches reach out between sessions with no agenda — just genuine curiosity about how someone's doing — clients feel the difference between being managed and being cared for.",
      },
      {
        heading: "Celebrate the Milestones They Don't Notice",
        text: "Clients are terrible at acknowledging their own progress.\n\nThey've been trying to improve their nutrition for years — sometimes decades. By the time they're working with you, they've failed enough times that success feels suspicious. When something works, their first instinct is often to wait for it to fall apart, not to celebrate that it happened.\n\nYour job is to override that pattern.\n\nWhen a client has been consistent for four weeks, name it. When they make a good decision in a difficult situation, name it. When their biometrics shift in a positive direction, name it.\n\nYou are not just celebrating results. You are building a new story about what this person is capable of. That story is what keeps them in the work when it gets hard.",
      },
      {
        heading: "Making Clients Feel Seen",
        text: "The single most powerful retention tool in coaching is also the simplest: remember what your clients tell you.\n\nNot just their health goals. Their actual life.\n\nThe daughter's wedding they mentioned three months ago. The job transition that's been stressful. The relationship with food that goes back to childhood. The pride they felt the first time they navigated a restaurant without anxiety.\n\nWhen you reference those details — when you connect them back to something a client told you weeks ago — they feel seen. Not managed. Not processed. Seen.\n\nThat feeling is the foundation of long-term trust. It's also nearly impossible to replicate at scale, which means it's one of the few genuine competitive advantages available to individual coaches.",
      },
      {
        heading: "Building Habits, Not Willpower",
        text: "Clients who succeed through willpower eventually fail.\n\nWillpower is a finite resource. It depletes under stress, under fatigue, under change. A nutrition plan that requires constant active choice — constant resistance to easier options — will collapse the first time life gets genuinely hard.\n\nClients who succeed through habit rarely need to quit.\n\nHabits are automatic. They don't require a decision. They don't deplete a resource. When eating well is what a person just does — not something they choose with effort every day — their compliance becomes independent of their circumstances.\n\nYour job as a coach is not to keep clients motivated. It's to help them build habits strong enough that motivation becomes irrelevant. That's the work that produces lifetime clients.",
      },
      {
        heading: "Applying This in My Perfect Meals",
        text: "The platform creates natural touchpoints for the relationship moments that drive retention.\n\nWhen a client shares their meal board or logs a good week, that's a moment to reach out. When biometrics update and show a positive trend, that's a moment to name the progress. When a client uses the restaurant feature successfully for the first time, that's worth more than just logging it.\n\nThe platform also makes the work feel manageable, which is itself a retention factor. Clients who feel like the process is within reach stay in it. Clients who feel overwhelmed by the complexity quit.\n\nWhen you orient your coaching around making the platform feel easy and the process feel sustainable — rather than optimizing for maximum compliance in minimum time — you build something your clients don't want to leave.",
      },
    ],
    quiz: {
      passingScore: 80,
      questions: [
        {
          id: "mm6q1",
          question: "What is the primary driver of long-term client retention in nutrition coaching?",
          options: [
            "Consistent measurable results delivered each and every month.",
            "The strength of the human relationship — clients stay with coaches who make them feel understood, supported, and seen.",
            "Regular platform updates and new features that keep the experience fresh.",
            "Monthly loyalty incentives and pricing discounts for continued enrollment.",
          ],
          correctIndex: 1,
          explanation: "Results matter — but clients leave coaches who produce results all the time, because the relationship didn't hold them. Clients stay with coaches whose absence they can't imagine, because that person has become part of how they navigate their life. The relationship is what retention is actually built on.",
        },
        {
          id: "mm6q2",
          question: "A client misses two check-ins in a row without explanation. What is the most effective coaching response?",
          options: [
            "Send an automated reminder with their current progress metrics and a link to rebook.",
            "Wait — following up too quickly feels intrusive and may push them away.",
            "'Hey, I noticed I haven't heard from you. Not checking in to lecture you — just checking in. What's going on?'",
            "Flag the account as at-risk and move to monthly contact to give them space.",
          ],
          correctIndex: 2,
          explanation: "The message that works is the one sent without an agenda. 'What's going on?' — not 'you missed two sessions,' not 'your progress is suffering.' Genuine curiosity with no judgment is the exact opposite of what clients expect when they've gone quiet. It's what brings them back.",
        },
        {
          id: "mm6q3",
          question: "What does 'making clients feel seen' mean in a coaching context?",
          options: [
            "Sending weekly email summaries of their biometric data and progress metrics.",
            "Remembering the specific details of their life — what they told you, what matters to them, what they've been working through — and reflecting that back to them over time.",
            "Providing personalized meal plan adjustments based on their stated weekly preferences.",
            "Connecting with clients on social media and engaging with their content.",
          ],
          correctIndex: 1,
          explanation: "Feeling seen is not about data. It's about a person knowing that another person actually listened — and remembered. When a coach references something a client mentioned three months ago, the client understands that they weren't just a case to manage. That feeling builds a kind of loyalty that no loyalty program can manufacture.",
        },
        {
          id: "mm6q4",
          question: "Why do coaches who focus on building habits retain clients longer than those who focus on keeping clients motivated?",
          options: [
            "Habit-based coaching requires fewer sessions, which makes the program more affordable.",
            "Motivation is unreliable and finite. Habits are automatic — they don't require a daily decision, which means they survive the difficult periods that motivation cannot.",
            "Habit formation is a more evidence-based approach than motivational interviewing.",
            "Habit coaching produces faster measurable results in the first 30 days.",
          ],
          correctIndex: 1,
          explanation: "A client whose nutrition depends on willpower will eventually have a week where willpower runs out. Life gets hard, stress spikes, the easy choice wins. Habits are different — they're what happens without decision. When eating well is the default, circumstances become much less of a factor. Building that automatic default is the work that produces clients who don't quit.",
        },
        {
          id: "mm6q5",
          question: "A client tells you they had a rough week and went significantly off-plan. What is the retention-focused response?",
          options: [
            "'Let's pull up your logs and figure out specifically where the breakdown happened.'",
            "'One rough week doesn't define your progress. Tell me what happened — not to fix your diet, but because I want to understand what we're actually working with.'",
            "'This is exactly why consistency matters. You'll need to recalibrate this week to stay on track.'",
            "'That's okay. Forget about it and just start fresh Monday.'",
          ],
          correctIndex: 1,
          explanation: "The client who admitted they had a rough week is already doing the hard thing — they told you. The response that keeps them is the one that makes them glad they did. Curiosity without judgment ('tell me what happened') signals that the relationship is strong enough to handle imperfection — which is the only kind of coaching relationship that lasts.",
        },
      ],
    },
  },
];

export function getMarketingModuleById(moduleId: string): CertificationModule | undefined {
  return MARKETING_COACHING_MODULES.find((m) => m.id === moduleId);
}

export function getMarketingModuleIndex(moduleId: string): number {
  return MARKETING_COACHING_MODULES.findIndex((m) => m.id === moduleId);
}

export function getNextMarketingModuleId(moduleId: string): string | null {
  const idx = getMarketingModuleIndex(moduleId);
  if (idx === -1 || idx >= MARKETING_COACHING_MODULES.length - 1) return null;
  return MARKETING_COACHING_MODULES[idx + 1].id;
}

export function getPrevMarketingModuleId(moduleId: string): string | null {
  const idx = getMarketingModuleIndex(moduleId);
  if (idx <= 0) return null;
  return MARKETING_COACHING_MODULES[idx - 1].id;
}
