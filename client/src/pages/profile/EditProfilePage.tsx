import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, User, Utensils, Shield } from "lucide-react";
import { SafetyPinSettings } from "@/components/SafetyPinSettings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";

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
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  activityLevel?: ActivityLevel;
  fitnessGoal?: FitnessGoal;
  dietaryRestrictions?: string[];
  allergies?: string[];
};

function clampInt(val: string): number | null {
  const n = Number(val);
  if (!Number.isFinite(n) || val.trim() === "") return null;
  return Math.max(0, Math.floor(n));
}

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

  const [step, setStep] = useState<StepId>(1);
  const [saving, setSaving] = useState(false);

  const initial = useMemo(() => {
    const u: any = user || {};
    return {
      firstName: u?.firstName || u?.name?.split(" ")[0] || "",
      lastName: u?.lastName || u?.name?.split(" ").slice(1).join(" ") || "",
      email: u?.email || "",
      age: typeof u?.age === "number" ? u.age : null,
      height: typeof u?.height === "number" ? u.height : null,
      weight: typeof u?.weight === "number" ? u.weight : null,
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

  useEffect(() => {
    document.title = "Edit Profile | My Perfect Meals";
    setForm(initial);
    setDietaryText(initial.dietaryRestrictions.join(", "));
    setAllergiesText(initial.allergies.join(", "));
  }, [initial]);

  const currentBuilderLabel = useMemo(() => {
    const u: any = user || {};
    return (
      u?.builderName ||
      u?.mealBuilderName ||
      u?.builder ||
      u?.selectedBuilder ||
      "Meal Builder"
    );
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

      const payload: EditProfilePayload = {
        ...form,
        dietaryRestrictions: dietaryArray,
        allergies: allergiesArray,
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
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-lg font-bold text-white">Edit Profile</h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <Utensils className="h-3.5 w-3.5 text-lime-400" />
              <span className="text-[11px] text-white/80">
                Builder:{" "}
                <span className="text-white">
                  {String(currentBuilderLabel)}
                </span>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="text-white/70 text-xs">Age</label>
                  <input
                    value={form.age ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, age: clampInt(e.target.value) }))
                    }
                    className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    placeholder="35"
                    inputMode="numeric"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="text-white/70 text-xs">Height (in)</label>
                  <input
                    value={form.height ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        height: clampInt(e.target.value),
                      }))
                    }
                    className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    placeholder="70"
                    inputMode="numeric"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <label className="text-white/70 text-xs">Weight (lbs)</label>
                  <input
                    value={form.weight ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        weight: clampInt(e.target.value),
                      }))
                    }
                    className="mt-1 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    placeholder="165"
                    inputMode="numeric"
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
                  className="w-full bg-lime-600 text-black"
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
                  className="w-1/2 bg-lime-600 text-black"
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

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <label className="text-white/70 text-xs">
                  Allergies (comma-separated)
                </label>
                <textarea
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  className="mt-1 w-full min-h-[90px] bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  placeholder="e.g. peanuts, dairy, shellfish..."
                />
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-300 font-semibold text-sm">SafetyGuard™ — Allergy Protection</span>
                </div>
                <p className="text-white/70 text-xs mb-3">
                  Set a 4-digit PIN to allow one-time overrides when you intentionally want to modify an allergy-blocked meal.
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
                  className="w-1/2 bg-lime-600 text-black"
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
                  className="w-1/2 bg-lime-600 text-black"
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
    </div>
  );
}
