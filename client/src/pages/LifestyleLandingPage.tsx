import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  RefrigeratorIcon,
  Utensils,
  ChefHat,
  Wine,
  Lock,
  Star,
  ArrowRight,
  Plus,
  PawPrint,
  Palmtree,
} from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/contexts/AuthContext";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { isProOrAbove, isClinicalOrAbove, hasActivePaidSubscription } from "@/lib/subscriptionCheck";
import { useTranslation } from "react-i18next";

interface AIFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
  testId: string;
  freeAccess?: boolean;
  requiredTier?: "essential" | "pro";
  badge?: "emotion" | "behavioral";
}

type FeaturedKitchen = {
  slug: string;
  displayName: string;
  bio: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  creatorCategory: string;
  cuisineTypes: string[];
  flavorProfiles: string[];
};

export default function LifestyleLandingPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { requestUpgrade } = useUpgradeModal();
  const [featuredKitchens, setFeaturedKitchens] = useState<FeaturedKitchen[]>([]);
  const [kitchensIsAdmin, setKitchensIsAdmin] = useState(false);
  const { t } = useTranslation("lifestyle");

  useEffect(() => {
    fetch(apiUrl("/api/kitchens/featured"), { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : { kitchens: [], isAdmin: false })
      .then(d => {
        setFeaturedKitchens(d.kitchens ?? []);
        setKitchensIsAdmin(d.isAdmin ?? false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = "Lifestyle | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const lifestyleFeatures: AIFeature[] = [
    {
      title: t("createDishTitle"),
      description: t("createDishDesc"),
      icon: ChefHat,
      route: "/lifestyle/create-a-dish",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-create-a-dish",
      requiredTier: "essential",
      badge: "emotion",
    },
    {
      title: t("cravingsTitle"),
      description: t("cravingsDesc"),
      icon: Sparkles,
      route: "/craving-creator-landing",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-craving-creator",
      requiredTier: "pro",
      badge: "emotion",
    },
    {
      title: t("beverageTitle"),
      description: t("beverageDesc"),
      icon: Wine,
      route: "/lifestyle/beverage-hub",
      gradient: "from-blue-500/20 to-cyan-500/20",
      testId: "card-beverage-creator",
      requiredTier: "pro",
      badge: "behavioral",
    },
    {
      title: t("pairingsTitle"),
      description: t("pairingsDesc"),
      icon: Wine,
      route: "/lifestyle/pairings-hub",
      gradient: "from-orange-500/20 to-amber-500/20",
      testId: "card-pairings-hub",
      requiredTier: "pro",
      badge: "behavioral",
    },
    {
      title: t("fridgeRescueTitle"),
      description: t("fridgeRescueDesc"),
      icon: RefrigeratorIcon,
      route: "/fridge-rescue",
      gradient: "from-emerald-500/20 to-teal-500/20",
      testId: "card-fridge-rescue",
      freeAccess: true,
      badge: "behavioral",
    },
    {
      title: t("awayFromHomeTitle"),
      description: t("awayFromHomeDesc"),
      icon: Utensils,
      route: "/social-hub",
      gradient: "from-pink-500/20 to-purple-500/20",
      testId: "card-socializing-hub",
      requiredTier: "pro",
      badge: "behavioral",
    },
    {
      title: t("petsTitle"),
      description: t("petsDesc"),
      icon: PawPrint,
      route: "/companion",
      gradient: "from-orange-600/20 to-amber-700/20",
      testId: "card-companion-nutrition",
      requiredTier: "pro",
      badge: "behavioral",
    },
  ];

  const isCardLocked = (feature: AIFeature): boolean => {
    if (feature.freeAccess) return false;
    if (feature.requiredTier === "essential") return !hasActivePaidSubscription(user);
    if (feature.requiredTier === "pro") return !isProOrAbove(user);
    return false;
  };

  const gatheringsLocked = !isProOrAbove(user);
  const getawayLocked = !isProOrAbove(user);
  const pregnancyLocked = !isClinicalOrAbove(user);

  const handleCardClick = (feature: AIFeature) => {
    if (feature.freeAccess) {
      setLocation(feature.route);
      return;
    }
    if (feature.requiredTier === "essential" && !hasActivePaidSubscription(user)) {
      requestUpgrade({ requiredTier: "essential", featureName: feature.title });
      return;
    }
    if (feature.requiredTier === "pro" && !isProOrAbove(user)) {
      requestUpgrade({ requiredTier: "pro", featureName: feature.title });
      return;
    }
    setLocation(feature.route);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {!isDesktop && (
        <div
          className="sticky top-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-orange-500" />
            <h1 className="text-lg font-bold text-white">{t("title")}</h1>
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : undefined }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src="/images/lifestyle-hero.png"
              alt="Lifestyle nutrition"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-black/55 backdrop-blur-sm rounded-xl px-3 py-2.5">
                <p className="text-white/90 text-sm">
                  {t("heroText")}
                </p>
              </div>
            </div>
          </div>

          {/* ── Featured Kitchens — hidden from Lifestyle Hub (lives in Business Suite) ── */}
          {false && kitchensIsAdmin && <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-orange-400" />
                <h2 className="text-sm font-bold text-white">Featured Kitchens</h2>
              </div>
              {featuredKitchens.length > 0 && (
                <span className="text-[10px] text-white/40">Powered by My Perfect Meals AI</span>
              )}
            </div>

            {featuredKitchens.length > 0 ? (
              <div className="flex flex-col gap-2">
                {featuredKitchens.map(k => (
                  <div key={k.slug} className="relative">
                    <div
                      className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-60"
                      style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.5), rgba(239,68,68,0.2), rgba(0,0,0,0))" }}
                    />
                    <Card
                      className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-orange-950/30 to-black backdrop-blur-lg border border-orange-400/30 hover:border-orange-500/50"
                      onClick={() => setLocation(`/kitchen/${k.slug}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
                            {k.logoUrl ? (
                              <img src={k.logoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ChefHat className="h-5 w-5 text-orange-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <h3 className="text-sm font-semibold text-white leading-tight">{k.displayName}</h3>
                              {k.isFeatured && k.isActive && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/15 flex-shrink-0">
                                  <Star className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
                                  <span className="text-amber-200 font-semibold text-[10px] tracking-wide">Featured</span>
                                </div>
                              )}
                              {kitchensIsAdmin && !k.isActive && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-900/25 flex-shrink-0">
                                  <Sparkles className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
                                  <span className="text-amber-300 font-semibold text-[10px] tracking-wide">Admin Preview</span>
                                </div>
                              )}
                            </div>
                            {k.bio && (
                              <p className="text-xs text-white/75 leading-relaxed line-clamp-2">{k.bio}</p>
                            )}
                            {(k.cuisineTypes ?? []).length > 0 && (
                              <p className="text-[10px] text-orange-400/80 mt-1">{(k.cuisineTypes ?? []).slice(0, 3).join(" · ")}</p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="rounded-xl overflow-hidden bg-black/20 backdrop-blur-lg border border-dashed border-orange-400/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0 mt-0.5">
                      <Plus className="h-4 w-4 text-orange-400/60" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white/60">Your Chef Kitchen Could Be Here</h3>
                      <p className="text-xs text-white/30 mt-0.5 leading-relaxed">
                        Featured kitchens are coming soon. Chefs, brands, and coaches — stay tuned.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>}

          {/* ── My Perfect Pregnancy card ── */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-60"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(236,72,153,0.5), rgba(251,146,60,0.25), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-pink-950/40 to-black backdrop-blur-lg border border-pink-500/30 hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:border-pink-400/50"
              onClick={() => {
                if (pregnancyLocked) {
                  requestUpgrade({ requiredTier: "clinical", featureName: "My Perfect Pregnancy" });
                  return;
                }
                setLocation("/lifestyle/my-perfect-pregnancy");
              }}
              data-testid="card-my-perfect-pregnancy"
            >
              <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-violet-700/80 to-black rounded-full border border-violet-400/30 shadow-lg z-10">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                <span className="text-violet-200 font-semibold text-[8px] tracking-wide">
                  Emotion AI™
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-base ${pregnancyLocked ? "opacity-50" : ""}`}>🩷</span>
                    <h3 className={`text-sm font-semibold ${pregnancyLocked ? "text-white/50" : "text-white"}`}>{t("pregnancyTitle")}</h3>
                    {pregnancyLocked && <Lock className="h-3 w-3 text-orange-400/70 ml-auto" />}
                  </div>
                  <p className={`text-xs ml-6 ${pregnancyLocked ? "text-white/40" : "text-white/80"}`}>
                    {t("pregnancyDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── My Perfect Getaway premium card ── */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.7), rgba(217,119,6,0.35), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-orange-950/50 to-black backdrop-blur-lg border border-orange-500/40 hover:shadow-[0_0_30px_rgba(251,146,60,0.5)] hover:border-orange-400/60"
              onClick={() => {
                if (getawayLocked) {
                  requestUpgrade({ requiredTier: "pro", featureName: "My Perfect Getaway" });
                  return;
                }
                setLocation("/lifestyle/my-perfect-getaway");
              }}
              data-testid="card-my-perfect-getaway"
            >
              <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-cyan-700/80 to-black rounded-full border border-cyan-400/30 shadow-lg z-10">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-200 font-semibold text-[8px] tracking-wide">
                  Behavioral AI™
                </span>
              </div>
              <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden rounded-xl">
                <svg viewBox="0 0 320 80" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <circle cx="280" cy="20" r="28" fill="rgba(251,146,60,0.5)" />
                  <path d="M260 80 Q275 40 285 28 Q278 55 270 80Z" fill="rgba(251,191,36,0.4)" />
                  <path d="M240 80 Q258 42 268 30 Q260 55 252 80Z" fill="rgba(251,146,60,0.3)" />
                </svg>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Palmtree
                      className={`h-4 w-4 flex-shrink-0 ${getawayLocked ? "text-orange-500/50" : "text-orange-400"}`}
                    />
                    <h3
                      className={`text-sm font-semibold ${getawayLocked ? "text-white/50" : "text-white"}`}
                    >
                      {t("getawayTitle")}
                    </h3>
                    {getawayLocked && (
                      <Lock className="h-3 w-3 text-orange-400/70 ml-auto" />
                    )}
                  </div>
                  <p
                    className={`text-xs ml-6 ${getawayLocked ? "text-white/40" : "text-white/80"}`}
                  >
                    {t("getawayDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── My Perfect Gatherings premium card ── */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-60"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(251,191,36,0.6), rgba(234,88,12,0.3), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-amber-950/40 to-black backdrop-blur-lg border border-amber-400/30 hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:border-amber-500/50"
              onClick={() => {
                if (gatheringsLocked) {
                  requestUpgrade({ requiredTier: "pro", featureName: "My Perfect Gatherings" });
                  return;
                }
                setLocation("/lifestyle/my-perfect-gatherings");
              }}
              data-testid="card-my-perfect-gatherings"
            >
              <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-cyan-700/80 to-black rounded-full border border-cyan-400/30 shadow-lg z-10">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-200 font-semibold text-[8px] tracking-wide">
                  Behavioral AI™
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Star
                      className={`h-4 w-4 flex-shrink-0 ${gatheringsLocked ? "text-amber-500/50" : "text-amber-400"}`}
                    />
                    <h3
                      className={`text-sm font-semibold ${gatheringsLocked ? "text-white/50" : "text-white"}`}
                    >
                      {t("gatheringsTitle")}
                    </h3>
                    {gatheringsLocked && (
                      <Lock className="h-3 w-3 text-amber-400/70 ml-auto" />
                    )}
                  </div>
                  <p
                    className={`text-xs ml-6 ${gatheringsLocked ? "text-white/40" : "text-white/80"}`}
                  >
                    {t("gatheringsDesc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {lifestyleFeatures.map((feature) => {
              const Icon = feature.icon;
              const locked = isCardLocked(feature);

              const glowConfigs: Record<string, { glowBg: string; cardBg: string; border: string; hoverShadow: string }> = {
                "/lifestyle/create-a-dish": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.75), rgba(239,68,68,0.35), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg",
                  border: "border border-orange-400/30 hover:border-orange-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]",
                },
                "/craving-creator-landing": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(168,85,247,0.6), rgba(236,72,153,0.35), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-purple-950/30 to-black backdrop-blur-lg",
                  border: "border border-pink-400/30 hover:border-pink-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]",
                },
                "/lifestyle/beverage-hub": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.6), rgba(6,182,212,0.3), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-blue-950/30 to-black backdrop-blur-lg",
                  border: "border border-blue-400/30 hover:border-blue-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]",
                },
                "/lifestyle/pairings-hub": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.6), rgba(217,119,6,0.3), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-amber-950/30 to-black backdrop-blur-lg",
                  border: "border border-amber-400/30 hover:border-amber-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]",
                },
                "/fridge-rescue": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(16,185,129,0.6), rgba(20,184,166,0.3), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-emerald-950/30 to-black backdrop-blur-lg",
                  border: "border border-emerald-400/30 hover:border-emerald-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]",
                },
                "/social-hub": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(236,72,153,0.5), rgba(168,85,247,0.25), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-pink-950/30 to-black backdrop-blur-lg",
                  border: "border border-pink-400/30 hover:border-pink-500/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.35)]",
                },
                "/companion": {
                  glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(234,88,12,0.65), rgba(180,83,9,0.3), rgba(0,0,0,0))",
                  cardBg: "bg-gradient-to-r from-black via-orange-950/30 to-black backdrop-blur-lg",
                  border: "border border-orange-500/30 hover:border-orange-400/50",
                  hoverShadow: "hover:shadow-[0_0_30px_rgba(234,88,12,0.4)]",
                },
              };

              const glow = glowConfigs[feature.route] ?? {
                glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.5), rgba(0,0,0,0))",
                cardBg: "bg-gradient-to-r from-black via-orange-950/30 to-black backdrop-blur-lg",
                border: "border border-orange-400/30 hover:border-orange-500/50",
                hoverShadow: "hover:shadow-[0_0_30px_rgba(251,146,60,0.3)]",
              };

              return (
                <div key={feature.testId} className="relative">
                  {/* Glow — every card gets one */}
                  <div
                    className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70"
                    style={{ background: glow.glowBg }}
                  />

                  <Card
                    className={`relative rounded-xl shadow-md overflow-hidden transition cursor-pointer active:scale-95 hover:scale-[1.02] ${glow.cardBg} ${glow.border} ${glow.hoverShadow}`}
                    style={{ backgroundColor: "transparent" }}
                    onClick={() => handleCardClick(feature)}
                    data-testid={feature.testId}
                  >
                    {/* AI type badge */}
                    {feature.badge === "emotion" && (
                      <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-violet-700/80 to-black rounded-full border border-violet-400/30 shadow-lg z-10">
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                        <span className="text-violet-200 font-semibold text-[8px] tracking-wide">
                          Emotion AI™
                        </span>
                      </div>
                    )}
                    {feature.badge === "behavioral" && (
                      <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-cyan-700/80 to-black rounded-full border border-cyan-400/30 shadow-lg z-10">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                        <span className="text-cyan-200 font-semibold text-[8px] tracking-wide">
                          Behavioral AI™
                        </span>
                      </div>
                    )}

                    <CardContent className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${locked ? "text-orange-500/50" : "text-orange-500"}`} />
                          <h3 className={`text-sm font-semibold ${locked ? "text-white/50" : "text-white"}`}>
                            {feature.title}
                          </h3>
                          {locked && (
                            <Lock className="h-3 w-3 text-orange-400/70 ml-auto" />
                          )}
                        </div>
                        <p className={`text-xs ml-6 ${locked ? "text-white/40" : "text-white/80"}`}>
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          {/* Active creator shortcut — only shown to existing creators */}
          {user?.isCreator && (
            <div data-testid="card-creator-studio" className="relative mt-2">
              <Card
                className="relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 hover:shadow-[0_0_30px_rgba(251,146,60,0.3)] hover:border-orange-500/50"
                style={{ backgroundColor: "transparent" }}
                onClick={() => setLocation("/creator/studio")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
                      <ChefHat className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {user.creatorDisplayName || t("myStudio")}
                        </h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
                          {t("creatorStudioLabel")}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">{t("creatorStudioSubtitle")}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
