import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Utensils,
  MessageCircle,
  Sprout,
  Baby,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";

// ── Types ─────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

interface DbChild {
  id: string;
  name: string;
  age_stage: DevelopmentalStage;
  emoji: string;
  date_of_birth?: string | null;
  allergies: any[];
  dietary_preferences: string[];
  medical_conditions: string[];
  feeding_concerns: string[];
  sensory_issues: string[];
  dislikes: string[];
  cultural_preferences?: string | null;
  created_at?: string;
}

// ── Stage Labels ──────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<DevelopmentalStage, string> = {
  early_infant: "Early Infant",
  beginning_foods: "Beginning Foods",
  young_toddler: "Young Toddler",
  toddler: "Toddler",
  preschool: "Preschool",
  early_school_age: "Early School Age",
  growing_child: "Growing Child",
};

const STAGES: { id: DevelopmentalStage; label: string; ageRange: string }[] = [
  { id: "early_infant",     label: "Early Infant",      ageRange: "Birth–~5 months" },
  { id: "beginning_foods",  label: "Beginning Foods",   ageRange: "~6–11 months" },
  { id: "young_toddler",    label: "Young Toddler",     ageRange: "12–23 months" },
  { id: "toddler",          label: "Toddler",           ageRange: "2–3 years" },
  { id: "preschool",        label: "Preschool",         ageRange: "4–5 years" },
  { id: "early_school_age", label: "Early School Age",  ageRange: "6–8 years" },
  { id: "growing_child",    label: "Growing Child",     ageRange: "9–12 years" },
];

const EMOJI_OPTIONS = ["👶", "👧", "👦", "🧒", "🧒‍♀️", "🧒‍♂️", "🍼", "⭐"];

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";

// ── Today's Tips ──────────────────────────────────────────────────────────────

const STAGE_TIPS: Record<DevelopmentalStage, string> = {
  early_infant:
    "Breast milk or formula is all your baby needs right now. Every feeding is a moment of connection — you're doing great.",
  beginning_foods:
    "Single-ingredient purées one at a time makes it easy to spot sensitivities. Texture variety now builds adventurous eaters later.",
  young_toddler:
    "Children this age often need 10–15 exposures to a new food before accepting it. Tonight's rejection isn't permanent.",
  toddler:
    "Packing one familiar food and one new food together is a simple way to build variety without overwhelming children.",
  preschool:
    "Children often need 10–15 exposures to a new food before accepting it. Tonight's rejection isn't permanent.",
  early_school_age:
    "Many children eat more on active days and less on quiet ones — that's normal. A week-level view is more useful than a single meal.",
  growing_child:
    "Protein needs increase meaningfully during growth spurts. If your child is suddenly always hungry, their body is working hard.",
};

// ── Section Cards ─────────────────────────────────────────────────────────────

interface SectionCard {
  id: string;
  emoji: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  route: string;
  accentColor: string;
  borderColor: string;
  glowColor: string;
}

const SECTION_CARDS: SectionCard[] = [
  {
    id: "create-meal",
    emoji: "🍽",
    icon: Utensils,
    title: "Create a Meal",
    subtitle: "Make something delicious for this stage",
    route: "/lifestyle/my-perfect-beginning/create-meal",
    accentColor: "text-emerald-400",
    borderColor: "border-emerald-500/30 hover:border-emerald-400/50",
    glowColor: "rgba(52,211,153,0.5)",
  },
  {
    id: "parents-corner",
    emoji: "🧑‍🍼",
    icon: MessageCircle,
    title: "Parent's Corner",
    subtitle: "Your trusted nutrition guide for every stage",
    route: "/lifestyle/my-perfect-beginning/parents-corner",
    accentColor: "text-amber-400",
    borderColor: "border-amber-500/30 hover:border-amber-400/50",
    glowColor: "rgba(251,191,36,0.5)",
  },
];

// ── Add Child Form ─────────────────────────────────────────────────────────────

interface AddChildFormProps {
  onSave: (child: DbChild) => void;
  onCancel: () => void;
}

