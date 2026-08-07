import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PawPrint, ArrowLeft, Check, Camera, Star, X, Upload } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const CAT_WELLNESS_GOALS = [
  "healthy weight support",
  "overweight cat support",
  "senior wellness support",
  "urinary tract health",
  "kidney support nutrition",
  "hairball reduction",
  "indoor cat wellness",
  "digestive wellness support",
  "sensitive stomach support",
  "skin & coat support",
  "dental health support",
  "diabetic support nutrition",
  "anti-inflammatory support",
  "allergy-sensitive meals",
  "taurine optimization",
];

const ACTIVITY_LEVELS = [
  { value: "low", label: "Low", sub: "Mostly sleeping" },
  { value: "moderate", label: "Moderate", sub: "Playful daily" },
  { value: "high", label: "High", sub: "Very active" },
  { value: "indoor", label: "Indoor only", sub: "No outdoor access" },
];

const DIET_TYPES = [
  { value: "commercial_dry", label: "Dry Kibble" },
  { value: "commercial_wet", label: "Wet Food" },
  { value: "raw", label: "Raw Diet" },
  { value: "homemade", label: "Homemade" },
  { value: "mixed", label: "Mixed" },
];

const TOTAL_STEPS = 5;

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

interface UploadedImage {
  id?: string;
  objectPath: string;
  previewUrl: string;
  isPrimary: boolean;
  saved: boolean;
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
  currentDietType: "commercial_wet",
  treatsPerDay: "0",
  behaviorNotes: "",
  vetDietaryRestrictions: "",
  medications: "",
  wellnessGoals: [],
};

function inputClass() {
  return "w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/60";
}

