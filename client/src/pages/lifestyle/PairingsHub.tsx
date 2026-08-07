import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Wine, BookOpen, HeartPulse } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
    title: "Spirit, Beer & Wine Pairings",
    description:
      "Find the perfect wine or beer for any meal or discover drinks you'll love.",
    icon: Wine,
    route: "/lifestyle/pairings-ai",
    testId: "pairingshub-ai",
  },
  {
    title: "Wine List Translator",
    description:
      "Paste a wine list and get simple explanations and a best choice.",
    icon: BookOpen,
    route: "/lifestyle/wine-list-helper",
    testId: "pairingshub-wine-list",
  },
  {
    title: "Reduce Drinking Tool",
    description:
      "Create a personalized plan to gradually reduce alcohol intake.",
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
        className="min-h-screen pb-safe-nav"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.44), rgba(0,0,0,0.40)), url('/images/pairings-hub-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      >
        <div
          className="flex-1 px-4 py-8"
          style={{
            paddingTop: isDesktop
              ? "0"
              : "calc(env(safe-area-inset-top, 0px) + 1rem)",
          }}
        >
          <div className="max-w-2xl mx-auto space-y-4">
            {!isDesktop && (
              <button
                onClick={() => setLocation("/lifestyle")}
                className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 mb-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
            )}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                Drink Intelligence
              </h2>
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
                    className="cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/10 backdrop-blur-lg border border-white/10 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:border-orange-500/50 rounded-xl shadow-md overflow-hidden"
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
