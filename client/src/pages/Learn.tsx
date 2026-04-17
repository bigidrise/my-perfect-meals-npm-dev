import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronDown,
  Play,
  Pause,
  Square,
  BookOpenText,
  Headphones,
  Brain,
  Sparkles,
  Calculator,
  Shield,
  Utensils,
  Heart,
  FileText,
  Zap,
  Users,
  Layers,
  Minus,
  Flame,
  Stethoscope,
  Dna,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { useNarration } from "@/hooks/useNarration";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

interface LibraryTopic {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  content: {
    sections: Array<{
      heading: string;
      text?: string;
      list?: string[];
    }>;
  };
}

interface LibrarySection {
  id: string;
  label: string;
  description: string;
  topics: LibraryTopic[];
}

const SECTION_START_HERE: LibraryTopic[] = [
  {
    id: "founder-story",
    title: "Why My Perfect Meals Exists",
    subtitle: "The Story Behind the App",
    icon: BookOpenText,
    content: {
      sections: [
        {
          heading: "The Problem I Saw For 30 Years",
          text: "For more than three decades I worked as a coach helping people lose weight, improve health, and rebuild confidence. The pattern was always the same. When clients trained with me, they succeeded. But when they left the gym and went back into real life, everything became harder."
        },
        {
          heading: "Real Life Is Where Diets Fail",
          text: "Clients struggled at restaurants, on vacation, while traveling for work, or even just going out with friends. Many would tell me the same thing: I wish you were here right now so you could tell me what to eat."
        },
        {
          heading: "The Phrase That Started Everything",
          text: "Over time one sentence kept coming up again and again from clients: I wish you were in my pocket. That idea stayed with me for years."
        },
        {
          heading: "What I Saw In Other Nutrition Apps",
          text: "When I started studying nutrition apps on the market, I realized something frustrating. Most were built by technology companies focused on calorie tracking and generic recipes. They were not built by coaches who actually work with clients every day."
        },
        {
          heading: "Why Those Apps Didn't Work",
          list: [
            "Recipes were generic and not personalized",
            "Medical conditions like diabetes were rarely considered",
            "Liver issues, inflammation, and allergies were ignored",
            "Users were left to figure everything out themselves",
            "Many apps called themselves coaching, but there was no real guidance"
          ]
        },
        {
          heading: "Real Coaching Works Differently",
          text: "A real coach does not simply watch and hope the client figures things out. A coach provides structure, direction, and accountability."
        },
        {
          heading: "The Turning Point",
          text: "After a neck injury caused by a drunk driver forced me to rethink my career path, I began exploring whether technology could finally solve this problem."
        },
        {
          heading: "Building The System",
          text: "In June of last year I began building what would become My Perfect Meals."
        },
        {
          heading: "The Mission",
          text: "The goal is simple. To give people what my clients asked for years ago: a coach in their pocket."
        }
      ]
    }
  },
  {
    id: "meal-builder",
    title: "How Meal Builders & Support Systems Work",
    subtitle: "Builders, medical layers, and your plan",
    icon: Layers,
    content: {
      sections: [
        {
          heading: "This Isn't Just a Meal Generator",
          text: "Most nutrition apps give you generic meals and hope you figure it out. My Perfect Meals works differently. Every meal comes from a structured system built around your goals, your body, your preferences, and when needed, your medical context. You're not just getting meals — you're getting guided decisions before you eat.",
        },
        {
          heading: "The Two-Layer System",
          text: "Everything in the app runs on two layers. Layer 1 is your Meal Builder — your foundation that determines the type of meals you get. Layer 2 is your Support System — additional rules applied on top when needed based on health needs or physician guidance.",
        },
        {
          heading: "General Nutrition",
          text: "Your everyday system. Best for fat loss, maintenance, and building consistency. Balanced meals, real-life eating, sustainability.",
        },
        {
          heading: "Performance & Competition",
          text: "Built for serious training and physique goals. Higher precision, performance fueling, muscle support.",
        },
        {
          heading: "Anti-Inflammatory",
          text: "Your clinical-friendly foundation. Best for inflammation concerns, autoimmune support, and physician-guided nutrition. Cleaner ingredients, reduced inflammatory patterns, structured meals.",
        },
        {
          heading: "Diabetic",
          text: "Built for blood sugar awareness. Carb control, glucose stability, real-time adjustments through GlucoseGuard.",
        },
        {
          heading: "GLP-1 Support",
          text: "Built for reduced appetite environments. Nutrient density, protein priority, easier-to-finish meals for GLP-1 users.",
        },
        {
          heading: "Create a Dish",
          text: "Creates one complete dish at a time. Not a meal plan — a real cooking tool. Step-by-step execution, real kitchen meals, practical prep.",
        },
        {
          heading: "Craving Creator",
          text: "You tell the app what you want. It makes it fit your plan. Satisfying cravings, macro-aligned versions, no guilt approach.",
        },
        {
          heading: "Dessert Creator",
          text: "Desserts that actually fit your numbers. Portion-aware treats, realistic enjoyment, controlled indulgence.",
        },
        {
          heading: "Fridge Rescue",
          text: "Uses what you already have. Best for leftovers, low-effort days, and real-life situations where you just need a solution.",
        },
        {
          heading: "Support Systems (When Needed)",
          text: "Support systems are not separate builders. They are layers added on top of your meals when needed. They adjust ingredients, preparation style, food texture, and meal structure — without breaking your macros.",
        },
        {
          heading: "Cardiac Support",
          text: "Heart-aware meal structure. Emphasizes better fat quality, smarter sodium awareness, and supportive ingredient choices.",
        },
        {
          heading: "Liver Support",
          text: "Reduces strain on the liver. Cleaner foods, reduced processed load, supportive nutrition patterns.",
        },
        {
          heading: "Kidney / Renal Support",
          text: "Adds kidney-conscious structure. Physician-guided restrictions and careful ingredient selection.",
        },
        {
          heading: "Lipid Support",
          text: "Supports cholesterol and lipid goals. Focus on fat quality, fiber, and heart-supportive meals.",
        },
        {
          heading: "Cancer Support Nutrition (Physician Assigned)",
          text: "A physician-assigned support system — not treatment or medical care. Built on an anti-inflammatory foundation with protein support, easier-to-tolerate meals, appetite-aware structure, and symptom-sensitive adjustments. Examples include low-appetite support, nausea-friendly meals, soft food options, and low-prep meals during fatigue.",
        },
        {
          heading: "With a Coach or Physician (ProCare)",
          text: "When you connect with a professional through ProCare, they can assign your meal builder, apply support systems, and adjust your plan in real time. You still own your plan. They guide it.",
        },
        {
          heading: "Why This Matters",
          text: "Most apps track what you already ate. This app helps you decide what to eat before you eat it. That's where results actually happen — not in the log, but in the decision.",
        },
        {
          heading: "Important",
          text: "My Perfect Meals provides nutrition guidance only. It does not diagnose, treat, or replace medical care. Always follow your physician's recommendations for any medical condition.",
        },
      ],
    },
  },
  {
    id: "why-different",
    title: "Why This App Is Different",
    subtitle: "A coaching app that leads you — not another log-and-hope tracker",
    icon: Zap,
    content: {
      sections: [
        {
          heading: "Every Other App Says Good Luck",
          text: "Most nutrition apps hand you a log and walk away. You check boxes. You track entries. When motivation runs out — and it always does — there is nothing there to guide you. That is not coaching. That is bookkeeping.",
        },
        {
          heading: "This App Actually Leads You",
          text: "My Perfect Meals tells you what to eat before you eat it. It builds your week. It adjusts when things change. It guides every decision — breakfast to dinner — so you are never left wondering what to do next. Other apps react after the fact. This one responds before your next decision.",
        },
        {
          heading: "Powered by Behavior AI",
          text: "The app does not just generate meals. It learns how you eat. It notices what you choose, what you skip, and what you come back to. Over time it adapts — not just to your numbers, but to your actual behavior. That is the part most apps cannot do.",
        },
        {
          heading: "What Makes It Different",
          list: [
            "Other apps track what you already ate — this one guides what you eat next",
            "Other apps show data and leave you to figure it out — this one makes the decision for you",
            "Other apps are passive — this one leads",
            "Follow the plan and results are guaranteed — not magic, just the math and structure working",
          ],
        },
        {
          heading: "A Coach in Your Pocket — Not a Replacement for One",
          text: "This is not a theory. Clients have gotten results for years following the same principles this app runs on — eat the right things at the right amounts for your body, stay consistent. The app brings that structure to people who do not have a trainer or coach beside them every day. But nothing replaces the nuance, judgment, and relationship of working with a real professional. That is why the app is built to support coaches and clinicians — not compete with them. When a coach is in the picture, the app follows their lead.",
        },
      ],
    },
  },
];

