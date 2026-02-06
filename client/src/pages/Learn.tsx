import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { useNarration } from "@/hooks/useNarration";

interface LibraryTopic {
  id: string;
  title: string;
  icon: React.ElementType;
  content: {
    sections: Array<{
      heading: string;
      text?: string;
      list?: string[];
    }>;
  };
}

const libraryTopics: LibraryTopic[] = [
  {
    id: "emotion-ai",
    title: "How Emotion AI Works",
    icon: Brain,
    content: {
      sections: [
        {
          heading: "What is Emotion AI?",
          text: "Emotion AI doesn't suggest meals. It enforces rules. That's the difference. While other apps generate random options, My Perfect Meals uses behavioral guardrails to ensure every meal fits your goals.",
        },
        {
          heading: "How It Works",
          list: [
            "Analyzes your macro targets and dietary preferences",
            "Enforces portion control based on your goals",
            "Prevents meals that would exceed your daily limits",
            "Adapts to your metabolic profile and activity level",
          ],
        },
        {
          heading: "Why It Matters",
          text: "This isn't a calorie counter that lets you eat anything. It's a coaching system that keeps you on track, even when cravings hit.",
        },
      ],
    },
  },
  {
    id: "meal-generation",
    title: "How Meal Generation Works",
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
            "Chef's Kitchen Studio",
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
      ],
    },
  },
  {
    id: "macro-calculator",
    title: "How the Macro Calculator Works",
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
    id: "safetyguard",
    title: "SafetyGuard\u2122 \u2014 Allergy Protection",
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
    id: "starchguard",
    title: "Starch Guard — Weight Management",
    icon: Zap,
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
      ],
    },
  },
  {
    id: "glucoseguard",
    title: "GlucoseGuard™ — Diabetic Meal Adjustment",
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
    id: "nutrition-budget",
    title: "Nutrition Budget — Daily Tracking",
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
          text: "Most apps only tell you what you ate. The Nutrition Budget tells you what to eat next. It's coaching in real-time, helping you make smarter choices as your day unfolds.",
        },
      ],
    },
  },
  {
    id: "palate-preferences",
    title: "Palate Preferences — Flavor Customization",
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
  {
    id: "meal-builder",
    title: "How the Meal Builder Works",
    icon: Utensils,
    content: {
      sections: [
        {
          heading: "Build Your Day",
          text: "The Meal Builder lets you construct a full day of eating that hits your exact macro targets.",
        },
        {
          heading: "How It Works",
          list: [
            "Add breakfast, lunch, dinner, and snacks",
            "Watch your macro totals update in real-time",
            "Swap meals until the numbers align",
            "Save complete meal days for future use",
          ],
        },
        {
          heading: "The Benefit",
          text: "No more guessing. No more hoping the math works out. You see exactly where you stand before eating a single bite.",
        },
      ],
    },
  },
  {
    id: "why-different",
    title: "Why This App Is Different",
    icon: Zap,
    content: {
      sections: [
        {
          heading: "Not Another Calorie Counter",
          text: "Most nutrition apps track what you ate. My Perfect Meals tells you what to eat—before you eat it.",
        },
        {
          heading: "Key Differences",
          list: [
            "Proactive meal planning, not reactive tracking",
            "AI-generated meals tailored to your exact needs",
            "Behavioral guardrails that prevent diet failures",
            "Coach voice guidance when you need support",
          ],
        },
        {
          heading: "The Philosophy",
          text: "Information alone doesn't change behavior. Structure does. That's what this app provides.",
        },
      ],
    },
  },
  {
    id: "medical-sources",
    title: "Medical & Nutrition Sources",
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
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 ${
          isExpanded
            ? "bg-black/70 border border-white/20 shadow-lg"
            : "bg-black/50 border border-white/10 hover:bg-black/60 hover:border-white/15"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5">
            <Icon className="h-4 w-4 text-white/80" />
          </div>
          <span className="text-white font-medium text-sm">{topic.title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/60" />
        )}
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
            <div className="mt-2 p-4 bg-black/40 rounded-xl border border-white/10">
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
                      onClick={narration.isPlaying ? narration.pause : narration.play}
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
                      {narration.currentSectionIndex + 1}/{narration.totalSections}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {topic.content.sections.map((section, index) => (
                  <div
                    key={index}
                    className={`space-y-2 transition-all ${
                      mode === "listen" && narration.currentSectionIndex === index
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
      {/* Fixed Black Glass Navigation Banner */}
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
            <p className="text-xs text-white/60">Learn how My Perfect Meals works</p>
          </div>
        </div>
      </div>

      {/* Content with padding for fixed header */}
      <div 
        className="max-w-lg mx-auto pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="space-y-2">
          {libraryTopics.map((topic) => (
            <LibraryItem key={topic.id} topic={topic} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
