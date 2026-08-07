import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronRight, Plus, Utensils,
  MessageCircle, User, Sprout, Baby, Loader2, Trash2, Pencil,
  Users, Scan,
} from "lucide-react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/apiRequest";

// ── Types ─────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant" | "beginning_foods" | "young_toddler"
  | "toddler" | "preschool" | "early_school_age" | "growing_child";

interface DbChild {
  id: string;
  name: string;
  age_stage: DevelopmentalStage;
  emoji: string;
  date_of_birth?: string | null;
  allergies: any[];
  allergy_details?: any[];
  dietary_preferences: string[];
  medical_conditions: string[];
  feeding_concerns: string[];
  sensory_issues: string[];
  dislikes: any;
  cultural_preferences?: string | null;
  school_safe_required?: boolean;
  pediatrician_oversight?: boolean;
  medication_affects_appetite?: boolean;
  g_tube?: boolean;
  created_at?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<DevelopmentalStage, string> = {
  early_infant: "Early Infant",
  beginning_foods: "Beginning Foods",
  young_toddler: "Young Toddler",
  toddler: "Toddler",
  preschool: "Preschool",
  early_school_age: "Early School Age",
  growing_child: "Growing Child",
};

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

const GENERAL_TIP =
  "General Children's Mode uses baseline healthy pediatric guidance. Confirm allergies and medical needs for every child being served.";

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";
const GENERAL_SENTINEL = "GENERAL";

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyPerfectBeginningPage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("My Perfect Beginning");

