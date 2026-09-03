import { useState } from "react";
import GeneratedCardShell from "@/components/cards/GeneratedCardShell";
import FavoriteButton from "@/components/FavoriteButton";
import TranslateToggle from "@/components/TranslateToggle";
import { Wine, Beer, GlassWater, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface PairingItemData {
  category: string;
  name: string;
  explanation: string;
  alternatives?: string[];
  servingTips?: string;
  imageUrl?: string | null;
  flavorProfile?: string[];
  body?: string;
  acidity?: string;
  sweetness?: string;
  bitterness?: string;
}

interface PairingResultCardProps {
  pairing: PairingItemData;
  foodContext: string;
  sourceType: string;
}

function getCategoryIcon(category: string): ReactNode {
  switch (category) {
    case "wine":
      return <Wine className="h-5 w-5 text-orange-400" />;
    case "beer":
      return <Beer className="h-5 w-5 text-orange-400" />;
    case "spirits":
      return <GlassWater className="h-5 w-5 text-orange-400" />;
    default:
      return <Sparkles className="h-5 w-5 text-orange-400" />;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "wine": return "Wine";
    case "beer": return "Beer";
    case "spirits": return "Spirits";
    case "non-alcoholic": return "Non-Alcoholic";
    default: return category;
  }
}

function AttributePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/80 border border-white/10">
      <span className="text-white/50">{label}:</span> {value}
    </span>
  );
}

export default function PairingResultCard({ pairing, foodContext, sourceType }: PairingResultCardProps) {
  const [translatedContent, setTranslatedContent] = useState<{
    name?: string;
    description?: string;
    notes?: string;
    ingredients?: string[];
  }>({});

  const displayName = translatedContent.name ?? pairing.name;
  const displayExplanation = translatedContent.description ?? pairing.explanation;
  const displayServingTips = translatedContent.notes ?? pairing.servingTips;
  const displayAlternatives = (translatedContent.ingredients as string[] | undefined) ?? pairing.alternatives;

  const favoriteMealData = {
    category: pairing.category,
    drinkName: pairing.name,
    foodContext,
    explanation: pairing.explanation,
    alternatives: pairing.alternatives || [],
    servingTips: pairing.servingTips || "",
    imageUrl: pairing.imageUrl || null,
    flavorProfile: pairing.flavorProfile || [],
    body: pairing.body || null,
  };

  return (
    <GeneratedCardShell
      title={displayName}
      icon={getCategoryIcon(pairing.category)}
      description={getCategoryLabel(pairing.category)}
      imageUrl={pairing.imageUrl}
      imagePlaceholder={
        <div className="flex flex-col items-center gap-2 text-white/30">
          {getCategoryIcon(pairing.category)}
          <span className="text-xs">Image unavailable</span>
        </div>
      }
      headerActions={
        <FavoriteButton
          title={pairing.name}
          sourceType={sourceType}
          mealData={favoriteMealData}
        />
      }
    >
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-orange-400 mb-1">Why This Works</h4>
          <p className="text-sm text-white/80 leading-relaxed">{displayExplanation}</p>
        </div>

        {pairing.flavorProfile && pairing.flavorProfile.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-1">Flavor Profile</h4>
            <div className="flex flex-wrap gap-1.5">
              {pairing.flavorProfile.map((note, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-orange-600/20 rounded-full text-xs text-orange-300 border border-orange-500/20"
                >
                  {note}
                </span>
              ))}
            </div>
          </div>
        )}

        {(pairing.body || pairing.acidity || pairing.sweetness || pairing.bitterness) && (
          <div className="flex flex-wrap gap-1.5">
            {pairing.body && <AttributePill label="Body" value={pairing.body} />}
            {pairing.acidity && <AttributePill label="Acidity" value={pairing.acidity} />}
            {pairing.sweetness && <AttributePill label="Sweetness" value={pairing.sweetness} />}
            {pairing.bitterness && <AttributePill label="Bitterness" value={pairing.bitterness} />}
          </div>
        )}

        {displayAlternatives && displayAlternatives.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-1">Alternatives</h4>
            <div className="flex flex-wrap gap-1.5">
              {displayAlternatives.map((alt, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/70 border border-white/10"
                >
                  {alt}
                </span>
              ))}
            </div>
          </div>
        )}

        {displayServingTips && (
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-1">Serving Tips</h4>
            <p className="text-xs text-white/60">{displayServingTips}</p>
          </div>
        )}

        <div className="pt-1">
          <TranslateToggle
            content={{
              name: pairing.name,
              description: pairing.explanation,
              notes: pairing.servingTips || "",
              ingredients: pairing.alternatives || [],
            }}
            onTranslate={(t) => setTranslatedContent({
              name: t.name,
              description: t.description,
              notes: t.notes,
              ingredients: t.ingredients as string[] | undefined,
            })}
          />
        </div>
      </div>
    </GeneratedCardShell>
  );
}
