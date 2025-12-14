import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Heart, Activity, Users, Utensils, Target, ArrowRight, Check } from "lucide-react";

// ----------------------------
// TYPES
// ----------------------------
interface OnboardingData {
  focus: string;
  allergies: string[];
  birthdayMonth?: string;
  birthdayDay?: string;

  macroSource: "auto" | "preset" | "default";
  sex?: string;
  weight?: number;
  height?: number;
  activity?: string;
  preset?: string;

  preferredLowGICarbs: string[];
  preferredMidGICarbs: string[];
  preferredHighGICarbs: string[];
}

// ----------------------------
// CONSTANTS
// ----------------------------
const FOCUS_OPTIONS = [
  { id: "general", label: "General", icon: Utensils, color: "indigo" },
  { id: "diabetes", label: "Diabetes", icon: Activity, color: "red" },
  { id: "glp1", label: "GLP-1", icon: Target, color: "purple" },
  { id: "cardiac", label: "Cardiac", icon: Heart, color: "pink" },
  { id: "family", label: "Family/Kids", icon: Users, color: "emerald" },
];

const ALLERGY_OPTIONS = ["nuts", "shellfish", "dairy", "gluten", "eggs", "soy"];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}`);

const lowGIOptions = ["Oats", "Lentils", "Chickpeas", "Beans", "Apples", "Berries"];
const midGIOptions = ["Brown Rice", "Quinoa", "Couscous", "Sweet Potato"];
const highGIOptions = ["White Rice", "Bread", "Potatoes", "Sugary Cereals"];

// ----------------------------
// COMPONENT
// ----------------------------
export default function OnboardingV2() {
  const [, setLocation] = useLocation();
  const TOTAL_STEPS = 3;

  const [currentScreen, setCurrentScreen] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    focus: "",
    allergies: [],
    macroSource: "auto",
    preferredLowGICarbs: [],
    preferredMidGICarbs: [],
    preferredHighGICarbs: []
  });

  const progress = (currentScreen / TOTAL_STEPS) * 100;

  // ----------------------------
  // HELPERS
  // ----------------------------
  const toggleGI = (key: "preferredLowGICarbs" | "preferredMidGICarbs" | "preferredHighGICarbs", item: string) => {
    setData((prev) => {
      const arr = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(item)
          ? arr.filter((x) => x !== item)
          : [...arr, item]
      };
    });
  };

  // ----------------------------
  // SCREEN 1 — Focus, Allergies, Birthday
  // ----------------------------
  const renderStep1 = () => (
    <div className="space-y-8">
      {/* Focus */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-white">What's your main focus?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FOCUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = data.focus === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setData({ ...data, focus: option.id })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? `border-${option.color}-500 bg-${option.color}-500/20`
                    : "border-white/20 bg-white/5 hover:border-white/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6" />
                  <span className="font-semibold text-white">{option.label}</span>
                  {isSelected && <Check className="h-5 w-5 ml-auto text-green-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Allergies */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-white">Any allergies? (Optional)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALLERGY_OPTIONS.map((allergy) => {
            const isChecked = data.allergies.includes(allergy);
            return (
              <label
                key={allergy}
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  isChecked
                    ? "border-red-500 bg-red-500/20"
                    : "border-white/20 bg-white/5 hover:border-white/40"
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    setData({
                      ...data,
                      allergies: checked
                        ? [...data.allergies, allergy]
                        : data.allergies.filter((a) => a !== allergy),
                    });
                  }}
                />
                <span className="capitalize text-sm text-white">{allergy}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Birthday */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-white">When is your birthday?</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-neutral-400 text-xs">Month</Label>
            <select
              value={data.birthdayMonth || ""}
              onChange={(e) => setData({ ...data, birthdayMonth: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
            >
              <option value="">Select</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-neutral-400 text-xs">Day</Label>
            <select
              value={data.birthdayDay || ""}
              onChange={(e) => setData({ ...data, birthdayDay: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
            >
              <option value="">Select</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Button
        onClick={() => setCurrentScreen(2)}
        disabled={!data.focus || !data.birthdayMonth || !data.birthdayDay}
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500"
      >
        Continue <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );

  // ----------------------------
  // SCREEN 2 — Macro Setup
  // ----------------------------
  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4 text-white">How should we set your macro targets?</h2>

      <RadioGroup value={data.macroSource} onValueChange={(value) => setData({ ...data, macroSource: value as any })}>
        <div className="space-y-3">

          {/* AUTO */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/20 bg-white/5 cursor-pointer hover:border-white/40">
            <RadioGroupItem value="auto" id="auto" />
            <div className="flex-1">
              <div className="font-semibold text-white mb-1">Set automatically (Recommended)</div>
              <p className="text-sm text-neutral-400">We'll calculate based on your profile</p>

              {data.macroSource === "auto" && (
                <div className="mt-4 space-y-3 pl-4 border-l-2 border-indigo-500">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Sex */}
                    <div>
                      <Label className="text-xs text-neutral-400">Sex</Label>
                      <select
                        value={data.sex || ""}
                        onChange={(e) => setData({ ...data, sex: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>

                    {/* Weight */}
                    <div>
                      <Label className="text-xs text-neutral-400">Weight (lbs)</Label>
                      <Input
                        type="number"
                        value={data.weight || ""}
                        onChange={(e) => setData({ ...data, weight: Number(e.target.value) })}
                        placeholder="150"
                        className="mt-1 bg-black/40 border-white/20 text-white"
                      />
                    </div>

                    {/* Height */}
                    <div>
                      <Label className="text-xs text-neutral-400">Height (inches)</Label>
                      <Input
                        type="number"
                        value={data.height || ""}
                        onChange={(e) => setData({ ...data, height: Number(e.target.value) })}
                        placeholder="68"
                        className="mt-1 bg-black/40 border-white/20 text-white"
                      />
                    </div>

                    {/* Activity */}
                    <div>
                      <Label className="text-xs text-neutral-400">Activity</Label>
                      <select
                        value={data.activity || ""}
                        onChange={(e) => setData({ ...data, activity: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                      >
                        <option value="">Select</option>
                        <option value="sedentary">Sedentary</option>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="active">Active</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </label>

          {/* PRESET */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/20 bg-white/5 cursor-pointer hover:border-white/40">
            <RadioGroupItem value="preset" id="preset" />
            <div className="flex-1">
              <div className="font-semibold text-white mb-1">Use a preset</div>
              <p className="text-sm text-neutral-400">Choose a common goal</p>

              {data.macroSource === "preset" && (
                <div className="mt-4 space-y-2 pl-4 border-l-2 border-indigo-500">
                  {["Weight Loss", "Maintain", "Muscle Gain"].map((preset) => (
                    <label key={preset} className="flex items-center gap-2 p-2 rounded-lg bg-black/40 cursor-pointer hover:bg-black/60">
                      <input
                        type="radio"
                        name="preset"
                        value={preset}
                        checked={data.preset === preset}
                        onChange={(e) => setData({ ...data, preset: e.target.value })}
                      />
                      <span className="text-sm text-white">{preset}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </label>

          {/* DEFAULT */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-white/20 bg-white/5 cursor-pointer hover:border-white/40">
            <RadioGroupItem value="default" id="default" />
            <div className="flex-1">
              <div className="font-semibold text-white mb-1">Use defaults / set later</div>
              <p className="text-sm text-neutral-400">Skip for now, customize anytime in Settings</p>
            </div>
          </label>
        </div>
      </RadioGroup>

      <div className="flex gap-3">
        <Button
          onClick={() => setCurrentScreen(1)}
          variant="outline"
          className="flex-1 h-12 border-white/30 bg-white/5 hover:bg-white/10 text-white"
        >
          Back
        </Button>

        <Button
          onClick={() => setCurrentScreen(3)}
          className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-500"
        >
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // ----------------------------
  // SCREEN 3 — Glycemic Preferences
  // ----------------------------
  const renderStep3 = () => (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white mb-4">Your Glycemic Preferences</h2>
      <p className="text-neutral-300 text-sm mb-6">Choose the carb types you prefer. This helps personalize your meals.</p>

      {/* Low GI */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🟢</span> Low Glycemic Index Foods
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {lowGIOptions.map((item) => (
            <label key={item} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.preferredLowGICarbs.includes(item)}
                onChange={() => toggleGI("preferredLowGICarbs", item)}
                className="h-4 w-4 rounded border-white/30"
              />
              <span className="text-white text-sm">{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Mid GI */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🟡</span> Mid Glycemic Index Foods
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {midGIOptions.map((item) => (
            <label key={item} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.preferredMidGICarbs.includes(item)}
                onChange={() => toggleGI("preferredMidGICarbs", item)}
                className="h-4 w-4 rounded border-white/30"
              />
              <span className="text-white text-sm">{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* High GI */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="text-2xl">🔴</span> High Glycemic Index Foods
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {highGIOptions.map((item) => (
            <label key={item} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={data.preferredHighGICarbs.includes(item)}
                onChange={() => toggleGI("preferredHighGICarbs", item)}
                className="h-4 w-4 rounded border-white/30"
              />
              <span className="text-white text-sm">{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Continue button */}
      <Button
        onClick={() => {
          localStorage.setItem("onboardingCompleted", "true");
          setLocation("/pricing");
        }}
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500"
      >
        Continue to Pricing <ArrowRight className="h-4 w-4 ml-2" />
      </Button>

      <Button
        variant="outline"
        onClick={() => setCurrentScreen(2)}
        className="w-full h-12 border-white/30 bg-white/5 hover:bg-white/10 text-white"
      >
        Back
      </Button>
    </div>
  );

  // ----------------------------
  // MAIN LAYOUT
  // ----------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-neutral-400">Step {currentScreen} of {TOTAL_STEPS}</span>
            <span className="text-sm text-neutral-400">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Card */}
        <Card className="bg-black/40 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Quick Setup</CardTitle>
          </CardHeader>
          <CardContent>
            {currentScreen === 1 && renderStep1()}
            {currentScreen === 2 && renderStep2()}
            {currentScreen === 3 && renderStep3()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
