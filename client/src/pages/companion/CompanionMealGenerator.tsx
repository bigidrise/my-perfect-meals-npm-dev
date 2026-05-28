import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat, ArrowLeft, PawPrint, Sparkles, BookOpen,
  ShoppingCart, Heart, RefreshCw, Shield, ChevronDown, ChevronUp, Layers,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useCopilot } from "@/components/copilot/CopilotContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import ThinkingDots from "@/components/ThinkingDots";
import { DOG_MEAL_IMAGES, getDogMealImage } from "@/pages/CompanionNutritionHub";

const FALLBACK_HERO = "https://static.vecteezy.com/system/resources/thumbnails/059/352/919/large/a-silhouette-of-a-dog-against-a-golden-sunset-in-a-grassy-field-photo.jpg";

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
  images?: string[];
}

interface GeneratedMeal {
  id?: string;
  title: string;
  description: string;
  mealType: string;
  servingSize: string;
  estimatedCalories?: number;
  proteinGrams?: number;
  ingredients: { name: string; amount: string; notes?: string }[] | string[];
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
  const [dogImages, setDogImages] = useState<string[]>([]);
  const [mealType, setMealType] = useState("main");
  const [specialRequest, setSpecialRequest] = useState("");
  const [generating, setGenerating] = useState(false);
  const [meal, setMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);