const SECTION_CORE_SYSTEMS: LibraryTopic[] = [
  {
    id: "meal-generation",
    title: "How Meal Generation Works",
    subtitle: "AI, macros, and real-time creation",
    icon: Sparkles,
    content: {
      sections: [
        {
          heading: "AI-Powered Meal Creation",
          text: "Every meal is generated in real-time using GPT-4, tailored to your exact macro targets, dietary restrictions, and preferences.",
        },
        {
          heading: "Baseline Macros Per Meal",
          text: "Unless you specify otherwise, every generated meal starts with a balanced baseline:",
          list: [
            "25g Protein — to support muscle and satiety",
            "25g Starchy Carbs — for energy and fuel",
            "50g Fibrous Carbs — for fiber, vitamins, and volume",
          ],
        },
        {
          heading: "Where This Applies",
          list: [
            "Weekly Meal Builder",
            "Anti-Inflammatory Meal Builder",
            "General Nutrition Meal Builder",
            "Diabetic Meal Builder",
            "Create a Dish",
            "Fridge Rescue & Fridge Rescue Studio",
          ],
        },
        {
          heading: "Want More?",
          text: "This baseline ensures balanced meals by default. If you want higher protein, more carbs, or different ratios — just ask when creating your meal. The AI will adjust accordingly.",
        },
        {
          heading: "The Process",
          list: [
            "You set your protein, carbs, and fat targets",
            "AI generates meals that hit those numbers precisely",
            "DALL-E creates matching food imagery",
            "Recipes include step-by-step instructions",
          ],
        },
        {
          heading: "Quality Control",
          text: "Generated meals go through validation to ensure nutritional accuracy. If something doesn't add up, it gets regenerated.",
        },
        {
          heading: "How the Diabetic Hub Changes Meal Generation",
          text: "When the Diabetic Hub is active, meal generation does not just adjust macros — it enforces a clinical layer on top of every decision the AI makes.",
          list: [
            "A per-meal carb ceiling replaces the default starchy carb baseline — the AI cannot exceed it",
            "High-spike ingredients (white rice, white bread, sugary sauces, high-GI starches) are blocked entirely — not just reduced",
            "Ingredient validation runs before any meal is accepted — blocked items trigger a full regeneration",
            "Glycemic index caps are enforced: no ingredient above your set GI ceiling passes validation",
            "Fiber minimums are enforced per meal to slow glucose absorption",
            "Meal frequency is locked to your hub setting — the system won't suggest more meals than your protocol allows",
          ],
        },
        {
          heading: "What This Means in Practice",
          text: "A meal that looks healthy — like a banana smoothie or honey-glazed chicken — will be blocked if its ingredients spike blood sugar above your safe range. The system checks ingredients, not just meal names. You will never receive a meal that violates your diabetic guardrails, even if it sounds clean on the surface.",
        },
        {
          heading: "How the GLP-1 Hub Changes Meal Generation",
          text: "When the GLP-1 Hub is active, the AI generates meals built for a reduced-appetite environment — not just smaller portions, but a fundamentally different composition.",
          list: [
            "Maximum meal volume is enforced — meals are designed to be completable, not just nutritious",
            "Protein minimum per meal is enforced — muscle support is prioritized when appetite is suppressed",
            "Fat ceiling limits heavy, slow-digesting meals that cause discomfort during the active medication phase",
            "Carbonated ingredients and alcohol are flagged and removed when those settings are active",
            "Slow-digesting foods are prioritized when that setting is on — helping sustain fullness between meals",
            "Meal count is locked to your GLP-1 profile setting — the system adapts to how many meals you can realistically eat per day",
          ],
        },
        {
          heading: "When Both Hubs Are Active",
          text: "If you have both the Diabetic Hub and GLP-1 Hub active at the same time, every generated meal must satisfy both protocols simultaneously. Carb ceilings, GI caps, and blocked ingredients apply from the diabetic layer. Portion limits, protein floors, and volume constraints apply from the GLP-1 layer. The strictest rule from either hub always wins.",
        },
      ],
    },
  },
  {
    id: "macro-calculator",
    title: "How the Macro Calculator Works",
    subtitle: "Science-based, personalized numbers",
    icon: Calculator,
    content: {
      sections: [
        {
          heading: "Science-Based Calculations",
          text: "Your macros are calculated using the Mifflin-St Jeor equation, the gold standard for estimating metabolic rate.",
        },
        {
          heading: "Factors Considered",
          list: [
            "Age, sex, height, and weight",
            "Activity level and exercise frequency",
            "Your specific goal (lose fat, build muscle, maintain)",
            "Metabolic considerations like diabetes or GLP-1 use",
          ],
        },
        {
          heading: "Personalization",
          text: "These aren't generic numbers. They're calculated specifically for your body and adjusted as you progress.",
        },
      ],
    },
  },
  {
    id: "nutrition-budget",
    title: "Nutrition Budget — Daily Tracking",
    subtitle: "Real-time progress through your day",
    icon: Calculator,
    content: {
      sections: [
        {
          heading: "What Is the Nutrition Budget?",
          text: "The Nutrition Budget is a real-time tracking system that shows how much of your daily nutrition targets you've used — and what's left. It focuses on the three nutrients that matter most: Protein, Starchy Carbs, and Fibrous Carbs.",
        },
        {
          heading: "How It Works",
          list: [
            "Your targets come from the Macro Calculator — one authoritative source",
            "As you add meals throughout the day, the budget updates automatically",
            "A banner at the top of each meal builder shows what's remaining",
            "When a nutrient is covered, you'll see a checkmark and gentle coaching",
          ],
        },
        {
          heading: "What You'll See",
          list: [
            "Protein, Starchy Carbs, and Fiber remaining for the day",
            "Helpful coaching when you're running low or covered",
            "Forward-looking guidance — no judgment, just awareness",
          ],
        },
        {
          heading: "Works With Starch Guard",
          text: "When your starchy carb budget is exhausted, Starch Guard steps in to help you substitute with fibrous carbs. See the Starch Guard section for details.",
        },
        {
          heading: "Why It Exists",
          text: "Most apps show you what you already ate. The Nutrition Budget shows you where you're headed — so every meal decision is informed, not guessed.",
        },
      ],
    },
  },
  {
    id: "compliance-system",
    title: "Compliance System",
    subtitle: "Macro adherence & coaching analytics",
    icon: Shield,
    content: {
      sections: [
        {
          heading: "What Is Compliance?",
          text: "Compliance measures how closely your daily nutrition matches the macro targets set in the Macro Calculator. Instead of judging foods, the system measures consistency with the plan designed for you.",
        },
        {
          heading: "What Gets Measured",
          list: [
            "Macro adherence — how closely your protein, carbs, and fat match your targets",
            "Logging consistency — how regularly meals are recorded",
            "Daily averages across the last 7 days",
          ],
        },
        {
          heading: "Why Compliance Matters",
          text: "In nutrition coaching, results come from consistency. Compliance helps your coach understand whether a program needs adjustment or whether the strategy simply needs more time.",
        },
        {
          heading: "How Coaches Use It",
          list: [
            "Identify when a client is following the program closely",
            "Detect when logging habits drop off",
            "Determine whether program changes are necessary",
          ],
        },
        {
          heading: "Important",
          text: "Compliance is not a grade. It is simply a signal that helps you and your coach understand what is happening so better decisions can be made.",
        },
      ],
    },
  },
];

