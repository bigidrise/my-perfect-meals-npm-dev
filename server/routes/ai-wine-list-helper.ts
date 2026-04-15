import { Router } from "express";
import { WineListHelperRequest, PairingItem } from "@shared/types/pairings";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { loadPairingsProfile } from "../services/pairings/profileContext";
import { buildPairingsConstraints } from "../services/pairings/pairingsPersonalization";
import { generatePairingImages } from "../services/pairings/pairingsImageService";
import { chatJson } from "../utils/openaiSafe";
import { log } from "../vite";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope } from "../services/protocolEnvelope";

const router = Router();

function buildWineListPrompt(wineListText: string, mealContext: string | undefined, constraints: string): string {
  const mealLine = mealContext
    ? `The user is planning to eat: "${mealContext}". Recommend the best wine from the list for this meal.`
    : "No specific meal mentioned. Provide general pairing suggestions for each wine.";

  return `You are a world-class sommelier and wine educator.

MULTILINGUAL SUPPORT: The user may submit requests in any language. Interpret the intent regardless of language and generate results in the same language as the input unless the user asks otherwise.

The user has pasted a wine list from a restaurant and needs help understanding it.

WINE LIST:
${wineListText}

${mealLine}

For EACH wine on the list, provide:
- category: "wine" (always)
- name: the wine name exactly as listed
- explanation: Explain what this wine is in simple, approachable language. Describe the grape variety, region style, and what to expect when drinking it. Explain the flavor science — how acidity, tannins, body, and fruit character define this wine. Do NOT use generic descriptions.
- alternatives: 2-3 similar wines the user might also enjoy
- servingTips: ideal food pairings, serving temperature, decanting notes
- flavorProfile: array of 3-6 tasting notes (REQUIRED)
- body: "light", "medium", or "full" (REQUIRED)
- acidity: "low", "medium", or "high" (REQUIRED)
- sweetness: "dry", "off-dry", or "sweet" (REQUIRED)
${constraints}

Also determine which wine is the BEST CHOICE overall${mealContext ? " for the specified meal" : ""} and explain why.

Return valid JSON:
{
  "bestChoice": {
    "name": "...",
    "explanation": "Why this is the best choice..."
  },
  "pairings": [
    {
      "category": "wine",
      "name": "...",
      "explanation": "...",
      "alternatives": ["...", "..."],
      "servingTips": "...",
      "flavorProfile": ["...", "..."],
      "body": "light|medium|full",
      "acidity": "low|medium|high",
      "sweetness": "dry|off-dry|sweet"
    }
  ]
}`;
}

router.post("/", async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    if (!authUser?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const userId = authUser.id;

    const parsed = WineListHelperRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { wineListText, mealContext, safetyMode, overrideToken } = parsed.data;

    const safetyInput = [wineListText, mealContext].filter(Boolean).join(" ");
    const safetyCheck = await enforceSafetyProfile(userId, safetyInput, "wine-list-helper", {
      safetyMode: safetyMode || "STRICT",
      overrideToken,
    });

    if (safetyCheck.result === "BLOCKED" || safetyCheck.result === "AMBIGUOUS") {
      return res.status(400).json({
        error: "Safety check failed",
        safety: safetyCheck,
      });
    }

    const profile = await loadPairingsProfile(userId);
    const constraints = buildPairingsConstraints(profile);

    // ── Protocol envelope: add identity-level enforcement above profile constraints ──
    const wineListEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
    const wineListProtocolBlock = enforceBeforeGenerate(wineListEnvelope, { generatorName: 'wine_list_helper' }).combined;
    const augmentedConstraints = wineListProtocolBlock
      ? `${wineListProtocolBlock}\n${constraints.fullConstraintBlock}`
      : constraints.fullConstraintBlock;

    const prompt = buildWineListPrompt(wineListText, mealContext, augmentedConstraints);

    let aiResult: any;
    try {
      aiResult = await chatJson({
        model: "gpt-4o",
        system: "You are a premium wine education AI. Return only valid JSON.",
        user: prompt,
        temperature: 0.6,
      });
    } catch (err: any) {
      log(`[WineListHelper] OpenAI call failed: ${err.message}`, "error");
      return res.status(500).json({ error: "AI generation failed" });
    }

    const bestChoice = aiResult?.bestChoice;
    const pairings = aiResult?.pairings;

    if (!bestChoice || !Array.isArray(pairings) || pairings.length === 0) {
      log("[WineListHelper] AI returned invalid results", "warn");
      return res.status(500).json({ error: "AI returned invalid results" });
    }

    const validatedPairings: any[] = [];
    for (const p of pairings) {
      const itemParsed = PairingItem.safeParse({ ...p, category: "wine", imageUrl: null });
      if (itemParsed.success) {
        validatedPairings.push(itemParsed.data);
      }
    }

    if (validatedPairings.length === 0) {
      return res.status(500).json({ error: "AI returned no valid wine entries" });
    }

    const imageMap = await generatePairingImages(
      validatedPairings.map((p) => ({ name: p.name, category: "wine" })),
      mealContext || "wine tasting"
    );

    for (const p of validatedPairings) {
      const key = `wine:${p.name}`;
      p.imageUrl = imageMap.get(key) || null;
    }

    return res.json({
      query: { wineListText, mealContext },
      bestChoice,
      pairings: validatedPairings,
      safety: {
        result: "SAFE",
        message: "Request passed safety checks",
        blockedTerms: [],
        blockedCategories: [],
        ambiguousTerms: [],
      },
    });
  } catch (error: any) {
    log(`[WineListHelper] Unexpected error: ${error.message}`, "error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
