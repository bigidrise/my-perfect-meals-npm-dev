import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Wine, BookOpen, HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface PairingFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
}

const pairingFeatures: PairingFeature[] = [
  {
    title: "Drink Pairings",
    description: "Find the perfect wine or beer for any meal or discover drinks you'll love.",
    icon: Wine,
    route: "/lifestyle/pairings-ai",
    testId: "pairingshub-ai",
  },
  {
    title: "Wine List Translator",
    description: "Paste a wine list and get simple explanations and a best choice.",
    icon: BookOpen,
    route: "/lifestyle/wine-list-helper",
    testId: "pairingshub-wine-list",
  },
  {
    title: "Reduce Drinking Plan",
    description: "Create a personalized plan to gradually reduce alcohol intake.",
    icon: HeartPulse,
    route: "/lifestyle/reduce-drinking-plan",
    testId: "pairingshub-reduction",
  },
];

export default function PairingsHub() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Pairings Hub | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="pairings-hub">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav"
      >
        {!isDesktop && (
          <div
            className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-lg border-b border-white/10"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                onClick={() => setLocation("/lifestyle")}
                className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <h1 className="text-lg font-bold text-white truncate">Pairings Hub</h1>
            </div>
          </div>
        )}

        <div
          className="flex-1 px-4 py-8"
          style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Drink Intelligence</h2>
              <p className="text-sm text-white/70">
                AI-powered drink pairings, wine education, and health planning.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {pairingFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.testId}
                    className="cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:border-orange-500/50 rounded-xl shadow-md overflow-hidden"
                    onClick={() => setLocation(feature.route)}
                    data-testid={feature.testId}
                  >
                    <CardContent className="p-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 flex-shrink-0 text-orange-500" />
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
    </PhaseGate>
  );
}
