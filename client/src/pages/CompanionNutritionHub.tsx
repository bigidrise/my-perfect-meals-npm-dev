import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { PawPrint, Plus, ChefHat, Search, Heart, Crown, ArrowRight, Trash2, ArrowLeft } from "lucide-react";
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

interface DogProfile {
  id: string;
  name: string;
  breed: string;
  isMixedBreed: boolean;
  ageYears: number;
  weightLbs: number;
  sex: string;
  activityLevel: string;
  wellnessGoals: string[];
  photoUrl?: string;
}

export default function CompanionNutritionHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { open, setLastResponse } = useCopilot();
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();
  const [profiles, setProfiles] = useState<DogProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Companion Nutrition | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch(apiUrl("/api/companion/profiles"), {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setProfiles(data.profiles || []);
        }
      } catch {}
      setLoading(false);
    }
    fetchProfiles();
  }, []);

  function handleCopilotOpen() {
    open();
    setTimeout(() => {
      setLastResponse({
        title: "Companion Nutrition Intelligence",
        description:
          "This is My Perfect Pets — a premium wellness nutrition system for your dog, built on the same adaptive protocol engine that powers your own nutrition. Create a dog profile, generate personalized homemade meals, or scan any food ingredient to instantly check if it's safe for your dog.",
        spokenText:
          "Welcome to Companion Nutrition Intelligence. This is My Perfect Pets — a wellness nutrition system for your dog, built on the same adaptive protocol engine that powers your own meals. Start by creating a dog profile, then generate personalized homemade meals or scan any ingredient to check if it's safe.",
        autoClose: false,
      });
    }, 300);
  }

  async function handleDeleteProfile(id: string, name: string) {
    if (!confirm(`Remove ${name}'s profile?`)) return;
    setDeletingId(id);
    try {
      await fetch(apiUrl(`/api/companion/profiles/${id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch {}
    setDeletingId(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-24"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PawPrint className="h-5 w-5 text-orange-400" />
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

      <div
        className="max-w-2xl mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Back button — always visible for desktop (mobile header doesn't exist on hub) */}
        <div className="flex items-center gap-2 mb-4">
          <PillButton onClick={() => window.history.back()}>
            <ArrowLeft className="h-3 w-3" /> Back
          </PillButton>
        </div>

        {/* Hero — clean image, no overlay */}
        <div className="relative h-52 rounded-2xl overflow-hidden mb-3">
          <img
            src={COMPANION_HERO}
            alt="My Perfect Pets — Companion Nutrition"
            className="w-full h-full object-cover object-top"
          />
        </div>

        {/* Info card below the image */}
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 mb-5">
          <p className="text-white font-semibold text-sm">Companion Nutrition Intelligence</p>
          <p className="text-white/65 text-xs mt-1 leading-relaxed">
            The same adaptive protocol engine that powers your meals — now for your dog.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              icon: Plus,
              label: "Add a Dog",
              sub: "Create profile",
              action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/setup")),
              color: "from-orange-600/30 to-orange-800/20",
            },
            {
              icon: ChefHat,
              label: "Meal Generator",
              sub: "Make a meal",
              action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/generator")),
              color: "from-amber-600/30 to-orange-700/20",
            },
            {
              icon: Search,
              label: "Ingredient Scan",
              sub: "Is it safe?",
              action: () => guardAction(PREMIUM_MSG, () => setLocation("/companion/scanner")),
              color: "from-orange-500/30 to-red-800/20",
            },
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

        {/* Dog Profiles */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-sm">Your Dogs</h2>
            <PillButton onClick={() => guardAction(PREMIUM_MSG, () => setLocation("/companion/setup"))}>
              <Plus className="h-3 w-3" /> Add Dog
            </PillButton>
          </div>

          {loading ? (
            <div className="bg-white/5 rounded-xl p-8 text-center text-white/40 text-sm">
              Loading profiles...
            </div>
          ) : profiles.length === 0 ? (
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
              {profiles.map((profile) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-black/40 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center flex-shrink-0">
                        <PawPrint className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm">{profile.name}</p>
                        <p className="text-white/50 text-xs truncate">
                          {profile.breed}{profile.isMixedBreed ? " Mix" : ""} · {profile.ageYears}yr · {profile.weightLbs}lbs
                        </p>
                        {Array.isArray(profile.wellnessGoals) && profile.wellnessGoals.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {profile.wellnessGoals.slice(0, 2).map((goal) => (
                              <span
                                key={goal}
                                className="bg-orange-500/15 border border-orange-400/25 text-orange-300 text-[9px] px-1.5 py-0.5 rounded-full"
                              >
                                {goal}
                              </span>
                            ))}
                            {profile.wellnessGoals.length > 2 && (
                              <span className="text-white/30 text-[9px]">
                                +{profile.wellnessGoals.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <PillButton
                        onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/generator?profileId=${profile.id}`))}
                      >
                        <ChefHat className="h-3 w-3" /> Cook
                      </PillButton>
                      <PillButton
                        onClick={() => guardAction(PREMIUM_MSG, () => setLocation(`/companion/setup/${profile.id}`))}
                      >
                        Edit
                      </PillButton>
                      <PillButton
                        onClick={() => handleDeleteProfile(profile.id, profile.name)}
                        disabled={deletingId === profile.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </PillButton>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="space-y-2 mb-6">
          {[
            {
              label: "Homemade Meal Generator",
              sub: "Personalized recipes for your dog",
              icon: ChefHat,
              route: "/companion/generator",
            },
            {
              label: "Ingredient Safety Scanner",
              sub: "Check any food in seconds",
              icon: Search,
              route: "/companion/scanner",
            },
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

        {/* Behavior & Feeding Wisdom */}
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
        <UpgradeLockModal
          message={lockMessage}
          onClose={closeLockModal}
        />
      )}
    </motion.div>
  );
}
