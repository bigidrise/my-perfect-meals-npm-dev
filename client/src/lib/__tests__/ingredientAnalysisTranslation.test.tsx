/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { apiRequest } from "@/lib/queryClient";
import { ingredientAnalysisCopy, translateIngredientAnalysisCopy } from "@/lib/ingredientAnalysisTranslation";
import { IngredientAnalysisTranslation, IngredientAnalysisText, IngredientAnalysisTranslationStatus } from "@/components/biometrics/IngredientAnalysisTranslation";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";

let mockEnabled = true;
jest.mock("@/lib/ingredientAnalysisTranslationGate", () => ({
  get ingredientAnalysisTranslationEnabled() { return mockEnabled; },
}));
jest.mock("@/lib/queryClient", () => ({ apiRequest: jest.fn() }));

const source = "Only 100mg sodium compared with 480mg in Ragú.";
const spanish = "Solo 100mg de sodio frente a 480mg en Ragú.";
const fixture = {
  productName: "Ragú", alignmentGrade: "C", verdictLevel: "caution", analysisMethod: "by_name",
  verdict: source, overallSummary: "Check the current label.", educationalFooter: "",
  betterAlternatives: [{ category: "Rao's Sauce", whyBetter: [source], targetCriteria: "Available at Walmart." }],
  scoreCards: {}, outcomeCards: [], ingredientDecoder: [], extractedIngredients: [],
  highRiskFindings: [], ingredientConsiderations: [], whatMattersMost: [source],
} as unknown as IngredientScanResult;
function translation(content: Record<string, string>) {
  return Object.fromEntries(Object.entries(content).map(([key, value]) => [key,
    key === "translationStatus" ? "Traducción completa"
      : value.replace("Only ", "Solo ").replace(" sodium compared with ", " de sodio frente a ")
        .replace(" in ", " en ").replace("Check the current label.", "Revisa la etiqueta actual.")
        .replace("Available at Walmart.", "Disponible en Walmart.")]));
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockEnabled = true;
  await i18n.changeLanguage("es");
  (apiRequest as jest.Mock).mockImplementation(async (url, options) => {
    if (url !== "/api/translate" || options.method !== "POST") throw new Error("Unexpected fixture request");
    const body = JSON.parse(options.body);
    expect(body.targetLanguage).toBe("es");
    return translation(body.content);
  });
});
afterEach(cleanup);

function view(owner: string | null = "fixture-owner", result = fixture, open = true) {
  return <IngredientAnalysisTranslation open={open} owner={owner} result={result} extra={[]}>
    <IngredientAnalysisTranslationStatus />
    <p data-testid="verdict"><IngredientAnalysisText text={result.verdict} /></p>
    <button onClick={() => apiRequest("/fixture/save-original", { method: "POST", body: JSON.stringify(result) })}>Save original</button>
  </IngredientAnalysisTranslation>;
}

test("translation preserves numbers, units and identities without translating authority fields", async () => {
  const before = JSON.stringify(fixture);
  const copy = ingredientAnalysisCopy(fixture);
  const request = jest.fn(async content => translation(content));
  const result = await translateIngredientAnalysisCopy(copy.texts, copy.names, request);
  expect(result[source]).toBe(spanish);
  expect(result["Available at Walmart."]).toBe("Disponible en Walmart.");
  expect(JSON.stringify(request.mock.calls)).not.toContain("100mg");
  expect(JSON.stringify(request.mock.calls)).not.toContain("480mg");
  expect(JSON.stringify(request.mock.calls)).not.toContain("Ragú");
  expect(copy.texts).not.toContain("caution");
  expect(copy.texts).not.toContain("by_name");
  expect(copy.texts).not.toContain("Rao's Sauce");
  expect(JSON.stringify(fixture)).toBe(before);
});

test("the screenshot's built-in profile chips translate immediately without any provider request", async () => {
  const labels = ["Performance Nutrition Protocol", "Testosterone Replacement Therapy", "Diabetes Management"];
  const result = { ...fixture, verdict: "", overallSummary: "", betterAlternatives: [], whatMattersMost: [],
    profileFactorsUsed: labels, analysisProfile: labels };
  const rendered = render(<IngredientAnalysisTranslation open owner="fixture-owner" result={result} extra={[]}>
    {labels.map(text => <IngredientAnalysisText key={text} text={text} />)}
  </IngredientAnalysisTranslation>);
  expect(rendered.container).toHaveTextContent("Protocolo de nutrición para el rendimiento");
  expect(rendered.container).toHaveTextContent("Terapia de reemplazo de testosterona");
  expect(rendered.container).toHaveTextContent("Control de la diabetes");
  expect(apiRequest).not.toHaveBeenCalled();
  expect(result.profileFactorsUsed).toEqual(labels);
  await act(async () => { await i18n.changeLanguage("en"); });
  labels.forEach(label => expect(rendered.container).toHaveTextContent(label));
  expect(apiRequest).not.toHaveBeenCalled();
});

