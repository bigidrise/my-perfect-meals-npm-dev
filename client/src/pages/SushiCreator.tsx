import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Fish } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";

const SUSHI_STYLES = [
  { value: "nigiri", label: "Nigiri" },
  { value: "maki roll", label: "Maki Roll" },
  { value: "temaki hand roll", label: "Temaki" },
  { value: "sashimi", label: "Sashimi" },
  { value: "poke bowl", label: "Poke Bowl" },
  { value: "chirashi bowl", label: "Chirashi" },
  { value: "uramaki inside-out roll", label: "Uramaki" },
];

const PROTEIN_OPTIONS = [
  "Salmon", "Tuna", "Yellowtail", "Shrimp", "Crab", "Scallop",
  "Tofu", "Avocado", "Cucumber", "Eel",
];

export default function SushiCreator() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [sushiStyle, setSushiStyle] = useState("maki roll");
  const [protein, setProtein] = useState("");
  const [freeText, setFreeText] = useState("");
  const [servings, setServings] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sushi Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const cuisineConstraint = `Japanese sushi: ${sushiStyle}${protein ? ` with ${protein}` : ""}${freeText.trim() ? ` — ${freeText.trim()}` : ""}`;

    try {
      const res = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          cravingInput: cuisineConstraint,
          targetMealType: "snacks",
          servings: Number(servings),
          userId: user?.id,
          safetyMode: "STRICT",
          skipPalate: false,
          cookMethod: "traditional Japanese sushi preparation",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
      if (data.safetyBlocked) throw new Error(data.error || "Safety block");

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-gradient-to-br from-black via-[#0a1a1a] to-black pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/craving-creator-landing")}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Fish className="h-5 w-5 text-teal-400" />
            <h1 className="text-base font-bold text-white">Sushi Creator</h1>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Admin Preview
            </span>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 pb-8 space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="max-w-lg mx-auto space-y-5">

          <div className="relative h-32 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/60 via-black/60 to-black/80" />
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <p className="text-sm text-white/80">Japanese-inspired creations built around your macros and health goals.</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Sushi style</label>
            <div className="flex flex-wrap gap-2">
              {SUSHI_STYLES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSushiStyle(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    sushiStyle === s.value
                      ? "bg-teal-600 border-teal-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Main protein (optional)</label>
            <div className="flex flex-wrap gap-2">
              {PROTEIN_OPTIONS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProtein(prev => prev === p ? "" : p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    protein === p
                      ? "bg-teal-600 border-teal-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Anything specific? (optional)</label>
            <input
              type="text"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="e.g. spicy, low-carb, crispy tempura…"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-teal-500/50 text-sm"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Servings</label>
            <div className="flex gap-2">
              {["1", "2", "4"].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    servings === s
                      ? "bg-teal-600 border-teal-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-semibold text-base transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Creating your roll…
              </span>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Create Sushi
              </>
            )}
          </button>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="bg-white/5 border border-teal-500/20 rounded-xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <h2 className="text-base font-bold text-white">{result.meal?.name || result.name}</h2>
                    <p className="text-sm text-white/70">{result.meal?.description || result.description}</p>

                    {(result.meal?.macros || result.macros) && (
                      <div className="flex gap-3 flex-wrap">
                        {Object.entries(result.meal?.macros || result.macros).map(([k, v]) => (
                          <div key={k} className="text-center">
                            <div className="text-xs text-white/50 capitalize">{k}</div>
                            <div className="text-sm font-semibold text-teal-300">{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.meal?.id && (
                      <AddToMealPlanButton
                        mealId={result.meal.id}
                        mealName={result.meal.name}
                        className="w-full"
                      />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