const SECTION_NUTRITION_STRATEGY: LibraryTopic[] = [
  {
    id: "starchguard",
    title: "Starch Guard — Weight Management",
    subtitle: "Portion and frequency control for carbs",
    icon: Flame,
    content: {
      sections: [
        {
          heading: "What Is Starch Guard?",
          text: "Starch Guard is not a food blocker. It is a portion and frequency management system for insulin stimulating carbs.\n\nNo foods are labeled good or bad in this app. A food only moves you toward or away from your current goal. Starch Guard exists to help you enjoy the foods you like while keeping insulin exposure aligned with where you are trying to go.\n\nYou can eat potatoes. You can eat rice. You can eat pasta. Starch Guard simply helps control how often and how much of those foods appear across your day.",
        },
        {
          heading: "The Science Behind It",
          text: "Not all carbohydrates affect the body the same way.\n\nStarches and sugars break down quickly into glucose. Glucose raises blood sugar. Blood sugar triggers insulin. Insulin is the hormone that signals your body to store energy, including fat.\n\nInsulin itself is not bad. Repeated, frequent insulin spikes over time are what make weight control harder for most people.\n\nFibrous carbohydrates digest more slowly, produce a smaller insulin response, and provide volume, nutrients, and satiety. That is why the app emphasizes fibrous carbs once starch needs are met.\n\nThis is also why the app focuses more on starch than sodium. Sodium can cause temporary water weight that resolves quickly. Insulin driven weight gain is a longer term process. Managing insulin exposure is the lever that matters most for sustainable results.",
        },
        {
          heading: "What Starch Guard Manages",
          text: "Starch Guard does not ban foods. It manages high impact starch portions across the day.\n\nThese foods are treated as starch meals because they raise blood sugar more quickly in typical servings:",
          list: [
            "Potatoes and potato based dishes",
            "Rice and rice based dishes",
            "Bread, pasta, noodles, and refined flour products",
            "Pancakes, waffles, and similar starch dense foods",
          ],
        },
        {
          heading: "What Happens After Starch Is Covered",
          text: "Once your starch allocation for the day is used, the app guides you toward fibrous carbohydrates instead.\n\nFibrous carbs provide steady energy, fiber and micronutrients, a lower insulin response, and greater food volume.",
          list: [
            "Vegetables like broccoli, asparagus, spinach, and peppers",
            "Beans, lentils, and chickpeas",
            "Whole foods where fiber slows digestion",
          ],
        },
        {
          heading: "How Starch Guard Works in Practice",
          text: "You receive a set number of starch meals per day based on your strategy and goals.\n\nWhen you request a meal with a starch after that allocation is covered, Starch Guard pauses meal creation and gives you two options:",
          list: [
            "Choose a different carb that fits the current phase of your day",
            "Let Chef substitute a fibrous carb automatically",
          ],
        },
        {
          heading: "Why This Matters",
          text: "Foods do not cause weight gain. Context does.\n\nYou can gain weight with healthy foods and lose weight while eating foods people call unhealthy. What matters is portion size, frequency, and direction.\n\nStarch Guard removes food guilt and replaces it with structure. It allows enjoyment without loss of control. It helps you eat freely while still moving forward.\n\nThat is the strategy.",
        },
        {
          heading: "Why Timing Matters",
          text: "The app distributes starchy carbs intentionally — not just how many, but when.\n\nThink of your body like a business. During the day it is open and running operations. It can put starchy carbs to work for energy, focus, and performance. At night it shifts into a different mode — one focused on cleaning, repairing, and resetting.\n\nIf you keep sending energy demands in late at night, it can interfere with that recovery process. This is why concentrating starchy carbs earlier in the day can support your energy during active hours, your recovery while you sleep, and your overall sleep quality.\n\nLate fast-digesting carbs may keep your body metabolically active when it is supposed to be winding down. Shifting them earlier gives your system the space it needs to do its overnight work.",
        },
        {
          heading: "This Is a Strategy, Not a Restriction",
          text: "Starch timing is not a rule. It is a framework.\n\nIf you train late in the evening, your body has different energy demands at night. If your schedule works better with carbs distributed differently, that flexibility is built in.\n\nYou can choose One Starch Meal — which concentrates starchy carbs into a single meal — or Flex Split — which spreads them across two meals. Either way, the system adapts to your life.\n\nThe goal is to give your body what it needs, when it needs it. Not to restrict. Not to frustrate. To support.",
        },
      ],
    },
  },
  {
    id: "vegetable-volume",
    title: "Vegetable Volume System",
    subtitle: "Stay full and satisfied, even on low carbs",
    icon: Utensils,
    content: {
      sections: [
        {
          heading: "The Core Idea",
          text: "Most nutrition apps reduce your food when carbs or calories go down. That leads to hunger, frustration, and eventually quitting. My Perfect Meals does the opposite. When starchy carbs go down, vegetables go up.",
        },
        {
          heading: "Why This Works",
          list: [
            "Vegetables increase fullness without excess calories",
            "They provide volume so your meals still feel complete",
            "They support digestion and overall health",
            "They help you stay consistent instead of feeling restricted",
          ],
        },
        {
          heading: "How It Works In Your Plan",
          text: "Your vegetable intake is based on your nutrition strategy and meals per day. Instead of just tracking fiber, the app assigns a real-world vegetable target per meal.",
        },
        {
          heading: "Typical Vegetable Targets",
          list: [
            "Standard plan: about 3–4 cups of vegetables per meal",
            "Low carb: about 4–5 cups per meal",
            "Zero starch or hard cut: about 5–6 cups per meal",
          ],
        },
        {
          heading: "What You'll Notice",
          list: [
            "Bigger meals even when carbs are lower",
            "Less hunger throughout the day",
            "More vegetables automatically added to meals",
            "Smart substitutions like cauliflower instead of rice",
          ],
        },
        {
          heading: "How It Connects To Meal Builders",
          text: "Once your macro calculator sets your strategy, every meal builder follows it automatically. If your plan is low starch, the app will replace foods like rice or potatoes with vegetable-based options while increasing your vegetable portions.",
        },
        {
          heading: "The Bottom Line",
          text: "You are not eating less food. You are eating smarter. The Vegetable Volume System is how the app keeps you full while still moving toward your goals.",
        },
      ],
    },
  },
  {
    id: "keep-it-simple",
    title: "Keep It Simple — Ingredient Control",
    subtitle: "Use only what you listed. Nothing else.",
    icon: Minus,
    content: {
      sections: [
        {
          heading: "What Is Keep It Simple?",
          text: "Keep It Simple is an ingredient control switch. When it is turned on, the AI uses only the ingredients you described — nothing more. No vegetables added. No balancing sides. No pantry staples slipped in. If you did not say it, it does not exist in your meal.",
        },
        {
          heading: "Why This Matters",
          text: "By default, My Perfect Meals is designed to help you hit your nutrition targets. That means the AI may add vegetables, fibrous carbs, or balancing ingredients to round out your meal. That system works great most of the time. But sometimes you just want exactly what you asked for — eggs, bacon, and toast — and nothing else. Keep It Simple gives you that control.",
        },
        {
          heading: "When To Use It",
          list: [
            "You want a specific meal exactly as described with no additions",
            "You already know what you are eating and just need the recipe",
            "You have limited ingredients and do not want substitutions",
            "You are tracking your own macros and do not want the AI adjusting the meal",
          ],
        },
        {
          heading: "What It Turns Off",
          list: [
            "Vegetable Volume System — no automatic vegetable additions",
            "Fibrous carb enforcement — no sides or balancing greens added",
            "Nutrition balance guardrails — no wholefood priority adjustments",
            "Ingredient suggestions — the AI sticks strictly to your description",
          ],
        },
        {
          heading: "Where To Find It",
          list: [
            "Craving Creator — under Ingredient Control",
            "Fridge Rescue — under Ingredient Control",
            "Create a Dish — under Ingredient Control",
            "Dessert Creator — under Ingredient Control",
            "Create with AI Chef — under Ingredient Control inside the meal builder modal",
          ],
        },
        {
          heading: "How To Use It",
          text: "Look for the Keep It Simple toggle in the Ingredient Control section of any generator. Tap it once to turn it on — it lights up sky blue when active. Tap again to turn it off. It resets to off each time you open a new generator session so it never surprises you.",
        },
        {
          heading: "Important",
          text: "Keep It Simple is not the default. The app is designed to help you reach your goals automatically. This switch exists for moments when you want full control over exactly what goes into your meal — no more, no less.",
        },
      ],
    },
  },
  {
    id: "palate-preferences",
    title: "Palate Preferences",
    subtitle: "Flavor customization without macro impact",
    icon: Utensils,
    content: {
      sections: [
        {
          heading: "What Are Palate Preferences?",
          text: "By default, AI-generated meals are lightly seasoned to be safe for most palates. But everyone's taste is different. Palate Preferences let you tell the AI exactly how you like your food flavored — without affecting your macros.",
        },
        {
          heading: "What You Can Customize",
          list: [
            "Spice Tolerance — from no heat at all to bring-on-the-fire",
            "Seasoning Intensity — light and subtle to bold and pronounced",
            "Flavor Style — classic comfort, herb-forward, savory umami, or bright and fresh",
          ],
        },
        {
          heading: "How It Works",
          list: [
            "Set your preferences during onboarding or update them anytime in Edit Profile",
            "The AI reads your palate profile when generating every meal",
            "Your macros stay exactly the same — only the flavor changes",
            "No more bland meals if you love bold seasoning",
          ],
        },
        {
          heading: "Why It Exists",
          text: "Nutrition apps often produce generic, underseasoned meals. Palate Preferences fix that by making flavor personal. If you want garlic, herbs, and heat — you'll get it. If you prefer mild and classic — that's what you'll see.",
        },
      ],
    },
  },
  {
    id: "cravings",
    title: "How Cravings Are Handled",
    subtitle: "Satisfy what you want, stay on plan",
    icon: Heart,
    content: {
      sections: [
        {
          heading: "Cravings Aren't the Enemy",
          text: "Instead of telling you to ignore cravings, the app helps you satisfy them within your macro budget.",
        },
        {
          heading: "The Approach",
          list: [
            "Tell the app what you're craving",
            "It generates a version that fits your macros",
            "You eat what you want without going off track",
            "No guilt, no willpower battles",
          ],
        },
        {
          heading: "The Result",
          text: "Sustainable nutrition means not fighting your body. It means working with it.",
        },
      ],
    },
  },
];

