import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Dumbbell, Trophy, Zap, MessageSquare, Settings,
  Send, Loader2, ChevronRight, Calendar, Target, RefreshCcw,
} from "lucide-react";
import { LineChart, Line, ReferenceLine, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import PerformanceSetupModal from "@/components/PerformanceSetupModal";

// ── Label maps ───────────────────────────────────────────────────────────────
const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss", muscle_gain: "Muscle Gain",
  maintenance: "Maintenance", performance: "Peak Performance",
};
const TYPE_LABELS: Record<string, string> = {
  strength: "Strength", hypertrophy: "Hypertrophy", powerlifting: "Powerlifting",
  olympic_lifting: "Olympic Lifting", mma: "MMA", boxing: "Boxing",
  wrestling: "Wrestling", bjj: "BJJ", crossfit: "CrossFit",
  endurance_running: "Running", cycling: "Cycling", triathlon: "Triathlon",
  tactical: "Tactical / Military", general_fitness: "General Fitness",
};
const PHASE_LABELS: Record<string, string> = {
  off_season: "Off Season", pre_season: "Pre-Season", in_season: "In Season",
  weight_cut: "Weight Cut", recovery: "Recovery",
};
const CARDIO_LABELS: Record<string, string> = {
  none: "No Cardio", recovery: "Recovery Cardio", zone_2: "Zone 2",
  tempo: "Tempo", threshold: "Threshold", hiit: "HIIT", mixed: "Mixed Zones",
};
const COMP_TYPE_LABELS: Record<string, string> = {
  bodybuilding_show: "Bodybuilding", mens_physique: "Men's Physique",
  classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
  wellness: "Wellness", powerlifting_meet: "Powerlifting Meet",
  strongman_competition: "Strongman", olympic_weightlifting_meet: "Olympic Weightlifting",
  fight_camp: "Fight Camp", wrestling_season: "Wrestling Season",
  crossfit_competition: "CrossFit Competition", hyrox: "Hyrox",
  marathon: "Marathon", triathlon_race: "Triathlon", spartan_race: "Spartan Race",
};

