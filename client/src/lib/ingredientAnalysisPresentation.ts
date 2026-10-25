import type { IngredientScanResult } from "./photoIngredientCapture";

const normalized = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Presentation only: never mutate, summarize with AI, or overwrite historical evidence. */
export function distinctAnalysisText(items: string[], alreadyShown: string[] = []): string[] {
  const seen = new Set(alreadyShown.map(normalized));
  return items.filter(text => {
    if (typeof text !== "string" || !text.trim()) return false;
    const key = normalized(text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function primaryAnalysisPoints(result: IngredientScanResult): string[] {
  return distinctAnalysisText(result.whatMattersMost ?? [], [result.verdict ?? ""]).slice(0, 3);
}

export function visibleAnalysisRestrictions(result: IngredientScanResult): string[] {
  const restriction = /allerg|cross.contact|anaphyl|medical|contraindicat|restrict|avoid|must|do not|don't|unsafe|not safe|check.{0,30}label|verify.{0,30}label|confirm.{0,40}label|kidney|pregnan|medication/i;
  const details = [
    ...(result.highRiskFindings ?? []).map(finding => `${finding.ingredientName}: ${finding.reason}`),
    ...(result.ingredientDecoder ?? []).filter(item => item.flag === "avoid").map(item => `${item.name}: ${item.plain}`),
    ...(result.outcomeCards ?? []).filter(card => card.verdict === "conflicts").map(card => card.reason),
    ...(result.ingredientConsiderations ?? []).filter(text => restriction.test(text) &&
      !(/^Based on product knowledge, not a verified label scan\./i.test(text) &&
        !/allerg|medical|restrict|do not|must|avoid/i.test(text))),
    ...(result.mayNotAlignWith ?? []).filter(text => restriction.test(text)),
    ...(result.householdNotes ?? []).filter(text => restriction.test(text)),
  ];
  return distinctAnalysisText(details, [result.verdict ?? "", ...primaryAnalysisPoints(result)]);
}
