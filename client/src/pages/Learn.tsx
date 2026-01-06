import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Video,
  Target,
  Apple,
  Brain,
  Search,
  X,
  Calculator,
  Info,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LearningTopic {
  id: string;
  title: string;
  description: string;
  icon: any;
  gradient: string;
  content: {
    sections: Array<{
      heading: string;
      text?: string;
      list?: string[];
    }>;
  };
}

type FoodPresetKey = "breast" | "thigh" | "salmon" | "rice" | "olive_oil";
type FoodMacroPer100g = { label: string; p: number; c: number; f: number };

const FOOD_PRESETS: Record<FoodPresetKey, FoodMacroPer100g> = {
  breast: { label: "Chicken Breast", p: 31, c: 0, f: 3.6 },
  thigh: { label: "Chicken Thigh", p: 26, c: 0, f: 10.9 },
  salmon: { label: "Salmon", p: 25, c: 0, f: 14 },
  rice: { label: "White Rice", p: 2.7, c: 28, f: 0.3 },
  olive_oil: { label: "Olive Oil", p: 0, c: 0, f: 100 },
};

function kcalPer100g(food: FoodMacroPer100g) {
  return 4 * food.p + 4 * food.c + 9 * food.f;
}

function gramsFor100kcal(food: FoodMacroPer100g) {
  const k100 = kcalPer100g(food);
  if (k100 <= 0) return 0;
  return Math.round((10000 / k100) * 10) / 10;
}

function macroAt100kcal(food: FoodMacroPer100g) {
  const g100 = gramsFor100kcal(food);
  return {
    p: Math.round(((food.p * g100) / 100) * 10) / 10,
    c: Math.round(((food.c * g100) / 100) * 10) / 10,
    f: Math.round(((food.f * g100) / 100) * 10) / 10,
    grams: g100,
    ounces: Math.round(g100 * 0.0352739619 * 10) / 10,
  };
}

