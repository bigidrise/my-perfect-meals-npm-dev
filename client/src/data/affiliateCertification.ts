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
    title: "Understanding Your Role",
    description: "Understanding which type of affiliate you are and how My Perfect Meals supports you.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "One of the biggest misconceptions people have when they first discover My Perfect Meals is believing they need to become a nutrition expert to benefit from the platform.\n\nThey do not.\n\nMy Perfect Meals was designed to simplify nutrition, meal planning, and behavior support so that people can spend less time creating plans and more time helping others.\n\nUnderstanding your role is one of the most important parts of becoming a successful affiliate, coach, provider, or partner.",
      },
      {
        heading: "There Are Two Types Of Affiliates",
        text: "Not everyone who joins My Perfect Meals serves the same purpose.\n\nSome people actively work with clients. Some people simply introduce others to the platform.\n\nBoth roles are valuable. Understanding which role you play helps you understand how you should use the system.",
      },
      {
        heading: "Coaching Affiliates",
        text: "Coaching Affiliates work directly with clients. Examples include:",
        list: [
          "Personal Trainers",
          "Nutrition Coaches",
          "Dietitians",
          "Physicians",
          "Nurse Practitioners",
          "Health Coaches",
          "Wellness Professionals",
        ],
      },
      {
        heading: "Tools Coaching Affiliates Use",
        text: "These individuals may use:",
        list: [
          "ProCare",
          "Care Team",
          "Client Dashboards",
          "Biometrics",
          "Meal Builders",
          "Progress Tracking",
          "Compliance Monitoring",
          "Check-In Scheduling",
        ],
      },
      {
        heading: "Referral Affiliates",
        text: "Referral Affiliates do not provide nutrition coaching. Examples include:",
        list: [
          "Life Coaches",
          "Business Owners",
          "Influencers",
          "Content Creators",
          "Existing Users",
          "Wellness Advocates",
        ],
      },
      {
        heading: "The Referral Affiliate Role",
        text: "Referral Affiliates are not expected to create meal plans, adjust macros, or coach clients. Their role is to:",
        list: [
          "Understand the platform",
          "Explain the platform",
          "Share the platform",
          "Refer potential users",
          "Connect professionals to the platform",
        ],
      },
      {
        heading: "My Perfect Meals Does Most Of The Work",
        text: "Many people assume nutrition coaching requires creating meal plans from scratch. That is not how My Perfect Meals was designed. The platform already provides:",
        list: [
          "Macro calculations",
          "Meal generation",
          "Recipe creation",
          "Shopping lists",
          "Restaurant guidance",
          "Clinical nutrition support",
          "Adaptive recommendations",
          "Behavior support tools",
        ],
      },
      {
        heading: "What Coaches Actually Need To Know",
        text: "A coach's most important job is not creating meal plans. A coach's most important job is understanding the client. The better you understand the person, the more effective the platform becomes.",
        list: [
          "What foods they enjoy",
          "What foods they dislike",
          "Their schedule",
          "Their lifestyle",
          "Their goals",
          "Their challenges",
          "Their habits",
        ],
      },
      {
        heading: "Understanding Macro Targets",
        text: "The Macro Calculator is designed to provide a strong starting point based on the client's information. For many clients, the generated targets work extremely well without modification.\n\nCoaches should not feel pressured to make changes simply because they have access to the controls. Before making adjustments, coaches should review:",
        list: [
          "Compliance",
          "Progress",
          "Weight trends",
          "Body composition",
          "Overall outcomes",
        ],
      },
      {
        heading: "What The Platform Provides",
        text: "The best results occur when the platform and coach work together. The platform provides:",
        list: [
          "Structure",
          "Guidance",
          "Automation",
          "Personalization",
          "Consistency",
        ],
      },
      {
        heading: "What The Coach Provides",
        text: "The coach provides:",
        list: [
          "Accountability",
          "Communication",
          "Support",
          "Experience",
          "Professional judgment",
        ],
      },
      {
        heading: "Key Takeaway",
        text: "My Perfect Meals was designed to simplify nutrition and behavior support.\n\nCoaching Affiliates use the platform to guide clients. Referral Affiliates use the platform to introduce people to a solution.\n\nBoth roles play an important part in growing the My Perfect Meals community. Understanding your role is the first step toward success.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m1q1",
          question: "What is one of the biggest misconceptions people have about My Perfect Meals?",
          options: [
            "They must become a fitness trainer",
            "They must become a nutrition expert",
            "They must become a physician",
            "They must create their own recipes",
          ],
          correctIndex: 1,
          explanation: "My Perfect Meals was designed to simplify nutrition so that people do not need to become nutrition experts. The platform handles the technical work automatically.",
        },
        {
          id: "m1q2",
          question: "According to this lesson, when should a coach consider adjusting a client's macro targets?",
          options: [
            "Immediately when they begin working together",
            "Only when the client requests changes",
            "After reviewing compliance, progress, weight trends, body composition, and outcomes",
            "At the start of every new week",
          ],
          correctIndex: 2,
          explanation: "The Macro Calculator provides a strong starting point. Coaches should not feel pressured to adjust simply because they have access to the controls. Changes should follow a careful review of compliance, progress, weight trends, body composition, and overall outcomes.",
        },
        {
          id: "m1q3",
          question: "Which of the following is typically a Coaching Affiliate?",
          options: [
            "Content Creator",
            "Influencer",
            "Business Owner",
            "Personal Trainer",
          ],
          correctIndex: 3,
          explanation: "Coaching Affiliates work directly with clients. Personal Trainers, Nutrition Coaches, Dietitians, Physicians, and similar professionals fall into this category.",
        },
        {
          id: "m1q4",
          question: "What is the primary role of a Referral Affiliate?",
          options: [
            "Create meal plans for clients",
            "Adjust client macros",
            "Introduce people to the platform and share its value",
            "Monitor compliance and progress",
          ],
          correctIndex: 2,
          explanation: "Referral Affiliates are not expected to coach, create meal plans, or adjust macros. Their role is to understand the platform, share it, and refer potential users.",
        },
        {
          id: "m1q5",
          question: "According to this lesson, what is one of the most important jobs of a coach?",
          options: [
            "Constantly changing macro targets",
            "Creating meal plans from scratch",
            "Understanding the client and supporting behavior change",
            "Designing recipes manually",
          ],
          correctIndex: 2,
          explanation: "A coach's most important job is understanding the client — their goals, challenges, habits, and lifestyle. The better the coach understands the person, the more effective the platform becomes.",
        },
      ],
    },
  },
  {
    id: "module-2",
    title: "Why My Perfect Meals Exists",
    description: "Why traditional nutrition programs fail and how MPM was built to solve the compliance gap.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "Many nutrition programs fail for one simple reason.\n\nThey focus on food while ignoring the person.\n\nMost meal plans are built around rules, restrictions, and perfect compliance. Real life rarely works that way.\n\nPeople travel. People get busy. People have families. People eat in restaurants. People have cravings. People experience stress. People are human.\n\nMy Perfect Meals was built to solve the gap between nutrition science and real life.",
      },
      {
        heading: "Traditional Nutrition Has A Compliance Problem",
        text: "Most nutrition programs assume people will follow instructions perfectly. Examples include:",
        list: [
          "Eat these exact foods",
          "Follow this exact schedule",
          "Never eat certain foods",
          "Start over if you make a mistake",
        ],
      },
      {
        heading: "Why Most People Struggle",
        text: "The problem is that life does not follow a perfect schedule.\n\nMost people do not fail because they lack information.\n\nMost people fail because they struggle with consistency.",
      },
      {
        heading: "Nutrition Must Adapt To Real Life",
        text: "The most successful nutrition system is not necessarily the most restrictive.\n\nThe most successful nutrition system is the one a person can follow consistently.\n\nMy Perfect Meals was designed around adaptability. Instead of forcing people to fit a plan, the platform helps create plans that fit the person.",
      },
      {
        heading: "People Already Know What They Like To Eat",
        text: "Most people already have favorite foods. Most people already have favorite restaurants. Most people already have preferred eating styles.\n\nInstead of fighting those preferences, My Perfect Meals works with them.\n\nThe goal is not forcing people to eat differently. The goal is helping people eat better versions of the foods they already enjoy.",
      },
      {
        heading: "Adaptive Nutrition",
        text: "Adaptive Nutrition is the foundation of My Perfect Meals. The platform considers:",
        list: [
          "Goals",
          "Preferences",
          "Medical conditions",
          "Lifestyle",
          "Activity level",
          "Family situation",
          "Food availability",
          "Clinical considerations",
        ],
      },
      {
        heading: "Emotion AI And Behavior AI",
        text: "Food decisions are not made only with logic. They are influenced by:",
        list: [
          "Stress",
          "Habits",
          "Emotions",
          "Environment",
          "Social situations",
          "Convenience",
        ],
      },
      {
        heading: "Consistency Beats Perfection",
        text: "The goal is not perfect eating.\n\nThe goal is consistent progress.\n\nA plan followed consistently will almost always outperform a perfect plan that gets abandoned.",
      },
      {
        heading: "Key Takeaway",
        text: "My Perfect Meals works because it focuses on the person, not just the food.\n\nWhen nutrition adapts to real life, people are more likely to stay consistent, make better decisions, and achieve long-term success.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m2q1",
          question: "According to the My Perfect Meals philosophy, what is usually the biggest obstacle to success?",
          options: [
            "Lack of recipes",
            "Lack of exercise",
            "Human behavior and consistency",
            "Lack of supplements",
          ],
          correctIndex: 2,
          explanation: "Most people do not fail because they lack information. They fail because they struggle with consistency. My Perfect Meals was designed to address this human challenge.",
        },
        {
          id: "m2q2",
          question: "What problem was My Perfect Meals primarily designed to solve?",
          options: [
            "Creating more restrictive meal plans",
            "Helping people navigate nutrition complexity while still enjoying food",
            "Replacing coaches",
            "Eliminating all dietary choices",
          ],
          correctIndex: 1,
          explanation: "MPM was designed to solve the gap between nutrition science and real life — helping people navigate complexity while working with the foods and preferences they already have.",
        },
        {
          id: "m2q3",
          question: "What is the guilt cycle that many clients experience around food?",
          options: [
            "A healthy pattern of eating, tracking, and adjusting",
            "A loop of emotional eating, guilt, restriction, frustration, and overeating that repeats",
            "A reaction that comes from missing a workout",
            "A cycle of meal planning followed by grocery shopping",
          ],
          correctIndex: 1,
          explanation: "Many clients are not struggling with food — they are struggling with guilt. The cycle: eat emotionally → feel guilty → restrict food → become frustrated → overeat again → feel more guilty → repeat. Recognizing this cycle is essential to helping clients break it.",
        },
        {
          id: "m2q4",
          question: "Which statement best reflects the My Perfect Meals philosophy?",
          options: [
            "Restriction creates success",
            "People should stop eating foods they enjoy",
            "Information is usually the biggest problem",
            "Adaptation is more effective than restriction",
          ],
          correctIndex: 3,
          explanation: "My Perfect Meals is built on the principle that a system adapted to the individual is more effective than a restrictive plan the person cannot follow consistently.",
        },
        {
          id: "m2q5",
          question: "Why does My Perfect Meals believe a plan followed consistently outperforms a perfect plan?",
          options: [
            "Because perfect plans are more expensive to maintain",
            "Because restrictions always produce faster results",
            "Because most clients cannot understand complex nutrition plans",
            "Because a system someone can follow consistently will almost always produce better outcomes than a perfect plan that gets abandoned",
          ],
          correctIndex: 3,
          explanation: "Consistency beats perfection. A plan that adapts to real life and is followed consistently will outperform a theoretically perfect plan the person cannot sustain. My Perfect Meals is built around this principle.",
        },
      ],
    },
  },
  {
    id: "module-3",
    title: "Understanding The MPM Coaching System",
    description: "How the platform and the professional work together — and where coaches create their greatest value.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Introduction",
        text: "My Perfect Meals was never designed to replace coaches.\n\nIt was designed to make coaches more effective.\n\nThe platform and the professional each have a specific role. Understanding those roles is essential to using the system correctly.",
      },
      {
        heading: "What The Platform Provides",
        text: "The platform provides:",
        list: [
          "Nutrition guidance",
          "Meal generation",
          "Recipe creation",
          "Shopping lists",
          "Tracking tools",
          "Compliance tools",
          "Clinical guardrails",
        ],
      },
      {
        heading: "What The Professional Provides",
        text: "The professional provides:",
        list: [
          "Accountability",
          "Communication",
          "Education",
          "Support",
          "Experience",
          "Judgment",
        ],
      },
      {
        heading: "Why Coaches Matter",
        text: "Technology can generate meals. Technology can calculate macros. Technology can create shopping lists.\n\nTechnology cannot replace human relationships.\n\nPeople still need encouragement. People still need accountability. People still need support when life becomes difficult.\n\nThat is where professionals create value.",
      },
      {
        heading: "Coaching Is About Behavior Change",
        text: "Most clients already know what healthy foods look like. The challenge is not knowledge. The challenge is behavior.\n\nSuccessful coaches help clients:",
        list: [
          "Stay consistent",
          "Build habits",
          "Solve problems",
          "Recover from setbacks",
          "Maintain motivation",
        ],
      },
      {
        heading: "Using Data To Make Decisions",
        text: "The platform provides valuable information including:",
        list: [
          "Compliance",
          "Weight trends",
          "Biometrics",
          "Progress tracking",
          "Meal adherence",
        ],
      },
      {
        heading: "Good Coaching Is Responding To Data",
        text: "Coaches should use this information to make informed decisions.\n\nGood coaching is not guessing.\n\nGood coaching is responding to data.",
      },
      {
        heading: "What The Coach Helps The Client Do",
        text: "The coach helps the client:",
        list: [
          "Understand the process",
          "Stay accountable",
          "Adjust when necessary",
          "Focus on long-term success",
        ],
      },
      {
        heading: "What The Client Provides",
        text: "The client provides:",
        list: [
          "Feedback",
          "Compliance",
          "Communication",
          "Effort",
        ],
      },
      {
        heading: "Key Takeaway",
        text: "The MPM Coaching System combines technology and human guidance.\n\nThe platform handles the technical workload.\n\nThe professional focuses on helping people succeed.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m3q1",
          question: "What is one of the biggest mistakes nutrition professionals make?",
          options: [
            "Talking to clients too often",
            "Believing success comes primarily from meal plans",
            "Tracking progress",
            "Setting goals",
          ],
          correctIndex: 1,
          explanation: "A common mistake is assuming that a better meal plan solves the problem. Success comes from behavior change, consistency, and human guidance — not from the plan itself.",
        },
        {
          id: "m3q2",
          question: "According to this lesson, what does 'good coaching' look like in practice?",
          options: [
            "Guessing what clients need based on past experience",
            "Giving clients motivational speeches every session",
            "Creating a more detailed meal plan each week",
            "Responding to data — using compliance, weight trends, biometrics, and progress to make informed decisions",
          ],
          correctIndex: 3,
          explanation: "Good coaching is not guessing. It is responding to data. The platform provides compliance records, weight trends, biometrics, and meal adherence. Coaches who use this information to make intentional, informed decisions consistently produce better outcomes.",
        },
        {
          id: "m3q3",
          question: "In the MPM Coaching System, what does the CLIENT provide?",
          options: [
            "Accountability, communication, and professional judgment",
            "Nutrition guidance, meal generation, and compliance tools",
            "Feedback, compliance, communication, and effort",
            "Education, experience, and clinical guardrails",
          ],
          correctIndex: 2,
          explanation: "In the MPM system, roles are clearly divided. The platform provides structure and automation. The coach provides accountability, communication, and judgment. The client's role is to provide feedback, compliance, communication, and effort — the engagement that makes everything else work.",
        },
        {
          id: "m3q4",
          question: "What role does the coach primarily play within the My Perfect Meals Coaching System?",
          options: [
            "Recipe creator",
            "Meal planner",
            "Behavior coach, mentor, and accountability partner",
            "Grocery shopper",
          ],
          correctIndex: 2,
          explanation: "The coach's primary role is as a behavior coach, mentor, and accountability partner. The platform handles the nutrition mechanics so the coach can focus on the human side.",
        },
        {
          id: "m3q5",
          question: "When a client struggles, what should a coach investigate first?",
          options: [
            "Whether they need another meal plan",
            "Whether they need supplements",
            "What behavioral barriers are preventing success",
            "Whether they need a gym membership",
          ],
          correctIndex: 2,
          explanation: "When a client struggles, the first priority is identifying behavioral barriers — what is getting in the way of consistency, and what human support is needed to overcome it.",
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
          "GLP-1 support",
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
          question: "Why must a coach understand compliance before drawing conclusions about a client's results?",
          options: [
            "Compliance determines the client's subscription tier",
            "Without knowing if recommendations were actually followed, results cannot be accurately interpreted or adjusted",
            "Compliance is only relevant during the first two weeks",
            "Compliance data is used to calculate billing",
          ],
          correctIndex: 1,
          explanation: "Results cannot be evaluated without understanding compliance. If a client is not following recommendations, the platform is not being tested fairly. A coach must determine whether meals are being followed and consistency is improving before concluding what is or is not working.",
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
          question: "According to this lesson, what creates long-term business growth?",
          options: [
            "Aggressive sales tactics",
            "Fear-based marketing",
            "Trust, relationships, and referrals",
            "Constant discount promotions",
          ],
          correctIndex: 2,
          explanation: "Trust creates relationships. Relationships create referrals. Referrals create growth. The most successful businesses focus on trust first and sales second.",
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
          question: "What is the primary purpose of My Perfect Meals?",
          options: [
            "Weight loss",
            "Selling meal plans",
            "Simplifying nutrition complexity while improving consistency and behavior",
            "Replacing coaches",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals exists to simplify nutrition complexity and help people improve consistency and behavior — not to sell meal plans or replace professional coaches.",
        },
        {
          id: "fq2",
          question: "Who is responsible for handling nutrition complexity?",
          options: [
            "The client",
            "The coach",
            "The platform",
            "The affiliate",
          ],
          correctIndex: 2,
          explanation: "The platform handles nutrition complexity — generating meals, recipes, shopping lists, and adapting to medical conditions and preferences automatically.",
        },
        {
          id: "fq3",
          question: "Who is responsible for helping clients improve consistency and accountability?",
          options: [
            "The platform",
            "The professional",
            "The grocery store",
            "The restaurant",
          ],
          correctIndex: 1,
          explanation: "The professional is responsible for the human side — helping clients improve consistency, stay accountable, change behavior, and navigate real-life challenges.",
        },
        {
          id: "fq4",
          question: "A client says: \"I'll try this for a month.\" What should a professional understand?",
          options: [
            "The client is fully committed",
            "The client is probably afraid of failure and uncertain about the process",
            "The client understands nutrition",
            "The client is guaranteed success",
          ],
          correctIndex: 1,
          explanation: "Hesitant language like \"I'll try it\" often signals fear of failure, past frustration, or lack of trust in the process — not confidence or commitment.",
        },
        {
          id: "fq5",
          question: "What is the professional's primary role?",
          options: [
            "Creating hundreds of meal plans manually",
            "Being the smartest nutrition person in the room",
            "Helping clients improve behavior, consistency, and accountability",
            "Controlling every decision the client makes",
          ],
          correctIndex: 2,
          explanation: "The professional's primary role is behavior coaching — helping clients stay consistent, build habits, recover from setbacks, and maintain accountability.",
        },
        {
          id: "fq6",
          question: "What is one of the most common causes of nutrition failure?",
          options: [
            "Lack of recipes",
            "Lack of vegetables",
            "Behavioral inconsistency",
            "Lack of supplements",
          ],
          correctIndex: 2,
          explanation: "Most people do not fail due to lack of information or recipes. Behavioral inconsistency — the inability to follow through over time — is the most common cause of nutrition failure.",
        },
        {
          id: "fq7",
          question: "What should a professional learn first about a new client?",
          options: [
            "The client's favorite supplement",
            "The client's food preferences, habits, and lifestyle",
            "The client's social media accounts",
            "The client's workout playlist",
          ],
          correctIndex: 1,
          explanation: "The first priority is understanding the client — their food preferences, habits, schedule, lifestyle, and goals. This context makes everything else more effective.",
        },
        {
          id: "fq8",
          question: "What is the purpose of Provider Notes?",
          options: [
            "Creating legal contracts",
            "Tracking tax records",
            "Documenting information that helps understand the client",
            "Recording grocery receipts",
          ],
          correctIndex: 2,
          explanation: "Provider Notes are for documenting what matters about the client — favorite foods, stress triggers, family habits, work schedules — so the coaching experience feels personal and informed.",
        },
        {
          id: "fq9",
          question: "Why is compliance important?",
          options: [
            "It helps identify whether recommendations are actually being followed",
            "It increases subscription costs",
            "It replaces coaching",
            "It creates meal plans",
          ],
          correctIndex: 0,
          explanation: "Compliance provides context. Without knowing whether a client is actually following recommendations, it is impossible to accurately evaluate results or make informed adjustments.",
        },
        {
          id: "fq10",
          question: "Which marketing message best aligns with My Perfect Meals?",
          options: [
            "Lose 30 pounds in 30 days",
            "Melt belly fat fast",
            "Learn how to enjoy food while working toward your goals",
            "Guaranteed weight loss",
          ],
          correctIndex: 2,
          explanation: "This message is honest, addresses a real value, and makes no false promises. It reflects the MPM philosophy of education, enjoyment, and realistic progress.",
        },
        {
          id: "fq11",
          question: "What should marketing focus on?",
          options: [
            "Fear",
            "Pressure",
            "Pain zones and solutions",
            "Unrealistic promises",
          ],
          correctIndex: 2,
          explanation: "Effective MPM marketing addresses real pain zones — the situations people struggle with — and presents the platform as a practical solution. Not hype, fear, or false urgency.",
        },
        {
          id: "fq12",
          question: "Why are monthly marketing packages provided?",
          options: [
            "To maintain brand consistency and support affiliate success",
            "To replace communication",
            "To eliminate creativity",
            "To increase pricing",
          ],
          correctIndex: 0,
          explanation: "Monthly marketing packages exist to help affiliates market consistently and professionally — maintaining brand standards while reducing the effort required to create quality content.",
        },
        {
          id: "fq13",
          question: "What is the difference between interest and commitment?",
          options: [
            "There is no difference",
            "Interest is curiosity. Commitment is action.",
            "Interest is stronger than commitment.",
            "Commitment is optional.",
          ],
          correctIndex: 1,
          explanation: "Interest stays at the level of thinking, researching, and waiting. Commitment moves into action — completing onboarding, following the process, and showing up consistently.",
        },
        {
          id: "fq14",
          question: "What creates long-term business success?",
          options: [
            "Motivation",
            "Luck",
            "Consistent action over time",
            "Viral content",
          ],
          correctIndex: 2,
          explanation: "Business success is not created by motivation or luck. It is created by consistent action repeated over time — showing up, learning, communicating, and continuing even when results are not immediate.",
        },
        {
          id: "fq15",
          question: "Why does this certification exist?",
          options: [
            "To make participation difficult",
            "To identify people who are serious about using the system correctly",
            "To increase paperwork",
            "To replace coaching experience",
          ],
          correctIndex: 1,
          explanation: "This certification exists to identify serious, committed professionals — not to create barriers. People willing to invest time learning the system are the ones most likely to use it successfully.",
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
