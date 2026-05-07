import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Shield, Eye, EyeOff, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { useToast } from "@/hooks/use-toast";
import { PillButton } from "@/components/ui/pill-button";
import { captureException } from "@/lib/sentry";

const RESUME_STEP_KEY = "mpm.onboarding.resumeStep";

const TOTAL_STEPS = 9;

const CUISINE_OPTIONS = [
  "American", "Mexican", "Italian", "Indian", "Chinese",
  "Japanese", "Mediterranean", "Thai", "Korean", "Middle Eastern",
];

const PRESET_CUISINES_LOWER = CUISINE_OPTIONS.map(c => c.toLowerCase());

const GOAL_OPTIONS = [
  { label: "Lose Weight", value: "lose", emoji: "🔥" },
  { label: "Maintain Weight", value: "maintain", emoji: "⚖️" },
  { label: "Gain Muscle", value: "gain", emoji: "💪" },
];

const TIMELINE_OPTIONS = [
  { label: "4 weeks", value: 4 },
  { label: "8 weeks", value: 8 },
  { label: "12 weeks", value: 12 },
  { label: "16 weeks", value: 16 },
  { label: "6 months", value: 26 },
  { label: "1 year", value: 52 },
];

const ALLERGY_OPTIONS = [
  "Peanuts", "Tree Nuts", "Dairy", "Lactose Intolerance", "Eggs",
  "Wheat/Gluten", "Soy", "Fish", "Shellfish", "Sesame",
  "Corn", "Nightshades", "Garlic", "Onions", "Artificial Sweeteners",
];

const MEDICAL_CONDITIONS = [
  { label: "Type 1 Diabetes", value: "diabetes-type1" },
  { label: "Type 2 Diabetes", value: "diabetes-type2" },
  { label: "Prediabetes", value: "prediabetes" },
  { label: "GLP-1 Medication", value: "glp1" },
  { label: "Crohn's Disease", value: "crohns" },
  { label: "Ulcerative Colitis", value: "ulcerative-colitis" },
  { label: "Irritable Bowel Syndrome (IBS)", value: "ibs" },
  { label: "Celiac Disease", value: "celiac" },
  { label: "Rheumatoid Arthritis", value: "rheumatoid-arthritis" },
  { label: "Psoriasis", value: "psoriasis" },
  { label: "Lupus", value: "lupus" },
  { label: "Hypertension", value: "hypertension" },
  { label: "High Cholesterol", value: "high-cholesterol" },
  { label: "PCOS", value: "pcos" },
  { label: "Anti-Inflammatory Focus", value: "anti-inflammatory" },
  { label: "None", value: "none" },
];

