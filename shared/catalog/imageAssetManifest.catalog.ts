// -----------------------------------------------------------------------------
// IMAGE ASSET MANIFEST — Hybrid Meal Engine
// -----------------------------------------------------------------------------

export interface ImageAssetEntry {
  imageKey: string;
  fileName: string;
  category: "protein" | "carb" | "vegetable" | "fruit" | "fat" | "dairy";
  fallbackKey?: string;
}

export const IMAGE_ASSET_MANIFEST: ImageAssetEntry[] = [

  // ---------------------------------------------------------------------------
  // PROTEINS
  // ---------------------------------------------------------------------------

  // Chicken Breast
  { imageKey: "protein_chicken_grilled", fileName: "grilled-chicken-breast.jpg", category: "protein" },
  { imageKey: "protein_chicken_baked", fileName: "baked-chicken-breast.jpg", category: "protein" },
  { imageKey: "protein_chicken_seared", fileName: "seared-chicken-breast.jpg", category: "protein" },
  { imageKey: "protein_chicken_airfried", fileName: "airfried-chicken-breast.jpg", category: "protein" },

  // Chicken Thigh
  { imageKey: "protein_chickenthigh_baked", fileName: "baked-chicken-thigh.jpg", category: "protein" },
  { imageKey: "protein_chickenthigh_grilled", fileName: "grilled-chicken-thigh.jpg", category: "protein" },
  { imageKey: "protein_chickenthigh_airfried", fileName: "airfried-chicken-thigh.jpg", category: "protein" },

  // Lean Ground Beef
  { imageKey: "protein_groundbeef_seared", fileName: "seared-ground-beef.jpg", category: "protein" },
  { imageKey: "protein_groundbeef_fried", fileName: "fried-ground-beef.jpg", category: "protein" },

  // Ground Turkey
  { imageKey: "protein_groundturkey_seared", fileName: "seared-ground-turkey.jpg", category: "protein" },
  { imageKey: "protein_groundturkey_baked", fileName: "baked-ground-turkey.jpg", category: "protein" },

  // Salmon
  { imageKey: "protein_salmon_baked", fileName: "baked-salmon.jpg", category: "protein" },
  { imageKey: "protein_salmon_seared", fileName: "seared-salmon.jpg", category: "protein" },
  { imageKey: "protein_salmon_grilled", fileName: "grilled-salmon.jpg", category: "protein" },

  // Shrimp
  { imageKey: "protein_shrimp_seared", fileName: "seared-shrimp.jpg", category: "protein" },
  { imageKey: "protein_shrimp_grilled", fileName: "grilled-shrimp.jpg", category: "protein" },
  { imageKey: "protein_shrimp_baked", fileName: "baked-shrimp.jpg", category: "protein" },

  // Cod
  { imageKey: "protein_cod_baked", fileName: "baked-cod.jpg", category: "protein" },
  { imageKey: "protein_cod_poached", fileName: "poached-cod.jpg", category: "protein" },
  { imageKey: "protein_cod_seared", fileName: "seared-cod.jpg", category: "protein" },

  // Egg Whites
  { imageKey: "protein_eggwhites_scrambled", fileName: "scrambled-egg-whites.jpg", category: "protein" },
  { imageKey: "protein_eggwhites_fried", fileName: "fried-egg-whites.jpg", category: "protein" },
  { imageKey: "protein_eggwhites_boiled", fileName: "boiled-egg-whites.jpg", category: "protein" },

  // Whole Eggs
  { imageKey: "protein_eggs_scrambled", fileName: "scrambled-eggs.jpg", category: "protein" },
  { imageKey: "protein_eggs_fried", fileName: "fried-eggs.jpg", category: "protein" },
  { imageKey: "protein_eggs_poached", fileName: "poached-eggs.jpg", category: "protein" },


  // ---------------------------------------------------------------------------
  // CARBS
  // ---------------------------------------------------------------------------

  // Rice
  { imageKey: "carb_rice_boiled", fileName: "boiled-rice.jpg", category: "carb" },
  { imageKey: "carb_rice_steamed", fileName: "steamed-rice.jpg", category: "carb" },

  // Brown Rice
  { imageKey: "carb_brownrice_boiled", fileName: "boiled-brown-rice.jpg", category: "carb" },
  { imageKey: "carb_brownrice_steamed", fileName: "steamed-brown-rice.jpg", category: "carb" },

  // Potatoes
  { imageKey: "carb_potato_baked", fileName: "baked-potato.jpg", category: "carb" },
  { imageKey: "carb_potato_boiled", fileName: "boiled-potatoes.jpg", category: "carb" },
  { imageKey: "carb_potato_fried", fileName: "fried-potatoes.jpg", category: "carb" },

  // Sweet Potatoes
  { imageKey: "carb_sweetpotato_baked", fileName: "baked-sweet-potato.jpg", category: "carb" },
  { imageKey: "carb_sweetpotato_boiled", fileName: "boiled-sweet-potatoes.jpg", category: "carb" },

  // Oats
  { imageKey: "carb_oats_boiled", fileName: "boiled-oats.jpg", category: "carb" },


  // ---------------------------------------------------------------------------
  // VEGETABLES
  // ---------------------------------------------------------------------------

  // Broccoli
  { imageKey: "veg_broccoli_steamed", fileName: "steamed-broccoli.jpg", category: "vegetable" },
  { imageKey: "veg_broccoli_roasted", fileName: "roasted-broccoli.jpg", category: "vegetable" },

  // Asparagus
  { imageKey: "veg_asparagus_roasted", fileName: "roasted-asparagus.jpg", category: "vegetable" },
  { imageKey: "veg_asparagus_steamed", fileName: "steamed-asparagus.jpg", category: "vegetable" },

  // Zucchini
  { imageKey: "veg_zucchini_seared", fileName: "seared-zucchini.jpg", category: "vegetable" },
  { imageKey: "veg_zucchini_roasted", fileName: "roasted-zucchini.jpg", category: "vegetable" },

  // Spinach
  { imageKey: "veg_spinach_steamed", fileName: "steamed-spinach.jpg", category: "vegetable" },
  { imageKey: "veg_spinach_wilted", fileName: "wilted-spinach.jpg", category: "vegetable" },

];

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

export function getImageAsset(imageKey: string): ImageAssetEntry | undefined {
  return IMAGE_ASSET_MANIFEST.find(entry => entry.imageKey === imageKey);
}

export function getImageUrl(imageKey: string, baseUrl: string): string {
  const entry = getImageAsset(imageKey);

  if (entry) {
    return `${baseUrl}/${entry.fileName}`;
  }

  const allEntries = IMAGE_ASSET_MANIFEST.find(e => e.imageKey === imageKey);
  if (allEntries?.fallbackKey) {
    const fallback = getImageAsset(allEntries.fallbackKey);
    if (fallback) {
      return `${baseUrl}/${fallback.fileName}`;
    }
  }

  return `${baseUrl}/generic-meal.jpg`;
}

export function getAllImageKeys(): string[] {
  return IMAGE_ASSET_MANIFEST.map(entry => entry.imageKey);
}

export function getImagesByCategory(category: ImageAssetEntry["category"]): ImageAssetEntry[] {
  return IMAGE_ASSET_MANIFEST.filter(entry => entry.category === category);
}
