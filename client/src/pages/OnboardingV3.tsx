import { useState, useEffect } from "react";
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

const TOTAL_STEPS = 5;

const ALLERGY_OPTIONS = [
  "Peanuts", "Tree Nuts", "Dairy", "Lactose Intolerance", "Eggs",
  "Wheat/Gluten", "Soy", "Fish", "Shellfish", "Sesame",
];

const MEDICAL_CONDITIONS = [
  { label: "Type 1 Diabetes", value: "diabetes-type1" },
  { label: "Type 2 Diabetes", value: "diabetes-type2" },
  { label: "Prediabetes", value: "prediabetes" },
  { label: "GLP-1 Medication", value: "glp1" },
  { label: "Anti-Inflammatory Focus", value: "anti-inflammatory" },
  { label: "None", value: "none" },
];

const FLAVOR_OPTIONS = [
  { label: "Bold & Spicy", value: "bold-spicy" },
  { label: "Comfort Style", value: "comfort" },
  { label: "Mediterranean", value: "mediterranean" },
  { label: "Balanced", value: "balanced" },
  { label: "Not sure", value: "unsure" },
];

const BUILDER_OPTIONS = [
  { id: "general", name: "General Nutrition", description: "Balanced, healthy meals for everyday life" },
  { id: "diabetic", name: "Diabetes Support", description: "Blood-sugar awareness and stability" },
  { id: "glp1", name: "GLP-1 Support", description: "For users on GLP-1 medications" },
  { id: "anti-inflammatory", name: "Anti-Inflammatory", description: "Support long-term inflammation management" },
];

function getRecommendedBuilder(conditions: string[]): string {
  if (conditions.includes("diabetes-type1") || conditions.includes("diabetes-type2")) return "diabetic";
  if (conditions.includes("glp1")) return "glp1";
  if (conditions.includes("anti-inflammatory")) return "anti-inflammatory";
  return "general";
}

export default function OnboardingV3() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [flavorPreference, setFlavorPreference] = useState("");
  const [selectedBuilder, setSelectedBuilder] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");

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

  const saveProfile = async (fields: Record<string, unknown>) => {
    const res = await fetch(apiUrl("/api/users/profile"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ ...fields, fromOnboarding: true }),
    });
    if (!res.ok) throw new Error("Failed to save profile");
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

  const handleNext = async () => {
    setSaving(true);
    try {
      switch (step) {
        case 1:
          if (!firstName.trim()) {
            toast({ title: "Please enter your name", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({ firstName: firstName.trim() });
          break;
        case 2: {
          const toSave = allergies.filter((a) => a !== "None");
          await saveProfile({ allergies: toSave });
          break;
        }
        case 3:
          await saveProfile({ medicalConditions });
          break;
        case 4:
          if (!flavorPreference) {
            toast({ title: "Please pick a flavor style", variant: "destructive" });
            setSaving(false);
            return;
          }
          await saveProfile({ flavorPreference });
          break;
      }
      setStep((s) => s + 1);
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const validatePin = () => {
    if (pin.length < 4 || pin.length > 6) return "PIN must be 4-6 digits";
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
      await saveProfile({ preferredBuilder: selectedBuilder });

      await fetch(apiUrl("/api/safety-pin/set"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ pin }),
      });

      const completeRes = await fetch(apiUrl("/api/user/complete-onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ onboardingMode: "independent" }),
      });
      if (!completeRes.ok) throw new Error("Failed to complete onboarding");

      await refreshUser();
      setLocation("/macro-counter?from=onboarding");
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
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

  const canFinish = selectedBuilder && pin.length >= 4 && pin.length <= 6 && pin === confirmPin;

  const renderPage = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What should we call you?</h1>
              <p className="text-white/60 text-sm">We'll use this to personalize your experience</p>
            </div>
            <div className="max-w-sm mx-auto">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                className="text-white bg-white/10 border-white/20 text-lg h-12 text-center"
                autoFocus
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
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              {ALLERGY_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => handleAllergyToggle(item)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                    allergies.includes(item)
                      ? "bg-orange-500/20 border-orange-500 text-orange-300"
                      : "bg-white/5 border-white/15 text-white/80 hover:border-white/30"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    allergies.includes(item) ? "bg-orange-500 border-orange-500" : "border-white/30"
                  }`}>
                    {allergies.includes(item) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {item}
                </button>
              ))}
              <button
                onClick={() => handleAllergyToggle("None")}
                className={`col-span-2 flex items-center gap-2 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                  allergies.includes("None")
                    ? "bg-green-500/20 border-green-500 text-green-300"
                    : "bg-white/5 border-white/15 text-white/80 hover:border-white/30"
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                  allergies.includes("None") ? "bg-green-500 border-green-500" : "border-white/30"
                }`}>
                  {allergies.includes("None") && <Check className="w-3 h-3 text-white" />}
                </div>
                None
              </button>
            </div>
            <div className="max-w-md mx-auto flex gap-2">
              <Input
                value={customAllergyInput}
                onChange={(e) => setCustomAllergyInput(e.target.value)}
                placeholder="Add custom allergy..."
                className="text-white bg-white/10 border-white/20 flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomAllergy()}
              />
              <Button
                onClick={handleAddCustomAllergy}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                disabled={!customAllergyInput.trim()}
              >
                Add
              </Button>
            </div>
            {allergies.filter((a) => !ALLERGY_OPTIONS.includes(a) && a !== "None").length > 0 && (
              <div className="max-w-md mx-auto flex flex-wrap gap-2">
                {allergies.filter((a) => !ALLERGY_OPTIONS.includes(a) && a !== "None").map((custom) => (
                  <span
                    key={custom}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500 text-orange-300 text-sm"
                  >
                    {custom}
                    <button onClick={() => setAllergies((prev) => prev.filter((a) => a !== custom))} className="ml-1 hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Any relevant medical conditions?</h1>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto">
              {MEDICAL_CONDITIONS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => handleMedicalToggle(item.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all ${
                    medicalConditions.includes(item.value)
                      ? item.value === "none"
                        ? "bg-green-500/20 border-green-500 text-green-300"
                        : "bg-orange-500/20 border-orange-500 text-orange-300"
                      : "bg-white/5 border-white/15 text-white/80 hover:border-white/30"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                    medicalConditions.includes(item.value)
                      ? item.value === "none" ? "bg-green-500 border-green-500" : "bg-orange-500 border-orange-500"
                      : "border-white/30"
                  }`}>
                    {medicalConditions.includes(item.value) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">What's your flavor style?</h1>
            </div>
            <div className="flex flex-wrap justify-center gap-3 max-w-md mx-auto">
              {FLAVOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFlavorPreference(opt.value)}
                  className={`px-6 py-3 rounded-full border text-sm font-medium transition-all ${
                    flavorPreference === opt.value
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/5 border-white/20 text-white/80 hover:border-white/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        );

      case 5:
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
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter PIN (4-6 digits)"
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
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex-1 px-4 py-8">
        {renderPage()}
      </div>

      <div className="sticky bottom-0 bg-black/90 backdrop-blur-sm border-t border-white/10 p-4">
        <div className="flex gap-3 max-w-md mx-auto">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 border-white/20 text-white hover:bg-white/10"
              disabled={saving}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? "Saving..." : "Next"}
              {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving || !canFinish}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
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
