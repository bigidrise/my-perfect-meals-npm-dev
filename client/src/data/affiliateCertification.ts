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
          question: "What are the two primary affiliate paths discussed in this lesson?",
          options: [
            "Personal and Professional",
            "Medical and Fitness",
            "Coaching Affiliates and Referral Affiliates",
            "Basic and Premium",
          ],
          correctIndex: 2,
          explanation: "The two affiliate paths are Coaching Affiliates — who work directly with clients — and Referral Affiliates — who introduce people to the platform without providing coaching.",
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
    title: "Why MPM Works",
    description: "The problem MPM solves and what makes the platform unique.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "The Problem My Perfect Meals Was Built to Solve",
        text: "For decades, coaches and healthcare providers watched the same pattern repeat: people succeeded when they had professional support — in the gym, at the clinic, in the office. But when they went home, to a restaurant, on a work trip, or out with friends, the guidance wasn't there. Nutrition failed in real life.",
      },
      {
        heading: "AI With a Medical-First Hierarchy",
        text: "MPM uses a 4-layer constraint hierarchy to generate meals that are genuinely personalized. In order of priority:",
        list: [
          "Medical — Physician-assigned clinical protocols override everything. Oncology support, diabetes management, anti-inflammatory requirements.",
          "Dietary Identity — Vegan, keto, carnivore, halal, kosher — the user's foundational dietary rules.",
          "Cultural & Cuisine Preference — Flavor traditions, regional preferences, cuisine style.",
          "Behavioral Preference — Heat tolerance, texture preferences, cooking complexity.",
        ],
      },
      {
        heading: "What Makes MPM Different",
        text: "Most nutrition apps let users track calories or browse recipes. MPM generates meals specifically for each user's situation — accounting for what they can eat, what they should avoid medically, and what they actually enjoy. The AI never invents macro values or overrides medical constraints.",
      },
      {
        heading: "ProCare: The Professional Layer",
        text: "MPM includes ProCare — a coaching and clinical management system where licensed trainers, coaches, and physicians can connect with clients, assign protocols, and monitor progress. ProCare turns MPM into a professional tool, not just a consumer app.",
      },
      {
        heading: "Who Uses MPM",
        list: [
          "People managing weight, chronic conditions, or dietary restrictions",
          "Athletes optimizing nutrition around training",
          "Coaches using it as a client tool through ProCare",
          "Physicians monitoring patient nutrition in clinical protocols",
          "Families with household dietary complexity",
        ],
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m2q1",
          question: "What core problem was My Perfect Meals designed to solve?",
          options: [
            "Making restaurant menus easier to read",
            "Helping people succeed with nutrition outside the gym or clinic — in real life",
            "Replacing personal trainers entirely",
            "Providing free meal delivery",
          ],
          correctIndex: 1,
          explanation: "MPM was built because people succeeded with professional support but struggled to apply that guidance in everyday life situations.",
        },
        {
          id: "m2q2",
          question: "In MPM's 4-layer constraint hierarchy, which need takes the highest priority?",
          options: [
            "Cuisine preference",
            "Behavioral preference",
            "Dietary identity",
            "Medical requirements",
          ],
          correctIndex: 3,
          explanation: "Medical requirements — such as physician-assigned clinical protocols — take the highest priority and override all other preferences in MPM's constraint system.",
        },
        {
          id: "m2q3",
          question: "What is ProCare?",
          options: [
            "A premium recipe subscription",
            "A professional coaching and clinical management layer inside MPM",
            "A free meal planning tier",
            "A supplement delivery service",
          ],
          correctIndex: 1,
          explanation: "ProCare is MPM's professional layer, allowing licensed coaches, trainers, and physicians to manage clients and assign clinical protocols inside the platform.",
        },
        {
          id: "m2q4",
          question: "What does MPM's Macro Truth Contract mean in practice?",
          options: [
            "Users must hit exact macro targets every day",
            "The AI never invents macro values — null means unknown, not zero",
            "Macros are always rounded up to the nearest 10 grams",
            "Coaches set all macro targets manually",
          ],
          correctIndex: 1,
          explanation: "MPM's Macro Truth Contract ensures the AI never invents or fabricates nutritional data. If a value is unknown, it is reported as null — not as zero or an estimate.",
        },
        {
          id: "m2q5",
          question: "Which of the following best describes what makes MPM different from a standard calorie tracker?",
          options: [
            "It has more recipes than competitors",
            "It generates personalized meals using a medical-first AI constraint hierarchy specific to each user",
            "It requires a physician prescription to use",
            "It delivers meals to users' homes",
          ],
          correctIndex: 1,
          explanation: "MPM's core differentiator is AI-powered personalization that respects medical, dietary, cultural, and behavioral constraints — not just calorie counting.",
        },
      ],
    },
  },
  {
    id: "module-3",
    title: "The MPM Method",
    description: "How AI meal generation works and the coaching philosophy behind the platform.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "App Handles Food. Professional Handles People.",
        text: "This principle is central to how MPM works with coaches and healthcare providers. MPM handles the technical complexity of personalized nutrition — generating compliant meals, tracking macros, managing dietary rules. The coach handles what technology can't: motivation, accountability, habit change, and the human relationship.",
      },
      {
        heading: "How Meal Generation Works",
        text: "When a user generates a meal, MPM assembles a protocol envelope — a document containing everything relevant about that user's nutritional profile. This envelope is passed to the AI with strict constraints. The AI generates a meal that satisfies all medical, dietary, and preference rules. If the output doesn't meet the constraints, it is rejected and regenerated, not adjusted or approximated.",
      },
      {
        heading: "Builder Types",
        text: "MPM offers multiple meal generation tools for different situations:",
        list: [
          "Create a Dish — the primary meal builder for any meal of the day",
          "Chef's Kitchen — a guided experience with a signature chef persona",
          "Snack Creator — optimized for between-meal nutrition",
          "Fridge Rescue — generates meals from ingredients a user already has",
          "Craving Creator — satisfies specific cravings within nutritional parameters",
          "Holiday Feast — multi-course generator for special occasions",
          "Meal Planner — generates structured weekly plans",
        ],
      },
      {
        heading: "Clinical Mode",
        text: "Users with physician-assigned conditions operate in clinical mode. In clinical mode, a licensed physician has set specific dietary protocols through ProCare. The user's preferences do not override these protocols. Affiliates should understand this exists but should not attempt to navigate or discuss clinical settings with users.",
      },
      {
        heading: "The Freemium Model",
        text: "MPM uses a free-first model. Basic features — including Fridge Rescue once per week, the Macro Calculator, MacroScan, Biometrics Tracking, and Copilot Voice Guidance — are free. Paid plans unlock the full platform including all builders, weekly planning, specialty hubs, and advanced tracking.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m3q1",
          question: "What does 'App Handles Food, Professional Handles People' mean?",
          options: [
            "The app replaces coaches entirely",
            "MPM handles technical nutrition work so coaches can focus on the human, behavioral side of coaching",
            "Coaches should not use the app with clients",
            "The app manages client relationships automatically",
          ],
          correctIndex: 1,
          explanation: "MPM handles the complex technical nutrition work, freeing coaches and providers to focus on motivation, accountability, and the human relationship.",
        },
        {
          id: "m3q2",
          question: "What happens when MPM generates a meal that doesn't meet a user's constraints?",
          options: [
            "The meal is adjusted by removing offending ingredients",
            "The user is asked to relax their dietary rules",
            "The output is rejected and regenerated — never approximated or adjusted",
            "The coach is notified to review manually",
          ],
          correctIndex: 2,
          explanation: "MPM enforces strict compliance. If a generated meal doesn't satisfy all constraints, it is rejected and regenerated — not modified or approximated.",
        },
        {
          id: "m3q3",
          question: "In clinical mode, what controls the user's dietary protocol?",
          options: [
            "The user's personal preferences",
            "The affiliate's recommendations",
            "A physician-assigned protocol through ProCare",
            "The AI autonomously based on general guidelines",
          ],
          correctIndex: 2,
          explanation: "In clinical mode, a licensed physician has assigned specific dietary protocols through ProCare. These override user preferences and cannot be modified by the user.",
        },
        {
          id: "m3q4",
          question: "Which MPM tool would a user use to generate a meal from ingredients they already have at home?",
          options: [
            "Create a Dish",
            "Meal Planner",
            "Chef's Kitchen",
            "Fridge Rescue",
          ],
          correctIndex: 3,
          explanation: "Fridge Rescue is designed specifically to generate meals from ingredients a user already has at home.",
        },
        {
          id: "m3q5",
          question: "What is included in MPM's free tier?",
          options: [
            "All meal builders with no restrictions",
            "Fridge Rescue once per week, Macro Calculator, MacroScan, Biometrics Tracking, and Copilot Voice Guidance",
            "Unlimited meal generation for 30 days",
            "Access to ProCare coaching",
          ],
          correctIndex: 1,
          explanation: "The free tier includes Fridge Rescue (once weekly), Macro Calculator, MacroScan, Biometrics Tracking, and Copilot Voice Guidance. Full platform access requires a paid plan.",
        },
      ],
    },
  },
  {
    id: "module-4",
    title: "Communicating Value Accurately",
    description: "How to describe MPM honestly, handle questions, and stay compliant.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Accuracy Is Your Foundation",
        text: "Everything you say about My Perfect Meals should be accurate and honest. The most effective affiliates are those who genuinely understand and use the platform — and communicate from that real experience. Overstating capabilities, making false comparisons, or using misleading urgency tactics will damage your credibility and violate affiliate guidelines.",
      },
      {
        heading: "FTC Disclosure Requirements",
        text: "The Federal Trade Commission requires that you clearly and conspicuously disclose your affiliate relationship any time you promote MPM. This means:",
        list: [
          "Stating that you may earn a commission when someone subscribes through your link",
          "Placing the disclosure where it cannot be missed — not buried in fine print",
          "Using plain language: 'I earn commissions from this' or 'affiliate link' are both acceptable",
          "Disclosing on every post or piece of content where the promotion appears",
        ],
      },
      {
        heading: "What You Can Say",
        list: [
          "Personal experience: 'MPM helped me stay on track with my nutrition during a busy travel week.'",
          "Feature descriptions: 'MPM generates personalized meals based on your dietary profile and health goals.'",
          "Factual claims: 'MPM has a free tier that includes the Macro Calculator and Biometrics Tracking.'",
          "Honest comparisons: 'Unlike a basic calorie tracker, MPM generates full meals that fit your specific dietary rules.'",
        ],
      },
      {
        heading: "What You Cannot Say",
        list: [
          "Medical claims: 'MPM cures diabetes' or 'MPM treats heart disease'",
          "Guaranteed outcomes: 'You will lose 20 pounds in 30 days with MPM'",
          "False urgency: 'This offer expires in 24 hours' when it doesn't",
          "Claims about other users' results that you cannot verify",
          "Anything that implies MPM replaces medical care or professional treatment",
        ],
      },
      {
        heading: "Handling Questions You Can't Answer",
        text: "When someone asks whether MPM can help with a specific medical condition, your answer is always: 'MPM is a nutrition platform, not a medical service. I'd recommend speaking with your doctor about whether it fits your situation.' You never provide medical opinions, even if you have a health background.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m4q1",
          question: "When are you required to disclose your affiliate relationship?",
          options: [
            "Only on paid advertising posts",
            "Never — it's optional",
            "Every time you promote MPM in any format",
            "Only when directly asked",
          ],
          correctIndex: 2,
          explanation: "FTC rules require clear, conspicuous disclosure every time you promote MPM — in social posts, videos, emails, and all other content.",
        },
        {
          id: "m4q2",
          question: "Which statement is acceptable for an MPM affiliate to make?",
          options: [
            "'MPM cures type 2 diabetes'",
            "'MPM generated meals that fit my vegan diet and macro targets perfectly'",
            "'Every MPM user loses weight in the first month'",
            "'MPM replaces the need for a registered dietitian'",
          ],
          correctIndex: 1,
          explanation: "Sharing your genuine personal experience with the platform's features is acceptable. Medical claims, guaranteed outcomes, and claims that MPM replaces professional care are all prohibited.",
        },
        {
          id: "m4q3",
          question: "Someone asks if MPM can help treat their Crohn's disease. You should:",
          options: [
            "Confirm it can manage the condition",
            "Tell them MPM is a nutrition platform and recommend they speak with their doctor",
            "Ignore the question",
            "Look up Crohn's disease and provide dietary advice",
          ],
          correctIndex: 1,
          explanation: "You are not qualified to assess medical suitability. Always redirect health-related questions to the person's healthcare provider.",
        },
        {
          id: "m4q4",
          question: "Which of the following is NOT an acceptable affiliate claim?",
          options: [
            "'I earn commissions when you sign up through my link'",
            "'MPM has a free tier with basic features'",
            "'You will definitely lose 15 pounds using MPM'",
            "'MPM generates meals that match your dietary restrictions'",
          ],
          correctIndex: 2,
          explanation: "Guaranteeing specific outcomes like weight loss amounts is prohibited. You cannot promise results that depend on individual factors outside the platform's control.",
        },
        {
          id: "m4q5",
          question: "A proper FTC disclosure looks like:",
          options: [
            "A tiny asterisk at the bottom of a long caption",
            "A clear, visible statement such as 'I earn commissions from this link' placed prominently in the content",
            "A private message to each person who clicks your link",
            "No disclosure is needed if you genuinely believe in the product",
          ],
          correctIndex: 1,
          explanation: "FTC disclosures must be clear, conspicuous, and placed where they cannot be missed — not hidden in fine print or buried in long captions.",
        },
      ],
    },
  },
  {
    id: "module-5",
    title: "Marketing the Right Way",
    description: "Effective promotion strategies and using MPM's marketing resources.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Authentic Promotion Outperforms Forced Promotion",
        text: "The most effective affiliates are those who genuinely use My Perfect Meals and share their real experience. Audiences — whether social media followers, coaching clients, or email subscribers — can tell the difference between someone who actually uses and believes in a product and someone who is simply pushing a link. Build from your authentic experience first.",
      },
      {
        heading: "Monthly Marketing Packets",
        text: "Every month, MPM releases a Marketing Packet inside the Business Center specifically for affiliates. These packets include:",
        list: [
          "Social media graphics sized for major platforms",
          "Caption templates and talking points",
          "Feature spotlight content highlighting new or existing capabilities",
          "Email templates for coaches and professionals",
          "Campaign themes aligned with the current month",
        ],
      },
      {
        heading: "Using Marketing Materials Correctly",
        text: "MPM's marketing assets are designed to be accurate and compliant. When using them:",
        list: [
          "Do not modify health claims in the materials",
          "Add your personal disclosure where required",
          "Use them as a starting point — adding your voice makes them more effective",
          "Do not remove MPM branding or attribution",
        ],
      },
      {
        heading: "Channels That Work",
        text: "There is no single best channel for MPM affiliate promotion. The right channel is the one where your authentic audience already engages with you. Social media, YouTube, podcasts, email newsletters, in-person coaching conversations, and professional referral networks can all be effective depending on who you serve.",
      },
      {
        heading: "What Doesn't Work",
        list: [
          "Mass-posting your referral link without context or explanation",
          "Creating false urgency about limited-time access",
          "Promoting in communities where you haven't built trust",
          "Making promises about results you cannot guarantee",
          "Spamming direct messages to strangers",
        ],
      },
      {
        heading: "Long-Term vs. Short-Term Thinking",
        text: "Affiliates who focus on volume of sign-ups in the first week rarely build sustainable income. Affiliates who consistently educate, share genuine experiences, and refer people who are genuinely good fits for MPM build recurring commission streams that compound over 24-month windows. Think long-term.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m5q1",
          question: "What makes affiliate promotion most effective?",
          options: [
            "Posting your referral link on as many platforms as possible simultaneously",
            "Sharing your genuine experience with MPM with an audience that trusts you",
            "Offering cash rebates to people who sign up",
            "Creating urgency by implying limited availability",
          ],
          correctIndex: 1,
          explanation: "Authentic promotion — sharing your real experience with a trusting audience — is consistently more effective than high-volume or urgency-driven approaches.",
        },
        {
          id: "m5q2",
          question: "Monthly Marketing Packets are available:",
          options: [
            "Via physical mail to your home address",
            "Inside the Business Center inside My Perfect Meals",
            "Through a separate affiliate website",
            "Only for Business & Coaching Affiliates",
          ],
          correctIndex: 1,
          explanation: "Monthly Marketing Packets are delivered digitally inside the Business Center in My Perfect Meals — accessible whenever you need them.",
        },
        {
          id: "m5q3",
          question: "Which best describes the right channel for promoting MPM?",
          options: [
            "Instagram only, because it has the most users",
            "YouTube only, because video converts best",
            "The platform where your authentic audience already engages with you",
            "Only platforms that allow affiliate links without disclosure",
          ],
          correctIndex: 2,
          explanation: "The best channel is always the one where you have already built genuine trust with your audience — regardless of platform.",
        },
        {
          id: "m5q4",
          question: "Which approach represents long-term affiliate success?",
          options: [
            "Maximizing sign-ups in the first 30 days regardless of fit",
            "Consistently referring people who genuinely benefit from MPM, building recurring commissions over time",
            "Only promoting during promotional periods",
            "Focusing entirely on social media follower count",
          ],
          correctIndex: 1,
          explanation: "Long-term success comes from consistently referring users who are genuinely good fits for the platform, building 24-month recurring commission streams.",
        },
        {
          id: "m5q5",
          question: "When using MPM's monthly marketing materials, you should:",
          options: [
            "Use them exactly as provided with no additions",
            "Remove the MPM branding and replace it with your own",
            "Add your personal disclosure and voice while keeping health claims accurate",
            "Only use them if you have over 10,000 followers",
          ],
          correctIndex: 2,
          explanation: "Marketing assets work best when you add your personal voice and required disclosures. Do not modify health claims or remove MPM branding.",
        },
      ],
    },
  },
  {
    id: "module-6",
    title: "Building a Real Business",
    description: "Turning affiliate activity into a sustainable income stream.",
    estimatedMinutes: 15,
    sections: [
      {
        heading: "Affiliate Income Is Recurring, Not One-Time",
        text: "Unlike many affiliate programs that pay a single commission per transaction, MPM pays 30% recurring commissions for up to 24 months. This means a referred user who stays subscribed generates income for you every month — not just on day one. Your goal is to refer people who genuinely benefit from the platform and stay subscribed.",
      },
      {
        heading: "What Unlocks After Certification",
        text: "Completing Affiliate Certification unlocks your full affiliate toolkit:",
        list: [
          "Affiliate Dashboard — your hub for referral links, commission tracking, and performance data",
          "Referral Link Management — unique links for different campaigns and audiences",
          "Marketing Resources — full access to current and archived marketing materials",
          "Monthly Marketing Packets — automatically available each month in the Business Center",
        ],
      },
      {
        heading: "Business & Coaching Affiliates: Additional Resources",
        text: "If you are on the Business & Coaching path, certification also unlocks:",
        list: [
          "Platform Certification — a deeper credentialing in MPM's professional features for use with clients",
          "Business Success Academy — a curriculum for building and scaling a coaching or wellness business using MPM",
        ],
      },
      {
        heading: "Integrating MPM Into Your Practice",
        text: "For coaches and wellness professionals, the most powerful affiliate strategy is genuine integration. When MPM is part of how you actually work with clients — not just a link you share — referrals happen naturally. Clients experience results, ask about the tool you use, and become subscribers through your affiliate link without any sales pressure.",
      },
      {
        heading: "Building for Compounding Returns",
        text: "Think of your affiliate business in 24-month windows. A client who subscribes in month one and stays for 24 months generates 24 commission payments. Referring 10 clients who stay for two years generates significantly more income than referring 50 people who cancel after one month. Quality referrals compound. Quantity without fit does not.",
      },
      {
        heading: "Staying Current",
        text: "My Perfect Meals is an actively developed platform. New features, builders, clinical protocols, and integrations are added regularly. Staying informed — through the Business Center, marketing packets, and platform updates — keeps your promotion accurate and lets you introduce people to the platform's latest capabilities.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "m6q1",
          question: "Why is the 24-month commission window significant for affiliates?",
          options: [
            "It means you only get paid for 24 months total in your career",
            "Referred users who stay subscribed generate recurring commissions for up to 24 months — compounding your income",
            "It limits how long someone can remain your referral",
            "It gives you 24 months to complete certification",
          ],
          correctIndex: 1,
          explanation: "The 24-month recurring commission window means each retained referral generates monthly income for up to two years — rewarding quality referrals over quantity.",
        },
        {
          id: "m6q2",
          question: "What unlocks in your Affiliate Dashboard after completing certification?",
          options: [
            "Access to other users' account data",
            "Referral links, commission tracking, and marketing resources",
            "The ability to set user subscription prices",
            "Free lifetime subscription for yourself",
          ],
          correctIndex: 1,
          explanation: "Certification unlocks the Affiliate Dashboard, which includes referral links, commission tracking, performance data, and marketing resources.",
        },
        {
          id: "m6q3",
          question: "For a Business & Coaching Affiliate, what additional resources become available after certification?",
          options: [
            "Access to physician-only clinical protocols",
            "Platform Certification and the Business Success Academy",
            "The ability to create new users manually",
            "Wholesale pricing on supplement products",
          ],
          correctIndex: 1,
          explanation: "Business & Coaching Affiliates unlock Platform Certification and the Business Success Academy after completing Affiliate Certification.",
        },
        {
          id: "m6q4",
          question: "Which approach generates the most sustainable affiliate income?",
          options: [
            "Referring as many people as possible, regardless of fit, to maximize first-month commissions",
            "Referring people who genuinely benefit from MPM and remain subscribers — building 24-month commission streams",
            "Only referring people during promotional campaigns",
            "Focusing only on one-time payments from annual subscriptions",
          ],
          correctIndex: 1,
          explanation: "Sustainable affiliate income comes from quality referrals who stay subscribed — not from volume of sign-ups that cancel quickly.",
        },
        {
          id: "m6q5",
          question: "How does integrating MPM into your coaching practice benefit your affiliate business?",
          options: [
            "It doesn't — affiliate income is separate from coaching income",
            "It generates natural referrals as clients experience results and ask about the tools you use",
            "It gives you access to clients' private subscription data",
            "It allows you to set client subscription prices directly",
          ],
          correctIndex: 1,
          explanation: "When MPM is genuinely part of your practice, referrals happen naturally — clients experience results, ask about the tool, and subscribe through your link without sales pressure.",
        },
      ],
    },
  },
  {
    id: "final-assessment",
    title: "Final Assessment",
    description: "Comprehensive assessment covering all six modules. Passing score: 80%.",
    estimatedMinutes: 20,
    sections: [
      {
        heading: "Final Assessment",
        text: "This assessment covers all six modules of the Affiliate Certification. You must score 80% or higher to complete your certification. You may review any module before beginning. Take your time — this is about demonstrating genuine understanding, not speed.",
      },
    ],
    quiz: {
      passingScore: PASSING_SCORE,
      questions: [
        {
          id: "fq1",
          question: "Which best describes the primary responsibility of an MPM affiliate?",
          options: [
            "Providing personalized meal plans to referred users",
            "Accurately representing the platform and referring people who will genuinely benefit",
            "Managing the accounts and settings of users they refer",
            "Assigning clinical protocols to new users",
          ],
          correctIndex: 1,
          explanation: "Affiliates represent MPM accurately and refer users who will benefit. Account management and clinical protocol assignment are outside the affiliate role.",
        },
        {
          id: "fq2",
          question: "In MPM's 4-layer constraint hierarchy, what takes the lowest priority?",
          options: [
            "Medical requirements",
            "Dietary identity",
            "Cultural and cuisine preferences",
            "Behavioral preferences",
          ],
          correctIndex: 3,
          explanation: "Behavioral preferences (heat tolerance, texture, cooking complexity) are the fourth and lowest layer. Medical requirements always take the highest priority.",
        },
        {
          id: "fq3",
          question: "FTC disclosure rules require affiliates to:",
          options: [
            "Disclose their relationship only when asked",
            "Place a disclosure at the bottom of their website in small print",
            "Clearly and conspicuously disclose their affiliate relationship every time they promote MPM",
            "Send a private disclosure message to each person who clicks their link",
          ],
          correctIndex: 2,
          explanation: "FTC rules require clear, conspicuous disclosure every time — not just when asked, not buried in fine print, and not limited to private messages.",
        },
        {
          id: "fq4",
          question: "What is ProCare?",
          options: [
            "A premium recipe database available to subscribers",
            "A professional coaching and clinical management layer for licensed providers inside MPM",
            "A free tier feature for all users",
            "A supplement tracking add-on",
          ],
          correctIndex: 1,
          explanation: "ProCare is MPM's professional layer where licensed coaches, trainers, and physicians connect with clients, assign protocols, and monitor nutrition inside the platform.",
        },
        {
          id: "fq5",
          question: "Which statement is acceptable for an affiliate to make?",
          options: [
            "'MPM clinically treats metabolic syndrome'",
            "'Every MPM user loses at least 10 pounds'",
            "'MPM generates personalized meals based on your dietary profile, health goals, and medical context'",
            "'MPM replaces the need for a registered dietitian'",
          ],
          correctIndex: 2,
          explanation: "Accurately describing the platform's features is always acceptable. Medical claims, guaranteed outcomes, and claims that MPM replaces professional care are prohibited.",
        },
        {
          id: "fq6",
          question: "What happens when MPM generates a meal that violates a user's dietary constraints?",
          options: [
            "The meal is modified to remove the offending ingredients",
            "The user is asked to loosen their dietary rules",
            "The output is rejected and regenerated — never approximated",
            "A coach is notified to review the meal manually",
          ],
          correctIndex: 2,
          explanation: "MPM enforces strict constraint compliance. Meals that don't pass are rejected and regenerated — the system never adjusts or approximates around constraints.",
        },
        {
          id: "fq7",
          question: "Monthly Marketing Packets are:",
          options: [
            "Physical materials mailed to affiliates each month",
            "Ready-to-use digital social content, graphics, captions, and campaign materials inside the Business Center",
            "A separate paid subscription service for affiliates",
            "Only available to Business & Coaching Affiliates",
          ],
          correctIndex: 1,
          explanation: "Monthly Marketing Packets are delivered digitally inside the Business Center inside MPM — accessible to all certified affiliates.",
        },
        {
          id: "fq8",
          question: "A referred user subscribes in January and stays subscribed for two years. What is true?",
          options: [
            "You receive one commission payment for their first month",
            "You receive commissions every month for up to 24 months",
            "You receive a single annual payment",
            "Commissions stop after 12 months",
          ],
          correctIndex: 1,
          explanation: "MPM affiliates earn 30% recurring commissions for up to 24 months. A retained subscriber generates monthly income for the full two-year window.",
        },
        {
          id: "fq9",
          question: "For Business & Coaching Affiliates, what becomes available after completing Affiliate Certification?",
          options: [
            "Access to other users' private health data",
            "Platform Certification and the Business Success Academy",
            "The ability to set subscription prices for clients",
            "Free ProCare coaching services",
          ],
          correctIndex: 1,
          explanation: "Business & Coaching Affiliates unlock Platform Certification and the Business Success Academy after completing Affiliate Certification.",
        },
        {
          id: "fq10",
          question: "What does 'App Handles Food, Professional Handles People' mean for coaches who use MPM?",
          options: [
            "Coaches should only use MPM and eliminate all other coaching methods",
            "MPM handles the technical nutrition complexity so coaches can focus on motivation, accountability, and the human relationship",
            "The app manages client relationships automatically",
            "Coaches are not needed when clients use MPM",
          ],
          correctIndex: 1,
          explanation: "This principle describes the division of labor: MPM handles the complex technical nutrition work, while coaches focus on the irreplaceable human elements of coaching.",
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
