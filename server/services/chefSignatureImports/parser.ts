// server/services/chefSignatureImports/parser.ts
// Uses GPT to extract a structured chef signature item draft from a YouTube transcript.
// 
// OUTPUT CONTRACT:
// - ingredients, techniques, tags are arrays of STRINGS (not objects)
// - All values are plain text — no HTML, no Markdown, no JSON injection attempts
// - The parser does NOT invent nutritional values (macro truth contract: null = unknown)
// - The result is a DRAFT — it enters the DB as import_status='needs_review'

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParsedSignatureItemDraft = {
  name: string;
  description: string;
  kind: "recipe" | "dish" | "sauce" | "beverage" | "snack";
  ingredients: string[];
  techniques: string[];
  tags: string[];
  rawTitle: string;
  confidence: "high" | "medium" | "low";
  parserNotes: string;
};

// Must match the DB signatureItemKindEnum: dish | sauce | beverage | snack | recipe
const KIND_VALUES = ["recipe", "dish", "sauce", "beverage", "snack"] as const;

export async function parseTranscriptIntoItemDraft(
  transcript: string,
  videoTitle: string,
  videoDescription: string,
): Promise<ParsedSignatureItemDraft> {
  const systemPrompt = `You are a culinary data extractor. Your job is to analyze a YouTube cooking video transcript and extract a structured chef signature item.

Return ONLY a valid JSON object. No prose, no markdown, no explanation.

JSON schema:
{
  "name": "Short, specific dish/technique/ingredient name (max 80 chars, title case)",
  "description": "2-3 sentences about what this is and what makes it distinctive (max 400 chars)",
  "kind": "recipe | dish | sauce | beverage | snack",
  "ingredients": ["array of ingredient strings (max 20 items, each max 50 chars)"],
  "techniques": ["array of cooking technique strings (max 10 items, each max 50 chars)"],
  "tags": ["array of flavor/style/cuisine tags (max 10 items, each max 30 chars)"],
  "confidence": "high | medium | low",
  "parserNotes": "Brief note on extraction quality, any ambiguity, or caveats (max 200 chars)"
}

RULES:
- 'name' must be the primary thing being made or taught in this video
- 'ingredients' should include only the actual food items used (no amounts/quantities)
- 'techniques' should include specific cooking methods (e.g. "blackening", "sous vide", "high-heat searing")
- 'tags' should be flavor/style descriptors (e.g. "smoky", "bold", "cajun", "umami-rich")
- 'kind' should be: 'recipe' if a full recipe, 'technique' if primarily a method, 'dish' if a complete dish concept, 'sauce' if a sauce/condiment, 'ingredient' if a specialty ingredient prep
- 'confidence' = high (clear, detailed cooking content), medium (partial), low (hard to extract)
- NEVER invent nutritional values — do not include any macro or calorie data
- NEVER include instructions — those come from the original video
- NEVER output anything outside the JSON object`;

  const userContent = `Video title: ${videoTitle}

Video description (first 500 chars): ${videoDescription.slice(0, 500)}

Transcript (may be truncated):
${transcript.slice(0, 8000)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Parser returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Validate kind
  const kind: ParsedSignatureItemDraft["kind"] = KIND_VALUES.includes(parsed.kind)
    ? parsed.kind
    : "recipe";

  return {
    name: String(parsed.name ?? videoTitle).slice(0, 80),
    description: String(parsed.description ?? "").slice(0, 400),
    kind,
    ingredients: sanitizeStringArray(parsed.ingredients, 20, 50),
    techniques: sanitizeStringArray(parsed.techniques, 10, 50),
    tags: sanitizeStringArray(parsed.tags, 10, 30),
    rawTitle: videoTitle,
    confidence: (["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium") as any,
    parserNotes: String(parsed.parserNotes ?? "").slice(0, 200),
  };
}

function sanitizeStringArray(raw: any, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(x => typeof x === "string" && x.trim().length > 0)
    .map(x => String(x).trim().slice(0, maxLen))
    .slice(0, maxItems);
}
