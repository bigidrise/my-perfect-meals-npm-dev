import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";

interface IngredientObject {
  name: string;
  quantity?: string | number;
  amount?: string | number;
  unit?: string;
}

interface TranslatableContent {
  name: string;
  description?: string;
  instructions?: string[] | string;
  notes?: string;
  ingredients?: Array<IngredientObject | string>;
}

interface TranslateToggleProps {
  content: TranslatableContent;
  onTranslate: (translated: TranslatableContent) => void;
  className?: string;
}

const translationCache = new Map<string, TranslatableContent>();

function hashContent(content: TranslatableContent): string {
  const str = JSON.stringify({
    name: content.name,
    description: content.description || "",
    instructions: content.instructions || "",
    notes: content.notes || "",
    ingredients: content.ingredients || [],
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getCacheKey(content: TranslatableContent, targetLang: string): string {
  return `${hashContent(content)}_${targetLang}`;
}

function getDeviceLanguage(): string {
  const lang = navigator.language || (navigator as any).userLanguage || "en";
  return lang.split("-")[0];
}

export default function TranslateToggle({ content, onTranslate, className }: TranslateToggleProps) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [originalContent] = useState<TranslatableContent>(content);

  const translateContent = useCallback(async () => {
    const targetLang = getDeviceLanguage();
    
    // Debug: Show detected language
    console.log("[TranslateToggle] Detected language:", targetLang, "navigator.language:", navigator.language);
    
    if (targetLang === "en") {
      const event = new CustomEvent("show-toast", {
        detail: {
          title: "Already in English",
          description: `Detected: ${navigator.language}. Content is already in your device language.`,
        },
      });
      window.dispatchEvent(event);
      return;
    }

    const cacheKey = getCacheKey(content, targetLang);
    
    if (translationCache.has(cacheKey)) {
      onTranslate(translationCache.get(cacheKey)!);
      setIsTranslated(true);
      return;
    }

    setIsLoading(true);

    try {
      const ingredientNames = content.ingredients?.map((ing) => 
        typeof ing === "string" ? ing : ing.name
      ) || [];
      
      const response = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: {
            name: content.name,
            description: content.description || "",
            instructions: Array.isArray(content.instructions) 
              ? content.instructions.join("\n---\n") 
              : (content.instructions || ""),
            notes: content.notes || "",
            ingredientNames: ingredientNames.join("\n"),
          },
          targetLanguage: targetLang,
        }),
      });

      if (!response.ok) {
        throw new Error("Translation failed");
      }

      const data = await response.json();
      
      // Parse translated ingredient names back into the original structure
      let translatedIngredients = content.ingredients;
      if (data.ingredientNames && content.ingredients) {
        const translatedNames = data.ingredientNames.split("\n");
        translatedIngredients = content.ingredients.map((ing, idx) => {
          const translatedName = translatedNames[idx] || (typeof ing === "string" ? ing : ing.name);
          if (typeof ing === "string") {
            return translatedName;
          }
          return { ...ing, name: translatedName };
        });
      }
      
      const translated: TranslatableContent = {
        name: data.name || content.name,
        description: data.description || content.description,
        instructions: data.instructions 
          ? (typeof content.instructions === "string" 
              ? data.instructions 
              : data.instructions.split("\n---\n"))
          : content.instructions,
        notes: data.notes || content.notes,
        ingredients: translatedIngredients,
      };

      translationCache.set(cacheKey, translated);
      onTranslate(translated);
      setIsTranslated(true);
    } catch (error) {
      console.error("Translation error:", error);
      const event = new CustomEvent("show-toast", {
        detail: {
          title: "Translation Failed",
          description: "Could not translate content. Please try again.",
          variant: "destructive",
        },
      });
      window.dispatchEvent(event);
    } finally {
      setIsLoading(false);
    }
  }, [content, onTranslate]);

  const toggleTranslation = async () => {
    if (isTranslated) {
      onTranslate(originalContent);
      setIsTranslated(false);
    } else {
      await translateContent();
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={`text-xs bg-white/10 border-white/20 text-white hover:bg-white/20 active:scale-95 transition-all duration-200 relative z-10 touch-manipulation ${className || ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[TranslateToggle] Button clicked!");
        toggleTranslation();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[TranslateToggle] Button touched!");
        toggleTranslation();
      }}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Globe className="h-4 w-4 mr-1" />
      )}
      {isTranslated ? "Original" : "Translate"}
    </Button>
  );
}