const SECTION_HEALTH_SAFETY: LibraryTopic[] = [
  {
    id: "safetyguard",
    title: "SafetyGuard™ — Allergy Protection",
    subtitle: "Two-layer protection, always on",
    icon: Shield,
    content: {
      sections: [
        {
          heading: "What Is SafetyGuard?",
          text: "SafetyGuard is My Perfect Meals' two-layer allergy protection system. It's designed to help prevent meals from being created with ingredients you've marked as unsafe.",
        },
        {
          heading: "How SafetyGuard Works",
          list: [
            "Pre-generation checks stop meals that include known allergens before they're created",
            "Post-generation validation scans ingredients and nutrition before a meal is shown",
            "Protection is always on by default",
            "Temporary overrides require a personal Safety PIN and apply to one meal only",
          ],
        },
        {
          heading: "Why It Exists",
          text: "Food allergies are serious. SafetyGuard is designed to add structure and intentional decision-making at the exact moment meals are created.",
        },
      ],
    },
  },
  {
    id: "glucoseguard",
    title: "GlucoseGuard™",
    subtitle: "Real-time diabetic meal adjustment",
    icon: Heart,
    content: {
      sections: [
        {
          heading: "What Is GlucoseGuard?",
          text: "GlucoseGuard is for diabetics only. It reads your actual blood glucose level (mg/dL) from the Diabetic Hub and adjusts meal generation based on your current glucose state.",
        },
        {
          heading: "How GlucoseGuard Works",
          list: [
            "Reads your latest glucose log from the Diabetic Hub",
            "When glucose is low, meals include more carbs to help stabilize",
            "When glucose is elevated, meals go lower carb to help bring you back into range",
            "Only appears in the Diabetic Hub and Diabetic Meal Builder",
          ],
        },
        {
          heading: "This Is Different From Starch Guard",
          text: "Starch Guard is about weight management and limiting high-glycemic carbs. GlucoseGuard is about real-time glucose monitoring for diabetics. Most users don't need GlucoseGuard — they need Starch Guard.",
        },
        {
          heading: "What It Does Not Do",
          list: [
            "Does not diagnose, treat, or manage diabetes",
            "Does not monitor blood glucose or adjust medications",
            "Does not replace medical care or professional advice",
          ],
        },
      ],
    },
  },
  {
    id: "waist-risk",
    title: "Waist-to-Height Risk",
    subtitle: "Metabolic health indicator",
    icon: Stethoscope,
    content: {
      sections: [
        {
          heading: "Why Waist Size Matters",
          text: "Waist circumference is one of the strongest predictors of metabolic and cardiovascular risk. Fat stored around the abdomen is more strongly linked to insulin resistance and heart disease than overall body weight.",
        },
        {
          heading: "Waist-to-Height Ratio",
          text: "A common guideline used in medical research is keeping waist circumference less than half of your height.",
        },
        {
          heading: "Risk Categories",
          list: [
            "Green: Ratio below 0.50",
            "Yellow: Ratio between 0.50 and 0.59",
            "Red: Ratio 0.60 or higher",
          ],
        },
        {
          heading: "How The App Uses This",
          list: [
            "Provides a visual risk indicator",
            "Helps coaches understand metabolic health trends",
            "Supports adjustments to nutrition strategies",
          ],
        },
        {
          heading: "Medical Sources",
          list: [
            "World Health Organization",
            "National Institutes of Health",
            "American Diabetes Association",
          ],
        },
      ],
    },
  },
  {
    id: "medical-sources",
    title: "Medical & Nutrition Sources",
    subtitle: "Where the guidance comes from",
    icon: FileText,
    content: {
      sections: [
        {
          heading: "Where the Data Comes From",
          text: "All nutritional calculations and recommendations are based on peer-reviewed research and official guidelines.",
        },
        {
          heading: "Primary Sources",
          list: [
            "National Institutes of Health (NIH) — nih.gov",
            "U.S. Department of Agriculture (USDA) — usda.gov",
            "American Diabetes Association (ADA) — diabetes.org",
            "World Health Organization (WHO) — who.int",
            "Academy of Nutrition and Dietetics — eatright.org",
            "Centers for Disease Control (CDC) — cdc.gov",
          ],
        },
        {
          heading: "Medical Disclaimer",
          text: "This app provides nutritional information, not medical advice. Always consult a healthcare professional before making significant dietary changes, especially if you have a medical condition.",
        },
      ],
    },
  },
];