const FLAVOR_OPTIONS = [
  { label: "Bold & Flavorful", value: "bold-spicy" },
  { label: "Comfort Style", value: "comfort" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Balanced", value: "balanced" },
  { label: "Not sure", value: "unsure" },
];

const HEAT_OPTIONS = [
  { label: "No Heat", value: "none", description: "I want flavor, not spice" },
  { label: "Mild", value: "mild", description: "A little kick is okay" },
  { label: "Medium", value: "medium", description: "I like noticeable heat" },
  { label: "Hot", value: "hot", description: "I enjoy spicy food regularly" },
  { label: "Very Hot", value: "very-hot", description: "Bring the fire" },
  { label: "Not Sure", value: "unsure", description: "Surprise me" },
];

const SWEETENER_OPTIONS = [
  { label: "Regular Sugar", value: "sugar" },
  { label: "Honey / Natural Sugar", value: "honey" },
  { label: "Stevia", value: "stevia" },
  { label: "Monk Fruit", value: "monk-fruit" },
  { label: "Equal (Aspartame)", value: "equal" },
  { label: "Splenda (Sucralose)", value: "splenda" },
  { label: "Avoid Sweeteners", value: "avoid" }
];

const DIET_OPTIONS = [
  { label: "No Restriction", value: "none" },
  { label: "Keto", value: "keto" },
  { label: "Carnivore", value: "carnivore" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Paleo", value: "paleo" },
  { label: "Vegan", value: "vegan" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Pescatarian", value: "pescatarian" },
  { label: "Kosher", value: "kosher" },
  { label: "Halal", value: "halal" },
  { label: "Custom", value: "custom" },
];

const DIETARY_IDENTITY_HINTS: Record<string, string> = {
  kosher: "Meals will follow ingredient, preparation, and combination rules — including no meat with dairy and no pork or shellfish.",
  halal: "Meals will follow ingredient and preparation rules — including no pork, no alcohol in cooking, and certified meat sourcing.",
  vegan: "All meals will be fully plant-based — no meat, dairy, eggs, or animal byproducts.",
  vegetarian: "Meals will contain no meat or seafood. Dairy and eggs are included.",
  pescatarian: "Meals will contain no land-based meat. Fish and seafood are included.",
  carnivore: "This is a strict animal-only eating style. Every meal will use only meat, seafood, eggs, and animal fats. No plant ingredients will appear. For best results, focus on hydration as you adjust.",
};

const BUILDER_OPTIONS = [
  { id: "weekly", name: "Weekly Meal Builder", description: "Balanced, healthy meals for everyday life" },
  { id: "diabetic", name: "Diabetes Support", description: "Blood-sugar awareness and stability" },
  { id: "glp1", name: "GLP-1 Support", description: "For users on GLP-1 medications" },
  { id: "anti_inflammatory", name: "Anti-Inflammatory", description: "Support long-term inflammation management" },
];

function getRecommendedBuilder(conditions: string[]): string {
  if (
    conditions.includes("diabetes-type1") ||
    conditions.includes("diabetes-type2") ||
    conditions.includes("prediabetes")
  ) return "diabetic";
  if (conditions.includes("glp1")) return "glp1";
  if (
    conditions.includes("anti-inflammatory") ||
    conditions.includes("crohns") ||
    conditions.includes("ulcerative-colitis") ||
    conditions.includes("ibs") ||
    conditions.includes("rheumatoid-arthritis") ||
    conditions.includes("psoriasis") ||
    conditions.includes("lupus")
  ) return "anti_inflammatory";
  return "weekly";
}

export default function OnboardingV3() {
  const [, setLocation] = useLocation();
  const { refreshUser, user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const restoredRef = useRef(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [avoidedFoods, setAvoidedFoods] = useState<string[]>([]);
  const [avoidedFoodInput, setAvoidedFoodInput] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [customConditionInput, setCustomConditionInput] = useState("");
  const [flavorPreference, setFlavorPreference] = useState("");
  const [heatPreference, setHeatPreference] = useState("");
  const [sweetenerPreferences, setSweetenerPreferences] = useState<string[]>([]);
  const [goalType, setGoalType] = useState<"lose" | "maintain" | "gain" | "">("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTimelineWeeks, setGoalTimelineWeeks] = useState<number | null>(null);
  const [selectedBuilder, setSelectedBuilder] = useState("");
  const [cuisinePreference, setCuisinePreference] = useState("");
  const [cuisineIntensity, setCuisineIntensity] = useState<"light" | "balanced" | "authentic">("balanced");
  const [customCuisineInput, setCustomCuisineInput] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [oncologyIntroAnswer, setOncologyIntroAnswer] = useState<"yes" | "skip" | null>(null);
  const [oncologySupportIntentChoice, setOncologySupportIntentChoice] = useState<"own_provider" | "request_support" | "self_directed" | null>(null);
  const [specialtyCondition, setSpecialtyCondition] = useState<string | null>(null);
  const [dietaryStyle, setDietaryStyle] = useState("");
  const [customDietInput, setCustomDietInput] = useState("");

  const progress = (step / TOTAL_STEPS) * 100;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  useEffect(() => {
    const rec = getRecommendedBuilder(medicalConditions);
    if (!selectedBuilder) setSelectedBuilder(rec);
  }, [medicalConditions]);

  // Persist current step so we can resume after refresh / app close
  useEffect(() => {
    if (!restoredRef.current) return;
    localStorage.setItem(RESUME_STEP_KEY, String(step));
  }, [step]);

  // On mount: restore step position and pre-populate fields from already-saved profile
  useEffect(() => {
    if (restoredRef.current || !user) return;
    restoredRef.current = true;

    const savedStep = localStorage.getItem(RESUME_STEP_KEY);
    if (savedStep) {
      const n = parseInt(savedStep, 10);
      if (n >= 1 && n <= TOTAL_STEPS) setStep(n);
    }

    if (user.firstName) setFirstName(user.firstName);
    if (user.lastName) setLastName(user.lastName);
    if (user.allergies?.length) setAllergies(user.allergies);
    if (user.avoidedFoods?.length) setAvoidedFoods(user.avoidedFoods);
    if (user.medicalConditions?.length) setMedicalConditions(user.medicalConditions);
    if (user.specialtyCondition) setSpecialtyCondition(user.specialtyCondition);
    if (user.oncologySupportIntent) {
      setOncologyIntroAnswer("yes");
      setOncologySupportIntentChoice(user.oncologySupportIntent);
    }
    if (user.dietaryRestrictions?.length) {
      const firstVal = user.dietaryRestrictions[0];
      const preset = DIET_OPTIONS.find((o) => o.value === firstVal);
      if (preset) {
        setDietaryStyle(firstVal);
      } else if (firstVal) {
        setDietaryStyle("custom");
        setCustomDietInput(firstVal);
      }
    }
    if (user.goalType) setGoalType(user.goalType);
    if (user.goalTarget) setGoalTarget(user.goalTarget);
    if (user.goalTimelineWeeks) setGoalTimelineWeeks(user.goalTimelineWeeks);
    if (user.flavorPreference) setFlavorPreference(user.flavorPreference);
    if (user.heatPreference) setHeatPreference(user.heatPreference);
    if (user.sweetenerPreferences?.length) setSweetenerPreferences(user.sweetenerPreferences);
    if (user.cuisinePreference) setCuisinePreference(user.cuisinePreference);
    if (user.preferredBuilder) setSelectedBuilder(user.preferredBuilder);
  }, [user]);

  /** Fetch with a 15-second timeout to surface hung requests as a clear error */
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
      if (err?.name === "AbortError") throw new Error("Request timed out after 15 seconds. Check your connection and try again.");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  /** Returns a human-readable message from a non-ok profile response */
  const parseProfileError = async (res: Response, step: string): Promise<string> => {
    let body: any = {};
    try { body = await res.json(); } catch { /* ignore parse errors */ }
    const code = body?.code || "";
    const serverMsg = body?.error || "";
    console.error(`[onboarding] saveProfile failed — step: ${step}, status: ${res.status}, code: ${code}, server: ${serverMsg}`);
    if (res.status === 401) return "Your session expired. Please sign out and sign back in to continue.";
    if (res.status === 403) return serverMsg || "Action not permitted at this step.";
    if (res.status === 400) return serverMsg || "Some profile data was invalid. Please review your entries.";
    return `Something went wrong saving your profile (step: ${step}). Please try again.`;
  };

  const saveProfile = async (fields: Record<string, unknown>, step: string) => {
    const res = await fetchWithTimeout(
      apiUrl("/api/users/profile"),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...fields, fromOnboarding: true, _step: step }),
      }
    );
    if (!res.ok) {
      const msg = await parseProfileError(res, step);
      throw new Error(msg);
    }
  };

  const handleAllergyToggle = (item: string) => {
    if (item === "None") {
      setAllergies(allergies.includes("None") ? [] : ["None"]);
    } else {
      setAllergies((prev) => {
        const without = prev.filter((a) => a !== "None");
        return without.includes(item) ? without.filter((a) => a !== item) : [...without, item];
      });
    }
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergyInput.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev.filter((a) => a !== "None"), trimmed]);
      setCustomAllergyInput("");
    }
  };

  const toggleSweetener = (value: string) => {
    setSweetenerPreferences(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleMedicalToggle = (value: string) => {
    if (value === "none") {
      setMedicalConditions(medicalConditions.includes("none") ? [] : ["none"]);
    } else {
      setMedicalConditions((prev) => {
        const without = prev.filter((c) => c !== "none");
        return without.includes(value) ? without.filter((c) => c !== value) : [...without, value];
      });
    }
  };

  const handleAddCustomCondition = () => {
    const trimmed = customConditionInput.trim().toLowerCase();
    if (trimmed && !medicalConditions.includes(trimmed)) {
      setMedicalConditions((prev) => [...prev.filter((c) => c !== "none"), trimmed]);
      setCustomConditionInput("");
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      switch (step) {
        case 1:
          if (!firstName.trim() || !lastName.trim()) {
            toast({ title: "Please enter your first and last name", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({ firstName: firstName.trim(), lastName: lastName.trim() }, "name");
          break;
        case 2: {
          const toSave = allergies.filter((a) => a !== "None");
          await saveProfile({ allergies: toSave, avoidedFoods }, "allergies");
          break;
        }
        case 3:
          if (medicalConditions.length === 0) {
            toast({ title: "Please select at least one condition, or choose 'None'", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({ medicalConditions }, "medical_conditions");
          // Save specialty condition separately (non-blocking — failure does not block step advance)
          fetch(apiUrl("/api/user/specialty-condition"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ condition: specialtyCondition }),
          }).catch((err) => {
            captureException(err, { step: "specialty_condition", specialtyCondition });
          });
          break;
        case 4: {
          const intent = oncologyIntroAnswer === "yes" ? oncologySupportIntentChoice : null;
          if (intent) {
            localStorage.setItem("mpm:oncologySupportIntent", intent);
          } else {
            localStorage.removeItem("mpm:oncologySupportIntent");
          }
          // Non-blocking — failure does not block step advance
          fetch(apiUrl("/api/user/oncology-support-intent"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ intent }),
          }).catch((err) => {
            captureException(err, { step: "oncology_support_intent", intent });
          });
          break;
        }
        case 5: {
          if (!dietaryStyle) {
            toast({ title: "Please select an eating style, or choose 'No Restriction'", variant: "destructive" });
            setSaving(false);
            return;
          }
          if (dietaryStyle === "custom" && !customDietInput.trim()) {
            toast({ title: "Please describe your eating style", variant: "destructive" });
            setSaving(false);
            return;
          }
          const restrictions =
            dietaryStyle === "none"
              ? []
              : [dietaryStyle === "custom" ? customDietInput.trim().toLowerCase() : dietaryStyle];
          await saveProfile({ dietaryRestrictions: restrictions }, "dietary_style");
          break;
        }
        case 6:
          if (!goalType) {
            toast({ title: "Please select your main goal", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({
            goalType,
            goalTarget: goalTarget.trim() || null,
            goalTimelineWeeks: goalTimelineWeeks ?? null,
            goalStartDate: new Date().toISOString(),
          }, "goals");
          break;
        case 7:
          if (!flavorPreference) {
            toast({ title: "Please pick a flavor style", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({
            flavorPreference,
            heatPreference: heatPreference || "unsure",
            sweetenerPreferences
          }, "flavor");
          break;
        case 8:
          await saveProfile({
            cuisinePreference: cuisinePreference || null,
            cuisineIntensity: cuisinePreference ? cuisineIntensity : null,
          }, "cuisine");
          break;
      }
      setStep((s) => s + 1);
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const validatePin = () => {
    if (pin.length !== 4) return "PIN must be exactly 4 digits";
    if (pin !== confirmPin) return "PINs do not match";
    return "";
  };

  const handleFinish = async () => {
    const err = validatePin();
    if (err) {
      setPinError(err);
      return;
    }
    if (!selectedBuilder) {
      toast({ title: "Please select a builder", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ preferredBuilder: selectedBuilder }, "builder");

      const pinRes = await fetchWithTimeout(apiUrl("/api/safety-pin/set"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ pin }),
      });
      if (!pinRes.ok) {
        let pinMsg = "Failed to save your safety PIN.";
        if (pinRes.status === 401) pinMsg = "Your session expired. Please sign out and sign back in.";
        console.error(`[onboarding] safety-pin/set failed — status: ${pinRes.status}`);
        throw new Error(pinMsg);
      }

      const completeRes = await fetchWithTimeout(apiUrl("/api/user/complete-onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ onboardingMode: "independent" }),
      });
      if (!completeRes.ok) {
        let completeMsg = "Could not activate your plan. Tap 'Start My Plan' to try again.";
        if (completeRes.status === 401) completeMsg = "Your session expired. Please sign out and sign back in.";
        if (completeRes.status === 400) {
          let body: any = {};
          try { body = await completeRes.json(); } catch { /* ignore */ }
          completeMsg = body?.error || completeMsg;
        }
        console.error(`[onboarding] complete-onboarding failed — status: ${completeRes.status}`);
        captureException(new Error("complete-onboarding failed"), { status: completeRes.status });
        throw new Error(completeMsg);
      }

      localStorage.removeItem(RESUME_STEP_KEY);
      await refreshUser();
      setLocation("/macro-counter?from=onboarding");
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (pin && confirmPin) {
      setPinError(validatePin());
    } else {
      setPinError("");
    }
  }, [pin, confirmPin]);

  const recommended = getRecommendedBuilder(medicalConditions);

  const canFinish = selectedBuilder && pin.length === 4 && pin === confirmPin;

  const renderPage = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What's your name?</h1>
              <p className="text-white/60 text-sm">You can personalize your display name later in settings</p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="text-white bg-white/10 border-white/20 text-lg h-12 text-center"
                autoFocus
              />
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="text-white bg-white/10 border-white/20 text-lg h-12 text-center"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Any food allergies?</h1>
            </div>
            <div className="flex flex-wrap gap-2 max-w-md mx-auto">
              {ALLERGY_OPTIONS.map((item) => (
                <PillButton
                  key={item}
                  active={allergies.includes(item)}
                  onClick={() => handleAllergyToggle(item)}
                >
                  {item}
                </PillButton>
              ))}
              <PillButton
                active={allergies.includes("None")}
                onClick={() => handleAllergyToggle("None")}
              >
                None
              </PillButton>
            </div>
            <div className="max-w-md mx-auto flex gap-2">
              <Input
                value={customAllergyInput}
                onChange={(e) => setCustomAllergyInput(e.target.value)}
                placeholder="Add custom allergy..."
                className="text-white bg-white/10 border-white/20 flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomAllergy()}
              />
              <PillButton
                active={false}
                disabled={!customAllergyInput.trim()}
                onClick={handleAddCustomAllergy}
              >
                Add
              </PillButton>
            </div>
            {allergies.filter((a) => !ALLERGY_OPTIONS.includes(a) && a !== "None").length > 0 && (
              <div className="max-w-md mx-auto flex flex-wrap gap-2">
                {allergies.filter((a) => !ALLERGY_OPTIONS.includes(a) && a !== "None").map((custom) => (
                  <PillButton
                    key={custom}
                    active={true}
                    onClick={() => setAllergies((prev) => prev.filter((a) => a !== custom))}
                  >
                    {custom} ×
                  </PillButton>
                ))}
              </div>
            )}

            {/* Foods to Avoid */}
            <div className="max-w-md mx-auto w-full pt-2">
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-4 space-y-3">
                <div>
                  <p className="text-rose-300 font-semibold text-sm mb-0.5">Foods to Avoid</p>
                  <p className="text-white/50 text-xs">Foods or categories you never want in your meals — different from allergies, no PIN needed.</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["Vegetables", "Mushrooms", "Onions", "Seafood", "Pork", "Red Meat"].map((cat) => {
                    const stored = cat.toLowerCase();
                    return (
                      <PillButton
                        key={cat}
                        active={avoidedFoods.includes(stored)}
                        onClick={() =>
                          setAvoidedFoods((prev) =>
                            prev.includes(stored)
                              ? prev.filter((f) => f !== stored)
                              : [...prev, stored]
                          )
                        }
                      >
                        {cat}
                      </PillButton>
                    );
                  })}
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={avoidedFoodInput}
                    onChange={(e) => setAvoidedFoodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const trimmed = avoidedFoodInput.trim().toLowerCase();
                        if (trimmed && !avoidedFoods.includes(trimmed)) {
                          setAvoidedFoods((prev) => [...prev, trimmed]);
                          setAvoidedFoodInput("");
                        }
                      }
                    }}
                    placeholder="Type a specific food..."
                    className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 placeholder:text-white/30"
                  />
                  <PillButton
                    active={false}
                    disabled={!avoidedFoodInput.trim()}
                    onClick={() => {
                      const trimmed = avoidedFoodInput.trim().toLowerCase();
                      if (trimmed && !avoidedFoods.includes(trimmed)) {
                        setAvoidedFoods((prev) => [...prev, trimmed]);
                        setAvoidedFoodInput("");
                      }
                    }}
                  >
                    Add
                  </PillButton>
                </div>
                {avoidedFoods.filter(f => !["vegetables","mushrooms","onions","seafood","pork","red meat"].includes(f)).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {avoidedFoods
                      .filter(f => !["vegetables","mushrooms","onions","seafood","pork","red meat"].includes(f))
                      .map((food) => (
                        <PillButton
                          key={food}
                          active={true}
                          onClick={() => setAvoidedFoods((prev) => prev.filter((f) => f !== food))}
                        >
                          {food} ×
                        </PillButton>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Any relevant medical conditions?</h1>
            </div>
            <div className="flex flex-wrap gap-2 max-w-sm mx-auto">
              {MEDICAL_CONDITIONS.map((item) => (
                <PillButton
                  key={item.value}
                  active={medicalConditions.includes(item.value)}
                  onClick={() => handleMedicalToggle(item.value)}
                >
                  {item.label}
                </PillButton>
              ))}
            </div>
            <div className="max-w-sm mx-auto flex gap-2">
              <Input
                value={customConditionInput}
                onChange={(e) => setCustomConditionInput(e.target.value)}
                placeholder="Add another condition..."
                className="text-white bg-white/10 border-white/20 flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomCondition()}
              />
              <PillButton
                active={false}
                disabled={!customConditionInput.trim()}
                onClick={handleAddCustomCondition}
              >
                Add
              </PillButton>
            </div>
            {medicalConditions.filter(
              (c) => !MEDICAL_CONDITIONS.map((m) => m.value).includes(c) && c !== "none"
            ).length > 0 && (
              <div className="max-w-sm mx-auto flex flex-wrap gap-2">
                {medicalConditions
                  .filter((c) => !MEDICAL_CONDITIONS.map((m) => m.value).includes(c) && c !== "none")
                  .map((custom) => (
                    <PillButton
                      key={custom}
                      active={true}
                      onClick={() => setMedicalConditions((prev) => prev.filter((c) => c !== custom))}
                    >
                      {custom} ×
                    </PillButton>
                  ))}
              </div>
            )}

            {/* Specialty Health Protocol — optional */}
            <div className="max-w-sm mx-auto rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🩺</span>
                <span className="text-sky-300 font-semibold text-sm">Specialty Health Protocol</span>
                <span className="text-white/40 text-xs">(optional)</span>
              </div>
              <p className="text-white/60 text-xs mb-3">
                Do you have one of these conditions? Selecting one immediately activates the right nutrition protocol in your Anti-Inflammatory Builder — no lab entry required.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Kidney / Renal Disease", value: "renal" },
                  { label: "Cardiac / Heart Disease", value: "cardiac" },
                  { label: "Liver Disease", value: "liver-disease" },
                  { label: "Liver Support", value: "liver-support" },
                  { label: "Cancer / Oncology Support", value: "oncology-support" },
                ].map((opt) => (
                  <PillButton
                    key={opt.value}
                    active={specialtyCondition === opt.value}
                    onClick={() =>
                      setSpecialtyCondition((prev) => prev === opt.value ? null : opt.value)
                    }
                  >
                    {opt.label}
                  </PillButton>
                ))}
              </div>
              {specialtyCondition === "oncology-support" && (
                <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 text-base mt-0.5">🎗️</span>
                    <div>
                      <p className="text-rose-300 text-xs font-semibold mb-1">Important — Not a Medical Diagnosis</p>
                      <p className="text-white/70 text-xs leading-relaxed">
                        Selecting this activates general nutritional guidance designed to support people going through cancer treatment — things like managing appetite, nausea, and energy needs. This is <span className="text-white font-medium">not a diagnosis</span>, not a treatment plan, and <span className="text-white font-medium">not a substitute for your oncology team's medical care</span>. Always follow your doctor's guidance first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <div className="text-4xl mb-1">🎗️</div>
              <h1 className="text-2xl font-bold text-white">
                Need extra support with treatment-related nutrition?
              </h1>
              <p className="text-white/60 text-sm max-w-sm mx-auto">
                Appetite changes, nausea, or food intolerances during treatment can make
                nutrition more complex. This step is completely optional — skip it and you
                can revisit any time in your settings.
              </p>
            </div>

            <div className="max-w-sm mx-auto flex flex-col gap-3">
              <button
                onClick={() => setOncologyIntroAnswer("yes")}
                className={`px-5 py-4 rounded-xl border text-left text-sm font-medium transition-all ${
                  oncologyIntroAnswer === "yes"
                    ? "bg-rose-600/30 border-rose-500 text-white"
                    : "bg-white/5 border-white/20 text-white/80"
                }`}
              >
                <div className="font-semibold">Yes, I may need this</div>
                <div className="text-xs mt-1 opacity-70">Show me the support options</div>
              </button>
              <button
                onClick={() => {
                  setOncologyIntroAnswer("skip");
                  setOncologySupportIntentChoice(null);
                }}
                className={`px-5 py-4 rounded-xl border text-left text-sm font-medium transition-all ${
                  oncologyIntroAnswer === "skip"
                    ? "bg-white/15 border-white/40 text-white"
                    : "bg-white/5 border-white/20 text-white/70"
                }`}
              >
                <div className="font-semibold">Skip for now</div>
                <div className="text-xs mt-1 opacity-60">I can revisit this any time in settings</div>
              </button>
            </div>

            {oncologyIntroAnswer === "yes" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-t border-white/10 pt-4">
                  <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold text-white">How would you like to proceed?</h2>
                    <p className="text-white/60 text-sm max-w-sm mx-auto">
                      We recommend working with a qualified provider for oncology-related nutrition.
                      Choose the path that fits your situation.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 mt-4 max-w-sm mx-auto">
                    {[
                      {
                        value: "own_provider" as const,
                        emoji: "🩺",
                        title: "Use My Provider",
                        description: "I already work with a physician, oncologist, or dietitian who supports my care.",
                      },
                      {
                        value: "request_support" as const,
                        emoji: "🤝",
                        title: "Request Professional Support",
                        description: "I'd like to be notified when professional support through My Perfect Meals is available.",
                      },
                      {
                        value: "self_directed" as const,
                        emoji: "🥗",
                        title: "Continue with Nutrition Support",
                        description: "I'll use the supportive nutrition tools independently for now.",
                      },
                    ].map((path) => (
                      <button
                        key={path.value}
                        onClick={() => setOncologySupportIntentChoice(path.value)}
                        className={`px-4 py-4 rounded-xl border text-left transition-all ${
                          oncologySupportIntentChoice === path.value
                            ? "bg-rose-600/25 border-rose-500 text-white"
                            : "bg-white/5 border-white/15 text-white/80"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-0.5">{path.emoji}</span>
                          <div className="flex-1">
                            <div className={`font-semibold text-sm ${oncologySupportIntentChoice === path.value ? "text-rose-200" : ""}`}>
                              {path.title}
                            </div>
                            <div className="text-xs text-white/60 mt-0.5">{path.description}</div>
                          </div>
                          {oncologySupportIntentChoice === path.value && (
                            <Check className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-xs text-white/40 mt-4 max-w-sm mx-auto px-2">
                    My Perfect Meals provides supportive nutrition tools. It does not diagnose,
                    prescribe, or replace medical care. Provider involvement may still be appropriate.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What eating style fits you best?</h1>
              <p className="text-white/60 text-sm">We'll tailor every meal to this automatically.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {DIET_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  active={dietaryStyle === opt.value}
                  onClick={() => setDietaryStyle(opt.value)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
            {DIETARY_IDENTITY_HINTS[dietaryStyle] && (
              <div className="max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-center text-xs text-white/50 leading-relaxed px-2">
                  {DIETARY_IDENTITY_HINTS[dietaryStyle]}
                </p>
              </div>
            )}
            {dietaryStyle === "custom" && (
              <div className="max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
                <input
                  type="text"
                  value={customDietInput}
                  onChange={(e) => setCustomDietInput(e.target.value)}
                  placeholder="e.g. Whole30, raw food, flexitarian..."
                  className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-white/30"
                  autoFocus
                />
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What's your main goal?</h1>
              <p className="text-white/60 text-sm">We'll personalize your plan around this</p>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGoalType(opt.value as "lose" | "maintain" | "gain")}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-left text-sm font-medium transition-all ${
                    goalType === opt.value
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/5 border-white/20 text-white/80"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {goalType && goalType !== "maintain" && (
              <div className="max-w-xs mx-auto space-y-2">
                <label className="text-white/70 text-sm">
                  {goalType === "lose" ? "How much do you want to lose?" : "How much muscle do you want to gain?"}
                  <span className="text-white/40 ml-1">(optional)</span>
                </label>
                <Input
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder={goalType === "lose" ? "e.g. 20 lbs" : "e.g. 10 lbs"}
                  className="text-white bg-white/10 border-white/20"
                />
              </div>
            )}
            <div className="max-w-xs mx-auto space-y-2">
              <label className="text-white/70 text-sm">
                Timeline <span className="text-white/40">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TIMELINE_OPTIONS.map((t) => (
                  <PillButton
                    key={t.value}
                    active={goalTimelineWeeks === t.value}
                    onClick={() => setGoalTimelineWeeks(goalTimelineWeeks === t.value ? null : t.value)}
                  >
                    {t.label}
                  </PillButton>
                ))}
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What's your flavor style?</h1>
            </div>
            <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
              {FLAVOR_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  active={flavorPreference === opt.value}
                  onClick={() => setFlavorPreference(opt.value)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>

            <div className="text-center space-y-2 mt-8">
              <h2 className="text-xl font-bold text-white">How much heat do you like?</h2>
              <p className="text-white/60 text-sm">This is separate from flavor — you can love bold food with zero heat</p>
            </div>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {HEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHeatPreference(opt.value)}
                  className={`flex items-center justify-between px-5 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                    heatPreference === opt.value
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/5 border-white/20 text-white/80 hover:border-white/30"
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className={`text-xs ${heatPreference === opt.value ? "text-white/80" : "text-white/40"}`}>
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-center space-y-2 mt-8">
              <h2 className="text-xl font-bold text-white">Sweetener Preference</h2>
              <p className="text-white/60 text-sm">Select all that apply</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
              {SWEETENER_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  active={sweetenerPreferences.includes(opt.value)}
                  onClick={() => toggleSweetener(opt.value)}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What cuisine feels like home?</h1>
              <p className="text-white/60 text-sm">Optional — every feature in the app will honor your food culture automatically.</p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {CUISINE_OPTIONS.map((cuisine) => (
                <PillButton
                  key={cuisine}
                  active={cuisinePreference === cuisine.toLowerCase()}
                  onClick={() => {
                    if (cuisinePreference === cuisine.toLowerCase()) {
                      setCuisinePreference("");
                    } else {
                      setCuisinePreference(cuisine.toLowerCase());
                      setCustomCuisineInput("");
                    }
                  }}
                >
                  {cuisine}
                </PillButton>
              ))}
              <PillButton
                active={!!customCuisineInput || (!PRESET_CUISINES_LOWER.includes(cuisinePreference) && !!cuisinePreference)}
                onClick={() => {}}
              >
                Something else…
              </PillButton>
            </div>

            <div className="max-w-sm mx-auto">
              <input
                type="text"
                placeholder="e.g. Armenian, Ethiopian, Caribbean, Filipino…"
                value={customCuisineInput}
                onChange={(e) => {
                  setCustomCuisineInput(e.target.value);
                  setCuisinePreference(e.target.value.toLowerCase().trim());
                }}
                className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-white/30"
              />
              <p className="text-white/40 text-xs mt-2 text-center">
                We'll use this to shape meals, snacks, drinks, and recipes across the app.
              </p>
            </div>

            {cuisinePreference && (
              <div className="max-w-sm mx-auto space-y-3">
                <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                  <span className="text-base">🎚️</span> How strongly should we follow this style?
                </label>
                <div className="flex flex-col gap-2">
                  {([
                    ["light", "Light Influence", "Health-first — your cultural flavors added on top"],
                    ["balanced", "Balanced", "Real dish formats from your cuisine, ingredients adjusted for your health"],
                    ["authentic", "Authentic", "Traditional recipes as actually made. If you have no dietary restrictions or health conditions, this includes traditional fats, oils, and sugars. Active health conditions are still protected."],
                  ] as const).map(([value, label, desc]) => (
                    <button
                      key={value}
                      onClick={() => setCuisineIntensity(value)}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        cuisineIntensity === value
                          ? "bg-orange-500/20 border-orange-500 text-white"
                          : "bg-white/5 border-white/20 text-white/80 hover:border-white/30"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-white/50 mt-0.5">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 9:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Based on your profile, we recommend:</h1>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
              {BUILDER_OPTIONS.map((builder) => (
                <Card
                  key={builder.id}
                  onClick={() => setSelectedBuilder(builder.id)}
                  className={`cursor-pointer transition-all border-2 ${
                    selectedBuilder === builder.id
                      ? "bg-orange-500/20 border-orange-500"
                      : "bg-white/5 border-white/10 hover:border-white/25"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className={`font-semibold ${selectedBuilder === builder.id ? "text-orange-300" : "text-white"}`}>
                          {builder.name}
                        </h3>
                        <p className="text-white/60 text-sm mt-1">{builder.description}</p>
                      </div>
                      {builder.id === recommended && (
                        <span className="text-xs bg-orange-500/30 text-orange-300 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                          Recommended
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="max-w-md mx-auto border-t border-white/10 pt-6 space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold">Create Your Safety PIN</h2>
              </div>
              <p className="text-white/60 text-sm">
                This PIN protects your allergy settings from accidental changes
              </p>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Enter 4-digit PIN"
                    className="text-white bg-white/10 border-white/20 pr-10"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Input
                  type={showPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Confirm PIN"
                  className="text-white bg-white/10 border-white/20"
                  inputMode="numeric"
                />
                {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] space-y-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex-1 px-4 py-8">
        {renderPage()}
      </div>

      <div className="sticky bottom-0 bg-black/90 backdrop-blur-sm border-t border-white/10 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-3 max-w-md mx-auto">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 bg-white/10 border-white/30 text-white active:bg-white/20"
              disabled={saving}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              disabled={
              saving ||
              (step === 4 && oncologyIntroAnswer === "yes" && !oncologySupportIntentChoice) ||
              (step === 5 && !dietaryStyle) ||
              (step === 5 && dietaryStyle === "custom" && !customDietInput.trim())
            }
              className="flex-1 bg-orange-500 active:bg-orange-700 text-white"
            >
              {saving
                ? "Saving..."
                : step === 4 && !oncologyIntroAnswer
                  ? "Skip"
                  : step === 4 && oncologyIntroAnswer === "yes" && !oncologySupportIntentChoice
                    ? "Select a path above"
                    : "Next"}
              {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving || !canFinish}
              className="flex-1 bg-orange-500 active:bg-orange-700 text-white"
            >
              {saving ? "Setting up..." : "Start My Plan"}
              {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
