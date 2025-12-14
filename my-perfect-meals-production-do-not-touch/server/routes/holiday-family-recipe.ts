// server/routes/holiday-family-recipe.ts
import express from "express";
import { z } from "zod";
import OpenAI from "openai";

const router = express.Router();

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const RecipeParseReq = z.object({
  name: z.string().min(2),
  description: z.string().min(5), // free text the user pastes
});

router.post("/api/holiday-family-recipe", async (req, res) => {
  const parsed = RecipeParseReq.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }
  const { name, description } = parsed.data;

  try {
    const openai = getOpenAI();
    const sys = `Extract a clean ingredient list from user text. 
Return STRICT JSON with fields: { "name": string, "ingredients": [{ "name": string, "quantity": number|null, "unit": string|null, "prep": string|null }] }. 
Do not add commentary. Quantities may be null if truly missing.`;
    const user = `Name: ${name}\n\nRaw Recipe Text:\n${description}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const raw = resp.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

    // Normalize units a touch for consistency with the feast generator
    const normalizeUnit = (u?: string | null) => {
      if (!u) return null;
      const key = u.toLowerCase();
      const map: Record<string, string> = {
        grams: "g",
        g: "g",
        kilogram: "kg",
        kilograms: "kg",
        kg: "kg",
        ounce: "oz",
        ounces: "oz",
        oz: "oz",
        pound: "lb",
        pounds: "lb",
        lb: "lb",
        lbs: "lb",
        teaspoon: "tsp",
        teaspoons: "tsp",
        tsp: "tsp",
        tablespoon: "tbsp",
        tablespoons: "tbsp",
        tbsp: "tbsp",
        cup: "cup",
        cups: "cup",
        milliliter: "ml",
        milliliters: "ml",
        ml: "ml",
        liter: "l",
        liters: "l",
        l: "l",
        piece: "piece",
        pieces: "piece",
      };
      return map[key] || u;
    };

    const ingredients = Array.isArray(json.ingredients)
      ? json.ingredients.map((i: any) => ({
          name: String(i.name ?? "").trim(),
          quantity: typeof i.quantity === "number" ? i.quantity : null,
          unit: i.unit ? normalizeUnit(String(i.unit)) : null,
          prep: i.prep ? String(i.prep) : null,
        }))
      : [];

    return res.json({ name: String(json.name || name), ingredients });
  } catch (err: any) {
    console.error("[holiday-family-recipe] parse failed:", err);
    return res.status(500).json({ error: "Recipe parse failed" });
  }
});

export default router;
