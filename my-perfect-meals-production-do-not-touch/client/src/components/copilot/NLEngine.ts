export const interpretFoodCommand = (text: string) => {
  const lower = text.toLowerCase();

  // ==========================
  // ADD INGREDIENTS
  // ==========================
  const addMatch = lower.match(/add (.+) to (my )?(meal|recipe|plate)/);
  if (addMatch) {
    return {
      action: "meal.addIngredient",
      payload: { ingredient: addMatch[1] },
      spokenText: `Adding ${addMatch[1]} to your meal.`,
    };
  }

  // ==========================
  // SWAP INGREDIENT
  // ==========================
  const swapMatch = lower.match(/swap (.+) for (.+)/);
  if (swapMatch) {
    return {
      action: "meal.swapIngredient",
      payload: { from: swapMatch[1], to: swapMatch[2] },
      spokenText: `Replacing ${swapMatch[1]} with ${swapMatch[2]}.`,
    };
  }

  // ==========================
  // BUILD ONE-PAN MEAL
  // ==========================
  if (lower.includes("one pan") || lower.includes("one-pan")) {
    return {
      action: "meals.generateOnePan",
      payload: { text },
      spokenText: "Creating a one-pan dinner based on your request.",
    };
  }

  // ==========================
  // HIGH-PROTEIN REQUESTS
  // ==========================
  if (lower.includes("high protein") || lower.includes("boost my protein")) {
    return {
      action: "macros.highProteinSuggestion",
      spokenText: "Let me build a high protein meal option for you.",
    };
  }

  // ==========================
  // LOW-CARB REQUESTS
  // ==========================
  if (lower.includes("low carb") || lower.includes("lower carb")) {
    return {
      action: "macros.lowerCarbSwap",
      spokenText: "Making a lower carb version for you.",
    };
  }

  // ==========================
  // FRIDGE RESCUE
  // ==========================
  if (lower.includes("fridge rescue")) {
    return {
      action: "fridge.generate",
      payload: { text },
      spokenText:
        "Gathering the ingredients you mentioned for a Fridge Rescue recipe.",
    };
  }

  // ==========================
  // WEEKLY BOARD / MEAL PLAN
  // ==========================
  if (lower.includes("plan my week") || lower.includes("weekly board")) {
    return {
      action: "weekly.autofill",
      spokenText: "Filling your Weekly Board with smart meal choices.",
    };
  }

  // ==========================
  // FALLBACK
  // ==========================
  return {
    action: "unknown",
    spokenText: `I heard "${text}". I'm still learning how to do that.`,
  };
};
