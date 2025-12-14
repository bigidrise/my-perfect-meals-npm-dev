// server/utils/openaiSafe.ts
import OpenAI from "openai";

const DEFAULT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 25000);
const MAX_RETRIES = Number(process.env.LLM_MAX_RETRIES ?? 2);

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

export const openai = {
  get chat() { return getOpenAI().chat; },
  get images() { return getOpenAI().images; },
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function chatJson(opts: {
  system: string; user: string; model?: string; temperature?: number;
}): Promise<any> {
  const model = opts.model ?? process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";
  let lastErr: any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort("timeout"), DEFAULT_TIMEOUT_MS);
    try {
      const res = await openai.chat.completions.create({
        model,
        temperature: opts.temperature ?? 0.2,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
      });
      clearTimeout(t);
      const content = res.choices[0]?.message?.content ?? "{}";
      return JSON.parse(content);
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      // backoff: 500ms, 1500ms, ...
      if (attempt < MAX_RETRIES) await sleep(500 * (attempt + 1) + Math.random() * 200);
    }
  }
  throw lastErr ?? new Error("LLM failed");
}

export async function genImage(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"): Promise<string | undefined> {
  if (process.env.DISABLE_IMAGE_GEN === "true") return undefined;
  try {
    const res = await openai.images.generate({ model: "dall-e-3", prompt, size, n: 1 });
    return res.data?.[0]?.url ?? undefined;
  } catch (e) {
    console.error("image gen failed:", e);
    return undefined;
  }
}