  const [children, setChildren] = useState<DbChild[]>([]);
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY) ?? ""; } catch { return ""; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const isGeneral = activeId === GENERAL_SENTINEL;
  const activeChild = isGeneral
    ? null
    : (children.find(c => c.id === activeId) ?? (children.length > 0 ? children[0] : null));

  // Load children
  const loadChildren = useCallback(async () => {
    try {
      const data = await apiRequest(apiUrl("/api/my-perfect-beginning/children"));
      const list: DbChild[] = data.children ?? [];
      setChildren(list);

      const savedId = (() => { try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; } })();
      if (savedId === GENERAL_SENTINEL) {
        setActiveId(GENERAL_SENTINEL);
      } else if (savedId && list.find(c => c.id === savedId)) {
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

  useEffect(() => { loadChildren(); }, [loadChildren]);

  useEffect(() => {
    document.title = "My Perfect Beginning | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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
        setDeleteConfirm(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const handleSwitch = (id: string) => {
    setActiveId(id);
    setSwitcherOpen(false);
    setDeleteConfirm(null);
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, id); } catch {}
  };

  const handleEditChild = (child: DbChild) => {
    // Set as active then navigate to profile page
    setActiveId(child.id);
    try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, child.id); } catch {}
    setSwitcherOpen(false);
    setLocation("/lifestyle/my-perfect-beginning/profile");
  };

  const handleDeleteChild = async (id: string) => {
    setDeleting(true);
    try {
      await apiRequest(apiUrl(`/api/my-perfect-beginning/children/${id}`), {
        method: "DELETE",
      });
      const remaining = children.filter(c => c.id !== id);
      setChildren(remaining);
      if (activeId === id) {
        const next = remaining[0]?.id ?? "";
        setActiveId(next);
        try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, next || GENERAL_SENTINEL); } catch {}
      }
      setDeleteConfirm(null);
    } catch (err) {
      console.error("[MPB hub] Delete error:", err);
    } finally {
      setDeleting(false);
    }
  };

  // Profile completion status
  const profileStatus = (() => {
    if (isGeneral || !activeChild) return null;
    const hasCore = activeChild.name && activeChild.age_stage;
    const hasDetail =
      (activeChild.allergies?.length ?? 0) > 0 ||
      (activeChild.dietary_preferences?.length ?? 0) > 0 ||
      (activeChild.medical_conditions?.length ?? 0) > 0 ||
      activeChild.cultural_preferences;
    if (hasCore && hasDetail) return "Complete";
    if (hasCore) return "In progress";
    return "Not started";
  })();

  const tip = isGeneral
    ? GENERAL_TIP
    : (activeChild ? (STAGE_TIPS[activeChild.age_stage] ?? STAGE_TIPS["toddler"]) : STAGE_TIPS["toddler"]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="min-h-screen pb-36"
      style={{
        backgroundImage: "linear-gradient(rgba(2,14,8,0.78), rgba(1,10,5,0.74)), url('/images/mpb-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Mobile sticky header */}
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-lg border-b border-emerald-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 pt-2 flex items-center gap-3">
            <button onClick={() => setLocation("/lifestyle")} className="p-1.5 rounded-lg bg-white/10 text-white">
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
        style={{ paddingTop: isDesktop ? "2rem" : "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Hero banner */}
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
            <p className="text-sm text-white leading-relaxed">
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
                  : isGeneral
                  ? <Users className="h-4 w-4 text-emerald-400" />
                  : (activeChild?.emoji ?? "👶")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase mb-0.5">
                  Preparing meals for
                </p>
                {isLoading ? (
                  <p className="text-white text-sm">Loading profiles…</p>
                ) : isGeneral ? (
                  <p className="text-white font-semibold text-sm">
                    General Children's Meal
                    <span className="text-white font-normal text-xs ml-1">· No specific child</span>
                  </p>
                ) : activeChild ? (
                  <p className="text-white font-semibold text-sm truncate">
                    {activeChild.name}
                    <span className="text-white font-normal">
                      {" / "}{STAGE_LABELS[activeChild.age_stage]}
                    </span>
                  </p>
                ) : (
                  <p className="text-white text-sm">No child profile yet</p>
                )}
              </div>
              <button
                onClick={() => { setSwitcherOpen(o => !o); setDeleteConfirm(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-all active:scale-95"
              >
                {children.length > 0 || isGeneral ? "Switch" : "Add"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
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

                    {/* Child rows */}
                    {children.map(child => (
                      <div key={child.id}>
                        {deleteConfirm === child.id ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-900/20 border border-red-500/30">
                            <p className="flex-1 text-xs text-red-300">Remove {child.name}?</p>
                            <button
                              onClick={() => handleDeleteChild(child.id)}
                              disabled={deleting}
                              className="px-2.5 py-1 rounded-lg bg-red-500/30 border border-red-400/40 text-red-200 text-xs font-semibold"
                            >
                              {deleting ? "…" : "Remove"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all ${
                            child.id === activeId && !isGeneral
                              ? "bg-emerald-500/20 border border-emerald-400/30"
                              : "border border-transparent hover:bg-white/5"
                          }`}>
                            <button
                              onClick={() => handleSwitch(child.id)}
                              className="flex items-center gap-3 flex-1 text-left min-w-0"
                            >
                              <span className="text-xl flex-shrink-0">{child.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{child.name}</p>
                                <p className="text-white text-xs">{STAGE_LABELS[child.age_stage]}</p>
                              </div>
                              {child.id === activeId && !isGeneral && (
                                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                              )}
                            </button>
                            {/* Edit / Delete */}
                            <button
                              onClick={() => handleEditChild(child)}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:text-sky-300 hover:bg-sky-500/10 transition-all"
                              title={`Edit ${child.name}'s profile`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(child.id)}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:text-red-300 hover:bg-red-500/10 transition-all"
                              title={`Remove ${child.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* General Children's Mode */}
                    <button
                      onClick={() => handleSwitch(GENERAL_SENTINEL)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        isGeneral
                          ? "bg-sky-500/15 border border-sky-400/30"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-400/20 flex items-center justify-center flex-shrink-0">
                        <Users className="h-3.5 w-3.5 text-sky-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">General Children's Meal</p>
                        <p className="text-white text-xs">Birthday party, classroom, sleepover…</p>
                      </div>
                      {isGeneral && <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />}
                    </button>

                    {/* Add Child Profile */}
                    <button
                      onClick={() => {
                        setSwitcherOpen(false);
                        setLocation("/lifestyle/my-perfect-beginning/profile");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-emerald-500/25 hover:border-emerald-400/40 transition-all text-left hover:bg-emerald-500/5"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center flex-shrink-0">
                        <Plus className="h-3.5 w-3.5 text-white" />
                      </div>
                      <p className="text-white text-sm">Add Child Nutrition Profile</p>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* General mode notice */}
        {isGeneral && (
          <div className="mb-5 rounded-xl bg-sky-900/20 border border-sky-500/25 px-4 py-3">
            <p className="text-xs text-sky-200/80 leading-relaxed">
              <span className="font-semibold text-sky-300">General Children's Mode</span> — Meals use baseline healthy
              child nutrition and preparation guidance. Confirm allergies and medical needs for every child being served.
            </p>
          </div>
        )}

        {/* No child prompt */}
        {!isLoading && children.length === 0 && !isGeneral && (
          <div className="mb-5 rounded-2xl bg-emerald-900/20 border border-emerald-500/20 px-5 py-6 text-center">
            <div className="text-3xl mb-3">👶</div>
            <p className="text-sm text-white leading-relaxed mb-4">
              Add your first child's profile to get personalized meal ideas and nutrition guidance.
            </p>
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning/profile")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create Child Profile
            </button>
          </div>
        )}

        {/* Section cards */}
        <div className="space-y-3 mb-5">
          {SECTION_CARDS.map(card => {
            const Icon = card.icon;
            const isProfile = card.id === "profile";
            const statusLabel = isProfile ? profileStatus : null;
            const statusColor =
              profileStatus === "Complete"
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                : profileStatus === "In progress"
                ? "bg-amber-500/15 border-amber-400/30 text-amber-300"
                : "bg-white/8 border-white/12 text-white";
            return (
              <div key={card.id} className="relative">
                <div
                  className="pointer-events-none absolute -inset-0.5 rounded-2xl blur-sm opacity-40"
                  style={{ background: `radial-gradient(100% 100% at 0% 0%, ${card.glowColor}, transparent)` }}
                />
                <button
                  onClick={() => setLocation(card.route)}
                  className={`relative w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-black/50 border ${card.borderColor} transition-all duration-200 active:scale-[0.98] hover:bg-black/60 text-left`}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-xl leading-none">{card.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${card.accentColor} mb-0.5`}>{card.title}</p>
                    <p className="text-xs text-white leading-relaxed truncate">{card.subtitle}</p>
                    {statusLabel && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white flex-shrink-0" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Today's Tip */}
        <div className="mb-5">
          <div className="rounded-2xl bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-black border border-emerald-400/20 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 rounded-xl bg-emerald-500/15 border border-emerald-400/20 mt-0.5">
                <Sprout className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase mb-1">
                  Today's Tip
                  {!isGeneral && activeChild && (
                    <span className="text-emerald-400/50 normal-case font-normal">
                      {" · "}{STAGE_LABELS[activeChild.age_stage]}
                    </span>
                  )}
                  {isGeneral && (
                    <span className="text-sky-400/50 normal-case font-normal"> · General Mode</span>
                  )}
                </p>
                <p className="text-sm text-white leading-relaxed">{tip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
