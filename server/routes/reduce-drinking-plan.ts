import { Router } from "express";
import { ReduceDrinkingPlanRequest } from "@shared/types/pairings";
import { chatJson } from "../utils/openaiSafe";
import { log } from "../vite";

const router = Router();

function buildReductionPrompt(
  baselineIntake: number,
  daysPerWeek: number,
  pace: string,
  customReductionPct?: number,
  goalDate?: string
): string {
  const weeklyTotal = baselineIntake * daysPerWeek;
  const paceDesc =
    pace === "gentle"
      ? "Reduce slowly over many weeks (10-15% per week). Prioritize comfort and sustainability."
      : pace === "custom" && customReductionPct
        ? `Reduce by approximately ${customReductionPct}% per week.`
        : "Reduce at a moderate pace (15-25% per week). Balance speed with sustainability.";

  const goalLine = goalDate ? `The user's goal date is: ${goalDate}. Adjust the timeline to fit.` : "";

  return `You are a compassionate, evidence-based health advisor specializing in harm reduction for alcohol consumption.

The user wants to reduce their drinking. Here is their current baseline:
- Drinks per day (on drinking days): ${baselineIntake}
- Drinking days per week: ${daysPerWeek}
- Total weekly drinks: ${weeklyTotal}

Reduction pace: ${paceDesc}
${goalLine}

Create a personalized reduction plan. Be supportive, non-judgmental, and evidence-based.

IMPORTANT RULES:
- NEVER recommend going to zero unless the user is at low baseline. Harm reduction, not abstinence, is the default.
- If the user reports more than 14 drinks/week (male) or 7 drinks/week (female), flag as "moderate" or "high" risk tier.
- If the baseline suggests dependency risk (21+ weekly drinks), include a medical flag recommending professional support.
- Always include a medical disclaimer.

Return valid JSON:
{
  "summary": {
    "baselineDrinksPerWeek": ${weeklyTotal},
    "projectedWeeks": <number>,
    "riskTier": "low|moderate|high",
    "overviewMessage": "A brief supportive summary of the plan."
  },
  "weeklyTargets": [
    {
      "week": 1,
      "maxDrinksPerDay": <number>,
      "maxDrinksPerWeek": <number>,
      "notes": "Supportive guidance for this week."
    }
  ],
  "harmReductionTips": [
    "Practical tip 1",
    "Practical tip 2"
  ],
  "medicalFlags": [
    "Any medical concerns or recommendations for professional support"
  ],
  "disclaimer": "This plan is educational guidance only. It is not a substitute for medical advice. If you experience withdrawal symptoms, seek medical attention immediately."
}

Provide 4-12 weeks of targets depending on the pace and baseline.`;
}

router.post("/", async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    if (!authUser?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parsed = ReduceDrinkingPlanRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { baselineIntake, daysPerWeek, pace, customReductionPct, goalDate } = parsed.data;

    const prompt = buildReductionPrompt(baselineIntake, daysPerWeek, pace, customReductionPct, goalDate);

    let aiResult: any;
    try {
      aiResult = await chatJson({
        model: "gpt-4o",
        system: "You are a compassionate health advisor. Return only valid JSON.",
        user: prompt,
        temperature: 0.5,
      });
    } catch (err: any) {
      log(`[ReduceDrinkingPlan] OpenAI call failed: ${err.message}`, "error");
      return res.status(500).json({ error: "AI generation failed" });
    }

    if (!aiResult?.summary || !Array.isArray(aiResult?.weeklyTargets)) {
      log("[ReduceDrinkingPlan] AI returned invalid results", "warn");
      return res.status(500).json({ error: "AI returned invalid results" });
    }

    return res.json({
      ...aiResult,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    log(`[ReduceDrinkingPlan] Unexpected error: ${error.message}`, "error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
