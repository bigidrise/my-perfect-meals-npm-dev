import { Router } from "express";
import { PairingsAIRequest, PairingItem } from "@shared/types/pairings";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { loadPairingsProfile } from "../services/pairings/profileContext";
import { buildPairingsConstraints } from "../services/pairings/pairingsPersonalization";
import { generatePairingImages } from "../services/pairings/pairingsImageService";
import { chatJson } from "../utils/openaiSafe";
import { log } from "../vite";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope } from "../services/protocolEnvelope";

const router = Router();

function buildPairingPrompt(
  mode: string,
  category: string,
  input: string,
  constraints: string
): string {
  const categoryInstruction =
    category === "both"
      ? "Provide at least one wine pairing and one beer pairing."
      : `Focus on ${category} pairings.`;

  if (mode === "discovery") {
    return `You are a world-class sommelier, cicerone, and spirits expert.

MULTILINGUAL SUPPORT: The user may submit requests in any language. Interpret the intent regardless of language and generate results in the same language as the input unless the user asks otherwise. Geographic discovery queries (e.g., "Beer from Switzerland", "啤酒来自瑞士") should return drinks from that region.

The user wants to discover drinks similar to: "${input}"
Category focus: ${category}

${categoryInstruction}

For EACH recommendation, you MUST provide:
- category: "${category}" (wine, beer, spirits, or non-alcoholic)
- name: the drink name
- explanation: WHY this drink is similar — describe the flavor science, malt/hop/grape/barrel characteristics that connect them. Do NOT use generic language like "goes well with" — explain the actual tasting mechanism.
- alternatives: 2-3 other similar options
- servingTips: ideal serving temperature, glassware, or context
- flavorProfile: array of 3-6 tasting notes (e.g., ["roasted", "chocolate", "coffee", "bitter"])
- body: "light", "medium", or "full"
${category === "wine" ? '- acidity: "low", "medium", or "high"\n- sweetness: "dry", "off-dry", or "sweet"' : ""}
${category === "beer" ? '- bitterness: "low", "medium", or "high"' : ""}

flavorProfile and body are REQUIRED for discovery mode.
${category === "wine" ? "acidity and sweetness are REQUIRED for wine discovery." : ""}
${category === "beer" ? "bitterness is REQUIRED for beer discovery." : ""}
${constraints}

Return valid JSON with this structure:
{
  "pairings": [
    {
      "category": "wine|beer|spirits|non-alcoholic",
      "name": "...",
      "explanation": "...",
      "alternatives": ["...", "..."],
      "servingTips": "...",
      "flavorProfile": ["...", "..."],
      "body": "light|medium|full"
    }
  ]
}

Return 3-5 recommendations.`;
  }

  return `You are a world-class sommelier, cicerone, and spirits expert.

MULTILINGUAL SUPPORT: The user may submit requests in any language. Interpret the intent regardless of language and generate results in the same language as the input unless the user asks otherwise. Geographic discovery queries (e.g., "Beer from Switzerland", "啤酒来自瑞士") should return drinks from that region.

The user is eating: "${input}"
${categoryInstruction}

For EACH pairing recommendation, you MUST provide:
- category: the drink type (wine, beer, spirits, or non-alcoholic)
- name: specific drink name (e.g., "Cabernet Sauvignon" not just "red wine")
- explanation: WHY this pairing works — explain the food science. Describe how tannins, acidity, carbonation, malt, hops, or barrel character interact with the food's fat, protein, sweetness, or spice. Do NOT use generic language like "complements the dish" — explain the actual mechanism.
- alternatives: 2-3 other options in the same category
- servingTips: ideal serving temperature, glassware, or food preparation notes
- flavorProfile: array of 3-6 tasting notes (optional for pairing mode)
- body: "light", "medium", or "full" (optional for pairing mode)
${constraints}

Return valid JSON with this structure:
{
  "pairings": [
    {
      "category": "wine|beer|spirits|non-alcoholic",
      "name": "...",
      "explanation": "...",
      "alternatives": ["...", "..."],
      "servingTips": "..."
    }
  ]
}

Return 2-4 pairings covering the requested categories.`;
}

router.post("/", async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    if (!authUser?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const userId = authUser.id;

    const parsed = PairingsAIRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { mode, category, input, safetyMode, overrideToken } = parsed.data;

    const safetyCheck = await enforceSafetyProfile(userId, input, "pairings-ai", {
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
    const pairingsEnvelope = await loadUserProtocolEnvelope(userId).catch(() => null) ?? buildGuestEnvelope();
    const pairingsProtocolBlock = enforceBeforeGenerate(pairingsEnvelope, { generatorName: 'pairings_ai' }).combined;
    const augmentedConstraints = pairingsProtocolBlock
      ? { ...constraints, fullConstraintBlock: `${pairingsProtocolBlock}\n${constraints.fullConstraintBlock}` }
      : constraints;

    const prompt = buildPairingPrompt(mode, category, input, augmentedConstraints.fullConstraintBlock);

    let aiResult: any;
    try {
      aiResult = await chatJson({
        model: "gpt-4o",
        system: "You are a premium drink pairing AI. Return only valid JSON.",
        user: prompt,
        temperature: 0.7,
      });
    } catch (err: any) {
      log(`[PairingsAI] OpenAI call failed: ${err.message}`, "error");
      return res.status(500).json({ error: "AI generation failed" });
    }

    const pairings = aiResult?.pairings;
    if (!Array.isArray(pairings) || pairings.length === 0) {
      log("[PairingsAI] AI returned no pairings", "warn");
      return res.status(500).json({ error: "AI returned invalid results" });
    }

    const validatedPairings: any[] = [];
    for (const p of pairings) {
      const itemParsed = PairingItem.safeParse({ ...p, imageUrl: null });
      if (itemParsed.success) {
        validatedPairings.push(itemParsed.data);
      } else {
        log(`[PairingsAI] Skipping invalid pairing item: ${JSON.stringify(p)}`, "warn");
      }
    }

    if (validatedPairings.length === 0) {
      return res.status(500).json({ error: "AI returned no valid pairings" });
    }

    const imageMap = await generatePairingImages(
      validatedPairings.map((p) => ({ name: p.name, category: p.category })),
      input
    );

    for (const p of validatedPairings) {
      const key = `${p.category}:${p.name}`;
      p.imageUrl = imageMap.get(key) || null;
    }

    const detectedIntent = mode === "discovery" ? "discovery" : "pairing";

    return res.json({
      query: { input, detectedIntent, category },
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
    log(`[PairingsAI] Unexpected error: ${error.message}`, "error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
