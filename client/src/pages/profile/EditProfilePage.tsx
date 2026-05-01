import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, User, Utensils, Shield, Lock, Unlock } from "lucide-react";
import { SafetyPinSettings } from "@/components/SafetyPinSettings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useGlycemicSettings } from "@/hooks/useGlycemicSettings";
import { LOW_RANGE_OPTIONS, MID_RANGE_OPTIONS, HIGH_RANGE_OPTIONS } from "@/types/glycemic";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/ui/pill-button";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { shouldAllowAutoOpen } from "@/components/copilot/CopilotRespectGuard";
import { isGuestMode } from "@/lib/guestMode";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

type StepId = 1 | 2 | 3 | 4 | 5;

function normalizeGoal(value?: string): FitnessGoal {
  switch (value) {
    case "weight_loss":
    case "muscle_gain":
    case "maintenance":
    case "endurance":
      return value;
    case "loss":
      return "weight_loss";
    case "maint":
      return "maintenance";
    default:
      return "maintenance";
  }
}

function normalizeActivity(value?: string): ActivityLevel {
  switch (value) {
    case "sedentary":
    case "lightly_active":
    case "moderately_active":
    case "very_active":
    case "extremely_active":
      return value;
    case "moderate":
      return "moderately_active";
    case "light":
      return "lightly_active";
    default:
      return "moderately_active";
  }
}

type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";
type FitnessGoal = "weight_loss" | "muscle_gain" | "maintenance" | "endurance";

type SpiceTolerance = "none" | "mild" | "medium" | "hot";
type SeasoningIntensity = "light" | "balanced" | "bold";
type FlavorStyle = "classic" | "herb" | "savory" | "bright";
type SweetenerPreference =
  | "regular_sugar"
  | "honey"
  | "stevia"
  | "monk_fruit"
  | "equal"
  | "splenda"
  | "avoid_sweeteners";

type GoalType = "lose" | "maintain" | "gain";

type EditProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
  dietaryRestrictions?: string[];
  allergies?: string[];
  palateSpiceTolerance?: SpiceTolerance;
  palateSeasoningIntensity?: SeasoningIntensity;
  palateFlavorStyle?: FlavorStyle;
  sweetenerPreferences?: SweetenerPreference[];
  goalType?: GoalType | null;
  goalTarget?: string | null;
  goalTimelineWeeks?: number | null;
  goalStartDate?: string | null;
  cuisinePreference?: string | null;
  cuisineIntensity?: "light" | "balanced" | "authentic" | null;
};

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-white font-semibold text-base">{title}</p>
          {subtitle && <p className="text-white/70 text-xs">{subtitle}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  lightly_active: "Lightly Active",
  moderately_active: "Moderately Active",
  very_active: "Very Active",
  extremely_active: "Extremely Active",
};

const GOAL_LABELS: Record<FitnessGoal, string> = {
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  endurance: "Endurance",
};

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

const KNOWN_DIET_VALUES = new Set(DIET_OPTIONS.map((o) => o.value));

function initDietaryStyle(restrictions: string[]): string {
  if (!restrictions.length) return "none";
  const first = restrictions[0];
  return KNOWN_DIET_VALUES.has(first) ? first : "custom";
}

function initCustomDietInput(restrictions: string[]): string {
  if (!restrictions.length) return "";
  const first = restrictions[0];
  return KNOWN_DIET_VALUES.has(first) ? "" : first;
}