test.each([
  ["missing fact", (value: any) => { value.text0 = value.text0.replace("__MPM_KEEP_0__", ""); }],
  ["duplicated fact", (value: any) => { value.text0 += " __MPM_KEEP_0__"; }],
  ["invented quantity", (value: any) => { value.text0 += " 25mg"; }],
  ["missing field", (value: any) => { delete value.text0; }],
  ["extra field", (value: any) => { value.changedGrade = "A"; }],
  ["non-string", (value: any) => { value.text0 = 42; }],
  ["legacy parse fallback", (value: any) => { value.translationStatus = "Translation complete"; }],
])("rejects a translation with %s", async (_name, corrupt) => {
  await expect(translateIngredientAnalysisCopy([source], ["Ragú"], async content => {
    const response = translation(content); corrupt(response); return response;
  })).rejects.toThrow();
});

test("includes assembled restrictions without changing which restrictions are shown", () => {
  const result = { ...fixture, highRiskFindings: [{ ingredientName: "Soy", reason: "Avoid for this allergy." }] } as IngredientScanResult;
  expect(ingredientAnalysisCopy(result).texts).toContain("Soy: Avoid for this allergy.");
  expect(result.highRiskFindings[0].reason).toBe("Avoid for this allergy.");
});

test("Spanish display uses the existing endpoint and keeps save payloads canonical", async () => {
  render(view());
  await waitFor(() => expect(screen.getByTestId("verdict")).toHaveTextContent(spanish));
  expect(screen.getByRole("status")).toHaveTextContent("Traducción del análisis original.");
  // The provider translates text nodes, not its children's data or callbacks.
  (apiRequest as jest.Mock).mockResolvedValueOnce({});
  screen.getByRole("button", { name: "Save original" }).click();
  const saved = JSON.parse((apiRequest as jest.Mock).mock.calls.find(([url]) => url === "/fixture/save-original")[1].body);
  expect(saved).toEqual(fixture);
  expect(saved.verdict).toBe(source);
});

test.each(["en", "disabled", "closed", "signed-out"])("%s never starts translation processing", async mode => {
  if (mode === "en") await i18n.changeLanguage("en");
  if (mode === "disabled") mockEnabled = false;
  render(view(mode === "signed-out" ? null : "fixture-owner", fixture, mode !== "closed"));
  expect(screen.getByTestId("verdict")).toHaveTextContent(source);
  expect(apiRequest).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("switching back to English immediately restores original text and caches only this owner's translation", async () => {
  render(view());
  await waitFor(() => expect(screen.getByTestId("verdict")).toHaveTextContent(spanish));
  const calls = (apiRequest as jest.Mock).mock.calls.length;
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByTestId("verdict")).toHaveTextContent(source);
  await act(async () => { await i18n.changeLanguage("es"); });
  await waitFor(() => expect(screen.getByTestId("verdict")).toHaveTextContent(spanish));
  expect(apiRequest).toHaveBeenCalledTimes(calls);
});

test("provider failures visibly retain original text and retry only translation", async () => {
  (apiRequest as jest.Mock).mockRejectedValueOnce(new Error("Synthetic unavailable provider"));
  render(view());
  await screen.findByText("La traducción del análisis no está disponible. Se muestra el texto original.");
  expect(screen.getByTestId("verdict")).toHaveTextContent(source);
  screen.getByRole("button", { name: "Reintentar traducción" }).click();
  await waitFor(() => expect(screen.getByTestId("verdict")).toHaveTextContent(spanish));
  expect((apiRequest as jest.Mock).mock.calls.every(([url]) => url === "/api/translate")).toBe(true);
});

test("a previous owner's late translation cannot appear after account switching", async () => {
  let finish!: (copy: unknown) => void;
  let firstContent!: Record<string, string>;
  (apiRequest as jest.Mock).mockImplementationOnce((_url, options) => {
    firstContent = JSON.parse(options.body).content;
    return new Promise(resolve => { finish = resolve; });
  });
  const rendered = render(view());
  rendered.rerender(view("other-owner", { ...fixture, verdict: "Check the current label." }));
  await screen.findByText("Revisa la etiqueta actual.");
  await act(async () => { finish(translation(firstContent)); });
  expect(screen.getByTestId("verdict")).toHaveTextContent("Revisa la etiqueta actual.");
  expect(screen.queryByText(spanish)).not.toBeInTheDocument();
});
