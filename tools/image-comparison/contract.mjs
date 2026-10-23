import { createHash } from "node:crypto";
import { RECIPES, MODELS, SETTINGS, LIMITS, VERIFIER } from "./recipes.mjs";

export const sha256 = text => createHash("sha256").update(text).digest("hex");
export function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
export function manifestDigest(manifest) {
  const { digest: _digest, ...content } = manifest;
  return sha256(JSON.stringify(content));
}
export function validateManifest(manifest) {
  if (manifest?.version !== 1 || manifest.digest !== manifestDigest(manifest) ||
      JSON.stringify(manifest.models) !== JSON.stringify(MODELS) ||
      JSON.stringify(manifest.settings) !== JSON.stringify(SETTINGS) ||
      manifest.recipes?.length !== 8) throw new Error("Frozen manifest mismatch");
  manifest.recipes.forEach((entry, index) => {
    if (JSON.stringify(entry.recipe) !== JSON.stringify(RECIPES[index]) ||
        typeof entry.prompt !== "string" || !entry.prompt.length ||
        entry.promptSha256 !== sha256(entry.prompt) ||
        typeof entry.verificationPrompt !== "string" || !entry.verificationPrompt.length ||
        entry.verificationSha256 !== sha256(entry.verificationPrompt)) {
      throw new Error("Frozen prompt/recipe identity mismatch");
    }
  });
}
export function comparisonPlan(manifest) {
  validateManifest(manifest);
  return deepFreeze(manifest.recipes.flatMap((entry, i) =>
    (i % 2 ? [...MODELS].reverse() : MODELS).map(model => ({
      id: `${entry.recipe.id}:${model}`, recipeId: entry.recipe.id, model,
      promptSha256: entry.promptSha256, verificationPrompt: entry.verificationPrompt,
      generation: {
        method: "POST", url: "https://api.openai.com/v1/images/generations",
        body: { model, prompt: entry.prompt, ...SETTINGS },
      },
    })),
  ));
}
export function assertRequest(stage, request, cell) {
  const expected = stage === "generation"
    ? "https://api.openai.com/v1/images/generations"
    : stage === "verification" ? "https://api.openai.com/v1/chat/completions" : null;
  if (!expected || request.method !== "POST" || request.url !== expected) throw new Error("Endpoint not allowed");
  if (stage === "generation") {
    if (!MODELS.includes(request.body?.model) ||
        request.body.model !== cell.model ||
        sha256(request.body.prompt ?? "") !== cell.promptSha256 ||
        JSON.stringify(request) !== JSON.stringify(cell.generation)) throw new Error("Generation request mismatch");
  } else {
    const { model, max_tokens, messages, ...extra } = request.body ?? {};
    if (model !== VERIFIER || max_tokens !== 60 || Object.keys(extra).length ||
        messages?.length !== 1 || messages[0].role !== "user" ||
        messages[0].content?.length !== 2 ||
        messages[0].content[0].type !== "text" ||
        messages[0].content[0].text !== cell.verificationPrompt ||
        messages[0].content[1].type !== "image_url" ||
        messages[0].content[1].image_url?.detail !== "low" ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(messages[0].content[1].image_url?.url ?? "")) {
      throw new Error("Verification request mismatch");
    }
  }
}
function tokens(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Usage missing or invalid");
  return value;
}
export function estimateCost(stage, usage) {
  if (stage === "generation") {
    const text = tokens(usage?.input_tokens_details?.text_tokens);
    const image = tokens(usage?.input_tokens_details?.image_tokens);
    const output = tokens(usage?.output_tokens);
    if (tokens(usage?.input_tokens) !== text + image ||
        tokens(usage?.total_tokens) !== text + image + output) throw new Error("Usage totals mismatch");
    return (text * 5 + image * 8 + output * 30) / 1_000_000;
  }
  if (stage !== "verification") throw new Error("Unknown usage stage");
  const input = tokens(usage?.prompt_tokens), output = tokens(usage?.completion_tokens);
  if (tokens(usage?.total_tokens) !== input + output || output > 60) throw new Error("Usage totals mismatch");
  return (input * 2.5 + output * 10) / 1_000_000;
}
export const safeRequestId = value =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
export { LIMITS, VERIFIER };
