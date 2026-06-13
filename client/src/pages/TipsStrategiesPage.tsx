import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, Lightbulb, BookOpen, Bot, Library, Wrench, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCopilot } from "@/components/copilot/CopilotContext";

const PLATFORM_TIPS = [
  {
    title: "Getting Started",
    content: `Complete your profile fully before generating your first meal — this is the single biggest factor in how well the AI understands you. Set your goal (lose, gain, maintain), add your dietary identity (vegan, keto, etc.), list any allergies or intolerances, and fill in any health conditions that affect your nutrition. The platform builds every meal around this profile.

Don't rush onboarding. The more detail you provide upfront, the less you'll need to correct later. You can always update your profile from the Hub as your goals evolve.

Start with Create a Dish or Chef's Kitchen for your first few meals — these give you the most control and teach you how the AI responds to different types of instructions.`,
  },
  {
    title: "How to Talk to AI",
    content: `The AI responds best to specific, descriptive language. Instead of "chicken dinner," say "grilled lemon herb chicken thighs with roasted Mediterranean vegetables." Instead of "healthy breakfast," say "high-protein egg white scramble with spinach, sun-dried tomatoes, and feta."

Describe the vibe and experience you want, not just the ingredients. Mention cooking method (grilled, baked, sautéed, raw), cuisine style (Mexican, Thai, Italian), texture (crispy, creamy, light), and meal occasion (quick weeknight dinner, weekend brunch, post-workout meal).

Use constraints clearly: "no nuts," "under 500 calories," "ready in 20 minutes," "uses only pantry staples." The AI treats these as hard limits, not suggestions.

If a meal isn't quite right, don't start over — iterate. Tap to regenerate with a small tweak rather than writing an entirely new prompt. Small adjustments produce better results than complete rewrites.`,
  },
  {
    title: "Weekly Meal Board Workflow",
    content: `The Meal Board is your weekly command center. At the start of each week (Sunday works best for most people), plan out 5–7 dinners on the board, then fill in lunches and breakfasts from your Favorites or Saved Meals.

Once your board is set, generate your Shopping List directly from it — everything you need for the week in one organized list, grouped by category. This eliminates mid-week grocery runs and impulse buys.

Keep a "rotation library" of 20–30 meals you love across all builders. Each week you're pulling from that library, not starting from scratch. This makes weekly planning take 5 minutes instead of 30.

Use the board to spot macro patterns. If Monday through Wednesday are all low-protein, you'll catch it before it becomes a week-long problem.`,
  },
  {
    title: "Favorites Strategy",
    content: `Star every meal you'd genuinely eat again. Build a core rotation of 15–20 meals you love — that's your "default library." When you don't feel like generating something new, you pull from this list.

Organize your favorites mentally by meal type: 5 go-to breakfasts, 5 lunches, 5 dinners, 5 snacks. Once you have this foundation, you'll almost never feel stuck on what to eat.

Your favorites list is also where you discover which meal builders work best for your tastes. If all your starred meals came from Fridge Rescue, that tells you something about how you like to eat.

Review and refresh your favorites monthly. Remove meals you've gotten bored of, add new ones from recent builds. Keep the list alive and relevant.`,
  },
  {
    title: "Saved Meals Strategy",
    content: `Save meals you want to revisit or use as templates — meals that were close to perfect but you want to tweak, or meals you loved but want to build variations from.

Use saved meals as starting points when you want something familiar but slightly different. "Make this meal but with salmon instead of chicken" or "adjust this recipe to 400 calories" builds on something already proven.

Saved Meals are also useful for sharing. If a coach or family member wants to see what you've been eating, your saved meals are the most accurate snapshot of your actual nutrition habits.

Unlike Favorites (meals you love and eat regularly), think of Saved Meals as your recipe development library — meals in progress, meals with potential, meals you want to come back to.`,
  },
  {
    title: "Shopping List Strategy",
    content: `Generate your Shopping List from the Meal Board for maximum efficiency — the platform pulls every ingredient across your planned meals and groups them intelligently.

Before you generate, make sure your Meal Board reflects what you're actually going to cook. Don't plan ambitious meals for busy weekdays. The best shopping list is one you'll actually follow.

When shopping, tackle the list by section: produce first, proteins second, pantry staples last. This mirrors the layout of most grocery stores and cuts your shopping time significantly.

Use the shopping list to batch-buy. If three meals this week call for ground turkey, you'll see it in one line item — buy it all at once and portion it out when you get home. This is the foundation of efficient meal prep.`,
  },
  {
    title: "Fridge Rescue Secrets",
    content: `The secret to Fridge Rescue is specificity. Don't just enter "chicken and vegetables" — enter "2 chicken breasts, half a bag of spinach, 3 eggs, some cheddar, leftover rice, soy sauce, garlic." The more granular your input, the more creative and accurate the output.

Always include your pantry staples: olive oil, butter, salt, pepper, garlic, onion, vinegar, hot sauce. These transform what's possible from your fridge contents dramatically.

Run Fridge Rescue 2–3 times on the same set of ingredients. The first result is rarely the most creative. Let the AI surprise you with combinations you wouldn't have thought of yourself.

Fridge Rescue is most powerful in the last 2–3 days before your grocery run when you're trying to avoid waste. Keep the habit of running it every Thursday or Friday before the weekend shop.`,
  },
  {
    title: "Create a Dish Secrets",
    content: `Create a Dish rewards ambitious, specific descriptions. The AI has no trouble generating complex meals — don't hold back. "Moroccan-spiced lamb kofta with cucumber yogurt, pickled red onion, and herbed couscous" is a completely reasonable request and produces better results than "lamb dinner."

Mention the cooking skill level you're comfortable with. "Easy weeknight version" tells the AI to streamline the technique. "Restaurant quality, I'm a confident cook" opens up more complex methods.

When you want a specific macro target, state it upfront in the prompt. "High protein, under 600 calories, at least 45g protein" built into the initial description produces more accurate results than trying to adjust afterward.

Screenshot or save meals that nail the description so you can reference them when building future meals in the same style.`,
  },
  {
    title: "Restaurant Guide Strategy",
    content: `Use the Restaurant Guide before you arrive, not while you're standing in line hungry. Scan the menu while you're calm and not starving — you'll make better choices and won't feel pressured.

Look for meals that are already close to your targets and ask how to modify them: "dressing on the side," "grilled not fried," "no croutons," "extra protein." Most restaurants accommodate simple requests without issue.

Build a personal restaurant shortlist: 8–10 restaurants in your area where you already know your go-to order. When life is hectic, you're not researching — you're executing a plan you already made.

After eating out, log the meal immediately while it's fresh. Estimation accuracy drops significantly if you wait hours. Good enough logging is better than perfect logging you never do.`,
  },
  {
    title: "Recipe Scan Best Practices",
    content: `For the best scan results, use natural daylight or good overhead lighting — avoid harsh shadows across the page. If scanning from a phone screen, turn brightness to maximum and reduce glare by holding the camera at a slight angle.

Scan the complete recipe including the ingredient list, quantities, and cooking instructions. Partial scans produce incomplete nutritional data.

Recipe Scan is most powerful for converting family recipes and old cookbooks into your current macro targets. Instead of abandoning recipes you love, use the scan to understand their nutritional profile, then adjust portion sizes or ingredient swaps to fit your goals.

After scanning, verify the serving size matches how you actually eat the dish. A recipe that serves 6 but you split with 3 people needs a portion adjustment before the macros are meaningful.`,
  },
  {
    title: "Build Your Personal Meal Library",
    content: `Your personal meal library lives across three places: Favorites (meals you love and eat regularly), Saved Meals (meals worth revisiting or building from), and your Meal Board history.

Aim to build a 30-day non-repeating rotation — 30 dinners, 15 lunches, 10 breakfasts. Once you have this, meal planning becomes maintenance, not creation. You're rotating proven meals you love, not constantly generating new ones.

Label your library mentally by context: quick weeknights (under 20 min), weekend projects (more involved), meal prep anchors (scales well in bulk), social meals (works when cooking for others).

Every 90 days, audit your library. Remove anything you've stopped making, refresh with new builds from the past 3 months, and notice what patterns emerge in what you actually enjoy eating.`,
  },
  {
    title: "Using Multiple Builders Together",
    content: `The builders work best as a system, not in isolation. Build your week as a complete architecture: Create a Dish or Chef's Kitchen for dinners, Snack Creator for between-meal fuel, Beverage Creator for morning routines, Fridge Rescue when inventory runs low.

Use Meal Planner to see how the individual meals add up across the week — one high-calorie dinner is fine if the rest of the week is calibrated around it.

Holiday Feast is not just for holidays. Use it anytime you're cooking for a group or want a multi-course structure: appetizer, main, sides, dessert built around your dietary needs.

The Craving Creator is underused. When you want something specific — "something chocolate," "something crunchy and salty" — this builder resolves cravings within your macros instead of going off-plan.`,
  },
  {
    title: "Family Planning Strategies",
    content: `The core challenge with family cooking is making one meal that works for everyone while staying on your plan. Build meals around a flexible protein and base (rice, pasta, potatoes) that everyone can customize — your portion is macro-tracked while the family adds their own toppings or sauces.

Use Household Profiles if your family members have different dietary needs or goals. You can generate variations of the same core meal optimized for different family members.

Plan 2–3 "safe" family meals per week — meals everyone reliably eats — so you're not reinventing the menu every night. Reserve the more experimental or plan-specific meals for when you're eating alone.

Sunday batch cooking with the Shopping List is especially effective for families. Cooking proteins in bulk at the start of the week means everyone has something to build meals from throughout the week.`,
  },
  {
    title: "Meal Prep Strategies",
    content: `The most effective meal prep starts with the Meal Board. Plan the week, generate the Shopping List, shop once, then prep on Sunday. This three-step sequence eliminates daily decision fatigue about what to eat.

Batch-cook your protein anchors: ground turkey, shredded chicken, hard-boiled eggs, roasted salmon portions. Cooked protein lasts 4–5 days in the fridge and can be combined with different vegetables, grains, and sauces to create variety without re-cooking.

Prep your vegetables in advance: washed, chopped, stored in containers. Prepped produce is the difference between making dinner in 10 minutes and ordering takeout because you don't feel like dealing with raw vegetables after a long day.

Build 2–3 "assembly meals" into your weekly plan — meals that are just combining pre-prepped components. No cooking required, just assembly. These are your insurance policy for the busiest days.`,
  },
];

