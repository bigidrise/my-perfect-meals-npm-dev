import { useState } from "react";
import { ShoppingCart, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

type Ingredient = {
  name: string;
  qty?: number | string;
  unit?: string;
};

type Props = {
  ingredients: Ingredient[];
  source?: string;
  sourceSlug?: string;
  bottomPadding?: string;
  hideShareButton?: boolean;
  onAddComplete?: () => void;
};

function formatQty(qty?: number | string): string {
  if (!qty) return '';
  const num = typeof qty === 'number' ? qty : parseFloat(String(qty));
  if (isNaN(num)) return String(qty);

  const rounded = Math.round(num * 100) / 100;
  return rounded.toString().replace(/\.?0+$/, '');
}

export default function ShoppingAggregateBar({ ingredients, source, sourceSlug, bottomPadding = "pb-20", hideShareButton = true, onAddComplete }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  async function onShareList() {
    if (ingredients.length === 0) return;

    setSharing(true);
    const text = [
      "🛒 Shopping List",
      source ? `From: ${source}` : "",
      "",
      ...ingredients.map(i => `• ${i.name}${i.qty ? ` — ${formatQty(i.qty)}${i.unit ? ' ' + i.unit : ''}` : ''}`),
      "",
      "Created with My Perfect Meals"
    ].filter(Boolean).join("\n");

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: "Shopping List",
          text: text,
          dialogTitle: "Share Shopping List",
        });
      } else if (navigator.share) {
        await navigator.share({
          title: "Shopping List",
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
          title: "Copied to Clipboard",
          description: `${ingredients.length} ingredients copied.`
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
            title: "Copied to Clipboard",
            description: `${ingredients.length} ingredients copied.`
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
              title: "Copied to Clipboard",
              description: `${ingredients.length} ingredients copied.`
            });
          } catch (finalErr) {
            console.error("All copy methods failed:", finalErr);
            toast({
              title: "Copy Failed",
              description: "Unable to copy to clipboard. Please copy manually.",
              variant: "destructive"
            });
          }
        }
      }
    } finally {
      setSharing(false);
    }
  }

  function onAddToList() {
    if (ingredients.length === 0) return;

    const items = ingredients.map(i => ({
      name: i.name,
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: source
    }));

    useShoppingListStore.getState().addItems(items);
    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items added to your master list`
    });
    
    if (onAddComplete) {
      onAddComplete();
    }

    const url = sourceSlug ? `/shopping-list-v2?from=${sourceSlug}` : "/shopping-list-v2";
    setLocation(url);
  }

  if (!ingredients || ingredients.length === 0) return null;

  return (
    <div className={`fixed left-0 right-0 z-[100] bg-black/80 backdrop-blur-xl border-t border-white/20 shadow-2xl`} style={{ bottom: 'var(--bottom-nav-height, 64px)' }}>
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="absolute left-0 right-0 text-white text-center pointer-events-none hidden sm:block">
            <div className="font-semibold text-sm sm:text-base">Shopping List Ready</div>
            <div className="text-xs sm:text-sm text-white/80">{ingredients.length} ingredients</div>
          </div>
          <div className="text-white text-center sm:hidden">
            <div className="font-semibold text-sm">Shopping List Ready</div>
            <div className="text-xs text-white/80">{ingredients.length} ingredients</div>
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
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            <Button
              onClick={onAddToList}
              className="flex-1 sm:flex-none min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white border border-white/30"
              data-testid="button-go-to-shopping-list"
              data-wt="wmb-send-day-to-shopping"
            >
              <ShoppingCart className="h-5 w-5 sm:mr-2" />
              <span>Add & View List</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
