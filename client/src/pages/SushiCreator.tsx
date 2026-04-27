import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Brain, Fish, Play } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import { PillButton } from "@/components/ui/pill-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import ThinkingDots from "@/components/ThinkingDots";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import TrashButton from "@/components/ui/TrashButton";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";

const SUSHI_HOW_IT_WORKS_VIDEO = "https://youtube.com/shorts/g85Pkiywrpk?feature=share";

const SUSHI_STYLES = [
  { value: "nigiri", label: "Nigiri", emoji: "🍱" },
  { value: "maki roll", label: "Maki Roll", emoji: "🌀" },
  { value: "temaki hand roll", label: "Temaki", emoji: "🌮" },
  { value: "sashimi", label: "Sashimi", emoji: "🍣" },
  { value: "poke bowl", label: "Poke Bowl", emoji: "🥗" },
  { value: "chirashi bowl", label: "Chirashi", emoji: "🍚" },
  { value: "uramaki inside-out roll", label: "Uramaki", emoji: "🔄" },
];

const PROTEINS = [
  { value: "Salmon", emoji: "🐟" },
  { value: "Tuna", emoji: "🔴" },
  { value: "Yellowtail", emoji: "🟡" },
  { value: "Shrimp", emoji: "🦐" },
  { value: "Crab", emoji: "🦀" },
  { value: "Scallop", emoji: "⭕" },
  { value: "Tofu", emoji: "🌿" },
  { value: "Avocado", emoji: "🥑" },
  { value: "Cucumber", emoji: "🥒" },
  { value: "Eel", emoji: "🐍" },
];