const NUTRITION_TIPS = [
  {
    title: "Macro Calculator Secrets",
    content: `Most people underestimate their calories and overestimate their protein. Before adjusting anything, track accurately for 7 days with no changes — just observe what you're actually eating. This baseline is the most valuable data you'll collect.

Start with your maintenance calories (TDEE), not an aggressive deficit or surplus. Adjust by no more than 200–300 calories from maintenance to start. Aggressive approaches fail because they're not sustainable.

Protein is the most important macro — prioritize hitting your protein target every single day above everything else. Carbs and fats are flexible. Protein is not. If you hit protein consistently, most other nutrition problems take care of themselves.

Track weekly averages, not daily numbers. One day at 2,500 calories doesn't matter if your weekly average is on target. This mindset reduces obsession and improves compliance dramatically.`,
  },
  {
    title: "Plateau Recovery Strategy",
    content: `A weight-loss plateau isn't a sign that your approach isn't working — it's a sign that your body has adapted to your current calorie level. The solution isn't to eat less; it's usually to eat more strategically.

Take a 1–2 week diet break at maintenance calories. This is not giving up — it's a deliberate strategy that resets hormones, reduces metabolic adaptation, and makes the next deficit phase more effective.

After the diet break, reduce calories slightly (150–200 calories) rather than dramatically. Small sustained reductions outperform large unsustainable cuts every time.

Check your protein intake first. Many plateaus are actually muscle loss masquerading as stalled fat loss — more protein preserves muscle during a deficit and improves body composition even at the same scale weight.`,
  },
  {
    title: "Maintenance Mode",
    content: `Maintenance is not the end of the journey — it's the most important skill to develop. Most people never practice maintenance deliberately, which is why weight regain is so common.

Transition from a deficit to maintenance gradually. Increase calories by 50–100 per week over 3–4 weeks rather than jumping straight to full maintenance. This reverse diet approach minimizes fat gain during the transition.

During maintenance, your weight will fluctuate 2–4 pounds naturally due to water, sodium, and glycogen. Don't react to daily scale changes — track weekly averages over a 4-week period.

Use maintenance as a phase to build new meals into your rotation, solidify your habits, and prepare for the next intentional phase (whether that's another cut, a muscle-building phase, or continued maintenance).`,
  },
  {
    title: "Building Sustainable Habits",
    content: `Sustainable habits are built on systems, not willpower. Design your environment so that eating well is the path of least resistance — prepped meals in the fridge, no junk food in the house, a weekly planning routine that takes less than 10 minutes.

Use the platform daily even when you don't need to generate a new meal. Log your food, review your Meal Board, check your shopping list. The habit of opening the app keeps nutrition in your attention and prevents the drift that happens when you "take a break."

Link new habits to existing ones. If you already make coffee every morning, use that time to plan your meals for the day. If you always watch TV after dinner, use a commercial break to log what you ate. Habit stacking removes the friction of building new behaviors.

Focus on behaviors, not outcomes. "I will use the meal builder every Sunday to plan my week" is a controllable behavior. "I will lose 10 pounds" is an outcome. Control what you can control.`,
  },
  {
    title: "Protein Prioritization",
    content: `Protein does more work than any other macro: it builds and preserves muscle, keeps you fuller longer, requires more energy to digest, and is the hardest macro to overeat. It should be the first thing you plan every single day.

Plan your protein sources first when using any builder, then build the rest of the meal around them. "I need 40g protein for dinner" is a better starting point than "I want pasta."

High-protein snacks are where most people fall short. Use the Snack Creator specifically for this gap — Greek yogurt, cottage cheese, hard-boiled eggs, edamame, jerky, protein-forward smoothies. These bridge the gap between meals without spiking hunger.

If you consistently struggle to hit your protein target, raise it in your profile and let the platform recalibrate your meal suggestions. The AI will shift toward higher-protein meal structures automatically.`,
  },
  {
    title: "Eating Out Successfully",
    content: `Eating out successfully starts the night before, not at the restaurant. Look up the menu, identify 2–3 options that fit your plan, and decide before you arrive. Decision-making when you're hungry and surrounded by good smells is extremely difficult.

The three most reliable restaurant strategies: protein + vegetable base (any protein with a salad or grilled vegetables), smart modification (ask for sauces on the side, swap fries for a salad, double the protein), and calorie banking (eat lighter earlier in the day if you know dinner will be a larger meal).

Don't order "diet food" you don't actually want — you'll leave unsatisfied and snack all evening. Order something you genuinely want, control the portions, and log accurately afterward.

One restaurant meal doesn't derail a plan. What derails a plan is the spiral that follows — "I already blew it, might as well eat whatever I want this weekend." One meal. Get back on track at the very next one.`,
  },
  {
    title: "Consistency vs Perfection",
    content: `The biggest predictor of long-term success is not the quality of your diet on your best days — it's what you do on your worst days. A "bad" meal that you log accurately and move on from is far less damaging than a bad meal that triggers a multi-day abandonment.

The 80/20 rule: if 80% of your meals are on-plan and support your goals, the other 20% of your food choices will not significantly impact your results. This isn't permission to be reckless — it's permission to be human.

Don't grade your days as "on" or "off" — that binary thinking makes any deviation feel catastrophic. Instead, look at the week as a whole. Did you hit your protein most days? Did you use the Meal Board? Did you shop from a list? These behaviors compound over time.

The people who succeed long-term are not the ones who never go off-plan. They're the ones who get back on track immediately and don't punish themselves for being human.`,
  },
  {
    title: "Long-Term Success Strategies",
    content: `Reassess your goals and macros every 90 days, not every day. Your body changes, your life circumstances change, your relationship with food evolves. What worked in month one may need adjustment by month four. Build a calendar reminder and do a quarterly review.

Build a 90-day rotating meal rotation that you genuinely love. When eating well feels like eating your favorite foods instead of a restricted diet, adherence stops being a challenge and becomes automatic.

The most powerful long-term strategy is raising your protein floor over time. Each year, try to build a slightly higher protein habit than the year before. This has compounding returns on body composition over a lifetime.

Use the platform as a lifelong tool, not a short-term solution. The value of having every meal you've ever built, every favorite, every saved plan in one place compounds enormously over years. Your nutrition history becomes a powerful personal dataset that helps you understand what works for your specific body and lifestyle.`,
  },
];

