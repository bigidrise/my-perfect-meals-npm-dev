
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PreparationModalProps {
  open: boolean;
  ingredientName: string;
  onClose: () => void;
  onSelect: (ingredient: string, style: string) => void;
}

// 🔥 INGREDIENT ALIAS MAP - Maps all variations to canonical names
const INGREDIENT_ALIASES: Record<string, string[]> = {
  // Eggs
  "Eggs": ["egg", "eggs", "whole egg", "whole eggs"],
  "Egg Whites": ["egg white", "egg whites"],

  // Steaks (all variations)
  "Steak": ["steak", "steaks", "steak strips", "beef steak", "beef steaks"],
  "Ribeye": ["ribeye", "ribeye steak", "rib eye", "rib-eye"],
  "Ribeye Steak": ["ribeye steak", "ribeye steaks"],
  "Sirloin Steak": ["sirloin", "sirloin steak", "top sirloin", "sirloin steaks"],
  "Filet Mignon": ["filet mignon", "filet", "tenderloin"],
  "Flank Steak": ["flank steak", "flank", "flank steaks"],

  // Potatoes (ALL VARIATIONS)
  "Potatoes": ["potato", "potatoes", "roasted potato", "roasted potatoes", "diced potato", "diced potatoes"],
  "Red Potatoes": ["red potato", "red potatoes"],
  "Sweet Potatoes": ["sweet potato", "sweet potatoes", "mashed sweet potato", "sweet potato mash", "yam", "yams"],

  // Chicken
  "Chicken Breast": ["chicken", "chicken breast", "chicken breasts", "grilled chicken", "chicken breast strips"],
  "Chicken Thighs": ["chicken thigh", "chicken thighs"],

  // Turkey
  "Turkey Breast": ["turkey", "turkey breast", "turkey breasts"],

  // Fish
  "Salmon": ["salmon", "salmon fillet", "salmon fillets", "salmon steak"],
  "Tilapia": ["tilapia", "tilapia fillet", "tilapia fillets"],
  "Cod": ["cod", "cod fillet", "cod fillets"],
  "Swordfish": ["swordfish", "swordfish steak", "swordfish fillet"],
  "Tuna": ["tuna", "tuna steak", "tuna fillet"],
  "Halibut": ["halibut", "halibut steak", "halibut fillet"],
  "Mahi Mahi": ["mahi mahi", "mahi-mahi", "mahi mahi steak"],

  // Rice (all variations)
  "Rice": ["rice"],
  "Brown Rice": ["brown rice"],
  "White Rice": ["white rice"],
  "Jasmine Rice": ["jasmine rice"],
  "Basmati Rice": ["basmati rice"],

  // Vegetables
  "Broccoli": ["broccoli", "broccoli florets"],
  "Asparagus": ["asparagus", "asparagus spears"],
  "Green Beans": ["green bean", "green beans"],
};

// 🔥 NORMALIZE INGREDIENT NAME - Converts any variation to canonical form
function normalizeIngredientName(name: string): string {
  const normalized = name.trim().toLowerCase();
  
  // Search through aliases to find canonical name
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.some(alias => normalized === alias.toLowerCase())) {
      return canonical;
    }
  }
  
  // If no match found, try fuzzy matching (contains)
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.some(alias => normalized.includes(alias.toLowerCase()) || alias.toLowerCase().includes(normalized))) {
      return canonical;
    }
  }
  
  // Fallback: return original name with proper capitalization
  return name;
}

export default function PreparationModal({
  open,
  ingredientName,
  onClose,
  onSelect
}: PreparationModalProps) {
  const [selectedStyle, setSelectedStyle] = useState('');

  // 🔥 MASTER LIST OF PREP OPTIONS (using canonical names)
  const PREP_OPTIONS: Record<string, string[]> = {
    // Eggs
    "Eggs": ["Scrambled", "Sunny Side Up", "Omelet", "Poached", "Hard Boiled"],
    "Egg Whites": ["Scrambled", "Omelet", "Pan-Seared", "Poached"],

    // Steak
    "Steak": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    "Ribeye": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    "Ribeye Steak": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    "Sirloin Steak": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    "Filet Mignon": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],
    "Flank Steak": ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done"],

    // Potatoes (PLURAL CANONICAL)
    "Potatoes": ["Hash Browns", "Home Style (Diced)", "Roasted Cubes", "Air-Fried", "Mashed", "Baked"],
    "Red Potatoes": ["Roasted Cubes", "Air-Fried", "Boiled"],
    "Sweet Potatoes": ["Baked", "Mashed", "Roasted Cubes", "Air-Fried"],

    // Chicken
    "Chicken Breast": ["Grilled", "Baked", "Pan-Seared", "Air-Fried"],
    "Chicken Thighs": ["Grilled", "Baked", "Pan-Seared", "Air-Fried"],

    // Turkey
    "Turkey Breast": ["Grilled", "Baked", "Pan-Seared", "Roasted"],

    // Fish
    "Salmon": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],
    "Tilapia": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],
    "Cod": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],
    "Swordfish": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],
    "Tuna": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked", "Raw-Center (Sushi-Grade Only)"],
    "Halibut": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],
    "Mahi Mahi": ["Lightly Seared (Center Slightly Translucent)", "Fully Cooked (Opaque Throughout)", "Char-Grilled / Crisp Edges", "Pan-Seared & Butter-Basted", "Broiled / Oven-Roasted", "Lemon-Herb Poached / Gentle Cooked"],

    // Rice
    "Rice": ["Steamed", "Boiled"],
    "Brown Rice": ["Steamed", "Boiled"],
    "White Rice": ["Steamed", "Boiled"],
    "Jasmine Rice": ["Steamed", "Boiled"],
    "Basmati Rice": ["Steamed", "Boiled"],

    // Vegetables
    "Broccoli": ["Steamed", "Roasted", "Air-Fried"],
    "Asparagus": ["Steamed", "Roasted", "Grilled"],
    "Green Beans": ["Steamed", "Roasted", "Sautéed"]
  };

  // 🔥 Normalize the ingredient name before lookup
  const canonicalName = normalizeIngredientName(ingredientName);
  const styles = PREP_OPTIONS[canonicalName] || [];

  const handleSelect = () => {
    if (selectedStyle) {
      onSelect(ingredientName, selectedStyle);
      setSelectedStyle('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { setSelectedStyle(''); onClose(); } }}>
      <DialogContent className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-base">
            How do you want your {ingredientName.toLowerCase()}?
          </DialogTitle>
        </DialogHeader>

        {styles.length > 0 ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {styles.map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedStyle === style
                      ? 'bg-emerald-600/70 border-emerald-400 text-white shadow-lg'
                      : 'bg-black/50 border-white/20 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => { setSelectedStyle(''); onClose(); }}
                className="bg-black/40 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedStyle}
                onClick={handleSelect}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Use This Style
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-white/60 text-sm">This ingredient has no preparation options.</p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  // Add ingredient with empty style (no prep needed)
                  onSelect(ingredientName, '');
                  onClose();
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                OK
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// 🔥 EXPORT the normalization function so other components can use it
export { normalizeIngredientName };
