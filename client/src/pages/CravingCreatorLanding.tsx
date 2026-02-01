import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Sparkles } from "lucide-react";

interface CravingFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
}

export default function CravingCreatorLanding() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Craving Creator Hub | My Perfect Meals";
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
      title: "Premade Cravings",
      description:
        "Browse our collection of ready-made craving meals. Tap any picture to see ingredients and nutrition info.",
      icon: Sparkles,
      route: "/craving-presets",
      testId: "cravinghub-premades",
    },
    {
      title: "Dessert Creator",
      description: "AI-powered dessert recipes: pies, cakes, cookies, brownies & more",
      icon: Sparkles,
      route: "/craving-desserts",
      testId: "cravinghub-desserts",
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-orange-500" />

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Craving Creator Hub</h1>

          
        </div>
      </div>

      {/* Main Content */}
      <div
        className="px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Image Section */}
          <div className="relative h-40 rounded-xl overflow-hidden">
            <img
              src="/images/cravings/satisfy-cravings.jpg"
              alt="Satisfy your cravings"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23a855f7;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23ec4899;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='160' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='20' font-family='sans-serif' dy='.3em'%3ESatisfy Smartly%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white/90 text-sm">
                Satisfy your cravings without derailing your goals — smarter
                choices that hit the spot.
              </p>
            </div>
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

                      <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-black via-pink-600 to-black rounded-full border border-pink-400/30 shadow-lg z-10">
                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse"></div>
                        <span className="text-white font-semibold text-[9px]">
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