const DISMISS_KEY = "mpm.dismiss.tipsBanner";
export function dismissTipsBanner() {
  localStorage.setItem(DISMISS_KEY, "1");
}

function TipCard({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
      <button
        className="w-full text-left px-4 py-4 flex items-center justify-between gap-3 active:bg-white/5 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-white leading-snug">{title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-orange-400 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {content.split("\n\n").map((para, i) => (
                <p key={i} className="text-sm text-white/70 leading-relaxed">{para}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TipsStrategiesPage() {
  const [, setLocation] = useLocation();
  const { open: openCopilot } = useCopilot();

  useEffect(() => {
    document.title = "Tips & Strategies | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
    dismissTipsBanner();
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-3xl mx-auto">
          <button
            onClick={() => setLocation("/more")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Tips & Strategies</h1>
            <p className="text-xs text-white/40">Get the most out of My Perfect Meals</p>
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-3xl mx-auto space-y-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Intro */}
        <div className="p-5 rounded-2xl bg-black/40 border border-orange-500/20 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-orange-500/20 flex-shrink-0 mt-0.5">
              <Lightbulb className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                My Perfect Meals is more than a meal planner.
              </h2>
              <p className="text-sm text-white/60 mt-2 leading-relaxed">
                It's a complete adaptive nutrition platform. The tips, strategies, and coaching wisdom in this guide were developed from decades of real nutrition coaching experience — and they're here for the people who want to go deeper.
              </p>
              <p className="text-sm text-white/50 mt-2 leading-relaxed">
                Not everyone reads instructions, and that's completely fine — people learn differently and that's just human nature. This guide exists for the ones who do: the people genuinely looking for change, willing to dig in, and ready to get the most out of every tool the platform has to offer.
              </p>
              <p className="text-sm text-orange-300 mt-2 font-medium">
                If that's you — you're in the right place.
              </p>
            </div>
          </div>
        </div>

        {/* Other ways to learn inside the app */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest">More Ways to Learn Inside the App</h3>
          </div>
          <p className="text-xs text-white/40 leading-relaxed -mt-1">
            This guide is one of several learning resources built into My Perfect Meals. Here's where else to find help:
          </p>

          {/* Chef Copilot */}
          <button
            onClick={() => openCopilot()}
            className="w-full text-left p-4 rounded-2xl bg-black/30 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="p-2 rounded-xl bg-orange-500/20 flex-shrink-0">
              <Bot className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Chef Copilot</p>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                Your coach in your pocket — available on every page. Tap to get a guided explanation of wherever you are in the app, ask questions, or turn on Auto mode for step-by-step coaching as you go.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
          </button>

          {/* App Library */}
          <button
            onClick={() => setLocation("/learn")}
            className="w-full text-left p-4 rounded-2xl bg-black/30 border border-white/10 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="p-2 rounded-xl bg-orange-500/20 flex-shrink-0">
              <Library className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">App Library</p>
              <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                The brain of the app. Deep-dive explainers on every feature, builder, and tool — organized so you can find exactly what you need. Think of it as the full manual, always available from your Hub.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
          </button>

          {/* In-builder tips */}
          <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/5 flex-shrink-0 mt-0.5">
              <BookOpen className="h-5 w-5 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/80">Builder Tips & Pro Tips</p>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                Each meal builder has tips and pro guidance built directly into it — look for the info icons, tip banners, and guided prompts as you create. You don't have to leave the builder to learn how to use it better.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest">Platform Tips & Strategies</h3>
          </div>
          {PLATFORM_TIPS.map((tip) => (
            <TipCard key={tip.title} title={tip.title} content={tip.content} />
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-orange-400" />
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest">Nutrition Coaching Tips & Strategies</h3>
          </div>
          {NUTRITION_TIPS.map((tip) => (
            <TipCard key={tip.title} title={tip.title} content={tip.content} />
          ))}
        </section>

        <p className="text-center text-xs text-white/20 pb-4">
          My Perfect Meals · Adaptive Nutrition Platform
        </p>
      </div>
    </motion.div>
  );
}
