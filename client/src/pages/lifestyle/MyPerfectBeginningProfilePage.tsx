import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Baby, Check, Loader2, Plus, X, AlertTriangle,
  Utensils, Heart, Activity, School, ChefHat, Stethoscope,
} from "lucide-react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/apiRequest";
import { PillButton, type PillButtonVariant } from "@/components/ui/pill-button";

// ── Multi-select pill group (toggle on/off) ───────────────────────────────────
function MultiPillSelect({
  options,
  selected,
  onChange,
  variant = "emerald",
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  variant?: PillButtonVariant;
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter(s => s !== opt)
        : [...selected, opt],
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <PillButton
          key={opt}
          active={selected.includes(opt)}
          variant={variant}
          onClick={() => toggle(opt)}
        >
          {opt}
        </PillButton>
      ))}
    </div>
  );
}

// ── Single-select pill group ──────────────────────────────────────────────────
function PillSelect<T extends string | number>({
  options,
  value,
  onChange,
  variant = "emerald",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: PillButtonVariant;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <PillButton
          key={String(opt.value)}
          active={value === opt.value}
          variant={variant}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </PillButton>
      ))}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type DevelopmentalStage =
  | "early_infant" | "beginning_foods" | "young_toddler"
  | "toddler" | "preschool" | "early_school_age" | "growing_child";

const STAGES: { id: DevelopmentalStage; label: string; ageRange: string }[] = [
  { id: "early_infant",     label: "Early Infant",      ageRange: "Birth – ~5 months" },
  { id: "beginning_foods",  label: "Beginning Foods",   ageRange: "~6 – 11 months" },
  { id: "young_toddler",    label: "Young Toddler",     ageRange: "12 – 23 months" },
  { id: "toddler",          label: "Toddler",           ageRange: "2 – 3 years" },
  { id: "preschool",        label: "Preschool",         ageRange: "4 – 5 years" },
  { id: "early_school_age", label: "Early School Age",  ageRange: "6 – 8 years" },
  { id: "growing_child",    label: "Growing Child",     ageRange: "9 – 12 years" },
];

const EMOJI_OPTIONS = ["👶", "👧", "👦", "🧒", "🧒‍♀️", "🧒‍♂️", "🍼", "⭐", "🌟", "🌈"];

const LS_ACTIVE_CHILD_KEY = "mpb.activeChildId.v1";

const COMMON_ALLERGENS = [
  "Milk", "Egg", "Fish", "Shellfish", "Tree Nuts", "Peanut",
  "Wheat / Gluten", "Soy", "Sesame",
];

const SEVERITY_OPTIONS = [
  { value: "confirmed_allergy",       label: "Confirmed allergy" },
  { value: "clinician_elimination",   label: "Clinician-directed elimination" },
  { value: "suspected_allergy",       label: "Suspected allergy" },
  { value: "intolerance",             label: "Intolerance" },
  { value: "preference_avoidance",    label: "Preference / avoidance" },
];

const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Pescatarian", "Gluten-Free", "Dairy-Free",
  "Egg-Free", "Nut-Free", "Halal", "Kosher", "Low-Sugar",
];

const TEXTURE_LEVELS = [
  { value: "puree",      label: "Puréed / smooth" },
  { value: "mashed",     label: "Mashed / soft lumps" },
  { value: "soft",       label: "Soft pieces" },
  { value: "chopped",    label: "Chopped / minced" },
  { value: "regular",    label: "Regular / family texture" },
];

const COMMON_CONDITIONS = [
  "Celiac disease", "Type 1 Diabetes", "Type 2 Diabetes", "Iron deficiency anemia",
  "Failure to thrive", "Obesity / overweight concerns", "GERD / reflux",
  "Eczema", "Autism spectrum", "ARFID", "PKU",
  "Food protein-induced enterocolitis (FPIES)", "Eosinophilic esophagitis",
];

const SENSORY_OPTIONS = [
  "Texture sensitivity", "Strong smell aversion", "Mixed-food aversion",
  "Prefers separate foods on plate", "Limited food variety / food neophobia",
  "Oral motor difficulties", "Hypersensitive gag reflex",
];

