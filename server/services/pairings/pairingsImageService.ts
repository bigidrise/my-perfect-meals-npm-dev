import { uploadImageToPermanentStorage } from "../permanentImageStorage";
import { log } from "../../vite";

let openaiInstance: any = null;

function getOpenAI() {
  if (!openaiInstance) {
    const OpenAI = require("openai").default;
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

function buildPairingImagePrompt(foodContext: string, drinkName: string, category: string): string {
  const baseStyle = "professional cinematic food photography, elegant restaurant lighting, dark moody background, shallow depth of field, high resolution";

  if (category === "wine") {
    return `${baseStyle}, ${foodContext} beautifully plated alongside a glass of ${drinkName} wine, wine glass with rich color, fine dining presentation`;
  }
  if (category === "beer") {
    return `${baseStyle}, ${foodContext} beautifully plated alongside a glass of ${drinkName} beer, craft beer glass with foam head, gastropub presentation`;
  }
  if (category === "spirits") {
    return `${baseStyle}, ${foodContext} beautifully plated alongside a glass of ${drinkName}, premium spirits presentation, cocktail bar ambiance`;
  }
  return `${baseStyle}, ${foodContext} beautifully plated alongside ${drinkName}, elegant beverage presentation`;
}

export async function generatePairingImage(
  foodContext: string,
  drinkName: string,
  category: string
): Promise<string | null> {
  try {
    const openai = getOpenAI();
    const prompt = buildPairingImagePrompt(foodContext, drinkName, category);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural",
    });

    const tempUrl = response.data?.[0]?.url;
    if (!tempUrl) {
      log(`[PairingsImage] No URL returned for ${drinkName}`, "warn");
      return null;
    }

    const uniqueHash = `pairing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await uploadImageToPermanentStorage({
      imageUrl: tempUrl,
      mealName: `${drinkName}-${category}`,
      imageHash: uniqueHash,
    });

    if (result?.permanentUrl) {
      log(`[PairingsImage] Generated fresh image for ${drinkName}`, "info");
      return result.permanentUrl;
    }

    return null;
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
