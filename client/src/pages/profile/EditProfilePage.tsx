import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, User, Utensils, Shield, Lock, Unlock } from "lucide-react";
import { SafetyPinSettings } from "@/components/SafetyPinSettings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { PillButton } from "@/components/ui/pill-button";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import { shouldAllowAutoOpen } from "@/components/copilot/CopilotRespectGuard";
import { isGuestMode } from "@/lib/guestMode";

type StepId = 1 | 2 | 3 | 4;

type ActivityLevel =
  | "sedentary"
  | "lightly_active"
  | "moderately_active"
  | "very_active"
  | "extremely_active";
type FitnessGoal = "weight_loss" | "muscle_gain" | "maintenance" | "endurance";

type EditProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
  dietaryRestrictions?: string[];
  allergies?: string[];
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

export default function EditProfilePage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { isOpen, open, setLastResponse } = useCopilot();

  const [step, setStep] = useState<StepId>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shouldAllowAutoOpen()) return;

    const stepPath = `/profile/edit-step-${step}`;
    
    if (CopilotExplanationStore.hasSessionOpened(stepPath)) return;

    const explanation = getGuestPageExplanation(stepPath, isGuestMode());
    if (!explanation) return;

    CopilotExplanationStore.markSessionOpened(stepPath);

    const timer = setTimeout(() => {
      if (!isOpen) {
        open();
      }
      setTimeout(() => {
        setLastResponse({
          title: explanation.title,
          description: explanation.description,
          spokenText: explanation.spokenText,
          autoClose: explanation.autoClose ?? true,
        });
      }, 300);
    }, 800);

    return () => clearTimeout(timer);
  }, [step, isOpen, open, setLastResponse]);

  const initial = useMemo(() => {
    const u: any = user || {};
    return {
      firstName: u?.firstName || u?.name?.split(" ")[0] || "",
      lastName: u?.lastName || u?.name?.split(" ").slice(1).join(" ") || "",
      email: u?.email || "",
      activityLevel: (u?.activityLevel || "moderately_active") as ActivityLevel,
      fitnessGoal: (u?.fitnessGoal || "maintenance") as FitnessGoal,
      dietaryRestrictions: Array.isArray(u?.dietaryRestrictions)
        ? u.dietaryRestrictions
        : [],
      allergies: Array.isArray(u?.allergies) ? u.allergies : [],
    };
  }, [user]);

  const [form, setForm] = useState<EditProfilePayload>(initial);
  const [dietaryText, setDietaryText] = useState(
    initial.dietaryRestrictions.join(", "),
  );
  const [allergiesText, setAllergiesText] = useState(
    initial.allergies.join(", "),
  );
  
  const [allergiesUnlocked, setAllergiesUnlocked] = useState(false);
  const [allergyEditToken, setAllergyEditToken] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    document.title = "Edit Profile | My Perfect Meals";
    setForm(initial);
    setDietaryText(initial.dietaryRestrictions.join(", "));
    setAllergiesText(initial.allergies.join(", "));
    setAllergiesUnlocked(false);
    setAllergyEditToken(null);
  }, [initial]);
  
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
    // Use the correct field based on ProCare status
    const builderType = user?.isProCare 
      ? (user?.activeBoard || user?.selectedMealBuilder)
      : (user?.selectedMealBuilder || user?.activeBoard);
    
    const builderNames: Record<string, string> = {
      weekly: "Weekly Meal Board",
      diabetic: "Diabetic Builder",
      glp1: "GLP-1 Builder",
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
      const dietaryArray = dietaryText
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
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

      const payload: EditProfilePayload & { allergyEditToken?: string } = {
        ...form,
        dietaryRestrictions: dietaryArray,
        allergies: allergiesChanged ? allergiesArray : undefined,
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
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
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
          {[1, 2, 3, 4].map((n) => (
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
          <span className="text-white/60 text-xs ml-2">Step {step} of 4</span>
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

              <div className="flex gap-2 pt-2">
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
                  value={form.fitnessGoal || "maintenance"}
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
                  value={form.activityLevel || "moderately_active"}
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

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-1/2 bg-white/5 border-white/20 text-white"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="w-1/2 bg-lime-600 text-white"
                  disabled={!canContinueStep2}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
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
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">
                  Dietary Restrictions (comma-separated)
                </label>
                <textarea
                  value={dietaryText}
                  onChange={(e) => setDietaryText(e.target.value)}
                  className="mt-1 w-full min-h-[90px] bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  placeholder="e.g. gluten-free, keto, pescatarian..."
                />
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

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-1/2 bg-white/5 border-white/20 text-white"
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button
                  className="w-1/2 bg-lime-600 text-white"
                  disabled={!canContinueStep3}
                  onClick={() => setStep(4)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 4 && (
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
                  Restrictions: {dietaryText.trim() || "None"}
                </p>
                <p className="text-white/80 text-xs">
                  Allergies: {allergiesText.trim() || "None"}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-1/2 bg-white/5 border-white/20 text-white"
                  onClick={() => setStep(3)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button
                  className="w-1/2 bg-lime-600 text-white"
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
