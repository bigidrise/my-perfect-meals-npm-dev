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
          question: "When a client says, \"I'll try it for a month,\" what are they often expressing?",
          options: [
            "Confidence",
            "Excitement",
            "Fear of failure and lack of trust",
            "Understanding of nutrition",
          ],
          correctIndex: 2,
          explanation: "Hesitant statements like 'I'll try it for a month' often reflect an underlying fear of failure or a lack of trust built from previous unsuccessful attempts.",
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
          question: "Complete the statement: My Perfect Meals manages the complexity of ________, while the professional helps clients manage the complexity of being human.",
          options: [
            "Fitness",
            "Exercise",
            "Nutrition",
            "Motivation",
          ],
          correctIndex: 2,
          explanation: "My Perfect Meals handles the technical complexity of nutrition. The professional's role is to help clients navigate the human side — behavior, consistency, and real-life challenges.",
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
          question: "What does the My Perfect Meals Coaching System allow professionals to focus on?",
          options: [
            "Spending more time calculating recipes",
            "Spending more time creating grocery lists",
            "Spending more time helping people succeed",
            "Spending more time tracking calories",
          ],
          correctIndex: 2,
          explanation: "By handling the technical nutrition workload, MPM frees professionals to focus on what creates the most value — helping people succeed through accountability, support, and behavior coaching.",
        },
        {
          id: "m3q3",
          question: "Which of the following is most likely to prevent a client from succeeding?",
          options: [
            "Lack of food options",
            "Lack of recipes",
            "Behavioral barriers and inconsistency",
            "Lack of protein powder",
          ],
          correctIndex: 2,
          explanation: "The most common obstacle to client success is not a lack of food options or recipes — it is behavioral barriers and inconsistency. Coaches address what technology cannot.",
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
