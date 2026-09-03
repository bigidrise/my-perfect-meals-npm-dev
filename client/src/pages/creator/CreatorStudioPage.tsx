import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChefHat, Sparkles, BookOpen, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface CatalogMeal {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
}

interface CreatorProfile {
  displayName: string;
  type: string;
  slug: string;
  catalogMeals: CatalogMeal[];
}

export default function CreatorStudioPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Creator Studio — My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!user?.isCreator) return;
    fetch(apiUrl("/api/creator/me"), { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user?.isCreator) {
    setLocation("/creator/start");
    return null;
  }

  const displayName = profile?.displayName || user.creatorDisplayName || "Your Studio";
  const catalogMeals = profile?.catalogMeals || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black pb-24"
    >
      <div className="px-4 pt-12 max-w-lg mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setLocation("/lifestyle")} className="p-2 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-orange-300 font-medium uppercase tracking-wider">Creator Studio</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">{displayName}</h1>
          </div>
        </div>

        {/* Section 1 — Create in your style */}
        <div className="bg-gradient-to-r from-black via-orange-950/40 to-black border border-orange-500/30 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Create in Your Style</h2>
          </div>
          <p className="text-xs text-white/60 mb-4 leading-relaxed">
            Generate meals through the Craving Creator — every result is styled to your system's techniques, flavors, and voice.
          </p>
          <button
            onClick={() => setLocation("/craving-creator-landing")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-sm font-semibold transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Open Craving Creator
          </button>
        </div>

        {/* Section 2 — Saved Meals */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Your Saved Meals</h2>
            {catalogMeals.length > 0 && (
              <span className="ml-auto text-xs text-white/40">{catalogMeals.length} meal{catalogMeals.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-white/30 text-sm">Loading…</div>
          ) : catalogMeals.length === 0 ? (
            <div className="py-8 text-center">
              <div className="p-3 rounded-xl bg-white/5 w-fit mx-auto mb-3">
                <Plus className="h-5 w-5 text-white/30" />
              </div>
              <p className="text-sm text-white/50 font-medium mb-1">No meals saved yet</p>
              <p className="text-xs text-white/30 leading-relaxed max-w-[220px] mx-auto">
                Generate a meal and tap "Save to My Catalog" to start building your signature collection.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {catalogMeals.map(meal => (
                <div key={meal.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="p-1.5 rounded-md bg-orange-500/20 flex-shrink-0 mt-0.5">
                    <ChefHat className="h-3 w-3 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{meal.title}</p>
                    {meal.description && (
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{meal.description}</p>
                    )}
                    <p className="text-[10px] text-white/30 mt-1">
                      {new Date(meal.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
