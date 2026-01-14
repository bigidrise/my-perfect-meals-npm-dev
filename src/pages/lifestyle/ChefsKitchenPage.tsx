import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, ArrowLeft, Sparkles } from "lucide-react";

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Chef’s Kitchen | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {/* Header Banner */}
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/lifestyle")}
            className="p-2 rounded-lg bg-black/30 border border-white/10 active:scale-95 transition"
            aria-label="Back to Lifestyle"
          >
            <ArrowLeft className="h-4 w-4 text-white/90" />
          </button>

          <UtensilsCrossed className="h-5 w-5 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Chef’s Kitchen</h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Intro / Hero Card */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-md">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-white">
                    Cook with AI, the fun way
                  </h2>
                  <p className="text-sm text-white/80">
                    Tell me what you’re making, and we’ll build a healthy,
                    great-tasting dish together—step by step.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* “What are we making?” Entry (V1 placeholder UI) */}
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-md">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-white">
                  What are we cooking today?
                </h3>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3">
                <p className="text-xs text-white/60">
                  (Phase 1 UI shell) Next we’ll add the input + Copilot flow,
                  equipment roll call, and the “Open Kitchen” live narration.
                </p>
              </div>

              <button
                onClick={() => setLocation("/lifestyle")}
                className="w-full py-2 rounded-xl bg-black/30 border border-white/10 text-white/90 text-sm hover:border-orange-500/50 active:scale-[0.99] transition"
              >
                Back to Lifestyle
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
