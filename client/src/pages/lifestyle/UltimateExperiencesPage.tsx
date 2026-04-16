import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, ArrowLeft, Star, Tent, Beef,
  Loader2, CheckCircle2, UtensilsCrossed
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import DietStyleBadge from "@/components/DietStyleBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type Situation = "holidays" | "camping" | "tailgating";
type Holiday =
  | "Thanksgiving" | "Christmas" | "Kwanzaa" | "Hanukkah"
  | "Eid" | "Passover" | "New Year's";

interface GeneratedCourse {
  position: string;
  meal: any;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SITUATIONS: Array<{
  id: Situation;
  label: string;
  emoji: string;
  description: string;
  icon: any;
  gradient: string;
  border: string;
}> = [
  {
    id: "holidays",
    label: "Holidays",
    emoji: "🎄",
    description: "Full holiday spreads — Thanksgiving, Kwanzaa, Eid, and more",
    icon: Star,
    gradient: "from-amber-900/40 to-yellow-900/30",
    border: "border-amber-500/40",
  },
  {
    id: "camping",
    label: "Camping",
    emoji: "🏕",
    description: "Minimal equipment, outdoor-ready meals for the trail",
    icon: Tent,
    gradient: "from-green-900/40 to-emerald-900/30",
    border: "border-green-500/40",
  },
  {
    id: "tailgating",
    label: "Tailgating",
    emoji: "🍔",
    description: "Bold, shareable cookout food built for a crowd",
    icon: Beef,
    gradient: "from-red-900/40 to-orange-900/30",
    border: "border-red-500/40",
  },
];

const HOLIDAYS: Array<{ label: Holiday; emoji: string }> = [
  { label: "Thanksgiving", emoji: "🦃" },
  { label: "Christmas", emoji: "🎄" },
  { label: "Kwanzaa", emoji: "🕯" },
  { label: "Hanukkah", emoji: "🕎" },
  { label: "Eid", emoji: "🌙" },
  { label: "Passover", emoji: "🍷" },
  { label: "New Year's", emoji: "🥂" },
];

const COURSE_OPTIONS = [
  { count: 3, label: "3 Courses", sub: "Appetizer · Main · Dessert" },
  { count: 4, label: "4 Courses", sub: "Appetizer · Main · Side · Dessert" },
  { count: 5, label: "5 Courses", sub: "Appetizer · Soup · Main · Side · Dessert" },
];

const SERVING_OPTIONS = [2, 4, 6, 8, 12];

const COURSE_LABELS: Record<string, string> = {
  appetizer: "Appetizer",
  soup: "Soup",
  main: "Main Course",
  side: "Side Dish",
  dessert: "Dessert",
};

const COURSE_ICONS: Record<string, string> = {
  appetizer: "🥗",
  soup: "🍲",
  main: "🍽",
  side: "🥦",
  dessert: "🍮",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function UltimateExperiencesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [eventType, setEventType] = useState<Holiday | null>(null);
  const [courseCount, setCourseCount] = useState<3 | 4 | 5 | null>(null);
  const [servingSize, setServingSize] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [courses, setCourses] = useState<GeneratedCourse[]>([]);

  const userId = user?.id?.toString() ?? "";

  const handleGenerate = async () => {
    if (!situation || !courseCount || !servingSize) return;
    setGenerating(true);
    setGeneratingProgress(0);
    setCourses([]);

    const ticker = setInterval(() => {
      setGeneratingProgress((p) => Math.min(p + 8, 88));
    }, 900);

    try {
      const response = await fetch(apiUrl("/api/experiences/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          situation,
          eventType: situation === "holidays" ? eventType : null,
          courseCount,
          servingSize,
          userId,
        }),
      });

      const data = await response.json();
      clearInterval(ticker);
      setGeneratingProgress(100);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate experience");
      }