export default function EditProfilePage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { isOpen, open, setLastResponse } = useCopilot();

  const [step, setStep] = useState<StepId>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stepPath = `/profile/edit-step-${step}`;
    const explanation = getGuestPageExplanation(stepPath, isGuestMode());
    if (!explanation) return;

    setLastResponse({
      title: explanation.title,
      description: explanation.description,
      spokenText: explanation.spokenText,
      autoClose: explanation.autoClose ?? true,
    });

    if (!shouldAllowAutoOpen()) return;
    if (CopilotExplanationStore.hasSessionOpened(stepPath)) return;

    CopilotExplanationStore.markSessionOpened(stepPath);

    const timer = setTimeout(() => {
      if (!isOpen) {
        open();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [step, isOpen, open, setLastResponse]);

  const initial = useMemo(() => {
    const u: any = user || {};
    return {
      firstName: u?.firstName || u?.name?.split(" ")[0] || "",
      lastName: u?.lastName || u?.name?.split(" ").slice(1).join(" ") || "",
      nickname: u?.nickname || "",
      email: u?.email || "",
      activityLevel: normalizeActivity(u?.activityLevel),
      fitnessGoal: normalizeGoal(u?.fitnessGoal),
      dietaryRestrictions: Array.isArray(u?.dietaryRestrictions)
        ? u.dietaryRestrictions
        : [],
      allergies: Array.isArray(u?.allergies) ? u.allergies : [],
      palateSpiceTolerance: (u?.palateSpiceTolerance || "mild") as SpiceTolerance,
      palateSeasoningIntensity: (u?.palateSeasoningIntensity || "balanced") as SeasoningIntensity,
      palateFlavorStyle: (u?.palateFlavorStyle || "classic") as FlavorStyle,
      sweetenerPreferences: Array.isArray(u?.sweetenerPreferences)
        ? u.sweetenerPreferences
        : [],
      cuisinePreference: (u as any)?.cuisinePreference || null,
      cuisineIntensity: ((u as any)?.cuisineIntensity as "light" | "balanced" | "authentic" | null) || null,
    };
  }, [user]);

  const [form, setForm] = useState<EditProfilePayload>(initial);
  const [dietaryStyle, setDietaryStyle] = useState(
    initDietaryStyle(initial.dietaryRestrictions),
  );
  const [customDietInput, setCustomDietInput] = useState(
    initCustomDietInput(initial.dietaryRestrictions),
  );
  const [allergiesText, setAllergiesText] = useState(
    initial.allergies.join(", "),
  );
  
  const [sweetenerPreferences, setSweetenerPreferences] = useState<SweetenerPreference[]>(
    initial.sweetenerPreferences || []
  );

  const [heatPreference, setHeatPreference] = useState<string>(
    user?.heatPreference || "unsure"
  );

  const [goalType, setGoalType] = useState<GoalType | null>(((user as any)?.goalType as GoalType) || null);
  const [goalTarget, setGoalTarget] = useState<string>((user as any)?.goalTarget || "");
  const [goalTimelineWeeks, setGoalTimelineWeeks] = useState<number | null>((user as any)?.goalTimelineWeeks || null);

  const [avoidedFoods, setAvoidedFoods] = useState<string[]>(
    Array.isArray((user as any)?.avoidedFoods) ? (user as any).avoidedFoods : []
  );
  const [avoidedFoodInput, setAvoidedFoodInput] = useState("");
  const CUISINE_PILLS = ["American", "Soul Food", "Mexican", "Italian", "Indian", "Chinese", "Japanese", "Mediterranean", "Thai", "Korean", "Middle Eastern"];
  const [customCuisineInput, setCustomCuisineInput] = useState(
    CUISINE_PILLS.map(c => c.toLowerCase()).includes((form.cuisinePreference || "").toLowerCase())
      ? ""
      : (form.cuisinePreference || "")
  );

  const [specialtyCondition, setSpecialtyCondition] = useState<string | null>(
    (user as any)?.specialtyCondition ?? null
  );

  // Protocol Ownership Model — physician-set oncology context (read from server)
  const oncologyCtx = (user as any)?.oncologySupportContext ?? null;
  const physicianOncologyActive = !!(oncologyCtx?.enabled && oncologyCtx?.source === "physician");
  const physicianOncologyLocked = physicianOncologyActive && !!(user?.isProCare);
  const [physicianProtocolClearing, setPhysicianProtocolClearing] = useState(false);

  const [allergiesUnlocked, setAllergiesUnlocked] = useState(false);
  const [allergyEditToken, setAllergyEditToken] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const {
    data: glycemicData,
    save: saveGlycemic,
    isSaving: glycemicSaving,
  } = useGlycemicSettings();

  const [lowRangeCarbs, setLowRangeCarbs] = useState<string[]>(glycemicData.lowRangeCarbs ?? []);
  const [midRangeCarbs, setMidRangeCarbs] = useState<string[]>(glycemicData.midRangeCarbs ?? []);
  const [highRangeCarbs, setHighRangeCarbs] = useState<string[]>(glycemicData.highRangeCarbs ?? []);

  useEffect(() => {
    if (glycemicData) {
      setLowRangeCarbs(glycemicData.lowRangeCarbs ?? []);
      setMidRangeCarbs(glycemicData.midRangeCarbs ?? []);
      setHighRangeCarbs(glycemicData.highRangeCarbs ?? []);
    }
  }, [glycemicData]);

  useEffect(() => {
    document.title = "Edit Profile | My Perfect Meals";
    setForm(initial);
    setDietaryStyle(initDietaryStyle(initial.dietaryRestrictions));
    setCustomDietInput(initCustomDietInput(initial.dietaryRestrictions));
    setAllergiesText(initial.allergies.join(", "));
    setGoalType(((user as any)?.goalType as GoalType) || null);
    setGoalTarget((user as any)?.goalTarget || "");
    setGoalTimelineWeeks((user as any)?.goalTimelineWeeks ?? null);
    setAvoidedFoods(Array.isArray((user as any)?.avoidedFoods) ? (user as any).avoidedFoods : []);
    // NOTE: intentionally NOT resetting allergiesUnlocked / allergyEditToken here
    // so that a background user-data refresh doesn't wipe the PIN unlock mid-flow
  }, [initial]);

  // Sync specialtyCondition from user object — handles async load and protocol persistence
  useEffect(() => {
    const sc = (user as any)?.specialtyCondition ?? null;
    setSpecialtyCondition(sc);
  }, [(user as any)?.specialtyCondition]);
  
  const verifyPinForAllergies = async () => {
    if (pinInput.length !== 4) {
      setPinError("PIN must be 4 digits");
      return;
    }
    
    try {
      const authToken = getAuthToken();
      const res = await fetch(apiUrl("/api/safety/verify-pin"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "x-auth-token": authToken } : {}),
        },
        body: JSON.stringify({ pin: pinInput }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setAllergiesUnlocked(true);
        setAllergyEditToken(data.allergyEditToken);
        setShowPinModal(false);
        setPinInput("");
        setPinError("");
        toast({
          title: "Allergies Unlocked",
          description: "You can now edit your allergies. Changes will be saved when you complete your profile.",
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        setPinError(errorData.error || "Incorrect PIN. Please try again.");
      }
    } catch {
      setPinError("Could not verify PIN. Please try again.");
    }
  };

  const currentBuilderLabel = useMemo(() => {
    const isProfessional = ["admin", "coach", "physician", "trainer"].includes(user?.professionalRole || user?.role || "");
    const isActualProCareClient = user?.isProCare && !isProfessional;
    const builderType = isActualProCareClient
      ? (user?.activeBoard || user?.selectedMealBuilder)
      : (user?.selectedMealBuilder || user?.activeBoard);
    
    const builderNames: Record<string, string> = {
      weekly: "Weekly Meal Board",
      diabetic: "Diabetic Builder",
      glp1: "GLP-1 Builder",
      general_nutrition: "General Nutrition Builder",
      performance_competition: "Performance Builder",
      anti_inflammatory: "Anti-Inflammatory",
      "anti-inflammatory": "Anti-Inflammatory",
      beach_body: "Beach Body",
    };
    
    return builderType ? (builderNames[builderType] || builderType) : "Not Set";
  }, [user]);

  const canContinueStep1 = Boolean(form.firstName?.trim());
  const canContinueStep2 =
    Boolean(form.fitnessGoal) && Boolean(form.activityLevel);
  const canContinueStep3 = true;

  const handleSave = async () => {
    setSaving(true);
    try {
      const dietaryArray =
        dietaryStyle === "none"
          ? []
          : [
              dietaryStyle === "custom"
                ? customDietInput.trim().toLowerCase()
                : dietaryStyle,
            ].filter(Boolean);
      const allergiesArray = allergiesText
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const originalAllergies = (initial.allergies || []).sort().join(",");
      const newAllergies = allergiesArray.sort().join(",");
      const allergiesChanged = originalAllergies !== newAllergies;

      if (allergiesChanged && !allergiesUnlocked) {
        toast({
          title: "Allergies Protected",
          description: "You must unlock allergies with your Safety PIN before making changes.",
          variant: "destructive",
        });
        setSaving(false);
        setStep(3);
        return;
      }

      const originalGoalTarget = (user as any)?.goalTarget || "";
      const originalGoalTimelineWeeks = (user as any)?.goalTimelineWeeks || null;
      const goalChanged = goalTarget !== originalGoalTarget || goalTimelineWeeks !== originalGoalTimelineWeeks;

      const payload: EditProfilePayload & { allergyEditToken?: string; heatPreference?: string; avoidedFoods?: string[] } = {
        ...form,
        dietaryRestrictions: dietaryArray,
        allergies: allergiesChanged ? allergiesArray : undefined,
        sweetenerPreferences,
        heatPreference,
        avoidedFoods,
        goalType: goalType || null,
        goalTarget: goalTarget.trim() || null,
        goalTimelineWeeks: goalTimelineWeeks,
        goalStartDate: goalChanged && (goalTarget.trim() || goalTimelineWeeks) ? new Date().toISOString() : undefined,
        ...(allergiesChanged && allergyEditToken ? { allergyEditToken } : {}),
      };

      const authToken = getAuthToken();
      const res = await fetch(apiUrl("/api/users/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "x-auth-token": authToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to update profile");
      }

      // Save specialty condition separately (its own PATCH endpoint)
      await fetch(apiUrl("/api/user/specialty-condition"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "x-auth-token": authToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ condition: specialtyCondition }),
      }).catch(() => {});

      await refreshUser?.();

      toast({
        title: "Profile updated",
        description: "Your changes were saved successfully.",
      });

      setLocation("/dashboard");
    } catch (e: any) {
      console.error("EditProfile save error:", e);
      toast({
        title: "Save failed",
        description: e?.message || "Could not save your profile. Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-24">
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex-shrink-0 flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-base font-bold text-white flex-1 min-w-0 truncate">Edit Profile</h1>

          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 max-w-[140px]">
              <Utensils className="h-3.5 w-3.5 text-lime-400 flex-shrink-0" />
              <span className="text-[11px] text-white/80 truncate">
                {String(currentBuilderLabel)}
              </span>
            </div>
          </div>
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="px-4 space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}
      >
        <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
          <CardContent className="p-4">
            <p className="text-white text-sm font-semibold mb-1">
              Meal Builder (Read-only)
            </p>
            <p className="text-white/70 text-xs">
              This page does not change your Meal Builder. To switch builders,
              use <span className="text-white">Meal Builder Exchange</span> in
              My Hub.
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-2.5 w-2.5 rounded-full ${
                step === (n as StepId)
                  ? "bg-lime-400"
                  : n < step
                    ? "bg-white/50"
                    : "bg-white/20"
              }`}
            />
          ))}
          <span className="text-white/60 text-xs ml-2">Step {step} of 5</span>
        </div>

        {step === 1 && (
          <StepShell
            title="Personal info"
            subtitle="This helps personalize your experience."
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="text-white/70 text-xs">First Name</label>
                  <input
                    value={form.firstName || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    placeholder="First name"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="text-white/70 text-xs">Last Name</label>
                  <input
                    value={form.lastName || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                    className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">Preferred Name / Nickname</label>
                <input
                  value={form.nickname || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nickname: e.target.value }))
                  }
                  className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  placeholder="What should we call you?"
                />
                <p className="text-white/40 text-[10px] mt-1">If set, this name will be used throughout the app instead of your first name</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">Email Address</label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  placeholder="you@example.com"
                  inputMode="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>

              <div className="space-y-2 pt-3">
                <Button
                  className="w-full bg-zinc-700 text-white"
                  disabled={!canContinueStep1 || saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : "Save & Exit"}
                </Button>
                <Button
                  className="w-full bg-lime-600 text-white"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Goals & activity"
            subtitle="This impacts recommendations and daily targets."
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">Fitness Goal</label>
                <select
                  value={form.fitnessGoal}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      fitnessGoal: e.target.value as FitnessGoal,
                    }))
                  }
                  className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  {Object.entries(GOAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">Activity Level</label>
                <select
                  value={form.activityLevel}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      activityLevel: e.target.value as ActivityLevel,
                    }))
                  }
                  className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">Personal Goal (optional)</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {([
                    { value: "lose", label: "🔥 Lose Weight" },
                    { value: "maintain", label: "⚖️ Maintain" },
                    { value: "gain", label: "💪 Gain Muscle" },
                  ] as { value: GoalType; label: string }[]).map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={goalType === opt.value}
                      onClick={() => setGoalType(goalType === opt.value ? null : opt.value)}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                </div>
                {goalType && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      placeholder={goalType === "lose" ? "e.g. 20 lbs or 9 kg — optional" : goalType === "gain" ? "e.g. 10 lbs or 4.5 kg — optional" : "e.g. stay at 160 lbs — optional"}
                      maxLength={100}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none"
                    />
                    <select
                      value={goalTimelineWeeks ?? ""}
                      onChange={(e) => setGoalTimelineWeeks(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                    >
                      <option value="">No timeline — optional</option>
                      <option value="4">4 weeks</option>
                      <option value="8">8 weeks</option>
                      <option value="12">12 weeks</option>
                      <option value="16">16 weeks</option>
                      <option value="20">20 weeks</option>
                      <option value="26">6 months</option>
                      <option value="52">1 year</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-3">
                <Button
                  className="w-full bg-zinc-700 text-white"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : "Save & Exit"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-black text-white"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-lime-600 text-white"
                    disabled={!canContinueStep2}
                    onClick={() => setStep(3)}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Preferences & restrictions"
            subtitle="Optional — leave blank if you don't have any."
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-3">
                  <p className="text-white font-semibold text-sm">Preferences & restrictions</p>
                  <p className="text-white/60 text-xs mt-0.5">Pick your eating style — we'll tailor every meal to it automatically.</p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                  <div className="mt-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <p className="text-xs text-white/50 leading-relaxed">
                      {DIETARY_IDENTITY_HINTS[dietaryStyle]}
                    </p>
                  </div>
                )}
                {dietaryStyle === "custom" && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={customDietInput}
                      onChange={(e) => setCustomDietInput(e.target.value)}
                      placeholder="e.g. Whole30, raw food, flexitarian..."
                      className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40 placeholder:text-white/30"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-300 font-semibold text-sm">SafetyGuard™ — Allergy Protection</span>
                  </div>
                  {allergiesUnlocked ? (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-400 text-xs">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Locked</span>
                    </div>
                  )}
                </div>
                
                <label className="text-white/70 text-xs">
                  Allergies (comma-separated)
                </label>
                {allergiesUnlocked ? (
                  <textarea
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    className="mt-1 w-full min-h-[90px] bg-black/40 border border-emerald-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    placeholder="e.g. peanuts, dairy, shellfish..."
                  />
                ) : (
                  <div className="mt-1">
                    <div className="flex justify-center mb-2">
                      <PillButton
                        active={true}
                        onClick={() => setShowPinModal(true)}
                      >
                        Unlock to Edit
                      </PillButton>
                    </div>
                    <div className="w-full min-h-[70px] bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-white/60 text-sm flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-amber-300 text-xs font-medium">
                          {allergiesText.trim() || "No allergies set"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-white/60 text-xs mt-2">
                  Your allergies are protected by your Safety PIN. This prevents accidental changes.
                </p>
              </div>

              {/* Foods to Avoid Section */}
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🚫</span>
                  <span className="text-white/80 font-semibold text-sm">Foods to Avoid</span>
                </div>
                <p className="text-white/60 text-xs mb-3">
                  Foods or categories you never want in your meals. No PIN needed — this is a preference, not a medical safety setting.
                </p>

                {/* Quick-tap category pills */}
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

                {/* Custom food input */}
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

                {/* Custom avoided foods — shown as active pills */}
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

              {/* Specialty Health Protocol Section */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🩺</span>
                  <span className="text-sky-300 font-semibold text-sm">Specialty Health Protocol</span>
                </div>

                {/* ── Physician-set oncology protocol banner ─────────────────── */}
                {physicianOncologyActive && (
                  <div className={`mb-3 rounded-xl border p-3 ${physicianOncologyLocked ? "border-amber-500/40 bg-amber-950/30" : "border-rose-500/40 bg-rose-950/20"}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">🎗️</span>
                      <div className="flex-1">
                        {physicianOncologyLocked ? (
                          <>
                            <p className="text-amber-300 text-xs font-semibold mb-0.5">
                              Cancer / Oncology Protocol — Managed by Your Care Team
                            </p>
                            <p className="text-white/60 text-xs">
                              {oncologyCtx?.ownerName
                                ? `Set by ${oncologyCtx.ownerName}.`
                                : "Set by your physician."}{" "}
                              This protocol is active and controlled by your care team while you remain connected. To make changes, contact your physician.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-rose-300 text-xs font-semibold mb-0.5">
                              Cancer / Oncology Protocol — Previously Set by Your Care Team
                            </p>
                            <p className="text-white/60 text-xs mb-2">
                              {oncologyCtx?.ownerName
                                ? `Originally set by ${oncologyCtx.ownerName}.`
                                : "Originally set by a physician."}{" "}
                              You are no longer connected to this provider. You may keep or remove this protocol.
                            </p>
                            <button
                              onClick={async () => {
                                setPhysicianProtocolClearing(true);
                                try {
                                  await fetch("/api/user/physician-protocol/oncology", { method: "DELETE", credentials: "include" });
                                  window.location.reload();
                                } catch {
                                  setPhysicianProtocolClearing(false);
                                }
                              }}
                              disabled={physicianProtocolClearing}
                              className="text-xs px-3 py-1.5 rounded-lg bg-rose-600/70 hover:bg-rose-600 text-white border border-rose-500/50 transition-colors disabled:opacity-50"
                            >
                              {physicianProtocolClearing ? "Removing…" : "Remove This Protocol"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-white/60 text-xs mb-3">
                  Select if you have one of these conditions. This immediately activates the appropriate nutrition protocol in your Anti-Inflammatory Builder — no lab entry required. You can always add labs later for precision refinement.
                </p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { label: "Kidney / Renal Disease", value: "renal" },
                    { label: "Cardiac / Heart Disease", value: "cardiac" },
                    { label: "Liver Disease", value: "liver-disease" },
                    { label: "Liver Support", value: "liver-support" },
                    { label: "Cancer / Oncology Support", value: "oncology-support" },
                  ] as const).map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={specialtyCondition === opt.value}
                      onClick={() => {
                        // Physician-locked: block self-select changes while care team is in control
                        if (physicianOncologyLocked && opt.value === "oncology-support") return;
                        setSpecialtyCondition((prev) => prev === opt.value ? null : opt.value);
                      }}
                      className={physicianOncologyLocked && opt.value === "oncology-support" ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                  {specialtyCondition && !physicianOncologyLocked && (
                    <PillButton
                      active={false}
                      onClick={() => setSpecialtyCondition(null)}
                    >
                      Clear ×
                    </PillButton>
                  )}
                </div>
                {specialtyCondition === "oncology-support" && !physicianOncologyActive && (
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

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-white/60" />
                  <span className="text-white/80 font-semibold text-sm">Manage Safety PIN</span>
                </div>
                <p className="text-white/60 text-xs mb-3">
                  Your PIN protects your allergies and allows meal overrides.
                </p>
                <SafetyPinSettings />
              </div>

              {/* Cuisine Identity Section */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🌍</span>
                  <span className="text-orange-200 font-semibold text-sm">Cuisine Identity</span>
                </div>
                <p className="text-white/60 text-xs mb-4">
                  Every feature honors your cuisine style — meals, pairings, and more. Works alongside your diet, not instead of it.
                </p>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_PILLS.map((cuisine) => (
                      <PillButton
                        key={cuisine}
                        active={form.cuisinePreference === cuisine.toLowerCase()}
                        onClick={() => {
                          if (form.cuisinePreference === cuisine.toLowerCase()) {
                            setForm((p) => ({ ...p, cuisinePreference: null }));
                          } else {
                            setForm((p) => ({ ...p, cuisinePreference: cuisine.toLowerCase() }));
                            setCustomCuisineInput("");
                          }
                        }}
                      >
                        {cuisine}
                      </PillButton>
                    ))}
                    <PillButton
                      active={!!customCuisineInput || (!CUISINE_PILLS.map(c => c.toLowerCase()).includes(form.cuisinePreference || "") && !!form.cuisinePreference)}
                      onClick={() => {}}
                    >
                      Something else…
                    </PillButton>
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. Armenian, Ethiopian, Caribbean, Filipino…"
                    value={customCuisineInput}
                    onChange={(e) => {
                      setCustomCuisineInput(e.target.value);
                      setForm((p) => ({ ...p, cuisinePreference: e.target.value.toLowerCase().trim() || null }));
                    }}
                    className="w-full bg-black/40 text-white border border-white/20 px-3 py-2 rounded-lg text-sm placeholder:text-white/40"
                  />

                  {form.cuisinePreference && (
                    <div className="space-y-2">
                      <label className="text-white/80 text-xs">How strongly should we follow this style?</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ["light", "Light Influence"],
                          ["balanced", "Balanced"],
                          ["authentic", "Authentic"],
                        ] as const).map(([value, label]) => (
                          <PillButton
                            key={value}
                            active={form.cuisineIntensity === value}
                            onClick={() => setForm((p) => ({ ...p, cuisineIntensity: value }))}
                          >
                            {label}
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Palate Preferences Section */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🍽️</span>
                  <span className="text-amber-200 font-semibold text-sm">Flavor Preferences</span>
                </div>
                <p className="text-white/60 text-xs mb-4">
                  Adjust how your meals are seasoned without affecting nutrition.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-white/80 text-xs flex items-center gap-1">
                      <span>🔥</span> Heat Preference
                    </label>
                    <p className="text-white/40 text-xs">Separate from flavor style — bold food doesn't have to mean spicy</p>
                    <div className="flex flex-wrap gap-2">
                      {(["none", "mild", "medium", "hot", "very-hot", "unsure"] as const).map((level) => (
                        <PillButton
                          key={level}
                          active={heatPreference === level}
                          onClick={() => setHeatPreference(level)}
                        >
                          {level === "none" ? "No Heat" : level === "mild" ? "Mild" : level === "medium" ? "Medium" : level === "hot" ? "Hot" : level === "very-hot" ? "Very Hot" : "Not Sure"}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-white/80 text-xs flex items-center gap-1">
                      <span>🌶️</span> Spice Tolerance
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["none", "mild", "medium", "hot"] as const).map((level) => (
                        <PillButton
                          key={level}
                          active={form.palateSpiceTolerance === level}
                          onClick={() => setForm((p) => ({ ...p, palateSpiceTolerance: level }))}
                        >
                          {level === "none" ? "None" : level === "mild" ? "Mild" : level === "medium" ? "Medium" : "Hot"}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-white/80 text-xs flex items-center gap-1">
                      <span>🧂</span> Seasoning Intensity
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["light", "balanced", "bold"] as const).map((level) => (
                        <PillButton
                          key={level}
                          active={form.palateSeasoningIntensity === level}
                          onClick={() => setForm((p) => ({ ...p, palateSeasoningIntensity: level }))}
                        >
                          {level === "light" ? "Light" : level === "balanced" ? "Balanced" : "Bold"}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-white/80 text-xs flex items-center gap-1">
                      <span>🌿</span> Flavor Style
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["classic", "herb", "savory", "bright"] as const).map((style) => (
                        <PillButton
                          key={style}
                          active={form.palateFlavorStyle === style}
                          onClick={() => setForm((p) => ({ ...p, palateFlavorStyle: style }))}
                        >
                          {style === "classic" ? "Classic" : style === "herb" ? "Herb-forward" : style === "savory" ? "Savory" : "Bright & Fresh"}
                        </PillButton>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-white/80 text-xs flex items-center gap-1">
                      <span>🍯</span> Sweetener Preference
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["regular_sugar", "Regular Sugar"],
                        ["honey", "Honey"],
                        ["stevia", "Stevia"],
                        ["monk_fruit", "Monk Fruit"],
                        ["equal", "Equal"],
                        ["splenda", "Splenda"],
                        ["avoid_sweeteners", "Avoid Sweeteners"],
                      ] as const).map(([value, label]) => (
                        <PillButton
                          key={value}
                          active={sweetenerPreferences.includes(value as SweetenerPreference)}
                          onClick={() =>
                            setSweetenerPreferences((prev) =>
                              prev.includes(value as SweetenerPreference)
                                ? prev.filter((v) => v !== value)
                                : [...prev, value as SweetenerPreference]
                            )
                          }
                        >
                          {label}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3">
                <Button
                  className="w-full bg-zinc-700 text-white"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving ? "Saving..." : "Save & Exit"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-black text-white"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-lime-600 text-white"
                    disabled={!canContinueStep3}
                    onClick={() => setStep(4)}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Glucose-Based Carb Choices"
            subtitle="Your glucose-based carb choices help MPM decide which fruits and carb sources to prioritize when building meals for diabetic support."
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white/70 text-xs">Choose what you prefer to eat when your blood sugar is low, in range, or elevated. MPM will use these choices automatically during meal generation.</p>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-blue-300 text-sm font-semibold flex items-center gap-2">
                      <span className="text-lg">🔵</span> Low Glucose Range
                    </p>
                    <p className="text-blue-200/50 text-xs">What helps you recover when blood sugar is low</p>
                  </div>
                  <PillButton
                    active={LOW_RANGE_OPTIONS.every((f) => lowRangeCarbs.includes(f))}
                    onClick={() => {
                      const allSelected = LOW_RANGE_OPTIONS.every((f) => lowRangeCarbs.includes(f));
                      setLowRangeCarbs((prev) =>
                        allSelected
                          ? prev.filter((f) => !LOW_RANGE_OPTIONS.includes(f))
                          : [...new Set([...prev, ...LOW_RANGE_OPTIONS])]
                      );
                    }}
                  >
                    {LOW_RANGE_OPTIONS.every((f) => lowRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
                  </PillButton>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LOW_RANGE_OPTIONS.map((food) => (
                    <PillButton
                      key={food}
                      active={lowRangeCarbs.includes(food)}
                      onClick={() =>
                        setLowRangeCarbs((prev) =>
                          prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]
                        )
                      }
                    >
                      {food}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-green-300 text-sm font-semibold flex items-center gap-2">
                      <span className="text-lg">🟢</span> In-Range Glucose
                    </p>
                    <p className="text-green-200/50 text-xs">Balanced carbs for stable blood sugar</p>
                  </div>
                  <PillButton
                    active={MID_RANGE_OPTIONS.every((f) => midRangeCarbs.includes(f))}
                    onClick={() => {
                      const allSelected = MID_RANGE_OPTIONS.every((f) => midRangeCarbs.includes(f));
                      setMidRangeCarbs((prev) =>
                        allSelected
                          ? prev.filter((f) => !MID_RANGE_OPTIONS.includes(f))
                          : [...new Set([...prev, ...MID_RANGE_OPTIONS])]
                      );
                    }}
                  >
                    {MID_RANGE_OPTIONS.every((f) => midRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
                  </PillButton>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MID_RANGE_OPTIONS.map((food) => (
                    <PillButton
                      key={food}
                      active={midRangeCarbs.includes(food)}
                      onClick={() =>
                        setMidRangeCarbs((prev) =>
                          prev.includes(food)
                            ? prev.filter((f) => f !== food)
                            : [...prev, food]
                        )
                      }
                    >
                      {food}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-orange-300 text-sm font-semibold flex items-center gap-2">
                      <span className="text-lg">🟠</span> High Glucose Range
                    </p>
                    <p className="text-orange-200/50 text-xs">Lower-carb choices when blood sugar is elevated</p>
                  </div>
                  <PillButton
                    active={HIGH_RANGE_OPTIONS.every((f) => highRangeCarbs.includes(f))}
                    onClick={() => {
                      const allSelected = HIGH_RANGE_OPTIONS.every((f) => highRangeCarbs.includes(f));
                      setHighRangeCarbs((prev) =>
                        allSelected
                          ? prev.filter((f) => !HIGH_RANGE_OPTIONS.includes(f))
                          : [...new Set([...prev, ...HIGH_RANGE_OPTIONS])]
                      );
                    }}
                  >
                    {HIGH_RANGE_OPTIONS.every((f) => highRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
                  </PillButton>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {HIGH_RANGE_OPTIONS.map((food) => (
                    <PillButton
                      key={food}
                      active={highRangeCarbs.includes(food)}
                      onClick={() =>
                        setHighRangeCarbs((prev) =>
                          prev.includes(food)
                            ? prev.filter((f) => f !== food)
                            : [...prev, food]
                        )
                      }
                    >
                      {food}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-3">
                <Button
                  className="w-full bg-zinc-700 text-white"
                  disabled={saving || glycemicSaving}
                  onClick={async () => {
                    await saveGlycemic({
                      ...glycemicData,
                      lowRangeCarbs,
                      midRangeCarbs,
                      highRangeCarbs,
                    });
                    await handleSave();
                  }}
                >
                  {(saving || glycemicSaving) ? "Saving..." : "Save & Exit"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-black text-white"
                    onClick={() => setStep(3)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-lime-600 text-white"
                    disabled={glycemicSaving}
                    onClick={async () => {
                      await saveGlycemic({
                        ...glycemicData,
                        lowRangeCarbs,
                        midRangeCarbs,
                        highRangeCarbs,
                      });
                      setStep(5);
                    }}
                  >
                    {glycemicSaving ? "Saving..." : "Continue"}
                  </Button>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            title="Review & save"
            subtitle="Double-check your info. Save when ready."
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-1">
                <div className="flex items-center gap-2 text-white">
                  <User className="h-4 w-4 text-lime-400" />
                  <span className="text-sm font-semibold">Summary</span>
                </div>
                <p className="text-white/80 text-xs">
                  Name: {form.firstName || "—"} {form.lastName || ""}
                </p>
                {form.nickname?.trim() && (
                  <p className="text-white/80 text-xs">
                    Preferred Name: {form.nickname}
                  </p>
                )}
                <p className="text-white/80 text-xs">
                  Goal: {form.fitnessGoal ? GOAL_LABELS[form.fitnessGoal] : "—"}
                </p>
                <p className="text-white/80 text-xs">
                  Activity:{" "}
                  {form.activityLevel
                    ? ACTIVITY_LABELS[form.activityLevel]
                    : "—"}
                </p>
                <p className="text-white/80 text-xs">
                  Personal Goal:{" "}
                  {goalType
                    ? `${goalType === "lose" ? "🔥 Lose Weight" : goalType === "gain" ? "💪 Gain Muscle" : "⚖️ Maintain Weight"}${goalTarget.trim() ? ` — ${goalTarget.trim()}` : ""}${goalTimelineWeeks ? ` in ${goalTimelineWeeks >= 52 ? "1 year" : goalTimelineWeeks >= 26 ? "6 months" : `${goalTimelineWeeks} weeks`}` : ""}`
                    : "Not set"}
                </p>
                <p className="text-white/80 text-xs">
                  Restrictions:{" "}
                  {dietaryStyle === "none" || !dietaryStyle
                    ? "None"
                    : dietaryStyle === "custom"
                      ? customDietInput.trim() || "Custom"
                      : DIET_OPTIONS.find((o) => o.value === dietaryStyle)?.label || dietaryStyle}
                </p>
                <p className="text-white/80 text-xs">
                  Allergies: {allergiesText.trim() || "None"}
                </p>
                <p className="text-white/80 text-xs">
                  Foods to Avoid: {avoidedFoods.length > 0 ? avoidedFoods.join(", ") : "None"}
                </p>
                <p className="text-white/80 text-xs">
                  Flavor: {form.palateSpiceTolerance === "none" ? "No spice" : (form.palateSpiceTolerance?.charAt(0).toUpperCase() ?? "") + (form.palateSpiceTolerance?.slice(1) ?? "")} spice, {form.palateSeasoningIntensity} seasoning
                </p>
                <p className="text-white/80 text-xs">
                  Sweeteners: {sweetenerPreferences.length > 0 ? sweetenerPreferences.join(", ") : "None selected"}
                </p>
                <p className="text-white/80 text-xs">
                  Glucose Carb Choices: {[...new Set([...lowRangeCarbs, ...midRangeCarbs, ...highRangeCarbs])].length > 0 ? `${[...new Set([...lowRangeCarbs, ...midRangeCarbs, ...highRangeCarbs])].length} foods selected across ranges` : "None selected"}
                </p>
                <p className="text-white/80 text-xs">
                  Heat Preference: {heatPreference === "none" ? "No Heat" : heatPreference === "mild" ? "Mild" : heatPreference === "medium" ? "Medium" : heatPreference === "hot" ? "Hot" : heatPreference === "very-hot" ? "Very Hot" : "Not Sure"}
                </p>
                <p className="text-white/80 text-xs">
                  Cuisine Identity: {form.cuisinePreference ? `${form.cuisinePreference.charAt(0).toUpperCase() + form.cuisinePreference.slice(1)} — ${form.cuisineIntensity || "balanced"}` : "Not set"}
                </p>
                <p className="text-white/80 text-xs">
                  Special Protocol: {specialtyCondition === "renal" ? "Kidney / Renal Disease" : specialtyCondition === "cardiac" ? "Cardiac / Heart Disease" : specialtyCondition === "liver-disease" ? "Liver Disease" : specialtyCondition === "liver-support" ? "Liver Support" : specialtyCondition === "oncology-support" ? "Cancer / Oncology Support" : "None"}
                </p>
              </div>

              <div className="flex gap-2 pt-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-black text-white"
                  onClick={() => setStep(4)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-lime-600 text-white"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Save Changes
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </StepShell>
        )}
      </div>
      
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl p-6 w-[90%] max-w-sm mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-amber-400" />
              <h3 className="text-white font-semibold">Unlock Allergies</h3>
            </div>
            <p className="text-white/70 text-sm mb-4">
              Enter your 4-digit Safety PIN to edit your allergies.
            </p>
            
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ""));
                setPinError("");
              }}
              placeholder="• • • •"
              className="text-center text-2xl tracking-[0.5em] bg-black/40 border-white/20 text-white mb-2"
              autoFocus
            />
            
            {pinError && (
              <p className="text-red-400 text-xs mb-3 text-center">{pinError}</p>
            )}
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1 bg-black/40 border-white/20 text-white"
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 text-white hover:bg-amber-500"
                onClick={verifyPinForAllergies}
                disabled={pinInput.length !== 4}
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
