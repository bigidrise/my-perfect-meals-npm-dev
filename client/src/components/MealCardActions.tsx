import { Children, Fragment, cloneElement, isValidElement, ReactNode, useState } from "react";
import MealShoppingAction from "@/components/MealShoppingAction";
import { rememberShoppingTranslation } from "@/lib/mealShoppingApi";
import { useLocation } from "wouter";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { isFeatureEnabled } from "@/lib/productionGates";
import { writeChefHandoffMeal } from "@/lib/safeChefHandoff";
import { PillButton } from "@/components/ui/pill-button";
import { useTranslation } from "react-i18next";

export type MealCardActionKind = "macros" | "plan" | "prepare" | "save" | "share" | "extra";

/** Declarative slots: hosts retain their handlers; this component owns layout. */
export function MealCardAction({ children }: { kind: MealCardActionKind; children: ReactNode }) {
  return <>{children}</>;
}

export const mealCardActionLayout = { columns: 2 };

type CollectedAction = { kind: MealCardActionKind | "translate" | "shopping"; node: ReactNode };
function collectActions(children: ReactNode): CollectedAction[] {
  return Children.toArray(children).flatMap<CollectedAction>(child => {
    if (!isValidElement<{ children?: ReactNode; kind?: MealCardActionKind }>(child)) {
      return typeof child === "string" && !child.trim() ? [] : [{ kind: "extra" as const, node: child }];
    }
    if (child.type === MealCardAction) return [{ kind: child.props.kind!, node: child.props.children }];
    if (child.type === TranslateToggle) return [{ kind: "translate" as const, node: child }];
    // Old grouping divs are transparent; actual controls and clinical notes are not.
    if (child.type === Fragment || child.type === "div") {
      const nested = collectActions(child.props.children);
      if (nested.some(entry => entry.kind !== "extra")) return nested;
    }
    return [{ kind: "extra" as const, node: child }];
  });
}

interface MealData {
  id?: string;
  name: string;
  description?: string;
  mealType?: string;
  instructions?: string[] | string;
  notes?: string;
  ingredients?: Array<
    { name: string; amount?: string | number; unit?: string } | string
  >;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string | null;
  servings?: number;
  servingSize?: string;
  medicalBadges?: string[];
}

interface MealCardActionsProps {
  meal?: MealData;
  children?: ReactNode;
  shoppingRecipe?: any;
  shoppingOptions?: { recipeYield?: number; shoppingServings?: number; subjectKind?: "human" | "pet" };
  showShopping?: boolean;
  onContentUpdate?: (updated: Partial<MealData>) => void;
  showTranslate?: boolean;
  showPrepareButton?: boolean;
  source?: string;
  className?: string;
}

