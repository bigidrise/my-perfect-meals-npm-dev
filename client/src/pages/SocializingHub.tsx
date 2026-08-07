import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils, MapPin, ChefHat } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface SocialFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
  testId: string;
}

export default function SocializingHub() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    document.title = "Meals Away From Home | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
    
    // Phase C.7: Emit "opened" event for hub walkthrough
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "social-hub-opened", event: "opened" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []);

  const socialFeatures: SocialFeature[] = [
    {
      title: "Restaurant Assistant",
      description: "Get AI-powered healthy meal options from any restaurant",
      icon: Utensils,
      route: "/social-hub/restaurant-guide",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "socialhub-guide", // Phase C.7 hub anchor
    },
    {
      title: "Find Meals Near Me",
      description: "Search local restaurants by craving and ZIP code",
      icon: MapPin,
      route: "/social-hub/find",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "socialhub-find", // Phase C.7 hub anchor
    },
    {
      title: "My Perfect Buffet",
      description: "Describe what's available — AI builds your best plate",
      icon: ChefHat,
      route: "/my-perfect-buffet",
      gradient: "from-orange-500/20 to-orange-600/20",
      testId: "socialhub-buffet",
    },
  ];

  const handleCardClick = (route: string) => {
    // Phase C.7: Emit "selected" event for hub walkthrough
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "social-hub-selected", event: "selected" },
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
      className="min-h-screen pb-safe-nav"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.48)), url('/images/meals-away-from-home-bg.jpg')",
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
          <Utensils className="h-6 w-6 text-orange-500" />

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Meals Away From Home</h1>
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
          {/* Social Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {socialFeatures.map((feature) => {
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
