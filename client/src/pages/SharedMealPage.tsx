/**
 * SharedMealPage — /m/:shareToken
 *
 * Public, no-auth-required preview of a shared meal.
 * Shows the meal card and a CTA to sign up / open the app.
 * Rewardful JS in index.html automatically reads ?via= from the URL
 * and sets the rw_ref cookie, so affiliate attribution survives the
 * signup → checkout flow without any extra work here.
 */

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Flame, Drumstick, Wheat, Droplets, ChefHat, ArrowRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { useAuth } from "@/contexts/AuthContext";

interface SharedMeal {
  mealName:        string;
  mealDescription: string | null;
  mealImage:       string | null;
  calories:        number | null;
  protein:         number | null;
  carbs:           number | null;
  fat:             number | null;
}

export default function SharedMealPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [meal, setMeal]       = useState<SharedMeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetch(apiUrl(`/api/share/${shareToken}`))
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error("Server error");
        setMeal(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !meal) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <ChefHat className="w-16 h-16 text-white/20 mb-4" />
        <h1 className="text-white text-2xl font-bold mb-2">Meal not found</h1>
        <p className="text-white/50 mb-6 max-w-xs">
          This shared meal may have expired or the link is incorrect.
        </p>
        <Button
          onClick={() => setLocation("/welcome")}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          Explore My Perfect Meals
        </Button>
      </div>
    );
  }

  const hasMacros = meal.calories != null || meal.protein != null || meal.carbs != null || meal.fat != null;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-orange-400" />
          <span className="font-semibold text-white/80 text-sm tracking-wide">My Perfect Meals</span>
        </div>
        {user ? (
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white/70 hover:border-white/40 hover:text-white text-xs"
            onClick={() => setLocation("/dashboard")}
          >
            Open App
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
            onClick={() => setLocation("/auth")}
          >
            Sign In
          </Button>
        )}
      </div>

      {/* Meal card */}
      <div className="max-w-lg mx-auto px-4 pb-10">
        {/* Image */}
        {meal.mealImage && (
          <div className="rounded-2xl overflow-hidden mb-5 shadow-2xl">
            <img
              src={meal.mealImage}
              alt={meal.mealName}
              className="w-full object-cover"
              style={{ maxHeight: 320 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Name */}
        <h1 className="text-2xl font-bold text-white leading-tight mb-2">
          {meal.mealName}
        </h1>

        {/* Description */}
        {meal.mealDescription && (
          <p className="text-white/60 text-sm leading-relaxed mb-4">
            {meal.mealDescription}
          </p>
        )}

        {/* Macros */}
        {hasMacros && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {meal.calories != null && (
              <MacroTile icon={<Flame className="w-4 h-4 text-orange-400" />} value={meal.calories} label="cal" />
            )}
            {meal.protein != null && (
              <MacroTile icon={<Drumstick className="w-4 h-4 text-blue-400" />} value={Math.round(meal.protein)} label="protein" suffix="g" />
            )}
            {meal.carbs != null && (
              <MacroTile icon={<Wheat className="w-4 h-4 text-yellow-400" />} value={Math.round(meal.carbs)} label="carbs" suffix="g" />
            )}
            {meal.fat != null && (
              <MacroTile icon={<Droplets className="w-4 h-4 text-green-400" />} value={Math.round(meal.fat)} label="fat" suffix="g" />
            )}
          </div>
        )}

        {/* CTA section */}
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
            <span className="text-orange-300 text-sm font-semibold">AI-Personalized Nutrition</span>
          </div>
          <h2 className="text-white text-lg font-bold mb-1">
            Create your own perfect meal
          </h2>
          <p className="text-white/55 text-sm mb-4 leading-relaxed">
            My Perfect Meals builds meals around your health goals, dietary needs, and medical conditions — fully personalized, every time.
          </p>
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-base"
            onClick={() => setLocation(user ? "/select-builder" : "/welcome")}
          >
            {user ? "Create a Meal" : "Get Started — It's Free"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          {!user && (
            <p className="text-center text-white/40 text-xs mt-3">
              Already a member?{" "}
              <button
                className="text-orange-400 hover:text-orange-300 underline"
                onClick={() => setLocation("/auth")}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MacroTile({
  icon,
  value,
  label,
  suffix = "",
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-white font-bold text-base leading-tight">
        {value}{suffix}
      </div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
}
