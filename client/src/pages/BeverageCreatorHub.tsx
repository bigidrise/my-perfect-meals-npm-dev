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
  color: string;
  accentClass: string;
  adminOnly: boolean;
}

const HUB_CARDS: HubCard[] = [
  {
    title: "Beverage Creator",
    description: "Smoothies, cocktails, mocktails, coffee drinks, protein shakes, and more — built to your goals.",
    icon: Wine,
    route: "/lifestyle/beverage-creator",
    color: "text-blue-400",
    accentClass: "border-blue-400/20 hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(96,165,250,0.2)]",
    adminOnly: false,
  },
  {
    title: "Athletes Beverage Creator",
    description: "Performance drinks engineered for your training phase — pre, intra, and post-workout.",
    icon: Zap,
    route: "/lifestyle/athlete-beverage-creator",
    color: "text-violet-400",
    accentClass: "border-violet-400/20 hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(167,139,250,0.2)]",
    adminOnly: true,
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
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#0a0f1a] to-[#0f0f0f] pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Wine className="h-5 w-5 text-blue-400" />
            <h1 className="text-base font-bold text-white">Beverage Hub</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        <div className="max-w-lg mx-auto space-y-4">

          <div className="relative h-36 rounded-xl overflow-hidden mb-2">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-black/60 to-violet-900/30" />
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <p className="text-sm text-white/80">Every drink — from daily wellness to elite performance.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {HUB_CARDS.map(card => {
              const Icon = card.icon;
              const isLocked = card.adminOnly && !isAdmin;

              return (
                <div key={card.route} className="relative">
                  <Card
                    className={`relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border rounded-xl shadow-md overflow-hidden ${card.accentClass} ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                    onClick={() => !isLocked && setLocation(card.route)}
                  >
                    {card.adminOnly && isAdmin && (
                      <div className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 z-10">
                        Admin Preview
                      </div>
                    )}
                    {isLocked && (
                      <div className="absolute top-2 right-2 z-10">
                        <Lock className="h-3.5 w-3.5 text-white/30" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/5 mt-0.5 flex-shrink-0`}>
                          <Icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white mb-0.5">{card.title}</h3>
                          <p className="text-xs text-white/60 leading-relaxed">{card.description}</p>
                        </div>
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