  useEffect(() => {
    document.title = "Companion Meal Generator | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/companion/profiles"), { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const active = (d.profiles || []).filter((p: any) => !p.status || p.status === "active");
        setProfiles(active);
        if (!preselectedProfileId && active.length > 0) {
          setSelectedProfileId(active[0].id);
        }
      })
      .catch(() => {});
  }, [preselectedProfileId]);

  // No per-dog photo pool — always use generic food images
  useEffect(() => { setDogImages([]); }, [selectedProfileId]);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const heroImage = dogImages[0] || FALLBACK_HERO;

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
    setCitationsOpen(false);
    setProtocolOpen(false);

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
      setTimeout(() => window.scrollTo({ top: 500, behavior: "smooth" }), 200);
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

  function handleRegenerate() {
    setMeal(null);
    handleGenerate();
  }

  const wellnessGoals = selectedProfile?.wellnessGoals ?? [];
  const cardImage = meal ? getDogMealImage(dogImages, meal.id || meal.title) : FALLBACK_HERO;

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

      {/* Desktop back button */}
      <div className="hidden md:flex max-w-lg mx-auto px-4 pt-6 pb-0">
        <PillButton onClick={() => setLocation("/companion")}>
          <ArrowLeft className="h-3 w-3" /> Back to My Perfect Pets
        </PillButton>
      </div>

      <div
        className="max-w-lg mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Hero — uses dog's primary photo */}
        <div className="relative h-36 rounded-xl overflow-hidden mb-5">
          <img src={heroImage} alt={selectedProfile?.name || "Dog meal"} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2">
              <PawPrint className="h-4 w-4 text-orange-400" />
              <h1 className="text-white font-bold text-base">
                {selectedProfile ? `${selectedProfile.name}'s Kitchen` : "Homemade Meal Generator"}
              </h1>
            </div>
            <p className="text-white/60 text-xs">Personalized, safety-screened dog recipes</p>
          </div>
        </div>

        {/* Profile Selector */}
        {profiles.length > 1 && (
          <div className="mb-5">
            <p className="text-white/60 text-xs font-semibold uppercase mb-2">For which dog?</p>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                    selectedProfileId === p.id
                      ? "bg-orange-600 border-orange-500 text-white"
                      : "bg-white/5 border-white/15 text-white/60"
                  }`}
                >
                  {p.images && p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <PawPrint className="h-3 w-3" />
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {profiles.length === 0 && (
          <div className="bg-black/40 border border-white/10 rounded-xl p-5 mb-5 text-center">
            <PawPrint className="h-7 w-7 text-orange-400/50 mx-auto mb-2" />
            <p className="text-white font-semibold text-sm mb-1">No dog profile yet</p>
            <p className="text-white/50 text-xs mb-3">Create a profile to generate personalized meals.</p>
            <PillButton onClick={() => setLocation("/companion/setup")}>
              Add Your Dog
            </PillButton>
          </div>
        )}

        {/* Meal Type */}
        <div className="mb-5">
          <p className="text-white/60 text-xs font-semibold uppercase mb-2">Meal Type</p>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setMealType(t.value)}
                className={`rounded-xl p-3 text-left border transition-colors ${
                  mealType === t.value
                    ? "bg-orange-600/30 border-orange-500/60"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <p className="text-white text-xs font-semibold">{t.label}</p>
                <p className="text-white/40 text-[10px]">{t.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Special Request */}
        <div className="mb-5">
          <p className="text-white/60 text-xs font-semibold uppercase mb-2">Special Request <span className="text-white/30 normal-case font-normal">(optional)</span></p>
          <textarea
            rows={2}
            className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/60 resize-none"
            placeholder="e.g. something with salmon, avoid chicken"
            value={specialRequest}
            onChange={(e) => setSpecialRequest(e.target.value)}
          />
        </div>

        {/* Generate Button */}
        {generating ? (
          <div className="mb-6">
            <ThinkingDots label={`Crafting ${selectedProfile?.name || "your dog"}'s meal…`} />
          </div>
        ) : (
          <PillButton
            onClick={handleGenerate}
            disabled={!selectedProfileId || profiles.length === 0}
            className="w-full mb-6 py-4"
          >
            <Sparkles className="h-4 w-4" />
            Generate {mealType === "main" ? "Meal" : mealType === "treat" ? "Treat" : mealType === "snack" ? "Snack" : "Meal Prep"}
            {selectedProfile ? ` for ${selectedProfile.name}` : ""}
          </PillButton>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 mb-5">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* ── COMPANION MEAL CARD ─────────────────────────────── */}
        <AnimatePresence>
          {meal && (
            <motion.div
              key="meal-card"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl overflow-hidden mb-6"
              style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Card hero — uses dog's own image pool */}
              <div className="relative h-48">
                <img src={cardImage} alt={meal.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {/* Safety badge */}
                <div className="absolute top-3 right-3">
                  <div className="flex items-center gap-1 bg-green-900/70 backdrop-blur-sm border border-green-500/40 rounded-full px-2 py-1">
                    <Shield className="h-3 w-3 text-green-400" />
                    <span className="text-green-300 text-[10px] font-semibold">Safety Verified</span>
                  </div>
                </div>

                {/* Title block */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  {selectedProfile && (
                    <p className="text-orange-300 text-[11px] font-semibold uppercase tracking-wider mb-0.5">
                      {selectedProfile.name}'s Recipe
                    </p>
                  )}
                  <h2 className="text-white font-bold text-lg leading-snug">{meal.title}</h2>

                  {/* Meal type + wellness badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="bg-orange-500/30 border border-orange-400/40 text-orange-200 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
                      {meal.mealType}
                    </span>
                    {wellnessGoals.slice(0, 3).map((goal) => (
                      <span key={goal} className="bg-white/10 border border-white/20 text-white/70 text-[10px] px-2 py-0.5 rounded-full">
                        {goal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">

                {/* Description */}
                <p className="text-white/80 text-sm leading-relaxed">{meal.description}</p>

                {/* Nutrition stats */}
                {(meal.estimatedCalories || meal.proteinGrams || meal.servingSize) && (
                  <div className="grid grid-cols-3 gap-2">
                    {meal.servingSize && (
                      <div className="bg-white/6 border border-white/8 rounded-xl p-3 text-center">
                        <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">Serving</p>
                        <p className="text-white text-xs font-bold leading-tight">{meal.servingSize}</p>
                      </div>
                    )}
                    {meal.estimatedCalories && (
                      <div className="bg-white/6 border border-white/8 rounded-xl p-3 text-center">
                        <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">Calories</p>
                        <p className="text-white text-xs font-bold">{meal.estimatedCalories} kcal</p>
                      </div>
                    )}
                    {meal.proteinGrams && (
                      <div className="bg-white/6 border border-white/8 rounded-xl p-3 text-center">
                        <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">Protein</p>
                        <p className="text-white text-xs font-bold">{meal.proteinGrams}g</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="h-px bg-white/8" />

                {/* Ingredients */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart className="h-4 w-4 text-orange-400" />
                    <h3 className="text-white font-semibold text-sm">Ingredients</h3>
                  </div>
                  <ul className="space-y-2">
                    {Array.isArray(meal.ingredients) && meal.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-white/80 leading-snug">
                          {typeof ing === "string" ? ing : (
                            <>
                              <span className="font-semibold text-white">{ing.amount}</span>
                              {" "}{ing.name}
                              {ing.notes && <span className="text-white/40"> — {ing.notes}</span>}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="h-px bg-white/8" />

                {/* Instructions */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ChefHat className="h-4 w-4 text-orange-400" />
                    <h3 className="text-white font-semibold text-sm">Preparation</h3>
                  </div>
                  <ol className="space-y-3">
                    {Array.isArray(meal.instructions) && meal.instructions.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-orange-300"
                          style={{ background: "rgba(234,88,12,0.18)", border: "1px solid rgba(251,146,60,0.3)" }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm text-white/80 leading-relaxed pt-0.5">
                          {typeof step === "string" ? step : JSON.stringify(step)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Wellness Notes */}
                {Array.isArray(meal.wellnessNotes) && meal.wellnessNotes.length > 0 && (
                  <>
                    <div className="h-px bg-white/8" />
                    <div
                      className="rounded-xl p-4"
                      style={{ background: "rgba(194,65,12,0.15)", border: "1px solid rgba(251,146,60,0.2)" }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-orange-400" />
                        <h3 className="text-orange-200 font-semibold text-sm">Wellness Notes</h3>
                      </div>
                      <div className="space-y-1.5">
                        {meal.wellnessNotes.map((note, i) => (
                          <p key={i} className="text-white/70 text-xs leading-relaxed">{note}</p>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Storage */}
                {meal.storageNote && (
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-white/40 text-[10px] font-semibold uppercase mb-1">Storage & Freshness</p>
                    <p className="text-white/70 text-xs leading-relaxed">{meal.storageNote}</p>
                  </div>
                )}

                {/* Protocol Layers — collapsible */}
                {Array.isArray(meal.activeLayers) && meal.activeLayers.length > 0 && (
                  <>
                    <div className="h-px bg-white/8" />
                    <button
                      onClick={() => setProtocolOpen((v) => !v)}
                      className="w-full flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-orange-400/70" />
                        <span className="text-white/60 text-xs font-semibold uppercase">Protocol Applied</span>
                      </div>
                      {protocolOpen ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                    </button>
                    {protocolOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
                          {meal.activeLayers.map((layer) => (
                            <span key={layer} className="bg-orange-500/10 border border-orange-400/20 text-orange-300/80 text-[10px] px-2 py-1 rounded-full">
                              {layer}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                {/* Citations — collapsible */}
                {Array.isArray(meal.citationSources) && meal.citationSources.length > 0 && (
                  <>
                    <div className="h-px bg-white/8" />
                    <button
                      onClick={() => setCitationsOpen((v) => !v)}
                      className="w-full flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-white/40" />
                        <span className="text-white/40 text-xs font-semibold uppercase">Veterinary Sources</span>
                      </div>
                      {citationsOpen ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                    </button>
                    {citationsOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 pt-1 pb-2">
                          {meal.citationSources.map((c, i) => (
                            <div key={i} className="bg-white/4 rounded-lg px-3 py-2">
                              <p className="text-white/60 text-[11px] font-semibold">{c.source}</p>
                              <p className="text-white/35 text-[10px] leading-relaxed">{c.note}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                <div className="h-px bg-white/8" />

                {/* Action buttons */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <PillButton
                      onClick={handleSave}
                      disabled={saved || !meal.id}
                      className="w-full py-3"
                    >
                      <Heart className={`h-3.5 w-3.5 ${saved ? "fill-orange-400" : ""}`} />
                      {saved ? "Saved to Collection" : "Save Recipe"}
                    </PillButton>
                    <PillButton onClick={handleRegenerate} className="w-full py-3">
                      <RefreshCw className="h-3.5 w-3.5" /> New Recipe
                    </PillButton>
                  </div>

                  {/* Vet disclaimer */}
                  {meal.veterinaryNote && (
                    <p className="text-white/25 text-[10px] leading-relaxed text-center pt-1">
                      {meal.veterinaryNote}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
