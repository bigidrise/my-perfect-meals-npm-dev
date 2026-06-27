import { Leaf, ChefHat, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { DietGuardAlertState, DietGuardDecision } from "@/hooks/useDietGuardPrecheck";

interface DietGuardInterceptProps {
  alert: DietGuardAlertState;
  onDecision: (decision: DietGuardDecision) => void;
  className?: string;
}

const CULTURAL_PROTOCOLS = ["kosher", "halal"] as const;
type CulturalProtocol = (typeof CULTURAL_PROTOCOLS)[number];

function isCulturalProtocol(diet: string | null): diet is CulturalProtocol {
  return diet === "kosher" || diet === "halal";
}

function capitalizeDiet(diet: string | null): string {
  if (!diet) return "Diet";
  return diet.charAt(0).toUpperCase() + diet.slice(1);
}

// Positive adaptation label per diet
function getAdaptationLabel(diet: string | null): string {
  if (!diet) return "Diet Adaptation Available";
  if (diet === "kosher") return "Kosher Protocol Conflict";
  if (diet === "halal") return "Halal Protocol Conflict";
  return `${capitalizeDiet(diet)} Adaptation Available`;
}

// Emoji per diet
function getDietEmoji(diet: string | null): string {
  switch (diet) {
    case "keto":        return "🥑";
    case "vegan":       return "🌱";
    case "vegetarian":  return "🥗";
    case "pescatarian": return "🐟";
    case "paleo":       return "🦴";
    case "gluten-free": return "🌾";
    case "carnivore":   return "🥩";
    default:            return "🍽️";
  }
}

// Explanation of WHY this conflicts with the diet
function getWhyExplanation(diet: string | null, matchedTerms: string[]): string {
  const termList = matchedTerms.length > 0
    ? matchedTerms.slice(0, 3).join(", ")
    : null;

  const termNote = termList ? ` (including ${termList})` : "";

  switch (diet) {
    case "keto":
      return `This request contains ingredients that are high in sugar or carbohydrates${termNote}, which don't align with a keto diet. Keto requires staying under ~20–50g of net carbs per day.`;
    case "vegan":
      return `This request contains animal-based ingredients${termNote} that aren't part of a vegan diet. Chef can create a fully plant-based version instead.`;
    case "vegetarian":
      return `This request contains meat${termNote} that isn't part of a vegetarian diet. Chef can create a vegetarian version using plant proteins or eggs and dairy.`;
    case "pescatarian":
      return `This request contains land-based meat${termNote} that isn't part of a pescatarian diet. Chef can adapt using seafood or plant proteins instead.`;
    case "paleo":
      return `This request contains grains, legumes, or refined ingredients${termNote} that aren't part of a paleo diet. Chef can create a grain-free, whole-food version.`;
    case "gluten-free":
      return `This request contains gluten-containing ingredients${termNote}. Chef can create a gluten-free version using safe alternatives.`;
    case "carnivore":
      return `This request contains plant-based ingredients${termNote} that aren't part of a carnivore diet. Chef can adapt using animal-based alternatives.`;
    default:
      return `This request contains ingredients that may not align with your ${capitalizeDiet(diet)} dietary preferences${termNote}. Chef can create a compatible version for you.`;
  }
}

// What Chef will actually do
function getChefActionText(diet: string | null): string {
  switch (diet) {
    case "keto":
      return "Chef will swap out high-carb or sugary ingredients for keto-friendly alternatives — keeping the same flavor profile wherever possible.";
    case "vegan":
      return "Chef will replace all animal products with plant-based alternatives.";
    case "vegetarian":
      return "Chef will remove meat and use plant proteins, eggs, or dairy instead.";
    case "pescatarian":
      return "Chef will replace land-based meat with seafood or plant proteins.";
    case "paleo":
      return "Chef will remove grains, legumes, and processed ingredients and use whole-food alternatives.";
    case "gluten-free":
      return "Chef will substitute gluten-containing ingredients with certified safe alternatives.";
    case "carnivore":
      return "Chef will replace plant ingredients with animal-based alternatives.";
    default:
      return `Chef will create a ${capitalizeDiet(diet)}-friendly version that respects your dietary preferences.`;
  }
}

// Icon background color per diet
function getIconBgClass(diet: string | null): string {
  if (diet === "kosher")     return "bg-amber-900/40";
  if (diet === "halal")      return "bg-teal-900/40";
  if (diet === "keto")       return "bg-green-900/40";
  if (diet === "vegan")      return "bg-emerald-900/40";
  if (diet === "carnivore")  return "bg-red-900/40";
  return "bg-neutral-700/50";
}

// Accent color per diet
function getAccentColor(diet: string | null): string {
  if (diet === "kosher")     return "text-amber-400";
  if (diet === "halal")      return "text-teal-400";
  if (diet === "keto")       return "text-green-400";
  if (diet === "vegan")      return "text-emerald-400";
  if (diet === "carnivore")  return "text-red-400";
  return "text-orange-400";
}

export function DietGuardIntercept({
  alert,
  onDecision,
  className = "",
}: DietGuardInterceptProps) {
  if (!alert.show) return null;

  const isCultural = isCulturalProtocol(alert.diet);
  const accentColor = getAccentColor(alert.diet);
  const iconBgClass = getIconBgClass(alert.diet);
  const emoji = getDietEmoji(alert.diet);
  const label = getAdaptationLabel(alert.diet);

  // Show "Let Chef Adapt It" unless the rule explicitly forbids adaptation.
  const showAdaptButton = alert.isAdaptable !== false;

  if (isCultural) {
    // Kosher / Halal — keep serious tone, this is a religious/legal requirement
    const subText = alert.isAdaptable
      ? `Chef may be able to adapt this for your ${alert.diet} protocol — or you can pick something else.`
      : `This ingredient requires certification certainty the app cannot provide. Please pick something else.`;

    return (
      <div className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-full ${iconBgClass}`}>
              <ShieldAlert className={`h-5 w-5 ${accentColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-neutral-200 mb-1">{label}</h4>
              <p className="text-neutral-400 text-sm mb-3">{alert.message}</p>
              {alert.matchedTerms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {alert.matchedTerms.map((term, i) => (
                    <span key={i} className="px-2.5 py-1 bg-neutral-700/50 text-neutral-300 text-xs rounded-full border border-neutral-600/50">
                      {term}
                    </span>
                  ))}
                </div>
              )}
              {alert.suggestedSubstitute && (
                <p className={`text-xs mb-3 ${accentColor} opacity-80`}>{alert.suggestedSubstitute}</p>
              )}
              <p className="text-neutral-500 text-xs">{subText}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onDecision("pick_something_else")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
            >
              Pick Something Else
            </button>
            {showAdaptButton && (
              <button
                onClick={() => onDecision("let_chef_adapt")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-700/80 border border-neutral-500/50 text-white text-sm font-medium transition-all active:scale-[0.98]"
              >
                <ChefHat className="h-4 w-4" />
                Let Chef Adapt It
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard dietary preference — positive, empowering tone
  const whyText = getWhyExplanation(alert.diet, alert.matchedTerms);
  const chefActionText = getChefActionText(alert.diet);

  return (
    <div className={`rounded-xl border p-5 bg-neutral-900/90 border-neutral-600/40 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-full ${iconBgClass} flex-shrink-0`}>
            <Leaf className={`h-5 w-5 ${accentColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-100 text-base mb-1">
              {emoji} {label}
            </h4>

            {/* Why it was flagged */}
            <p className="text-neutral-300 text-sm leading-relaxed mb-3">
              {whyText}
            </p>

            {/* Flagged ingredient chips */}
            {alert.matchedTerms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="text-xs text-neutral-500 self-center">Flagged:</span>
                {alert.matchedTerms.map((term, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-neutral-700/60 text-neutral-300 text-xs rounded-full border border-neutral-600/50"
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}

            {/* What Chef will do */}
            <div className={`text-xs leading-relaxed p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50 ${accentColor}`}>
              <span className="font-semibold">If you let Chef adapt it: </span>
              <span className="text-neutral-400">{chefActionText}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onDecision("continue_anyway")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-300 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowRight className="h-4 w-4" />
            Continue Anyway
          </button>

          {showAdaptButton && (
            <button
              onClick={() => onDecision("let_chef_adapt")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-600 border border-orange-500/50 text-white text-sm font-bold transition-all active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              Create {capitalizeDiet(alert.diet)} Version
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DietAdaptedNoticeProps {
  diet: string;
  notice?: string;
  swapDetail?: string;
  message?: string;
  onDismiss?: () => void;
  className?: string;
}

export function DietAdaptedNotice({
  diet,
  className = "",
}: DietAdaptedNoticeProps) {
  const isCultural = diet === "kosher" || diet === "halal";
  const iconColor = diet === "kosher" ? "text-amber-400" : diet === "halal" ? "text-teal-400" : diet === "carnivore" ? "text-red-400" : "text-green-400";
  const borderColor = diet === "kosher" ? "border-amber-500/30" : diet === "halal" ? "border-teal-500/30" : diet === "carnivore" ? "border-red-500/30" : "border-green-500/30";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800/70 border ${borderColor} text-xs font-medium whitespace-nowrap ${className}`}
    >
      {isCultural ? (
        <ShieldAlert className={`h-3 w-3 ${iconColor} shrink-0`} />
      ) : (
        <Leaf className={`h-3 w-3 ${iconColor} shrink-0`} />
      )}
      <span className={iconColor}>Chef Adapted</span>
    </span>
  );
}

export type { DietGuardDecision, DietGuardAlertState };
