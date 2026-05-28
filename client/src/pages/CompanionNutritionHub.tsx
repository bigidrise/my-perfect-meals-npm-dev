import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  PawPrint, Plus, ChefHat, Search, Heart, Crown, ArrowRight,
  ArrowLeft, BookOpen, Archive, RotateCcw, ChevronDown, ChevronUp, Camera,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import { useCopilot } from "@/components/copilot/CopilotContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const COMPANION_HERO = "/images/companion-hero.png";
const PREMIUM_MSG = "My Perfect Pets is a premium feature. Upgrade to access personalized dog nutrition.";

export const DOG_MEAL_IMAGES = [
  "https://images.unsplash.com/photo-1601758003122-53c40e686a19?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1583511655826-05700d52f4d9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1444212477490-ca407925329e?w=800&auto=format&fit=crop&q=80",
];

export function getDogMealImage(dogImages: string[], seed: string): string {
  const pool = dogImages.length > 0 ? dogImages : DOG_MEAL_IMAGES;
  let hash = 0;
  const s = seed || "default";
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

export function getMealImage(seed: string): string {
  return getDogMealImage([], seed);
}

interface DogProfile {
  id: string;
  name: string;
  breed: string;
  isMixedBreed: boolean;
  ageYears: number;
  weightLbs: number;
  wellnessGoals: string[];
  photoUrl?: string;
  status?: string;
  memorialMessage?: string;
  images?: string[];
}

interface SavedMeal {
  id: string;
  profileId: string;
  title: string;
  mealType: string;
  isSaved: boolean;
  generatedAt: string;
  ingredients?: any[];
  instructions?: string[];
  description?: string;
}

export default function CompanionNutritionHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { open, setLastResponse } = useCopilot();
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();
  const [profiles, setProfiles] = useState<DogProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [memorialMsg, setMemorialMsg] = useState("");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    document.title = "Companion Nutrition | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(apiUrl("/api/companion/profiles"), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const loaded: DogProfile[] = data.profiles || [];
          setProfiles(loaded);

          const active = loaded.filter((p) => !p.status || p.status === "active");
          const mealResults = await Promise.allSettled(
            active.map((p) =>
              fetch(apiUrl(`/api/companion/meals/${p.id}`), { headers: getAuthHeaders() })
                .then((r) => r.json())
                .then((d) => (d.meals || []).filter((m: SavedMeal) => m.isSaved))
            )
          );
          const allSaved: SavedMeal[] = mealResults.flatMap((r) =>
            r.status === "fulfilled" ? r.value : []
          );
          setSavedMeals(allSaved);
        }
      } catch {}
      setLoading(false);
    }
    fetchAll();
  }, []);

  function handleCopilotOpen() {
    open();
    setTimeout(() => {
      setLastResponse({
        title: "My Perfect Pets",
        description:
          "Companion Nutrition Intelligence uses the same adaptive protocol engine that powers your human meal plans — rebuilt for canine wellness. Create a dog profile, set wellness goals, and generate personalized recipes that pass through our Toxic Ingredient Firewall before you see them.",
        spokenText:
          "Companion Nutrition Intelligence uses the same adaptive protocol engine as your human meal plans — rebuilt for canine wellness. Create a dog profile and generate personalized, safety-screened recipes.",
        autoClose: false,
      });
    }, 300);
  }

  async function handleArchiveProfile(id: string, name: string) {
    setStatusLoading(id);
    try {
      await fetch(apiUrl(`/api/companion/profiles/${id}/archive`), {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, status: "archived" } : p));
      setSavedMeals((prev) => prev.filter((m) => m.profileId !== id));
      setExpandedActionId(null);
    } catch {}
    setStatusLoading(null);
  }

  async function handleMemorialProfile(id: string) {
    setStatusLoading(id);
    try {
      await fetch(apiUrl(`/api/companion/profiles/${id}/memorial`), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ memorialMessage: memorialMsg.trim() || null }),
      });
      setProfiles((prev) =>
        prev.map((p) => p.id === id ? { ...p, status: "memorial", memorialMessage: memorialMsg.trim() || undefined } : p)
      );
      setSavedMeals((prev) => prev.filter((m) => m.profileId !== id));
      setExpandedActionId(null);
      setMemorialMsg("");
    } catch {}
    setStatusLoading(null);
  }

  async function handleRestoreProfile(id: string) {
    setStatusLoading(id);
    try {
      const res = await fetch(apiUrl(`/api/companion/profiles/${id}/restore`), {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Could not restore profile.");
      } else {
        setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, status: "active" } : p));
      }
    } catch {}
    setStatusLoading(null);
  }

  const activeProfiles = profiles.filter((p) => !p.status || p.status === "active");
  const memorialProfiles = profiles.filter((p) => p.status === "memorial");
  const previousProfiles = profiles.filter((p) => p.status === "archived");

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
              <PawPrint className="h-4 w-4 text-orange-400" />
              <h1 className="text-base font-bold text-white">My Perfect Pets</h1>
              <span className="bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crown className="h-2.5 w-2.5" />
                Premium
              </span>
            </div>
            <PillButton onClick={handleCopilotOpen}>Guide me</PillButton>
          </div>
        </div>
      </MobileHeaderGuard>

      {/* Back button — always visible */}
      <div className="flex max-w-2xl mx-auto px-4 pt-6 pb-0">
        <PillButton onClick={() => window.history.back()}>
          <ArrowLeft className="h-3 w-3" /> Back
        </PillButton>
      </div>

      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: "1rem" }}>

        {/* Hero */}
        <div className="relative h-52 rounded-2xl overflow-hidden mb-3">
          <img src={COMPANION_HERO} alt="My Perfect Pets" className="w-full h-full object-cover object-top" />
        </div>

        {/* Info card */}
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 mb-5">
          <p className="text-white font-semibold text-sm">Companion Nutrition Intelligence</p>
          <p className="text-white/65 text-xs mt-1 leading-relaxed">
            The same adaptive protocol engine that powers your meals — now for your dog.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Plus, label: "Add a Dog", sub: "Create profile", action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/setup")), color: "from-orange-600/30 to-orange-800/20" },
            { icon: ChefHat, label: "Meal Generator", sub: "Make a meal", action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/generator")), color: "from-amber-600/30 to-orange-700/20" },
            { icon: Search, label: "Ingredient Scan", sub: "Is it safe?", action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/scanner")), color: "from-orange-500/30 to-red-800/20" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className={`bg-gradient-to-br ${item.color} border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 text-center`}
            >
              <item.icon className="h-5 w-5 text-orange-400" />
              <span className="text-white text-xs font-semibold">{item.label}</span>
              <span className="text-white/50 text-[10px]">{item.sub}</span>
            </button>
          ))}
        </div>

        {/* ── Active Companions ───────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-sm">Active Companions</h2>
            <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation("/companion/setup"))}>
              <Plus className="h-3 w-3" /> Add Dog
            </PillButton>
          </div>

          {loading ? (
            <div className="bg-white/5 rounded-xl p-8 text-center text-white/40 text-sm">Loading profiles...</div>
          ) : activeProfiles.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-black/40 border border-white/10 rounded-xl p-6 text-center"
            >
              <PawPrint className="h-8 w-8 text-orange-400/50 mx-auto mb-3" />
              <p className="text-white font-semibold text-sm mb-1">No dogs added yet</p>
              <p className="text-white/50 text-xs mb-4">
                Create your dog's profile to generate personalized meals and wellness guidance.
              </p>
              <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation("/companion/setup"))}>
                Create First Profile
              </PillButton>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeProfiles.map((profile) => {
                const primaryImage = profile.images?.[0] || profile.photoUrl;
                const actionOpen = expandedActionId === profile.id;
                return (
                  <motion.div
                    key={profile.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 border border-white/10 rounded-xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Dog photo — tappable to manage photos */}
                          <button
                            onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/setup/${profile.id}?photos=true`))}
                            className="flex flex-col items-center gap-0.5 flex-shrink-0"
                          >
                            <div className="w-11 h-11 rounded-full overflow-hidden border border-orange-400/30">
                              {primaryImage ? (
                                <img src={primaryImage} alt={profile.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-orange-500/20 flex items-center justify-center">
                                  <Camera className="h-5 w-5 text-orange-400" />
                                </div>
                              )}
                            </div>
                            {!primaryImage && (
                              <span className="text-orange-400/70 text-[9px] font-medium whitespace-nowrap">Add photo</span>
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-sm">{profile.name}</p>
                            <p className="text-white/50 text-xs truncate">
                              {profile.breed}{profile.isMixedBreed ? " Mix" : ""} · {profile.ageYears}yr · {profile.weightLbs}lbs
                            </p>
                            {Array.isArray(profile.wellnessGoals) && profile.wellnessGoals.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {profile.wellnessGoals.slice(0, 2).map((goal) => (
                                  <span key={goal} className="bg-orange-500/15 border border-orange-400/25 text-orange-300 text-[9px] px-1.5 py-0.5 rounded-full">
                                    {goal}
                                  </span>
                                ))}
                                {profile.wellnessGoals.length > 2 && (
                                  <span className="text-white/30 text-[9px]">+{profile.wellnessGoals.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/generator?profileId=${profile.id}`))}>
                            <ChefHat className="h-3 w-3" /> Cook
                          </PillButton>
                          <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/setup/${profile.id}`))}>
                            Edit
                          </PillButton>
                          <PillButton onClick={() => {
                            setExpandedActionId(actionOpen ? null : profile.id);
                            setMemorialMsg("");
                          }}>
                            {actionOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </PillButton>
                        </div>
                      </div>

                      {/* Inline status action drawer */}
                      <AnimatePresence>
                        {actionOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 mt-3 border-t border-white/8 space-y-3">
                              {/* Photo management shortcut */}
                              <div>
                                <p className="text-white/40 text-[10px] font-semibold uppercase mb-2">
                                  Photos ({profile.images?.length ?? 0}/4)
                                </p>
                                <PillButton
                                  onClick={() => {
                                    setExpandedActionId(null);
                                    guardAction(PREMIUM_MSG, () => setLocation(`/companion/setup/${profile.id}?photos=true`));
                                  }}
                                >
                                  <Camera className="h-3 w-3" />
                                  {(profile.images?.length ?? 0) === 0 ? "Add Photos" : "Manage Photos"}
                                </PillButton>
                              </div>
                              <div className="h-px bg-white/8" />
                              <p className="text-white/40 text-[10px] font-semibold uppercase">Profile Status</p>
                              <div className="flex gap-2">
                                <PillButton
                                  onClick={() => handleArchiveProfile(profile.id, profile.name)}
                                  disabled={statusLoading === profile.id}
                                >
                                  <Archive className="h-3 w-3" />
                                  Move to Previous
                                </PillButton>
                              </div>
                              <div className="space-y-2">
                                <p className="text-white/40 text-[10px]">Create a memorial for {profile.name}</p>
                                <input
                                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-orange-500/60"
                                  placeholder={`e.g. "Forever my hiking partner. 2012–2026."`}
                                  value={memorialMsg}
                                  onChange={(e) => setMemorialMsg(e.target.value)}
                                />
                                <PillButton
                                  onClick={() => handleMemorialProfile(profile.id)}
                                  disabled={statusLoading === profile.id}
                                >
                                  <Heart className="h-3 w-3" />
                                  Create Memorial
                                </PillButton>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── In Memory ──────────────────────────────────────── */}
        {memorialProfiles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-4 w-4 text-orange-400/70" />
              <h2 className="text-white font-bold text-sm">In Memory</h2>
            </div>
            <div className="space-y-3">
              {memorialProfiles.map((profile) => {
                const primaryImage = profile.images?.[0] || profile.photoUrl;
                const profileMeals = savedMeals.filter((m) => m.profileId === profile.id);
                return (
                  <div key={profile.id} className="bg-black/40 border border-orange-400/15 rounded-xl overflow-hidden">
                    {/* Memorial banner */}
                    <div className="bg-gradient-to-r from-orange-900/30 to-black/30 px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-orange-300/20">
                        {primaryImage ? (
                          <img src={primaryImage} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-orange-500/10 flex items-center justify-center">
                            <PawPrint className="h-4 w-4 text-orange-400/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-orange-200/90 text-xs font-semibold">In Memory of {profile.name}</p>
                        {profile.memorialMessage && (
                          <p className="text-white/45 text-[11px] mt-0.5 leading-relaxed italic">"{profile.memorialMessage}"</p>
                        )}
                        <p className="text-white/30 text-[10px] mt-0.5">{profile.breed}{profile.isMixedBreed ? " Mix" : ""}</p>
                      </div>
                    </div>
                    {/* Saved recipe collection for this dog */}
                    {profileMeals.length > 0 && (
                      <div className="px-4 pb-3 pt-2">
                        <p className="text-white/30 text-[10px] font-semibold uppercase mb-2">{profile.name}'s Recipe Collection</p>
                        <div className="space-y-2">
                          {profileMeals.slice(0, 3).map((meal) => {
                            const img = getDogMealImage(profile.images || [], meal.id || meal.title);
                            return (
                              <div key={meal.id} className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                                  <img src={img} alt={meal.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white/70 text-xs truncate">{meal.title}</p>
                                  <p className="text-white/30 text-[10px] capitalize">{meal.mealType}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recipe Collection ───────────────────────────────── */}
        {savedMeals.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-orange-400" />
              <h2 className="text-white font-bold text-sm">Recipe Collection</h2>
              <span className="bg-orange-500/20 border border-orange-400/30 text-orange-300 text-[9px] font-semibold px-2 py-0.5 rounded-full">
                {savedMeals.length} saved
              </span>
            </div>
            <div className="space-y-2">
              {savedMeals.map((meal) => {
                const profile = profiles.find((p) => p.id === meal.profileId);
                const img = getDogMealImage(profile?.images || [], meal.id || meal.title);
                const isOpen = expandedMealId === meal.id;
                return (
                  <motion.div
                    key={meal.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 border border-white/10 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedMealId(isOpen ? null : meal.id)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={img} alt={meal.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold leading-snug truncate">{meal.title}</p>
                        <p className="text-white/40 text-[10px] mt-0.5">
                          {profile?.name && <span className="text-orange-300/70">{profile.name} · </span>}
                          <span className="capitalize">{meal.mealType}</span>
                        </p>
                      </div>
                      <span className="text-white/30 text-[10px] flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-white/8 pt-3">
                        {meal.description && (
                          <p className="text-white/60 text-xs leading-relaxed">{meal.description}</p>
                        )}
                        {Array.isArray(meal.ingredients) && meal.ingredients.length > 0 && (
                          <div>
                            <p className="text-white/40 text-[10px] font-semibold uppercase mb-1">Ingredients</p>
                            <ul className="space-y-1">
                              {meal.ingredients.slice(0, 6).map((ing: any, i: number) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/70">
                                  <span className="text-orange-400 mt-0.5">•</span>
                                  {typeof ing === "string" ? ing : `${ing.amount || ""} ${ing.name || ""}`.trim()}
                                </li>
                              ))}
                              {meal.ingredients.length > 6 && (
                                <li className="text-white/30 text-[10px]">+{meal.ingredients.length - 6} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        <div className="pt-1">
                          <PillButton
                            onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/generator?profileId=${meal.profileId}`))}
                          >
                            <ChefHat className="h-3 w-3" /> Generate Similar
                          </PillButton>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Previous Companions ─────────────────────────────── */}
        {previousProfiles.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowPrevious((v) => !v)}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-white/30" />
                <h2 className="text-white/50 font-semibold text-sm">Previous Companions</h2>
                <span className="text-white/25 text-[10px]">({previousProfiles.length})</span>
              </div>
              {showPrevious ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
            </button>

            <AnimatePresence>
              {showPrevious && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  {previousProfiles.map((profile) => {
                    const primaryImage = profile.images?.[0] || profile.photoUrl;
                    return (
                      <div key={profile.id} className="bg-black/30 border border-white/8 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                          {primaryImage ? (
                            <img src={primaryImage} alt={profile.name} className="w-full h-full object-cover opacity-60" />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              <PawPrint className="h-4 w-4 text-white/20" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/50 text-sm font-semibold">{profile.name}</p>
                          <p className="text-white/30 text-xs truncate">{profile.breed}{profile.isMixedBreed ? " Mix" : ""} · {profile.ageYears}yr</p>
                        </div>
                        <PillButton
                          onClick={() => handleRestoreProfile(profile.id)}
                          disabled={statusLoading === profile.id}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {statusLoading === profile.id ? "..." : "Restore"}
                        </PillButton>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Navigation Links */}
        <div className="space-y-2 mb-6">
          {[
            { label: "Homemade Meal Generator", sub: "Personalized recipes for your dog", icon: ChefHat, route: "/companion/generator" },
            { label: "Ingredient Safety Scanner", sub: "Check any food in seconds", icon: Search, route: "/companion/scanner" },
          ].map((item) => (
            <button
              key={item.route}
              onClick={() => guardAction(PREMIUM_MSG, () => setLocation(item.route))}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-orange-400" />
                <div className="text-left">
                  <p className="text-white font-semibold text-sm">{item.label}</p>
                  <p className="text-white/50 text-xs">{item.sub}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>
          ))}
        </div>

        {/* Companion Feeding Wisdom */}
        <div className="bg-black/40 border border-orange-500/20 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-orange-400" />
            <h3 className="text-white font-bold text-sm">Companion Feeding Wisdom</h3>
          </div>
          <div className="space-y-2">
            {[
              "Dogs thrive on consistency — same meal times daily support digestion and behavior.",
              "Emotional treat giving is one of the top causes of canine obesity. Healthy treats can be just as rewarding.",
              "Begging behavior intensifies with inconsistent feeding. Structure is kindness.",
              "A dog's nutrient needs change with age, activity, and health conditions — personalization matters.",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-orange-400 text-xs mt-0.5">•</span>
                <p className="text-white/70 text-xs leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-3 mb-4">
          <p className="text-amber-200/70 text-xs leading-relaxed">
            <strong className="text-amber-300">Wellness guidance only.</strong> Companion Nutrition Intelligence provides homemade meal guidance and ingredient awareness for general wellness support. It is not veterinary advice. Always consult your veterinarian for medical conditions, significant dietary changes, or health concerns.
          </p>
        </div>
      </div>

      {showLockModal && (
        <UpgradeLockModal message={lockMessage} onClose={closeLockModal} />
      )}
    </motion.div>
  );
}
