import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  RefrigeratorIcon,
  Utensils,
  Baby,
  Wine,
  UtensilsCrossed,
} from "lucide-react";

interface AIFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
  testId: string;
}

export default function LifestyleLandingPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Lifestyle | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Chef's Kitchen front-door is always disabled (Coming Soon)
  // Users can still access Stage 2 via meal card "Prepare with Chef" buttons
  const CHEFS_KITCHEN_COMING_SOON = true;

  const lifestyleFeatures: AIFeature[] = [
    {
      title: "Chef’s Kitchen",
      description:
        "Cook alongside AI. Learn, create, and have fun in the kitchen.",
      icon: UtensilsCrossed,
      route: "/lifestyle/chefs-kitchen",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-chefs-kitchen",
    },
    {
      title: "Craving Creator Hub",
      description:
        "Your craving-focused hub — home of the original Craving Creator that started it all.",
      icon: Sparkles,
      route: "/craving-creator-landing",
      gradient: "from-purple-500/20 to-pink-500/20",
      testId: "card-craving-creator",
    },
    {
      title: "Fridge Rescue",
      description: "Transform ingredients in your kitchen into delicious meals",
      icon: RefrigeratorIcon,
      route: "/fridge-rescue",
      gradient: "from-emerald-500/20 to-teal-500/20",
      testId: "card-fridge-rescue",
    },
    {
      title: "Socializing Hub",
      description: "Make smart choices when eating out with AI guidance",
      icon: Utensils,
      route: "/social-hub",
      gradient: "from-pink-500/20 to-purple-500/20",
      testId: "card-socializing-hub",
    },
    {
      title: "Healthy Kids Meals Hub",
      description: "Nutritious, kid-friendly meals that children love",
      icon: Baby,
      route: "/healthy-kids-meals",
      gradient: "from-blue-500/20 to-cyan-500/20",
      testId: "card-healthy-kids-meals",
    },
    {
      title: "Spirits & Lifestyle Hub",
      description:
        "Wine pairing, smart drinks, mocktails, and mindful consumption",
      icon: Wine,
      route: "/alcohol-hub",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-alcohol-hub",
    },
  ];

  const handleCardClick = (route: string) => {
    setLocation(route);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {/* Header */}
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Lifestyle</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src="/images/lifestyle-hero.jpg"
              alt="Lifestyle nutrition"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/90 text-sm">
                Navigate cravings, dining out, and social moments with
                AI-powered guidance.
              </p>
            </div>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {lifestyleFeatures.map((feature) => {
              const Icon = feature.icon;
              const isChefsKitchen =
                feature.route === "/lifestyle/chefs-kitchen";
              const isCravingCreator =
                feature.route === "/craving-creator-landing";

              const disableChefsKitchenEntry =
                isChefsKitchen && CHEFS_KITCHEN_COMING_SOON;

              return (
                <div key={feature.testId} className="relative">
                  {/* Glow effects */}
                  {isChefsKitchen && (
                    <div
                      className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-80"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.75), rgba(239,68,68,0.35), rgba(0,0,0,0))",
                      }}
                    />
                  )}
                  {isCravingCreator && (
                    <div
                      className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 50% 0%, rgba(168,85,247,0.6), rgba(236,72,153,0.35), rgba(0,0,0,0))",
                      }}
                    />
                  )}

                  <Card
                    className={`relative rounded-xl shadow-md overflow-hidden transition ${
                      disableChefsKitchenEntry
                        ? "opacity-65 cursor-not-allowed"
                        : "cursor-pointer active:scale-95 hover:scale-[1.02]"
                    } ${
                      isChefsKitchen
                        ? "bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 hover:shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:border-orange-500/50"
                        : isCravingCreator
                          ? "bg-black/30 backdrop-blur-lg border border-pink-400/30"
                          : "bg-black/30 backdrop-blur-lg border border-white/10"
                    }`}
                    onClick={() => {
                      if (disableChefsKitchenEntry) return;
                      handleCardClick(feature.route);
                    }}
                    aria-disabled={disableChefsKitchenEntry}
                    data-testid={feature.testId}
                  >
                    {/* Badges */}
                    {isChefsKitchen && (
                      <>
                        <div className="absolute top-2 right-2 inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg z-10">
                          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                          <span className="text-white font-bold text-[10px] tracking-wide">
                            Powered by Emotion AI™
                          </span>
                        </div>

                        {CHEFS_KITCHEN_COMING_SOON && (
                          <div className="absolute bottom-2 right-2 px-3 py-1 rounded-full bg-gradient-to-r from-black via-amber-600 to-black border border-amber-400/30 text-white text-xs font-semibold z-10">
                            Coming Soon
                          </div>
                        )}
                      </>
                    )}

                    <CardContent className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-orange-500" />
                          <h3 className="text-sm font-semibold text-white">
                            {feature.title}
                          </h3>
                        </div>
                        <p className="text-xs text-white/80 ml-6">
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
