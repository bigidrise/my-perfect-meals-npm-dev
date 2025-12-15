import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2 } from "lucide-react";
import { createCommunityPost, CreateCommunityPostInput } from "@/pages/community/api";

export type ShareableMeal = {
  id?: string;
  title: string;
  imageUrl?: string;
  summary?: string;
  ingredients?: string[];
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  cookingInstructionsUrl?: string; // in-app route
  tags?: string[];
};

function formatMealAsPostText(meal: ShareableMeal) {
  const parts: string[] = [];
  parts.push(`🍽️ ${meal.title}`);
  if (meal.summary) parts.push(meal.summary);

  if (meal.ingredients?.length) {
    const preview = meal.ingredients.slice(0, 6).join(", ");
    parts.push(`Ingredients: ${preview}${meal.ingredients.length > 6 ? "…" : ""}`);
  }

  const m = meal.macros || {};
  const macroBits = [
    typeof m.calories === "number" ? `${m.calories} kcal` : null,
    typeof m.protein === "number" ? `${m.protein}g P` : null,
    typeof m.carbs === "number" ? `${m.carbs}g C` : null,
    typeof m.fat === "number" ? `${m.fat}g F` : null,
  ].filter(Boolean);
  if (macroBits.length) parts.push(`Macros: ${macroBits.join(" · ")}`);

  if (meal.cookingInstructionsUrl) parts.push(`👨‍🍳 Cooking instructions: ${meal.cookingInstructionsUrl}`);

  return parts.join("\n");
}

export default function ShareToCommunityButton({
  meal,
  size = "sm",
  variant = "outline",
  label = "Share to Community",
  asSuccessStory = false,
  asAnonymous = false,
}: {
  meal: ShareableMeal;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
  asSuccessStory?: boolean;
  asAnonymous?: boolean;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const payload: CreateCommunityPostInput = useMemo(() => ({
    text: formatMealAsPostText(meal),
    imageUrl: meal.imageUrl,
    tags: meal.tags?.length ? meal.tags : ["recipes", "mealprep", "healthy-foodie"],
    isAnonymous: asAnonymous,
    isSuccessStory: asSuccessStory,
  }), [meal, asAnonymous, asSuccessStory]);

  const writeLocalAndGo = () => {
    const local = {
      ...payload,
      createdAt: new Date().toISOString(),
      authorDisplay: asAnonymous ? "Anonymous" : "You",
    };
    try { localStorage.setItem("mpm.community.newpost", JSON.stringify(local)); } catch {}
    setLocation("/community");
  };

  const share = async () => {
    setLoading(true);
    try {
      await createCommunityPost(payload);
      
      // Also save to recipe gallery if it has recipe tags
      const hasRecipeTags = meal.tags?.some(tag => 
        ["recipes", "healthy-foodie", "craving-creator", "fridge-rescue"].includes(tag)
      );
      
      if (hasRecipeTags) {
        try {
          const postId = `post-${Date.now()}`;
          await fetch(apiUrl("/api/recipe-gallery/add"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              title: meal.title,
              imageUrl: meal.imageUrl,
              cookingInstructionsUrl: meal.cookingInstructionsUrl,
              tags: meal.tags,
            }),
          });
        } catch (error) {
          console.warn("Error adding to recipe gallery:", error);
        }
      }
      
      toast({ title: "Shared!", description: "Your meal was posted to Community." });
      writeLocalAndGo(); // keep UX instant even with stub
    } catch (err: any) {
      // Safe fallback: still show locally in Community
      toast({
        title: "Shared locally",
        description: "We posted it to your Community feed view. (Backend pending.)",
      });
      writeLocalAndGo();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={share} size={size} variant={variant} disabled={loading}
      className="bg-white/10 border-white/20 text-white hover:bg-white/15"
      data-testid="button-share-community">
      <Share2 className="h-4 w-4 mr-2" />
      {loading ? "Sharing…" : label}
    </Button>
  );
}