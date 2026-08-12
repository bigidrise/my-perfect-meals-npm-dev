import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Sparkles, Fish, ArrowLeft } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";
interface CravingFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
}

export default function CravingCreatorLanding() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("Craving Hub");

  useEffect(() => {
    document.title = "Cravings, Sushi & Desserts Hub | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
    
    // Phase C.7: Emit "opened" event for hub walkthrough
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "craving-hub-opened", event: "opened" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []);

  const cravingFeatures: CravingFeature[] = [
    {
      title: "Craving Creator",
      description: "Use the original AI Craving Creator you already know",
      icon: Brain,
      route: "/craving-creator",
      testId: "cravinghub-creator",
    },
    {
      title: "Dessert Creator",
      description: "AI-powered dessert recipes: pies, cakes, cookies, brownies & more",
      icon: Sparkles,
      route: "/craving-desserts",
      testId: "cravinghub-desserts",
    },
    {
      title: "Sushi Creator",
      description: "Japanese-inspired sushi and rice bowls — macros tracked, health goals respected",
      icon: Fish,
      route: "/sushi-creator",
      testId: "cravinghub-sushi",
    },
  ];

  const handleCardClick = (route: string) => {
    // Phase C.7: Emit "selected" event for hub walkthrough
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "craving-hub-selected", event: "selected" },
      });
      window.dispatchEvent(event);
    }, 300);
    
    setLocation(route);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen pb-safe-nav"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.58)), url('/images/craving-creator-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
      }}
    >
      {/* Universal Safe-Area Header */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-orange-500" />

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Cravings, Sushi & Desserts Hub</h1>

          
        </div>
      </div>
      </MobileHeaderGuard>

      {/* Main Content */}
      <div
        className="px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {!isDesktop && (
            <button
              onClick={() => setLocation("/lifestyle")}
              className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
          )}
          {/* Hub Intro — matches Pairings Hub pattern */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Food Creativity</h2>
            <p className="text-sm text-white/70">AI-powered meal, dessert, and sushi creation built around what you want right now.</p>
          </div>

          {/* Craving Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {cravingFeatures.map((feature) => {
              const Icon = feature.icon;
        const isEmotionAI = feature.route === "/craving-creator";
              
              return (
                <div key={feature.testId} className="relative">
                 {isEmotionAI&& (
                    <div
                      className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-80"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 50% 0%, rgba(236,72,153,0.75), rgba(168,85,247,0.35), rgba(0,0,0,0))",
                      }}
                    />
                  )}
                  <Card
                    className={`relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border rounded-xl shadow-md overflow-hidden ${
                       isEmotionAI

                        ? "border-pink-400/30 hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:border-pink-500/50" 
                        : "border-white/10 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:border-orange-500/50"
                    }`}
                    onClick={() => handleCardClick(feature.route)}
                    data-testid={feature.testId}
                  >
                {isEmotionAI && (

                      <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-pink-600 to-black rounded-full border border-pink-400/30 shadow-lg z-10">
                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse"></div>
                        <span className="text-white font-semibold text-[8px] tracking-wide">
                          Powered by Emotion AI™
                        </span>
                      </div>
                    )}
                    <CardContent className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isEmotionAI ? "text-pink-500" : "text-orange-500"}`} />
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
