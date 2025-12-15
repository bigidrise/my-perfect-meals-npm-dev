import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { useLocation } from "wouter";
import { Home } from "lucide-react";

type DemoResponse = {
  variant: "A" | "B";
  plan: Array<{ week: number; days: Array<{ day: number; meals: any[] }> }>;
  meta: Record<string, any>;
};

export default function ABTestingDemo() {
  const [busy, setBusy] = useState<null | "AUTO" | "A" | "B">(null);
  const [result, setResult] = useState<DemoResponse | null>(null);
  const [err, setErr] = useState<string>("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const generate = async (variant: "AUTO" | "A" | "B") => {
    setBusy(variant);
    setErr("");
    try {
      const data = await apiPost<DemoResponse>("/api/meal-plans/generate", {
        weeks: 1,
        mealsPerDay: 3,
        snacksPerDay: 1,
        targets: { calories: 2000, protein: 140 },
        variant,
      });
      console.log("[ABTestingDemo] success", data);
      setResult(data);
      
      toast({
        title: "Meal Plan Generated!",
        description: `Generated using Option ${data.variant} with ${data.meta.totalMeals} total meals`,
      });
    } catch (e: any) {
      console.error("[ABTestingDemo] error", e);
      setErr(e.message ?? String(e));
      toast({
        title: "Generation Failed",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      {/* Navigation Button */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          onClick={() => setLocation("/comprehensive-meal-planning-revised")}
          className="bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Meal Planning Hub
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6 mt-14">
        {/* Header */}
        <GlassCard>
          <GlassCardContent className="p-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              A/B Testing Demo
            </h1>
            <p className="text-white/70">
              Test the lean A/B system for meal plan generation
            </p>
          </GlassCardContent>
        </GlassCard>

        {/* Variant Buttons */}
        <GlassCard>
          <GlassCardContent className="p-6">
            <h2 className="text-xl font-bold text-white mb-4">Choose Variant</h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => generate("AUTO")}
                disabled={!!busy}
                className="p-4 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
                data-testid="variant-auto"
              >
                <div className="font-semibold">
                  {busy === "AUTO" ? "Generating…" : "Auto Generate"}
                </div>
                <div className="text-sm mt-1 text-white/70">System chooses best variant</div>
              </button>
              <button
                type="button"
                onClick={() => generate("A")}
                disabled={!!busy}
                className="p-4 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
                data-testid="variant-a"
              >
                <div className="font-semibold">
                  {busy === "A" ? "Generating…" : "Option A"}
                </div>
                <div className="text-sm mt-1 text-white/70">Classic 3-step workflow</div>
              </button>
              <button
                type="button"
                onClick={() => generate("B")}
                disabled={!!busy}
                className="p-4 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all"
                data-testid="variant-b"
              >
                <div className="font-semibold">
                  {busy === "B" ? "Generating…" : "Option B"}
                </div>
                <div className="text-sm mt-1 text-white/70">Turbo 2-step workflow</div>
              </button>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Error Display */}
        {!!err && (
          <div className="rounded-lg border border-red-400/40 bg-red-900/20 p-4 text-red-200">
            <h3 className="font-semibold mb-2">Error</h3>
            <p>{err}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <GlassCard>
            <GlassCardContent className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Generation Results
              </h2>
              
              <div className="mb-4 text-sm text-white/70">
                Generated with: <span className="font-semibold text-white">Option {result.variant}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-white/70 text-sm">Total Meals</p>
                  <p className="text-white font-bold text-lg">
                    {result.meta.totalMeals}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-white/70 text-sm">Unique Ingredients</p>
                  <p className="text-white font-bold text-lg">
                    {result.meta.uniqueIngredients}
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center">
                  <p className="text-white/70 text-sm">Macro Target Hit</p>
                  <p className="text-white font-bold text-lg">
                    {result.meta.macroTargetHit}%
                  </p>
                </div>
              </div>

              {/* Quick Summary */}
              <div className="mb-4 text-sm text-white/80 bg-white/5 rounded-lg p-3">
                Week 1 days: {result.plan?.[0]?.days?.length ?? 0} •
                Meals day 1: {result.plan?.[0]?.days?.[0]?.meals?.length ?? 0} •
                Plan type: {result.meta.planType}
              </div>

              {/* Meta Data */}
              <details className="mb-4">
                <summary className="cursor-pointer text-white/80 font-semibold mb-2">
                  View metadata
                </summary>
                <pre className="text-xs text-white/70 whitespace-pre-wrap break-words bg-black/20 rounded-lg p-3">
                  {JSON.stringify(result.meta, null, 2)}
                </pre>
              </details>

              {/* Full Plan */}
              <details>
                <summary className="cursor-pointer text-white/80 font-semibold mb-2">
                  View full plan JSON
                </summary>
                <pre className="text-xs text-white/70 whitespace-pre-wrap break-words bg-black/20 rounded-lg p-3">
                  {JSON.stringify(result.plan, null, 2)}
                </pre>
              </details>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>
    </div>
  );
}