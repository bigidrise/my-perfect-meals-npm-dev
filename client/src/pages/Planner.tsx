import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Activity, Pill, Trophy, Lock, Dumbbell, Utensils } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PlannerFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  builderId: string;
}

export default function Planner() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Planner | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const plannerFeatures: PlannerFeature[] = [
    {
      title: "My Weekly Meal Builder",
      description:
        "AI generated meal plans for users that want to eat healthier meals their way",
      icon: Calendar,
      route: "/weekly-meal-board",
      testId: "card-weekly-meal-board",
      builderId: "weekly",
    },
    {
      title: "Diabetic Hub and Meal Builder",
      description:
        "Blood sugar monitoring and meal AI created meal plans for diabetics",
      icon: Activity,
      route: "/diabetic-hub",
      testId: "card-diabetic-hub",
      builderId: "diabetic",
    },
    {
      title: "GLP-1 Hub and Meal Builder",
      description:
        "Shot, location logging and specialized AI created meal plans for GLP-1 users",
      icon: Pill,
      route: "/glp1-hub",
      testId: "card-glp1-hub",
      builderId: "glp1",
    },
    {
      title: "Anti-Inflammatory Meal Builder",
      description:
        "Autoimmune support, joint relief, inflammation guardrails with AI created meal plans",
      icon: Pill,
      route: "/anti-inflammatory-menu-builder",
      testId: "card-anti-inflammatory",
      builderId: "anti_inflammatory",
    },
    {
      title: "Beach Body Meal Builder",
      description:
        "Contest prep and leaning out AI created meal plans designed for rapid change",
      icon: Trophy,
      route: "/beach-body-meal-board",
      testId: "card-competition-beachbody",
      builderId: "beach_body",
    },
    {
      title: "General Nutrition Builder",
      description:
        "Professional-grade nutrition planning with coach support and custom protocols",
      icon: Utensils,
      route: "/pro/general-nutrition-builder",
      testId: "card-general-nutrition",
      builderId: "general_nutrition",
    },
    {
      title: "Performance & Competition Builder",
      description:
        "Elite athlete meal planning for competition prep, peak performance and recovery",
      icon: Dumbbell,
      route: "/pro/performance-competition-builder",
      testId: "card-performance-competition",
      builderId: "performance_competition",
    },
  ];

  // For ProCare clients, activeBoard takes priority; for regular users, selectedMealBuilder
  const userActiveBoard = user?.isProCare 
    ? (user?.activeBoard || user?.selectedMealBuilder)
    : (user?.selectedMealBuilder || user?.activeBoard);
  
  // Check for Apple Review Full Access mode - grants admin-level access
  const isAppleReviewMode = localStorage.getItem("appleReviewFullAccess") === "true";
  const isAdmin = isAppleReviewMode || user?.role === "admin" || user?.isTester || user?.entitlements?.includes("FULL_ACCESS");
  const needsOnboarding = !isAdmin && !userActiveBoard;

  const isBuilderUnlocked = (builderId: string): boolean => {
    if (isAdmin) return true;
    if (!userActiveBoard) return false;
    return builderId === userActiveBoard;
  };

  const handleCardClick = (feature: PlannerFeature) => {
    if (needsOnboarding) {
      setLocation("/onboarding/extended?repair=1");
      return;
    }
    if (isBuilderUnlocked(feature.builderId)) {
      setLocation(feature.route);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-full bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav flex flex-col"
    >
          {/* Header Banner - Planner */}
          <div
            className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
              <div className="px-8 pb-3 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-orange-500" />
              <h1 className="text-lg font-bold text-white">Planner</h1>
            </div>
          </div>

          {/* Main Content */}
          <div
            className="flex-1 px-4 py-8"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
          >
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Needs Onboarding Banner */}
              {needsOnboarding && (
                <div 
                  className="rounded-xl bg-orange-500/20 border border-orange-500/50 p-4 cursor-pointer hover:bg-orange-500/30 transition-colors"
                  onClick={() => setLocation("/onboarding/extended?repair=1")}
                >
                  <p className="text-orange-200 text-sm font-medium mb-1">Select Your Meal Builder</p>
                  <p className="text-orange-300/80 text-xs">Tap here to select your meal builder and set your targets.</p>
                </div>
              )}

              {/* Hero Image Section */}
              <div className="relative h-48 rounded-xl overflow-hidden">
                <img
                  src="/images/planner-hero.jpg"
                  alt="Medical meal planning"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2314b8a6;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%233b82f6;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EPlanner%3C/text%3E%3C/svg%3E";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-2xl font-bold text-white mb-1"></h2>
                  <p className="text-white/90 text-sm">
                    Tailored meal planning for your specific health needs and goals.
                  </p>
                </div>
              </div>

              {/* Planner Features - Vertical Stack */}
              <div className="flex flex-col gap-3">
                {plannerFeatures.map((feature) => {
                  const Icon = feature.icon;
                  const unlocked = isBuilderUnlocked(feature.builderId);
                  
                  return (
                    <Card
                      key={feature.testId}
                      className={`transition-all duration-300 rounded-xl shadow-md ${
                        unlocked
                          ? "cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50"
                          : "cursor-not-allowed bg-black/20 backdrop-blur-lg border border-white/5 opacity-60"
                      }`}
                      onClick={() => handleCardClick(feature)}
                      data-testid={feature.testId}
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon className={`h-4 w-4 flex-shrink-0 ${unlocked ? "text-orange-500" : "text-zinc-500"}`} />
                            <h3 className={`text-sm font-semibold ${unlocked ? "text-white" : "text-zinc-400"}`}>
                              {feature.title}
                            </h3>
                            {feature.builderId === "beach_body" && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-600/30 text-amber-300 rounded-full border border-amber-500/30">
                                Ultimate
                              </span>
                            )}
                            {!unlocked && (
                              <Lock className="h-3 w-3 text-zinc-500 ml-auto" />
                            )}
                          </div>
                          <p className={`text-xs ml-6 ${unlocked ? "text-white/80" : "text-zinc-500"}`}>
                            {unlocked ? feature.description : "Change your builder in Settings to access"}
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