const SECTION_SPECIALIZED: LibraryTopic[] = [
  {
    id: "specialty-diets",
    title: "Specialty Diets & Protocol System",
    subtitle: "Kosher · Halal · Vegan · Gluten-Free · and more",
    icon: Dna,
    content: {
      sections: [
        {
          heading: "What This System Does",
          text: "My Perfect Meals doesn't just generate food. It enforces your dietary identity, your health needs, and your preparation rules — all at the same time. The system checks every meal before and after creation, so your protocol is respected at every level.",
        },
        {
          heading: "The Three Levels of Compliance",
          list: [
            "Ingredient level — forbidden ingredients are blocked before the AI generates anything",
            "Combination level — foods that cannot be combined under your protocol are detected, such as meat and dairy for kosher users",
            "Preparation and instruction level — cooking steps are scanned for phrases that would violate your protocol, such as deglazing with wine for halal users or finishing a meat dish with butter for kosher users",
          ],
        },
        {
          heading: "How Priority Works",
          text: "Your dietary identity is the outer wall. Everything else — medical limits, avoidances, and flavor preferences — is applied inside it. No craving, health goal, or preference can override your dietary protocol.",
        },
        {
          heading: "Checked Before and After",
          text: "Before the AI generates your meal, the full protocol is injected into the system as a structured set of rules. After generation, every result is scanned again — checking ingredient names, derivative terms, and forbidden instruction phrases — before you ever see it.",
        },
        {
          heading: "Dietary Protocol Sources",
          text: "This system is informed by recognized dietary and certification guidance from sources such as Orthodox Union, Star-K, OK Kosher Certification, and the Islamic Food and Nutrition Council of America (IFANCA).",
        },
        {
          heading: "Important Note",
          text: "This system is designed to guide compliant meal choices. For strict religious or medical adherence, always follow the guidance of your local religious authority or licensed physician.",
        },
      ],
    },
  },
  {
    id: "ultimate-experiences",
    title: "Ultimate Experiences",
    subtitle: "Multi-course AI meal planning for any occasion",
    icon: Sparkles,
    content: {
      sections: [
        {
          heading: "What Is Ultimate Experiences?",
          text: "Ultimate Experiences is a multi-course meal planner built for intentional eating. Instead of generating a single meal, it designs a complete dining experience — appetizer, main course, side dishes, and dessert — all connected to the same situation, flavor profile, and occasion.",
        },
        {
          heading: "How It Works",
          list: [
            "Choose your situation: holiday, camping, date night, family dinner, or more",
            "Set the number of people and courses you want",
            "Pick a flavor direction or let Chef choose for you",
            "Optionally pin specific dishes to any course or paste in a family recipe",
            "Chef generates every course as part of a single cohesive meal — not a random collection",
          ],
        },
        {
          heading: "What Makes It Different",
          text: "Every course is built with awareness of the others. The system enforces course roles, cooking method diversity, ingredient balance, and strict duplication rules — so you never get three potato dishes in the same meal. The result feels like a chef designed it, not an algorithm.",
        },
        {
          heading: "Supported Situations",
          list: [
            "Holidays: Thanksgiving, Christmas, Hanukkah, Easter, Passover, Eid, and more",
            "Camping: fire-cooked, foil packet, skillet, and no-cook courses",
            "Date Night: elegant multi-course dining at home",
            "Family Dinner: comfort food designed for a crowd",
            "Game Day, Potluck, Backyard BBQ, and more",
          ],
        },
        {
          heading: "Family Recipes",
          text: "You can paste in a family recipe during the holiday experience. Chef will use it as the anchor for that course and build the rest of the meal around it — so tradition stays intact while the full experience is elevated.",
        },
        {
          heading: "Where to Find It",
          list: [
            "Lifestyle Hub — Ultimate Experiences card",
            "Included with Premium and Ultimate subscriptions",
          ],
        },
      ],
    },
  },
  {
    id: "fast-food-guide",
    title: "Fast Food Guide",
    subtitle: "Smart ordering at fast food restaurants",
    icon: Zap,
    content: {
      sections: [
        {
          heading: "What Is the Fast Food Guide?",
          text: "The Fast Food Guide gives you three smart, goal-aligned meal choices at any fast food restaurant. It uses the same AI engine as the Restaurant Guide, but focused specifically on fast food chains — McDonald's, Chick-fil-A, Taco Bell, and any other chain you're heading to.",
        },
        {
          heading: "How It Works",
          list: [
            "Tell the app which fast food restaurant you're going to",
            "Describe what you're in the mood for — or leave it open",
            "Enter your location so the app confirms the restaurant exists nearby",
            "Receive three smart meal options with estimated macros and an ordering tip",
            "Log any option to your Biometrics with one tap",
          ],
        },
        {
          heading: "Why It Exists",
          text: "Fast food is a real part of life — road trips, kids, late nights, busy weeks. The Fast Food Guide exists because ignoring that reality does not help anyone. Knowing how to order smarter at the drive-through does.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary preferences from onboarding",
            "SafetyGuard allergy protections",
            "Your active macro targets from the Macro Calculator",
            "Specialty diets like vegan, vegetarian, gluten-free, and others",
          ],
        },
        {
          heading: "Where to Find It",
          list: [
            "Social Hub — Fast Food Guide card",
            "Included with Premium and Ultimate subscriptions",
          ],
        },
      ],
    },
  },
  {
    id: "procare",
    title: "ProCare",
    subtitle: "Professional coaching & medical oversight",
    icon: Users,
    content: {
      sections: [
        {
          heading: "What Is ProCare?",
          text: "ProCare connects you with certified trainers and licensed physicians right inside My Perfect Meals. Your professional gets their own workspace to set your nutrition targets, assign meal builders, and guide your meal plan — all without leaving the app. Think of it as having a coach in your pocket who can see your plan and adjust it in real time.",
        },
        {
          heading: "For Trainers & Coaches",
          text: "Trainers work inside the Trainers Studio — a dedicated workspace where they manage clients one by one.",
          list: [
            "Set precise macro targets (protein, carbs, fat) tailored to your goals",
            "Choose your Starch Game Plan — One Starch Meal or Flex Split",
            "Assign a meal builder — General Nutrition or Performance & Competition",
            "View and edit your weekly meal board directly",
            "Track body composition and adjust strategy over time",
          ],
        },
        {
          heading: "For Physicians & Clinicians",
          text: "Physicians work inside the Physicians Clinic — a clinical workspace designed for medical-grade nutrition oversight.",
          list: [
            "Access specialized medical hubs — Diabetic, GLP-1, and Anti-Inflammatory builders",
            "Set clinical macro targets and medical directives",
            "Configure SafetyGuard allergen restrictions and dietary guardrails",
            "View and edit your weekly meal board directly",
            "Provide clinical context notes and advisory guidance",
          ],
        },
        {
          heading: "Shared Meal Boards",
          text: "When you connect with a trainer or physician, they can view and edit your Meal Board directly. There is one shared board per client — you own it, and your professional is an authorized editor. Every change is tracked so you always know who updated your plan last. Your professional can add meals, remove items, and repeat days — all within the permissions you set.",
        },
        {
          heading: "How to Connect",
          list: [
            "Go to the More tab in the bottom navigation",
            "Your trainer or physician gives you an access code (e.g. MP-9ZX4-QL)",
            "Enter the code on the More page to link instantly",
            "Or your professional can invite you by email",
            "Once connected, they appear on your active Care Team",
          ],
        },
        {
          heading: "Permissions You Control",
          text: "You decide exactly what your professional can see and do. You can update or revoke permissions at any time from your Care Team page.",
          list: [
            "Can View Macros — let them see your nutrition numbers",
            "Can Add Meals — let them add meals to your board",
            "Can Edit Plan — full control to modify your Meal Board",
          ],
        },
        {
          heading: "Favorites / Saved Meals",
          text: "Any meal you love can be saved with a single tap using the heart button. Your saved favorites live on the More page and can be reused anytime — add them back to your macros, share them, translate them, or cook them with the guided Prepare with Chef feature.",
        },
        {
          heading: "Tell Your Trainer or Doctor",
          text: "ProCare works best when your professional knows about it. Share the app with your trainer, physician, dietitian, or nutritionist — they can sign up, connect with you using an access code, and start managing your nutrition plan from their own professional workspace inside the app.",
        },
      ],
    },
  },
];

