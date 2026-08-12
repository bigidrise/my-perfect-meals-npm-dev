import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import SharePanel from "@/components/SharePanel";

interface Recipe {
  id: string;
  slug: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
}

interface RecipeQuickActionsProps {
  recipe: Recipe;
}

function DaySlotPicker({
  defaultSlot,
  onCancel,
  onConfirm,
}: {
  defaultSlot: "breakfast" | "lunch" | "dinner" | "snack";
  onCancel: () => void;
  onConfirm: (day: number, slot: "breakfast" | "lunch" | "dinner" | "snack") => void;
}) {
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState(defaultSlot);
  
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  
  return (
    <div className="rounded-xl p-3 border border-white/15 bg-black/60 backdrop-blur-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs mb-1 text-white/70">Day</div>
          <select
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value, 10))}
            className="w-full rounded-lg bg-white text-black px-2 py-2"
            data-testid="day-selector"
          >
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs mb-1 text-white/70">Slot</div>
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as any)}
            className="w-full rounded-lg bg-white text-black px-2 py-2"
            data-testid="slot-selector"
          >
            {["breakfast", "lunch", "dinner", "snack"].map(s => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex gap-2 justify-end">
        <button 
          onClick={onCancel} 
          className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15"
          data-testid="cancel-picker"
        >
          Cancel
        </button>
        <button 
          onClick={() => onConfirm(day, slot)} 
          className="px-3 py-2 rounded-lg bg-white text-black hover:bg-white/90 border border-black/10"
          data-testid="confirm-picker"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function RecipeQuickActions({ recipe }: RecipeQuickActionsProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [openPicker, setOpenPicker] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/recipes/${recipe.id}/save`, {
      method: "POST",
    }),
    onSuccess: () => {
      toast({
        title: "Recipe Saved",
        description: `${recipe.name} has been added to your favorites.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/saved"] });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Unable to save recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addToCalendarMutation = useMutation({
    mutationFn: async ({ day, slot }: { day: number; slot: "breakfast" | "lunch" | "dinner" | "snack" }) => {
      const response = await apiRequest(`/api/recipes/${recipe.id}/add-to-week`, {
        method: "POST",
        body: JSON.stringify({ day, slot }),
      });
      
      // Update the same cache as generators use
      if (response.plan && response.meta) {
        queryClient.setQueryData(["weeklyPlan", "current"], response.plan);
        queryClient.setQueryData(["weeklyPlanMeta", "current"], response.meta);
      }
      
      return response;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Added to Calendar",
        description: `${recipe.name} added to Day ${variables.day} • ${variables.slot.charAt(0).toUpperCase() + variables.slot.slice(1)}`,
      });
      setOpenPicker(false);
      setLocation("/weekly-meal-board");
    },
    onError: () => {
      toast({
        title: "Add Failed",
        description: "Unable to add to weekly plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCookNow = () => {
    setLocation(`/cook/${recipe.slug}`);
  };

  const [panelOpen, setPanelOpen] = useState(false);
  const [shareUrl, setShareUrl]   = useState<string | null>(null);
  const [sharing, setSharing]     = useState(false);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // Create a public share link on the server
      let url = shareUrl;
      if (!url) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...((await getAuthHeaders()) as Record<string, string>),
          };
          const res = await fetch(apiUrl("/api/meals/share"), {
            method: "POST",
            headers,
            body: JSON.stringify({ mealName: recipe.name }),
          });
          if (res.ok) {
            const data = await res.json();
            url = data.shareUrl as string;
            setShareUrl(url);
          }
        } catch {
          // fall through — use fallback URL
        }
        if (!url) url = window.location.origin;
      }

      const title = recipe.name;
      const text  = `Check out this meal from My Perfect Meals: ${title}`;

      if (Capacitor.isNativePlatform()) {
        await Share.share({ title, text, url, dialogTitle: "Share Recipe" });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
        }
      }

      // Desktop fallback — open share panel
      setPanelOpen(true);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-blue-600 text-white hover:bg-blue-700 border border-blue-500/50 text-sm font-medium"
          data-testid={`button-save-${recipe.slug}`}
        >
          💾 {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>

        <Button
          onClick={() => setOpenPicker(true)}
          disabled={addToCalendarMutation.isPending}
          className="bg-green-600 text-white hover:bg-green-700 border border-green-500/50 text-sm font-medium"
          data-testid={`button-add-to-calendar-${recipe.slug}`}
        >
          📅 Calendar
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handleCookNow}
          className="border-orange-500/50 bg-orange-600/20 text-orange-200 hover:bg-orange-600/30 hover:border-orange-400 text-sm font-medium"
          data-testid={`button-cook-now-${recipe.slug}`}
        >
          👨‍🍳 Cook Now
        </Button>

        <Button
          variant="outline"
          onClick={handleShare}
          disabled={sharing}
          className="border-purple-500/50 bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 hover:border-purple-400 text-sm font-medium"
          data-testid={`button-share-${recipe.slug}`}
        >
          🔗 {sharing ? "Sharing…" : "Share"}
        </Button>
      </div>

      {panelOpen && shareUrl && (
        <SharePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          shareUrl={shareUrl}
          mealName={recipe.name}
          shareText={`Check out this meal from My Perfect Meals: ${recipe.name}\n\n${shareUrl}`}
        />
      )}

      {openPicker && (
        <DaySlotPicker
          defaultSlot={recipe.type}
          onCancel={() => setOpenPicker(false)}
          onConfirm={(day, slot) => addToCalendarMutation.mutate({ day, slot })}
        />
      )}
    </div>
  );
}