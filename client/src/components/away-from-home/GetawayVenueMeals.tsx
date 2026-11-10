import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { setQuickView } from "@/lib/macrosQuickView";
import FavoriteButton from "@/components/FavoriteButton";
import AwayFromHomeMealCard from "./AwayFromHomeMealCard";
import GetawayMealImage from "./GetawayMealImage";
import { getawayRestaurantCards } from "@shared/getawayRestaurantMeals";
import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";

export interface GetawayDiningDestination {
  destinationName: string; venueId?: string; zoneId?: string;
}

export default function GetawayVenueMeals({ destination, onRecommendationsChange }: {
  destination: GetawayDiningDestination; onRecommendationsChange?: (hasMeals: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<AwayFromHomeRecommendation[]>([]);
  const [evidence, setEvidence] = useState("");
  const request = useRef(0);
  useEffect(() => { onRecommendationsChange?.(cards.length > 0); }, [cards.length, onRecommendationsChange]);
  useEffect(() => () => { request.current++; }, []);
  // The parent keys this panel by destination/area. Never keep another venue's
  // recommendations actionable while its name is edited or a request is pending.
  function edit(value: string) {
    request.current++; setBusy(false); setName(value); setCards([]); setError(""); setEvidence("");
  }
  async function generate() {
    if (!name.trim() || busy) return;
    const id = ++request.current;
    setBusy(true); setCards([]); setError(""); setEvidence("");
    try {
      const payload = await apiRequest("/api/restaurants/guide", {
        method: "POST",
        body: JSON.stringify({
          restaurantName: name.trim(), craving: `Help me choose a meal at ${name.trim()}.`,
          getawayVenue: destination,
        }),
      });
      if (request.current !== id) return;
      const meals = getawayRestaurantCards(payload);
      if (!meals.length) throw new Error("No suitable structured meal recommendations were available. General dining advice is not a meal card.");
      setCards(meals);
      setEvidence(payload.compositionEvidence === "menu-item-only"
        ? "Menu items were found. Complete ingredients and clinical nutrient compliance remain unverified."
        : "Cuisine-based meal suggestions, not a confirmed current menu.");
    } catch (err) {
      if (request.current === id) setError(err instanceof Error ? err.message : "Recommendations are unavailable. Please try again.");
    } finally {
      if (request.current === id) setBusy(false);
    }
  }
  function sendToBiometrics(rec: AwayFromHomeRecommendation) {
    const meal = rec.meal;
    setQuickView({
      restaurantServing: meal.serving, title: meal.name,
      protein: meal.proteinGrams!, carbs: meal.carbohydrateGrams!, fat: meal.fatGrams!,
      calories: meal.calories!, starchyCarbs: meal.starchyCarbGrams ?? undefined,
      fibrousCarbs: meal.fibrousCarbGrams ?? undefined, dateISO: new Date().toISOString().slice(0, 10),
    });
    navigate("/biometrics?section=macros");
  }
  return <section className="mt-5 rounded-2xl border border-orange-500/20 bg-black/40 p-4" aria-label="Selected venue meals">
    <h2 className="font-semibold text-white">Meals at a selected dining venue</h2>
    <p className="mt-1 text-sm text-white/65">{destination.destinationName}</p>
    <p className="mt-2 text-xs text-white/60">Enter the restaurant or dining concept you intend to visit. Its presence and current menu are not independently verified. Your saved nutrition profile applies.</p>
    <label htmlFor="getaway-dining-venue" className="mt-3 block text-sm text-white">Restaurant or dining venue</label>
    <input id="getaway-dining-venue" maxLength={160} value={name} onChange={e => edit(e.target.value)}
      placeholder={t("getawayDining.venuePlaceholder", { defaultValue: "Enter a restaurant or dining location at this destination" })}
      className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
    <button disabled={busy || !name.trim()} onClick={generate}
      className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
      {busy ? "Finding suitable meals…" : "Recommend meals for this venue"}
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {evidence && <p className="mt-3 text-xs text-amber-200">{evidence} Nutrition refers to one serving; estimates are labeled on the cards. Confirm availability and preparation with the venue.</p>}
    {cards.map(rec => <div key={rec.id} className="mt-4" data-testid="getaway-structured-meal">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-white">{rec.meal.name}</span>
        <FavoriteButton title={rec.meal.name} sourceType="restaurant" mealData={{
          id: rec.id, name: rec.meal.name, description: rec.meal.description,
          calories: rec.meal.calories, protein: rec.meal.proteinGrams, carbs: rec.meal.carbohydrateGrams,
          fat: rec.meal.fatGrams, ingredients: rec.meal.ingredients, nutritionStatus: rec.nutritionStatus,
          serving: rec.meal.serving, imageUrl: rec.meal.imageUrl,
        }} />
      </div>
      <AwayFromHomeMealCard recommendation={rec}
        mealImage={<GetawayMealImage key={rec.meal.imageUrl || rec.id} src={rec.meal.imageUrl} name={rec.meal.name} />} />
      <button onClick={() => sendToBiometrics(rec)} className="mt-2 text-sm text-orange-300 underline">
        Review in Biometrics
      </button>
    </div>)}
  </section>;
}
