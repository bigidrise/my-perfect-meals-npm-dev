import { generateMealImageUnified } from "../mealImageGenerator";
import { log } from "../../vite";

// Drink pairing images are inherently name-driven — no recipe exists for a pairing
// suggestion, so no ingredient contract can be enforced. This is an accepted
// no-recipe exception: we call generateMealImageUnified directly with sourceType
// "beverage" and an empty ingredient list, which returns a semantic beverage
// fallback image without triggering the [img-contract] deprecation warning.
export async function generatePairingImage(
  foodContext: string,
  drinkName: string,
  category: string
): Promise<string | null> {
  try {
    const imageUrl = await generateMealImageUnified(
      `${drinkName} paired with ${foodContext}`,
      [], // no recipe — name-driven beverage image; accepted no-recipe exception
      "beverage"
    );

    if (imageUrl) {
      log(`[PairingsImage] Generated image for ${drinkName}`, "info");
    }

    return imageUrl;
  } catch (error: any) {
    log(`[PairingsImage] Failed to generate image for ${drinkName}: ${error.message}`, "warn");
    return null;
  }
}


export async function generatePairingImages(
  pairings: Array<{ name: string; category: string }>,
  foodContext: string
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  const settled = await Promise.allSettled(
    pairings.map(async (p) => {
      const url = await generatePairingImage(foodContext, p.name, p.category);
      return { key: `${p.category}:${p.name}`, url };
    })
  );

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.set(result.value.key, result.value.url);
    }
  }

  return results;
}
