import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PawPrint, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const WELLNESS_GOALS = [
  "healthy weight support",
  "overweight dog support",
  "senior wellness support",
  "anti-inflammatory support",
  "digestive wellness support",
  "sensitive stomach support",
  "joint wellness support",
  "skin & coat support",
  "kidney support nutrition",
  "diabetic support nutrition",
  "allergy-sensitive meals",
  "active dog performance nutrition",
];

const ACTIVITY_LEVELS = [
  { value: "low", label: "Low", sub: "Mostly resting" },
  { value: "moderate", label: "Moderate", sub: "Daily walks" },
  { value: "high", label: "High", sub: "Very active" },
  { value: "working", label: "Working", sub: "Sport / work dog" },
];

const DIET_TYPES = [
  { value: "commercial", label: "Kibble" },
  { value: "wet", label: "Wet Food" },
  { value: "raw", label: "Raw Diet" },
  { value: "homemade", label: "Homemade" },
  { value: "mixed", label: "Mixed" },
];

const TOTAL_STEPS = 4;

interface ProfileForm {
  name: string;
  breed: string;
  isMixedBreed: boolean;
  ageYears: string;
  ageMonths: string;
  sex: string;
  isNeutered: boolean;
  weightLbs: string;
  goalWeightLbs: string;
  activityLevel: string;
  bodyConditionScore: string;
  foodSensitivities: string;
  allergies: string;
  currentDietType: string;
  treatsPerDay: string;
  behaviorNotes: string;
  vetDietaryRestrictions: string;
  medications: string;
  wellnessGoals: string[];
}

const empty: ProfileForm = {
  name: "",
  breed: "",
  isMixedBreed: false,
  ageYears: "",
  ageMonths: "0",
  sex: "",
  isNeutered: false,
  weightLbs: "",
  goalWeightLbs: "",
  activityLevel: "moderate",
  bodyConditionScore: "",
  foodSensitivities: "",
  allergies: "",
  currentDietType: "commercial",
  treatsPerDay: "0",
  behaviorNotes: "",
  vetDietaryRestrictions: "",
  medications: "",
  wellnessGoals: [],
};

function inputClass() {
  return "w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/60";
}

