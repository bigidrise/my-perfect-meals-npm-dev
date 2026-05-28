import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, ArrowLeft, PawPrint, Sparkles, BookOpen, ShoppingCart, Heart, RefreshCw } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useCopilot } from "@/components/copilot/CopilotContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const DOG_BOWL_IMAGE = "https://images.unsplash.com/photo-1601758003122-53c40e686a19?w=600&auto=format&fit=crop&q=80";

const MEAL_TYPES = [
  { value: "main", label: "Main Meal", sub: "Full nutritious meal" },
  { value: "treat", label: "Treat", sub: "Healthy homemade treat" },
  { value: "snack", label: "Snack", sub: "Light between-meal food" },
  { value: "meal-prep", label: "Meal Prep", sub: "Batch cook 5–7 servings" },
];

interface DogProfile {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
  ageYears: number;
  wellnessGoals: string[];
}

interface GeneratedMeal {
  id?: string;
  title: string;
  description: string;
  mealType: string;
  servingSize: string;
  estimatedCalories?: number;
  proteinGrams?: number;
  ingredients: { name: string; amount: string; notes?: string }[];
  instructions: string[];
  wellnessNotes?: string[];
  citationReferences?: string[];
  citationSources?: { source: string; note: string }[];
  storageNote?: string;
  veterinaryNote?: string;
  activeLayers?: string[];
}

