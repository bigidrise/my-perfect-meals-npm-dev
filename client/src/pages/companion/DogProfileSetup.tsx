import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { PawPrint, ArrowLeft, ArrowRight, Check, Camera, Star, X, Upload } from "lucide-react";
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
  const search = useSearch();
  const skipToPhotos = new URLSearchParams(search).get("photos") === "true";
  const isEdit = !!params.id;

  const [step, setStep] = useState(skipToPhotos && isEdit ? 5 : 1);
  const [form, setForm] = useState<ProfileForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);

  // Step 5 photo upload state
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosFetched = useRef(false);

  useEffect(() => {
    document.title = isEdit ? "Edit Dog Profile" : "Add Your Dog | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && params.id) {
      setSavedProfileId(params.id);
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

  // Load existing photos whenever we arrive at step 5 with a known profile
  useEffect(() => {
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (step === 5 && profileId && !photosFetched.current) {
      photosFetched.current = true;
      fetch(apiUrl(`/api/companion/profiles/${profileId}/images`), { headers: getAuthHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const existing: UploadedImage[] = (d.images || []).map((img: any) => ({
            id: img.id,
            objectPath: img.imageUrl,
            previewUrl: img.imageUrl,
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

      if (isEdit) {
        // Always show photo management after saving an edit
        setSavedProfileId(params.id!);
        photosFetched.current = false;
        setStep(5);
      } else {
        const data = await res.json();
        setSavedProfileId(data.profile?.id || null);
        setStep(5);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !savedProfileId) return;
    if (images.length >= 4) {
      setUploadError("Maximum 4 photos per dog.");
      return;
    }
    setUploading(true);
    setUploadError(null);

    const previewUrl = URL.createObjectURL(file);
    try {
      // 1. Get presigned URL
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Upload service unavailable");
      const { uploadURL, objectPath } = await urlRes.json();

      // 2. Upload to presigned URL
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      // 3. Register with companion image endpoint
      const isPrimary = images.length === 0;
      const saveRes = await fetch(apiUrl(`/api/companion/profiles/${savedProfileId}/images`), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: objectPath, isPrimary }),
      });
      if (!saveRes.ok) throw new Error("Failed to save image");

      setImages((prev) => [
        ...prev.map((img) => isPrimary ? { ...img, isPrimary: false } : img),
        { objectPath, previewUrl, isPrimary, saved: true },
      ]);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed. Please try again.");
      URL.revokeObjectURL(previewUrl);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSetPrimary(idx: number) {
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (!profileId) return;
    const img = images[idx];
    const imageId = img.id || img.objectPath.split("/").pop();
    if (!imageId) return;
    try {
      await fetch(apiUrl(`/api/companion/profiles/${profileId}/images/${imageId}/set-primary`), {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      setImages((prev) => prev.map((i, j) => ({ ...i, isPrimary: j === idx })));
    } catch {}
  }

  async function handleRemoveImage(idx: number) {
    const profileId = savedProfileId || (isEdit ? params.id : null);
    if (!profileId) return;
    const img = images[idx];
    const imageId = img.id || img.objectPath.split("/").pop();
    if (!imageId) return;
    try {
      await fetch(apiUrl(`/api/companion/profiles/${profileId}/images/${imageId}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      // Only revoke blob URLs (not object storage URLs)
      if (img.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
      setImages((prev) => {
        const next = prev.filter((_, j) => j !== idx);
        if (img.isPrimary && next.length > 0) {
          next[0] = { ...next[0], isPrimary: true };
        }
        return next;
      });
    } catch {}
  }

  const profileName = form.name.trim() || "your dog";

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
            <PillButton onClick={() => step > 1 && step < 5 ? setStep((s) => s - 1) : setLocation("/companion")}>
              <ArrowLeft className="h-3 w-3" /> {step === 5 ? "Skip" : "Back"}
            </PillButton>
            <div>
              <h1 className="text-sm font-bold text-white">
                {step === 5
                  ? isEdit
                    ? `${form.name || "Dog"}'s Photos`
                    : `Add Photos of ${profileName}`
                  : isEdit
                  ? `Edit ${form.name || "Dog"}'s Profile`
                  : "Add Your Dog"}
              </h1>
              <p className="text-xs text-white/50">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <div className="h-0.5 bg-white/10 mx-4 mb-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="hidden md:flex max-w-lg mx-auto px-4 pt-6 pb-0">
        <PillButton onClick={() => step === 5 ? setLocation("/companion") : step > 1 ? setStep((s) => s - 1) : setLocation("/companion")}>
          <ArrowLeft className="h-3 w-3" /> {step === 5 ? "Skip & Finish" : "Back to My Perfect Pets"}
        </PillButton>
      </div>

      <div
        className="max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
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

          {/* STEP 5: Photos */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Camera className="h-5 w-5 text-orange-400" />
                <h2 className="text-white font-bold text-base">Add Photos of {profileName}</h2>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Your dog's photos will appear on meal cards, giving every recipe a personal visual identity. Up to 4 photos.
              </p>

              {/* Photo grid */}
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

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
              />

              {uploadError && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-300 text-xs">{uploadError}</p>
                </div>
              )}

              <p className="text-white/30 text-[10px] leading-relaxed">
                First photo uploaded becomes the primary — it appears on profile cards and meal collections. You can change this anytime.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step === 5 ? (
            <>
              <PillButton onClick={() => setLocation("/companion")} className="flex-1">
                {images.length > 0 ? "Done" : "Skip for Now"}
              </PillButton>
            </>
          ) : step > 1 ? (
            <>
              <PillButton onClick={() => setStep((s) => s - 1)} className="flex-1">
                <ArrowLeft className="h-3 w-3" /> Back
              </PillButton>
              {step < TOTAL_STEPS - 1 ? (
                <PillButton
                  onClick={() => setStep((s) => s + 1)}
                  className="flex-1"
                  disabled={!canAdvance()}
                >
                  Next <ArrowRight className="h-3 w-3" />
                </PillButton>
              ) : (
                <PillButton onClick={handleSave} className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : isEdit ? "Save Changes" : "Save & Add Photos →"}
                </PillButton>
              )}
            </>
          ) : (
            <PillButton
              onClick={() => setStep((s) => s + 1)}
              className="flex-1"
              disabled={!canAdvance()}
            >
              Next <ArrowRight className="h-3 w-3" />
            </PillButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}
