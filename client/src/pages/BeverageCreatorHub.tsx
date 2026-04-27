import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Wine, Zap, ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const ADMIN_ID = "6796ce88-dff8-4336-adcb-e53986830f3f";

interface HubCard {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  adminOnly: boolean;
  featured?: boolean;
}

const HUB_CARDS: HubCard[] = [
  {
    title: "Beverage Creator",
    description: "Smoothies, cocktails, mocktails, coffee drinks, protein shakes, and more — built to your goals.",
    icon: Wine,
    route: "/lifestyle/beverage-creator",
    testId: "beveragehub-creator",
    adminOnly: false,
    featured: true,
  },
  {
    title: "Athletes Beverage Creator",
    description: "Performance drinks engineered for your training phase — pre, intra, and post-workout.",
    icon: Zap,
    route: "/lifestyle/athlete-beverage-creator",
    testId: "beveragehub-athlete",
    adminOnly: true,
    featured: false,
  },
];

export default function BeverageCreatorHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.id === ADMIN_ID;

  useEffect(() => {
    document.title = "Beverage Hub | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Wine className="h-6 w-6 text-blue-400" />
            <h1 className="text-lg font-bold text-white">Beverage Hub</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Hero Image */}
          <div className="relative h-40 rounded-xl overflow-hidden">
            <img
              src="/images/beverage-hub-hero.png"
              alt="Beverage Creator"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2360a5fa;stop-opacity:0.35' /%3E%3Cstop offset='100%25' style='stop-color:%238b5cf6;stop-opacity:0.35' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='160' fill='url(%23g)'/%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white/90 text-sm">
                Every drink — from daily wellness to elite performance.
              </p>
            </div>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {HUB_CARDS.map((card) => {
              const Icon = card.icon;
              const isLocked = card.adminOnly && !isAdmin;

              return (
                <div key={card.testId} className="relative">
                  {/* Glow blur behind featured card */}
                  {card.featured && (
                    <div
                      className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-80"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 50% 0%, rgba(96,165,250,0.55), rgba(139,92,246,0.25), rgba(0,0,0,0))",
                      }}
                    />
                  )}

                  <Card
                    className={`relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border rounded-xl shadow-md overflow-hidden ${
                      card.featured
                        ? "border-blue-400/30 hover:shadow-[0_0_30px_rgba(96,165,250,0.4)] hover:border-blue-500/50"
                        : "border-white/10 hover:shadow-[0_0_30px_rgba(167,139,250,0.35)] hover:border-violet-500/50"
                    } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                    onClick={() => !isLocked && setLocation(card.route)}
                    data-testid={card.testId}
                  >
                    {card.adminOnly && isAdmin && (
                      <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-violet-600 to-black rounded-full border border-violet-400/30 shadow-lg z-10">
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                        <span className="text-white font-semibold text-[8px] tracking-wide">
                          Admin Preview
                        </span>
                      </div>
                    )}
                    {isLocked && (
                      <div className="absolute top-2 right-2 z-10">
                        <Lock className="h-3.5 w-3.5 text-white/30" />
                      </div>
                    )}

                    <CardContent className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`h-4 w-4 flex-shrink-0 ${
                              card.featured ? "text-blue-400" : "text-violet-400"
                            }`}
                          />
                          <h3 className="text-sm font-semibold text-white">
                            {card.title}
                          </h3>
                        </div>
                        <p className="text-xs text-white/80 ml-6">
                          {card.description}
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
