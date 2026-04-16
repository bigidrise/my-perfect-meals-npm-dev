import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet } from "@/utils/dietaryFilter";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  ChefHat,
  Utensils,
  Flame,
  Tent,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { Card, CardContent } from "@/components/ui/card";
import DietStyleBadge from "@/components/DietStyleBadge";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Situation = "holiday" | "camping" | "tailgating";
type Step = "situation" | "event" | "courses" | "serving" | "results";

interface GeneratedCourse {
  id: string;
  name: string;
  description: string;
  courseType: "appetizer" | "main" | "side" | "dessert";
  courseLabel: string;
  ingredients: { name: string; amount?: number; unit?: string; notes?: string }[];
  instructions: string[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  servings: number;
  medicalBadges?: string[];
  _fallback?: boolean;
}

interface ExperienceResult {
  experienceId: string;
  situation: string;
  eventType: string | null;
  totalCourses: number;
  servingSize: number;
  flavorProfileSeed: string;
  courses: GeneratedCourse[];
}

// ─────────────────────────────────────────────
// Config data
// ─────────────────────────────────────────────
const SITUATIONS = [
  {
    id: "holiday" as Situation,
    label: "Holidays",
    icon: Sparkles,
    description: "Thanksgiving, Christmas, Kwanzaa & more",
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/30",
  },
  {
    id: "camping" as Situation,
    label: "Camping",
    icon: Tent,
    description: "Campfire-friendly, minimal equipment",
    gradient: "from-green-500/20 to-emerald-500/20",
    border: "border-green-500/30",
  },
  {
    id: "tailgating" as Situation,
    label: "Tailgating",
    icon: Flame,
    description: "Shareable, crowd-pleasing, bold flavors",
    gradient: "from-orange-500/20 to-red-500/20",
    border: "border-orange-500/30",
  },
];

const HOLIDAY_EVENTS = [
  { id: "thanksgiving", label: "Thanksgiving", emoji: "🦃" },
  { id: "christmas", label: "Christmas", emoji: "🎄" },
  { id: "kwanzaa", label: "Kwanzaa", emoji: "🕯️" },
  { id: "hanukkah", label: "Hanukkah", emoji: "🕎" },
  { id: "eid", label: "Eid", emoji: "🌙" },
  { id: "passover", label: "Passover", emoji: "✡️" },
  { id: "new-years", label: "New Year's", emoji: "🥂" },
];

const COURSE_COUNTS = [
  { value: 3, label: "3 Course", description: "Appetizer · Main · Dessert" },
  { value: 4, label: "4 Course", description: "Appetizer · Main · Side · Dessert" },
  { value: 5, label: "5 Course", description: "Appetizer · Main · 2 Sides · Dessert" },
];

const SERVING_SIZES = [
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
  { value: 12, label: "12+" },
];

const COURSE_EMOJIS: Record<string, string> = {
  appetizer: "🥗",
  main: "🍽️",
  side: "🥘",
  dessert: "🍰",
};

// ─────────────────────────────────────────────
// Course result card
// ─────────────────────────────────────────────
function CourseCard({ course, index }: { course: GeneratedCourse; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const emoji = COURSE_EMOJIS[course.courseType] || "🍴";
  const hasNutrition =
    course.nutrition &&
    (course.nutrition.calories > 0 || course.nutrition.protein > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12, duration: 0.45 }}
    >
      <Card className="bg-black/40 backdrop-blur-lg border border-white/10 overflow-hidden">
        <CardContent className="p-0">
          {/* Course header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5">
            <span className="text-base">{emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
              {course.courseLabel}
            </span>
            {course._fallback && (
              <span className="ml-auto text-[9px] text-red-400/80 font-medium">
                ⚠ retry available
              </span>
            )}
          </div>

          {/* Meal name + description */}
          <div className="px-4 pt-3 pb-2 space-y-1">
            <h3 className="text-white font-bold text-base leading-tight">
              {course.name}
            </h3>
            {course.description && (
              <p className="text-white/60 text-xs leading-relaxed">
                {course.description}
              </p>
            )}
          </div>

          {/* Macro strip */}
          {hasNutrition && (
            <div className="flex items-center gap-3 px-4 pb-2">
              <MacroChip label="Cal" value={Math.round(course.nutrition.calories)} color="text-amber-400" />
              <MacroChip label="Protein" value={Math.round(course.nutrition.protein)} unit="g" color="text-blue-400" />
              <MacroChip label="Carbs" value={Math.round(course.nutrition.carbs)} unit="g" color="text-green-400" />
              <MacroChip label="Fat" value={Math.round(course.nutrition.fat)} unit="g" color="text-orange-400" />
            </div>
          )}

          {/* Medical badges */}
          {course.medicalBadges && course.medicalBadges.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1">
              {course.medicalBadges.slice(0, 3).map((badge) => (
                <span
                  key={badge}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          {/* Expand/collapse toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-white/50 hover:text-white/80 border-t border-white/10 transition-colors"
          >
            <span>{expanded ? "Hide details" : "Ingredients & Instructions"}</span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                  {/* Ingredients */}
                  {course.ingredients && course.ingredients.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                        Ingredients
                      </p>
                      <ul className="space-y-1">
                        {course.ingredients.map((ing, idx) => (
                          <li key={idx} className="text-xs text-white/70 flex gap-1.5">
                            <span className="text-white/30 flex-shrink-0">•</span>
                            <span>
                              {ing.amount && ing.unit
                                ? `${ing.amount} ${ing.unit} `
                                : ""}
                              {ing.name}
                              {ing.notes ? ` (${ing.notes})` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {course.instructions && course.instructions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
                        Instructions
                      </p>
                      <ol className="space-y-1.5">
                        {course.instructions.map((step, idx) => (
                          <li key={idx} className="text-xs text-white/70 flex gap-2">
                            <span className="text-amber-400/70 font-semibold flex-shrink-0 w-4">
                              {idx + 1}.
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MacroChip({
  label,
  value,
  unit = "",
  color,
}: {
  label: string;
  value: number;
  unit?: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-[11px] font-bold ${color}`}>
        {value}
        {unit}
      </span>
      <span className="text-[9px] text-white/40 font-medium">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Option chip (reusable pill selector)
// ─────────────────────────────────────────────
function OptionChip({
  label,
  selected,
  onClick,
  emoji,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  emoji?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 ${
        selected
          ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
          : "bg-black/30 border-white/15 text-white/70 hover:border-white/30"
      }`}
    >
      {emoji && <span className="mr-1.5">{emoji}</span>}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function UltimateExperiencesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Step state
  const [step, setStep] = useState<Step>("situation");
  const [situation, setSituation] = useState<Situation | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [totalCourses, setTotalCourses] = useState<3 | 4 | 5 | null>(null);
  const [servingSize, setServingSize] = useState<number | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [result, setResult] = useState<ExperienceResult | null>(null);

  const GENERATION_STEPS = [
    "Creating your experience context…",
    "Generating appetizer…",
    "Generating main course…",
    "Finishing your menu…",
    "Almost ready…",
  ];

  const handleGenerate = async () => {
    if (!situation || !totalCourses || !servingSize) return;
    if (situation === "holiday" && !eventType) return;

    setIsGenerating(true);
    setGenerationStep(0);
    setResult(null);

    const ticker = setInterval(() => {
      setGenerationStep((p) =>
        p < GENERATION_STEPS.length - 1 ? p + 1 : p,
      );
    }, 3500);

    try {
      const res = await fetch(apiUrl("/api/experiences/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          situation,
          eventType: eventType || undefined,
          totalCourses,
          servingSize,
          userId: user?.id,
          dietaryRestrictions: normalizeDiet(user?.dietaryRestrictions),
          allergies: [],
        }),
      });

      clearInterval(ticker);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      const data: ExperienceResult = await res.json();
      setResult(data);
      setStep("results");
    } catch (err) {
      clearInterval(ticker);
      toast({
        title: "Generation failed",
        description:
          err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetAll = () => {
    setSituation(null);
    setEventType(null);
    setTotalCourses(null);
    setServingSize(null);
    setResult(null);
    setStep("situation");
  };

  const canAdvanceToEvent = situation !== null;
  const canAdvanceToCourses =
    situation !== null && (situation !== "holiday" || eventType !== null);
  const canAdvanceToServing = canAdvanceToCourses && totalCourses !== null;
  const canGenerate = canAdvanceToServing && servingSize !== null;

  const selectedSituation = SITUATIONS.find((s) => s.id === situation);
  const selectedHoliday = HOLIDAY_EVENTS.find((e) => e.id === eventType);

  const titleLabel = result
    ? `${selectedHoliday?.emoji || ""} ${selectedHoliday?.label || (situation === "camping" ? "Camping" : "Tailgating")} Experience`
    : "Ultimate Experiences";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-[#1a1200] to-black pb-safe-nav"
    >
      {/* Header */}
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-amber-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 h-14 flex items-center gap-3">
            <button
              onClick={() =>
                result ? resetAll() : setLocation("/lifestyle")
              }
              className="flex items-center justify-center text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <h1 className="text-base font-bold text-white truncate">
                {titleLabel}
              </h1>
            </div>
            {result && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New
              </button>
            )}
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 space-y-5 pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)" }}
      >
        {/* ── RESULTS VIEW ── */}
        {step === "results" && result && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-300">
                  {result.totalCourses}-Course{" "}
                  {result.eventType
                    ? `${result.eventType.charAt(0).toUpperCase() + result.eventType.slice(1)} `
                    : ""}
                  {result.situation.charAt(0).toUpperCase() +
                    result.situation.slice(1)}{" "}
                  Experience
                </p>
                <p className="text-[10px] text-white/50">
                  {result.servingSize} servings · {result.flavorProfileSeed}
                </p>
              </div>
              <div className="flex items-center gap-1 text-white/60 flex-shrink-0">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{result.servingSize}</span>
              </div>
            </div>

            {/* Diet badge — renders user's active diet from profile context */}
            <DietStyleBadge />

            {/* Course cards */}
            {result.courses.map((course, idx) => (
              <CourseCard key={`${course.id}-${idx}`} course={course} index={idx} />
            ))}

            {/* Start over */}
            <button
              onClick={resetAll}
              className="w-full mt-2 py-3 rounded-xl border border-white/15 text-sm text-white/60 hover:text-white/90 hover:border-white/30 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Build another experience
            </button>
          </div>
        )}

        {/* ── WIZARD STEPS ── */}
        {step !== "results" && (
          <div className="space-y-6">
            {/* Step 1 — Situation */}
            <div className="space-y-3">
              <StepLabel number={1} label="Choose a situation" />
              <div className="flex flex-col gap-2">
                {SITUATIONS.map((s) => {
                  const Icon = s.icon;
                  const active = situation === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSituation(s.id);
                        if (s.id !== "holiday") setEventType(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 active:scale-95 ${
                        active
                          ? `bg-gradient-to-r ${s.gradient} ${s.border} border shadow-[0_0_16px_rgba(251,191,36,0.2)]`
                          : "bg-black/30 border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${active ? "text-amber-400" : "text-white/50"}`}
                        />
                        <div>
                          <p
                            className={`text-sm font-semibold ${active ? "text-white" : "text-white/70"}`}
                          >
                            {s.label}
                          </p>
                          <p className="text-xs text-white/40">{s.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 — Event type (holidays only) */}
            <AnimatePresence>
              {situation === "holiday" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <StepLabel number={2} label="Which holiday?" />
                  <div className="flex flex-wrap gap-2">
                    {HOLIDAY_EVENTS.map((e) => (
                      <OptionChip
                        key={e.id}
                        label={e.label}
                        emoji={e.emoji}
                        selected={eventType === e.id}
                        onClick={() => setEventType(e.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3 — Course count */}
            <AnimatePresence>
              {canAdvanceToCourses && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <StepLabel
                    number={situation === "holiday" ? 3 : 2}
                    label="How many courses?"
                  />
                  <div className="flex flex-col gap-2">
                    {COURSE_COUNTS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setTotalCourses(c.value as 3 | 4 | 5)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 active:scale-95 ${
                          totalCourses === c.value
                            ? "bg-amber-500/15 border-amber-500/50 text-white"
                            : "bg-black/30 border-white/10 text-white/70 hover:border-white/25"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{c.label}</span>
                          <span className="text-xs text-white/40">{c.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 4 — Serving size */}
            <AnimatePresence>
              {canAdvanceToServing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <StepLabel
                    number={situation === "holiday" ? 4 : 3}
                    label="How many people?"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {SERVING_SIZES.map((s) => (
                      <OptionChip
                        key={s.value}
                        label={s.label}
                        selected={servingSize === s.value}
                        onClick={() => setServingSize(s.value)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate button */}
            <AnimatePresence>
              {canGenerate && !isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    onClick={handleGenerate}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm shadow-[0_0_24px_rgba(251,191,36,0.4)] hover:shadow-[0_0_32px_rgba(251,191,36,0.6)] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate{" "}
                    {totalCourses}-Course{" "}
                    {selectedHoliday?.label ||
                      selectedSituation?.label}{" "}
                    Experience
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generation loading */}
            <AnimatePresence>
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-8 flex flex-col items-center gap-4"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
                    </div>
                    <div className="absolute -inset-2 rounded-full border border-amber-500/20 animate-ping" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white">
                      {GENERATION_STEPS[generationStep]}
                    </p>
                    <p className="text-xs text-white/40">
                      Crafting a cohesive {totalCourses}-course experience…
                    </p>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {Array.from({ length: totalCourses || 3 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-500 ${
                          i <= generationStep
                            ? "bg-amber-400"
                            : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Step label helper
function StepLabel({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-amber-400">{number}</span>
      </div>
      <span className="text-sm font-semibold text-white/80">{label}</span>
    </div>
  );
}
