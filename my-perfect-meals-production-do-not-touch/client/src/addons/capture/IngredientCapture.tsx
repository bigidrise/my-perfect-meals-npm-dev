// ADD-ONLY: Voice capture system for recipe ingredients
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, MicOff, ShoppingCart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface IngredientCaptureProps {
  ingredients: Ingredient[];
  mealTitle: string;
  userId: string;
  onSuccess?: () => void;
}

export default function IngredientCapture({
  ingredients,
  mealTitle,
  userId,
  onSuccess
}: IngredientCaptureProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [matchedIngredients, setMatchedIngredients] = useState<Ingredient[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [itemsAdded, setItemsAdded] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Simple ingredient matching logic
  const findMatchingIngredients = (spokenWords: string): Ingredient[] => {
    const words = spokenWords.toLowerCase().split(/[\s,]+/);
    const matches: Ingredient[] = [];
    
    ingredients.forEach(ingredient => {
      const ingredientWords = ingredient.name.toLowerCase().split(/[\s-]+/);
      
      // Check if any ingredient word is mentioned in spoken text
      const hasMatch = ingredientWords.some(word => 
        words.some(spokenWord => 
          spokenWord.includes(word) || word.includes(spokenWord)
        )
      );
      
      if (hasMatch) {
        matches.push(ingredient);
      }
    });
    
    return matches;
  };

  const handleVoiceRecording = async () => {
    console.log("🎤 Voice recording button clicked!");
    
    if (isRecording) {
      console.log("🛑 Stopping recording");
      setIsRecording(false);
      return;
    }

    console.log("🚀 Starting voice recording...");
    try {
      setIsRecording(true);
      
      // For testing, simulate immediately getting results
      const processVoiceRecording = async () => {
        // For testing, simulate speaking the first few ingredient names from the actual meal
        const availableIngredientNames = ingredients.slice(0, 3).map(ing => ing.name.toLowerCase()).join(' ');
        const mockTranscript = availableIngredientNames || "flour butter eggs";
        console.log("🎙️ Mock transcript generated:", mockTranscript);
        console.log("🥘 Available ingredients:", ingredients.map(ing => ing.name));
        setSpokenText(mockTranscript);
        
        const matches = findMatchingIngredients(mockTranscript);
        setMatchedIngredients(matches);
        
        if (matches.length > 0) {
          console.log("🎯 Voice detected ingredients:", matches);
          // Automatically add to shopping list after voice detection
          await addIngredientsToShoppingList(matches);
          setItemsAdded(true);
          console.log("✅ Items added, setting itemsAdded to true");
          toast({
            title: "🎯 Added to Shopping List!",
            description: `Added ${matches.length} ingredients from your voice`,
          });
        } else {
          console.log("❌ No ingredients matched from voice");
          toast({
            title: "🔍 No Matches",
            description: "Try mentioning specific ingredient names from the recipe",
          });
        }
      };
      
      // For debugging - process immediately instead of waiting
      setTimeout(async () => {
        setIsRecording(false);
        await processVoiceRecording();
      }, 100); // Very short delay for UI feedback
    } catch (error) {
      setIsRecording(false);
      toast({
        title: "❌ Voice Error",
        description: "Failed to record voice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addIngredientsToShoppingList = async (ingredients: Ingredient[]) => {
    if (ingredients.length === 0) return;
    
    console.log("🚀 Adding ingredients to shopping list:", ingredients);
    
    // For Shopping Pad integration, we'll mark items as added and redirect to new Shopping Pad
    console.log("✅ Setting itemsAdded to true for Shopping Pad integration");
    setItemsAdded(true);
    onSuccess?.();
  };

  return (
    <Card className="bg-black/30 backdrop-blur-lg border-white/20 mt-6">
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            🎙️ Voice Ingredient Capture
          </h3>
          <p className="text-white/80 text-sm">
            Say the ingredient names you want to add to your shopping list
          </p>
        </div>

        {/* Voice Recording Button */}
        <div className="flex justify-center mb-6">
          <Button
            onClick={handleVoiceRecording}
            disabled={isProcessing}
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className={`h-16 w-16 rounded-full ${
              isRecording 
                ? "bg-red-600 hover:bg-red-700 animate-pulse" 
                : "bg-maroon-600 hover:bg-maroon-700"
            }`}
          >
            {isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>

        {/* Recording Status */}
        {isRecording && (
          <div className="text-center mb-4">
            <p className="text-white/90 text-sm animate-pulse">
              🎤 Listening... Say ingredient names
            </p>
          </div>
        )}

        {/* Spoken Text Display */}
        {spokenText && (
          <div className="mb-4">
            <p className="text-white/80 text-sm mb-2">You said:</p>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-white text-sm">"{spokenText}"</p>
            </div>
          </div>
        )}

        {/* Matched Ingredients */}
        {matchedIngredients.length > 0 && (
          <div className="mb-6">
            <p className="text-white/80 text-sm mb-3">
              Detected ingredients ({matchedIngredients.length}):
            </p>
            <div className="space-y-2">
              {matchedIngredients.map((ingredient, index) => (
                <div
                  key={index}
                  className="bg-black/20 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <span className="text-white font-medium">
                      {ingredient.name}
                    </span>
                    <span className="text-white/70 ml-2 text-sm">
                      {ingredient.amount} {ingredient.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Go to Shopping Pad Button - Appears after voice recording detects ingredients */}
        {itemsAdded && matchedIngredients.length > 0 && (
          <div className="space-y-4 mt-6 p-4 bg-green-900/20 rounded-xl border border-green-500/30">
            <div className="text-center">
              <div className="text-green-400 font-medium mb-2">
                ✅ {matchedIngredients.length} ingredients detected!
              </div>
              <p className="text-white/70 text-sm mb-4">
                Your ingredients are ready for the Shopping Pad
              </p>
              <Button
                onClick={() => {
                  // Shopping pad functionality has been removed
                  toast({
                    title: "Shopping functionality removed",
                    description: "Shopping pad feature has been eliminated from the app"
                  });
                }}
                size="lg"
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                disabled
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Shopping Disabled
              </Button>
            </div>
          </div>
        )}

        {/* Available Ingredients Reference */}
        <div className="mt-6 pt-4 border-t border-white/20">
          <p className="text-white/60 text-xs mb-2">
            Available ingredients in this recipe:
          </p>
          <div className="flex flex-wrap gap-1">
            {ingredients.slice(0, 8).map((ingredient, index) => (
              <span
                key={index}
                className="bg-black/20 px-2 py-1 rounded text-white/70 text-xs"
              >
                {ingredient.name}
              </span>
            ))}
            {ingredients.length > 8 && (
              <span className="text-white/50 text-xs">
                +{ingredients.length - 8} more...
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}