import { Router } from "express";
import OpenAI from "openai";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope } from "../services/protocolEnvelope";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const chefPairingsRouter = Router();

chefPairingsRouter.post("/", async (req, res) => {
  try {
    const {
      foodItem,
      cuisine,
      occasion,
      priceRange,
      userId,
      safetyMode,
      overrideToken,
    } = req.body ?? {};

    if (!foodItem) {
      return res.status(400).json({ error: "Food item is required" });
    }

    if (userId) {
      const inputText = [foodItem, cuisine, occasion].filter(Boolean).join(" ");
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "chef-pairings", {
        safetyMode: safetyMode || "STRICT",
        overrideToken: overrideToken,
      });
      if (safetyCheck.result === "BLOCKED") {
        console.log(`[CHEF-PAIRINGS] Blocked for user ${userId}: ${safetyCheck.blockedTerms.join(", ")}`);
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyBlocked: true,
          blockedTerms: safetyCheck.blockedTerms,
          suggestion: safetyCheck.suggestion,
        });
      }
      if (safetyCheck.result === "AMBIGUOUS") {
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyAmbiguous: true,
          ambiguousTerms: safetyCheck.ambiguousTerms,
          suggestion: safetyCheck.suggestion,
        });
      }
    }

    // ── Protocol envelope: enforce dietary identity before generation ──────────
    const chefPairingsEnvelope = userId
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();
    const chefPairingsProtocolBlock = enforceBeforeGenerate(chefPairingsEnvelope, { generatorName: 'chef_pairings' }).combined;

    const prompt = `You are an expert sommelier, beer cicerone, and master distiller. Provide food and drink pairing recommendations for the following food item.
${chefPairingsProtocolBlock ? `\n${chefPairingsProtocolBlock}\n` : ""}
Food Item: ${foodItem}
${cuisine ? `Cuisine: ${cuisine}` : ""}
${occasion ? `Occasion: ${occasion}` : ""}
${priceRange ? `Price Range: ${priceRange}` : ""}

Return JSON with wine, beer, and spirits pairings using this exact structure:

{
  "wine": [
    {
      "name": "Wine name",
      "type": "Red Wine/White Wine/Rosé/Sparkling",
      "description": "Flavor profile description",
      "alcoholContent": "ABV percentage",
      "calories": 125,
      "sugar": "Sugar level (e.g., Dry, Off-dry)",
      "pairingReason": "Why this wine pairs well with the food",
      "healthNotes": ["Health-related note"],
      "medicalCompatibility": {
        "diabeticFriendly": true,
        "lowCalorie": false,
        "reason": "Brief explanation"
      }
    }
  ],
  "beer": [
    {
      "name": "Beer name",
      "type": "Beer",
      "description": "Flavor profile description",
      "alcoholContent": "ABV percentage",
      "calories": 150,
      "sugar": "Sugar level",
      "pairingReason": "Why this beer pairs well with the food",
      "healthNotes": ["Health-related note"],
      "medicalCompatibility": {
        "diabeticFriendly": false,
        "lowCalorie": false,
        "reason": "Brief explanation"
      }
    }
  ],
  "spirits": [
    {
      "name": "Spirit or cocktail name",
      "type": "Bourbon/Whiskey/Tequila/Rum/Vodka/Gin",
      "description": "Flavor profile and serving suggestion",
      "alcoholContent": "ABV or proof",
      "calories": 110,
      "sugar": "Sugar level",
      "pairingReason": "Why this spirit pairs well with the food",
      "healthNotes": ["Health-related note"],
      "medicalCompatibility": {
        "diabeticFriendly": true,
        "lowCalorie": true,
        "reason": "Brief explanation"
      }
    }
  ]
}

RULES:
1. Provide exactly 2 recommendations per category (wine, beer, spirits).
2. Each recommendation must include name, type, description, and pairingReason.
3. Include realistic calorie counts and alcohol content.
4. For medicalCompatibility, consider sugar content for diabetic friendliness and calorie count for lowCalorie (under 120 cal).
5. Tailor all pairings specifically to the food item provided.
6. Include at least one lower-calorie or diabetic-friendly option across all categories when possible.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert sommelier, beer cicerone, and master distiller providing food and drink pairing recommendations. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    let pairings: any;
    try {
      const rawText = completion.choices[0]?.message?.content || "{}";
      pairings = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("[CHEF-PAIRINGS] JSON parse error:", parseErr);
      return res.status(500).json({ error: "AI returned invalid JSON for pairings" });
    }

    return res.json({
      id: `chef-pairing-${Date.now()}`,
      pairings: {
        wine: Array.isArray(pairings.wine) ? pairings.wine : [],
        beer: Array.isArray(pairings.beer) ? pairings.beer : [],
        spirits: Array.isArray(pairings.spirits) ? pairings.spirits : [],
      },
      safety: {
        result: "SAFE",
        message: "No safety conflicts detected",
        blockedTerms: [],
        blockedCategories: [],
        ambiguousTerms: [],
      },
    });
  } catch (err: any) {
    console.error("[CHEF-PAIRINGS] Error:", err);
    return res.status(500).json({ error: "Failed to generate pairings" });
  }
});

export default chefPairingsRouter;
