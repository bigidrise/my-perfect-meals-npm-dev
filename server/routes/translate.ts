import { Router, Request, Response } from "express";
import OpenAI from "openai";

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const languageNames: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  vi: "Vietnamese",
  th: "Thai",
  tr: "Turkish",
  id: "Indonesian",
  ms: "Malay",
  tl: "Tagalog",
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const { content, targetLanguage } = req.body;

    if (!content || !targetLanguage) {
      return res.status(400).json({ error: "Missing content or targetLanguage" });
    }

    if (targetLanguage === "en") {
      return res.json(content);
    }

    const langName = languageNames[targetLanguage] || targetLanguage;

    const prompt = `Translate the following meal/recipe content to ${langName}. 
Keep the same structure and return JSON with the same keys.
Only translate text - do not change numbers, measurements, or formatting.

Content to translate:
${JSON.stringify(content, null, 2)}

Return ONLY valid JSON with translated values for these keys: name, description, instructions, notes, ingredientNames.
If a field is empty, return it as empty.
For ingredientNames, keep each ingredient on its own line (separated by newlines).`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a translation assistant. Return only valid JSON with translated content. Do not add any explanation.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || "";
    
    let jsonStr = translatedText;
    if (translatedText.startsWith("```json")) {
      jsonStr = translatedText.slice(7, -3).trim();
    } else if (translatedText.startsWith("```")) {
      jsonStr = translatedText.slice(3, -3).trim();
    }

    try {
      const translated = JSON.parse(jsonStr);
      return res.json(translated);
    } catch (parseError) {
      console.error("Translation parse error:", parseError);
      return res.json(content);
    }
  } catch (error: any) {
    console.error("Translation API error:", error);
    return res.status(500).json({ error: "Translation failed" });
  }
});

export default router;
