import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, UtensilsCrossed } from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";

type KitchenMode = "entry" | "studio";

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("chefs-kitchen");
  const [mode, setMode] = useState<KitchenMode>("entry");

  useEffect(() => {
    document.title = "Chef’s Kitchen | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* 🔒 Universal Safe-Area Header — SAME AS CRAVING CREATOR */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
          {/* Back */}
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            data-testid="button-back-to-lifestyle"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white truncate min-w-0">
            Chef’s Kitchen
          </h1>

          <div className="flex-grow" />

          {/* Guided Tour */}
          <QuickTourButton
            onClick={quickTour.openTour}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-2xl mx-auto px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* ───────────────── ENTRY MODE ───────────────── */}
        {mode === "entry" && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                  <h2 className="text-base font-semibold text-white">
                    Kitchen Studio
                  </h2>
                </div>

                <p className="text-sm text-white/80">
                  Create great-tasting, healthy food with AI. This is where
                  ideas turn into dishes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/20">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      What are we cooking today?
                    </h3>
                    <p className="text-xs text-white/70">
                      Start with an idea, a craving, or an ingredient — we’ll
                      build it together.
                    </p>
                  </div>
                </div>

                <button
                  className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-600 text-black font-semibold text-sm active:scale-[0.98] transition"
                  data-testid="button-enter-kitchen-studio"
                  onClick={() => setMode("studio")}
                >
                  Enter Kitchen Studio
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ───────────────── STUDIO MODE ───────────────── */}
        {mode === "studio" && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-2">
                <h2 className="text-base font-semibold text-white">
                  What are we making today?
                </h2>

                <p className="text-sm text-white/80">
                  Describe the dish, flavor, or vibe you’re going for.
                </p>

                <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                  <p className="text-xs text-white/70">
                    (Next step) This is where the main input box, clarifying
                    questions, equipment roll call, and Open Kitchen narration
                    will live.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </motion.div>
  );
}
