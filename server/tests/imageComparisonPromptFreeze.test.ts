/**
 * The ONLY application-importing part of the comparison is this offline test.
 * It never dispatches generation. Runtime comparison modules cannot import it.
 */
jest.mock("openai", () => ({ __esModule: true, default: jest.fn(() => { throw new Error("Provider forbidden"); }) }));
jest.mock("../db", () => ({ db: new Proxy({}, { get() { throw new Error("Database forbidden"); } }) }));
jest.mock("../db/schema/mealImageCache", () => ({ mealImageCache: {} }));
jest.mock("drizzle-orm", () => ({ eq: () => { throw new Error("SQL forbidden"); } }));
jest.mock("../services/imageLifecycle", () => ({
  ingestImageToPermanentStorage: () => { throw new Error("Storage forbidden"); },
}));
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: () => { throw new Error("Storage authority forbidden"); },
}));

import { __testables, detectDishType } from "../services/mealImageGenerator";
import { buildValidationPrompt } from "../services/mealImageValidator";
import { normalizeMealName } from "../services/mealNameNormalizer";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const fixtures = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e",
  'import { RECIPES, MODELS, SETTINGS } from "./tools/image-comparison/recipes.mjs"; console.log(JSON.stringify({RECIPES, MODELS, SETTINGS}));',
], { cwd: process.cwd(), env: {}, encoding: "utf8" }));

test("freeze eight exact application-builder prompts with all external operations blocked", () => {
  const block = () => { throw new Error("Network forbidden during prompt freeze"); };
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(block);
  const spies = ["node:http", "node:https"].flatMap(module => {
    const api = require(module);
    return ["get", "request"].map(method => jest.spyOn(api, method).mockImplementation(block));
  });
  try {
    const content = {
      version: 1,
      provenance: {
        builder: "server/services/mealImageGenerator.ts::__testables.buildMealImagePrompt",
        builderSourceSha256: hash(readFileSync("server/services/mealImageGenerator.ts", "utf8")),
        validator: "server/services/mealImageValidator.ts::buildValidationPrompt",
        validatorSourceSha256: hash(readFileSync("server/services/mealImageValidator.ts", "utf8")),
        note: "Exact existing builder output: methods, quantities and servings are retained as fixture evidence; methods/servings are not new builder parameters.",
      },
      models: fixtures.MODELS,
      settings: fixtures.SETTINGS,
      recipes: fixtures.RECIPES.map((recipe: any) => {
        const name = normalizeMealName(recipe.name);
        const prompt = __testables.buildMealImagePrompt(name, recipe.ingredients, recipe.sourceType);
        const verificationPrompt = buildValidationPrompt(name, recipe.ingredients, detectDishType(name).structuralIdentity);
        return { recipe, normalizedName: name, prompt, promptSha256: hash(prompt),
          verificationPrompt, verificationSha256: hash(verificationPrompt) };
      }),
    };
    const manifest = { ...content, digest: hash(JSON.stringify(content)) };
    const file = "tools/image-comparison/frozen-prompts.json";
    if (process.env.IMAGE_COMPARISON_FREEZE === "1") {
      // Explicit artifact generation only; never executed by normal test invocation.
      writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
      const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      mkdirSync("generated-artifacts/image-comparison", { recursive: true });
      const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Frozen Image Comparison Prompts</title>
<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f4;padding:20px}h2{margin-top:55px}code{overflow-wrap:anywhere}</style>
<h1>Frozen Image Comparison Prompts — Offline Only</h1><p>No generation was executed. Manifest SHA-256: <code>${manifest.digest}</code>.</p>
<h2>Settings</h2><pre>${escape(JSON.stringify({ models: manifest.models, settings: manifest.settings, provenance: manifest.provenance }, null, 2))}</pre>
${manifest.recipes.map((r: any) => `<h2>${escape(r.recipe.name)}</h2><pre>${escape(JSON.stringify(r.recipe, null, 2))}</pre><h3>Exact generation prompt</h3><p>SHA-256: <code>${r.promptSha256}</code></p><pre>${escape(r.prompt)}</pre><h3>Exact verification prompt</h3><p>SHA-256: <code>${r.verificationSha256}</code></p><pre>${escape(r.verificationPrompt)}</pre>`).join("\n")}</html>`;
      writeFileSync("generated-artifacts/image-comparison/frozen-prompts.html", html);
    }
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(manifest);
    expect(manifest.recipes).toHaveLength(8);
    expect(new Set(manifest.recipes.map((r: any) => r.promptSha256)).size).toBe(8);
    expect(fetchSpy).not.toHaveBeenCalled();
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  } finally {
    fetchSpy.mockRestore();
    spies.forEach(spy => spy.mockRestore());
  }
});