export default function CompanionMealGenerator() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedProfileId = params.get("profileId") || "";

  const { open, setLastResponse } = useCopilot();
  const [profiles, setProfiles] = useState<DogProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState(preselectedProfileId);
  const [mealType, setMealType] = useState("main");
  const [specialRequest, setSpecialRequest] = useState("");
  const [generating, setGenerating] = useState(false);
  const [meal, setMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = "Companion Meal Generator | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/companion/profiles"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setProfiles(d.profiles || []);
        if (!preselectedProfileId && d.profiles?.length > 0) {
          setSelectedProfileId(d.profiles[0].id);
        }
      })
      .catch(() => {});
  }, [preselectedProfileId]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  function handleCopilotOpen() {
    open();
    setTimeout(() => {
      setLastResponse({
        title: "Companion Meal Generator",
        description:
          "Select your dog's profile, choose a meal type, and tap Generate. The system assembles your dog's wellness protocol and sends it through the same AI generation engine that powers your own meals — but adapted for canine nutrition. Every recipe is screened through the Toxic Ingredient Firewall before you see it.",
        spokenText:
          "Select your dog's profile, choose a meal type, and tap Generate. The system assembles your dog's wellness protocol and screens every recipe through the Toxic Ingredient Firewall for safety.",
        autoClose: false,
      });
    }, 300);
  }

  async function handleGenerate() {
    if (!selectedProfileId) return;
    setError(null);
    setMeal(null);
    setSaved(false);
    setGenerating(true);

    try {
      const res = await fetch(apiUrl("/api/companion/generate-meal"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedProfileId, mealType, specialRequest }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed. Please try again.");
        return;
      }
      setMeal(data.meal);
      window.scrollTo({ top: 600, behavior: "smooth" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!meal?.id) return;
    try {
      await fetch(apiUrl(`/api/companion/save-meal/${meal.id}`), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      setSaved(true);
    } catch {}
  }

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
            <div className="flex items-center gap-2">
              <PillButton onClick={() => setLocation("/companion")}>
                <ArrowLeft className="h-3 w-3" /> Back
              </PillButton>
              <h1 className="text-sm font-bold text-white">Meal Generator</h1>
            </div>
            <PillButton onClick={handleCopilotOpen}>How it works</PillButton>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Hero image — reused dog bowl */}
        <div className="relative h-36 rounded-xl overflow-hidden mb-5">
          <img src={DOG_BOWL_IMAGE} alt="Dog meal" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <p className="text-white font-bold text-sm">Personalized Dog Meals</p>
            <p className="text-white/60 text-xs">Screened through Toxic Ingredient Firewall</p>
          </div>
        </div>

        {/* Dog Profile Selection */}
        <div className="mb-5">
          <label className="text-white/60 text-xs mb-2 block">Generating for</label>
          {profiles.length === 0 ? (
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-white/60 text-sm mb-3">No dog profiles yet.</p>
              <PillButton onClick={() => setLocation("/companion/setup")}>Add a Dog First</PillButton>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {profiles.map((p) => (
                <PillButton
                  key={p.id}
                  active={selectedProfileId === p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                >
                  <PawPrint className="h-3 w-3" /> {p.name}
                </PillButton>
              ))}
            </div>
          )}
          {selectedProfile && (
            <p className="text-white/40 text-xs mt-2">
              {selectedProfile.breed} · {selectedProfile.ageYears}yr · {selectedProfile.weightLbs}lbs
              {selectedProfile.wellnessGoals?.length > 0 && ` · ${selectedProfile.wellnessGoals.slice(0, 2).join(", ")}`}
            </p>
          )}
        </div>

        {/* Meal Type */}
        <div className="mb-5">
          <label className="text-white/60 text-xs mb-2 block">Meal Type</label>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map((t) => (
              <PillButton key={t.value} active={mealType === t.value} onClick={() => setMealType(t.value)}>
                <div className="text-left">
                  <div className="font-semibold text-xs">{t.label}</div>
                  <div className="text-[10px] opacity-60">{t.sub}</div>
                </div>
              </PillButton>
            ))}
          </div>
        </div>

        {/* Optional Special Request */}
        <div className="mb-5">
          <label className="text-white/60 text-xs mb-1 block">Special Request (optional)</label>
          <input
            className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/60"
            placeholder="e.g. something with salmon, avoid chicken"
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
          />
        </div>

        {/* Generate Button */}
        <PillButton
          onClick={handleGenerate}
          disabled={generating || !selectedProfileId}
          className="w-full mb-6 py-4"
        >
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Generating {selectedProfile?.name}'s meal...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate {mealType === "main" ? "Meal" : mealType === "treat" ? "Treat" : mealType === "snack" ? "Snack" : "Meal Prep"}
            </>
          )}
        </PillButton>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-5">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Generated Meal Card */}
        <AnimatePresence>
          {meal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/50 border border-white/15 rounded-2xl overflow-hidden mb-5"
            >
              {/* Image */}
              <div className="relative h-40">
                <img src={DOG_BOWL_IMAGE} alt="Dog meal bowl" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <h2 className="text-white font-bold text-base leading-tight">{meal.title}</h2>
                  <span className="bg-orange-500/30 border border-orange-400/40 text-orange-300 text-[10px] px-2 py-0.5 rounded-full capitalize">
                    {meal.mealType}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Description */}
                <p className="text-white/80 text-sm leading-relaxed">{meal.description}</p>

                {/* Macros */}
                {(meal.estimatedCalories || meal.proteinGrams || meal.servingSize) && (
                  <div className="flex gap-3 flex-wrap">
                    {meal.servingSize && (
                      <div className="bg-white/5 rounded-lg px-3 py-1.5">
                        <p className="text-white/40 text-[10px]">Serving</p>
                        <p className="text-white text-xs font-semibold">{meal.servingSize}</p>
                      </div>
                    )}
                    {meal.estimatedCalories && (
                      <div className="bg-white/5 rounded-lg px-3 py-1.5">
                        <p className="text-white/40 text-[10px]">Est. Calories</p>
                        <p className="text-white text-xs font-semibold">{meal.estimatedCalories} kcal</p>
                      </div>
                    )}
                    {meal.proteinGrams && (
                      <div className="bg-white/5 rounded-lg px-3 py-1.5">
                        <p className="text-white/40 text-[10px]">Protein</p>
                        <p className="text-white text-xs font-semibold">{meal.proteinGrams}g</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Ingredients */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-orange-400" /> Ingredients
                  </h3>
                  <ul className="space-y-1.5">
                    {meal.ingredients?.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                        <span className="text-orange-400 mt-0.5">•</span>
                        <span>
                          <strong>{ing.amount}</strong> {ing.name}
                          {ing.notes && <span className="text-white/40"> — {ing.notes}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-orange-400" /> Instructions
                  </h3>
                  <ol className="space-y-2">
                    {meal.instructions?.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                        <span className="bg-orange-500/20 text-orange-300 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Wellness Notes */}
                {meal.wellnessNotes && meal.wellnessNotes.length > 0 && (
                  <div className="bg-orange-900/20 border border-orange-500/20 rounded-xl p-3">
                    <h3 className="text-orange-300 font-semibold text-xs mb-2 flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> Wellness Notes
                    </h3>
                    {meal.wellnessNotes.map((note, i) => (
                      <p key={i} className="text-white/70 text-xs mb-1">{note}</p>
                    ))}
                  </div>
                )}

                {/* Storage */}
                {meal.storageNote && (
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/50 text-[10px] font-semibold uppercase mb-1">Storage</p>
                    <p className="text-white/70 text-xs">{meal.storageNote}</p>
                  </div>
                )}

                {/* Citations */}
                {meal.citationSources && meal.citationSources.length > 0 && (
                  <div>
                    <h3 className="text-white/50 font-semibold text-[10px] uppercase mb-2 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Veterinary Sources
                    </h3>
                    <div className="space-y-1.5">
                      {meal.citationSources.map((c, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-2">
                          <p className="text-white/70 text-[10px] font-semibold">{c.source}</p>
                          <p className="text-white/40 text-[10px]">{c.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vet Disclaimer */}
                {meal.veterinaryNote && (
                  <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-amber-200/60 text-[10px] leading-relaxed">{meal.veterinaryNote}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <PillButton onClick={handleSave} disabled={saved || !meal.id} className="flex-1">
                    {saved ? <><Heart className="h-3 w-3" /> Saved</> : "Save Recipe"}
                  </PillButton>
                  <PillButton onClick={handleGenerate} disabled={generating} className="flex-1">
                    <RefreshCw className="h-3 w-3" /> Generate Again
                  </PillButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
