import { useState } from "react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

const TECHNIQUES = ["Searing", "Grilling", "Roasting", "Baking", "Frying", "Slow cooking", "Steaming", "Braising"];
const FLAVORS = ["Bold", "Smoky", "Light", "Citrus-forward", "Spicy", "Savory", "Sweet", "Umami"];
const CREATOR_TYPES = [
  { value: "chef", label: "Chef" },
  { value: "baker", label: "Baker" },
  { value: "nutrition_coach", label: "Nutrition Coach" },
  { value: "performance_coach", label: "Performance Coach" },
  { value: "physician", label: "Physician" },
];
const CAPABILITIES = ["Meals", "Desserts", "Beverages"];
const TONES = [
  { value: "chef", label: "Chef-style", desc: "Process-driven, technique-forward" },
  { value: "coaching", label: "Coaching", desc: "Guidance-first, motivating" },
  { value: "clinical", label: "Clinical", desc: "Precise, minimal, evidence-based" },
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function PillSelect({ options, selected, onToggle, single }: {
  options: string[] | { value: string; label: string; desc?: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const value = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const desc = typeof opt === "object" ? opt.desc : undefined;
        const isSelected = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              isSelected
                ? "bg-orange-600 border-orange-500 text-white"
                : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {label}
            {desc && <span className="block text-[10px] font-normal opacity-70 mt-0.5">{desc}</span>}
          </button>
        );
      })}
    </div>
  );
}

function YesNoPill({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${value ? "bg-orange-600 border-orange-500 text-white" : "bg-white/5 border-white/15 text-white/70"}`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${!value ? "bg-orange-600 border-orange-500 text-white" : "bg-white/5 border-white/15 text-white/70"}`}
      >
        No
      </button>
    </div>
  );
}

