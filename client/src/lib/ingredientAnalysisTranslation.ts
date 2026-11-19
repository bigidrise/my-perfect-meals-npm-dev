import type { IngredientScanResult } from "./photoIngredientCapture";
import { visibleAnalysisRestrictions } from "./ingredientAnalysisPresentation";
import { isBuiltInAnalysisLabel } from "@/i18n/ingredientAnalysisLabels";

/** An explicit presentation allowlist; never send the analysis object for translation. */
export function ingredientAnalysisCopy(result: IngredientScanResult | null, extra: string[] = []) {
  const texts: string[] = [...extra];
  const names = new Set<string>();
  const add = (...values: unknown[]) => {
    values.flat().forEach(value => {
      if (typeof value === "string" && value.trim()) texts.push(value);
    });
  };
  if (result) {
    [result.productName, result.resolvedName, ...result.extractedIngredients ?? []]
      .forEach(name => { if (name) names.add(name); });
    add(result.overallSummary, result.verdict, result.educationalFooter,
      result.ingredientConsiderations, result.whatMattersMost, result.mayNotAlignWith,
      result.betterFor, result.householdNotes, result.analysisProfile, result.profileFactorsUsed);
    add(visibleAnalysisRestrictions(result));
    Object.values(result.scoreCards ?? {}).forEach(card => add(card?.reason));
    result.outcomeCards?.forEach(card => add(card.label, card.reason));
    result.highRiskFindings?.forEach(finding => names.add(finding.ingredientName));
    result.ingredientDecoder?.forEach(item => { names.add(item.name); add(item.plain); });
    result.betterAlternatives?.forEach(alt => {
      [alt.category, alt.productName, alt.brand].forEach(name => { if (name) names.add(name); });
      add(alt.whyBetter, alt.targetCriteria);
    });
  }
  return { texts: [...new Set(texts.filter(text => typeof text === "string" && text.trim() && !isBuiltInAnalysisLabel(text)))], names: [...names] };
}

type TranslateRequest = (content: Record<string, string>) => Promise<unknown>;
const numericFacts = /\d+(?:[.,]\d+)*(?:\s*(?:mg|mcg|μg|µg|kg|kcal|cal|ml|oz|lbs?|g|l|%)(?![a-z]))?/gi;
const tokens = /__MPM_KEEP_\d+__/g;
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Uses the existing translation service, with structural and fact-preservation checks. */
export async function translateIngredientAnalysisCopy(
  texts: string[], names: string[], request: TranslateRequest,
): Promise<Record<string, string>> {
  if (texts.length > 100 || texts.join("").length > 25000) throw new Error("Analysis translation too large");
  const facts = new Map<string, string>();
  const namePattern = names.filter(Boolean).sort((a, b) => b.length - a.length).map(escapePattern).join("|");
  const pattern = new RegExp(`${namePattern ? `${namePattern}|` : ""}${numericFacts.source}`, "gi");
  const entries = texts.map((source, index) => {
    if (source.includes("__MPM_KEEP_") || source.length > 2400) throw new Error("Unsupported translation input");
    const masked = source.replace(pattern, fact => {
      const token = `__MPM_KEEP_${facts.size}__`;
      facts.set(token, fact);
      return token;
    });
    return { key: `text${index}`, source, masked };
  });
  // Keep responses below the existing endpoint's output budget.
  const batches: typeof entries[] = [];
  for (const entry of entries) {
    const last = batches[batches.length - 1];
    if (!last || last.length >= 6 || last.reduce((n, item) => n + item.masked.length, 0) + entry.masked.length > 1200) {
      batches.push([entry]);
    } else last.push(entry);
  }
  const translated: Record<string, string> = Object.create(null);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      const response = await request({
        ...Object.fromEntries(batch.map(item => [item.key, item.masked])),
        translationStatus: "Translation complete",
      });
      if (!response || typeof response !== "object" || Array.isArray(response)
        || Object.keys(response).length !== batch.length + 1) throw new Error("Invalid translation structure");
      // The legacy endpoint returns its input on parse failure. Never call that a translation.
      const status = (response as Record<string, unknown>).translationStatus;
      if (typeof status !== "string" || !status.trim() || status === "Translation complete") {
        throw new Error("Translation was not produced");
      }
      for (const entry of batch) {
        const value = (response as Record<string, unknown>)[entry.key];
        if (typeof value !== "string" || !value.trim() || value.length > entry.masked.length * 5 + 200) {
          throw new Error("Invalid translation text");
        }
        const expected = entry.masked.match(tokens) ?? [];
        const actual = value.match(tokens) ?? [];
        // Order may change with grammar, but every protected fact must appear exactly once.
        if (JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())
          || numericFacts.test(value.replace(tokens, ""))) {
          numericFacts.lastIndex = 0;
          throw new Error("Translation changed protected facts");
        }
        numericFacts.lastIndex = 0;
        translated[entry.source] = value.replace(tokens, token => facts.get(token)!);
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return translated;
}
