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

const IMAGE_TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS ?? 30000);

export async function genImage(prompt: string, size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"): Promise<string | undefined> {
  if (process.env.DISABLE_IMAGE_GEN === "true") return undefined;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort("image-timeout"), IMAGE_TIMEOUT_MS);
  try {
    const res = await openai.images.generate(
      { model: "dall-e-3", prompt, size, n: 1 },
      { signal: ac.signal }
    );
    clearTimeout(t);
    return res.data?.[0]?.url ?? undefined;
  } catch (e: any) {
    clearTimeout(t);
    if (e?.name === "AbortError" || String(e).includes("image-timeout")) {
      console.warn(`[genImage] timed out after ${IMAGE_TIMEOUT_MS}ms for: "${prompt.slice(0, 60)}"`);
    } else {
      console.error("image gen failed:", e);
    }
    return undefined;
  }
}

// Fast image generation for ChefFlow card previews — DALL-E 2 at 512×512.
// ~3-5x faster than genImage (DALL-E 3). Quality is sufficient for card thumbnails.
// Does NOT touch imageService.ts or the permanent storage path.
export async function genImageFast(prompt: string): Promise<string | undefined> {
  if (process.env.DISABLE_IMAGE_GEN === "true") return undefined;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort("image-timeout"), IMAGE_TIMEOUT_MS);
  try {
    const res = await openai.images.generate(
      { model: "dall-e-2", prompt, size: "512x512", n: 1 },
      { signal: ac.signal }
    );
    clearTimeout(t);
    return res.data?.[0]?.url ?? undefined;
  } catch (e: any) {
    clearTimeout(t);
    if (e?.name === "AbortError" || String(e).includes("image-timeout")) {
      console.warn(`[genImageFast] timed out after ${IMAGE_TIMEOUT_MS}ms for: "${prompt.slice(0, 60)}"`);
    } else {
      console.error("genImageFast failed:", e);
    }
    return undefined;
  }
}