export default function CreatorSetupPage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "chef",
    supports: ["Meals"] as string[],
    techniques: [] as string[],
    flavors: [] as string[],
    ingredients: "",
    namingPattern: "technique-first",
    includeSauce: true,
    highHeat: false,
    sauceBuild: false,
    layering: false,
    tone: "chef",
  });

  useEffect(() => {
    document.title = "Studio Setup — My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  if (user?.isCreator) {
    setLocation("/creator/studio");
    return null;
  }

  const TOTAL_STEPS = 7;

  function toggleMulti(field: "techniques" | "flavors" | "supports", value: string) {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter(v => v !== value)
        : [...f[field], value],
    }));
  }

  function setSingle(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function canAdvance(): boolean {
    if (step === 0) return form.name.trim().length >= 2;
    if (step === 1) return form.supports.length > 0;
    if (step === 2) return form.techniques.length > 0;
    if (step === 3) return form.flavors.length > 0;
    return true;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const slug = form.slug || slugify(form.name);
      const body = {
        name: form.name.trim(),
        slug,
        type: form.type,
        supports: form.supports as any,
        techniques: form.techniques.map(t => t.toLowerCase()),
        flavors: form.flavors.map(f => f.toLowerCase()),
        ingredients: form.ingredients.split(",").map(s => s.trim()).filter(Boolean),
        namingPattern: form.namingPattern as "technique-first" | "flavor-first",
        includeSauce: form.includeSauce,
        highHeat: form.highHeat,
        sauceBuild: form.sauceBuild,
        layering: form.layering,
        tone: form.tone as "chef" | "coaching" | "clinical",
      };

      const res = await fetch(apiUrl("/api/creator/onboard"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      await refreshUser();
      setLocation("/creator/studio");
    } catch (err) {
      setError("Connection error. Please try again.");
      setSubmitting(false);
    }
  }

  const steps = [
    {
      title: "What's your studio name?",
      subtitle: "This is how your audience will know you.",
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60 font-medium uppercase tracking-wider block mb-2">Studio Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
              placeholder="e.g. Chef Mike's Kitchen"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60 text-sm"
              maxLength={80}
            />
            {form.slug && (
              <p className="text-[10px] text-white/30 mt-1.5">Studio ID: {form.slug}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-white/60 font-medium uppercase tracking-wider block mb-2">Creator Type</label>
            <PillSelect
              options={CREATOR_TYPES}
              selected={[form.type]}
              onToggle={v => setSingle("type", v)}
              single
            />
          </div>
        </div>
      ),
    },
    {
      title: "What do you create?",
      subtitle: "Select everything that fits your style.",
      content: (
        <PillSelect
          options={CAPABILITIES}
          selected={form.supports}
          onToggle={v => toggleMulti("supports", v)}
        />
      ),
    },
    {
      title: "How do you cook?",
      subtitle: "Select your go-to cooking techniques.",
      content: (
        <PillSelect
          options={TECHNIQUES}
          selected={form.techniques}
          onToggle={v => toggleMulti("techniques", v)}
        />
      ),
    },
    {
      title: "What's your flavor style?",
      subtitle: "Choose the profiles that define your food.",
      content: (
        <PillSelect
          options={FLAVORS}
          selected={form.flavors}
          onToggle={v => toggleMulti("flavors", v)}
        />
      ),
    },
    {
      title: "Key ingredients",
      subtitle: "What do you reach for most? (optional)",
      content: (
        <div className="space-y-4">
          <input
            type="text"
            value={form.ingredients}
            onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
            placeholder="garlic, olive oil, citrus, herbs…"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60 text-sm"
          />
          <div>
            <label className="text-xs text-white/60 font-medium uppercase tracking-wider block mb-2">Dish naming style</label>
            <PillSelect
              options={[
                { value: "technique-first", label: "Technique first", desc: "Pan-Seared Chicken…" },
                { value: "flavor-first", label: "Flavor first", desc: "Garlic-Herb Chicken…" },
              ]}
              selected={[form.namingPattern]}
              onToggle={v => setSingle("namingPattern", v)}
              single
            />
          </div>
          <div>
            <label className="text-xs text-white/60 font-medium uppercase tracking-wider block mb-2">Include sauce in dish names?</label>
            <YesNoPill value={form.includeSauce} onChange={v => setSingle("includeSauce", v)} />
          </div>
        </div>
      ),
    },
    {
      title: "Your cooking rules",
      subtitle: "Tell the system how your kitchen works.",
      content: (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-white mb-2">Do you use high-heat cooking for protein? (sear, char, roast)</p>
            <YesNoPill value={form.highHeat} onChange={v => setSingle("highHeat", v)} />
          </div>
          <div>
            <p className="text-sm text-white mb-2">Do you build sauces? (deglaze, reduce, emulsify)</p>
            <YesNoPill value={form.sauceBuild} onChange={v => setSingle("sauceBuild", v)} />
          </div>
          <div>
            <p className="text-sm text-white mb-2">Do you layer flavors step-by-step?</p>
            <YesNoPill value={form.layering} onChange={v => setSingle("layering", v)} />
          </div>
        </div>
      ),
    },
    {
      title: "How should meals be described?",
      subtitle: "Pick the voice that fits your brand.",
      content: (
        <PillSelect
          options={TONES}
          selected={[form.tone]}
          onToggle={v => setSingle("tone", v)}
          single
        />
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black pb-24"
    >
      <div className="px-6 pt-12 max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : setLocation("/creator/start")} className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 bg-white/10 rounded-full h-1.5">
            <div
              className="bg-orange-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="text-xs text-white/40">{step + 1}/{TOTAL_STEPS}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <ChefHat className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-orange-300 font-medium uppercase tracking-wider">Creator Setup</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{currentStep.title}</h2>
            <p className="text-sm text-white/60 mb-6">{currentStep.subtitle}</p>

            {currentStep.content}
          </motion.div>
        </AnimatePresence>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mt-8">
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-base transition-colors disabled:opacity-60"
            >
              {submitting ? "Creating your studio…" : (
                <>
                  <Check className="h-4 w-4" />
                  Create My Studio
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </motion.div>
  );
}