export default function CatProfileSetup() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const skipToPhotos = new URLSearchParams(search).get("photos") === "true";
  const isEdit = !!params.id;

  const [step, setStep] = useState(skipToPhotos && isEdit ? 5 : 1);
  const [form, setForm] = useState<ProfileForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosFetched = useRef(false);

  const profileName = form.name || "your cat";

  useEffect(() => {
    document.title = isEdit ? "Edit Cat Profile" : "Add Your Cat | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && params.id) {
      setSavedProfileId(params.id);
      fetch(apiUrl("/api/companion/profiles?type=cat"), { headers: getAuthHeaders() })
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
              currentDietType: p.currentDietType || "commercial_wet",
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

  useEffect(() => {
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (step === 5 && profileId && !photosFetched.current) {
      photosFetched.current = true;
      fetch(apiUrl(`/api/companion/profiles/${profileId}/images`), { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const existing: UploadedImage[] = (d.images || []).map((img: any) => ({
            id: img.id,
            objectPath: img.serveUrl,
            previewUrl: img.serveUrl,
            isPrimary: img.isPrimary,
            saved: true,
          }));
          setImages(existing);
        })
        .catch(() => {});
    }
  }, [step, savedProfileId, isEdit, params.id]);

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
        petType: "cat",
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      const data = await res.json();
      if (!isEdit && data.profile?.id) {
        setSavedProfileId(data.profile.id);
      }
      setStep(5);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (!file || !profileId) return;
    if (images.length >= 4) {
      setUploadError("Maximum 4 photos per cat.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(apiUrl(`/api/companion/profiles/${profileId}/images/upload`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const preview = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        {
          id: data.image?.id,
          objectPath: preview,
          previewUrl: preview,
          isPrimary: prev.length === 0,
          saved: true,
        },
      ]);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSetPrimary(idx: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === idx })));
  }

  async function handleRemoveImage(idx: number) {
    const img = images[idx];
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (img.id && profileId) {
      await fetch(apiUrl(`/api/companion/profiles/${profileId}/images/${img.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).catch(() => {});
    }
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  const progressPct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);

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
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : setLocation("/companion/cats")}
              className="p-1 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <h1 className="text-sm font-bold text-white">
              {isEdit ? `Edit ${form.name || "Profile"}` : "Add Your Cat"}
            </h1>
            <span className="text-white/40 text-xs">{step} / {TOTAL_STEPS}</span>
          </div>
          <div className="h-0.5 bg-white/10">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="max-w-lg mx-auto px-4" style={{ paddingTop: "calc(5rem + env(safe-area-inset-top, 0px))" }}>
        <AnimatePresence mode="wait">
          {/* STEP 1: Identity */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-white font-bold text-base mb-5">Tell us about your cat</h2>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Cat's Name *</label>
                <input className={inputClass()} placeholder="e.g. Luna" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Breed *</label>
                <input className={inputClass()} placeholder="e.g. Domestic Shorthair, Siamese, Maine Coon" value={form.breed} onChange={(e) => set("breed", e.target.value)} />
              </div>

              <div className="flex items-center gap-3">
                <PillButton active={form.isMixedBreed} onClick={() => set("isMixedBreed", !form.isMixedBreed)}>
                  {form.isMixedBreed ? <Check className="h-3 w-3" /> : null} Mixed Breed
                </PillButton>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Age (years) *</label>
                  <input className={inputClass()} type="number" min="0" max="30" placeholder="e.g. 4" value={form.ageYears} onChange={(e) => set("ageYears", e.target.value)} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Months</label>
                  <input className={inputClass()} type="number" min="0" max="11" placeholder="0" value={form.ageMonths} onChange={(e) => set("ageMonths", e.target.value)} />
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
                  {form.isNeutered ? <Check className="h-3 w-3" /> : null} Spayed / Neutered
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
                  <input className={inputClass()} type="number" placeholder="e.g. 10" value={form.weightLbs} onChange={(e) => set("weightLbs", e.target.value)} />
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
              <p className="text-white/50 text-xs mb-4">Select all that apply.</p>

              <div className="flex flex-wrap gap-2">
                {CAT_WELLNESS_GOALS.map((goal) => (
                  <PillButton key={goal} active={form.wellnessGoals.includes(goal)} onClick={() => toggleGoal(goal)}>
                    {form.wellnessGoals.includes(goal) && <Check className="h-3 w-3" />}
                    {goal}
                  </PillButton>
                ))}
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Allergies (comma-separated)</label>
                <input className={inputClass()} placeholder="e.g. fish, dairy, chicken" value={form.allergies} onChange={(e) => set("allergies", e.target.value)} />
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
                  placeholder="e.g. Low phosphorus, prescription kidney diet"
                  value={form.vetDietaryRestrictions}
                  onChange={(e) => set("vetDietaryRestrictions", e.target.value)}
                />
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Medications (comma-separated, optional)</label>
                <input className={inputClass()} placeholder="e.g. Methimazole, Prednisolone" value={form.medications} onChange={(e) => set("medications", e.target.value)} />
                <p className="text-white/30 text-[10px] mt-1">For nutrition awareness only. No drug interaction analysis performed.</p>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Behavior Notes (optional)</label>
                <textarea
                  className={`${inputClass()} resize-none h-20`}
                  placeholder="e.g. Picky eater, only eats pâté, food aggression"
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

          {/* STEP 5: Photos */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Camera className="h-5 w-5 text-orange-400" />
                <h2 className="text-white font-bold text-base">Add Photos of {profileName}</h2>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Add a photo so {profileName}'s profile card shows their face. Up to 4 photos.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden aspect-square border border-white/15">
                    <img src={img.previewUrl} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {img.isPrimary && (
                      <div className="absolute top-2 left-2 bg-orange-500 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 text-white fill-white" />
                        <span className="text-white text-[9px] font-semibold">Primary</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
                      {!img.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(idx)}
                          className="flex-1 bg-orange-500/80 rounded-lg py-1 text-white text-[10px] font-semibold text-center"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="bg-red-500/80 rounded-lg px-2 py-1 flex items-center justify-center"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  </div>
                ))}

                {images.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 bg-black/20"
                  >
                    {uploading ? (
                      <div className="text-white/40 text-xs">Uploading...</div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-orange-400/60" />
                        <span className="text-white/50 text-xs">Add Photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {uploadError && <p className="text-red-300 text-xs">{uploadError}</p>}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
              />

              <PillButton onClick={() => setLocation("/companion/cats")}>
                Done — Go to My Cats
              </PillButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        {step < 5 && (
          <div className="mt-8 flex justify-end">
            {step < 4 ? (
              <PillButton
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
              >
                Next <ArrowLeft className="h-3 w-3 rotate-180" />
              </PillButton>
            ) : (
              <PillButton onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Save & Add Photos"}
              </PillButton>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