function PocketMathCard() {
  const [leftFood, setLeftFood] = useState<FoodPresetKey>("breast");
  const [rightFood, setRightFood] = useState<FoodPresetKey>("thigh");

  const L = macroAt100kcal(FOOD_PRESETS[leftFood]);
  const R = macroAt100kcal(FOOD_PRESETS[rightFood]);

  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/20 text-white mt-6">
      <CardContent className="p-5">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-orange-400" />
          Pocket Math: Food Comparison Tool
        </h3>

        <div className="mb-4 p-4 rounded-xl border border-white/20 bg-black/20">
          <p className="text-sm text-white/90 leading-relaxed">
            <strong>Why fat changes "how much food" you get:</strong> Fat has 9
            calories per gram vs 4 for protein/carbs. In a 100-calorie portion,
            higher-fat foods give you less weight/volume and usually less
            protein. Compare foods below to see the difference!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-white/80 mb-2 block">
              Food A
            </label>
            <select
              value={leftFood}
              onChange={(e) => setLeftFood(e.target.value as FoodPresetKey)}
              className="w-full bg-black/40 backdrop-blur-lg border border-white/30 rounded-lg px-3 py-2 text-sm text-white"
            >
              {(Object.keys(FOOD_PRESETS) as FoodPresetKey[]).map((k) => (
                <option key={k} value={k} className="bg-black text-white">
                  {FOOD_PRESETS[k].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/80 mb-2 block">
              Food B
            </label>
            <select
              value={rightFood}
              onChange={(e) => setRightFood(e.target.value as FoodPresetKey)}
              className="w-full bg-black/40 backdrop-blur-lg border border-white/30 rounded-lg px-3 py-2 text-sm text-white"
            >
              {(Object.keys(FOOD_PRESETS) as FoodPresetKey[]).map((k) => (
                <option key={k} value={k} className="bg-black text-white">
                  {FOOD_PRESETS[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/25 bg-black/40 backdrop-blur-lg p-4">
            <div className="text-sm font-semibold text-white mb-3">
              {FOOD_PRESETS[leftFood].label}
            </div>
            <div className="space-y-2">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-[11px] uppercase text-white/70 mb-1">
                  100 calorie portion
                </div>
                <div className="text-white font-bold text-lg">
                  {L.grams}g{" "}
                  <span className="text-sm text-white/70">({L.ounces} oz)</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-[11px] uppercase text-white/70 mb-1">
                  Macros
                </div>
                <div className="text-white font-semibold text-sm">
                  {L.p}g P • {L.c}g C • {L.f}g F
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/25 bg-black/40 backdrop-blur-lg p-4">
            <div className="text-sm font-semibold text-white mb-3">
              {FOOD_PRESETS[rightFood].label}
            </div>
            <div className="space-y-2">
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-[11px] uppercase text-white/70 mb-1">
                  100 calorie portion
                </div>
                <div className="text-white font-bold text-lg">
                  {R.grams}g{" "}
                  <span className="text-sm text-white/70">({R.ounces} oz)</span>
                </div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                <div className="text-[11px] uppercase text-white/70 mb-1">
                  Macros
                </div>
                <div className="text-white font-semibold text-sm">
                  {R.p}g P • {R.c}g C • {R.f}g F
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-orange-400/30 bg-orange-600/15 p-3 text-sm">
          <strong className="text-white">Takeaway:</strong>{" "}
          <span className="text-white/90">
            For the same calories, lean foods (lower fat) give you more food
            volume and more protein. Use this to keep protein high without
            blowing through fat calories.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Learn() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<LearningTopic | null>(
    null,
  );

  useEffect(() => {
    document.title = "Learn | My Perfect Meals";
  }, []);

  const learningTopics: LearningTopic[] = [
    {
      id: "emotion-ai",
      title: "The Brain Behind Emotion AI",
      description: "How your meals are decided, checked, and protected",
      icon: Brain,
      gradient: "from-orange-500/20 to-orange-600/20",
      content: {
        sections: [
          {
            heading: "This Is Not a 'Suggestion App'",
            text: "Most apps work like this: 'Here's a meal. Hope it fits your goals.' My Perfect Meals works differently: 'Who is this person, what condition are they in right now, what rules must be followed - and if anything breaks those rules, fix it before the meal is shown.'",
          },
          {
            heading: "The App Thinks in Context - Not Labels",
            text: "You'll see terms like Diabetic, GLP-1, Competition, and Anti-Inflammatory. In My Perfect Meals, these are not just modes or labels. Each one activates a set of non-negotiable rules that control how meals are built. If a rule applies to you, the app enforces it automatically.",
          },
          {
            heading: "Real-Time Awareness (Not Static Plans)",
            text: "If you're diabetic, the app doesn't just know that you're diabetic. It looks at your most recent blood sugar, your current metabolic state, and your doctor-defined limits. Meals change based on what your body needs right now, not what a plan said weeks ago.",
          },
          {
            heading: "GLP-1 and How You Actually Feel",
            text: "If you're using GLP-1 medications, the app adapts to appetite changes, nausea, reflux, and digestive sensitivity. That means smaller, protein-dense meals when appetite is low, gentler foods when symptoms are high, and no oversized, greasy meals that make you feel worse.",
          },
          {
            heading: "Performance Rules Are Enforced - Not Hoped For",
            text: "If you're in Competition or Pro Performance mode, protein minimums are mandatory, carb limits are mandatory, and cravings never override performance rules. If a meal doesn't meet the requirements, it is rejected and rebuilt automatically.",
          },
          {
            heading: "The Safety Check You Never See",
            text: "Every meal and snack goes through a hidden process: The meal is generated, the system checks it against your rules, if it violates a critical rule it is automatically corrected, and if it still fails the meal is discarded and replaced with a safe option. You never see unsafe meals.",
          },
          {
            heading: "Why This Matters",
            text: "This is what separates My Perfect Meals from typical nutrition apps. We don't rely on willpower or 'good suggestions.' We enforce safety, performance, and medical rules at the system level. That's how doctors trust it, athletes rely on it, and users feel confident using it daily.",
            list: [
              "Doctors trust it",
              "Athletes rely on it",
              "Users feel confident using it daily",
            ],
          },
          {
            heading: "In One Sentence",
            text: "My Perfect Meals doesn't just track food - it actively protects your decisions.",
          },
        ],
      },
    },
    {
      id: "fiber-vegetables",
      title: "Fiber & Vegetables",
      description: "Understanding fiber and gut health",
      icon: Apple,
      gradient: "from-emerald-500/20 to-teal-500/20",
      content: {
        sections: [
          {
            heading: "The Importance of Fiber",
            text: "Fiber is a type of carbohydrate that your body can't digest. While it may seem odd to eat something your body can't break down, fiber is crucial for:",
            list: [
              "Digestive health and regularity",
              "Blood sugar control",
              "Heart health",
              "Weight management",
              "Feeding beneficial gut bacteria",
            ],
          },
          {
            heading: "Daily Fiber Goals",
            text: "Aim for 25-38 grams of fiber per day from whole grains, fruits, vegetables, legumes, and nuts.",
          },
          {
            heading: "Best Sources",
            list: [
              "Vegetables: Broccoli, Brussels sprouts, carrots",
              "Fruits: Berries, apples, pears",
              "Whole grains: Oats, quinoa, brown rice",
              "Legumes: Beans, lentils, chickpeas",
            ],
          },
        ],
      },
    },
    {
      id: "how-to-videos",
      title: "Copilot Walkthroughs",
      description: "Guided, step-by-step help using Copilot",
      icon: Video,
      gradient: "from-orange-600/20 to-orange-500/20",
      content: {
        sections: [
          {
            heading: "Copilot Has Replaced Video Tutorials",
            text: "Instead of watching long videos, your Copilot now teaches you in real time. It opens the right page, dims the screen, and walks you through each step while you actually use the feature.",
          },
          {
            heading: "Available Tutorials",
            list: [
              "Fridge Rescue: How to enter items and generate meals",
              "Craving Creator: How to build or choose cravings step-by-step",
              "Weekly Meal Board: How to plan your day or week with Copilot",
              "Macro Calculator: How to send meals and check your macros",
              "My Biometrics: How to log weight and update your stats",
              "Shopping List: How to send meals and organize your groceries",
            ],
          },
        ],
      },
    },
    {
      id: "how-mpm-works",
      title: "How the My Perfect Meals System Works",
      description: "A simple, hormone-aware approach to meal planning that actually works in real life",
      icon: BookOpen,
      gradient: "from-orange-500/20 to-orange-600/20",
      content: {
        sections: [
          {
            heading: "This Is Not Traditional Meal Planning",
            text: "Most nutrition apps focus on calories and restriction. My Perfect Meals is built differently. Our system is designed around how your body actually responds to food — hormones, hunger, energy, and metabolism — not just numbers on a label."
          },
          {
            heading: "Step 1: Start With Macros (Not Calories)",
            text: "Instead of obsessing over calories, we start with macros. Protein, carbs, and fats determine how full you feel, how stable your energy is, and how your body uses food. Calories are a result — not the driver."
          },
          {
            heading: "Step 2: Understand Carbs the Right Way",
            text: "All carbs are not the same. My Perfect Meals separates carbs into two types: fibrous carbs (vegetables) and starchy carbs (grains, potatoes, rice, sugars). Fibrous carbs support digestion, metabolism, and fullness. Starchy carbs must be intentional."
          },
          {
            heading: "Step 3: Use the Starch Meal Strategy",
            text: "Instead of forcing you to count carb grams all day, we convert your daily starch allowance into meals. Most people do best with one starch-based meal per day. Some can split starch across two meals. This makes eating simple and sustainable."
          },
          {
            heading: "Step 4: Meals Are Built for Hormones, Not Willpower",
            text: "Each meal is designed to stabilize blood sugar, control hunger, and support hormones. Protein anchors every meal. Fibrous carbs are encouraged. Starches are placed intentionally — not accidentally."
          },
          {
            heading: "Step 5: Plan First, Track Less",
            text: "When meals are planned correctly, tracking becomes easier — or unnecessary. You don’t need to micromanage every bite. The structure does the work for you."
          },
          {
            heading: "Why This System Works",
            list: [
              "You eat more vegetables without fear",
              "You stop overeating starches by accident",
              "You stay full longer with less effort",
              "Your energy stays more consistent",
              "Meal planning becomes simple, not stressful"
            ]
          },
          {
            heading: "The Goal",
            text: "My Perfect Meals isn’t about restriction. It’s about clarity. When you understand how food works in your body, eating well becomes automatic — not exhausting."
          },
        ],
      },
    },
    {
      id: "calories-vs-macros",
      title: "Calories vs Macros",
      description:
        "Why macro tracking beats calorie counting + practical tools",
      icon: Calculator,
      gradient: "from-blue-500/20 to-cyan-500/20",
      content: {
        sections: [
          {
            heading: "Before Calculating: Understanding Macro Basics",
            text: "Macros (macronutrients) are the three main nutrients your body needs in large quantities: Protein, Carbohydrates, and Fat. Unlike counting calories alone, tracking macros gives you a complete picture of what you're eating.",
            list: [
              "Protein: 4 calories per gram - Builds muscle, repairs tissue, supports immune function",
              "Carbohydrates: 4 calories per gram - Primary energy source for workouts and brain function",
              "Fat: 9 calories per gram - Essential for hormones, vitamin absorption, and satiety",
            ],
          },
          {
            heading: "Why Track Macros Instead of Calories?",
            text: "Calories tell you 'how much' you're eating, but macros tell you 'what' you're eating. Two meals with identical calories can have completely different effects on your body based on their macro composition.",
            list: [
              "Better body composition: High protein helps preserve muscle during weight loss",
              "Sustained energy: Balanced macros prevent energy crashes and cravings",
              "Hormonal health: Adequate fat intake supports hormone production",
              "Athletic performance: Proper carb timing fuels your workouts",
              "Personalization: Adjust macros based on your goals (muscle gain, fat loss, maintenance)",
            ],
          },
          {
            heading: "Carb Lanes That Make Sense",
            text: "Think of carbs in 'lanes' based on your activity level and goals:",
            list: [
              "Low Lane (50-100g): For sedentary days or aggressive fat loss",
              "Moderate Lane (100-200g): For general health and moderate activity",
              "Performance Lane (200-300g+): For athletes, high activity, or muscle building",
              "Example: A 150lb person lifting 4x/week might aim for 150-200g carbs daily",
            ],
          },
          {
            heading: "Protein and Fat Anchors",
            text: "Set your protein and fat as 'anchors' - non-negotiable targets you hit daily. Carbs become your 'flexible' macro that adjusts based on activity.",
            list: [
              "Protein Anchor: 0.8-1.2g per lb bodyweight (higher if building muscle or cutting)",
              "Fat Anchor: 0.3-0.5g per lb bodyweight (minimum for hormonal health)",
              "Carb Flexibility: Fill remaining calories with carbs based on activity level",
              "Example for 150lb person: 150g protein (anchor), 60g fat (anchor), 150-250g carbs (flexible)",
            ],
          },
          {
            heading: "Pocket Math: Quick Calculations",
            text: "Learn these quick calculations to estimate macros on the go without a calculator:",
            list: [
              "Protein Rule: Your bodyweight in grams (150 lbs = 150g protein target)",
              "Fat Floor: Bodyweight × 0.35 (150 lbs = ~50g fat minimum)",
              "Calorie Check: Protein × 4 + Carbs × 4 + Fat × 9 = Total Calories",
              "Quick Estimation: 1 palm of protein = ~25g, 1 fist of carbs = ~30g, 1 thumb of fat = ~10g",
              "Restaurant Math: Divide plate into thirds - one-third protein, one-third carbs, one-third veggies (fat is usually in cooking)",
            ],
          },
        ],
      },
    },
  ];

  const filteredTopics = learningTopics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleTopicClick = (topic: LearningTopic) => {
    setSelectedTopic(topic);
  };

  const handleCloseModal = () => {
    setSelectedTopic(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            App Library
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-7xl mx-auto px-4 text-white space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

      {/* Search Bar */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-orange-400" />
          <Input
            type="text"
            placeholder="Search topics or guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/30 backdrop-blur-lg border border-white/10 text-white placeholder:text-gray-400 focus:border-orange-400"
            data-testid="input-search-topics"
          />
        </div>
      </div>

      {/* Content - Learning Library Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <Card
                key={topic.id}
                className={`bg-black/30 backdrop-blur-lg border-2 border-white/10 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 hover:border-orange-400/50 rounded-2xl shadow-md`}
                onClick={() => handleTopicClick(topic)}
                data-testid={`card-learn-${topic.id}`}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <Icon className="h-8 w-8 md:h-10 md:w-10 text-white" />
                    <h3 className="text-base md:text-lg font-semibold text-white">
                      {topic.title}
                    </h3>
                    <p className="text-xs md:text-sm text-white/90 leading-snug">
                      {topic.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* No Results Message */}
        {filteredTopics.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No topics found matching "{searchQuery}"
            </p>
            <Button
              onClick={() => setSearchQuery("")}
              variant="ghost"
              className="mt-4"
              data-testid="button-clear-search"
            >
              Clear search
            </Button>
          </div>
        )}
      </div>

      {/* Content Modal */}
      <Dialog open={!!selectedTopic} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-black/40 backdrop-blur-lg border border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {selectedTopic && (
                <>
                  <div className="p-3 bg-gradient-primary rounded-xl">
                    <selectedTopic.icon className="h-6 w-6 text-white" />
                  </div>
                  <DialogTitle className="text-2xl font-bold text-white">
                    {selectedTopic.title}
                  </DialogTitle>
                </>
              )}
            </div>
            <DialogDescription className="text-base text-white/90">
              {selectedTopic?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedTopic && (
            <div className="space-y-6 py-4">
              {selectedTopic.content.sections.map((section, index) => (
                <div key={index} className="space-y-3">
                  <h3 className="text-lg font-bold text-white">
                    {section.heading}
                  </h3>
                  {section.text && (
                    <p className="text-white/90 leading-relaxed">
                      {section.text}
                    </p>
                  )}
                  {section.list && (
                    <ul className="space-y-2 ml-4">
                      {section.list.map((item, i) => (
                        <li
                          key={i}
                          className="text-white/90 flex items-start gap-2"
                        >
                          <span className="text-orange-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {/* Pocket Math Food Comparison Tool for Calories vs Macros */}
              {selectedTopic.id === "calories-vs-macros" && <PocketMathCard />}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </motion.div>
  );
}
