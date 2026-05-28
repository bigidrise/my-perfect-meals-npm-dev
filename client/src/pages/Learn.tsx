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
  MapPin,
  ChefHat,
  Wine,
  Refrigerator,
  Star,
  ShoppingCart,
  ListChecks,
  Activity,
  Fish,
  Globe,
  Camera,
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
          text: "For more than three decades I worked as a coach helping people lose weight, improve health, and rebuild confidence. The pattern was always the same. When clients trained with me, they succeeded. But when they left the gym and went back into real life, everything became harder.",
        },
        {
          heading: "Real Life Is Where Diets Fail",
          text: "Clients struggled at restaurants, on vacation, while traveling for work, or even just going out with friends. Many would tell me the same thing: I wish you were here right now so you could tell me what to eat.",
        },
        {
          heading: "The Phrase That Started Everything",
          text: "Over time one sentence kept coming up again and again from clients: I wish you were in my pocket. That idea stayed with me for years.",
        },
        {
          heading: "What I Saw In Other Nutrition Apps",
          text: "When I started studying nutrition apps on the market, I realized something frustrating. Most were built by technology companies focused on calorie tracking and generic recipes. They were not built by coaches who actually work with clients every day.",
        },
        {
          heading: "Why Those Apps Didn't Work",
          list: [
            "Recipes were generic and not personalized",
            "Medical conditions like diabetes were rarely considered",
            "Liver issues, inflammation, and allergies were ignored",
            "Users were left to figure everything out themselves",
            "Many apps called themselves coaching, but there was no real guidance",
          ],
        },
        {
          heading: "Real Coaching Works Differently",
          text: "A real coach does not simply watch and hope the client figures things out. A coach provides structure, direction, and accountability.",
        },
        {
          heading: "The Turning Point",
          text: "After a neck injury caused by a drunk driver forced me to rethink my career path, I began exploring whether technology could finally solve this problem.",
        },
        {
          heading: "Building The System",
          text: "In June of last year I began building what would become My Perfect Meals.",
        },
        {
          heading: "The Mission",
          text: "The goal is simple. To give people what my clients asked for years ago: a coach in their pocket.",
        },
      ],
    },
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
          heading: "Multiple Conditions — All Stack at Once",
          text: "If you have more than one condition, you can select all of them. Cardiac and renal. Thyroid and oncology. Any combination. Every condition you activate gets its own full protocol applied to every meal generator simultaneously. The app does not pick one and ignore the rest. All active clinical rules stack together in real time across every tool in the app.",
        },
        {
          heading: "Where to Set Your Conditions",
          text: "Go to Edit Profile and scroll to the Clinical Support section. Tap each condition that applies to you. You can select as many as you need — they all activate immediately. If your health situation changes over time, come back and update your selections. New conditions stack on top of existing ones without removing what was already set.",
        },
        {
          heading: "With a Coach or Physician (ProCare)",
          text: "When you connect with a professional through ProCare, they can assign your meal builder, apply support systems, and adjust your plan in real time. You still own your plan. They guide it.",
        },
        {
          heading: "How Builders Work Button",
          text: "Every meal builder in the app includes a 'How builders work' button. Tap it to watch a short video tutorial that walks you through how to use the builder — from creating your first meal to building a full day. If you're ever unsure where to start, that button is your first stop.",
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
    subtitle:
      "A coaching app that leads you — not another log-and-hope tracker",
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
    id: "taste-memory",
    title: "Taste Memory — How the App Learns You",
    subtitle: "The system that gets smarter the more you use it",
    icon: Brain,
    content: {
      sections: [
        {
          heading: "The App Remembers What You Like",
          text: "Every time you save a meal, save a recipe, or log something you ate, the app is paying attention. It is not just storing records — it is building a picture of who you are as an eater. That picture is your Taste Memory, and it gets applied quietly in the background every time a new meal is generated for you.",
        },
        {
          heading: "What It Learns",
          list: [
            "Preferred proteins — chicken, salmon, beef, tofu, shrimp, and which ones show up most in your history",
            "Preferred cuisines — Mediterranean, Asian, Mexican, Italian, and what you keep coming back to",
            "Preferred cooking methods — grilled, baked, sautéed, slow-cooked, and your tendencies over time",
            "High-protein tendency — whether you consistently choose meals that are protein-forward",
            "Quick-prep tendency — whether you favor recipes that come together fast versus more involved cooking",
          ],
        },
        {
          heading: "How It Works",
          text: "The system reads your last 90 days of saved meals and recipes and scores them using a recency decay model. Recent choices carry more weight than older ones, with a half-life of about 28 days. That means your Taste Memory is always current — it naturally shifts as your tastes and habits evolve over time.",
        },
        {
          heading: "Where It Is Applied",
          list: [
            "All six diet builders — Anti-Inflammatory, Diabetic, GLP-1, General Nutrition, Performance, Beach Body",
            "Weekly AI Meal Planner",
            "Craving Creator",
            "Fridge Rescue",
            "Beverage Creator",
            "Dessert Creator",
          ],
        },
        {
          heading: "What It Does NOT Do",
          text: "Taste Memory is always treated as a soft influence — a set of hints. It never overrides your dietary rules, medical protocols, allergy protections, or macro targets. If your protocol says no refined carbs, Taste Memory cannot put them back in. It only shapes the meal within the boundaries already set for you.",
        },
        {
          heading: "You Do Not Have to Set It Up",
          text: "There are no buttons, no preference surveys, no profiles to fill out. Taste Memory builds itself automatically from how you actually use the app. The more you save and log, the more accurate it becomes. A new user starts with no memory. A user with six months of history gets meals that feel like they were written specifically for them — because in a sense, they were.",
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
  {
    id: "smart-shopping",
    title: "Smart Shopping — Shop Your Way",
    subtitle: "Send one day, choose multiple days, stop overbuying",
    icon: ShoppingCart,
    content: {
      sections: [
        {
          heading: "How Shopping Works Now",
          text: "Every meal builder has a shopping bar at the bottom of the screen. Instead of always sending your entire week to the grocery list, you now choose exactly how much you want to shop for.",
        },
        {
          heading: "Send This Day",
          text: "Tap the orange Send button to send only the meals from the day you are currently viewing to your shopping list. This is the fastest way to shop for today or any single day.",
        },
        {
          heading: "Choose Days",
          text: "Tap the Choose Days button to open a multi-select panel showing every day of your current week. Each day shows its name and how many meals are planned. Check the days you want, then send them all in one tap.",
          list: [
            "Shop for just Monday and Tuesday before mid-week",
            "Prep for the weekend by selecting Friday through Sunday",
            "Select all 7 days if you want to shop for the full week",
          ],
        },
        {
          heading: "Why This Matters",
          text: "Most people do not shop for a full week at once. Produce goes bad. Plans change. The old system forced you to send everything or nothing. Now you shop for exactly the window you need, which means fresher food, less waste, and a shorter list every trip.",
        },
        {
          heading: "Works Across All Builders",
          text: "This shopping system is the same across every meal builder in the app — Weekly, GLP-1, Anti-Inflammatory, Diabetic, Performance, Beach Body, and General Nutrition. Same experience, no matter which builder you use.",
        },
        {
          heading: "Your List Syncs Automatically",
          text: "Once items are sent to your shopping list, they sync to your account instantly. You will see the same list whether you are on your phone, tablet, or another device.",
        },
      ],
    },
  },
  {
    id: "my-list",
    title: "My List — Your Personal Shopping Section",
    subtitle: "Manually added items and Smart Scan results, all in one place",
    icon: ListChecks,
    content: {
      sections: [
        {
          heading: "What My List Is",
          text: "My List is your personal section of the shopping list — completely separate from the AI-generated grocery categories. It holds two types of items: things you add manually by typing them in, and products you scan using Smart Scan. Unlike the AI grocery sections that get built from your meal plan, My List is entirely under your control.",
        },
        {
          heading: "Manually Added Items",
          text: "Tap the Add to My List section at the bottom of the shopping list to type in anything you need — brand name, product name, quantity, unit. Fill in as much or as little as you want, then tap Add to My List and it appears instantly in the My List section above. This is useful for household staples, specialty ingredients, or anything else your meal plan does not automatically include.",
        },
        {
          heading: "Smart Scan Items",
          text: "When you use Smart Scan to photograph a product's ingredient label and tap Add to Shopping List, that item lands in My List — not in the AI grocery categories. This is intentional. Scanned products are things you personally chose, not AI-recommended ingredients, so they belong in your own section. They appear with a Scanned badge so you can see at a glance where they came from.",
        },
        {
          heading: "Checking Off Items",
          text: "Tap the checkbox next to any item to mark it as checked. The item stays visible but is visually marked so you can track what you have already picked up. When you are done shopping, tap Clear Checked to remove everything you marked — the number in parentheses tells you exactly how many items will be cleared.",
        },
        {
          heading: "The Scanned Badge",
          text: "Items from Smart Scan show a small orange Scanned badge with a camera icon. This tells you the item came from a label scan rather than being typed manually. It helps you remember where each item came from, especially when your list is a mix of manual adds and scan results.",
        },
        {
          heading: "How My List Fits Into the Full Shopping List",
          text: "The full shopping list is organized in layers. The AI-generated sections — Produce, Protein, Dairy, Pantry, and others — are built from your meal plan and live at the top. My List sits below those AI sections, above the Add to My List form. This keeps your AI-planned groceries and your personal items clearly separated so nothing gets confused.",
        },
      ],
    },
  },
  {
    id: "biometrics-tracking",
    title: "My Biometrics — Every Feature Explained",
    subtitle: "Macros, scanning, body stats, labs, and water tracking",
    icon: Activity,
    content: {
      sections: [
        {
          heading: "What This Page Is For",
          text: "My Biometrics is your feedback system — not where you plan meals, but where you see how everything is working. It brings together your daily macros, food logging, calorie trends, body measurements, lab values, and water intake in one place.",
        },
        {
          heading: "Today's Macros",
          text: "At the top of the page you will see your macro targets — protein, carbs, fat, and calories — pulled directly from your Macro Calculator. These numbers stay in place until you update your calculator or a coach adjusts them for you. Your logged totals for the day update here in real time as you add entries.",
        },
        {
          heading: "MacroScan — Log From a Photo",
          text: "Tap MacroScan to open your camera and point it at any nutrition label. The system reads the label and extracts protein, carbs, fat, and calories automatically. This is the fastest way to log packaged foods, restaurant items, or anything with a printed label. No manual typing required.",
        },
        {
          heading: "Just Describe It — AI Logging",
          text: "No label? No problem. Tap Just Describe It, type or say what you ate — 'a grilled chicken sandwich with fries' or 'two scrambled eggs and toast' — and the AI estimates your macros. It is not as precise as a label scan, but it is accurate enough for everyday tracking and far better than skipping the log entirely.",
        },
        {
          heading: "Manual Macro Entry",
          text: "If you already know your numbers, you can enter protein, carbs, fat, and calories directly. Type in the values and tap Add to include them in your daily total. This works well when you have exact macro data from a restaurant app, a meal plan, or a nutrition guide.",
        },
        {
          heading: "Macro Consistency — Up to 30 Days",
          text: "Below your daily totals you will find your Macro Consistency graph. Switch between Today, 7-day, and 30-day views to see how consistently you are staying aligned with your targets over time. This is where real patterns become visible — consistent days, missed logging periods, high-carb stretches, low-protein trends, or strong weekly adherence. Instead of focusing on perfection, this section helps you understand your habits so you can make smarter adjustments and have more productive conversations with your coach or care team.",
        },
        {
          heading: "Body Stats — Up to One Year",
          text: "Log your weight here by entering a number and tapping Save. The app stores your weight history and displays it as a trend over time, with views going back up to one year. Weekly weigh-ins give you the most reliable picture — daily fluctuations from water, food volume, and sodium are normal and misleading. Look at the direction of the line, not any single point.",
        },
        {
          heading: "Body Composition",
          text: "Track your estimated body fat percentage using the U.S. Navy Body Fat Formula — a validated method that uses simple tape measurements like waist, neck, height, and hips. You can log these measurements directly in the app and watch your body composition trend over time. If you have more accurate readings from a DEXA scan, InBody, or another source, you can enter those too. You can also set a body fat goal and track your progress toward it.",
        },
        {
          heading: "Clinical Labs — What You Can Track",
          text: "The clinical labs section lets you log your lab values so everything lives in one place. Markers you can track include:",
          list: [
            "Blood glucose and HbA1c — blood sugar and diabetes management",
            "LDL, HDL, total cholesterol, and triglycerides — cardiovascular health",
            "ALT and AST — liver enzyme markers",
            "Creatinine and BUN — kidney function markers",
            "TSH, Free T4, and Free T3 — thyroid hormone markers",
            "Prealbumin (transthyretin) — a nutritional status biomarker used in recovery and oncology-supportive care to track protein status and nutritional adequacy over time",
          ],
        },
        {
          heading: "How Lab Values Are Used",
          text: "When you log a lab value, the system evaluates it against established clinical thresholds. Markers that cross a threshold are flagged so you and your care team are aware. Some clinical protocols — such as cardiac, renal, and thyroid support — can activate automatically when the corresponding lab values cross their respective thresholds. Physician-assigned supports like Oncology Support always require direct physician assignment and are never triggered automatically.",
        },
        {
          heading: "Labs and ProCare",
          text: "If you are working with a physician or coach through ProCare, they can view your logged lab values and factor them into your plan. This makes the clinical labs section most powerful when used alongside ProCare oversight — but logging is always optional and useful on its own as a personal health record.",
        },
        {
          heading: "Water Log — Daily Hydration Tracker",
          text: "The water log tracks your daily fluid intake in ounces. Tap +8 oz or +16 oz each time you drink, and the ring at the center fills as you go toward your goal. Your status updates in real time — Below Target, On Track, or Goal Reached.",
          list: [
            "Your daily goal is calculated automatically from your logged body weight using the formula: weight (lbs) × 0.67 = daily oz target",
            "Log a new body weight and your water goal updates automatically — no manual target to set",
            "The bar chart below the ring shows your past 7 days so you can see hydration consistency over the week",
            "Blue bars mean you hit at least 80% of your goal that day — faint bars show days you fell short",
            "Tap Reset to clear today's count and start over at any point",
            "Carnivore and keto users see rotating hydration coaching tips throughout the day, since high-protein eating increases hydration needs",
          ],
        },
        {
          heading: "Ingredient Intelligence — Personalized Label Scan",
          text: "Tap Ingredient Intelligence and point your camera at the ingredients list on any packaged food. The system reads the label and then checks every ingredient against your personal health profile — your conditions, dietary protocol, goals, and preferences — to give you a personalized alignment report.",
        },
      ],
    },
  },
  {
    id: "ingredient-intelligence",
    title: "What Is Ingredient Intelligence?",
    subtitle: "Personalized food label analysis powered by your health profile",
    icon: Activity,
    content: {
      sections: [
        {
          heading: "What It Does",
          text: "Ingredient Intelligence scans the ingredients list on any packaged food and gives you a personalized alignment report based on your unique health profile. Point your camera at the back of a product, and within seconds you get an Alignment Grade (A through D), a plain-English summary, and a breakdown of what aligns with your goals — and what may not.",
        },
        {
          heading: "What It Does NOT Do",
          text: "Ingredient Intelligence is not a medical tool. It does not diagnose conditions, replace your doctor or dietitian, or tell you whether a food is safe or unsafe for you. Every result comes with an educational framing — not a verdict. The system helps you think, not decide for you.",
        },
        {
          heading: "Why You and a Friend Get Different Results",
          text: "The same product will produce different guidance for different users. A protein bar that rates B for a general fitness user might rate C for someone on a GLP-1 medication, or D for someone managing blood sugar closely. This is intentional — the entire analysis is run against your personal protocol, not a generic standard. There is no universal 'good' or 'bad' ingredient list.",
        },
        {
          heading: "What Goes Into the Analysis",
          list: [
            "Your medical conditions and any clinical protocols assigned to your account",
            "Your dietary identity — Kosher, Halal, Vegan, Carnivore, Keto, and others",
            "Your food allergies and personal avoidances",
            "Your current wellness goals — fat loss, muscle gain, blood sugar stability, anti-inflammatory eating, and more",
            "Your GLP-1, oncology support, diabetes, or thyroid protocol if active",
            "Household context — dye sensitivities, children in the home, or other family members with different needs",
          ],
        },
        {
          heading: "The Alignment Grade",
          text: "Each scan produces a grade from A to D based on how well the product's ingredient profile aligns with your specific health context. A means strong alignment — nothing notable conflicts with your goals or conditions. D means several ingredients are worth paying attention to given your profile. The grade is a starting point for awareness, not a final judgment.",
        },
        {
          heading: "Learn Why",
          text: "Inside every result you will see 'Learn Why' under certain sections. Tap it to read a plain-English explanation of what that section means and why it matters to you specifically. This turns a scan into a moment of learning — helping you understand food, not just grade it.",
        },
        {
          heading: "Educational, Not Diagnostic",
          text: "Ingredient Intelligence was designed to make packaged food more understandable for everyday people — not to create fear or replace professional guidance. Results are always framed around your personal goals and context, never as warnings that apply universally. When in doubt about a specific ingredient and your health, talk to your care team.",
        },
        {
          heading: "Adding a Scanned Product to Your Shopping List",
          text: "After a scan, tap Add to Shopping List to send the product directly to your My List section. My List is the personal, user-controlled part of the shopping list — kept entirely separate from the AI-generated grocery categories like Produce, Protein, and Pantry. Scanned items appear in My List with an orange Scanned badge so you can always tell them apart from manually added items. If you are not ready to commit, tap Save for Review instead to hold the item without adding it to the list right away.",
        },
      ],
    },
  },
  {
    id: "culture-intelligence",
    title: "Culture Intelligence System",
    subtitle: "How your food culture shapes every part of the app",
    icon: Globe,
    content: {
      sections: [
        {
          heading: "What It Is",
          text: "Your food is more than macros — it's culture, habit, and identity. The Culture Intelligence System allows My Perfect Meals to understand how you actually eat by using your preferred cuisine as a foundation across the entire app.",
        },
        {
          heading: "How It Works",
          text: "When you select a cuisine in your profile, the system automatically shapes your meals, snacks, desserts, beverages, and cooking styles to feel familiar to you — while still matching your goals, dietary preferences, and health needs.",
        },
        {
          heading: "Where It Applies",
          list: [
            "Meals and recipes — ingredient choices, spice profiles, and cooking methods reflect your culture",
            "Snacks and desserts — familiar flavors are prioritized when the AI builds options",
            "Beverages and alcohol pairings — pairing style and cultural beverage context are honored",
            "Cooking styles — techniques and preparation methods that fit your culinary background",
          ],
        },
        {
          heading: "What It Does Not Do",
          text: "This system does not restrict you. It guides your food experience. You can always explore other cuisines at any time from within any feature — but your default experience will reflect the way you naturally eat.",
        },
        {
          heading: "Setting Your Culture",
          text: "Go to your profile and look for the Cuisine Identity section. Select a cuisine, then choose how strongly you want it applied — Light (subtle influence), Balanced (recognizable style), or Authentic (full cultural identity with traditional spices and techniques).",
        },
        {
          heading: "Why This Matters",
          text: "Without this system, every user gets the same generic output. With it, your meals feel like yours — less guessing, more satisfaction, and food that fits the way you actually eat.",
        },
      ],
    },
  },
  {
    id: "cuisine-intensity",
    title: "How Cuisine Intensity Works",
    subtitle: "Light, Balanced, and Authentic — what each mode actually does",
    icon: Utensils,
    content: {
      sections: [
        {
          heading: "What Cuisine Intensity Is",
          text: "When you select a cuisine in your profile, you also choose how strongly you want it applied. This is your Cuisine Intensity setting. It controls how much the AI leans into traditional ingredients, cooking methods, and dish formats when building your meals.",
        },
        {
          heading: "Light — Health-First With Cultural Flavor",
          text: "The app builds meals around your health goals and macros first, then adds cultural flavor on top. You'll recognize the spice profiles, aromatics, and seasoning familiar to your cuisine — but the structure and ingredients are chosen primarily for nutritional performance. Think of it as your food culture used as seasoning, not as the foundation.",
        },
        {
          heading: "Balanced — Real Dishes, Adjusted Ingredients",
          text: "The app uses the actual dish formats from your cuisine — traditional meal structures, classic combinations, and recognizable presentations — but adjusts specific ingredients to meet your health needs. A dish will look and feel like it belongs to your culture, while the inside has been adapted. The cultural identity is real. The adaptation is careful.",
        },
        {
          heading: "Authentic — Traditional Recipes as Actually Made",
          text: "The app generates meals the way they are genuinely prepared in your culture. Traditional fats, cooking methods, sauces, textures, and ingredient pairings are all fully honored. This is not a health-optimized version of your food. It is your food.",
        },
        {
          heading: "Authentic When You Have a Health Condition",
          text: "If you have active medical conditions, dietary restrictions, or physician-assigned support systems, Authentic mode works differently — and this is intentional. The app preserves the cultural dish structure as closely as possible, but adapts only what your health rules require. When a substitute is needed, the app uses ingredients that belong to your culinary tradition rather than generic Western alternatives. Your food still feels like yours.",
        },
        {
          heading: "Allergies Are Always Enforced",
          text: "No matter which intensity setting you choose, your saved allergies are always active. Authentic mode does not override allergy protection. This applies to every cuisine, every dish, every creator.",
        },
        {
          heading: "How to Set It",
          text: "Go to your profile and find the Cuisine Identity section. Select your cuisine, then tap the intensity you want. You can change this at any time and your next generated meal will reflect the new setting.",
        },
        {
          heading: "Which Should You Choose",
          list: [
            "Choose Light if your primary goal is fat loss, performance, or medical nutrition — you want familiar flavors but health comes first",
            "Choose Balanced if you want real cultural dishes that still fit your plan — the structure matters to you but you're comfortable with some adaptation",
            "Choose Authentic if you want your food to taste and feel genuinely traditional — and you understand the meals reflect how the cuisine is actually eaten",
          ],
        },
      ],
    },
  },
  {
    id: "diet-cuisine-controls",
    title: "How Diet & Cuisine Controls Work",
    subtitle: "Override your saved preferences on any creator page",
    icon: ChefHat,
    content: {
      sections: [
        {
          heading: "What These Controls Are",
          text: "Every creator and lifestyle page in the app shows two pill-toggle controls: My Diet / Different Diet and My Cuisine / Different Cuisine. These let you override your saved profile settings for a single session without changing your profile.",
        },
        {
          heading: "My Diet / Different Diet",
          text: "When set to My Diet, the AI uses the dietary restriction saved in your profile — vegan, keto, gluten-free, and so on. Tap Different Diet to reveal a dropdown where you can pick any other diet for just this request. Your profile setting stays unchanged.",
        },
        {
          heading: "My Cuisine / Different Cuisine",
          text: "When set to My Cuisine, the AI uses the cuisine identity from your profile. Tap Different Cuisine to choose any of the 15 supported cuisine styles for just this session — Mexican, Japanese, Mediterranean, West African, and more.",
        },
        {
          heading: "Where You'll Find Them",
          list: [
            "Craving Creator — before generating a meal",
            "Create a Dish — before creating your custom dish",
            "Fridge Rescue — before scanning your fridge",
            "Sushi Creator — before building your sushi spread",
            "Athlete Beverage Creator — before generating a drink plan",
            "Dessert Creator — before generating your dessert",
            "Pairings AI — before generating drink pairings",
            "Social Find Me Meals — in Step 1, before advancing to location",
            "Fast Food Guide — in Step 1, before advancing to restaurant",
          ],
        },
        {
          heading: "Why This Is Useful",
          text: "Sometimes you are cooking for someone else, following a temporary eating plan, or just in the mood for a different cuisine than usual. These controls let you get the right output for the moment without touching your profile settings.",
        },
        {
          heading: "Session-Only Override",
          text: "These selections are temporary. When you leave the page or start a new session, the controls reset to your saved profile preferences. Nothing you set here affects your profile, your history, or your long-term data.",
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
          text: "SafetyGuard is My Perfect Meals' two-layer guidance system designed to help reduce the risk of generating meals that conflict with food allergies, dietary restrictions, or medical considerations you've provided.",
        },
        {
          heading: "Layer 1 — Pre-Generation Safety Check",
          text: "Before any meal is created, the system checks your safety profile — including allergies, dietary restrictions, and relevant medical considerations — against a structured food and ingredient taxonomy. If a requested meal may conflict with your profile, the request is blocked before generation and you're guided on how to adjust it more safely.",
        },
        {
          heading: "Layer 2 — Post-Generation Validation",
          text: "After a meal is created, the system performs an additional validation pass to confirm the final ingredients remain within your stated safety constraints. If a potential conflict is detected, the meal may be flagged, adjusted, or rejected.",
        },
        {
          heading: "How SafetyGuard Works",
          list: [
            "Protection is always on by default",
            "Pre-generation checks stop meals that include known allergens before they're created",
            "Post-generation validation scans ingredients before a meal is shown",
            "Temporary overrides require a personal Safety PIN and apply to one meal only",
          ],
        },
        {
          heading: "What It's Built On",
          list: [
            "Structured food and ingredient taxonomies",
            "Common allergen classifications recognized by public health organizations",
            "Clinical nutrition principles for diabetes support, GLP-1 support, anti-inflammatory eating, and oncology-supportive meal planning",
            "AI-assisted language understanding to interpret user input, ingredient families, compound foods, and common substitutions",
          ],
        },
        {
          heading: "Why It Exists",
          text: "Food allergies are serious. SafetyGuard is designed to add structure and intentional decision-making at the exact moment meals are created.",
        },
        {
          heading: "Important Limitation",
          text: "SafetyGuard is a software-based guidance tool, not a medical device. It does not diagnose, treat, or replace professional medical advice. All safety checks are based on user-provided information and are intended to support safer food choices, not medical decision-making.",
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
    id: "my-favorites",
    title: "My Favorites — Build Faster With Meals You Already Love",
    subtitle: "Instant meal recall from your personal saved library",
    icon: Star,
    content: {
      sections: [
        {
          heading: "What My Favorites Is",
          text: "My Favorites is a recall system built into every meal builder. Once you've saved meals you enjoy, you can pull them back into any slot instantly — no rebuilding, no searching, no starting over. It turns your history into a shortcut.",
        },
        {
          heading: "How to Save a Meal",
          text: "On any meal card, tap the red star icon in the top corner. That meal is now saved to your favorites library, permanently accessible from any builder until you remove it.",
        },
        {
          heading: "Where to Find the Favorites Button",
          text: "Look for the gold 'My Favorites' pill button with a red star on the action bar below any meal slot in your builder. It appears next to the Create with Chef and AI buttons on every Breakfast, Lunch, Dinner, and Snack slot.",
        },
        {
          heading: "How to Use It",
          list: [
            "Tap My Favorites on any meal slot",
            "Filter by type — Breakfast-style, Mains, Snacks, or Drinks",
            "Find the meal you want and tap Use This",
            "The meal drops into that slot immediately and your macros update automatically",
          ],
        },
        {
          heading: "What Happens After You Select",
          text: "The selected meal replaces the entire slot. Your Nutrition Budget at the bottom of the screen recalculates instantly to reflect the new totals. No manual entry needed.",
        },
        {
          heading: "Why It Matters",
          text: "Most people find a handful of meals they like and want to rotate them. Without My Favorites, they have to rebuild those meals from scratch every time. With it, your plan becomes a rotation of meals you already know work — built faster, eaten with confidence.",
        },
        {
          heading: "Pro Tip",
          text: "The more you save, the more useful this becomes. Start by saving two or three go-to meals for each part of the day. Over time your favorites become a personal library that makes daily planning take seconds instead of minutes.",
        },
      ],
    },
  },
  {
    id: "create-a-dish",
    title: "Create a Dish",
    subtitle: "Build any meal you want, on your terms",
    icon: ChefHat,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Sometimes you're not following a plan — you just want to cook something. Most apps break here because they only work when you already know what you're doing. Create a Dish is built for the moment when you want real food, made your way, without sacrificing your goals.",
        },
        {
          heading: "The Moment",
          text: "You're in the kitchen thinking: 'I just want to cook something good… but I still want it to fit.' That's exactly what this is for.",
        },
        {
          heading: "How It Works",
          text: "Tell Chef what you want to make — any cuisine, any style, any craving. The app builds a complete recipe with ingredients, instructions, and full nutrition, automatically aligned with your macros, dietary preferences, and health profile.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Your active macro targets",
            "Medical and health guardrails",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Create a Dish"],
        },
      ],
    },
  },
  {
    id: "craving-creator",
    title: "Craving Creator",
    subtitle: "Satisfy cravings without going off track",
    icon: Sparkles,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Cravings are where most people fall off — not because they lack discipline, but because they don't have a better option in the moment. Telling someone to just ignore a craving doesn't work. Giving them a version of it that actually fits does.",
        },
        {
          heading: "The Moment",
          text: "You're thinking about something you know doesn't fit your plan — but you still want it. That's the exact moment this feature was built for.",
        },
        {
          heading: "How It Works",
          text: "Tell the app what you're craving. It builds a version of that food — same satisfaction, same flavors — that stays aligned with your goals, macros, and health profile. You don't have to choose between what you want and what works.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Your macro targets",
            "All medical guardrails",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Cravings, Sushi & Desserts Hub"],
        },
      ],
    },
  },
  {
    id: "beverage-creator",
    title: "Beverage Creator",
    subtitle: "Drinks that fit your plan, not fight it",
    icon: Wine,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Drinks quietly derail progress more than most people realize. Smoothies, shakes, coffees, cocktails — they add up fast, and most people never account for them. Beverage Creator solves that by building drinks that are actually built for your goals.",
        },
        {
          heading: "The Moment",
          text: "You want something to drink besides water, but you don't want to guess whether it's hurting your progress. Or you want to make a great smoothie without the hidden sugar spike.",
        },
        {
          heading: "How It Works",
          text: "Tell the app what type of drink you want — smoothie, protein shake, coffee, mocktail, cocktail, or anything else. It builds a recipe that fits your macros, dietary preferences, and health conditions. No guesswork, no hidden damage.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your macro targets and calorie budget",
            "Sugar and glycemic considerations",
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Beverage Creator"],
        },
      ],
    },
  },
  {
    id: "pairings-hub",
    title: "Spirit & Wine Pairing Hub",
    subtitle: "Smarter alcohol choices for real life",
    icon: Wine,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "People are going to drink. Pretending they won't is exactly why most nutrition systems fail the moment real social life begins. This feature exists to help you make smarter choices in those moments — not shame you for having them.",
        },
        {
          heading: "The Moment",
          text: "You're out, you're relaxing, or you're at a dinner and want to make a better call without overthinking it or feeling like you've already failed.",
        },
        {
          heading: "How It Works",
          text: "The hub includes AI-driven spirit and wine pairing, a wine list translator for restaurant menus, and a reduce-drinking planning tool. Each feature guides you toward choices that minimize damage and stay aligned with your overall goals.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary setup and restrictions",
            "Your macro and calorie targets",
            "Your overall health goals",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Spirit & Wine Pairing Hub"],
        },
      ],
    },
  },
  {
    id: "fridge-rescue",
    title: "Fridge Rescue",
    subtitle: "Turn what you have into something worth eating",
    icon: Refrigerator,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "People waste food or eat the same thing on repeat because they don't know what else to do with what's already in the fridge. Fridge Rescue closes that gap — it takes the ingredients you already have and turns them into real meals.",
        },
        {
          heading: "The Moment",
          text: "You open the fridge and think: 'I've got food… but nothing to eat.' That's the exact problem this solves.",
        },
        {
          heading: "How It Works",
          text: "Tell the app what ingredients you have. It generates multiple meal options built from those ingredients, complete with recipes, instructions, and full nutrition. No grocery run needed. No excuses needed.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Your macro targets",
            "Medical guardrails",
          ],
        },
        {
          heading: "Where to Find It",
          list: [
            "Lifestyle → Fridge Rescue",
            "Free access — available on all plans",
          ],
        },
      ],
    },
  },
  {
    id: "recipe-scan",
    title: "Recipe Scan",
    subtitle: "See food anywhere. Make it yours.",
    icon: Camera,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "You see food you love everywhere — scrolling TikTok, saving an Instagram reel, pinning something on Pinterest, screenshotting a Facebook recipe, flipping through a cookbook, reading a menu. Most of the time that food stays in your camera roll and never becomes a meal. Recipe Scan changes that. It takes any meal idea you find and turns it into a complete, personalized meal card built exactly for you.",
        },
        {
          heading: "The Moment",
          text: "You screenshot a TikTok recipe. You save an Instagram food reel. You see a dish at a restaurant and want to make it at home. You pause a YouTube cooking video. In every one of those moments, you wonder: can I actually eat this? Is it safe for me? Will it work with my goals? Recipe Scan answers all of that automatically.",
        },
        {
          heading: "Four Ways to Bring In a Meal",
          list: [
            "Choose Photo — pick a screenshot, saved food photo, or any image from your camera roll or gallery (TikTok screenshots, Instagram saves, Pinterest images, Facebook recipes — anything)",
            "Camera — point your device camera live at a cookbook, menu, food package, or another screen",
            "Speak — describe the meal out loud the way you would tell a friend about it",
            "Type — paste a description, a recipe title, or any text about the meal",
          ],
        },
        {
          heading: "This Is Not a Recipe Import",
          text: "Recipe Scan does not pull in someone else's recipe and show it to you. It uses what you saw as a starting point — an inspiration trigger — and then rebuilds the meal completely from scratch around your body, your health goals, and your personal protocols. The result is your version of that meal, not a copy of theirs.",
        },
        {
          heading: "Customize Before Generating",
          text: "After you bring in your recipe idea, you land on a settings screen where you dial in exactly how you want it built — before anything generates.",
          list: [
            "Servings — Just Me, 2 People, 3 People, Family (4), or Meal Prep (6)",
            "Adaptation Style — Authentic keeps it close to the original, Balanced personalizes it to your profile while preserving the spirit, Healthier pushes hard on nutrition",
            "Protein Level — Standard, High Protein, or Athlete performance",
            "Prep Style — Original Prep or Easy Prep for simpler, faster cooking",
            "Cuisine Style — use your saved cuisine preference or switch to a completely different cuisine just for this meal",
          ],
        },
        {
          heading: "What Happens Under the Hood",
          list: [
            "Your image or description is sent to GPT-4o vision, which identifies the dish, ingredients, cooking style, and cuisine",
            "Your full onboarding profile is loaded — macro targets, allergies, dietary restrictions, medical conditions, everything",
            "Your customize choices are layered on top — servings, adaptation style, protein level, prep style, cuisine",
            "The meal is rebuilt by the same unified pipeline that powers every other creator in the app, with full protocol enforcement and allergy guardrails",
            "A custom meal image is generated by DALL-E to represent your version of the dish",
          ],
        },
        {
          heading: "Preview Before Saving",
          text: "The result comes back as a preview — meal card, macros, ingredients, protocol tags — and nothing is saved until you decide you want it. Tap Save to My Inspirations to keep it, or tap Regenerate to go back to the settings screen, adjust one thing, and generate again.",
        },
        {
          heading: "Where It Shows Up",
          list: [
            "Saved to Favorites under My Inspirations after you confirm",
            "Full meal card with title, description, ingredients, instructions, macros, and generated image",
            "Can be added to your Weekly Plan or Shopping List directly from Favorites",
          ],
        },
        {
          heading: "Where to Find It",
          list: [
            "Dashboard — Recipe Scan card",
            "Available on Essential plans and above",
          ],
        },
      ],
    },
  },
  {
    id: "my-perfect-gatherings",
    title: "My Perfect Gatherings",
    subtitle: "Multi-course AI meal planning for any occasion",
    icon: Sparkles,
    content: {
      sections: [
        {
          heading: "What Is My Perfect Gatherings?",
          text: "My Perfect Gatherings is a multi-course meal planner built for intentional eating. Instead of generating a single meal, it designs a complete gathering menu — appetizer, main course, side dishes, and dessert — all connected to the same situation, flavor profile, and occasion.",
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
            "Lifestyle Hub — My Perfect Gatherings card",
            "Included with Pro and Clinical subscriptions",
          ],
        },
      ],
    },
  },
  {
    id: "restaurant-guide",
    title: "Restaurant Guide",
    subtitle: "Know how to order before you sit down",
    icon: Utensils,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Eating out is where most people lose control — not because they want to, but because they don't know how to order. The menu is overwhelming, the portions are wrong, and the healthy options aren't obvious. Restaurant Guide exists so that's never a problem again.",
        },
        {
          heading: "The Moment",
          text: "You're at a restaurant staring at a menu, guessing what to get, or you already know where you're going and want to have a plan before you walk in the door.",
        },
        {
          heading: "How It Works",
          text: "Tell the app where you want to eat and what you're in the mood for. It finds that restaurant or similar options nearby and returns three smart meal choices with ordering guidance — so you know exactly what to get and how to order it before you even sit down.",
        },
        {
          heading: "What It Respects",
          list: [
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Your macro targets",
            "Medical and health guardrails",
          ],
        },
        {
          heading: "Where to Find It",
          list: [
            "Lifestyle → Socializing Hub → Restaurant Guide",
            "Included with Pro and Clinical subscriptions",
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
            "Included with Pro and Clinical subscriptions",
          ],
        },
      ],
    },
  },
  {
    id: "find-meals-near-me",
    title: "Find Meals Near Me",
    subtitle: "Real-world dining that fits your diet",
    icon: MapPin,
    content: {
      sections: [
        {
          heading: "How It Works",
          text: "When you use Find Meals Near Me, the app searches for restaurants that match your dietary preferences. This includes both specialized restaurants and locations that offer strong compatible options for your diet. The goal is to give you more real-world choices while still keeping your meals aligned with how you eat.",
        },
        {
          heading: "What That Means",
          text: "We recommend places where your diet works — not just places labeled for it. Whether you're vegan, keto, pescatarian, gluten-free, or following any other protocol, the app surfaces restaurants and meal options that fit, across both dedicated and general dining spots.",
        },
        {
          heading: "What the App Respects",
          list: [
            "Your dietary preferences from onboarding",
            "SafetyGuard allergy protections",
            "Your active macro targets",
            "Stricter filtering for kosher and halal (certification-required diets)",
          ],
        },
        {
          heading: "Where to Find It",
          list: [
            "Social Hub — Find Meals Near Me card",
            "Included with Pro and Clinical subscriptions",
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
          text: "ProCare is not just a feature — it is a complete professional ecosystem inside My Perfect Meals. It connects certified trainers and licensed physicians with their clients through a shared workspace where nutrition strategy, clinical protocols, messaging, and accountability all live in one place. Think of it as the operating system that runs between a professional and their client: the professional guides the plan, the client lives it, and the app enforces it in every meal generated.",
        },
        {
          heading: "How Coaches Use It",
          text: "Trainers and coaches work inside the Trainer Studio — a dedicated workspace where they manage each client individually through a Client Folder.",
          list: [
            "Set precise macro targets (protein, carbs, fat, calories) tailored to client goals",
            "Choose a Starch Game Plan — One Starch Meal concentrates starch into one sitting for appetite control; Flex Split distributes starch across two meals",
            "Assign a meal builder — General Nutrition, Performance and Competition, or a clinical builder — which determines every meal the client sees in the app",
            "View and edit the client's weekly meal board directly with full change tracking",
            "Set Cycle Protocols (Lower Carb Phase, Higher Carb Push, Carb Refeed) that notify and require the client to acknowledge the change",
            "Message clients directly and add internal Provider Notes that are never visible to the client",
            "Track body composition, compliance scores, and program history from the Client Folder",
          ],
        },
        {
          heading: "How Physicians Use It",
          text: "Physicians and clinicians work inside the Physicians Clinic — a clinical workspace built for medical-grade nutrition oversight. The platform is designed as a compliance partner, not a diagnostic tool. It applies an NIH-based evidence baseline that the physician can adjust or override at any time.",
          list: [
            "Access specialized clinical hubs — Diabetic, GLP-1, and Anti-Inflammatory meal builders",
            "Set clinical macro targets and toggle medical directives (Diabetes-Friendly, Low-Sodium, GLP-1 Support, and more)",
            "View patient lab values — A1C, LDL, blood pressure, ALT, creatinine — and see which have crossed clinical thresholds",
            "Assign clinical protocols based on lab findings or physician judgment",
            "Configure SafetyGuard allergen restrictions and dietary guardrails",
            "Document diagnosis, clinical tags, and patient notes for medical nutrition therapy",
            "Communicate with patients via the shared Tablet and maintain private Provider Notes",
          ],
        },
        {
          heading: "The Client Folder",
          text: "The Client Folder is the operational heart of ProCare. Every client has one, and it contains everything the professional needs in a single place. Opening a Client Folder reveals:",
          list: [
            "Active Clinical Supports — color-coded dots showing which protocols are influencing the client's meals right now (tap any dot to see exactly what it does)",
            "Client Goal — the client's self-defined goal type, target, and timeline",
            "The Tablet — a shared messaging and documentation space with two tabs: Messages (client-visible) and Provider Notes (internal only)",
            "Compliance Snapshot — a rolling 30-day score across calorie accuracy, protein adherence, and logging frequency",
            "Weight Trends — body composition history and trajectory",
            "Lab Snapshot — lab values with threshold flags (physicians only)",
            "Program History — which builders have been assigned and when",
            "Nutrition Strategy and Cycle Protocol control",
          ],
        },
        {
          heading: "Messages vs. Provider Notes",
          text: "The Tablet inside every Client Folder has two separate channels with completely different visibility rules. This distinction is important.",
          list: [
            "Messages — a real-time conversation that both you and your client can read and reply to. Use it for check-ins, motivation, instructions, and questions. The client receives a notification when you send a message.",
            "Provider Notes — internal documentation that is never shown to the client under any circumstances. Use notes for clinical observations, progress assessments, protocol rationale, or anything that should stay within your professional records.",
            "Translation is available on both channels to support clients who communicate in other languages.",
            "The ProCare Inbox aggregates unread messages from all your clients into a single view so nothing falls through the cracks.",
          ],
        },
        {
          heading: "How Clinical Supports Stack",
          text: "My Perfect Meals uses a two-layer architecture for every meal generated. Layer 1 is the primary builder — the overall nutrition philosophy (General Nutrition, Performance, Anti-Inflammatory, etc.). Layer 2 is the clinical support layer — condition-specific overlays that stack on top of the primary builder without replacing it.",
          list: [
            "A client can have multiple clinical supports active simultaneously — for example, Anti-Inflammatory as the primary builder with Cardiac Health and Kidney Disease active as clinical overlays",
            "Each active support modifies meal generation in its specific domain: Cardiac limits sodium and saturated fat, Kidney limits phosphorus and potassium, Oncology removes contraindicated ingredients",
            "Supports are additive and non-conflicting — the AI applies all active constraints together",
            "Professionals activate supports through medical directives. Some activate automatically when lab values cross clinical thresholds.",
            "The colored dots in every Client Folder and dashboard show exactly which supports are active at a glance",
          ],
        },
        {
          heading: "Lab Integration and Protocol Activation",
          text: "When a client logs lab values in the app — A1C, LDL, blood pressure, ALT, creatinine, thyroid, and others — the system evaluates them against clinical thresholds and can activate clinical supports automatically.",
          list: [
            "LDL ≥ 130 mg/dL activates Cardiac Health support",
            "Elevated creatinine or specialist assignment activates Kidney Disease support",
            "Elevated ALT activates Liver Support or Liver Disease depending on severity",
            "A1C in diabetic range reinforces GLP-1 and Diabetic builder recommendations",
            "Physician-assigned Oncology Support is never activated automatically — it requires physician assignment only",
            "When a protocol activates from labs, the client is informed and a protocol recommendation modal explains the clinical reasoning with source citations",
            "If a physician has already assigned a protocol, lab-based changes defer to the physician's judgment",
          ],
        },
        {
          heading: "Accountability and Compliance",
          text: "ProCare includes a structured accountability system so professionals can see how well clients are following their plan without asking. The Compliance Score is calculated automatically from the last 30 days of activity.",
          list: [
            "Calorie Compliance — how accurately the client is hitting their daily calorie target",
            "Protein Compliance — how consistently they are meeting their protein goal",
            "Logging Compliance — how many days they actively logged meals in the window",
            "90%+ is excellent — the client is executing the plan consistently",
            "70–89% is on track — minor gaps but the system is working",
            "Below 70% is a check-in signal — something has shifted and a message or strategy review is warranted",
            "Cycle Protocol acknowledgment is tracked separately — the professional can see whether the client has read and confirmed a new nutrition strategy",
          ],
        },
        {
          heading: "How Coaches Earn",
          text: "ProCare includes a built-in affiliate and commission program for professionals who refer new subscribers to the platform.",
          list: [
            "Every professional receives a unique referral code to share with clients and their network",
            "When someone subscribes using that code, the professional earns a commission on every billing cycle — no caps, no limits",
            "Bronze Coach (0–49 active clients): 25% commission",
            "Silver Coach (50–99 active clients): 30% commission",
            "Gold Coach (100+ active clients): 35% commission",
            "Commissions are paid directly to the professional's bank account",
            "Tier upgrades happen automatically as your active client count grows",
          ],
        },
        {
          heading: "How to Connect (For Clients)",
          list: [
            "Go to the More tab in the bottom navigation",
            "Your trainer or physician gives you an access code (e.g. MP-9ZX4-QL)",
            "Enter the code on the More page to link instantly",
            "Or your professional can invite you by email directly",
            "Once connected, they appear on your active Care Team and can begin managing your plan",
            "You control permissions at any time — you can grant or revoke access to macros, meal board editing, and plan changes",
          ],
        },
      ],
    },
  },
  {
    id: "sushi-creator",
    title: "Sushi Creator",
    subtitle:
      "Japanese-inspired sushi and bowls — macros tracked, goals respected",
    icon: Fish,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Sushi is one of the most misunderstood foods in nutrition. It can be an incredibly clean, high-protein meal — or a hidden sugar and sodium bomb depending on how it's built. Sushi Creator gives you full control over every roll, nigiri, sashimi plate, or bowl so you know exactly what you're eating.",
        },
        {
          heading: "The Moment",
          text: "You want sushi — but you want to know it actually fits your macros. Or you want to recreate a restaurant favorite at home with better ingredients. This is built for both.",
        },
        {
          heading: "How It Works",
          text: "Describe the sushi you want, choose your style — roll, nigiri, sashimi, or sushi bowl — and the app builds a complete recipe with ingredients, preparation steps, and full nutritional breakdown. Every result is aligned with your dietary preferences and macro targets.",
        },
        {
          heading: "Style Options",
          list: [
            "Roll — classic maki and specialty rolls",
            "Nigiri — hand-pressed rice with fish or protein",
            "Sashimi — clean protein slices, no rice",
            "Sushi Bowl — deconstructed bowl with all the flavors",
            "Chef's Choice — let the AI decide based on your goals",
          ],
        },
        {
          heading: "What It Respects",
          list: [
            "Your macro targets and calorie budget",
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Health conditions and guardrails",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Cravings, Sushi & Desserts Hub → Sushi Creator"],
        },
      ],
    },
  },
  {
    id: "athlete-beverage-creator",
    title: "Athlete Beverage Creator",
    subtitle: "Performance drinks built for your training phase",
    icon: Activity,
    content: {
      sections: [
        {
          heading: "Why It Exists",
          text: "Most sports drinks are built for general audiences — not for your body, your training phase, or your actual performance goals. Athlete Beverage Creator builds performance drinks that are specific to how you train, when you train, and what you need to recover.",
        },
        {
          heading: "The Moment",
          text: "You're about to train, mid-workout, or recovering — and you want a drink that's actually built for that exact moment. Not a generic protein shake, but something calibrated to your phase and goals.",
        },
        {
          heading: "How It Works",
          text: "Describe what you need — a pre-workout energizer, an intra-workout hydration drink, a post-workout recovery shake, or anything performance-related. The app builds a custom beverage recipe with ingredients, preparation instructions, and a full nutritional breakdown aligned to your training goals.",
        },
        {
          heading: "What It's Built For",
          list: [
            "Pre-workout — energy and focus without the crash",
            "Intra-workout — hydration and electrolyte balance",
            "Post-workout — recovery, protein synthesis, and replenishment",
            "Endurance training — sustained fuel for long sessions",
            "Strength and hypertrophy — protein and creatine-forward builds",
          ],
        },
        {
          heading: "What It Respects",
          list: [
            "Your macro targets and performance goals",
            "Your dietary preferences and restrictions",
            "SafetyGuard allergy protections",
            "Your active training phase",
          ],
        },
        {
          heading: "Where to Find It",
          list: ["Lifestyle → Beverage Creator Hub → Athlete Beverage Creator"],
        },
      ],
    },
  },
  {
    id: "creator-studio",
    title: "Creator Studio — Build Your Own Nutrition System",
    subtitle: "Chef Studio · Brand Beverage Studio · Custom-built for you",
    icon: Sparkles,
    content: {
      sections: [
        {
          heading: "What This Is",
          text: "Creator Studio is a premium build service where our team designs and delivers a fully custom nutrition system under your name. This is not a template you fill out yourself — it is a done-for-you product built by us, handed off to you, and powered by the same AI infrastructure that runs My Perfect Meals.",
        },
        {
          heading: "Two Paths",
          list: [
            "Chef Studio — for chefs, trainers, coaches, and nutrition professionals who want their own branded meal planning system. Priced at $2,500 total ($1,250 deposit to start, $1,250 on delivery).",
            "Brand Beverage Studio — for beverage brands, supplement companies, and product lines that want a custom AI-powered drink creator embedded in their marketing or product experience. Custom pricing based on scope.",
          ],
        },
        {
          heading: "What You Get With Chef Studio",
          list: [
            "A fully branded nutrition system with your name and identity",
            "Custom AI trained on your food philosophy, cuisine style, and client needs",
            "Meal builder logic built around your protocols and preferences",
            "Delivered as a ready-to-use product — not a tool you configure yourself",
          ],
        },
        {
          heading: "What You Get With Brand Beverage Studio",
          list: [
            "A custom AI beverage creator built around your product line or brand",
            "Recipes and formulations that reflect your brand identity and target audience",
            "Built for marketing pages, apps, or in-product experiences",
            "Scoped and priced based on your specific use case",
          ],
        },
        {
          heading: "How the Process Works",
          list: [
            "1. Apply — fill out the intake form explaining your vision, audience, and goals",
            "2. We review — our team reads your application and confirms fit within a few business days",
            "3. Confirm and deposit — once accepted, a 50% deposit locks in your build slot",
            "4. We build — our team constructs your system, brand layer, and AI configuration",
            "5. Delivered — you receive your finished product and any onboarding you need",
          ],
        },
        {
          heading: "Who This Is For",
          text: "Any chef, coach, trainer, nutritionist, wellness brand, or beverage company that wants a custom AI-powered nutrition product without building the technology from scratch. You bring the vision, identity, and audience — we build the system.",
        },
        {
          heading: "Where to Apply",
          list: [
            "Lifestyle → Creator Studio → Chef Studio or Brand Beverage Studio",
          ],
        },
      ],
    },
  },
  {
    id: "companion-nutrition",
    title: "My Perfect Pets — Companion Nutrition Intelligence",
    subtitle: "Personalized dog wellness nutrition",
    icon: Heart,
    content: {
      sections: [
        {
          heading: "What This Is",
          text: "My Perfect Pets is a premium wellness nutrition system for dogs, built directly on the same adaptive protocol engine that powers your own meals. It is not a standalone pet app — it is a protocol translation layer that applies everything MPM already built for human nutrition to canine wellness guidance.",
        },
        {
          heading: "The Same Engine, Translated",
          text: "The core AI generation engine, the protocol envelope system, the condition stacking logic, and the shopping infrastructure are all shared with the human nutrition system. When you improve MPM, you improve My Perfect Pets. This is intentional architecture, not a feature add-on.",
        },
        {
          heading: "The 4-Layer Dog Protocol",
          list: [
            "Layer 1 — Safety: Toxic Ingredient Firewall. Hard blocks on chocolate, xylitol, grapes, garlic, onions, macadamia nuts, and all other known canine toxins. Non-negotiable. Cannot be overridden.",
            "Layer 2 — Wellness: Condition-specific protocol stacking. Senior support, kidney support, anti-inflammatory, joint wellness, diabetic support, skin and coat support, and more — stacked simultaneously when needed.",
            "Layer 3 — Profile: Dog-specific allergies, food sensitivities, veterinarian-specified dietary restrictions, and current medications (for nutrition awareness only — no drug interaction analysis).",
            "Layer 4 — Preferences: Activity level, treat frequency, portion context, and behavioral notes.",
          ],
        },
        {
          heading: "Toxic Ingredient Firewall",
          text: "Every recipe generated for your dog is screened through the Toxic Ingredient Firewall before you see it. If a generated recipe contains a known canine toxin — even as a trace mention — it is blocked and regenerated. You never see an unsafe recipe. The firewall is not AI-guided: it is a hardcoded list of known toxic ingredients sourced from ASPCA Poison Control and AVMA veterinary safety references.",
        },
        {
          heading: "Controlled Veterinary Citations",
          text: "All wellness protocols include controlled citations from pre-approved veterinary sources: WSAVA Global Nutrition Guidelines, AAHA Nutritional Assessment Guidelines, Tufts Cummings School of Veterinary Medicine, ASPCA Animal Poison Control, and IRIS. The AI is never permitted to invent veterinary sources. Citations are condition-mapped and injected from a verified library.",
        },
        {
          heading: "Ingredient Safety Scanner",
          text: "Type any food ingredient to instantly check if it is safe for your dog. The scanner runs the ingredient through the Toxic Ingredient Firewall and returns a safety rating (SAFE, CAUTION, or TOXIC), the reason it is flagged, and a safe substitution. Safe ingredients also receive an AI-generated wellness score and nutritional notes.",
        },
        {
          heading: "Important Limitations",
          text: "My Perfect Pets provides wellness nutrition guidance only. It is not veterinary medicine, does not diagnose conditions, and does not replace veterinary care. For any health concern, medical condition, or significant dietary change, always consult a licensed veterinarian.",
        },
        {
          heading: "Veterinary Sources",
          list: [
            "WSAVA Global Nutrition Guidelines — wsava.org",
            "AAHA Nutritional Assessment Guidelines for Dogs and Cats — aaha.org",
            "Tufts Cummings School of Veterinary Medicine, Clinical Nutrition Service — vetnutrition.tufts.edu",
            "ASPCA Animal Poison Control Center — aspca.org/pet-care/animal-poison-control",
            "IRIS — International Renal Interest Society — iris-kidney.com",
            "AVMA — American Veterinary Medical Association — avma.org",
          ],
        },
      ],
    },
  },
];

