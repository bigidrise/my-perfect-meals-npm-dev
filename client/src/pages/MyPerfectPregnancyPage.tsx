import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Baby, ShieldCheck, Leaf, BookOpen, ChevronDown, ChevronUp, Heart } from "lucide-react";
import { post, ApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { PregnancySupportSetupModal } from "@/components/PregnancySupportSetupModal";
import { derivePregnancyStatus } from "@/lib/pregnancyUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Static educational content by stage ────────────────────────────────────

const STAGE_DATA: Record<Stage, {
  label: string;
  emoji: string;
  focus: string;
  nutrients: string[];
  avoidFoods: string[];
  symptoms: { symptom: string; support: string }[];
  calorieNote: string;
}> = {
  "trying-to-conceive": {
    label: "Trying to Conceive",
    emoji: "🌸",
    focus: "Optimizing nutrient stores before conception",
    calorieNote: "Maintain your current calorie intake — focus on nutrient quality.",
    nutrients: ["Folate / Folic Acid (400–800 mcg/day)", "Iron", "Omega-3 DHA", "Antioxidants (vitamins C & E)", "Choline"],
    avoidFoods: ["High-mercury fish (shark, swordfish, king mackerel)", "Alcohol", "Excessive caffeine"],
    symptoms: [],
  },
  "trimester-1": {
    label: "First Trimester",
    emoji: "🌱",
    focus: "Neural tube development · Weeks 1–13",
    calorieNote: "No extra calories needed yet — focus on folate and iron quality.",
    nutrients: ["Folate / Folic Acid (600–800 mcg)", "Iron (27mg)", "Vitamin B6 (1.9mg)", "Choline", "Vitamin C"],
    avoidFoods: ["Raw fish & sushi", "Raw or soft-boiled eggs", "Deli meats", "Soft unpasteurized cheeses", "High-mercury fish", "Alcohol"],
    symptoms: [
      { symptom: "Nausea", support: "Ginger tea, bland crackers, small frequent meals, bananas, B6-rich foods" },
      { symptom: "Fatigue", support: "Iron + vitamin C pairs (spinach + lemon), complex carbs, whole grains" },
      { symptom: "Food aversions", support: "Mild, familiar foods — plain grains, soft proteins, cool or room-temperature options" },
    ],
  },
  "trimester-2": {
    label: "Second Trimester",
    emoji: "🌿",
    focus: "Rapid fetal growth · Weeks 14–27",
    calorieNote: "+340 calories above your pre-pregnancy baseline.",
    nutrients: ["Protein (75–100g/day)", "Calcium (1,000mg)", "Vitamin D (600 IU)", "Magnesium", "Fiber (25–35g)"],
    avoidFoods: ["Raw fish & sushi", "Raw or soft-boiled eggs", "Deli meats", "Soft unpasteurized cheeses", "High-mercury fish", "Alcohol"],
    symptoms: [
      { symptom: "Heartburn", support: "Avoid acidic/spicy/fried foods, eat smaller meals, oatmeal, bananas, yogurt" },
      { symptom: "Constipation", support: "Prunes, chia seeds, oats, vegetables, beans — pair with plenty of water" },
    ],
  },
  "trimester-3": {
    label: "Third Trimester",
    emoji: "🌺",
    focus: "Brain development · Iron reserves · Weeks 28–40",
    calorieNote: "+450 calories above your pre-pregnancy baseline.",
    nutrients: ["DHA Omega-3 (200–300mg)", "Iron (27mg)", "Choline (450mg)", "Vitamin K", "Potassium"],
    avoidFoods: ["Raw fish & sushi", "High-mercury fish", "Deli meats", "Excess sodium", "Large heavy meals", "Alcohol"],
    symptoms: [
      { symptom: "Swelling", support: "Low-sodium meals, potassium-rich foods (banana, sweet potato, avocado, spinach)" },
      { symptom: "Shortness of breath", support: "Smaller, lighter meals — avoid bloating foods; high-nutrient-density, small portions" },
      { symptom: "Fatigue", support: "Iron + vitamin C at the same meal; complex carbs; avoid high-sugar foods" },
    ],
  },
  "breastfeeding": {
    label: "Breastfeeding",
    emoji: "🤱",
    focus: "Milk production · Infant nourishment",
    calorieNote: "+500 calories above your pre-pregnancy baseline.",
    nutrients: ["Protein (71g/day)", "Calcium (1,000mg)", "Iodine (290 mcg)", "DHA (200–300mg)", "Vitamin D (600 IU)"],
    avoidFoods: ["Alcohol (passes into breast milk)", "High-mercury fish", "Excess caffeine"],
    symptoms: [],
  },
  "postpartum": {
    label: "Postpartum Recovery",
    emoji: "🩷",
    focus: "Recovery · Body recomposition · Hormone support · Strength",
    calorieNote: "Return to pre-pregnancy maintenance. Do not restrict — crash dieting disrupts hormones and recovery. If breastfeeding, add +500 calories.",
    nutrients: [
      "Fiber (25–35g/day — gut restoration, estrogen clearance)",
      "Complex carbs — whole grains, legumes, starchy veg (keep them in)",
      "Protein (80–100g/day — tissue repair, collagen rebuilding)",
      "Omega-3 fats — salmon, walnuts, chia (anti-inflammatory)",
      "Vitamin C + Zinc (collagen & skin elasticity)",
      "Iron (replenish birth blood loss)",
    ],
    avoidFoods: [
      "Refined sugar & ultra-processed foods (drive inflammation)",
      "Excess sodium (prolongs swelling)",
      "Alcohol (disrupts hormone recovery)",
      "Extreme diets — carnivore, keto, very low carb (contraindicated postpartum)",
    ],
    symptoms: [],
  },
};

const MERCURY_PREFERRED = ["Salmon", "Sardines", "Trout", "Tilapia", "Cod", "Catfish", "Shrimp", "Canned light tuna"];
const MERCURY_LIMIT = ["Albacore tuna", "Halibut", "Mahi-mahi", "Grouper"];
const MERCURY_AVOID = ["Shark", "Swordfish", "King mackerel", "Tilefish", "Bigeye tuna", "Orange roughy", "Marlin"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyPerfectPregnancyPage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();

  // ── Clinical paywall ─────────────────────────────────────────────────────
  const entitlements: string[] = (user as any)?.entitlements || [];
  const hasPregnancyAccess =
    entitlements.includes("pregnancy") || entitlements.includes("FULL_ACCESS");

  // Pregnancy context — loaded from API
  const [pregnancyData, setPregnancyData] = useState<{
    stage: Stage;
    weekOfPregnancy: number | null;
    symptoms: string[];
    isBreastfeeding: boolean;
    dueDate: string | null;
    trackingMode: string;
  } | null>(null);

  // UI state
  const [setupOpen, setSetupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"coach" | "learn" | "safety">("coach");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Coach state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Seed from the already-loaded auth user immediately — no extra round-trip
  useEffect(() => {
    if (user) applyUserToPregnancyData(user);
  }, [user]);

  useEffect(() => {
    document.title = "My Perfect Pregnancy | My Perfect Meals";
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function applyUserToPregnancyData(u: any) {
    const status = derivePregnancyStatus(u);
    if (!status) {
      setPregnancyData(null);
      return;
    }
    setPregnancyData({
      stage: status.stage as Stage,
      weekOfPregnancy: status.weekOfPregnancy,
      symptoms: status.symptoms,
      isBreastfeeding: status.isBreastfeeding,
      dueDate: status.dueDate,
      trackingMode: status.trackingMode,
    });
  }

  async function loadPregnancyContext() {
    try {
      const freshUser = await refreshUser();
      applyUserToPregnancyData(freshUser);
    } catch {
      // ignore — user not logged in or network error
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      // post() uses apiJSON() which calls getAuthHeaders() — sends x-auth-token from localStorage
      const data = await post<{ reply: string; stage: string; weekOfPregnancy: number | null }>(
        "/api/pregnancy/ask",
        {
          message: userMsg.content,
          conversationHistory: newHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }
      );

      if (typeof data.reply === "string" && data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        console.error("[PregnancyCoach] Unexpected response shape:", data);
        setMessages(prev => [...prev, { role: "assistant", content: "I couldn't generate a response. Please try again." }]);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        let errorMsg = "I had trouble responding. Please try again.";
        if (err.status === 401) {
          errorMsg = "You need to be signed in to use the Pregnancy Coach.";
        } else if (err.status === 403) {
          errorMsg = "Pregnancy Coach requires a pregnancy-enabled plan. Check your subscription settings.";
        } else if (err.status === 500) {
          errorMsg = "The Pregnancy Coach had a server error. Please try again in a moment.";
        } else {
          errorMsg = `Something went wrong (${err.status}). Please try again.`;
        }
        console.error("[PregnancyCoach] HTTP error:", err.status);
        setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);
      } else {
        console.error("[PregnancyCoach] Network error:", err);
        setMessages(prev => [...prev, { role: "assistant", content: "I had trouble connecting. Please check your internet and try again." }]);
      }
    } finally {
      setLoading(false);
    }
  }

  const stageInfo = pregnancyData ? STAGE_DATA[pregnancyData.stage] : null;

  const SUGGESTED_QUESTIONS: Record<Stage, string[]> = {
    "trying-to-conceive": ["What foods boost fertility?", "How much folate do I need?", "What should I avoid before conceiving?"],
    "trimester-1": ["What helps with nausea?", "Is salmon safe right now?", "What foods have the most folate?"],
    "trimester-2": ["How do I get enough calcium?", "What fish is safe to eat?", "How much protein do I need?"],
    "trimester-3": ["What foods are high in DHA?", "How do I reduce swelling?", "What should I eat before delivery?"],
    "breastfeeding": ["Do I need more calories?", "Is coffee safe while breastfeeding?", "What helps milk production?"],
    "postpartum": ["Why do I need fiber postpartum?", "What foods help with skin recovery?", "Why should I avoid keto postpartum?"],
  };

  const suggestions = pregnancyData ? SUGGESTED_QUESTIONS[pregnancyData.stage] : SUGGESTED_QUESTIONS["trimester-2"];

  if (!hasPregnancyAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-orange-950/20 to-black text-white pb-20">
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-orange-500/20">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setLocation("/lifestyle")} className="p-1">
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-base">🩷</span>
              <span className="text-white font-semibold text-sm">My Perfect Pregnancy</span>
            </div>
            <div className="w-8" />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
            <Baby className="w-10 h-10 text-orange-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">My Perfect Pregnancy™</h2>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Trimester-aware nutrition, Pregnancy Coach, food safety guidance, and pregnancy-support meal generation.
            </p>
          </div>
          <div className="bg-orange-950/40 border border-orange-500/30 rounded-2xl px-5 py-4 max-w-xs w-full space-y-3">
            <p className="text-orange-300 font-semibold text-sm">Clinical Plan Required</p>
            <ul className="text-white/70 text-xs text-left space-y-1.5">
              <li>✓ Trimester-specific meal protocols</li>
              <li>✓ Pregnancy Coach (AI nutrition companion)</li>
              <li>✓ Food safety — mercury, listeria, raw foods</li>
              <li>✓ Symptom support: nausea, heartburn, fatigue</li>
              <li>✓ Postpartum & breastfeeding nutrition</li>
            </ul>
          </div>
          <button
            onClick={() => setLocation("/pricing")}
            className="bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl px-8 py-3 text-sm w-full max-w-xs"
          >
            View Clinical Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-36"
      style={{
        backgroundImage: "linear-gradient(rgba(2,8,14,0.80), rgba(1,5,12,0.76)), url('/images/pregnancy-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >

      {/* Header — mobile only; DesktopHeader handles title on desktop */}
      <MobileHeaderGuard>
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-pink-500/20" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setLocation("/lifestyle")} className="p-1">
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-base">🩷</span>
              <span className="text-white font-semibold text-sm">My Perfect Pregnancy</span>
            </div>
            <MedicalSourcesInfo asPillButton />
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-pink-950/60 via-black to-orange-950/30 border border-pink-500/30 p-4"
        >
          {stageInfo ? (
            <>
              {/* Protocol active indicator */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <p className="text-green-300 text-xs font-semibold">Pregnancy Nutrition Protocol Active</p>
              </div>

              {/* Week + trimester — primary status */}
              {pregnancyData?.weekOfPregnancy ? (
                <p className="text-white font-bold text-3xl leading-none">
                  Week {pregnancyData.weekOfPregnancy}
                  <span className="text-pink-300 font-medium text-base ml-3">
                    {stageInfo.emoji} {stageInfo.label}
                  </span>
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{stageInfo.emoji}</span>
                  <p className="text-white font-bold text-xl">{stageInfo.label}</p>
                </div>
              )}

              {/* Due date */}
              {pregnancyData?.dueDate && (
                <p className="text-white/70 text-xs mt-1.5">
                  Due Date:{" "}
                  <span className="text-white/90">
                    {new Date(pregnancyData.dueDate + "T12:00:00").toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </span>
                </p>
              )}

              {/* Next milestone */}
              {(() => {
                const ps = derivePregnancyStatus(user);
                if (!ps?.nextMilestone) return null;
                return (
                  <p className="text-pink-300 text-xs mt-1 font-medium">
                    Next: {ps.nextMilestone}
                  </p>
                );
              })()}

              {/* Active symptoms */}
              {pregnancyData?.symptoms && pregnancyData.symptoms.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-white/70 text-xs mb-1.5">Symptoms being tracked:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pregnancyData.symptoms.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-pink-900/40 border border-pink-500/30 text-pink-200">
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
                <button
                  onClick={() => setActiveTab("coach")}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-pink-700/50 border border-pink-400/40 text-white active:scale-95 transition-all"
                >
                  🩷 Ask Coach
                </button>
                <button
                  onClick={() => setSetupOpen(true)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/8 border border-white/15 text-white/80 active:scale-95 transition-all"
                >
                  ✏️ Update Protocol
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold text-lg">Set Up My Perfect Pregnancy</p>
                <p className="text-white/60 text-xs mt-1 leading-relaxed">
                  Tell us your stage and symptoms so every meal, food scan, and coach response understands your journey.
                </p>
              </div>
              <button
                onClick={() => setSetupOpen(true)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-pink-600/40 border border-pink-400/40 text-pink-200 active:scale-95 transition-all"
              >
                Set Up
              </button>
            </div>
          )}
        </motion.div>

        {/* Nutrient priorities — quick view */}
        {stageInfo && stageInfo.nutrients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-white/5 border border-white/10 p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-4 h-4 text-green-400" />
              <p className="text-green-300 text-sm font-semibold">Current Nutrient Priorities</p>
            </div>
            <ul className="space-y-1">
              {stageInfo.nutrients.map((n, i) => (
                <li key={i} className="text-white/90 text-xs flex items-start gap-1.5">
                  <span className="text-green-400 mt-0.5">•</span> {n}
                </li>
              ))}
            </ul>
          </motion.div>
        )}


        {/* Tab nav */}
        <div className="flex gap-2">
          {(["coach", "learn", "safety"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
                activeTab === tab
                  ? "bg-pink-700/50 border-pink-400/50 text-white"
                  : "bg-white/5 border-white/10 text-white/60"
              }`}
            >
              {tab === "coach" ? "🩷 Ask Coach" : tab === "learn" ? "📖 Learn" : "🛡️ Food Safety"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── ASK PREGNANCY COACH ── */}
          {activeTab === "coach" && (
            <motion.div
              key="coach"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Messages */}
              {messages.length === 0 && (
                <div className="rounded-xl bg-gradient-to-br from-pink-950/40 to-black border border-pink-500/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Baby className="w-5 h-5 text-pink-400" />
                    <p className="text-pink-300 font-semibold text-sm">Pregnancy Coach</p>
                  </div>
                  <p className="text-white/90 text-sm leading-relaxed mb-3">
                    Hi! I&apos;m your pregnancy nutrition companion. Ask me anything about food safety, nutrients, symptoms, grocery shopping, or meal ideas.
                  </p>
                  <p className="text-white/60 text-xs mb-2">Try asking:</p>
                  <div className="space-y-1.5">
                    {suggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 active:bg-white/10 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <span className="mr-2 mt-1 text-base flex-shrink-0">🩷</span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-orange-600/80 text-white rounded-br-sm"
                        : "bg-white/10 text-white/90 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <span className="mr-2 text-base">🩷</span>
                  <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2.5">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-pink-400/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Input */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask about food safety, nausea, nutrients…"
                  rows={2}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-pink-400/60 resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="p-3 rounded-xl bg-pink-600/70 border border-pink-400/40 text-white disabled:opacity-40 active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <p className="text-white/55 text-xs text-center leading-relaxed">
                Pregnancy Coach provides nutrition education only — not medical advice. Always follow your OB/GYN or midwife&apos;s guidance.
              </p>
            </motion.div>
          )}

          {/* ── LEARN ABOUT YOUR STAGE ── */}
          {activeTab === "learn" && (
            <motion.div
              key="learn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* How the System Adapts — shown at the top of the Learn tab */}
              <div className="rounded-xl bg-pink-950/40 border border-pink-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-pink-300 flex-shrink-0" />
                  <p className="text-pink-200 text-sm font-semibold">How the System Adapts to You</p>
                </div>
                <p className="text-white/80 text-xs leading-relaxed">
                  My Perfect Pregnancy is not just a reference guide. When you activate it and set your stage, these rules run automatically across every meal generator — you don't set them per builder.
                </p>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-white/90 text-xs font-semibold mb-1">🛡️ Food safety — enforced everywhere</p>
                    <p className="text-white/70 text-xs leading-relaxed">Raw fish, mercury-heavy fish, deli meats, unpasteurized cheeses, and alcohol are blocked in every builder simultaneously — Create a Dish, Grocery Coach, Restaurant Guide, Fridge Rescue, Meal Board, and more.</p>
                  </div>
                  <div>
                    <p className="text-white/90 text-xs font-semibold mb-1">🌿 Nutrients — shift with your stage</p>
                    <p className="text-white/70 text-xs leading-relaxed">The app prioritizes what your body needs right now. First trimester: folate and iron. Second: protein and calcium. Third: DHA and choline. Postpartum and breastfeeding have their own separate protocols.</p>
                  </div>
                  <div>
                    <p className="text-white/90 text-xs font-semibold mb-1">💛 Symptoms — adapt in real time</p>
                    <p className="text-white/70 text-xs leading-relaxed">The symptoms you set above change what the AI builds for you. Nausea: ginger, B6, bland foods, cool options. Heartburn: no acidic or fried ingredients. Swelling: low sodium, more potassium. Fatigue: iron-rich, complex carbs.</p>
                  </div>
                  <div>
                    <p className="text-white/90 text-xs font-semibold mb-1">📋 Stacks with your other protocols</p>
                    <p className="text-white/70 text-xs leading-relaxed">If you also have Thyroid Support, Cardiac Support, or any other condition active, both protocols run at once. The strictest rule from either always wins.</p>
                  </div>
                </div>
              </div>

              <p className="text-white/60 text-xs px-1 pt-1">Nutrition reference by stage</p>

              {Object.entries(STAGE_DATA).map(([stageKey, data]) => {
                const isExpanded = expandedSection === stageKey;
                const isCurrentStage = pregnancyData?.stage === stageKey;
                return (
                  <div
                    key={stageKey}
                    className={`rounded-xl border overflow-hidden ${
                      isCurrentStage
                        ? "border-pink-400/50 bg-pink-950/30"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <button
                      onClick={() => setExpandedSection(isExpanded ? null : stageKey)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{data.emoji}</span>
                        <div>
                          <p className={`text-sm font-semibold ${isCurrentStage ? "text-pink-200" : "text-white"}`}>
                            {data.label}
                            {isCurrentStage && <span className="ml-2 text-xs text-pink-400/80">← You are here</span>}
                          </p>
                          <p className="text-white/50 text-xs">{data.focus}</p>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                      }
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
                        <div>
                          <p className="text-orange-300/80 text-xs font-semibold mb-1">📊 Calorie Guidance</p>
                          <p className="text-white/70 text-xs">{data.calorieNote}</p>
                        </div>
                        <div>
                          <p className="text-green-300/80 text-xs font-semibold mb-1.5">🌿 Priority Nutrients</p>
                          <ul className="space-y-1">
                            {data.nutrients.map((n, i) => (
                              <li key={i} className="text-white/70 text-xs flex items-start gap-1.5">
                                <span className="text-green-400 mt-0.5 flex-shrink-0">•</span> {n}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {data.symptoms.length > 0 && (
                          <div>
                            <p className="text-yellow-300/80 text-xs font-semibold mb-1.5">💛 Common Symptoms &amp; Support</p>
                            <ul className="space-y-2">
                              {data.symptoms.map((s, i) => (
                                <li key={i} className="text-xs">
                                  <span className="text-white/80 font-medium">{s.symptom}:</span>{" "}
                                  <span className="text-white/60">{s.support}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* ── FOOD SAFETY ── */}
          {activeTab === "safety" && (
            <motion.div
              key="safety"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Hard blocks */}
              <div className="rounded-xl bg-red-950/30 border border-red-500/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-red-400" />
                  <p className="text-red-300 text-sm font-semibold">Always Avoid During Pregnancy</p>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "Alcohol — zero tolerance (no safe amount)",
                    "Raw fish, sushi, sashimi, raw shellfish",
                    "Raw or soft-boiled eggs",
                    "Deli meats / cold cuts (unless heated to 165°F)",
                    "Refrigerated smoked salmon / lox",
                    "Unpasteurized dairy and soft cheeses (brie, camembert, queso fresco, gorgonzola)",
                    "Raw sprouts (listeria risk)",
                    "High-mercury fish: shark, swordfish, king mackerel, tilefish, bigeye tuna",
                  ].map((item, i) => (
                    <li key={i} className="text-white/85 text-xs flex items-start gap-2">
                      <span className="text-red-400 flex-shrink-0 mt-0.5">✗</span> {item}
                    </li>
                  ))}
                </ul>
                <p className="text-white/60 text-xs mt-2">Source: FDA, CDC, EPA, ACOG</p>
              </div>

              {/* Mercury tiers */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <p className="text-blue-300 text-sm font-semibold">Fish &amp; Mercury Guide</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-green-300 text-xs font-semibold mb-1">✓ Preferred (2–3 servings/week safe)</p>
                    <p className="text-white/80 text-xs">{MERCURY_PREFERRED.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="text-yellow-300 text-xs font-semibold mb-1">⚠ Limit (max 6 oz/week)</p>
                    <p className="text-white/80 text-xs">{MERCURY_LIMIT.join(" · ")}</p>
                  </div>
                  <div>
                    <p className="text-red-300 text-xs font-semibold mb-1">✗ Avoid entirely</p>
                    <p className="text-white/80 text-xs">{MERCURY_AVOID.join(" · ")}</p>
                  </div>
                </div>
                <p className="text-white/60 text-xs mt-2">Source: FDA/EPA</p>
              </div>

              {/* Listeria guide */}
              <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <p className="text-amber-300 text-sm font-semibold">Listeria Risk Foods</p>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "Deli meats — heat to 165°F (steaming hot) before eating",
                    "Refrigerated pâtés and meat spreads",
                    "Soft cheeses made with unpasteurized milk",
                    "Refrigerated smoked seafood",
                    "Raw sprouts (alfalfa, bean, clover, radish)",
                    "Unpasteurized milk and juice",
                  ].map((item, i) => (
                    <li key={i} className="text-white/85 text-xs flex items-start gap-2">
                      <span className="text-amber-400 flex-shrink-0 mt-0.5">⚠</span> {item}
                    </li>
                  ))}
                </ul>
                <p className="text-white/60 text-xs mt-2">Source: CDC, FDA</p>
              </div>

              {/* Safe cheeses */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <p className="text-green-300 text-xs font-semibold mb-1.5">✓ Safe Cheeses (Pasteurized)</p>
                <p className="text-white/80 text-xs">
                  Cheddar, mozzarella, Swiss, Parmesan, Colby, American, pasteurized ricotta, pasteurized cottage cheese, cream cheese, hard cheeses in general.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-white/75 text-xs leading-relaxed">
                  Food safety guidance is based on FDA, CDC, EPA, and ACOG guidelines. When in doubt about a specific food, consult your OB/GYN or midwife.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Setup modal */}
      <PregnancySupportSetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onSaved={({ stage, dueDate }) => {
          loadPregnancyContext();
        }}
      />
    </div>
  );
}
