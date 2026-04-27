import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";

const WORKOUT_PHASES = [
  { value: "pre", label: "Pre-Workout", desc: "Energy + focus" },
  { value: "intra", label: "Intra-Workout", desc: "Endurance + hydration" },
  { value: "post", label: "Post-Workout", desc: "Recovery + rebuild" },
];

const GOALS = [
  { value: "strength", label: "Strength" },
  { value: "endurance", label: "Endurance" },
  { value: "weight loss", label: "Fat Loss" },
  { value: "muscle gain", label: "Muscle Gain" },
  { value: "hydration", label: "Hydration" },
];

const DRINK_FORMATS = [
  { value: "shake", label: "Shake" },
  { value: "smoothie", label: "Smoothie" },
  { value: "electrolyte drink", label: "Electrolyte" },
  { value: "protein shake", label: "Protein" },
  { value: "juice blend", label: "Juice Blend" },
];

export default function AthleteBeverageCreator() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [phase, setPhase] = useState("post");
  const [goal, setGoal] = useState("muscle gain");
  const [format, setFormat] = useState("protein shake");
  const [extras, setExtras] = useState("");
  const [servings, setServings] = useState("1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Athletes Beverage Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    const phaseLabel = WORKOUT_PHASES.find(p => p.value === phase)?.label || phase;
    const performanceDesc = `Performance ${phaseLabel} ${format} optimized for ${goal}${extras.trim() ? ` — ${extras.trim()}` : ""}. Use functional ingredients appropriate for athletic performance and recovery.`;

    try {
      const res = await fetch(apiUrl("/api/meals/beverage-creator"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          beverageCategory: format,
          flavorFamily: "performance",
          customBeverageDescription: performanceDesc,
          servingSize: `${servings} serving`,
          dietaryPreferences: [],
          userId: user?.id,
          safetyMode: "STRICT",
          skipPalate: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || "Generation failed");
      if (data?.safetyBlocked) throw new Error(data?.error || "Safety block");

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
      className="min-h-screen bg-gradient-to-br from-black via-[#0d0a1a] to-black pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle/beverage-hub")}
              className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Zap className="h-5 w-5 text-violet-400" />
            <h1 className="text-base font-bold text-white">Athletes Beverage Creator</h1>
            <span className="ml-auto text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
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

          <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-violet-300">Performance drinks built around your training phase — functional ingredients, no filler.</p>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Workout phase</label>
            <div className="space-y-2">
              {WORKOUT_PHASES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPhase(p.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                    phase === p.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <span>{p.label}</span>
                  <span className="text-xs opacity-60">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Training goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    goal === g.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Drink format</label>
            <div className="flex flex-wrap gap-2">
              {DRINK_FORMATS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    format === f.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Any extras or preferences? (optional)</label>
            <input
              type="text"
              value={extras}
              onChange={e => setExtras(e.target.value)}
              placeholder="e.g. no dairy, add creatine, extra electrolytes…"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 text-sm"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">Servings</label>
            <div className="flex gap-2">
              {["1", "2"].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    servings === s
                      ? "bg-violet-600 border-violet-500 text-white"
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
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-base transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Building your drink…
              </span>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Build Performance Drink
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
                <Card className="bg-white/5 border border-violet-500/20 rounded-xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <h2 className="text-base font-bold text-white">{result.beverage?.name || result.name}</h2>
                    <p className="text-sm text-white/70">{result.beverage?.description || result.description}</p>

                    {(result.beverage?.macros || result.macros) && (
                      <div className="flex gap-3 flex-wrap">
                        {Object.entries(result.beverage?.macros || result.macros).map(([k, v]) => (
                          <div key={k} className="text-center">
                            <div className="text-xs text-white/50 capitalize">{k}</div>
                            <div className="text-sm font-semibold text-violet-300">{String(v)}</div>
                          </div>
                        ))}
                      </div>
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