interface AllergyDetail {
  allergen: string;
  severity: string;
  epinephrinePrescribed: boolean;
  crossContactConcern: boolean;
  clinicianInstructions: string;
}

interface FeedingAbility {
  textureLevel: string;
  swallowingDifficulty: boolean;
  hasFeedingTube: boolean;
  historyOfChokingOrGagging: boolean;
}

interface ChildProfile {
  id?: string;
  name: string;
  age_stage: DevelopmentalStage;
  date_of_birth: string;
  emoji: string;
  // Allergies
  allergies: string[];
  allergy_details: AllergyDetail[];
  // Medical
  medical_conditions: string[];
  // Feeding
  feeding_concerns: string[];
  feeding_ability: FeedingAbility;
  // Sensory & preferences
  sensory_issues: string[];
  dietary_preferences: string[];
  dislikes: string;  // stored as comma-separated text in the form; split to array on save
  cultural_preferences: string;
  // Growth
  growth_context: string;
  height_cm: string;
  weight_kg: string;
  pediatrician_oversight: boolean;
  // Kitchen
  school_safe_required: boolean;
  kitchen_budget: string;
  kitchen_time_minutes: number;
  kitchen_skill: string;
  // Clinical
  medication_affects_appetite: boolean;
  // g_tube is derived server-side from feeding_ability.hasFeedingTube; not a standalone UI field
  // Goals
  family_goals: string[];
}

const EMPTY_PROFILE: ChildProfile = {
  name: "",
  age_stage: "toddler",
  date_of_birth: "",
  emoji: "👶",
  allergies: [],
  allergy_details: [],
  medical_conditions: [],
  feeding_concerns: [],
  feeding_ability: { textureLevel: "regular", swallowingDifficulty: false, hasFeedingTube: false, historyOfChokingOrGagging: false },
  sensory_issues: [],
  dietary_preferences: [],
  dislikes: "",
  cultural_preferences: "",
  growth_context: "typical",
  height_cm: "",
  weight_kg: "",
  pediatrician_oversight: false,
  school_safe_required: false,
  kitchen_budget: "moderate",
  kitchen_time_minutes: 30,
  kitchen_skill: "intermediate",
  medication_affects_appetite: false,
  // g_tube omitted — derived from feeding_ability.hasFeedingTube on save
  family_goals: [],
} as any;

// ── Helpers ──────────────────────────────────────────────────────────────────


