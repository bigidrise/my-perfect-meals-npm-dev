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
import { ArrowRight, ArrowLeft, X, Check } from "lucide-react";
import HeightInput from "@/components/inputs/HeightInput";

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
}

const TOTAL_STEPS = 3;

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
  "Peanuts", "Tree Nuts", "Dairy", "Eggs", "Wheat/Gluten", 
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
  const [currentStep, setCurrentStep] = useState(1);
  const [showValidation, setShowValidation] = useState(false);
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [customMedicalInput, setCustomMedicalInput] = useState("");
  const [customDietaryInput, setCustomDietaryInput] = useState("");

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
          data.weight > 0 &&
          data.activityLevel !== "" &&
          data.primaryGoal !== "" &&
          (data.primaryGoal !== "custom" || data.customGoal.trim() !== "")
        );
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!isStepValid()) {
      setShowValidation(true);
      setTimeout(() => scrollToTop(), 0);
      return;
    }
    setShowValidation(false);

    if (currentStep >= TOTAL_STEPS) {
      localStorage.setItem("onboardingCompleted", "true");
      localStorage.setItem("completedProfile", "true");
      setLocation("/");
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
            Sex *
          </Label>
          <Select value={data.gender} onValueChange={(v) => updateData({ gender: v })}>
            <SelectTrigger className={`text-white bg-black/40 border-white/20 ${showValidation && !data.gender ? "border-red-500 border-2" : ""}`}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
          <Label className={showValidation && data.weight === 0 ? "text-red-400" : ""}>
            Weight (lbs) *
          </Label>
          <Input
            type="number"
            value={data.weight === 0 ? "" : data.weight}
            onChange={(e) => updateData({ weight: parseInt(e.target.value) || 0 })}
            placeholder="Your weight"
            className={`text-white bg-black/40 border-white/20 ${showValidation && data.weight === 0 ? "border-red-500 border-2" : ""}`}
          />
        </div>

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
            className={`${currentStep === 1 ? "w-full" : "flex-1"} h-12 bg-lime-600 hover:bg-lime-700 `}
          >
            {currentStep === TOTAL_STEPS ? (
              <>
                Get Started <Check className="h-4 w-4 ml-2" />
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
