import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  RefrigeratorIcon,
  Utensils,
  ChefHat,
  Wine,
  Lock,
  Star,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import { useAuth } from "@/contexts/AuthContext";

interface AIFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  gradient: string;
  testId: string;
  freeAccess?: boolean;
  badge?: "emotion" | "behavioral";
}

const CREATOR_BETA_ADMIN_ID = "6796ce88-dff8-4336-adcb-e53986830f3f";

export default function LifestyleLandingPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();
  const { user } = useAuth();
  const isCreatorBetaAdmin = user?.id === CREATOR_BETA_ADMIN_ID;

  useEffect(() => {
    document.title = "Lifestyle | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const lifestyleFeatures: AIFeature[] = [
    {
      title: "Create a Dish",
      description:
        "Tell Chef what you want to cook. Get a complete recipe with macros, ingredients, and instructions.",
      icon: ChefHat,
      route: "/lifestyle/create-a-dish",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-create-a-dish",
      badge: "emotion",
    },
    {
      title: "Cravings, Sushi & Desserts",
      description:
        "Craving Creator, Sushi Creator, and Dessert Creator — all in one place.",
      icon: Sparkles,
      route: "/craving-creator-landing",
      gradient: "from-orange-500/20 to-red-500/20",
      testId: "card-craving-creator",
      badge: "emotion",
    },
    {
      title: "Beverage Creator Hub",
      description:
        "Create smoothies, protein shakes, coffee drinks, mocktails, cocktails, and more with AI.",
      icon: Wine,
      route: "/lifestyle/beverage-hub",
      gradient: "from-blue-500/20 to-cyan-500/20",
      testId: "card-beverage-creator",
      badge: "behavioral",
    },
    {
      title: "Spirit & Wine Pairing Hub",
      description:
        "AI, spirit, wine & beer pairing, wine list translator, and a drink reducing tool.",
      icon: Wine,
      route: "/lifestyle/pairings-hub",
      gradient: "from-orange-500/20 to-amber-500/20",
      testId: "card-pairings-hub",
      badge: "behavioral",
    },
    {
      title: "Fridge Rescue",
      description: "Transform ingredients in your kitchen into delicious meals",
      icon: RefrigeratorIcon,
      route: "/fridge-rescue",
      gradient: "from-emerald-500/20 to-teal-500/20",
      testId: "card-fridge-rescue",
      freeAccess: true,
      badge: "behavioral",
    },
    {
      title: "Socializing Hub",
      description: "Make smart choices when eating out with AI guidance",
      icon: Utensils,
      route: "/social-hub",
      gradient: "from-pink-500/20 to-purple-500/20",
      testId: "card-socializing-hub",
      badge: "behavioral",
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
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-orange-500" />
            <h1 className="text-lg font-bold text-white">Lifestyle</h1>
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
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
              <p className="text-white/90 text-sm">
                Navigate cravings, dining out, and social moments with
                AI-powered guidance.
              </p>
            </div>
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
                if (isFree) {
                  guardAction(
                    "My Perfect Gatherings unlocks with Premium.",
                    () => {},
                  );
                  return;
                }
                handleCardClick("/lifestyle/my-perfect-gatherings");
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
                      className={`h-4 w-4 flex-shrink-0 ${isFree ? "text-amber-500/50" : "text-amber-400"}`}
                    />
                    <h3
                      className={`text-sm font-semibold ${isFree ? "text-white/50" : "text-white"}`}
                    >
                      My Perfect Gatherings
                    </h3>
                    {isFree && (
                      <Lock className="h-3 w-3 text-amber-400/70 ml-auto" />
                    )}
                  </div>
                  <p
                    className={`text-xs ml-6 ${isFree ? "text-white/40" : "text-white/80"}`}
                  >
                    Plan full meals for holidays, camping, tailgating &amp;
                    special occasions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {lifestyleFeatures.map((feature) => {
              const Icon = feature.icon;
              const isCreateDish =
                feature.route === "/lifestyle/create-a-dish";
              const isCravingCreator =
                feature.route === "/craving-creator-landing";

              return (
                <div key={feature.testId} className="relative">
                  {/* Glow effects */}
                  {isCreateDish && (
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
                    className={`relative rounded-xl shadow-md overflow-hidden transition cursor-pointer active:scale-95 hover:scale-[1.02] ${
                      isCreateDish
                        ? "bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 hover:shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:border-orange-500/50"
                        : isCravingCreator
                          ? "bg-black/30 backdrop-blur-lg border border-pink-400/30"
                          : "bg-black/30 backdrop-blur-lg border border-white/10"
                    }`}
                    onClick={() => {
                      if (isFree && !feature.freeAccess) {
                        guardAction(`${feature.title} unlocks with Premium.`, () => {});
                        return;
                      }
                      handleCardClick(feature.route);
                    }}
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
                          <Icon className={`h-4 w-4 ${isFree && !feature.freeAccess ? "text-orange-500/50" : "text-orange-500"}`} />
                          <h3 className={`text-sm font-semibold ${isFree && !feature.freeAccess ? "text-white/50" : "text-white"}`}>
                            {feature.title}
                          </h3>
                          {isFree && !feature.freeAccess && (
                            <Lock className="h-3 w-3 text-orange-400/70 ml-auto" />
                          )}
                        </div>
                        <p className={`text-xs ml-6 ${isFree && !feature.freeAccess ? "text-white/40" : "text-white/80"}`}>
                          {feature.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          {/* Creator Studio Card — admin-only during beta */}
          {isCreatorBetaAdmin && (
          <div data-testid="card-creator-system-teaser" className="relative mt-2">
            {user?.isCreator ? (
              <Card
                className="relative rounded-xl shadow-md overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 hover:shadow-[0_0_30px_rgba(251,146,60,0.3)] hover:border-orange-500/50"
                onClick={() => setLocation("/creator/studio")}
                data-testid="card-creator-studio"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
                      <ChefHat className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {user.creatorDisplayName || "My Studio"}
                        </h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-0.5">Your creator studio — tap to enter</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card
                className="relative rounded-xl shadow-sm overflow-hidden cursor-pointer transition-all duration-300 active:scale-95 hover:scale-[1.02] bg-black/30 backdrop-blur-lg border border-white/15 hover:border-orange-500/30"
                onClick={() => setLocation("/creator/start")}
                data-testid="card-build-system"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/20 mt-0.5 flex-shrink-0">
                      <Briefcase className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">
                          Build Your Own System
                        </h3>
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                          Early Access
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-0.5 font-medium">
                        For chefs, coaches, and professionals
                      </p>
                      <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                        Turn your cooking or coaching style into a system your audience can actually use.
                      </p>
                      <div className="flex items-center gap-1 mt-2.5 text-xs text-orange-400 font-medium">
                        Start Creator Setup <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      </div>

      <UpgradeLockModal open={showLockModal} onClose={closeLockModal} message={lockMessage} />
    </motion.div>
  );
}
