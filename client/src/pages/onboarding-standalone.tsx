import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, X, Check, Shield, Eye, EyeOff, Utensils, Heart, Pill, Flame, Dumbbell, UserCheck } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import HeightInput from "@/components/inputs/HeightInput";
import { getDeviceId } from "@/utils/deviceId";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

const BUILDER_OPTIONS_DATA = [
  {
    id: "weekly",
    name: "General Nutrition",
    subtitle: "Everyday Planning",
    iconType: "utensils",
    description: "Balanced, healthy meals for everyday life. Focuses on flexibility, variety, and realistic meal planning.",
    note: "Designed for healthy eating without special medical rules.",
    planBadge: "Basic Plan",
  },
  {
    id: "diabetic",
    name: "Diabetes Support",
    iconType: "heart",
    description: "Blood-sugar awareness and consistency. Diabetic-friendly guardrails for stable energy and glucose response.",
    planBadge: "Basic Plan",
  },
  {
    id: "glp1",
    name: "GLP-1 Support",
    iconType: "pill",
    description: "For users on GLP-1 medications. Emphasizes satiety, protein, portion control, and digestive comfort.",
    planBadge: "Basic Plan",
  },
  {
    id: "anti_inflammatory",
    name: "Anti-Inflammatory",
    iconType: "flame",
    description: "Nutrient quality and preparation methods that support long-term inflammation management.",
    planBadge: "Basic Plan",
  },
  {
    id: "beachbody",
    name: "Beach Body / Physique",
    iconType: "dumbbell",
    description: "Leaning out and dialing in body composition while keeping meals realistic and sustainable.",
    planBadge: "Ultimate Plan",
  },
  {
    id: "professional",
    name: "Professional / Coach",
    iconType: "usercheck",
    description: "For working with a trainer, coach, or healthcare professional. Follows structured protocols.",
    note: "Typically part of advanced or guided programs.",
    planBadge: "Ultimate Plan",
  },
];

interface OnboardingData {
  firstName: string;
  lastName: string;
  age: number;
  birthdayMonth: string;
  birthdayDay: string;
  gender: string;
  height: number;
  weight: number;
  activityLevel: string;
  primaryGoal: string;
  customGoal: string;
  medicalConditions: string[];
  foodAllergies: string[];
  dietaryRestrictions: string[];
  customAllergies: string[];
  customMedicalConditions: string[];
  customDietaryRestrictions: string[];
  preferredLowGICarbs: string[];
  preferredMidGICarbs: string[];
  preferredHighGICarbs: string[];
  palateSpiceTolerance: "none" | "mild" | "medium" | "hot";
  palateSeasoningIntensity: "light" | "balanced" | "bold";
  palateFlavorStyle: "classic" | "herb" | "savory" | "bright";
}

const TOTAL_STEPS = 4;

const medicalConditionsList = [
  { id: "diabetes-type1", label: "Type 1 Diabetes", category: "metabolic" },
  { id: "diabetes-type2", label: "Type 2 Diabetes", category: "metabolic" },
  { id: "pre-diabetes", label: "Pre-Diabetes", category: "metabolic" },
  { id: "hypothyroid", label: "Hypothyroidism", category: "metabolic" },
  { id: "hyperthyroid", label: "Hyperthyroidism", category: "metabolic" },
  { id: "insulin-resistance", label: "Insulin Resistance", category: "metabolic" },
  { id: "pcos", label: "PCOS", category: "hormonal" },
  { id: "hypertension", label: "High Blood Pressure", category: "cardiovascular" },
  { id: "heart-disease", label: "Heart Disease", category: "cardiovascular" },
  { id: "high-cholesterol", label: "High Cholesterol", category: "cardiovascular" },
  { id: "celiac", label: "Celiac Disease", category: "digestive" },
  { id: "ibs", label: "IBS", category: "digestive" },
  { id: "crohns", label: "Crohn's Disease", category: "digestive" },
  { id: "gerd", label: "GERD", category: "digestive" },
  { id: "kidney-disease", label: "Kidney Disease", category: "renal" },
];

const allergyOptions = [
  "Peanuts", "Tree Nuts", "Dairy", "Lactose Intolerance", "Eggs", "Wheat/Gluten", 
  "Soy", "Fish", "Shellfish", "Sesame"
];

