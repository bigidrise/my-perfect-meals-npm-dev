import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, Zap, Lightbulb } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import FavoriteButton from "@/components/FavoriteButton";
import { useBeverageGuards } from "@/hooks/useBeverageGuards";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useToast } from "@/hooks/use-toast";
import ThinkingDots from "@/components/ThinkingDots";
import MealClassificationPill from "@/components/MealClassificationPill";
import DietStyleBadge from "@/components/DietStyleBadge";

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

const PRO_TIPS_SCRIPT = {
  title: "Athletes Beverage Creator — Pro Tips",
  description:
    "Performance drinks built clean — functional ingredients, no dyes, no fillers. Every drink respects your dietary profile.",
  spokenText:
    "Here's what this system is designed to do. Every drink is built around your training phase. Pre-workout drinks prioritize energy and mental focus — think clean caffeine, adaptogens, and fast-acting carbs. Intra-workout drinks focus on hydration and endurance — electrolytes, BCAAs, and light sugars to keep you going. Post-workout drinks are built for recovery — protein timing, anti-inflammatory ingredients, and muscle repair support. No artificial dyes. No cheap fillers. Ingredients are chosen for what they actually do in your body. And your dietary profile travels with every request. If you're vegan, anti-inflammatory, or have food allergies, the same guardrails that protect every other meal in this app are active here too. Select your phase, your goal, and your drink format — then tap Build Performance Drink.",
  autoClose: false,
};

