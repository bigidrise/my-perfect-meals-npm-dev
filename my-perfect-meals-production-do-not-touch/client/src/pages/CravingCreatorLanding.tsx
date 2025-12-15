import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Sparkles } from "lucide-react";

interface CravingFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
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
      title: "Create Your Own",
      description: "Use the original AI Craving Creator you already know",
      icon: Brain,
      route: "/craving-creator",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "cravinghub-creator", // Phase C.7 hub anchor
    },
    {
      title: "Premade Cravings",
      description:
        "Browse our collection of ready-made craving meals. Tap any picture to see ingredients and nutrition info.",
      icon: Sparkles,
      route: "/craving-presets",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "cravinghub-premades", // Phase C.7 hub anchor
    },
    {
      title: "Dessert Creator",
      description: "AI-powered dessert recipes: pies, cakes, cookies, brownies & more",
      icon: Sparkles, // using same icon family for cohesion
      route: "/craving-desserts",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "cravinghub-desserts", // Phase C.7 hub anchor
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
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
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
              return (
                <Card
                  key={feature.testId}
                  className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl shadow-md"
                  onClick={() => handleCardClick(feature.route)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-orange-500 flex-shrink-0" />
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
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