const dietaryRestrictionOptions = [
  "Vegetarian", "Vegan", "Pescatarian", "Keto", "Paleo",
  "Low-Carb", "Low-Fat", "Low-Sodium", "Halal", "Kosher"
];

const lowGIOptions = [
  "Berries", "Cherries", "Apples", "Pears", "Grapefruit",
  "Leafy Greens", "Broccoli", "Cauliflower", "Zucchini", "Green Beans",
  "Lentils", "Chickpeas", "Black Beans", "Quinoa", "Steel-cut Oats",
  "Sweet Potato (small)", "Carrots", "Tomatoes", "Cucumber", "Peppers"
];

const midGIOptions = [
  "Brown Rice", "Whole Wheat Pasta", "Whole Grain Bread", "Couscous",
  "Pineapple", "Bananas", "Corn", "Sweet Potato (medium)", "Basmati Rice"
];

const highGIOptions = [
  "White Rice", "White Bread", "Potatoes (baked)", "Watermelon",
  "Dates", "Rice Cakes", "Instant Oatmeal"
];

export default function OnboardingStandalone() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [showValidation, setShowValidation] = useState(false);
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [customMedicalInput, setCustomMedicalInput] = useState("");
  const [customDietaryInput, setCustomDietaryInput] = useState("");
  
  // Page 4: Builder Selection + Safety PIN
  const [selectedBuilder, setSelectedBuilder] = useState("weekly");
  const [safetyPin, setSafetyPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    firstName: "",
    lastName: "",
    age: 0,
    birthdayMonth: "",
    birthdayDay: "",
    gender: "",
    height: 0,
    weight: 0,
    activityLevel: "",
    primaryGoal: "",
    customGoal: "",
    medicalConditions: [],
    foodAllergies: [],
    dietaryRestrictions: [],
    customAllergies: [],
    customMedicalConditions: [],
    customDietaryRestrictions: [],
    preferredLowGICarbs: [],
    preferredMidGICarbs: [],
    preferredHighGICarbs: [],
    palateSpiceTolerance: "mild",
    palateSeasoningIntensity: "balanced",
    palateFlavorStyle: "classic",
  });

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const handleArrayToggle = (field: keyof OnboardingData, value: string) => {
    const currentArray = data[field] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value];
    updateData({ [field]: newArray });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  useEffect(() => {
    scrollToTop();
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem("onboardingData", JSON.stringify(data));
  }, [data]);

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 1:
        return (
          data.firstName.trim() !== "" &&
          data.lastName.trim() !== "" &&
          data.age > 0 &&
          data.birthdayMonth !== "" &&
          data.birthdayDay !== "" &&
          data.gender !== "" &&
          data.height > 0 &&
          data.activityLevel !== "" &&
          data.primaryGoal !== "" &&
          (data.primaryGoal !== "custom" || data.customGoal.trim() !== "")
        );
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        // Builder must be selected (always true since we have a default)
        // PIN is optional - user can skip
        if (safetyPin.length > 0 || confirmPin.length > 0) {
          // If they started entering a PIN, validate it
          if (safetyPin.length !== 4) return false;
          if (safetyPin !== confirmPin) return false;
        }
        return true;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!isStepValid()) {
      setShowValidation(true);
      setTimeout(() => scrollToTop(), 0);
      return;
    }
    setShowValidation(false);

    if (currentStep >= TOTAL_STEPS) {
      // Get auth token once for all save operations
      const deviceId = getDeviceId();
      const authToken = getAuthToken();
      
      // Save onboarding data to server - includes userId for syncing to Edit Profile
      try {
        const headers: Record<string, string> = { 
          "Content-Type": "application/json",
          "X-Device-Id": deviceId
        };
        if (authToken) {
          headers["x-auth-token"] = authToken;
        }
        
        await fetch("/api/onboarding/step/standalone-profile", {
          method: "PUT",
          headers,
          credentials: "include",
          body: JSON.stringify({ 
            data: {
              firstName: data.firstName,
              lastName: data.lastName,
              age: data.age,
              birthdayMonth: data.birthdayMonth,
              birthdayDay: data.birthdayDay,
              gender: data.gender,
              height: data.height,
              weight: data.weight,
              activityLevel: data.activityLevel,
              primaryGoal: data.primaryGoal,
              customGoal: data.customGoal,
              medicalConditions: [...data.medicalConditions, ...data.customMedicalConditions],
              foodAllergies: [...data.foodAllergies, ...data.customAllergies],
              dietaryRestrictions: [...data.dietaryRestrictions, ...data.customDietaryRestrictions],
              preferredLowGICarbs: data.preferredLowGICarbs,
              preferredMidGICarbs: data.preferredMidGICarbs,
              preferredHighGICarbs: data.preferredHighGICarbs,
              palateSpiceTolerance: data.palateSpiceTolerance,
              palateSeasoningIntensity: data.palateSeasoningIntensity,
              palateFlavorStyle: data.palateFlavorStyle,
              activeBuilder: selectedBuilder, // Save selected builder
            },
            userId: user?.id, // Pass userId to sync to Edit Profile
            completed: true,
            apply: true
          }),
        });
        console.log("✅ Onboarding data saved to server and synced to profile");
      } catch (profileError) {
        console.error("Failed to save onboarding profile data:", profileError);
        // Continue anyway - data is saved locally
      }
      
      // Save Safety PIN if provided (separate try-catch so profile failure doesn't block PIN)
        if (safetyPin.length === 4 && safetyPin === confirmPin && authToken) {
          try {
            const pinResponse = await fetch(apiUrl("/api/safety-pin/set"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-auth-token": authToken,
              },
              body: JSON.stringify({ pin: safetyPin }),
            });
            if (pinResponse.ok) {
              console.log("✅ Safety PIN saved successfully");
            }
          } catch (pinError) {
            console.error("Failed to save Safety PIN:", pinError);
          }
        }
        
        // Save builder to user profile via API
        if (authToken) {
          try {
            await fetch(apiUrl("/api/user/select-meal-builder"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-auth-token": authToken,
              },
              body: JSON.stringify({ selectedMealBuilder: selectedBuilder }),
            });
            console.log("✅ Builder selection saved:", selectedBuilder);
          } catch (builderError) {
            console.error("Failed to save builder selection:", builderError);
          }
        }
        
        // Refresh user data to get updated profile
        if (user?.id) {
          await refreshUser?.();
        }
      
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("completedProfile", "true");
      localStorage.setItem("onboardingData", JSON.stringify(data));
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("selectedBuilder", selectedBuilder);

      // Flag WelcomeGate to show once
      localStorage.removeItem("coachMode");
      localStorage.setItem("showWelcomeGate", "true");

      // Go straight to the Macro Calculator — this is where everything begins
      setLocation("/macro-calculator");
    } else {
      setCurrentStep((prev) => prev + 1);
      setTimeout(() => scrollToTop(), 0);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setTimeout(() => scrollToTop(), 0);
    }
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergyInput.trim();
    if (trimmed && !data.customAllergies.includes(trimmed)) {
      updateData({ customAllergies: [...data.customAllergies, trimmed] });
      setCustomAllergyInput("");
    }
  };

  const handleAddCustomMedical = () => {
    const trimmed = customMedicalInput.trim();
    if (trimmed && !data.customMedicalConditions.includes(trimmed)) {
      updateData({ customMedicalConditions: [...data.customMedicalConditions, trimmed] });
      setCustomMedicalInput("");
    }
  };

  const handleAddCustomDietary = () => {
    const trimmed = customDietaryInput.trim();
    if (trimmed && !data.customDietaryRestrictions.includes(trimmed)) {
      updateData({ customDietaryRestrictions: [...data.customDietaryRestrictions, trimmed] });
      setCustomDietaryInput("");
    }
  };

  const handleSaveStep2 = () => {
    localStorage.setItem("onboardingData", JSON.stringify(data));
  };

  const renderStep1 = () => (
    <Card className="w-full max-w-lg mx-auto bg-black/40 backdrop-blur-md border-white/15">
      <CardHeader className="bg-gradient-to-br from-neutral-600 via-black/60 to-black text-white rounded-t-lg">
        <CardTitle className="text-center text-xl">Welcome! Let's Get Started</CardTitle>
        <p className="text-sm text-white/80 text-center mt-2">
          Tell us about yourself so we can personalize your meal plans.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-white pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className={showValidation && !data.firstName ? "text-red-400" : ""}>
              First Name *
            </Label>
            <Input
              value={data.firstName}
              onChange={(e) => updateData({ firstName: e.target.value })}
              placeholder="First name"
              className={`text-white bg-black/40 border-white/20 ${showValidation && !data.firstName ? "border-red-500 border-2" : ""}`}
            />
          </div>
          <div>
            <Label className={showValidation && !data.lastName ? "text-red-400" : ""}>
              Last Name *
            </Label>
            <Input
              value={data.lastName}
              onChange={(e) => updateData({ lastName: e.target.value })}
              placeholder="Last name"
              className={`text-white bg-black/40 border-white/20 ${showValidation && !data.lastName ? "border-red-500 border-2" : ""}`}
            />
          </div>
        </div>

        <div>
          <Label className={showValidation && data.age === 0 ? "text-red-400" : ""}>
            Age *
          </Label>
          <Input
            type="number"
            value={data.age === 0 ? "" : data.age}
            onChange={(e) => updateData({ age: parseInt(e.target.value) || 0 })}
            placeholder="Your age"
            className={`text-white bg-black/40 border-white/20 ${showValidation && data.age === 0 ? "border-red-500 border-2" : ""}`}
          />
        </div>

        <div>
          <Label className={showValidation && (!data.birthdayMonth || !data.birthdayDay) ? "text-white" : ""}>
            Birthday (Month & Day) *
          </Label>
          <div className="flex gap-2">
            <Select value={data.birthdayMonth} onValueChange={(v) => updateData({ birthdayMonth: v })}>
              <SelectTrigger className={`flex-1 text-white bg-black/40 border-white/20 ${showValidation && !data.birthdayMonth ? "border-red-500 border-2" : ""}`}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                  <SelectItem key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={data.birthdayDay} onValueChange={(v) => updateData({ birthdayDay: v })}>
              <SelectTrigger className={`w-24 text-white bg-black/40 border-white/20 ${showValidation && !data.birthdayDay ? "border-red-500 border-2" : ""}`}>
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 31 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString().padStart(2, "0")}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-white/60 mt-1">We'll wish you happy birthday!</p>
        </div>

        <div>
          <Label className={showValidation && !data.gender ? "text-red-400" : ""}>
            Sex (Biological) *
          </Label>

          <Select value={data.gender} onValueChange={(v) => updateData({ gender: v })}>
            <SelectTrigger
              className={`text-white bg-black/40 border-white/20 ${
                showValidation && !data.gender ? "border-red-500 border-2" : ""
              }`}
            >
              <SelectValue placeholder="Select biological sex" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>


        <HeightInput
          valueInches={data.height}
          onChange={(inches) => updateData({ height: inches })}
          allowMetricToggle={true}
          label="Height *"
        />

        <div>
          <Label className={showValidation && !data.activityLevel ? "text-red-400" : ""}>
            Activity Level *
          </Label>
          <Select value={data.activityLevel} onValueChange={(v) => updateData({ activityLevel: v })}>
            <SelectTrigger className={`text-white bg-black/40 border-white/20 ${showValidation && !data.activityLevel ? "border-red-500 border-2" : ""}`}>
              <SelectValue placeholder="Select activity level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentary (desk job, little exercise)</SelectItem>
              <SelectItem value="lightly_active">Lightly Active (1-3 days/week)</SelectItem>
              <SelectItem value="moderately_active">Moderately Active (3-5 days/week)</SelectItem>
              <SelectItem value="very_active">Very Active (6-7 days/week)</SelectItem>
              <SelectItem value="extremely_active">Extremely Active (physical job)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className={showValidation && !data.primaryGoal ? "text-red-400" : ""}>
            Primary Goal *
          </Label>
          <Select value={data.primaryGoal} onValueChange={(v) => updateData({ primaryGoal: v, customGoal: v !== "custom" ? "" : data.customGoal })}>
            <SelectTrigger className={`text-white bg-black/40 border-white/20 ${showValidation && !data.primaryGoal ? "border-red-500 border-2" : ""}`}>
              <SelectValue placeholder="Select your goal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weight_loss">Weight Loss</SelectItem>
              <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="health_improvement">Health Improvement</SelectItem>
              <SelectItem value="energy_boost">Energy Boost</SelectItem>
              <SelectItem value="custom">Other (Custom Goal)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.primaryGoal === "custom" && (
          <div>
            <Label className={showValidation && !data.customGoal.trim() ? "text-red-400" : ""}>
              Your Custom Goal *
            </Label>
            <Input
              value={data.customGoal}
              onChange={(e) => updateData({ customGoal: e.target.value })}
              placeholder="e.g., Improve athletic performance"
              className={`text-white bg-black/40 border-white/20 ${showValidation && !data.customGoal.trim() ? "border-red-500 border-2" : ""}`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border-white/15">
      <CardHeader className="bg-gradient-to-br from-neutral-600 via-black/60 to-black text-white rounded-t-lg">
        <CardTitle className="text-center text-xl">Medical & Dietary Information</CardTitle>
        <p className="text-sm text-white/80 text-center mt-2">
          This helps us create safe, personalized meal plans for you. (All optional)
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-white pt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Medical Conditions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {medicalConditionsList.map((condition) => (
              <label key={condition.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.medicalConditions.includes(condition.id)}
                  onChange={() => handleArrayToggle("medicalConditions", condition.id)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{condition.label}</span>
              </label>
            ))}
          </div>
          
          <div className="mt-3 flex gap-2">
            <Input
              value={customMedicalInput}
              onChange={(e) => setCustomMedicalInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomMedical())}
              placeholder="Add other condition..."
              className="flex-1 text-white bg-black/40 border-white/20"
            />
            <Button onClick={handleAddCustomMedical} size="sm" disabled={!customMedicalInput.trim()} className="bg-black text-white border border-white/30 hover:bg-white/10">
              Add
            </Button>
          </div>
          
          {data.customMedicalConditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.customMedicalConditions.map((condition) => (
                <Badge key={condition} variant="secondary" className="bg-white/20 text-white">
                  {condition}
                  <button onClick={() => updateData({ customMedicalConditions: data.customMedicalConditions.filter((c) => c !== condition) })} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Food Allergies</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allergyOptions.map((allergy) => (
              <label key={allergy} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.foodAllergies.includes(allergy)}
                  onChange={() => handleArrayToggle("foodAllergies", allergy)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{allergy}</span>
              </label>
            ))}
          </div>
          
          <div className="mt-3 flex gap-2">
            <Input
              value={customAllergyInput}
              onChange={(e) => setCustomAllergyInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomAllergy())}
              placeholder="Add other allergy..."
              className="flex-1 text-white bg-black/40 border-white/20"
            />
            <Button onClick={handleAddCustomAllergy} size="sm" disabled={!customAllergyInput.trim()} className="bg-black text-white border border-white/30 hover:bg-white/10">
              Add
            </Button>
          </div>
          
          {data.customAllergies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.customAllergies.map((allergy) => (
                <Badge key={allergy} variant="secondary" className="bg-white/20 text-white">
                  {allergy}
                  <button onClick={() => updateData({ customAllergies: data.customAllergies.filter((a) => a !== allergy) })} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Dietary Restrictions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {dietaryRestrictionOptions.map((restriction) => (
              <label key={restriction} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.dietaryRestrictions.includes(restriction)}
                  onChange={() => handleArrayToggle("dietaryRestrictions", restriction)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{restriction}</span>
              </label>
            ))}
          </div>
          
          <div className="mt-3 flex gap-2">
            <Input
              value={customDietaryInput}
              onChange={(e) => setCustomDietaryInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomDietary())}
              placeholder="Add other restriction..."
              className="flex-1 text-white bg-black/40 border-white/20"
            />
            <Button onClick={handleAddCustomDietary} size="sm" disabled={!customDietaryInput.trim()} className="bg-black text-white border border-white/30 hover:bg-white/10">
              Add
            </Button>
          </div>
          
          {data.customDietaryRestrictions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.customDietaryRestrictions.map((restriction) => (
                <Badge key={restriction} variant="secondary" className="bg-white/20 text-white">
                  {restriction}
                  <button onClick={() => updateData({ customDietaryRestrictions: data.customDietaryRestrictions.filter((r) => r !== restriction) })} className="ml-1 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/10">
          <Button 
            onClick={handleSaveStep2} 
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            <Check className="h-4 w-4 mr-2" /> Save Medical & Dietary Info
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border-white/15">
      <CardHeader className="bg-gradient-to-br from-neutral-600 via-black/60 to-black text-white rounded-t-lg">
        <CardTitle className="text-center text-xl">Your Glycemic Preferences</CardTitle>
        <p className="text-sm text-white/80 text-center mt-2">
          Select your preferred carbs to personalize your meal recommendations.
        </p>
      </CardHeader>
      <CardContent className="space-y-8 text-white pt-6">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">🟢</span> Low Glycemic Index Foods
          </h3>
          <p className="text-white/80 text-sm">Best for stable blood sugar</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {lowGIOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.preferredLowGICarbs.includes(option)}
                  onChange={() => handleArrayToggle("preferredLowGICarbs", option)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">🟡</span> Mid Glycemic Index Foods
          </h3>
          <p className="text-white/80 text-sm">Moderate energy release</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {midGIOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.preferredMidGICarbs.includes(option)}
                  onChange={() => handleArrayToggle("preferredMidGICarbs", option)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">🔴</span> High Glycemic Index Foods
          </h3>
          <p className="text-white/80 text-sm">Quick energy, use sparingly</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {highGIOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.preferredHighGICarbs.includes(option)}
                  onChange={() => handleArrayToggle("preferredHighGICarbs", option)}
                  className="h-4 w-4 rounded border-white/30"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Palate Preferences Section */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-xl font-semibold mb-2">Flavor Preferences (Optional)</h3>
          <p className="text-white/70 text-sm mb-6">
            Help us season meals to your taste. You can change this anytime later.
          </p>

          <div className="space-y-6">
            {/* Spice Tolerance */}
            <div className="space-y-3">
              <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🌶️</span> Spice Tolerance
              </label>
              <div className="flex flex-wrap gap-2">
                {(["none", "mild", "medium", "hot"] as const).map((level) => (
                  <PillButton
                    key={level}
                    active={data.palateSpiceTolerance === level}
                    onClick={() => updateData({ palateSpiceTolerance: level })}
                  >
                    {level === "none" ? "None" : level === "mild" ? "Mild" : level === "medium" ? "Medium" : "Hot"}
                  </PillButton>
                ))}
              </div>
            </div>

            {/* Seasoning Intensity */}
            <div className="space-y-3">
              <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🧂</span> Seasoning Intensity
              </label>
              <div className="flex flex-wrap gap-2">
                {(["light", "balanced", "bold"] as const).map((level) => (
                  <PillButton
                    key={level}
                    active={data.palateSeasoningIntensity === level}
                    onClick={() => updateData({ palateSeasoningIntensity: level })}
                  >
                    {level === "light" ? "Light" : level === "balanced" ? "Balanced" : "Bold"}
                  </PillButton>
                ))}
              </div>
            </div>

            {/* Flavor Style */}
            <div className="space-y-3">
              <label className="text-white/90 text-sm font-medium flex items-center gap-2">
                <span className="text-lg">🌿</span> Flavor Style
              </label>
              <div className="flex flex-wrap gap-2">
                {(["classic", "herb", "savory", "bright"] as const).map((style) => (
                  <PillButton
                    key={style}
                    active={data.palateFlavorStyle === style}
                    onClick={() => updateData({ palateFlavorStyle: style })}
                  >
                    {style === "classic" ? "Classic" : style === "herb" ? "Herb-forward" : style === "savory" ? "Savory" : "Bright & Fresh"}
                  </PillButton>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getBuilderIcon = (iconType: string) => {
    switch (iconType) {
      case "utensils": return <Utensils className="w-5 h-5" />;
      case "heart": return <Heart className="w-5 h-5" />;
      case "pill": return <Pill className="w-5 h-5" />;
      case "flame": return <Flame className="w-5 h-5" />;
      case "dumbbell": return <Dumbbell className="w-5 h-5" />;
      case "usercheck": return <UserCheck className="w-5 h-5" />;
      default: return <Utensils className="w-5 h-5" />;
    }
  };

  const renderStep4 = () => (
    <Card className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border-white/15">
      <CardHeader className="bg-gradient-to-br from-neutral-600 via-black/60 to-black text-white rounded-t-lg">
        <CardTitle className="text-center text-xl">Choose Your Starting Builder</CardTitle>
        <p className="text-sm text-white/80 text-center mt-2">
          This isn't permanent. It's simply where we'll start based on what you told us.
          You can switch builders later as your goals, needs, or support change.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-white pt-6">
        {/* Builder Selection */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold mb-2">Your Meal Planning Builder</h3>
          <p className="text-white/70 text-sm mb-2">
            Each builder follows a different set of rules. Pick the one that best matches your current needs.
          </p>
          <p className="text-emerald-400/80 text-xs mb-4">
            You can always change your builder later in Settings.
          </p>
          
          {BUILDER_OPTIONS_DATA.map((builder) => (
            <div
              key={builder.id}
              className={`p-3 rounded-xl border transition-all ${
                selectedBuilder === builder.id
                  ? "border-emerald-500/50 bg-white/10"
                  : "border-white/20 bg-black/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-black/40 text-white flex-shrink-0">
                  {getBuilderIcon(builder.iconType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{builder.name}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        builder.planBadge === "Ultimate Plan" 
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {builder.planBadge}
                      </span>
                    </div>
                    <PillButton
                      active={selectedBuilder === builder.id}
                      onClick={() => setSelectedBuilder(builder.id)}
                      className="flex-shrink-0"
                    >
                      {selectedBuilder === builder.id ? "On" : "Off"}
                    </PillButton>
                  </div>
                  <p className="text-white/60 text-xs mt-1">{builder.description}</p>
                  {builder.note && (
                    <p className="text-amber-400/80 text-xs mt-1 italic">{builder.note}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Safety PIN Section */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Allergy Safety Protection</h3>
              <p className="text-white/60 text-xs">Optional 4-digit PIN for safety overrides</p>
            </div>
          </div>

          <div className="bg-black/30 rounded-xl p-4 border border-white/10 space-y-4">
            <p className="text-white/80 text-sm leading-relaxed">
              My Perfect Meals includes a two-layer allergy protection system designed to help prevent meals from being created with ingredients you've marked as unsafe.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              In rare cases, you may want to temporarily override allergy protection for a specific meal. To prevent accidental changes, a <span className="text-green-400 font-medium">4-digit Safety PIN</span> is required.
            </p>

            <div className="bg-black/20 rounded-lg p-3 space-y-2">
              <p className="text-white/60 text-xs font-medium uppercase tracking-wide">Safety Rules</p>
              <ul className="text-white/70 text-xs space-y-1">
                <li>• Required <strong>every time</strong> allergy protection is turned off</li>
                <li>• Applies to <strong>one meal only</strong></li>
                <li>• Automatically turns back on after generation</li>
                <li>• Does <strong>not</strong> affect medical or clinical rules</li>
              </ul>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-white/80 text-sm">Create Your 4-Digit Safety PIN</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="4 digits"
                  value={safetyPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setSafetyPin(val);
                    setPinError(null);
                  }}
                  className="bg-black/40 border-white/20 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setConfirmPin(val);
                    setPinError(null);
                  }}
                  className="bg-black/40 border-white/20 text-white"
                />
              </div>

              {pinError && (
                <p className="text-red-400 text-xs">{pinError}</p>
              )}

              {safetyPin.length > 0 && confirmPin.length > 0 && safetyPin !== confirmPin && (
                <p className="text-amber-400 text-xs">PINs do not match</p>
              )}

              {safetyPin.length === 4 && confirmPin.length === 4 && safetyPin === confirmPin && (
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <Check className="w-3 h-3" /> PIN ready to save
                </p>
              )}

              <p className="text-white/50 text-xs italic">
                You can skip this step and set up your PIN later in Settings.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white flex flex-col p-4">
      <div className="w-full max-w-2xl mx-auto flex-1">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-400">Step {currentStep} of {TOTAL_STEPS}</span>
            <span className="text-sm text-neutral-400">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="mb-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        <div className="flex gap-3 max-w-2xl mx-auto">
          {currentStep > 1 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex-1 h-12 border-white/30 bg-white/5 hover:bg-white/10 text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            className={`${currentStep === 1 ? "w-full" : "flex-1"} h-12 bg-lime-600 hover:bg-lime-700`}
          >
            {currentStep === TOTAL_STEPS ? (
              <>
                Go to Macro Calculator <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
