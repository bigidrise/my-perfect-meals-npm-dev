import { useLocation } from "wouter";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  useEffect(() => {
    document.title = "Meal Builders | My Perfect Meals";
    // On mobile, window is the scroll container. On desktop, it's the <main> element.
    window.scrollTo({ top: 0, behavior: "instant" });
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  }, []);

  const builderFeatures: BuilderFeature[] = [
    // "My Weekly Meal Builder" hidden — route and data intact, not selectable
    {
      title: t("builders.diabeticTitle"),
      description: t("builders.diabeticDesc"),
      icon: Activity,
      route: "/diabetic-hub",
      testId: "card-diabetic-hub",
      builderId: "diabetic",
    },
    {
      title: t("builders.metabolicTitle"),
      description: t("builders.metabolicDesc"),
      icon: Pill,
      route: "/glp1-hub",
      testId: "card-glp1-hub",
      builderId: "glp1",
    },
    {
      title: t("builders.antiInflamTitle"),
      description: t("builders.antiInflamDesc"),
      icon: Pill,
      route: "/anti-inflammatory-menu-builder",
      testId: "card-anti-inflammatory",
      builderId: "anti_inflammatory",
    },
    {
      title: t("builders.performanceTitle"),
      description: t("builders.performanceDesc"),
      icon: Trophy,
      route: "/performance",
      testId: "card-performance-nutrition-hub",
      builderId: "beach_body",
    },
    {
      title: t("builders.generalTitle"),
      description: t("builders.generalDesc"),
      icon: Utensils,
      route: "/general-nutrition-builder",
      testId: "card-general-nutrition",
      builderId: "general_nutrition",
    },
    // Performance & Competition Builder hidden (use Performance Nutrition Builder instead)
    // {
    //   title: "Performance & Competition Builder",
    //   description: "Coach guided elite athlete meal planning for competition prep, peak performance and recovery",
    //   icon: Dumbbell,
    //   route: "/pro/performance-competition-builder",
    //   testId: "card-performance-competition",
    //   builderId: "performance_competition",
    // },
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

  const builderGlowConfigs: Record<string, { glowBg: string; border: string; hoverBorder: string; hoverShadow: string; cardBg: string }> = {
    weekly: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.5), rgba(249,115,22,0.25), rgba(0,0,0,0))",
      border: "border-orange-500/30",
      hoverBorder: "hover:border-orange-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.45)]",
      cardBg: "from-black via-orange-950/30 to-black",
    },
    diabetic: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(244,63,94,0.5), rgba(244,63,94,0.25), rgba(0,0,0,0))",
      border: "border-rose-500/30",
      hoverBorder: "hover:border-rose-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(244,63,94,0.45)]",
      cardBg: "from-black via-rose-950/30 to-black",
    },
    glp1: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(6,182,212,0.5), rgba(6,182,212,0.25), rgba(0,0,0,0))",
      border: "border-cyan-500/30",
      hoverBorder: "hover:border-cyan-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(6,182,212,0.45)]",
      cardBg: "from-black via-cyan-950/30 to-black",
    },
    anti_inflammatory: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(16,185,129,0.5), rgba(16,185,129,0.25), rgba(0,0,0,0))",
      border: "border-emerald-500/30",
      hoverBorder: "hover:border-emerald-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]",
      cardBg: "from-black via-emerald-950/30 to-black",
    },
    beach_body: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(245,158,11,0.5), rgba(245,158,11,0.25), rgba(0,0,0,0))",
      border: "border-amber-500/30",
      hoverBorder: "hover:border-amber-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.45)]",
      cardBg: "from-black via-amber-950/30 to-black",
    },
    general_nutrition: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.5), rgba(59,130,246,0.25), rgba(0,0,0,0))",
      border: "border-blue-500/30",
      hoverBorder: "hover:border-blue-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.45)]",
      cardBg: "from-black via-blue-950/30 to-black",
    },
    performance_competition: {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(99,102,241,0.5), rgba(99,102,241,0.25), rgba(0,0,0,0))",
      border: "border-indigo-500/30",
      hoverBorder: "hover:border-indigo-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(99,102,241,0.45)]",
      cardBg: "from-black via-indigo-950/30 to-black",
    },
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-full bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav flex flex-col"
    >
      {!isDesktop && (
        <div
          className="sticky top-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 pb-3 flex items-center gap-3">
            <LayoutGrid className="h-6 w-6 text-orange-500" />
            <h1 className="text-lg font-bold text-white">{t("builders.pageTitle")}</h1>
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : undefined }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Needs Onboarding Banner */}
          {needsOnboarding && (
            <div
              className="rounded-xl bg-orange-500/20 border border-orange-500/50 p-4 cursor-pointer hover:bg-orange-500/30 transition-colors"
              onClick={() => setLocation("/onboarding/extended?repair=1")}
            >
              <p className="text-orange-200 text-sm font-medium mb-1">{t("builders.selectPrompt")}</p>
              <p className="text-orange-300/80 text-xs">
                {t("builders.tapHereToSelect")}
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
              <div className="bg-black/55 backdrop-blur-sm rounded-xl px-3 py-2.5">
                <p className="text-white/90 text-sm">
                  {t("builders.tailoredPlanning")}
                </p>
              </div>
            </div>
          </div>

          {/* Instruction hint */}
          <p className="text-xs text-white/40 text-center tracking-wide uppercase">
            {t("builders.tapToStart")}
          </p>

          {/* Builder Cards */}
          <div className="flex flex-col gap-3">
            {builderFeatures.map((feature) => {
              const Icon = feature.icon;
              const unlocked = isBuilderUnlocked(feature.builderId);
              const glow = builderGlowConfigs[feature.builderId] ?? builderGlowConfigs.weekly;

              return unlocked ? (
                <div key={feature.testId} className="relative">
                  <div
                    className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70"
                    style={{ background: glow.glowBg }}
                  />
                <Card
                  className={`relative transition-all duration-200 rounded-xl shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${glow.cardBg} backdrop-blur-lg border ${glow.border} ${glow.hoverBorder} ${glow.hoverShadow}`}
                  style={{ backgroundColor: "transparent" }}
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
                              {t("builders.badgeClinical")}
                            </span>
                          )}
                          {feature.builderId === "performance_competition" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-300 rounded-full border border-orange-500/30 flex-shrink-0">
                              {t("builders.badgePro")}
                            </span>
                          )}
                          {feature.builderId === userActiveBoard && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full border border-emerald-500/30 flex-shrink-0">
                              {t("builders.badgeCurrent")}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-400/25 rounded-full text-[8px] font-semibold text-cyan-300 tracking-wide flex-shrink-0">
                            <span className="w-1 h-1 bg-cyan-400 rounded-full" />
                            {t("builders.badgeBehavioral")}
                          </span>
                        </div>
                        <p className="text-xs ml-6 text-white/70">{feature.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
                </div>
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
                      <p className="text-xs ml-6 text-zinc-700">{t("builders.notYourBuilder")}</p>
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
