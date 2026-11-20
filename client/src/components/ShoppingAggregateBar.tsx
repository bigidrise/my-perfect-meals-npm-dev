import { CSSProperties, useState } from "react";
import { useMealShopping } from "@/hooks/useMealShopping";
import { canonicalShoppingRecipe } from "@/lib/mealShoppingApi";
import { selectionForRecipe } from "@shared/mealShoppingSelection";
import { ShoppingCart, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { shoppingMetadataEnabled } from "@/lib/shoppingMetadataGate";
import { recipeIngredientTransfer } from "@/lib/shoppingIngredientTransfer";
import type { ShoppingIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import { useConsumerCopy as useTranslation } from "@/i18n/useConsumerCopy";

type Ingredient = {
  name: string;
  qty?: number | string;
  unit?: string;
  ingredientMetadata?: ShoppingIngredientMetadata;
  recipeId?: string;
  recipeName?: string;
  originalText?: string;
};

type Props = {
  ingredients: Ingredient[];
  recipes?: any[];
  recipeYield?: number;
  shoppingServings?: number;
  source?: string;
  sourceSlug?: string;
  hideShareButton?: boolean;
  onAddComplete?: () => void;
  aboveBottomNav?: boolean;
};

function formatQty(qty?: number | string): string {
  if (!qty) return "";
  const num = typeof qty === "number" ? qty : parseFloat(String(qty));
  if (isNaN(num)) return String(qty);

  const rounded = Math.round(num * 100) / 100;
  return rounded.toString().replace(/\.?0+$/, "");
}

export default function ShoppingAggregateBar({
  ingredients,
  recipes,
  recipeYield,
  shoppingServings,
  source,
  sourceSlug,
  hideShareButton = true,
  onAddComplete,
  aboveBottomNav = false,
}: Props) {
  const { t } = useTranslation("shoppingTransfer");
  const shopping = useMealShopping();
  const [shoppingError, setShoppingError] = useState("");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const isDesktop = useIsDesktop();

  const path = location || window.location.pathname;
  const isProStudio =
    path.startsWith("/pro/") ||
    path.startsWith("/care-team");

  if (isProStudio) return null;

  async function onShareList() {
    if (ingredients.length === 0) return;

    setSharing(true);
    const text = [
      `🛒 ${t("Shopping List")}`,
      source ? t("From: {{source}}", { source }) : "",
      "",
      ...ingredients.map(
        (i) =>
          `• ${i.name}${i.qty ? ` — ${formatQty(i.qty)}${i.unit ? " " + i.unit : ""}` : ""}`,
      ),
      "",
      t("Created with My Perfect Meals"),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: t("Shopping List"),
          text: text,
          dialogTitle: t("Share Shopping List"),
        });
      } else if (navigator.share) {
        await navigator.share({
          title: t("Shopping List"),
          text: text,
        });
      } else {
        // Clipboard fallback for browsers without share API
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          // Textarea fallback for browsers without clipboard API
          const el = document.createElement("textarea");
          el.value = text;
          el.style.position = "fixed";
          el.style.opacity = "0";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        }
        toast({
          title: t("Copied to Clipboard"),
          description: t("{{count}} ingredients copied.", { count: ingredients.length }),
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
        // Try clipboard API first, then textarea fallback
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
          } else {
            // Textarea fallback for browsers without clipboard API
            const el = document.createElement("textarea");
            el.value = text;
            el.style.position = "fixed";
            el.style.opacity = "0";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
          }
          toast({
            title: t("Copied to Clipboard"),
            description: t("{{count}} ingredients copied.", { count: ingredients.length }),
          });
        } catch (clipboardErr) {
          // Last resort: textarea fallback
          try {
            const el = document.createElement("textarea");
            el.value = text;
            el.style.position = "fixed";
            el.style.opacity = "0";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            toast({
              title: t("Copied to Clipboard"),
              description: t("{{count}} ingredients copied.", { count: ingredients.length }),
            });
          } catch (finalErr) {
            console.error("All copy methods failed:", finalErr);
            toast({
              title: t("Copy Failed"),
              description: t("Unable to copy to clipboard. Please copy manually."),
              variant: "destructive",
            });
          }
        }
      }
    } finally {
      setSharing(false);
    }
  }

  async function onAddToList() {
    if (!shopping.checked || (!shopping.available && !shopping.legacyAllowed)) {
      setShoppingError(shopping.reason || "Confirming shopping availability. Please try again.");
      return;
    }
    if (shopping.available) {
      setShoppingError("");
      const prepared = (recipes || []).map(recipe => selectionForRecipe(
        canonicalShoppingRecipe(recipe, recipeYield), sourceSlug || source || "recipe-menu",
        { recipeYield, shoppingServings },
      ));
      const invalid = prepared.find(value => !value.selection);
      if (!prepared.length || invalid) {
        setShoppingError(invalid?.reason || "This menu needs finalized recipe identities before Shopping.");
        return;
      }
      const response = await shopping.send(prepared.map(value => value.selection!), shopping.result?.committed === false);
      if (response?.committed) {
        toast({ title: t("savedTitle"), description: t("menuConfirmed") });
        onAddComplete?.();
        setLocation(sourceSlug ? `/shopping-list-v2?from=${sourceSlug}` : "/shopping-list-v2");
      }
      return;
    }
    if (ingredients.length === 0) return;

    const items = ingredients.map((i) => ({
      name: i.name,
      ...(shoppingMetadataEnabled ? {
        ingredientMetadata: recipeIngredientTransfer(i, {
          id: i.recipeId, name: i.recipeName, source,
        }).ingredientMetadata,
      } : {}),
      quantity:
        typeof i.qty === "number"
          ? i.qty
          : i.qty
            ? parseFloat(String(i.qty))
            : 1,
      unit: i.unit || "",
      notes: source,
    }));

    useShoppingListStore.getState().addItems(items);
    toast({
      title: t("Added to Shopping List"),
      description: t("{{count}} items added to your Smart Grocery List", { count: ingredients.length }),
    });

    if (onAddComplete) {
      onAddComplete();
    }

    const url = sourceSlug
      ? `/shopping-list-v2?from=${sourceSlug}`
      : "/shopping-list-v2";
    setLocation(url);
  }

  if (!ingredients || ingredients.length === 0) return null;

  const barStyle: CSSProperties = isDesktop
    ? { left: 240, right: 0, bottom: 0 }
    : { left: 0, right: 0, bottom: aboveBottomNav
        ? "calc(var(--bottom-nav-height, 64px) + var(--safe-bottom, 0px))" : 0 };

  return (
    <div
      className="fixed z-30 bg-black/80 backdrop-blur-xl border-t border-white/20 shadow-2xl"
      style={barStyle}
    >
      <div className="container mx-auto px-4 py-3">
        {(shoppingError || shopping.message) && <p role="status" className="pb-2 text-xs text-white">{shoppingError || shopping.message}</p>}
        <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="absolute left-0 right-0 text-white text-center pointer-events-none hidden sm:block">
            <div className="font-semibold text-sm sm:text-base">
              {t("Grocery List Ready")}
            </div>
            <div className="text-xs sm:text-sm text-white/80">
              {t("{{count}} ingredients", { count: ingredients.length })}
            </div>
          </div>
          <div className="text-white text-center sm:hidden">
            <div className="font-semibold text-sm">{t("Grocery List Ready")}</div>
            <div className="text-xs text-white/80">
              {t("{{count}} ingredients", { count: ingredients.length })}
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {!hideShareButton && (
              <Button
                onClick={onShareList}
                disabled={sharing}
                className="flex-1 sm:flex-none min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white border border-white/30"
                data-testid="button-share-shopping-list"
              >
                <Share2 className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">{t("Share")}</span>
              </Button>
            )}
            <Button
              onClick={onAddToList}
              disabled={shopping.pending}
              className="flex-1 sm:flex-none min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white border border-white/30"
              data-testid="button-go-to-shopping-list"
              data-wt="wmb-send-day-to-shopping"
            >
              <ShoppingCart className="h-5 w-5 sm:mr-2" />
              <span>{shopping.pending ? t("Saving…") : shopping.result?.committed === false ? t("Update Shopping") : t("Add & View List")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