export default function DogProfileSetup() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProfileForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = isEdit ? "Edit Dog Profile" : "Add Your Dog | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && params.id) {
      fetch(apiUrl("/api/companion/profiles"), { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const p = (d.profiles || []).find((p: any) => p.id === params.id);
          if (p) {
            setForm({
              name: p.name || "",
              breed: p.breed || "",
              isMixedBreed: p.isMixedBreed || false,
              ageYears: String(p.ageYears || ""),
              ageMonths: String(p.ageMonths || "0"),
              sex: p.sex || "",
              isNeutered: p.isNeutered || false,
              weightLbs: String(p.weightLbs || ""),
              goalWeightLbs: p.goalWeightLbs ? String(p.goalWeightLbs) : "",
              activityLevel: p.activityLevel || "moderate",
              bodyConditionScore: p.bodyConditionScore ? String(p.bodyConditionScore) : "",
              foodSensitivities: (p.foodSensitivities || []).join(", "),
              allergies: (p.allergies || []).join(", "),
              currentDietType: p.currentDietType || "commercial",
              treatsPerDay: String(p.treatsPerDay || "0"),
              behaviorNotes: p.behaviorNotes || "",
              vetDietaryRestrictions: p.vetDietaryRestrictions || "",
              medications: (p.medications || []).join(", "),
              wellnessGoals: p.wellnessGoals || [],
            });
          }
        })
        .catch(() => {});
    }
  }, [isEdit, params.id]);

  function set(field: keyof ProfileForm, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleGoal(goal: string) {
    setForm((prev) => ({
      ...prev,
      wellnessGoals: prev.wellnessGoals.includes(goal)
        ? prev.wellnessGoals.filter((g) => g !== goal)
        : [...prev.wellnessGoals, goal],
    }));
  }

  function canAdvance() {
    if (step === 1) return form.name.trim() && form.breed.trim() && form.ageYears && form.sex;
    if (step === 2) return form.weightLbs && form.activityLevel;
    return true;
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        breed: form.breed.trim(),
        isMixedBreed: form.isMixedBreed,
        ageYears: parseInt(form.ageYears),
        ageMonths: parseInt(form.ageMonths || "0"),
        sex: form.sex,
        isNeutered: form.isNeutered,
        weightLbs: parseInt(form.weightLbs),
        goalWeightLbs: form.goalWeightLbs ? parseInt(form.goalWeightLbs) : null,
        activityLevel: form.activityLevel,
        bodyConditionScore: form.bodyConditionScore ? parseInt(form.bodyConditionScore) : null,
        foodSensitivities: form.foodSensitivities
          ? form.foodSensitivities.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        allergies: form.allergies
          ? form.allergies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        currentDietType: form.currentDietType,
        treatsPerDay: parseInt(form.treatsPerDay || "0"),
        behaviorNotes: form.behaviorNotes || null,
        vetDietaryRestrictions: form.vetDietaryRestrictions || null,
        medications: form.medications
          ? form.medications.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        wellnessGoals: form.wellnessGoals,
      };

      const url = isEdit && params.id
        ? apiUrl(`/api/companion/profiles/${params.id}`)
        : apiUrl("/api/companion/profiles");
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");
      setLocation("/companion");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-24"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <PillButton onClick={() => setLocation("/companion")}>
              <ArrowLeft className="h-3 w-3" /> Back
            </PillButton>
            <div>
              <h1 className="text-sm font-bold text-white">
                {isEdit ? `Edit ${form.name || "Dog"}'s Profile` : "Add Your Dog"}
              </h1>
              <p className="text-xs text-white/50">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 bg-white/10 mx-4 mb-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Back button — always visible for desktop (mobile header has its own) */}
        <div className="hidden md:flex items-center gap-2 mb-4">
          <PillButton onClick={() => setLocation("/companion")}>
            <ArrowLeft className="h-3 w-3" /> Back to My Perfect Pets
          </PillButton>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Identity */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-5">
                <PawPrint className="h-5 w-5 text-orange-400" />
                <h2 className="text-white font-bold text-base">Who's your dog?</h2>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Dog's Name *</label>
                <input className={inputClass()} placeholder="e.g. Biscuit" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Breed *</label>
                <input className={inputClass()} placeholder="e.g. Golden Retriever" value={form.breed} onChange={(e) => set("breed", e.target.value)} />
              </div>

              <div className="flex items-center gap-3">
                <PillButton active={form.isMixedBreed} onClick={() => set("isMixedBreed", !form.isMixedBreed)}>
                  {form.isMixedBreed ? <Check className="h-3 w-3" /> : null} Mixed Breed
                </PillButton>
                <span className="text-white/40 text-xs">Toggle if mixed breed</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Age (Years) *</label>
                  <input className={inputClass()} type="number" min="0" max="25" placeholder="e.g. 3" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Months</label>
                  <input className={inputClass()} type="number" min="0" max="11" placeholder="0–11" value={form.ageMonths} onChange={(e) => set("ageMonths", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-2 block">Sex *</label>
                <div className="flex gap-2 flex-wrap">
                  {["Male", "Female"].map((s) => (
                    <PillButton key={s} active={form.sex === s} onClick={() => set("sex", s)}>{s}</PillButton>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <PillButton active={form.isNeutered} onClick={() => set("isNeutered", !form.isNeutered)}>
                  {form.isNeutered ? <Check className="h-3 w-3" /> : null} Neutered / Spayed
                </PillButton>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Body & Activity */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-white font-bold text-base mb-5">Body & Activity</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Current Weight (lbs) *</label>
                  <input className={inputClass()} type="number" placeholder="e.g. 45" value={form.weightLbs} onChange={(e) => set("weightLbs", e.target.value)} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Goal Weight (lbs)</label>
                  <input className={inputClass()} type="number" placeholder="optional" value={form.goalWeightLbs} onChange={(e) => set("goalWeightLbs", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-2 block">Activity Level *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_LEVELS.map((a) => (
                    <PillButton key={a.value} active={form.activityLevel === a.value} onClick={() => set("activityLevel", a.value)}>
                      <div className="text-left">
                        <div className="font-semibold text-xs">{a.label}</div>
                        <div className="text-[10px] opacity-70">{a.sub}</div>
                      </div>
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-2 block">Body Condition Score (1–9)</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <PillButton key={n} active={form.bodyConditionScore === String(n)} onClick={() => set("bodyConditionScore", String(n))}>
                      {n}
                    </PillButton>
                  ))}
                </div>
                <p className="text-white/30 text-[10px] mt-1">1–3 Underweight · 4–5 Ideal · 6–7 Overweight · 8–9 Obese</p>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-2 block">Current Diet Type</label>
                <div className="flex gap-2 flex-wrap">
                  {DIET_TYPES.map((d) => (
                    <PillButton key={d.value} active={form.currentDietType === d.value} onClick={() => set("currentDietType", d.value)}>
                      {d.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Treats Per Day</label>
                <input className={inputClass()} type="number" min="0" max="20" placeholder="0" value={form.treatsPerDay} onChange={(e) => set("treatsPerDay", e.target.value)} />
              </div>
            </motion.div>
          )}

          {/* STEP 3: Health & Wellness Goals */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-white font-bold text-base mb-1">Wellness Goals</h2>
              <p className="text-white/50 text-xs mb-4">Select all that apply. Conditions can be stacked.</p>

              <div className="flex flex-wrap gap-2">
                {WELLNESS_GOALS.map((goal) => (
                  <PillButton key={goal} active={form.wellnessGoals.includes(goal)} onClick={() => toggleGoal(goal)}>
                    {form.wellnessGoals.includes(goal) && <Check className="h-3 w-3" />}
                    {goal}
                  </PillButton>
                ))}
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Allergies (comma-separated)</label>
                <input className={inputClass()} placeholder="e.g. chicken, beef, dairy" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Food Sensitivities (comma-separated)</label>
                <input className={inputClass()} placeholder="e.g. grains, soy" value={form.foodSensitivities} onChange={(e) => set("foodSensitivities", e.target.value)} />
              </div>
            </motion.div>
          )}

          {/* STEP 4: Vet & Behavior Notes */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-white font-bold text-base mb-1">Veterinarian & Behavior</h2>
              <p className="text-white/50 text-xs mb-4">Optional but improves personalization.</p>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Veterinarian Dietary Restrictions</label>
                <textarea
                  className={`${inputClass()} resize-none h-20`}
                  placeholder="e.g. Low phosphorus, avoid chicken per vet recommendation"
                  value={form.vetDietaryRestrictions}
                  onChange={(e) => set("vetDietaryRestrictions", e.target.value)}
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Medications (comma-separated, optional)</label>
                <input className={inputClass()} placeholder="e.g. Apoquel, Galliprant" value={form.medications} onChange={(e) => set("medications", e.target.value)} />
                <p className="text-white/30 text-[10px] mt-1">No dosage or drug interaction analysis is performed. For nutrition awareness only.</p>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Behavior Notes (optional)</label>
                <textarea
                  className={`${inputClass()} resize-none h-20`}
                  placeholder="e.g. Picky eater, food anxiety, gulps food quickly"
                  value={form.behaviorNotes}
                  onChange={(e) => set("behaviorNotes", e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-300 text-xs">{error}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <PillButton onClick={() => setStep((s) => s - 1)} className="flex-1">
              <ArrowLeft className="h-3 w-3" /> Back
            </PillButton>
          )}
          {step < TOTAL_STEPS ? (
            <PillButton
              onClick={() => setStep((s) => s + 1)}
              className="flex-1"
              disabled={!canAdvance()}
            >
              Next <ArrowRight className="h-3 w-3" />
            </PillButton>
          ) : (
            <PillButton onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Profile"}
            </PillButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}
