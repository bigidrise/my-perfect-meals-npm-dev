import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ChefHat, Heart, Crown, ArrowLeft, BookOpen,
  Archive, RotateCcw, ChevronDown, ChevronUp, Camera, PawPrint,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const CAT_HERO = "/images/cat-wellness-hero.png";
const PREMIUM_MSG = "My Perfect Pets is a premium feature. Upgrade to access personalized cat nutrition.";

interface CatProfile {
  id: string;
  name: string;
  breed: string;
  isMixedBreed: boolean;
  ageYears: number;
  ageMonths?: number;
  sex?: string;
  isNeutered?: boolean;
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
}

export default function CatNutritionHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();
  const [profiles, setProfiles] = useState<CatProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [memorialMsg, setMemorialMsg] = useState("");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    document.title = "Cat Nutrition | My Perfect Pets";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(apiUrl("/api/companion/profiles?type=cat"), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const loaded: CatProfile[] = data.profiles || [];
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

  async function handleArchiveProfile(id: string, name: string) {
    if (!confirm(`Move ${name} to Previous Companions?`)) return;
    setStatusLoading(id);
    try {
      await fetch(apiUrl(`/api/companion/profiles/${id}/archive`), {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, status: "archived" } : p));
    } catch {}
    setStatusLoading(null);
  }

  async function handleMemorialProfile(id: string) {
    setStatusLoading(id);
    try {
      await fetch(apiUrl(`/api/companion/profiles/${id}/memorial`), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ memorialMessage: memorialMsg }),
      });
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, status: "memorial", memorialMessage: memorialMsg } : p));
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
              <h1 className="text-base font-bold text-white">My Perfect Pets — Cats</h1>
              <span className="bg-orange-500/20 border border-orange-400/40 text-orange-300 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crown className="h-2.5 w-2.5" />
                Premium
              </span>
            </div>
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="flex max-w-2xl mx-auto px-4 pt-6 pb-0">
        <PillButton onClick={() => window.history.back()}>
          <ArrowLeft className="h-3 w-3" /> Back
        </PillButton>
      </div>

      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: "1rem" }}>

        {/* Hero */}
        <div className="relative h-52 rounded-2xl overflow-hidden mb-3">
          <img
            src={CAT_HERO}
            alt="Cat Nutrition"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 55%" }}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { icon: Plus, label: "Add a Cat", sub: "Create profile", action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/cat-setup")), color: "from-orange-600/30 to-orange-800/20" },
            { icon: ChefHat, label: "Meal Generator", sub: "Make a meal", action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/cat-generator")), color: "from-amber-600/30 to-orange-700/20" },
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
            <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation("/companion/cat-setup"))}>
              <Plus className="h-3 w-3" /> Add Cat
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
              <p className="text-white font-semibold text-sm mb-1">No cats added yet</p>
              <p className="text-white/50 text-xs mb-4">
                Create your cat's profile to generate personalized meals and wellness guidance.
              </p>
              <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation("/companion/cat-setup"))}>
                Create First Profile
              </PillButton>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeProfiles.map((profile) => {
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
                          {profile.images && profile.images.length > 0 ? (
                            <img
                              src={profile.images[0]}
                              alt={profile.name}
                              className="w-16 h-16 rounded-full object-cover border-2 border-orange-400/40 flex-shrink-0"
                            />
                          ) : (
                            <button
                              onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/cat-setup/${profile.id}?photos=true`))}
                              className="w-16 h-16 rounded-full bg-orange-500/20 border-2 border-dashed border-orange-400/40 flex flex-col items-center justify-center flex-shrink-0 gap-0.5"
                            >
                              <Camera className="h-5 w-5 text-orange-400" />
                              <span className="text-orange-300 text-[8px] font-semibold leading-none">Add Photo</span>
                            </button>
                          )}
                          <div className="min-w-0">
                            <p className="text-white font-bold text-sm leading-tight">{profile.name}</p>
                            <p className="text-white/60 text-xs mt-0.5">
                              {profile.breed}{profile.isMixedBreed ? " Mix" : ""}
                            </p>
                            <p className="text-white/50 text-xs">
                              {profile.sex ? `${profile.sex} · ` : ""}{profile.ageYears}yr · {profile.weightLbs} lbs
                              {profile.isNeutered ? " · Neutered/Spayed" : ""}
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
                          <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/cat-generator?profileId=${profile.id}`))}>
                            <ChefHat className="h-3 w-3" /> Cook
                          </PillButton>
                          <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/cat-setup/${profile.id}`))}>
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

                      <AnimatePresence>
                        {actionOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 mt-3 border-t border-white/8 space-y-3">
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
                                  placeholder={`e.g. "Forever my sunshine. 2012–2026."`}
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

        {/* Feline Nutrition Intelligence banner */}
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 mb-6">
          <p className="text-white font-semibold text-sm">Feline Nutrition Intelligence</p>
          <p className="text-white/65 text-xs mt-1 leading-relaxed">
            Obligate carnivore meal planning with taurine-optimized recipes and cat-safe ingredient guidance.
          </p>
        </div>

        {/* ── In Memory ──────────────────────────────────────── */}
        {memorialProfiles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="h-4 w-4 text-orange-400/70" />
              <h2 className="text-white font-bold text-sm">In Memory</h2>
            </div>
            <div className="space-y-3">
              {memorialProfiles.map((profile) => (
                <div key={profile.id} className="bg-black/40 border border-orange-400/15 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-900/30 to-black/30 px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 border border-orange-300/20 bg-orange-500/10 flex items-center justify-center">
                      <PawPrint className="h-4 w-4 text-orange-400/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-orange-200/90 text-xs font-semibold">In Memory of {profile.name}</p>
                      {profile.memorialMessage && (
                        <p className="text-white/45 text-[11px] mt-0.5 leading-relaxed italic">"{profile.memorialMessage}"</p>
                      )}
                      <p className="text-white/30 text-[10px] mt-0.5">{profile.breed}{profile.isMixedBreed ? " Mix" : ""}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Previous Companions ─────────────────────────────── */}
        {previousProfiles.length > 0 && (
          <div className="mb-6">
            <button
              className="flex items-center gap-2 mb-3 w-full text-left"
              onClick={() => setShowPrevious((v) => !v)}
            >
              <Archive className="h-4 w-4 text-white/40" />
              <h2 className="text-white font-bold text-sm">Previous Companions</h2>
              <span className="bg-white/10 text-white/50 text-[9px] px-1.5 py-0.5 rounded-full">{previousProfiles.length}</span>
              {showPrevious ? <ChevronUp className="h-3 w-3 text-white/30 ml-auto" /> : <ChevronDown className="h-3 w-3 text-white/30 ml-auto" />}
            </button>
            <AnimatePresence>
              {showPrevious && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  {previousProfiles.map((profile) => (
                    <div key={profile.id} className="bg-black/30 border border-white/8 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white/70 text-sm font-semibold">{profile.name}</p>
                        <p className="text-white/35 text-xs">{profile.breed}{profile.isMixedBreed ? " Mix" : ""}</p>
                      </div>
                      <PillButton
                        onClick={() => handleRestoreProfile(profile.id)}
                        disabled={statusLoading === profile.id}
                      >
                        <RotateCcw className="h-3 w-3" /> Restore
                      </PillButton>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recipe Collection */}
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
              {savedMeals.map((meal) => (
                <div key={meal.id} className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex-shrink-0 flex items-center justify-center">
                    <PawPrint className="h-4 w-4 text-orange-400/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs truncate font-medium">{meal.title}</p>
                    <p className="text-white/35 text-[10px] capitalize">{meal.mealType}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {showLockModal && (
        <UpgradeLockModal message={lockMessage} onClose={closeLockModal} />
      )}
    </motion.div>
  );
}