export default function SushiCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id || "";

  // Input state
  const [cravingInput, setCravingInput] = useState("");
  const [sushiStyle, setSushiStyle] = useState("");
  const [protein, setProtein] = useState("");
  const [selectedDiet, setSelectedDiet] = useState("");
  const [servings, setServings] = useState(1);
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);

  // Result state
  const [generatedMeal, setGeneratedMeal] = useState<any | null>(null);
  const [mealImageLoading, setMealImageLoading] = useState(false);
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const continueAnywayRef = useRef(false);

  // Guards
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();

  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();

  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Sushi Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      handleGenerateMeal(true);
    }
  }, [pendingGeneration, overrideToken, isGenerating]);

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) return Math.min(p + Math.max(1, Math.floor((90 - p) * 0.07)), 90);
        return p;
      });
    }, 150);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    setProgress(100);
  };

  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  function buildCravingText() {
    const parts: string[] = [];
    if (cravingInput.trim()) parts.push(cravingInput.trim());
    if (sushiStyle) parts.push(`${SUSHI_STYLES.find(s => s.value === sushiStyle)?.label || sushiStyle} style`);
    if (protein) parts.push(`with ${protein}`);
    if (parts.length === 0) return "";
    return `Japanese sushi — ${parts.join(", ")}`;
  }

  const handleGenerateMeal = async (skipPreflight = false, dietAdaptOverride = false) => {
    const userDietOverride = continueAnywayRef.current;
    continueAnywayRef.current = false;
    setDietAdaptedNotice(null);

    const cravingText = buildCravingText();

    if (!cravingText) {
      toast({
        title: "Tell me what you're craving",
        description: "Describe your sushi or select a style and protein below.",
        variant: "destructive",
      });
      return;
    }

    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(cravingText, "sushi-creator");
      if (!isSafe) return;
    }

    if (!skipPreflight && activeDiet && !dietAdaptOverride) {
      const dietOk = checkDiet(cravingText);
      if (!dietOk) return;
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      const res = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          cravingInput: cravingText,
          targetMealType: "snacks",
          servings,
          userId,
          safetyMode: !safetyEnabled && overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: !safetyEnabled ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
          cookMethod: "traditional Japanese sushi preparation",
          ...(selectedDiet ? { dietaryPreferences: [selectedDiet] } : {}),
          dietAdaptOverride,
          userDietOverride,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Generation failed");
      }
      if (data?.safetyBlocked) throw new Error(data?.error || "Safety block");

      const meal = data.meal || data;
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(data.dietNotice || `Adapted for your ${userDiet} diet.`);
        clearDietAlert();
      } else if (!skipPreflight && activeDiet && !mealMatchesDiet(userDiet, meal)) {
        stopProgressTicker();
        setIsGenerating(false);
        triggerDietAlert([], `This dish may not fully match your ${userDiet} diet.`);
        return;
      }

      stopProgressTicker();
      setGeneratedMeal(meal);

      // Fire image generation async — non-blocking
      setMealImageLoading(true);
      fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id, mealName: meal.name, mealType: "sushi", ingredients: meal.ingredients }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.imageUrl) setGeneratedMeal((prev: any) => prev ? { ...prev, imageUrl: d.imageUrl } : prev); })
        .catch(() => {})
        .finally(() => setMealImageLoading(false));

      toast({ title: "🍣 Sushi Created!", description: `${meal.name} is ready.` });
    } catch (err: any) {
      stopProgressTicker();
      const errorMsg = err?.message || String(err) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({ title: "⚠️ ALLERGY ALERT", description: formatAllergyAlertDescription(errorMsg), variant: "destructive", duration: 8000 });
      } else {
        toast({ title: "Something went wrong", description: errorMsg || "Please try again.", variant: "destructive" });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  function getNutrition(meal: any) {
    const n = meal?.nutrition || {};
    return {
      calories: Number(n.calories ?? meal.calories ?? 0),
      protein: Number(n.protein ?? meal.protein ?? 0),
      carbs: Number(n.carbs ?? meal.carbs ?? 0),
      fat: Number(n.fat ?? meal.fat ?? 0),
    };
  }

  return (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        <MobileHeaderGuard>
          <div
            className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
              <button
                onClick={() => setLocation("/craving-creator-landing")}
                className="flex items-center gap-2 text-white active:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <h1 className="text-lg font-bold text-white truncate min-w-0">
                Sushi Creator
              </h1>
              <div className="flex-grow" />
              <div className="flex flex-col items-center gap-1">
                <PillButton
                  active
                  variant="emerald"
                  onClick={() => window.open(SUSHI_HOW_IT_WORKS_VIDEO, "_blank", "noopener,noreferrer")}
                  aria-label="Watch how Sushi Creator works"
                >
                  <Play className="h-3 w-3 fill-white" />
                </PillButton>
                <span className="text-[10px] text-white/70 leading-tight text-center">How it Works</span>
              </div>
            </div>
          </div>
        </MobileHeaderGuard>

        <div
          className={`max-w-2xl mx-auto px-4 ${generatedMeal ? "pb-32" : "pb-8"}`}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {/* Create Form */}
          <div className="w-full max-w-4xl mx-auto">
            <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-xl text-white">
                    <Fish className="h-5 w-5 text-teal-400" />
                    What sushi are you craving?
                  </CardTitle>
                  <div className="flex flex-col items-center gap-1">
                    <PillButton
                      active
                      variant="emerald"
                      onClick={() => window.open(SUSHI_HOW_IT_WORKS_VIDEO, "_blank", "noopener,noreferrer")}
                      aria-label="Watch how Sushi Creator works"
                    >
                      <Play className="h-3 w-3 fill-white" />
                    </PillButton>
                    <span className="text-[10px] text-white/70 leading-tight text-center">How it Works</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Primary AI input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-md font-medium text-white">
                      Describe your craving
                    </label>
                  </div>
                  <div className="relative">
                    <textarea
                      value={cravingInput}
                      onChange={(e) => setCravingInput(e.target.value)}
                      placeholder="e.g. spicy salmon roll with avocado and crispy tempura flakes, low-carb, extra protein"
                      className="w-full px-3 py-2 pr-10 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-20 resize-none text-sm"
                      maxLength={300}
                    />
                    {cravingInput && (
                      <TrashButton
                        onClick={() => setCravingInput("")}
                        size="sm"
                        ariaLabel="Clear input"
                        title="Clear"
                        className="absolute top-2 right-2"
                      />
                    )}
                  </div>
                  <p className="text-xs text-white/70 mt-1 text-right">{cravingInput.length}/300</p>
                </div>

                {/* Sushi style — PillButton with emoji + label below */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Sushi style <span className="text-white/40 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {SUSHI_STYLES.map(({ value, label, emoji }) => (
                      <div key={value} className="flex flex-col items-center gap-1">
                        <PillButton
                          active={sushiStyle === value}
                          variant="amber"
                          onClick={() => setSushiStyle(sushiStyle === value ? "" : value)}
                        >
                          {emoji}
                        </PillButton>
                        <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Protein — PillButton with emoji + label below */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Main protein <span className="text-white/40 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {PROTEINS.map(({ value, emoji }) => (
                      <div key={value} className="flex flex-col items-center gap-1">
                        <PillButton
                          active={protein === value}
                          variant="amber"
                          onClick={() => setProtein(protein === value ? "" : value)}
                        >
                          {emoji}
                        </PillButton>
                        <span className="text-[10px] text-white leading-tight text-center">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dietary Preferences */}
                <div>
                  <label className="block text-md mb-1 text-white">
                    Dietary Preferences <span className="text-white/40 font-normal">(optional)</span>
                  </label>
                  <Select value={selectedDiet || "__none__"} onValueChange={(v) => setSelectedDiet(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                      <SelectValue placeholder="Select dietary preferences" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No preference (Clear)</SelectItem>
                      <SelectItem value="keto">Keto / Low Carb</SelectItem>
                      <SelectItem value="paleo">Paleo</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="gluten-free">Gluten-Free</SelectItem>
                      <SelectItem value="dairy-free">Dairy-Free</SelectItem>
                      <SelectItem value="low-sodium">Low Sodium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Servings */}
                <div>
                  <label className="block text-md font-medium mb-1 text-white">Number of Servings</label>
                  <Select value={servings.toString()} onValueChange={(v) => setServings(parseInt(v))}>
                    <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 serving (just me)</SelectItem>
                      <SelectItem value="2">2 servings</SelectItem>
                      <SelectItem value="3">3 servings</SelectItem>
                      <SelectItem value="4">4 servings</SelectItem>
                      <SelectItem value="6">6 servings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <SafetyGuardBanner
                  alert={safetyAlert}
                  mealRequest={buildCravingText() || cravingInput}
                  onDismiss={clearSafetyAlert}
                  onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
                />

                {/* Safety / Flavor toggles */}
                <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                  <span className="text-xs text-white/60 block mb-2">Meal Safety</span>
                  <SafetyGuardToggle safetyEnabled={safetyEnabled} onSafetyChange={handleSafetyOverride} disabled={isGenerating || safetyChecking} />
                  <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
                </div>

                <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-xs text-white/60 block mb-2">Flavor Preference</span>
                  <FlavorToggle flavorPersonal={flavorPersonal} onFlavorChange={setFlavorPersonal} disabled={isGenerating} />
                  <p className="text-xs text-white/40 mt-1">
                    {flavorPersonal ? "Using your palate preferences" : "Neutral seasoning for others"}
                  </p>
                </div>

                {/* Generate button */}
                {isGenerating || safetyChecking ? (
                  <div className="max-w-md mx-auto mb-4 flex justify-center">
                    <ThinkingDots label={safetyChecking ? "Checking safety…" : "Creating your sushi…"} />
                  </div>
                ) : (
                  <GlassButton onClick={() => handleGenerateMeal()} className="w-full bg-teal-600 flex items-center justify-center">
                    Create My Sushi
                  </GlassButton>
                )}
              </CardContent>
            </Card>
          </div>

          {isGenerating && (
            <div className="w-full max-w-xl mx-auto mt-4">
              <Progress value={progress} className="h-1 bg-white/10" />
            </div>
          )}

          <DietGuardIntercept
            alert={dietAlert}
            onDecision={(decision) => {
              if (decision === "pick_something_else") {
                clearDietAlert();
              } else if (decision === "let_chef_adapt") {
                setDietDecision("let_chef_adapt");
                clearDietAlert();
                handleGenerateMeal(true, true);
              } else if (decision === "continue_anyway") {
                continueAnywayRef.current = true;
                clearDietAlert();
                handleGenerateMeal(true, false);
              }
            }}
          />

          {/* Result card */}
          {generatedMeal && (
            <div className="space-y-6 mt-6">
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Fish className="h-5 w-5 text-teal-400 shrink-0" />
                      <h3 className="text-xl font-bold text-white truncate leading-tight">
                        {generatedMeal.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <FavoriteButton title={generatedMeal.name} sourceType="sushi-creator" mealData={generatedMeal} />
                      <button
                        onClick={() => { setGeneratedMeal(null); setDietAdaptedNotice(null); }}
                        className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                      >
                        Create New
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <DietStyleBadge />
                    <MealClassificationPill dietClassification={generatedMeal.dietClassification} />
                    {dietAdaptedNotice && (
                      <DietAdaptedNotice diet={normalizeDiet(user?.dietaryRestrictions)} />
                    )}
                    <KosherProTip dietClassification={generatedMeal.dietClassification} isAdapted={!!dietAdaptedNotice} />
                  </div>

                  <p className="text-white/90 mb-4">{generatedMeal.description}</p>

                  <MealImageSlot imageUrl={generatedMeal.imageUrl} mealName={generatedMeal.name} isLoading={mealImageLoading} />

                  {generatedMeal.servingSize && (
                    <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Fish className="h-4 w-4 text-teal-400" />
                        <span className="font-medium">Serving Size:</span>{" "}
                        {generatedMeal.servingSize}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                    {(["calories", "protein", "carbs", "fat"] as const).map((key) => {
                      const value = Number(getNutrition(generatedMeal)[key] ?? 0);
                      return (
                        <div key={key} className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">{value}{key !== "calories" && "g"}</div>
                          <div className="text-xs text-white capitalize">{key}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <HealthBadgesPopover badges={generatedMeal.medicalBadges || []} align="start" />
                        <h3 className="font-semibold text-white">Medical Safety</h3>
                      </div>
                      <TrashButton size="sm" ariaLabel="Remove" title="Remove" confirm={true} confirmMessage="Remove this dish?" onClick={() => setGeneratedMeal(null)} />
                    </div>
                  </div>

                  {generatedMeal.ingredients?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-white">Ingredients:</h4>
                      <ul className="text-sm text-white/80 space-y-1">
                        {generatedMeal.ingredients.map((ing: any, i: number) => (
                          <li key={i}>{ing.displayText || `${ing.amount || ""} ${ing.unit || ""} ${ing.name || ing.item}`}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(() => {
                    const steps = normalizeInstructions(generatedMeal.instructions);
                    if (steps.length === 0) return null;
                    const visibleSteps = instructionsExpanded ? steps : steps.slice(0, 3);
                    return (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2 text-white">Instructions:</h4>
                        <div className="space-y-2">
                          {visibleSteps.map((step, index) => (
                            <div
                              key={index}
                              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeStep === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                              onClick={() => setActiveStep(activeStep === index ? null : index)}
                            >
                              <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{index + 1}</div>
                              <p className="text-sm leading-relaxed text-white/85">{step}</p>
                            </div>
                          ))}
                        </div>
                        {steps.length > 3 && (
                          <button
                            className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                            onClick={() => { setInstructionsExpanded(!instructionsExpanded); if (instructionsExpanded) setActiveStep(null); }}
                          >
                            {instructionsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {generatedMeal.reasoning && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                        <Brain className="h-4 w-4" />
                        Why This Works For You:
                      </h4>
                      <p className="text-sm text-white/80">{generatedMeal.reasoning}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <GlassButton
                      onClick={() => setLocation("/biometrics?from=sushi-creator&view=macros")}
                      className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black text-white flex items-center justify-center text-center border border-white/30"
                    >
                      Add to Macros
                    </GlassButton>

                    <div className="grid grid-cols-2 gap-2">
                      <AddToMealPlanButton meal={generatedMeal} />
                      <TranslateToggle
                        content={{ name: generatedMeal.name, description: generatedMeal.description, instructions: generatedMeal.instructions, ingredients: generatedMeal.ingredients }}
                        onTranslate={(translated) => {
                          setGeneratedMeal((prev: any) => prev ? { ...prev, name: translated.name, description: translated.description || prev.description, instructions: typeof translated.instructions === "string" ? translated.instructions : prev.instructions, ingredients: translated.ingredients || prev.ingredients } : prev);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <GlassButton
                        onClick={() => {
                          const mealData = { id: crypto.randomUUID(), name: generatedMeal.name, description: generatedMeal.description, ingredients: generatedMeal.ingredients || [], instructions: generatedMeal.instructions, imageUrl: generatedMeal.imageUrl };
                          localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
                          localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
                          setLocation("/lifestyle/chefs-kitchen");
                        }}
                        className="flex-1 bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        Prepare w/ Chef
                      </GlassButton>
                      <ShareRecipeButton
                        recipe={{ name: generatedMeal.name, description: generatedMeal.description, nutrition: generatedMeal.nutrition, ingredients: (generatedMeal.ingredients ?? []).map((ing: any) => ({ name: ing.name || ing.item, amount: ing.amount, unit: ing.unit })) }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="h-20" />
            </div>
          )}
        </div>
      </motion.div>
  );
}
