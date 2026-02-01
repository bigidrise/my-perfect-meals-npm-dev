import { useLocation } from "wouter";
import { ArrowLeft, Award, LifeBuoy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type Founder = {
  id: string;
  name: string;
  img: string;
  badge?: string;
};

const FOUNDERS: Founder[] = [
  {
    id: "1",
    name: "Coach Idrise",
    img: "/assets/founder-photo.png",
    badge: "Gold Founder",
  },
  { id: "2", name: "A. Believer", img: "/assets/MPMTransparentLogo.png" },
  {
    id: "3",
    name: "B. Believer",
    img: "/assets/MPMTransparentLogo.png",
    badge: "Top Supporter",
  },
  { id: "4", name: "C. Believer", img: "/assets/MPMTransparentLogo.png" },
];

export default function FoundersPage() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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
            About My Perfect Meals
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <section className="container mx-auto max-w-6xl px-4 md:px-6">
          {/* ABOUT MY PERFECT MEALS SECTION */}
          <div className="mb-10 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-4 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              About My Perfect Meals
            </h2>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              My Perfect Meals was designed as a complete nutrition decision system, not a traditional diet app. Instead of telling you what you can’t eat or forcing rigid meal plans, the app helps you build healthier versions of the foods you already enjoy, across real-life situations like busy schedules, cravings, social events, travel, and family meals. The goal is not perfection, but consistency — creating meals that work in the real world, day after day.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              My Perfect Meals is a food-lover’s app first, not a weight-loss app built on restriction. It was created for people who genuinely enjoy food and don’t want to give up flavor, culture, or the pleasure of eating in order to be healthier. While the system can absolutely support fat loss, muscle gain, improved performance, or better health markers, those outcomes are the result of smarter food structure — not cutting foods out, obsessing over numbers, or avoiding the meals you love.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              At the core of the app are its meal builders, which allow you to create meals in different ways depending on how you think and how much control you want. You can choose ingredients directly, or simply describe what you’re craving and let the Chef build the meal for you. Every builder uses guardrails based on the board you’re using — general nutrition, diabetic support, GLP-1 support, performance, anti-inflammatory eating, or other lifestyle goals — so meals are always aligned with your needs without requiring you to micromanage nutrition.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              As meals are built, the app automatically balances food groups, portions, and preparation methods to create healthier outcomes without stripping enjoyment from eating. Instead of obsessing over individual calories or micromanaging fats, My Perfect Meals focuses on the quality, structure, and composition of meals. When the right foods are combined in the right proportions, healthier calorie and fat levels naturally follow.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              At the bottom of each meal builder, you’ll see daily nutrition totals with Protein and Carbs marked with an asterisk. This is intentional. Protein and carbohydrates are the primary drivers of energy, performance, recovery, blood sugar stability, and long-term body composition. By guiding your focus toward these two macros, the app helps simplify nutrition decisions and reduce stress, while still producing consistent, healthy results. Calories and fats are still tracked, but they are outcomes of good food choices rather than the main levers you need to control.
            </p>

            <p className="text-white/85 text-sm md:text-base leading-relaxed mt-3">
              My Perfect Meals works because it shifts nutrition from restriction to structure. Instead of starting over every week or reacting to mistakes, the app helps you make better decisions in the moment — meal by meal, day by day. Whether you’re managing health conditions, improving performance, or simply trying to eat better without giving up the foods you love, the system adapts to you, not the other way around.
            </p>

          </div>

          {/* CONTACT US SECTION */}
          <div className="mb-10 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-4 drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              Contact Us
            </h2>
            <p className="text-white/85 text-sm md:text-base leading-relaxed mb-4">
              Have questions, feedback, or need support? We'd love to hear from you.
            </p>
            <a
              href="mailto:support@myperfectmeals.com"
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-orange-600/80 hover:bg-orange-500/90 text-white font-medium transition-colors ring-1 ring-white/20"
            >
              <LifeBuoy className="h-5 w-5" />
              <span>support@myperfectmeals.com</span>
              <Mail className="h-4 w-4 opacity-60" />
            </a>
          </div>

          {/* FOUNDERS SECTION */}
          <div className="mb-8 p-6 rounded-2xl bg-black/50 ring-1 ring-white/10 backdrop-blur-md shadow-2xl text-center">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
              Meet Our Founders
            </h1>
            <p className="text-sm md:text-base text-white/80 mt-2">
              The early believers who helped build My Perfect Meals.
            </p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {FOUNDERS.map((f) => (
              <article
                key={f.id}
                className="relative overflow-hidden rounded-2xl bg-black/55 ring-1 ring-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                data-testid={`card-founder-${f.id}`}
              >
                <div className="aspect-[4/5] w-full overflow-hidden">
                  <img
                    src={f.img}
                    alt={f.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <h3 className="text-white font-medium truncate">{f.name}</h3>

                  {f.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 ring-1 ring-yellow-300/30 px-2.5 py-1 text-[11px] text-yellow-100">
                      <Award className="h-3.5 w-3.5" />
                      {f.badge}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="h-6" />
        </section>
      </div>
    </motion.div>
  );
}
