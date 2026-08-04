import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Utensils,
  MessageCircle,
  User,
  Map,
  Heart,
  ShoppingBag,
  Shield,
  BookOpen,
  Sprout,
  Baby,
} from "lucide-react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// ── Types ─────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

interface MockChild {
  id: string;
  nickname: string;
  age: number; // years, approximate
  stage: DevelopmentalStage;
  emoji: string;
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

// ── Mock Data ─────────────────────────────────────────────────────────────────

const INITIAL_CHILDREN: MockChild[] = [
  { id: "mock-1", nickname: "Emma", age: 4, stage: "preschool", emoji: "👧" },
];

const SESSION_KEY = "mpb.activeChild.v1";
const SESSION_CHILDREN_KEY = "mpb.children.v1";

// ── Today's Tips (static placeholder — rotates by stage in Phase 2) ───────────

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
  {
    id: "profile",
    emoji: "👶",
    icon: User,
    title: "Child Nutrition Profile",
    subtitle: "Build and update your child's full profile",
    route: "/lifestyle/my-perfect-beginning/profile",
    accentColor: "text-sky-400",
    borderColor: "border-sky-500/30 hover:border-sky-400/50",
    glowColor: "rgba(56,189,248,0.5)",
  },
  {
    id: "journey",
    emoji: "🌱",
    icon: Map,
    title: "The Journey",
    subtitle: "Where you are right now — and what's ahead",
    route: "/lifestyle/my-perfect-beginning/journey",
    accentColor: "text-teal-400",
    borderColor: "border-teal-500/30 hover:border-teal-400/50",
    glowColor: "rgba(45,212,191,0.5)",
  },
  {
    id: "better-favorites",
    emoji: "🎂",
    icon: Heart,
    title: "Better Favorites",
    subtitle: "Healthier versions of foods they already love",
    route: "/lifestyle/my-perfect-beginning/better-favorites",
    accentColor: "text-rose-400",
    borderColor: "border-rose-500/30 hover:border-rose-400/50",
    glowColor: "rgba(251,113,133,0.5)",
  },
  {
    id: "lunchbox",
    emoji: "🎒",
    icon: ShoppingBag,
    title: "Lunchbox Builder",
    subtitle: "Pack the perfect lunch for school, sports, or travel",
    route: "/lifestyle/my-perfect-beginning/lunchbox",
    accentColor: "text-orange-400",
    borderColor: "border-orange-500/30 hover:border-orange-400/50",
    glowColor: "rgba(251,146,60,0.5)",
  },
  {
    id: "nutrition-support",
    emoji: "❤️",
    icon: Shield,
    title: "Nutrition Support",
    subtitle: "Allergies, celiac, T1D, and specialized protocols",
    route: "/lifestyle/my-perfect-beginning/nutrition-support",
    accentColor: "text-violet-400",
    borderColor: "border-violet-500/30 hover:border-violet-400/50",
    glowColor: "rgba(167,139,250,0.5)",
  },
  {
    id: "growth",
    emoji: "📚",
    icon: BookOpen,
    title: "Growth & Development",
    subtitle: "Learn about this stage and what's coming next",
    route: "/lifestyle/my-perfect-beginning/growth",
    accentColor: "text-cyan-400",
    borderColor: "border-cyan-500/30 hover:border-cyan-400/50",
    glowColor: "rgba(34,211,238,0.5)",
  },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function loadChildren(): MockChild[] {
  try {
    const raw = sessionStorage.getItem(SESSION_CHILDREN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_CHILDREN;
}

function saveChildren(children: MockChild[]) {
  try {
    sessionStorage.setItem(SESSION_CHILDREN_KEY, JSON.stringify(children));
  } catch {}
}

function loadActiveId(children: MockChild[]): string {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && children.find(c => c.id === saved)) return saved;
  } catch {}
  return children[0]?.id ?? "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyPerfectBeginningPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();

  // Session-only child list (Phase 1 — no DB)
  const [children, setChildren] = useState<MockChild[]>(() => loadChildren());
  const [activeId, setActiveId] = useState<string>(() =>
    loadActiveId(loadChildren())
  );
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeChild = children.find(c => c.id === activeId) ?? children[0];

  // Persist across same session
  useEffect(() => {
    saveChildren(children);
  }, [children]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, activeId);
    } catch {}
  }, [activeId]);

  useEffect(() => {
    document.title = "My Perfect Beginning | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Close switcher on outside tap
  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const handleSwitch = (id: string) => {
    setActiveId(id);
    setSwitcherOpen(false);
  };

  const handleAddChild = () => {
    setSwitcherOpen(false);
    setLocation("/lifestyle/my-perfect-beginning/profile?new=1");
  };

  const tip = activeChild ? STAGE_TIPS[activeChild.stage] : STAGE_TIPS["preschool"];

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
        {/* ── Desktop back nav ── */}
        {isDesktop && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-1.5 rounded-lg bg-white/10 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Baby className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">My Perfect Beginning</h1>
          </div>
        )}

        {/* ── Hero banner ── */}
        <div className="relative rounded-2xl overflow-hidden mb-5 border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 via-teal-950/50 to-black" />
          {/* Soft organic shapes */}
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
                {activeChild?.emoji ?? "👶"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase mb-0.5">
                  Currently Helping
                </p>
                {activeChild ? (
                  <p className="text-white font-semibold text-sm truncate">
                    {activeChild.nickname}
                    <span className="text-white/50 font-normal">
                      {" · "}Age {activeChild.age}
                      {" · "}
                      {STAGE_LABELS[activeChild.stage]}
                    </span>
                  </p>
                ) : (
                  <p className="text-white/50 text-sm">No child profile yet</p>
                )}
              </div>
              <button
                onClick={() => setSwitcherOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-all active:scale-95"
              >
                Switch Child
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
                            {child.nickname}
                          </p>
                          <p className="text-white/50 text-xs">
                            Age {child.age} · {STAGE_LABELS[child.stage]}
                          </p>
                        </div>
                        {child.id === activeId && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    ))}

                    {/* Add child */}
                    <button
                      onClick={handleAddChild}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-emerald-500/25 hover:border-emerald-400/40 transition-all text-left hover:bg-emerald-500/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-3.5 w-3.5 text-white/50" />
                      </div>
                      <p className="text-white/50 text-sm">Add Child Nutrition Profile</p>
                    </button>
                  </div>
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
                      {" · "}{STAGE_LABELS[activeChild.stage]}
                    </span>
                  )}
                </p>
                <p className="text-sm text-white/85 leading-relaxed">{tip}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Parent's Corner header ── */}
        {activeChild && (
          <div className="mb-3 px-1">
            <p className="text-xs text-white/40 leading-relaxed">
              Helping <span className="text-emerald-300 font-semibold">{activeChild.nickname}</span> build healthy habits
            </p>
          </div>
        )}

        {/* ── Section cards ── */}
        <div className="space-y-3 mb-6">
          {SECTION_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.id} className="relative">
                {/* Subtle glow */}
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

        {/* ── Phase note ── */}
        <div className="rounded-xl bg-black/20 border border-white/6 px-4 py-3 mb-4">
          <p className="text-xs text-white/30 leading-relaxed text-center">
            Child profiles are saved in this session. Full cloud sync coming in the next update.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
