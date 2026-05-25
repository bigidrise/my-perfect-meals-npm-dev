import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Pill, Trophy, Lock, Dumbbell, Utensils, LayoutGrid, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface BuilderFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  builderId: string;
}

export default function Builders() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    document.title = "Meal Builders | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const builderFeatures: BuilderFeature[] = [
    {
      title: "My Weekly Meal Builder",
      description:
        "AI generated meal plans for users that want to eat healthier meals their way",
      icon: LayoutGrid,
      route: "/weekly-meal-board",
      testId: "card-weekly-meal-board",
      builderId: "weekly",
    },
    {
      title: "Diabetic Hub and Meal Builder",
      description:
        "Blood sugar monitoring and AI created meal plans for diabetics",
      icon: Activity,
      route: "/diabetic-hub",
      testId: "card-diabetic-hub",
      builderId: "diabetic",
    },
    {
      title: "GLP-1 Hub and Meal Builder",
      description:
        "Shot and location logging with specialized AI created meal plans for GLP-1 users",
      icon: Pill,
      route: "/glp1-hub",
      testId: "card-glp1-hub",
      builderId: "glp1",
    },
    {
      title: "Anti-Inflammatory Meal Builder",
      description:
        "Autoimmune support, joint relief, and inflammation guardrails with AI created meal plans",
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
        "Coach guided professional-grade nutrition planning and custom protocols",
      icon: Utensils,
      route: "/pro/general-nutrition-builder",
      testId: "card-general-nutrition",
      builderId: "general_nutrition",
    },
    {
      title: "Performance & Competition Builder",
      description:
        "Coach guided elite athlete meal planning for competition prep, peak performance and recovery",
      icon: Dumbbell,
      route: "/pro/performance-competition-builder",
      testId: "card-performance-competition",
      builderId: "performance_competition",
    },
  ];

  const isProfessional = ["admin", "coach", "physician", "trainer"].includes(
    user?.professionalRole || user?.role || ""
  );
  const isActualProCareClient = user?.isProCare && !isProfessional;
  const userActiveBoard = isActualProCareClient
    ? user?.activeBoard || user?.selectedMealBuilder
    : user?.selectedMealBuilder || user?.activeBoard;

  const isAppleReviewMode = localStorage.getItem("appleReviewFullAccess") === "true";
  const isUnlimited = user?.builderSwitchUnlimited === true;
  const needsOnboarding = !isAppleReviewMode && !isUnlimited && !userActiveBoard;

  const isBuilderUnlocked = (builderId: string): boolean => {
    if (isAppleReviewMode) return true;
    if (isUnlimited) return true;
    if (!userActiveBoard) return false;
    return builderId === userActiveBoard;
  };

  const handleCardClick = async (feature: BuilderFeature) => {
    if (needsOnboarding) {
      setLocation("/onboarding/extended?repair=1");
      return;
    }
    if (isBuilderUnlocked(feature.builderId)) {
      if (feature.builderId !== userActiveBoard) {
        const authToken = getAuthToken();
        if (authToken) {
          try {
            await fetch(apiUrl("/api/user/meal-builder"), {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "x-auth-token": authToken,
              },
              body: JSON.stringify({ selectedMealBuilder: feature.builderId }),
            });
            await refreshUser();
          } catch (err) {
            console.error("Failed to update builder:", err);
          }
        }
      }
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
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 pb-3 flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-orange-500" />
            <h1 className="text-lg font-bold text-white">Meal Builders</h1>
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Needs Onboarding Banner */}
          {needsOnboarding && (
            <div
              className="rounded-xl bg-orange-500/20 border border-orange-500/50 p-4 cursor-pointer hover:bg-orange-500/30 transition-colors"
              onClick={() => setLocation("/onboarding/extended?repair=1")}
            >
              <p className="text-orange-200 text-sm font-medium mb-1">Select Your Meal Builder</p>
              <p className="text-orange-300/80 text-xs">
                Tap here to select your meal builder and set your targets.
              </p>
            </div>
          )}

          {/* Hero Image Section */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src="/images/planner-hero.png"
              alt="Meal builders"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2314b8a6;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%233b82f6;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EMeal Builders%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white/90 text-sm">
                Tailored meal planning for your specific health needs and goals.
              </p>
            </div>
          </div>

          {/* Instruction hint */}
          <p className="text-xs text-white/40 text-center tracking-wide uppercase">
            Tap a builder to get started
          </p>

          {/* Builder Cards */}
          <div className="flex flex-col gap-3">
            {builderFeatures.map((feature) => {
              const Icon = feature.icon;
              const unlocked = isBuilderUnlocked(feature.builderId);

              return unlocked ? (
                <Card
                  key={feature.testId}
                  className="transition-all duration-200 rounded-xl shadow-md cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50"
                  onClick={() => handleCardClick(feature)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon className="h-4 w-4 flex-shrink-0 text-orange-500" />
                          <h3 className="text-sm font-semibold text-white">
                            {feature.title}
                          </h3>
                          {feature.builderId === "beach_body" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-600/30 text-amber-300 rounded-full border border-amber-500/30 flex-shrink-0">
                              Clinical
                            </span>
                          )}
                          {(feature.builderId === "general_nutrition" ||
                            feature.builderId === "performance_competition") && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-300 rounded-full border border-orange-500/30 flex-shrink-0">
                              ProCare
                            </span>
                          )}
                          {feature.builderId === userActiveBoard && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full border border-emerald-500/30 flex-shrink-0">
                              Current
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-400/25 rounded-full text-[8px] font-semibold text-cyan-300 tracking-wide flex-shrink-0">
                            <span className="w-1 h-1 bg-cyan-400 rounded-full" />
                            Behavioral AI™
                          </span>
                        </div>
                        <p className="text-xs ml-6 text-white/70">{feature.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div
                  key={feature.testId}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 select-none pointer-events-none"
                  data-testid={feature.testId}
                >
                  <div className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 flex-shrink-0 text-zinc-600" />
                        <h3 className="text-sm font-semibold text-zinc-600 line-through">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-xs ml-6 text-zinc-700">Not your assigned builder</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
