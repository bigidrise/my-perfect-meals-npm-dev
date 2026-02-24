import express from "express";
import { OpenAI } from "openai";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";

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

router.post("/chef/ask", requireAuth, requireActiveAccess, async (req, res) => {
  try {
    const { question } = req.body as { question: string };
    if (!question || question.trim().length < 2) {
      return res.status(400).json({ error: "Question required" });
    }

    const system = "You are a concise, friendly culinary coach. Give practical, safe cooking and nutrition advice. Keep answers short.";
    const user = question.trim();

    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
    });

    const answer = resp.choices?.[0]?.message?.content?.trim() || "Sorry — I didn't catch that.";
    res.json({ answer });
  } catch (e: any) {
    console.error("chef/ask", e.message);
    res.status(500).json({ error: "Chef assistant failed" });
  }
});

export default router;