export default function MealCardActions({
  meal = { name: "" },
  children,
  shoppingRecipe,
  shoppingOptions,
  showShopping = true,
  onContentUpdate,
  showTranslate = true,
  showPrepareButton = true,
  source = "unknown",
  className,
}: MealCardActionsProps) {
  const { t } = useTranslation("nav");
  const [location, setLocation] = useLocation();
  const [displayContent, setDisplayContent] = useState<Partial<MealData>>({});
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const hasInstructions =
    meal.instructions &&
    (Array.isArray(meal.instructions)
      ? meal.instructions.length > 0
      : meal.instructions.length > 0);

  const handlePrepareWithChef = () => {
    if (!hasInstructions) return;

    // Normalize ingredients to always be an array of objects regardless of source format
    const rawIngredients = meal.ingredients;
    const normalizedIngredients: Array<{ name: string; amount?: string; unit?: string }> = !rawIngredients
      ? []
      : !Array.isArray(rawIngredients)
        ? []
        : rawIngredients.map((ing) =>
            typeof ing === "string"
              ? { name: ing }
              : { name: (ing as any).name || (ing as any).item || "", amount: String((ing as any).amount ?? (ing as any).quantity ?? ""), unit: (ing as any).unit || "" }
          );

    // Strip base64 data URLs before storing — they can be 500KB+ and blow
    // the localStorage quota. Chef's Kitchen only needs the URL for display,
    // not for cooking guidance, so an S3/CDN URL is kept, data: URIs are dropped.
    const safeImageUrl = (() => {
      const url = meal.imageUrl;
      if (!url) return null;
      if (url.startsWith("data:")) return null;         // base64 — too large
      if (url.includes("oaidalleapiprodscus")) return null; // expired DALL·E URL
      return url;
    })();

    const mealData = {
      id: meal.id || crypto.randomUUID(),
      name: meal.name,
      description: meal.description,
      mealType: meal.mealType,
      ingredients: normalizedIngredients,
      instructions: meal.instructions,
      imageUrl: safeImageUrl,
      calories: meal.nutrition?.calories || meal.calories,
      protein: meal.nutrition?.protein || meal.protein,
      carbs: meal.nutrition?.carbs || meal.carbs,
      fat: meal.nutrition?.fat || meal.fat,
      servings: meal.servings,
      servingSize: meal.servingSize,
      medicalBadges: meal.medicalBadges || [],
    };

    // Store meal in Chef's Kitchen format + flag to enter prepare mode.
    // Wrapped in try/catch — if storage is still full for other reasons,
    // we degrade gracefully instead of crashing the app.
    writeChefHandoffMeal(mealData);
    localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
    localStorage.setItem("mpm_chefs_kitchen_origin", window.location.pathname);

    setLocation("/lifestyle/chefs-kitchen");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const currentName = displayContent.name || meal.name;
  const currentDescription = displayContent.description || meal.description;

  const handleTranslate = (translated: {
    name: string;
    description?: string;
    instructions?: string[] | string;
    notes?: string;
    ingredients?: Array<{ name: string; quantity?: string | number; amount?: string | number; unit?: string } | string>;
  }) => {
    setDisplayContent(translated);
    if (onContentUpdate) {
      onContentUpdate(translated);
    }
  };

  const normalizedIngredients = (meal.ingredients || []).map((ing) => {
    if (typeof ing === "string") {
      return { name: ing };
    }
    return {
      name: ing.name || "",
      amount: ing.amount !== undefined ? String(ing.amount) : undefined,
      unit: ing.unit,
    };
  });

  const entries = collectActions(children);
  const translations = entries.filter(entry => entry.kind === "translate");
  const primary = entries.filter(entry => entry.kind !== "translate" && entry.node != null && entry.node !== false);
  const hasDefaultActions = Boolean(meal.name);
  if (showShopping && shoppingRecipe && !location.startsWith("/pro/") && !location.startsWith("/care-team")) {
    primary.push({ kind: "shopping", node: <MealShoppingAction recipe={shoppingRecipe} source={source} options={shoppingOptions} /> });
  }
  if (hasDefaultActions && !primary.some(entry => entry.kind === "share")) {
    primary.push({ kind: "share", node: <ShareRecipeButton
      recipe={{
        name: currentName, description: currentDescription, nutrition: meal.nutrition,
        ingredients: normalizedIngredients, instructions: meal.instructions,
      }}
      className="flex-1 min-w-0"
    /> });
  }
  if (hasDefaultActions && showPrepareButton && isFeatureEnabled("chefsKitchen") &&
      !primary.some(entry => entry.kind === "prepare")) {
    primary.push({ kind: "prepare", node: <Button
      size="sm"
      className="w-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 hover:from-red-400 hover:via-orange-400 hover:to-yellow-300 text-white font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5 py-2.5"
      onClick={handlePrepareWithChef}
      disabled={!hasInstructions}
      title={!hasInstructions ? "No cooking instructions available" : undefined}
    >
      <ChefHat className="h-4 w-4" />Guided Cooking
    </Button> });
  }
  // One DOM order for saved cards and creators, not merely a visual CSS order:
  // Macros spans the row, then Plan/Cooking, then Share/Shopping.
  const actionOrder: Record<CollectedAction["kind"], number> = {
    macros: 0, plan: 1, prepare: 2, share: 3, shopping: 4,
    save: 5, extra: 6, translate: 7,
  };
  primary.sort((a, b) => actionOrder[a.kind] - actionOrder[b.kind]);

  return (
    <div data-meal-card-actions={source} className={`flex flex-col gap-2 ${className || ""}`}>
      <div
        data-meal-card-primary
        className="grid gap-2 [&_button]:min-h-[44px]"
        style={{ gridTemplateColumns: `repeat(${mealCardActionLayout.columns}, minmax(0, 1fr))` }}
      >
        {primary.map((entry, i) => (
          entry.kind === "shopping" ? <Fragment key={i}>{entry.node}</Fragment> :
          <div key={i} data-meal-action={entry.kind} className="min-w-0 [&>button]:w-full"
            style={entry.kind === "macros" || entry.kind === "extra" ? { gridColumn: "1 / -1" } : undefined}>
            {entry.node}
          </div>
        ))}
      </div>
      {(translations.length > 0 || hasDefaultActions && showTranslate) && (
        <div data-meal-card-secondary>
          <PillButton
            type="button"
            aria-expanded={secondaryOpen}
            onClick={() => setSecondaryOpen(open => !open)}
            className="!min-h-[44px] text-xs"
          >
            {t("more", { defaultValue: "More" })}
          </PillButton>
          {secondaryOpen && <div className="mt-2 grid gap-2 [&_button]:min-h-[44px]">
            {translations.map((entry, i) => <Fragment key={i}>{isValidElement<any>(entry.node)
              ? cloneElement(entry.node, { onTranslate: (translated: any) => {
                rememberShoppingTranslation(shoppingRecipe, translated, shoppingOptions?.recipeYield);
                entry.node && (entry.node as any).props.onTranslate?.(translated);
              } }) : entry.node}</Fragment>)}
            {hasDefaultActions && showTranslate && <TranslateToggle
              content={{
                name: meal.name, description: meal.description, instructions: meal.instructions,
                notes: meal.notes, ingredients: meal.ingredients,
              }}
              onTranslate={handleTranslate}
            />}
          </div>}
        </div>
      )}
    </div>
  );
}
