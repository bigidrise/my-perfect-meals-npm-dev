import { generateImage } from "../imageService";
import { log } from "../../vite";

export async function generatePairingImage(
  foodContext: string,
  drinkName: string,
  category: string
): Promise<string | null> {
  try {
    const imageUrl = await generateImage({
      name: `${drinkName} paired with ${foodContext}`,
      description: buildPairingDescription(foodContext, drinkName, category),
      type: "beverage",
    });

    if (imageUrl) {
      log(`[PairingsImage] Generated image for ${drinkName}`, "info");
    }

    return imageUrl;
  } catch (error: any) {
    log(`[PairingsImage] Failed to generate image for ${drinkName}: ${error.message}`, "warn");
    return null;
  }
}

function buildPairingDescription(foodContext: string, drinkName: string, category: string): string {
  if (category === "wine") {
    return `elegant wine glass of ${drinkName} with rich color, fine dining presentation alongside ${foodContext}, dark moody background, shallow depth of field`;
  }
  if (category === "beer") {
    return `craft beer glass of ${drinkName} with foam head, gastropub presentation alongside ${foodContext}, dark moody background, shallow depth of field`;
  }
  if (category === "spirits") {
    return `premium spirits glass of ${drinkName}, cocktail bar ambiance alongside ${foodContext}, dark moody background, shallow depth of field`;
  }
  return `elegant beverage presentation of ${drinkName} alongside ${foodContext}, dark moody background, shallow depth of field`;
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