const LIBRARY_SECTIONS: LibrarySection[] = [
  {
    id: "start-here",
    label: "START HERE",
    description: "Guided entry",
    topics: SECTION_START_HERE,
  },
  {
    id: "core-systems",
    label: "CORE SYSTEMS",
    description: "How the app works",
    topics: SECTION_CORE_SYSTEMS,
  },
  {
    id: "nutrition-strategy",
    label: "NUTRITION STRATEGY",
    description: "User-facing systems",
    topics: SECTION_NUTRITION_STRATEGY,
  },
  {
    id: "health-safety",
    label: "HEALTH & SAFETY",
    description: "Trust layer",
    topics: SECTION_HEALTH_SAFETY,
  },
  {
    id: "specialized",
    label: "SPECIALIZED SYSTEMS",
    description: "Advanced differentiators",
    topics: SECTION_SPECIALIZED,
  },
];

function LibraryItem({ topic }: { topic: LibraryTopic }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<"read" | "listen">("read");
  const narration = useNarration(topic.content.sections);

  const handleToggle = () => {
    if (isExpanded) {
      narration.reset();
    }
    setIsExpanded(!isExpanded);
  };

  const handleModeChange = (newMode: "read" | "listen") => {
    if (newMode === "read") {
      narration.reset();
    }
    setMode(newMode);
    narration.toggleMode(newMode);
  };

  const Icon = topic.icon;

  return (
    <div className="w-full">
      <button
        onClick={handleToggle}
        className={`w-full flex items-start gap-3 px-4 py-4 rounded-xl transition-all duration-200 ${
          isExpanded
            ? "bg-black/70 border border-white/20 shadow-lg"
            : "bg-black/50 border border-white/10 hover:bg-black/60 hover:border-white/15"
        }`}
      >
        <Icon className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />

        <div className="flex flex-col flex-1 min-w-0 text-left">
          <span className="text-white font-medium text-sm leading-tight">
            {topic.title}
          </span>
          {topic.subtitle && (
            <span className="text-xs text-white/55 mt-0.5 leading-snug line-clamp-1">
              {topic.subtitle}
            </span>
          )}
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 mt-0.5"
        >
          <ChevronDown className="h-4 w-4 text-white/50" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 p-4 bg-black/40 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <PillButton
                    onClick={() => handleModeChange("read")}
                    active={mode === "read"}
                  >
                    <BookOpenText className="h-3 w-3 mr-1" />
                    Read
                  </PillButton>
                  <PillButton
                    onClick={() => handleModeChange("listen")}
                    active={mode === "listen"}
                  >
                    <Headphones className="h-3 w-3 mr-1" />
                    Listen
                  </PillButton>
                </div>

                {mode === "listen" && (
                  <div className="flex items-center gap-2">
                    <PillButton
                      onClick={
                        narration.isPlaying ? narration.pause : narration.play
                      }
                      active={narration.isPlaying}
                    >
                      {narration.isPlaying ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </PillButton>
                    <PillButton onClick={narration.stop}>
                      <Square className="h-3 w-3" />
                    </PillButton>
                    <span className="text-[10px] text-white/50 ml-1">
                      {narration.currentSectionIndex + 1}/
                      {narration.totalSections}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {topic.content.sections.map((section, index) => (
                  <div
                    key={index}
                    className={`space-y-2 transition-all ${
                      mode === "listen" &&
                      narration.currentSectionIndex === index
                        ? "bg-white/5 -mx-2 px-2 py-2 rounded-lg"
                        : ""
                    }`}
                  >
                    <h4 className="text-sm font-semibold text-white">
                      {section.heading}
                    </h4>
                    {section.text && (
                      <p className="text-xs text-white/75 leading-relaxed">
                        {section.text}
                      </p>
                    )}
                    {section.list && (
                      <ul className="space-y-1 ml-3">
                        {section.list.map((item, i) => (
                          <li
                            key={i}
                            className="text-xs text-white/75 flex items-start gap-2"
                          >
                            <span className="text-white/40 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Learn() {
  const [, navigate] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white p-4"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-3">
            <Button
              onClick={() => navigate("/")}
              className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">App Library</h1>
              <p className="text-xs text-white/60">
                Learn how My Perfect Meals works
              </p>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {LIBRARY_SECTIONS.map((section) => (
          <div key={section.id} className="mb-6">
            <div className="mb-2 px-1">
              <h3 className="text-xs font-semibold text-white/45 uppercase tracking-widest">
                {section.label}
              </h3>
              <p className="text-[11px] text-white/30 mt-0.5">
                {section.description}
              </p>
            </div>
            <div className="space-y-2">
              {section.topics.map((topic) => (
                <LibraryItem key={topic.id} topic={topic} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
