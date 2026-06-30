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