function AddChildForm({ onSave, onCancel }: AddChildFormProps) {
  const [name, setName] = useState("");
  const [ageStage, setAgeStage] = useState<DevelopmentalStage>("toddler");
  const [emoji, setEmoji] = useState("👶");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Please enter a name."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/my-perfect-beginning/children"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), age_stage: ageStage, emoji }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onSave(data.child);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-emerald-500/15 px-3 py-3 space-y-3">
      <p className="text-[11px] text-emerald-400/70 font-semibold uppercase tracking-wide">
        Add Child Profile
      </p>

      {/* Emoji picker */}
      <div className="flex flex-wrap gap-2">
        {EMOJI_OPTIONS.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${
              emoji === e
                ? "bg-emerald-500/30 border border-emerald-400/50 ring-1 ring-emerald-400/30"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Child's nickname or name"
        maxLength={40}
        className="w-full bg-black/40 text-white text-sm border border-white/15 rounded-xl px-3 py-2 placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
      />

      {/* Age stage */}
      <select
        value={ageStage}
        onChange={e => setAgeStage(e.target.value as DevelopmentalStage)}
        className="w-full bg-black/40 text-white text-sm border border-white/15 rounded-xl px-3 py-2 focus:border-emerald-400/50 focus:outline-none"
      >
        {STAGES.map(s => (
          <option key={s.id} value={s.id}>
            {s.label} ({s.ageRange})
          </option>
        ))}
      </select>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-xs font-semibold transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save Profile"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyPerfectBeginningPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("My Perfect Beginning");

  // DB-backed child state
  const [children, setChildren] = useState<DbChild[]>([]);
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY) ?? ""; } catch { return ""; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeChild = children.find(c => c.id === activeId) ?? children[0] ?? null;

  // Load children from API on mount
  const loadChildren = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/my-perfect-beginning/children"), {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: DbChild[] = data.children ?? [];
      setChildren(list);

      // Restore persisted active child or default to first
      const savedId = (() => { try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; } })();
      if (savedId && list.find(c => c.id === savedId)) {
        setActiveId(savedId);
      } else if (list.length > 0) {
        setActiveId(list[0].id);
        try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, list[0].id); } catch {}
      }
    } catch (err) {
      console.error("[MPB hub] Failed to load children:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    document.title = "My Perfect Beginning | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Persist active child ID to localStorage
  useEffect(() => {
    if (activeId) {
      try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, activeId); } catch {}
    }
  }, [activeId]);

  // Close switcher on outside tap
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
        setShowAddForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const handleSwitch = (id: string) => {
    setActiveId(id);
    setSwitcherOpen(false);
    setShowAddForm(false);
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, id); } catch {}
  };

  const handleChildSaved = (child: DbChild) => {
    setChildren(prev => [...prev, child]);
    setActiveId(child.id);
    setSwitcherOpen(false);
    setShowAddForm(false);
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, child.id); } catch {}
  };

  const tip = activeChild
    ? (STAGE_TIPS[activeChild.age_stage] ?? STAGE_TIPS["toddler"])
    : STAGE_TIPS["toddler"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="min-h-screen bg-gradient-to-br from-[#0d1a12] via-[#0f1f18] to-[#0a1510] pb-36"
    >
      {/* ── Mobile sticky header ── */}
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-lg border-b border-emerald-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 pt-2 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-1.5 rounded-lg bg-white/10 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-emerald-400" />
              <h1 className="text-base font-bold text-white">My Perfect Beginning</h1>
            </div>
          </div>
        </div>
      )}

      <div
        className="max-w-2xl mx-auto px-4"
        style={{
          paddingTop: isDesktop
            ? "2rem"
            : "calc(env(safe-area-inset-top, 0px) + 5.5rem)",
        }}
      >

        {/* ── Hero banner ── */}
        <div className="relative rounded-2xl overflow-hidden mb-5 border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 via-teal-950/50 to-black" />
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg viewBox="0 0 400 140" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
              <circle cx="340" cy="30" r="55" fill="rgba(52,211,153,0.4)" />
              <circle cx="380" cy="110" r="35" fill="rgba(20,184,166,0.3)" />
              <circle cx="60" cy="120" r="40" fill="rgba(52,211,153,0.2)" />
              <circle cx="20" cy="30" r="28" fill="rgba(20,184,166,0.25)" />
            </svg>
          </div>
          <div className="relative px-5 py-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full mb-3">
              <Sprout className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-200 text-[10px] font-semibold tracking-wide">
                Child Nutrition Intelligence™
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5">
              Healthy beginnings, one meal at a time.
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Nutrition built around your child's stage, tastes, and needs —
              without stealing childhood from the child.
            </p>
          </div>
        </div>

        {/* ── Active child display + switcher ── */}
        <div className="mb-5" ref={switcherRef}>
          <div className="rounded-2xl bg-black/40 border border-emerald-500/25 overflow-hidden">
            {/* Child strip */}
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-lg">
                {isLoading
                  ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                  : (activeChild?.emoji ?? "👶")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase mb-0.5">
                  Currently Helping
                </p>
                {isLoading ? (
                  <p className="text-white/40 text-sm">Loading profiles…</p>
                ) : activeChild ? (
                  <p className="text-white font-semibold text-sm truncate">
                    {activeChild.name}
                    <span className="text-white/50 font-normal">
                      {" · "}{STAGE_LABELS[activeChild.age_stage]}
                    </span>
                  </p>
                ) : (
                  <p className="text-white/50 text-sm">No child profile yet</p>
                )}
              </div>
              <button
                onClick={() => { setSwitcherOpen(o => !o); setShowAddForm(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-all active:scale-95"
              >
                {children.length > 0 ? "Switch" : "Add"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${switcherOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Switcher panel */}
            <AnimatePresence>
              {switcherOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  {!showAddForm && (
                    <div className="border-t border-emerald-500/15 px-3 py-2 space-y-1">
                      {children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => handleSwitch(child.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                            child.id === activeId
                              ? "bg-emerald-500/20 border border-emerald-400/30"
                              : "hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          <span className="text-xl flex-shrink-0">{child.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">
                              {child.name}
                            </p>
                            <p className="text-white/50 text-xs">
                              {STAGE_LABELS[child.age_stage]}
                            </p>
                          </div>
                          {child.id === activeId && (
                            <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}

                      {/* Add child button */}
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-emerald-500/25 hover:border-emerald-400/40 transition-all text-left hover:bg-emerald-500/5"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0">
                          <Plus className="h-3.5 w-3.5 text-white/50" />
                        </div>
                        <p className="text-white/50 text-sm">Add Child Nutrition Profile</p>
                      </button>
                    </div>
                  )}

                  {showAddForm && (
                    <AddChildForm
                      onSave={handleChildSaved}
                      onCancel={() => setShowAddForm(false)}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Today's Tip ── */}
        <div className="mb-5">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-black border border-emerald-400/20 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 mt-0.5">
                <Sprout className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase mb-1">
                  Today's Tip
                  {activeChild && (
                    <span className="text-emerald-400/50 normal-case font-normal">
                      {" · "}{STAGE_LABELS[activeChild.age_stage]}
                    </span>
                  )}
                </p>
                <p className="text-sm text-white/85 leading-relaxed">{tip}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section header ── */}
        {activeChild && (
          <div className="mb-3 px-1">
            <p className="text-xs text-white/40 leading-relaxed">
              Helping <span className="text-emerald-300 font-semibold">{activeChild.name}</span> build healthy habits
            </p>
          </div>
        )}

        {/* ── No child prompt ── */}
        {!isLoading && children.length === 0 && (
          <div className="mb-5 rounded-2xl bg-emerald-900/20 border border-emerald-500/20 px-5 py-6 text-center">
            <div className="text-3xl mb-3">👶</div>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Add your first child's profile to get personalized meal ideas and nutrition guidance.
            </p>
            <button
              onClick={() => { setSwitcherOpen(true); setShowAddForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Child Profile
            </button>
          </div>
        )}

        {/* ── Section cards ── */}
        <div className="space-y-3 mb-6">
          {SECTION_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="relative">
                <div
                  className="pointer-events-none absolute -inset-0.5 rounded-2xl blur-sm opacity-40"
                  style={{
                    background: `radial-gradient(100% 100% at 0% 0%, ${card.glowColor}, transparent)`,
                  }}
                />
                <button
                  onClick={() => setLocation(card.route)}
                  className={`relative w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-black/50 border ${card.borderColor} transition-all duration-200 active:scale-[0.98] hover:bg-black/60 text-left`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-xl leading-none">{card.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${card.accentColor} mb-0.5`}>
                      {card.title}
                    </p>
                    <p className="text-xs text-white/55 leading-relaxed truncate">
                      {card.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/25 flex-shrink-0" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
