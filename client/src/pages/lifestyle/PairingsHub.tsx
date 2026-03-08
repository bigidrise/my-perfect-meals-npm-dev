import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Wine, BookOpen, HeartPulse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";

const hubTools = [
  {
    title: "Pairings AI",
    description: "Find the perfect wine, beer, or spirits for any meal — or discover new drinks you'll love.",
    icon: Wine,
    route: "/lifestyle/pairings-ai",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    title: "Wine List Translator",
    description: "Paste a restaurant wine list and get simple explanations, flavor profiles, and a best-choice recommendation.",
    icon: BookOpen,
    route: "/lifestyle/wine-list-helper",
    gradient: "from-orange-500/20 to-amber-500/20",
  },
  {
    title: "Reduce Drinking Plan",
    description: "Create a personalized, evidence-based plan to reduce your drinking at your own pace.",
    icon: HeartPulse,
    route: "/lifestyle/reduce-drinking-plan",
    gradient: "from-orange-600/20 to-orange-400/20",
  },
];

export default function PairingsHub() {
  const [, setLocation] = useLocation();
  useCopilotPageExplanation();

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="pairings-hub">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-safe-nav"
      >
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-2">
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

        <div
          className="max-w-2xl mx-auto px-4 pb-32"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Drink Intelligence</h2>
            <p className="text-sm text-white/70">
              AI-powered drink pairings, wine education, and health planning.
            </p>
          </div>

          <div className="space-y-4">
            {hubTools.map((tool) => (
              <motion.div
                key={tool.route}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  className={`bg-gradient-to-r ${tool.gradient} backdrop-blur-lg border border-white/10 cursor-pointer hover:border-orange-500/40 transition-all`}
                  onClick={() => setLocation(tool.route)}
                >
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange-600/20 flex items-center justify-center border border-orange-500/20">
                      <tool.icon className="h-6 w-6 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-1">{tool.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{tool.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </PhaseGate>
  );
}