function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full border transition-colors flex-shrink-0 ${
          checked ? "bg-emerald-500 border-emerald-400" : "bg-white/10 border-white/20"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
      </button>
      <span className="text-sm text-white/80">{label}</span>
    </label>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function BoolPill({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-white">{label}</span>
      <div className="flex gap-2">
        <PillButton active={checked}  variant="emerald" onClick={() => onChange(true)}>Yes</PillButton>
        <PillButton active={!checked} variant="emerald" onClick={() => onChange(false)}>No</PillButton>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/20">
        <Icon className="h-4 w-4 text-emerald-400" />
      </div>
      <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function TagInput({
  tags, onAdd, onRemove, placeholder, suggestions = [],
}: {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const add = (val: string) => {
    const v = val.trim();
    if (v && !tags.includes(v)) { onAdd(v); setInput(""); }
  };
  return (
    <div className="space-y-2">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter(s => !tags.includes(s)).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onAdd(s)}
              className="px-2.5 py-1 rounded-full bg-white/5 border border-white/15 text-white text-xs hover:bg-emerald-500/15 hover:border-emerald-400/30 hover:text-emerald-200 transition-all"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          placeholder={placeholder}
          className="flex-1 bg-black/40 text-white text-sm border border-white/15 rounded-xl px-3 py-2 placeholder:text-white focus:border-emerald-400/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => add(input)}
          className="px-3 py-2 rounded-xl bg-emerald-600/30 border border-emerald-500/30 text-emerald-200 text-xs font-semibold"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 text-xs">
              {t}
              <button type="button" onClick={() => onRemove(t)}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MyPerfectBeginningProfilePage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("Child Nutrition Profile");

  const [profile, setProfile] = useState<ChildProfile>({ ...EMPTY_PROFILE });
  const [isNew, setIsNew] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [newAllergen, setNewAllergen] = useState({ allergen: "", severity: "confirmed_allergy", epinephrinePrescribed: false, crossContactConcern: false, clinicianInstructions: "" });
  const [showAllergenForm, setShowAllergenForm] = useState(false);

  const set = useCallback(<K extends keyof ChildProfile>(field: K, value: ChildProfile[K]) => {
    setProfile(p => ({ ...p, [field]: value }));
  }, []);

  const setFeeding = useCallback((field: keyof FeedingAbility, value: any) => {
    setProfile(p => ({ ...p, feeding_ability: { ...p.feeding_ability, [field]: value } }));
  }, []);

  // Load active child profile
  useEffect(() => {
    const activeId = (() => { try { return localStorage.getItem(LS_ACTIVE_CHILD_KEY); } catch { return null; } })();
    if (!activeId || activeId === "GENERAL") {
      setIsNew(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await apiRequest(apiUrl("/api/my-perfect-beginning/children"));
        const child = (data.children ?? []).find((c: any) => c.id === activeId);
        if (!child) { setIsNew(true); setLoading(false); return; }
        setIsNew(false);
        setProfile({
          id: child.id,
          name: child.name ?? "",
          age_stage: child.age_stage ?? "toddler",
          date_of_birth: child.date_of_birth ?? "",
          emoji: child.emoji ?? "👶",
          allergies: child.allergies ?? [],
          allergy_details: child.allergy_details ?? [],
          medical_conditions: child.medical_conditions ?? [],
          feeding_concerns: child.feeding_concerns ?? [],
          feeding_ability: child.feeding_ability ?? { textureLevel: "regular", swallowingDifficulty: false, hasFeedingTube: false, historyOfChokingOrGagging: false },
          sensory_issues: child.sensory_issues ?? [],
          dietary_preferences: child.dietary_preferences ?? [],
          dislikes: Array.isArray(child.dislikes) ? child.dislikes.join(", ") : (child.dislikes ?? ""),
          cultural_preferences: child.cultural_preferences ?? "",
          growth_context: child.growth_context ?? "typical",
          height_cm: child.height_cm != null ? String(child.height_cm) : "",
          weight_kg: child.weight_kg != null ? String(child.weight_kg) : "",
          pediatrician_oversight: !!child.pediatrician_oversight,
          school_safe_required: !!child.school_safe_required,
          kitchen_budget: child.kitchen_budget ?? "moderate",
          kitchen_time_minutes: child.kitchen_time_minutes ?? 30,
          kitchen_skill: child.kitchen_skill ?? "intermediate",
          medication_affects_appetite: !!child.medication_affects_appetite,
          // g_tube is not a standalone profile field; derived from feeding_ability.hasFeedingTube
          family_goals: Array.isArray(child.family_goals) ? child.family_goals : [],
        });
      } catch {
        setIsNew(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!profile.name.trim()) { setError("Child's name is required."); return; }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const dislikesArray = typeof profile.dislikes === "string"
        ? profile.dislikes.split(",").map(s => s.trim()).filter(Boolean)
        : profile.dislikes;
      const body = {
        ...profile,
        dislikes: dislikesArray,
        height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
        weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
      };
      const data = isNew
        ? await apiRequest(apiUrl("/api/my-perfect-beginning/children"), {
            method: "POST",
            body: JSON.stringify(body),
          })
        : await apiRequest(apiUrl(`/api/my-perfect-beginning/children/${profile.id}`), {
            method: "PATCH",
            body: JSON.stringify(body),
          });
      const saved = data.child ?? data;
      if (saved?.id) {
        setProfile(p => ({ ...p, id: saved.id }));
        setIsNew(false);
        try { localStorage.setItem(LS_ACTIVE_CHILD_KEY, saved.id); } catch {}
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const addAllergyDetail = () => {
    if (!newAllergen.allergen.trim()) return;
    const detail: AllergyDetail = { ...newAllergen, allergen: newAllergen.allergen.trim() };
    set("allergy_details", [...profile.allergy_details, detail]);
    // Also add to simple allergies list for backward compat
    if (!profile.allergies.includes(detail.allergen)) {
      set("allergies", [...profile.allergies, detail.allergen]);
    }
    setNewAllergen({ allergen: "", severity: "confirmed_allergy", epinephrinePrescribed: false, crossContactConcern: false, clinicianInstructions: "" });
    setShowAllergenForm(false);
  };

  const removeAllergyDetail = (allergen: string) => {
    set("allergy_details", profile.allergy_details.filter(a => a.allergen !== allergen));
    set("allergies", profile.allergies.filter(a => a !== allergen));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1a12] via-[#0f1f18] to-[#0a1510] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  const sectionClass = "rounded-2xl bg-black/40 border border-emerald-500/15 px-5 py-5 space-y-4";
  const inputClass = "w-full bg-black/40 text-white text-sm border border-white/15 rounded-xl px-3 py-2 placeholder:text-white focus:border-emerald-400/50 focus:outline-none";
  const labelClass = "block text-xs text-white mb-1 font-medium";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-40"
      style={{
        backgroundImage: "linear-gradient(rgba(2,14,8,0.78), rgba(1,10,5,0.74)), url('/images/mpb-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Mobile fixed header */}
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-lg border-b border-emerald-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 pt-2 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
              className="flex items-center gap-1.5 text-emerald-400 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>My Perfect Beginnings</span>
            </button>
          </div>
        </div>
      )}

      <div
        className="max-w-2xl mx-auto px-4 space-y-4"
        style={{ paddingTop: isDesktop ? "2rem" : "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
      >
        {/* Desktop inline back button */}
        {isDesktop && (
          <div className="mb-2">
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
              className="flex items-center gap-1.5 text-emerald-400 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to My Perfect Beginnings</span>
            </button>
          </div>
        )}

        {/* ── 1. Basic Info ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Baby} title="Basic Info" />

          {/* Emoji */}
          <div>
            <label className={labelClass}>Choose an icon</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => set("emoji", e)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    profile.emoji === e
                      ? "bg-emerald-500/30 border border-emerald-400/50"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={labelClass}>Name or nickname *</label>
            <input
              value={profile.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. Emma, Billy, Sprout"
              maxLength={40}
              className={inputClass}
            />
          </div>

          {/* Date of birth */}
          <div>
            <label className={labelClass}>Date of birth (optional)</label>
            <input
              type="date"
              value={profile.date_of_birth}
              onChange={e => set("date_of_birth", e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Age stage */}
          <div>
            <label className={labelClass}>Developmental stage *</label>
            <select
              value={profile.age_stage}
              onChange={e => set("age_stage", e.target.value as DevelopmentalStage)}
              className={inputClass}
            >
              {STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label} ({s.ageRange})</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── 2. Allergies ── */}
        <div className={sectionClass}>
          <SectionHeader icon={AlertTriangle} title="Allergies" />
          <p className="text-xs text-white -mt-2">
            Record confirmed allergies, suspected reactions, intolerances, and avoidances separately so the engine can apply the right level of caution.
          </p>

          {/* Existing allergy details */}
          {profile.allergy_details.map(a => (
            <div key={a.allergen} className="rounded-xl bg-white/5 border border-white/10 px-3 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{a.allergen}</span>
                <button type="button" onClick={() => removeAllergyDetail(a.allergen)}>
                  <X className="h-3.5 w-3.5 text-white hover:text-red-400" />
                </button>
              </div>
              <p className="text-xs text-white">
                {SEVERITY_OPTIONS.find(s => s.value === a.severity)?.label ?? a.severity}
                {a.epinephrinePrescribed && " · Epinephrine prescribed"}
                {a.crossContactConcern && " · Cross-contact concern"}
              </p>
              {a.clinicianInstructions && (
                <p className="text-xs text-amber-300/70 italic">"{a.clinicianInstructions}"</p>
              )}
            </div>
          ))}

          {/* Add allergen form */}
          {showAllergenForm ? (
            <div className="rounded-xl bg-emerald-900/20 border border-emerald-500/20 px-3 py-3 space-y-3">
              <div>
                <label className={labelClass}>Allergen</label>
                <input
                  value={newAllergen.allergen}
                  onChange={e => setNewAllergen(n => ({ ...n, allergen: e.target.value }))}
                  placeholder="e.g. Peanut, Milk, Sesame"
                  className={inputClass}
                  list="allergen-suggestions"
                />
                <datalist id="allergen-suggestions">
                  {COMMON_ALLERGENS.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div>
                <label className={labelClass}>Severity</label>
                <select
                  value={newAllergen.severity}
                  onChange={e => setNewAllergen(n => ({ ...n, severity: e.target.value }))}
                  className={inputClass}
                >
                  {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <BoolPill
                  checked={newAllergen.epinephrinePrescribed}
                  onChange={v => setNewAllergen(n => ({ ...n, epinephrinePrescribed: v }))}
                  label="Epinephrine (EpiPen) prescribed"
                />
                <BoolPill
                  checked={newAllergen.crossContactConcern}
                  onChange={v => setNewAllergen(n => ({ ...n, crossContactConcern: v }))}
                  label="Cross-contact concern"
                />
              </div>
              <div>
                <label className={labelClass}>Clinician instructions (optional)</label>
                <input
                  value={newAllergen.clinicianInstructions}
                  onChange={e => setNewAllergen(n => ({ ...n, clinicianInstructions: e.target.value }))}
                  placeholder="e.g. Avoid all tree nut traces"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addAllergyDetail}
                  className="flex-1 py-2 rounded-xl bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
                  Add Allergen
                </button>
                <button type="button" onClick={() => setShowAllergenForm(false)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAllergenForm(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-emerald-500/25 hover:border-emerald-400/40 text-white hover:text-white text-sm transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Add allergen
            </button>
          )}
        </div>

        {/* ── 3. Medical Conditions ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Stethoscope} title="Medical Conditions" />
          <p className="text-xs text-white -mt-2">
            Only conditions that affect food choices. The engine uses these to apply appropriate protocols and hard stops.
          </p>
          <MultiPillSelect
            options={COMMON_CONDITIONS}
            selected={profile.medical_conditions}
            onChange={v => set("medical_conditions", v)}
          />
        </div>

        {/* ── 4. Feeding & Texture ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Utensils} title="Feeding & Texture" />

          <div>
            <label className={labelClass}>Texture level</label>
            <PillSelect
              options={TEXTURE_LEVELS}
              value={profile.feeding_ability.textureLevel ?? "regular"}
              onChange={v => setFeeding("textureLevel", v)}
            />
          </div>

          <div className="space-y-3">
            <BoolPill
              checked={!!profile.feeding_ability.swallowingDifficulty}
              onChange={v => setFeeding("swallowingDifficulty", v)}
              label="Has swallowing difficulties"
            />
            <BoolPill
              checked={!!profile.feeding_ability.historyOfChokingOrGagging}
              onChange={v => setFeeding("historyOfChokingOrGagging", v)}
              label="History of choking or gagging"
            />
            <BoolPill
              checked={!!profile.feeding_ability.hasFeedingTube}
              onChange={v => setFeeding("hasFeedingTube", v)}
              label="Uses a feeding tube (G-tube)"
            />
          </div>

          <div>
            <label className={labelClass}>Other feeding concerns</label>
            <TagInput
              tags={profile.feeding_concerns}
              onAdd={v => set("feeding_concerns", [...profile.feeding_concerns, v])}
              onRemove={v => set("feeding_concerns", profile.feeding_concerns.filter(c => c !== v))}
              placeholder="e.g. Refuses spoon, difficulty chewing"
            />
          </div>
        </div>

        {/* ── 5. Sensory Needs ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Activity} title="Sensory & Eating Behavior" />
          <MultiPillSelect
            options={SENSORY_OPTIONS}
            selected={profile.sensory_issues}
            onChange={v => set("sensory_issues", v)}
          />
        </div>

        {/* ── 6. Diet & Preferences ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Heart} title="Diet & Preferences" />

          <div>
            <label className={labelClass}>Dietary pattern</label>
            <MultiPillSelect
              options={DIETARY_OPTIONS}
              selected={profile.dietary_preferences}
              onChange={v => set("dietary_preferences", v)}
            />
          </div>

          <div>
            <label className={labelClass}>Foods disliked or avoided</label>
            <textarea
              value={profile.dislikes as string}
              onChange={e => set("dislikes", e.target.value)}
              placeholder="e.g. Mushrooms, onions, anything green"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Cultural / cuisine preferences</label>
            <input
              value={profile.cultural_preferences}
              onChange={e => set("cultural_preferences", e.target.value)}
              placeholder="e.g. Mexican, Mediterranean, Caribbean"
              className={inputClass}
            />
          </div>
        </div>

        {/* ── 7. Growth ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Activity} title="Growth & Health" />

          <div>
            <label className={labelClass}>Growth context</label>
            <PillSelect
              options={[
                { value: "typical",                  label: "Typical growth" },
                { value: "concern_underweight",       label: "Underweight / FTT" },
                { value: "concern_overweight",        label: "Overweight concern" },
                { value: "typical_with_monitoring",   label: "Active monitoring" },
              ]}
              value={profile.growth_context}
              onChange={v => set("growth_context", v)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Height (cm, optional)</label>
              <input
                type="number"
                value={profile.height_cm}
                onChange={e => set("height_cm", e.target.value)}
                placeholder="e.g. 95"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Weight (kg, optional)</label>
              <input
                type="number"
                value={profile.weight_kg}
                onChange={e => set("weight_kg", e.target.value)}
                placeholder="e.g. 14.5"
                className={inputClass}
              />
            </div>
          </div>

          <BoolPill
            checked={profile.pediatrician_oversight}
            onChange={v => set("pediatrician_oversight", v)}
            label="Currently under pediatrician or dietitian oversight"
          />
        </div>

        {/* ── 8. School & Kitchen ── */}
        <div className={sectionClass}>
          <SectionHeader icon={School} title="School & Kitchen" />

          <BoolPill
            checked={profile.school_safe_required}
            onChange={v => set("school_safe_required", v)}
            label="Meals must be school-safe / nut-free environment"
          />

          <div>
            <label className={labelClass}>Kitchen budget</label>
            <PillSelect
              options={[
                { value: "budget",   label: "Budget-conscious" },
                { value: "moderate", label: "Moderate" },
                { value: "flexible", label: "Flexible" },
              ]}
              value={profile.kitchen_budget}
              onChange={v => set("kitchen_budget", v)}
            />
          </div>

          <div>
            <label className={labelClass}>Time available for meals</label>
            <PillSelect
              options={[
                { value: 15, label: "Under 15 min" },
                { value: 30, label: "~30 min" },
                { value: 45, label: "~45 min" },
                { value: 60, label: "Up to 1 hr" },
              ]}
              value={profile.kitchen_time_minutes}
              onChange={v => set("kitchen_time_minutes", v)}
            />
          </div>

          <div>
            <label className={labelClass}>Cooking skill</label>
            <PillSelect
              options={[
                { value: "beginner",     label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced",     label: "Advanced" },
              ]}
              value={profile.kitchen_skill}
              onChange={v => set("kitchen_skill", v)}
            />
          </div>
        </div>

        {/* ── 9. Clinical ── */}
        <div className={sectionClass}>
          <SectionHeader icon={ChefHat} title="Clinical Notes" />
          <div className="space-y-3">
            <BoolPill
              checked={profile.medication_affects_appetite}
              onChange={v => set("medication_affects_appetite", v)}
              label="Medication affects appetite or weight"
            />
          </div>
        </div>

        {/* ── 10. Parent Goals ── */}
        <div className={sectionClass}>
          <SectionHeader icon={Heart} title="Parent Goals" />
          <p className="text-xs text-white -mt-2">What matters most to you for this child's nutrition?</p>
          <TagInput
            tags={profile.family_goals}
            onAdd={v => set("family_goals", [...profile.family_goals, v])}
            onRemove={v => set("family_goals", profile.family_goals.filter(g => g !== v))}
            placeholder="e.g. Expand variety, support iron levels"
          />
        </div>

        {/* ── Save ── */}
        {error && (
          <div className="rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600/50 border border-emerald-500/50 text-white font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            : saved
            ? <><Check className="h-4 w-4 text-emerald-300" /> Profile Saved</>
            : <><Check className="h-4 w-4" /> {isNew ? "Create Profile" : "Save Changes"}</>}
        </button>

        {saved && (
          <p className="text-center text-xs text-emerald-400/70">
            Profile saved. Meals and scans for this child will use this information.
          </p>
        )}
      </div>
    </motion.div>
  );
}