export default function AthleteBeverageCreator() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { open: openCopilot, setLastResponse } = useCopilot();

  // Form state
  const [phase, setPhase] = useState("post");
  const [goal, setGoal] = useState("muscle gain");
  const [format, setFormat] = useState("protein shake");
  const [extras, setExtras] = useState("");
  const [servings, setServings] = useState("1");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState(false);

  // Guard system
  const { safety, diet, starch } = useBeverageGuards(result);
  const {
    checking: _safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setAlert: setSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = safety;
  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = diet;

  // Auto page intro via copilot
  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Athletes Beverage Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Re-fire generation after safety override token is granted
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      handleGenerate(false, overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating]);

  function buildDescription() {
    const phaseLabel = WORKOUT_PHASES.find((p) => p.value === phase)?.label || phase;
    return `Performance ${phaseLabel} ${format} optimized for ${goal}${
      extras.trim() ? ` — ${extras.trim()}` : ""
    }. Use functional ingredients appropriate for athletic performance and recovery. No artificial dyes or fillers. Every ingredient must serve a specific purpose.`;
  }

  function buildDietaryPayload() {
    // Pull real dietary profile from authenticated user — never hardcode []
    const restrictions: string[] = [];
    if (user?.dietaryRestrictions) {
      if (Array.isArray(user.dietaryRestrictions)) {
        restrictions.push(...user.dietaryRestrictions);
      } else if (typeof user.dietaryRestrictions === "string" && user.dietaryRestrictions.trim()) {
        restrictions.push(user.dietaryRestrictions.trim());
      }
    }
    if (extras.trim()) {
      restrictions.push(extras.trim());
    }
    return restrictions;
  }

  async function handleGenerate(
    skipDietPreflight = false,
    tokenOverride?: string,
    dietAdaptOverride = false,
    userDietOverride = false,
  ) {
    setResult(null);
    setDietAdaptedNotice(null);

    const desc = buildDescription();

    // 1. Safety precheck
    if (!hasActiveOverride && !tokenOverride) {
      setSafetyChecking(true);
      const safe = await checkSafety(desc, "athlete-beverage-creator");
      setSafetyChecking(false);
      if (!safe) return;
    }

    // 2. Diet guard preflight
    if (!skipDietPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietOk = checkDiet(desc);
      if (!dietOk) return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch(apiUrl("/api/meals/beverage-creator"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          beverageCategory: format,
          flavorFamily: "performance",
          customBeverageDescription: desc,
          servingSize: `${servings} serving`,
          dietaryPreferences: buildDietaryPayload(),
          userId: user?.id,
          safetyMode: !hasActiveOverride && !tokenOverride ? "STRICT" : "CUSTOM_AUTHENTICATED",
          overrideToken: tokenOverride || (hasActiveOverride ? overrideToken : undefined),
          skipPalate: true,
          dietAdaptOverride,
          userDietOverride,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.safetyBlocked) {
          setSafetyAlert({
            show: true,
            result: "BLOCKED",
            blockedTerms: [],
            blockedCategories: [],
            ambiguousTerms: [],
            message: data.message || "This request was flagged by SafetyGuard.",
            suggestion: undefined,
          });
          return;
        }
        throw new Error(data?.message || data?.error || "Generation failed");
      }

      const meal = data.meal || data;

      // Scenario A: server confirmed diet adaptation
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(data.dietNotice || `Adapted for your ${userDiet} diet.`);
        clearDietAlert();
      } else if (!skipDietPreflight && activeDiet && !mealMatchesDiet(userDiet, meal)) {
        // Scenario B fallback: result still doesn't match diet — advise
        setIsGenerating(false);
        triggerDietAlert([], `This drink may not fully match your ${userDiet} diet.`);
        return;
      }

      setResult(meal);
      toast({
        title: "✨ Drink Built!",
        description: `${meal.name} is ready.`,
      });
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "⚠️ ALLERGY ALERT",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Something went wrong",
          description: errorMsg || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSafetyOverride(enabled: boolean, token?: string) {
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  }

  function handleProTips() {
    setLastResponse({
      title: PRO_TIPS_SCRIPT.title,
      description: PRO_TIPS_SCRIPT.description,
      spokenText: PRO_TIPS_SCRIPT.spokenText,
      autoClose: PRO_TIPS_SCRIPT.autoClose,
    });
    openCopilot();
  }

  const isBusy = isGenerating || safetyChecking || _safetyChecking;

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
              className="p-2 rounded-lg bg-white/5 text-white/60 active:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Zap className="h-5 w-5 text-violet-400" />
            <h1 className="text-base font-bold text-white">Athletes Beverage Creator</h1>
            <div className="ml-auto flex items-center gap-2">
              {/* Pro Tips pill button */}
              <button
                onClick={handleProTips}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-semibold active:bg-violet-500/30 transition-colors"
              >
                <Lightbulb className="h-3 w-3" />
                Pro Tips
              </button>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Admin Preview
              </span>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 pb-8 space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="max-w-lg mx-auto space-y-5">

          {/* Hero banner */}
          <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-violet-300 leading-relaxed">
              Performance drinks built around your training phase — functional ingredients, no dyes, no fillers. Your dietary profile and allergy protections are always active.
            </p>
          </div>

          {/* Safety guard banner */}
          <SafetyGuardBanner
            alert={safetyAlert}
            mealRequest={buildDescription()}
            onDismiss={clearSafetyAlert}
            onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
          />

          {/* Workout Phase */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">
              Workout phase
            </label>
            <div className="space-y-2">
              {WORKOUT_PHASES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPhase(p.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                    phase === p.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 active:border-white/30 active:text-white"
                  }`}
                >
                  <span>{p.label}</span>
                  <span className="text-xs opacity-60">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Training Goal */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">
              Training goal
            </label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    goal === g.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 active:border-white/30 active:text-white"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drink Format */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">
              Drink format
            </label>
            <div className="flex flex-wrap gap-2">
              {DRINK_FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFormat(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    format === f.value
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 active:border-white/30 active:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional extras */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">
              Any extras? (optional)
            </label>
            <input
              type="text"
              value={extras}
              onChange={(e) => setExtras(e.target.value)}
              placeholder="e.g. extra electrolytes, add creatine, high protein…"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 text-sm"
              maxLength={120}
            />
          </div>

          {/* Servings */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-2">
              Servings
            </label>
            <div className="flex gap-2">
              {["1", "2"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServings(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    servings === s
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/15 text-white/70 active:border-white/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {isBusy ? (
            <div className="flex justify-center py-2">
              <ThinkingDots
                label={_safetyChecking || safetyChecking ? "Checking safety…" : "Building your drink…"}
              />
            </div>
          ) : (
            <button
              onClick={() => handleGenerate()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-violet-600 active:bg-violet-700 text-white font-semibold text-base transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Build Performance Drink
            </button>
          )}

          {/* Diet guard intercept modal */}
          <DietGuardIntercept
            alert={dietAlert}
            onDecision={(decision) => {
              if (decision === "pick_something_else") {
                clearDietAlert();
              } else if (decision === "let_chef_adapt") {
                setDietDecision("let_chef_adapt");
                clearDietAlert();
                handleGenerate(true, undefined, true, false);
              } else if (decision === "continue_anyway") {
                clearDietAlert();
                handleGenerate(true, undefined, false, true);
              }
            }}
          />

          {/* Generated drink result */}
          <AnimatePresence>
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="bg-white/5 border border-violet-500/20 rounded-xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Title + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-bold text-white leading-snug flex-1">
                        {result.name}
                      </h2>
                      <button
                        onClick={() => {
                          setResult(null);
                          setDietAdaptedNotice(null);
                        }}
                        className="text-xs text-white/50 bg-white/10 px-2.5 py-1 rounded-lg shrink-0 active:scale-[0.97] transition-transform"
                      >
                        New
                      </button>
                    </div>

                    {/* Diet badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <DietStyleBadge />
                      <MealClassificationPill dietClassification={result.dietClassification} />
                      {dietAdaptedNotice && (
                        <DietAdaptedNotice
                          diet={normalizeDiet(user?.dietaryRestrictions)}
                        />
                      )}
                    </div>

                    {/* Description */}
                    {result.description && (
                      <p className="text-sm text-white/70 leading-relaxed">{result.description}</p>
                    )}

                    {/* Macros */}
                    {result.macros && (
                      <div className="flex gap-4 flex-wrap pt-1">
                        {Object.entries(result.macros).map(([k, v]) => (
                          <div key={k} className="text-center">
                            <div className="text-[10px] text-white/40 capitalize">{k}</div>
                            <div className="text-sm font-semibold text-violet-300">{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ingredients */}
                    {result.ingredients && result.ingredients.length > 0 && (
                      <div>
                        <div className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Ingredients</div>
                        <ul className="space-y-0.5">
                          {result.ingredients.map((ing: any, i: number) => (
                            <li key={i} className="text-sm text-white/70">
                              {typeof ing === "string" ? ing : `${ing.amount ?? ""} ${ing.name ?? ""}`.trim()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Instructions */}
                    {result.instructions && result.instructions.length > 0 && (
                      <div>
                        <div className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Instructions</div>
                        <ol className="space-y-1 list-decimal list-inside">
                          {(Array.isArray(result.instructions)
                            ? result.instructions
                            : [result.instructions]
                          ).map((step: string, i: number) => (
                            <li key={i} className="text-sm text-white/70 leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Utility buttons */}
                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                      <FavoriteButton
                        title={result.name}
                        sourceType="athlete-beverage-creator"
                        mealData={result}
                      />
                      <AddToMealPlanButton meal={result} />
                    </div>
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