      setTimeout(() => {
        setCourses(data.courses);
        setStep(5);
        setGenerating(false);
        setGeneratingProgress(0);
      }, 400);
    } catch (err: any) {
      clearInterval(ticker);
      setGenerating(false);
      setGeneratingProgress(0);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
  };

  const reset = () => {
    setStep(1);
    setSituation(null);
    setEventType(null);
    setCourseCount(null);
    setServingSize(null);
    setCourses([]);
  };

  const experienceTitle =
    situation === "holidays" && eventType
      ? `${eventType} Feast`
      : situation === "camping"
      ? "Camping Experience"
      : situation === "tailgating"
      ? "Tailgate Spread"
      : "Your Experience";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#1a1409] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/60 backdrop-blur-lg border-b border-amber-500/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => (step > 1 && !generating ? setStep((s) => (s - 1) as any) : setLocation("/lifestyle"))}
          className="text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h1 className="text-white font-bold text-base">Ultimate Experiences</h1>
        </div>
        {step > 1 && step < 5 && (
          <div className="ml-auto flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition-all ${
                  s < step ? "bg-amber-400" : s === step ? "bg-amber-400/60" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Situation ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full mb-3">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-amber-300 text-xs font-semibold tracking-wide">ULTIMATE EXPERIENCES</span>
                </div>
                <h2 className="text-white text-2xl font-bold mb-1">What's the occasion?</h2>
                <p className="text-white/50 text-sm">Choose your situation to get a fully coordinated multi-course meal</p>
              </div>
              <div className="space-y-3">
                {SITUATIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setSituation(s.id); setStep(s.id === "holidays" ? 2 : 3); }}
                      className={`w-full text-left rounded-2xl p-4 bg-gradient-to-r ${s.gradient} border ${s.border} hover:scale-[1.02] active:scale-[0.98] transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{s.emoji}</span>
                        <div className="flex-1">
                          <div className="text-white font-bold text-base">{s.label}</div>
                          <div className="text-white/60 text-sm mt-0.5">{s.description}</div>
                        </div>
                        <Icon className="h-5 w-5 text-white/30" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Holiday picker ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center mb-6">
                <h2 className="text-white text-2xl font-bold mb-1">Which holiday?</h2>
                <p className="text-white/50 text-sm">We'll tailor every dish to the occasion</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {HOLIDAYS.map((h) => (
                  <button
                    key={h.label}
                    onClick={() => { setEventType(h.label); setStep(3); }}
                    className={`rounded-2xl p-4 bg-black/40 border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      eventType === h.label ? "border-amber-400/70 bg-amber-900/20" : "border-white/10 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="text-3xl mb-1">{h.emoji}</div>
                    <div className="text-white font-semibold text-sm">{h.label}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Course count ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center mb-6">
                <h2 className="text-white text-2xl font-bold mb-1">How many courses?</h2>
                <p className="text-white/50 text-sm">Each course is designed to work together as one experience</p>
              </div>
              <div className="space-y-3">
                {COURSE_OPTIONS.map((opt) => (
                  <button
                    key={opt.count}
                    onClick={() => { setCourseCount(opt.count as 3 | 4 | 5); setStep(4); }}
                    className={`w-full rounded-2xl p-4 bg-black/40 border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      courseCount === opt.count ? "border-amber-400/70 bg-amber-900/20" : "border-white/10 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-bold text-base">{opt.label}</div>
                        <div className="text-white/50 text-xs mt-0.5">{opt.sub}</div>
                      </div>
                      <UtensilsCrossed className="h-5 w-5 text-amber-400/50" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Serving size + Generate ── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="text-center mb-6">
                <h2 className="text-white text-2xl font-bold mb-1">How many people?</h2>
                <p className="text-white/50 text-sm">Portions and quantities will be scaled to your group</p>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-6">
                {SERVING_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setServingSize(n)}
                    className={`rounded-2xl py-3 font-bold text-base transition-all hover:scale-105 active:scale-95 ${
                      servingSize === n
                        ? "bg-amber-500 text-black"
                        : "bg-black/40 border border-white/10 text-white/70 hover:border-amber-500/40"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Summary card */}
              {servingSize && (
                <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-4 mb-5">
                  <div className="text-amber-300 text-xs font-semibold mb-2 tracking-wide">YOUR EXPERIENCE</div>
                  <div className="space-y-1 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span className="text-white/50">Occasion</span>
                      <span className="font-semibold">{situation === "holidays" && eventType ? eventType : situation === "camping" ? "Camping" : "Tailgating"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Courses</span>
                      <span className="font-semibold">{courseCount} courses</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Serves</span>
                      <span className="font-semibold">{servingSize} people</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!servingSize || generating}
                className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-amber-500 to-yellow-500 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(245,158,11,0.35)]"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Building your experience…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generate Full Experience
                  </span>
                )}
              </button>

              {/* Generation progress */}
              {generating && (
                <div className="mt-4">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full"
                      animate={{ width: `${generatingProgress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-white/40 text-xs text-center mt-2">
                    Generating {courseCount} courses · respecting your diet profile…
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 5: Results ── */}
          {step === 5 && courses.length > 0 && (
            <motion.div key="step5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full mb-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-amber-300 text-xs font-semibold tracking-wide">EXPERIENCE READY</span>
                </div>
                <h2 className="text-white text-2xl font-bold mb-1">{experienceTitle}</h2>
                <p className="text-white/50 text-sm">{courseCount}-course menu · {servingSize} people · all diets respected</p>
              </div>

              <div className="space-y-4">
                {courses.map((course, idx) => (
                  <motion.div
                    key={course.position}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    {/* Course label */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-lg">{COURSE_ICONS[course.position] ?? "🍽"}</span>
                      <span className="text-amber-300 text-xs font-bold tracking-widest uppercase">
                        {COURSE_LABELS[course.position] ?? course.position}
                      </span>
                      <div className="flex-1 h-px bg-amber-500/10" />
                    </div>

                    {/* Meal card */}
                    <Card className="bg-black/40 backdrop-blur-lg border border-amber-500/15 rounded-2xl shadow-lg">
                      <CardContent className="p-4">
                        <h3 className="text-white font-bold text-base mb-1">{course.meal.name}</h3>
                        <p className="text-white/60 text-sm mb-3 line-clamp-2">{course.meal.description}</p>

                        {/* Diet pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          <DietStyleBadge />
                          <MealClassificationPill dietClassification={course.meal.dietClassification ?? null} />
                          <KosherProTip dietClassification={course.meal.dietClassification ?? null} isAdapted={false} />
                        </div>

                        {/* Nutrition row */}
                        <div className="flex gap-3 text-xs text-white/50">
                          <span>{course.meal.nutrition?.calories ?? course.meal.calories ?? "—"} cal</span>
                          <span>{course.meal.nutrition?.protein ?? course.meal.protein ?? "—"}g protein</span>
                          <span>{course.meal.nutrition?.carbs ?? course.meal.carbs ?? "—"}g carbs</span>
                          <span>{course.meal.nutrition?.fat ?? course.meal.fat ?? "—"}g fat</span>
                        </div>

                        {/* Ingredients preview */}
                        {course.meal.ingredients?.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-amber-400/70 text-xs cursor-pointer hover:text-amber-400 transition-colors">
                              View ingredients ({course.meal.ingredients.length})
                            </summary>
                            <ul className="mt-2 space-y-0.5 pl-2">
                              {course.meal.ingredients.slice(0, 10).map((ing: any, i: number) => (
                                <li key={i} className="text-white/50 text-xs">
                                  · {typeof ing === "string" ? ing : ing.item ?? ing.name ?? JSON.stringify(ing)}
                                </li>
                              ))}
                              {course.meal.ingredients.length > 10 && (
                                <li className="text-white/30 text-xs">· +{course.meal.ingredients.length - 10} more</li>
                              )}
                            </ul>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={reset}
                  className="w-full py-3 rounded-2xl font-semibold text-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Create Another Experience
                  </span>
                </button>
                <button
                  onClick={() => setLocation("/lifestyle")}
                  className="w-full py-3 rounded-2xl font-semibold text-sm bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-all active:scale-[0.98]"
                >
                  Back to Lifestyle Hub
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
