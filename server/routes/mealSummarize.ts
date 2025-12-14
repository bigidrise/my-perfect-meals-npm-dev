import express from "express";
import { OpenAI } from "openai";

const router = express.Router();

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

router.post("/meal-summarize", async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || text.trim().length < 3) {
      return res.status(400).json({ error: "Text required" });
    }

    const prompt = `
Summarize this freeform meal description into ONE concise line.
- Keep only the foods and basic prep.
- No analysis, no macros.
- If a time is mentioned, put it in parentheses at the end like (breakfast) or (lunch).
- Examples:
Input: "this morning I had a bowl of oatmeal with blueberries and almond butter"
Output: "Oatmeal with blueberries and almond butter (breakfast)"

Input: "had grilled chicken with quinoa and roasted broccoli for dinner"
Output: "Grilled chicken with quinoa and roasted broccoli (dinner)"

Text: """${text}"""
Return ONLY the one-line summary.`;

    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You convert freeform meal notes into a concise meal line.",
        },
        { role: "user", content: prompt },
      ],
    });

    const summary = resp.choices?.[0]?.message?.content?.trim();
    if (!summary)
      return res.status(500).json({ error: "No summary generated" });
    res.json({ summary });
  } catch (err: any) {
    console.error("meal-summarize error", err.message);
    res.status(500).json({ error: "Summarization failed" });
  }
});

export default router;