const SECTION_PERFORMANCE_MODES: LibraryTopic[] = [
  {
    id: "performance-modes-overview",
    title: "What Are Performance Modes?",
    subtitle: "App-wide metabolic settings for athletic and physique goals",
    icon: Zap,
    content: {
      sections: [
        {
          heading: "A Mode That Follows You Everywhere",
          text: "A Performance Mode is an app-wide metabolic setting that changes how every meal generator in the app approaches your nutrition. When a mode is active, it's not just applied to one builder — it travels with you across Create a Dish, Chef's Kitchen, the Weekly Planner, Fridge Rescue, and every other tool.",
        },
        {
          heading: "Different From Your Meal Builder",
          text: "Your meal builder (General Nutrition, Anti-Inflammatory, Diabetic, etc.) determines the type and foundation of your meals. A Performance Mode is a layer on top of that foundation — a metabolic direction that shapes macros, ingredient choices, and carb handling without changing your underlying plan.",
        },
        {
          heading: "Standard",
          text: "Balanced everyday nutrition. No special adjustments. This is the default for most users.",
        },
        {
          heading: "Competition Prep",
          text: "Tighter carb control and lean-focused meal recommendations. Designed for physique competition prep phases. Hard cut macros, low-carb split, and a 30g cap on starchy carbs per meal.",
        },
        {
          heading: "Where to Set It",
          text: "Open the Macro Calculator, select your goal, and choose Competition Prep. After calculating, tap the Apply button at the save step. The mode becomes active across the entire app immediately.",
        },
      ],
    },
  },
  {
    id: "competition-prep-mode",
    title: "Competition Prep Mode — How It Works",
    subtitle: "What changes across your app when prep mode is active",
    icon: Flame,
    content: {
      sections: [
        {
          heading: "This Is Not Just a Cut",
          text: "Competition Prep is not a standard fat-loss goal. It is a metabolic overlay that changes how the entire app generates food for you. Every tool — not just the macro calculator — operates under competition standards when this mode is active.",
        },
        {
          heading: "The Three Core Changes",
          list: [
            "Hard cut — macros are calculated for an aggressive deficit, not a moderate cut",
            "Low-carb split — carbohydrates are significantly reduced in favor of protein and strategic fats",
            "30g starchy carb cap — no meal in any builder will exceed 30 grams of starchy carbohydrates",
          ],
        },
        {
          heading: "Where It Applies",
          list: [
            "Create a Dish — dishes are generated lean with low starch",
            "Chef's Kitchen — chef-guided meals follow prep standards",
            "Weekly Meal Planner — full week of meals built to competition specs",
            "Fridge Rescue — ingredient-based meals stay within the carb cap",
            "Snack Creator — snacks are protein-forward and low-carb",
            "Beverage Creator — beverages follow low-sugar, performance guidelines",
          ],
        },
        {
          heading: "How to Activate It",
          list: [
            "Open the Macro Calculator",
            "In the goal step, tap the Competition Prep pill",
            "Review your calculated macros",
            "At the save step, tap the Apply button under the results",
            "The mode is now active app-wide",
          ],
        },
        {
          heading: "How to Turn It Off",
          text: "Return to the Macro Calculator, select a different goal (Fat Loss, Maintain, or Build Muscle), recalculate, and save. The overlay automatically reverts to Standard mode.",
        },
      ],
    },
  },
  {
    id: "performance-modes-safety",
    title: "Works With Your Existing Builder",
    subtitle: "Medical and dietary protections always stay active",
    icon: Shield,
    content: {
      sections: [
        {
          heading: "This Is the Most Important Thing to Understand",
          text: "Performance Modes work alongside your existing health and dietary settings. Your diabetic guardrails, anti-inflammatory protocols, allergy protections, and physician safety rules always remain active — a Performance Mode cannot override them.",
        },
        {
          heading: "What This Means in Practice",
          text: "If you are diabetic and activate Competition Prep mode, the app applies the comp prep carb cap AND your diabetic carb ceiling simultaneously — whichever is stricter wins. If you have a tree nut allergy, no Competition Prep meal will ever contain tree nuts. Your safety layer is always the outermost wall.",
        },
        {
          heading: "The Priority Order",
          list: [
            "Medical protections (always highest — physician-assigned rules and clinical safety)",
            "Dietary identity (kosher, halal, vegan, gluten-free — cannot be overridden)",
            "Health conditions (diabetic, anti-inflammatory, GLP-1 settings)",
            "Performance Mode (applies within all the above constraints)",
            "Flavor and behavioral preferences (softest layer, shapes meals within everything above)",
          ],
        },
        {
          heading: "Why This Matters",
          text: "Some users worry that activating competition prep will cancel their diabetic or cardiac protections. It will not. The medical guardrails are structural — they run underneath everything else and can never be switched off by a goal selection.",
        },
      ],
    },
  },
  {
    id: "performance-modes-control",
    title: "Self-Guided vs Coach-Controlled",
    subtitle: "How performance settings work with and without a coach",
    icon: Users,
    content: {
      sections: [
        {
          heading: "Two Ways Performance Modes Can Be Set",
          text: "Performance Modes can be activated in two ways — self-guided by you directly in the Macro Calculator, or coach-controlled when a professional coach is managing your plan through ProCare.",
        },
        {
          heading: "Self-Guided",
          text: "You open the Macro Calculator, select your goal, and apply the mode yourself. The app safely automates the macro adjustments based on proven contest prep principles. This works well for general competition prep and gives you full control.",
        },
        {
          heading: "Coach-Controlled",
          text: "A connected coach can make advanced adjustments such as carb cycling, refeed days, peak week protocols, and competition-specific strategies through the Pro portal. When coach-controlled mode is active, your coach's settings take priority over manual changes — protecting the integrity of their program.",
        },
        {
          heading: "Which Should I Use?",
          list: [
            "Self-guided is right if you're prepping independently and understand your own nutrition",
            "Coach-controlled is right if a competition coach or dietitian is managing your plan",
            "If a coach is involved, always let them set the mode — they can see your full picture",
          ],
        },
        {
          heading: "A Note for ProCare Users",
          text: "If your coach has set your performance mode, you will see it reflected in your macro calculator results. Manual changes you make may be overridden by your coach's program settings if they are actively managing your plan.",
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
    id: "performance-modes",
    label: "PERFORMANCE MODES",
    description: "Competition prep & athletic overlays",
    topics: SECTION_PERFORMANCE_MODES,
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
