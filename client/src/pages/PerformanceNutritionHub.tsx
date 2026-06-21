import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Dumbbell, Zap, MessageSquare, Settings, Send, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import PerformanceSetupModal from "@/components/PerformanceSetupModal";

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  performance: "Peak Performance",
  competition_prep: "Competition Prep",
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
  competition_prep: "Competition Prep", weight_cut: "Weight Cut", recovery: "Recovery",
};
const CARDIO_LABELS: Record<string, string> = {
  none: "No Cardio", recovery: "Recovery Cardio", zone_2: "Zone 2",
  tempo: "Tempo", threshold: "Threshold", hiit: "HIIT", mixed: "Mixed Zones",
};

const NUTRIENT_PRIORITIES: Record<string, { label: string; items: string[] }> = {
  strength:         { label: "Strength Focus",    items: ["High protein (≥1.8g/kg)", "Moderate carbs", "Peri-workout carb timing", "Creatine-compatible foods"] },
  hypertrophy:      { label: "Hypertrophy Focus",  items: ["High protein (≥2g/kg)", "High training volume carbs", "Leucine-rich sources", "Caloric surplus"] },
  powerlifting:     { label: "Powerlifting",        items: ["High protein", "CNS recovery nutrients", "Calorie-dense options", "Low-fiber pre-workout"] },
  olympic_lifting:  { label: "Olympic Lifting",    items: ["Explosive power fueling", "Fast-digesting carbs pre-session", "Joint-supportive foods", "Protein recovery"] },
  mma:              { label: "MMA / Combat",       items: ["Glycolytic + aerobic mix", "Weight class awareness", "High protein", "Electrolyte-rich foods"] },
  boxing:           { label: "Boxing",              items: ["Glycolytic fueling", "Hand speed recovery", "Lean protein", "Anti-inflammatory support"] },
  wrestling:        { label: "Wrestling",           items: ["Explosive strength fueling", "Lactate tolerance support", "Weight management foods", "Rapid recovery macros"] },
  bjj:              { label: "BJJ",                 items: ["Aerobic endurance fueling", "Positional strength recovery", "Anti-inflammatory foods", "High protein"] },
  crossfit:         { label: "CrossFit",            items: ["Mixed modality carbs", "High protein recovery", "Zone 2–5 fuel coverage", "Gut-friendly pre-workout"] },
  endurance_running:{ label: "Endurance Running",  items: ["Glycogen priority", "Carb loading protocol", "Electrolytes & sodium", "Anti-inflammatory post-run"] },
  cycling:          { label: "Cycling",             items: ["Aerobic carb priority", "Glycogen storage", "Fat adaptation foods", "Recovery anti-inflammatories"] },
  triathlon:        { label: "Triathlon",            items: ["Three-sport carb needs", "Transition nutrition", "Gut-stable race fuel", "High protein recovery"] },
  tactical:         { label: "Tactical / Military", items: ["Load-bearing endurance fuel", "Stress-resilient nutrients", "Calorie-dense field-ready options", "Recovery protein"] },
  general_fitness:  { label: "General Fitness",    items: ["Balanced macros", "Whole food priority", "Consistent timing", "Anti-inflammatory baseline"] },
};

const COACH_STARTERS = [
  "What should I eat before a morning training session?",
  "How should I adjust my carbs on rest days?",
  "What foods support recovery after HIIT?",
  "How much protein do I actually need per day?",
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ActiveTab = "protocol" | "coach";

export default function PerformanceNutritionHub() {
  usePageTitle("Performance Hub");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("protocol");
  const [setupOpen, setSetupOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const pCtx = (user as any)?.performanceContext;
  const isActive = !!pCtx?.primaryGoal;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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
          <p className="text-orange-300 text-xs mt-0.5">Sport-specific nutrition protocol</p>
        </div>
        <button
          onClick={() => setSetupOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs font-semibold"
        >
          <Settings className="w-3.5 h-3.5" />
          {isActive ? "Update" : "Setup"}
        </button>
      </div>

      {/* Protocol inactive state */}
      {!isActive && (
        <div className="px-4 pt-12 flex flex-col items-center text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-4">
            <Dumbbell className="w-8 h-8 text-orange-400" />
          </div>
          <p className="text-white font-bold text-xl mb-2">Set Up Your Protocol</p>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Configure your sport, training phase, and goals so your meals are precisely calibrated for your athletic demands.
          </p>
          <button
            onClick={() => setSetupOpen(true)}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm"
          >
            <Zap className="w-4 h-4" /> Start Setup
          </button>
        </div>
      )}

      {/* Active state */}
      {isActive && (
        <div className="px-4 pt-4 max-w-xl mx-auto space-y-4">

          {/* Protocol summary card */}
          <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-xs text-orange-300 font-semibold">Active Protocol</p>
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

          {/* Tab selector */}
          <div className="flex bg-black/30 rounded-xl p-1 gap-1">
            {(["protocol", "coach"] as ActiveTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === tab ? "bg-orange-600 text-white" : "text-white/40"
                }`}
              >
                {tab === "protocol" ? "Nutrient Plan" : "AI Coach"}
              </button>
            ))}
          </div>

          {/* Protocol tab */}
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

              {/* Phase guidance */}
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

              {/* CTA to builder */}
              <button
                onClick={() => setLocation("/beach-body-meal-board")}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">Open Performance Nutrition Builder</p>
                  <p className="text-white/50 text-xs mt-0.5">Build sport-calibrated meals now</p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
              </button>
            </div>
          )}

          {/* Coach tab */}
          {activeTab === "coach" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex flex-col" style={{ minHeight: "380px" }}>
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-white font-bold text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-400" /> Performance Nutrition Coach
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">Ask anything about fueling, timing, recovery, or your protocol.</p>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: "340px" }}>
                  {chatHistory.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-white/30 text-xs mb-3">Try asking:</p>
                      {COACH_STARTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-orange-600/30 text-white"
                          : "bg-white/10 text-white/90"
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

              {/* Input */}
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask about fueling, timing, recovery..."
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
          )}
        </div>
      )}

      {/* Setup modal */}
      <PerformanceSetupModal
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        existingContext={pCtx}
      />
    </motion.div>
  );
}