// ── Competition phase engine (mirrors server/services/protocol/competitionPrepDateEngine.ts) ──
function deriveCompPrepPhase(eventDate: string, competitionType: string): {
  weeksOut: number;
  phase: string;
  phaseLabel: string;
  phaseColor: string;
} {
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((event.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const weeksOut = Math.floor(days / 7);

  // Post-event
  if (days < 0) return { weeksOut, phase: "post_competition", phaseLabel: "Post-Event Recovery", phaseColor: "blue" };
  // Event day
  if (days === 0) return { weeksOut, phase: "event_day", phaseLabel: "Event Day", phaseColor: "orange" };

  // Physique sports
  const isPhysique = ["bodybuilding_show", "mens_physique", "classic_physique", "figure", "bikini", "wellness"].includes(competitionType);
  if (isPhysique) {
    if (weeksOut <= 2) return { weeksOut, phase: "peak_week",   phaseLabel: "Peak Week",          phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "peak_prep",   phaseLabel: "Peak Prep",           phaseColor: "yellow" };
    if (weeksOut <= 15) return { weeksOut, phase: "conditioning", phaseLabel: "Conditioning Phase", phaseColor: "yellow" };
    return { weeksOut, phase: "fat_loss", phaseLabel: "Fat Loss Phase", phaseColor: "green" };
  }

  // Strength sports
  const isStrength = ["powerlifting_meet", "strongman_competition", "olympic_weightlifting_meet"].includes(competitionType);
  if (isStrength) {
    if (weeksOut <= 1) return { weeksOut, phase: "meet_week",        phaseLabel: "Meet Week",        phaseColor: "orange" };
    if (weeksOut <= 3) return { weeksOut, phase: "taper",            phaseLabel: "Taper Phase",       phaseColor: "yellow" };
    if (weeksOut <= 9) return { weeksOut, phase: "intensity_phase",  phaseLabel: "Intensity Phase",   phaseColor: "yellow" };
    return { weeksOut, phase: "strength_building", phaseLabel: "Strength Building", phaseColor: "green" };
  }

  // Fight camp
  if (competitionType === "fight_camp") {
    if (weeksOut <= 1) return { weeksOut, phase: "fight_week",   phaseLabel: "Fight Week",       phaseColor: "red" };
    if (weeksOut <= 3) return { weeksOut, phase: "weight_cut",   phaseLabel: "Weight Cut",        phaseColor: "red" };
    if (weeksOut <= 11) return { weeksOut, phase: "fight_prep",  phaseLabel: "Fight Prep",        phaseColor: "yellow" };
    return { weeksOut, phase: "conditioning_combat", phaseLabel: "Conditioning Camp", phaseColor: "green" };
  }

  // Wrestling season
  if (competitionType === "wrestling_season") {
    if (weeksOut <= 1) return { weeksOut, phase: "championship_week", phaseLabel: "Championship Week", phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "in_season",         phaseLabel: "In-Season",          phaseColor: "yellow" };
    return { weeksOut, phase: "pre_season", phaseLabel: "Pre-Season", phaseColor: "green" };
  }

  // Functional / Mixed (CrossFit, Hyrox)
  const isFunctional = ["crossfit_competition", "hyrox"].includes(competitionType);
  if (isFunctional) {
    if (weeksOut <= 1) return { weeksOut, phase: "competition_week", phaseLabel: "Competition Week", phaseColor: "orange" };
    if (weeksOut <= 3) return { weeksOut, phase: "peak_prep",        phaseLabel: "Peak Prep",         phaseColor: "yellow" };
    if (weeksOut <= 7) return { weeksOut, phase: "event_prep",       phaseLabel: "Event Prep",         phaseColor: "yellow" };
    return { weeksOut, phase: "base_conditioning", phaseLabel: "Base Conditioning", phaseColor: "green" };
  }

  // Endurance (marathon, triathlon, spartan)
  const isEndurance = ["marathon", "triathlon_race", "spartan_race"].includes(competitionType);
  if (isEndurance) {
    if (weeksOut <= 3) return { weeksOut, phase: "taper",       phaseLabel: "Taper Phase",            phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "race_prep",   phaseLabel: "Race Prep (Peak Training)", phaseColor: "yellow" };
    if (weeksOut <= 15) return { weeksOut, phase: "build_phase", phaseLabel: "Build Phase",            phaseColor: "yellow" };
    return { weeksOut, phase: "base_building", phaseLabel: "Base Building", phaseColor: "green" };
  }

  // Fallback
  return { weeksOut, phase: "prep", phaseLabel: "Prep Phase", phaseColor: "green" };
}

// ── Nutrient priorities per sport ────────────────────────────────────────────
const NUTRIENT_PRIORITIES: Record<string, { label: string; items: string[] }> = {
  strength:          { label: "Strength Focus",    items: ["High protein (≥1.8g/kg)", "Moderate carbs", "Peri-workout carb timing", "Creatine-compatible foods"] },
  hypertrophy:       { label: "Hypertrophy Focus", items: ["High protein (≥2g/kg)", "High training volume carbs", "Leucine-rich sources", "Caloric surplus"] },
  powerlifting:      { label: "Powerlifting",      items: ["High protein", "CNS recovery nutrients", "Calorie-dense options", "Low-fiber pre-workout"] },
  olympic_lifting:   { label: "Olympic Lifting",   items: ["Explosive power fueling", "Fast-digesting carbs pre-session", "Joint-supportive foods", "Protein recovery"] },
  mma:               { label: "MMA / Combat",      items: ["Glycolytic + aerobic mix", "Weight class awareness", "High protein", "Electrolyte-rich foods"] },
  boxing:            { label: "Boxing",             items: ["Glycolytic fueling", "Hand speed recovery", "Lean protein", "Anti-inflammatory support"] },
  wrestling:         { label: "Wrestling",          items: ["Explosive strength fueling", "Lactate tolerance support", "Weight management foods", "Rapid recovery macros"] },
  bjj:               { label: "BJJ",                items: ["Aerobic endurance fueling", "Positional strength recovery", "Anti-inflammatory foods", "High protein"] },
  crossfit:          { label: "CrossFit",           items: ["Mixed modality carbs", "High protein recovery", "Zone 2–5 fuel coverage", "Gut-friendly pre-workout"] },
  endurance_running: { label: "Endurance Running", items: ["Glycogen priority", "Carb loading protocol", "Electrolytes & sodium", "Anti-inflammatory post-run"] },
  cycling:           { label: "Cycling",            items: ["Aerobic carb priority", "Glycogen storage", "Fat adaptation foods", "Recovery anti-inflammatories"] },
  triathlon:         { label: "Triathlon",          items: ["Three-sport carb needs", "Transition nutrition", "Gut-stable race fuel", "High protein recovery"] },
  tactical:          { label: "Tactical / Military",items: ["Load-bearing endurance fuel", "Stress-resilient nutrients", "Calorie-dense field-ready options", "Recovery protein"] },
  general_fitness:   { label: "General Fitness",   items: ["Balanced macros", "Whole food priority", "Consistent timing", "Anti-inflammatory baseline"] },
};

const ATHLETIC_STARTERS = [
  "Scale is up 2 lbs, energy is good, strength is up — what do I do?",
  "Scale hasn't moved in 4 days. Energy is fine. What's the move?",
  "Energy dropped this week. Scale is still going down. Should I change anything?",
  "Scale is down, strength is holding, energy is good — am I on track?",
];
const COMP_STARTERS = [
  "Scale hasn't moved in 4 days. Energy is OK. What do I do?",
  "Weight is going down but I feel flat and weak. What's the adjustment?",
  "Scale is up 3 lbs after my refeed days. Is that normal?",
  "Energy dropped this week but the scale is still moving. Do I change anything?",
];

interface ChatMessage { role: "user" | "assistant"; content: string; }
type ActiveTab = "protocol" | "carb_cycle" | "coach";

interface CarbCycleData {
  state: {
    phase: "inactive" | "low_carb" | "refeed";
    carbTargetG: number;
    fatTargetAdjustG: number;
    weightLog: Array<{ date: string; weight: number; carbsG: number }>;
    refeedStartWeightLb?: number | null;
    manualOverride?: boolean;
  };
  engine: {
    stallDetected: boolean;
    recommendation: string;
  };
}

export default function PerformanceNutritionHub() {
  usePageTitle("Performance Hub");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param === "carb_cycle" || param === "coach" || param === "protocol") return param;
    return "protocol";
  });
  const [setupOpen, setSetupOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [carbCycleData, setCarbCycleData] = useState<CarbCycleData | null>(null);
  const [carbCycleLoading, setCarbCycleLoading] = useState(false);
  const [logWeight, setLogWeight] = useState("");
  const [logCarbs, setLogCarbs] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const pCtx = (user as any)?.performanceContext;
  const compCtx = (user as any)?.competitionPrepContext;
  // Migration shim: existing users with performanceContext but no activeProtocolTrack
  const activeTrack: "athletic" | "competition" | null =
    (user as any)?.activeProtocolTrack ?? (pCtx ? "athletic" : null);

  const isActive = !!activeTrack;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (!isActive) return;
    async function fetchCarbCycle() {
      setCarbCycleLoading(true);
      try {
        const res = await fetch(apiUrl("/api/performance/carb-cycle"), {
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCarbCycleData(data);
        }
      } catch { /* non-blocking */ } finally {
        setCarbCycleLoading(false);
      }
    }
    fetchCarbCycle();
  }, [isActive]);

  async function submitCarbLog() {
    const w = parseFloat(logWeight);
    const c = parseFloat(logCarbs);
    if (!w || w <= 0 || isNaN(c) || c < 0) {
      toast({ title: "Enter valid values", description: "Weight must be positive; carbs must be ≥ 0.", variant: "destructive" });
      return;
    }
    setLogSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(apiUrl("/api/performance/carb-cycle/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ date: today, weight: w, carbsG: c }),
      });
      if (!res.ok) throw new Error("Log failed");
      const data = await res.json();
      setCarbCycleData({ state: data.state, engine: data.engine });
      setLogWeight("");
      setLogCarbs("");
      toast({
        title: data.autoTransitioned ? "Carb cycle updated!" : "Log saved",
        description: data.autoTransitioned
          ? (data.transitionReason === "start_refeed" ? "Stall detected — refeed day activated." : "Refeed complete — returning to low-carb.")
          : "Today's entry recorded.",
      });
    } catch {
      toast({ title: "Could not save log", variant: "destructive" });
    } finally {
      setLogSubmitting(false);
    }
  }

  async function handleRefeedToggle(action: "start_refeed" | "end_refeed") {
    setOverrideSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/performance/carb-cycle/override"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Override failed");
      const data = await res.json();
      setCarbCycleData({ state: data.state, engine: data.engine });
      toast({
        title: action === "start_refeed" ? "Refeed day started" : "Low-carb phase resumed",
        description: action === "start_refeed"
          ? `Starch allocation raised to ${data.state.carbTargetG}g today.`
          : `Starch allocation reset to ${data.state.carbTargetG}g.`,
      });
    } catch {
      toast({ title: "Could not update phase", variant: "destructive" });
    } finally {
      setOverrideSubmitting(false);
    }
  }

  async function sendMessage(msg?: string) {
    const text = (msg ?? chatInput).trim();
    if (!text || chatLoading) return;
    setChatInput("");
    const newHistory: ChatMessage[] = [...chatHistory, { role: "user", content: text }];
    setChatHistory(newHistory);
    setChatLoading(true);
    try {
      const res = await fetch(apiUrl("/api/performance/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ message: text, history: chatHistory.slice(-10) }),
      });
      if (!res.ok) throw new Error("Coach unavailable");
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      toast({ title: "Coach unavailable", description: "Please try again.", variant: "destructive" });
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setChatLoading(false);
    }
  }

  const nutrients = pCtx?.trainingType ? NUTRIENT_PRIORITIES[pCtx.trainingType] : null;
  const compPhase = compCtx?.eventDate ? deriveCompPrepPhase(compCtx.eventDate, compCtx.competitionType) : null;

  const phaseColorMap: Record<string, string> = {
    green: "bg-green-950/40 border-green-500/30 text-green-300",
    yellow: "bg-yellow-950/40 border-yellow-500/30 text-yellow-300",
    orange: "bg-orange-950/40 border-orange-500/30 text-orange-300",
    blue: "bg-blue-950/40 border-blue-500/30 text-blue-300",
  };

  const chatStarters = activeTrack === "competition" ? COMP_STARTERS : ATHLETIC_STARTERS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex-1">
          <p className="text-white font-bold text-base leading-none">Performance Hub</p>
          <p className="text-orange-300 text-xs mt-0.5">
            {activeTrack === "competition" ? "Competition prep protocol" : "Sport-specific nutrition protocol"}
          </p>
        </div>
        <button
          onClick={() => setSetupOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs font-semibold"
        >
          <Settings className="w-3.5 h-3.5" />
          {isActive ? "Update" : "Setup"}
        </button>
      </div>

      {/* ── No protocol — track selector empty state ── */}
      {!isActive && (
        <div className="px-4 pt-10 max-w-lg mx-auto">
          <div className="text-center mb-8">
            <p className="text-white font-bold text-xl mb-2">Performance Nutrition Hub</p>
            <p className="text-white/50 text-sm leading-relaxed">
              Two separate protocol engines. Choose the one that matches your goal.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setSetupOpen(true)}
              className="w-full text-left px-4 py-4 rounded-2xl bg-black/50 border border-white/10 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Athletic Performance</p>
                  <p className="text-white/50 text-xs mt-0.5">MMA, boxing, CrossFit, endurance, tactical, strength sports</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 mt-1 flex-shrink-0" />
              </div>
            </button>
            <button
              onClick={() => setSetupOpen(true)}
              className="w-full text-left px-4 py-4 rounded-2xl bg-black/50 border border-white/10 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Competition Prep</p>
                  <p className="text-white/50 text-xs mt-0.5">Bodybuilding, physique, powerlifting, fight camp — calendar-driven</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 mt-1 flex-shrink-0" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Active: Competition Prep ── */}
      {isActive && activeTrack === "competition" && compCtx && (
        <div className="px-4 pt-4 max-w-xl mx-auto space-y-4">

          {/* Event countdown card */}
          <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-xs text-orange-300 font-semibold">Competition Prep Active</p>
            </div>

            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-white font-bold text-2xl leading-none">
                  {COMP_TYPE_LABELS[compCtx.competitionType] ?? compCtx.competitionType}
                </p>
                {compCtx.division && (
                  <p className="text-orange-300 text-sm font-medium mt-0.5">{compCtx.division}</p>
                )}
              </div>
              {compPhase && (
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold text-3xl leading-none">
                    {compPhase.weeksOut < 0 ? "✓" : compPhase.weeksOut}
                  </p>
                  <p className="text-white/50 text-xs mt-0.5">
                    {compPhase.weeksOut < 0 ? "complete" : compPhase.weeksOut === 0 ? "show day" : "weeks out"}
                  </p>
                </div>
              )}
            </div>

            {/* Current phase */}
            {compPhase && (
              <div className={`rounded-xl border px-3 py-2 mb-3 ${phaseColorMap[compPhase.phaseColor] ?? phaseColorMap.orange}`}>
                <p className="text-xs font-bold">Current Phase: {compPhase.phaseLabel}</p>
              </div>
            )}

            {/* Event date + weights */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/40 text-xs">Event Date</p>
                <p className="text-white font-semibold text-sm mt-0.5">
                  {new Date(compCtx.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {compCtx.currentWeight && (
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/40 text-xs">Current Weight</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{compCtx.currentWeight}</p>
                </div>
              )}
              {compCtx.targetWeight && (
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/40 text-xs">Target</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{compCtx.targetWeight}</p>
                </div>
              )}
            </div>

            {/* Phase timeline */}
            {compPhase && compPhase.weeksOut > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-white/40 text-xs mb-2">Protocol Timeline</p>
                <div className="flex gap-1">
                  {["Fat Loss", "Conditioning", "Peak Week", "Show Day"].map((label, i) => {
                    const phases = ["fat_loss", "conditioning", "peak_week", "show_day"];
                    const isCurrent = phases[i] === compPhase.phase;
                    const isPast = phases.indexOf(compPhase.phase) > i;
                    return (
                      <div key={label} className="flex-1 text-center">
                        <div className={`h-1.5 rounded-full mb-1 ${isCurrent ? "bg-orange-400" : isPast ? "bg-orange-400/40" : "bg-white/10"}`} />
                        <p className={`text-xs leading-tight ${isCurrent ? "text-orange-300" : "text-white/30"}`}
                           style={{ fontSize: "9px" }}>
                          {label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex bg-black/30 rounded-xl p-1 gap-1">
            {(["protocol", "carb_cycle", "coach"] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab ? "bg-orange-600 text-white" : "text-white/40"
                }`}
              >
                {tab === "protocol" ? "Prep Guide" : tab === "carb_cycle" ? "Carb Cycle" : "AI Coach"}
              </button>
            ))}
          </div>

          {activeTab === "carb_cycle" && renderCarbCycleTab()}

          {activeTab === "protocol" && (
            <div className="space-y-4">
              {/* Phase-specific guidance */}
              {compPhase?.phase === "fat_loss" && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-2">Fat Loss Phase — Protocol</p>
                  <div className="space-y-2">
                    {["Moderate caloric deficit (300–500 cal/day)", "High protein to preserve lean mass (≥1.8g/kg)", "Resistance training maintained — do not reduce volume", "Cardio gradually increasing toward conditioning phase", "Track weekly weight averages — not daily fluctuations"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "conditioning" && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-2">Conditioning Phase — Protocol</p>
                  <div className="space-y-2">
                    {["Calories tightening — precision matters now", "Carb cycling may begin based on training load", "Posing practice adds to calorie expenditure", "Cardio increasing — monitor fatigue and recovery", "Continue high protein — muscle preservation critical"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "peak_week" && (
                <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
                  <p className="text-orange-300 font-bold text-sm mb-2">⚡ Peak Week</p>
                  <div className="space-y-2">
                    {["Water manipulation protocol begins", "Carb loading strategy based on competition type", "Sodium management for muscle fullness", "Reduce fiber — prioritize easily digestible foods", "Training volume significantly reduced"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "post_competition" && (
                <div className="rounded-2xl bg-blue-950/40 border border-blue-500/30 p-4">
                  <p className="text-blue-300 font-bold text-sm mb-2">Post-Competition Recovery</p>
                  <div className="space-y-2">
                    {["Reverse diet — increase calories slowly (50–100 cal/week)", "Do not binge immediately — metabolic recovery takes time", "Prioritize sleep and nutrient-dense whole foods", "Reduce cardio — allow CNS recovery", "Set new goals and establish your next protocol"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setLocation("/beach-body-meal-board")}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">Launch Performance Nutrition Builder</p>
                  <p className="text-white/50 text-xs mt-0.5">Build meals calibrated for your prep phase</p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
              </button>
            </div>
          )}

          {activeTab === "coach" && renderCoachTab()}
        </div>
      )}

      {/* ── Active: Athletic Performance ── */}
      {isActive && activeTrack === "athletic" && pCtx && (
        <div className="px-4 pt-4 max-w-xl mx-auto space-y-4">

          {/* Protocol summary card */}
          <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-xs text-orange-300 font-semibold">Athletic Protocol Active</p>
            </div>
            <p className="text-white font-bold text-2xl leading-none mb-1">
              {TYPE_LABELS[pCtx.trainingType] ?? pCtx.trainingType}
            </p>
            <p className="text-orange-300 text-sm font-medium mb-3">
              {GOAL_LABELS[pCtx.primaryGoal] ?? pCtx.primaryGoal}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Phase", value: PHASE_LABELS[pCtx.trainingPhase] ?? pCtx.trainingPhase },
                { label: "Frequency", value: `${pCtx.trainingFrequency} sessions/wk` },
                { label: "Cardio", value: CARDIO_LABELS[pCtx.cardioFocus] ?? pCtx.cardioFocus },
                pCtx.twoADays ? { label: "Mode", value: "2-a-days" } : null,
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/40 text-xs">{item.label}</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-black/30 rounded-xl p-1 gap-1">
            {(["protocol", "carb_cycle", "coach"] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab ? "bg-orange-600 text-white" : "text-white/40"
                }`}
              >
                {tab === "protocol" ? "Nutrient Plan" : tab === "carb_cycle" ? "Carb Cycle" : "AI Coach"}
              </button>
            ))}
          </div>

          {activeTab === "carb_cycle" && renderCarbCycleTab()}

          {activeTab === "protocol" && (
            <div className="space-y-4">
              {nutrients && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-3">{nutrients.label} — Priority Nutrients</p>
                  <div className="space-y-2">
                    {nutrients.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pCtx.trainingPhase === "weight_cut" && (
                <div className="rounded-2xl bg-red-950/40 border border-red-500/30 p-4">
                  <p className="text-red-300 font-bold text-sm mb-1">⚠️ Weight Cut Mode Active</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Meals are optimized for low-sodium, calorie-controlled fueling with rehydration support. Electrolyte-rich vegetables and lean proteins are prioritized.
                  </p>
                </div>
              )}
              {pCtx.trainingPhase === "recovery" && (
                <div className="rounded-2xl bg-blue-950/40 border border-blue-500/30 p-4">
                  <p className="text-blue-300 font-bold text-sm mb-1">Recovery Phase Active</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Anti-inflammatory ingredients are prioritized — omega-3 rich fish, colorful vegetables, tart cherries, turmeric, and ginger feature heavily in meal suggestions.
                  </p>
                </div>
              )}
              {pCtx.twoADays && (
                <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
                  <p className="text-orange-300 font-bold text-sm mb-1">2-a-Days Protocol</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Between-session recovery meals are critical. Quick-digesting carb + protein options (rice cakes + turkey, banana + Greek yogurt) are suggested between sessions.
                  </p>
                </div>
              )}
              <button
                onClick={() => setLocation("/beach-body-meal-board")}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">Launch Performance Nutrition Builder</p>
                  <p className="text-white/50 text-xs mt-0.5">Build sport-calibrated meals now</p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
              </button>
            </div>
          )}

          {activeTab === "coach" && renderCoachTab()}
        </div>
      )}

      {/* Setup modal */}
      <PerformanceSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        onSuccess={() => setSetupOpen(false)}
        existingContext={pCtx}
        existingCompContext={compCtx}
        existingTrack={activeTrack}
      />
    </motion.div>
  );

  function renderCarbCycleTab() {
    const cycleState = carbCycleData?.state;
    const engine = carbCycleData?.engine;
    const phase = cycleState?.phase ?? "inactive";
    const carbTargetG = cycleState?.carbTargetG ?? 0;
    const isAtFloor = carbTargetG <= 50 && phase !== "inactive";
    const logCount = cycleState?.weightLog?.length ?? 0;

    const phaseBadge: Record<string, { label: string; cls: string }> = {
      inactive: { label: "Inactive", cls: "bg-white/10 text-white/50" },
      low_carb: { label: "Low Carb", cls: "bg-orange-600/30 text-orange-300 border border-orange-500/30" },
      refeed:   { label: "Refeed Active", cls: "bg-green-600/30 text-green-300 border border-green-500/30" },
    };
    const badge = phaseBadge[phase] ?? phaseBadge.inactive;

    if (carbCycleLoading && !carbCycleData) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-orange-400" />
              <p className="text-white font-bold text-sm">Carb Response Protocol</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>

          {/* Phase display */}
          {phase === "inactive" ? (
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-white/50 text-xs leading-relaxed">
                Log 7 consecutive days of weight + carbs data to activate automatic carb cycling. The engine detects weight stalls and manages refeed transitions.
              </p>
            </div>
          ) : isAtFloor ? (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
              <p className="text-amber-300 text-sm font-semibold mb-0.5">Safety Floor Reached</p>
              <p className="text-amber-200/70 text-xs leading-relaxed">
                You're in a very-low-carb range. MPM will cycle, not reduce further.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/40 text-xs">Starch Allocation</p>
                <p className="text-white font-bold text-2xl mt-0.5">{carbTargetG}<span className="text-sm font-normal text-white/50 ml-0.5">g</span></p>
              </div>
              {(cycleState?.fatTargetAdjustG ?? 0) > 0 && (
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/40 text-xs">Fat Offset</p>
                  <p className={`font-bold text-2xl mt-0.5 ${phase === "refeed" ? "text-green-300" : "text-white"}`}>
                    {phase === "refeed" ? "−" : "+"}{cycleState!.fatTargetAdjustG}<span className="text-sm font-normal text-white/50 ml-0.5">g</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stall indicator */}
          {engine?.stallDetected && (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-2.5">
              <p className="text-amber-300 text-xs font-semibold">⚡ Weight Stall Detected</p>
              <p className="text-amber-200/60 text-xs mt-0.5">7 consecutive days without movement. Refeed is recommended.</p>
            </div>
          )}

          {/* Refeed eligibility status */}
          {phase === "low_carb" && (
            <div className={`rounded-xl px-4 py-2.5 border ${engine?.stallDetected ? "bg-green-950/30 border-green-500/30" : "bg-white/5 border-white/10"}`}>
              <p className={`text-xs font-semibold ${engine?.stallDetected ? "text-green-300" : "text-white/40"}`}>
                {engine?.stallDetected ? "✓ Refeed Eligible — Stall Confirmed" : "Refeed Not Yet Recommended"}
              </p>
              <p className={`text-xs mt-0.5 ${engine?.stallDetected ? "text-green-200/60" : "text-white/30"}`}>
                {engine?.stallDetected
                  ? "7-day stall confirmed. Starting a refeed now is recommended to reset your metabolism."
                  : "Refeed eligibility activates automatically after a confirmed 7-day weight stall."}
              </p>
            </div>
          )}

          {/* Refeed toggle — disabled when inactive */}
          {phase !== "inactive" && (
            <div className="flex gap-2">
              {phase !== "refeed" ? (
                <button
                  onClick={() => handleRefeedToggle("start_refeed")}
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 text-sm font-semibold disabled:opacity-40"
                >
                  {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Start Refeed"}
                </button>
              ) : (
                <button
                  onClick={() => handleRefeedToggle("end_refeed")}
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-sm font-semibold disabled:opacity-40"
                >
                  {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "End Refeed"}
                </button>
              )}
            </div>
          )}

          {/* Daily log entry */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Log Today</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-white/40 text-xs mb-1 block">Weight (lbs)</label>
                <input
                  type="number"
                  value={logWeight}
                  onChange={e => setLogWeight(e.target.value)}
                  placeholder="175"
                  min={0}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60"
                />
              </div>
              <div className="flex-1">
                <label className="text-white/40 text-xs mb-1 block">Carbs (g)</label>
                <input
                  type="number"
                  value={logCarbs}
                  onChange={e => setLogCarbs(e.target.value)}
                  placeholder="80"
                  min={0}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60"
                />
              </div>
              <button
                onClick={submitCarbLog}
                disabled={logSubmitting || !logWeight || !logCarbs}
                className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center min-w-[60px]"
              >
                {logSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log"}
              </button>
            </div>
            <p className="text-white/25 text-xs">
              {logCount === 0
                ? "No entries yet — log 7 consecutive days to enable stall detection"
                : logCount < 7
                  ? `${logCount} / 7 entries — ${7 - logCount} more consecutive days to enable stall detection`
                  : `${logCount} entries logged`}
            </p>

            {/* Weight trend sparkline — renders when >= 3 entries exist */}
            {(() => {
              const weightLog = cycleState?.weightLog ?? [];
              const chartData = weightLog.slice(-14);
              if (chartData.length < 3) return null;
              const latestWeight = chartData[chartData.length - 1].weight;
              const refeedLine = phase === "refeed" ? (cycleState?.refeedStartWeightLb ?? null) : null;
              return (
                <div className="mt-3 rounded-xl bg-white/5 px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">Weight Trend</p>
                    <p className="text-orange-300 text-sm font-bold">{latestWeight} lbs</p>
                  </div>
                  <ResponsiveContainer width="100%" height={64}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      {refeedLine !== null && (
                        <ReferenceLine
                          y={refeedLine}
                          stroke="#86efac"
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {refeedLine !== null && (
                    <p className="text-green-300/60 text-xs mt-1">
                      — refeed start: {refeedLine} lbs
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  function renderCoachTab() {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex flex-col" style={{ minHeight: "380px" }}>
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white font-bold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              {activeTrack === "competition" ? "Competition Prep Coach" : "Performance Nutrition Coach"}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {activeTrack === "competition"
                ? "Ask about peak week, reverse diet, carb loading, or your prep timeline."
                : "Ask about fueling, timing, recovery, or your protocol."}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: "340px" }}>
            {chatHistory.length === 0 && (
              <div className="space-y-2">
                <p className="text-white/30 text-xs mb-3">Try asking:</p>
                {chatStarters.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user" ? "bg-orange-600/30 text-white" : "bg-white/10 text-white/90"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-3 py-2.5 rounded-2xl">
                  <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={activeTrack === "competition" ? "Ask about your prep..." : "Ask about fueling, timing, recovery..."}
            className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none focus:border-orange-500/60"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!chatInput.trim() || chatLoading}
            className="w-11 h-11 rounded-xl bg-orange-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    );
  }
}
