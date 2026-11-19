/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import ts from "typescript";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { macroCalculatorEnglish, macroCalculatorSpanish as spanish } from "@/i18n/macroCalculatorCopy";
import { useMacroCalculatorCopy } from "@/i18n/useMacroCalculatorCopy";
import { useCalculatorVoice } from "@/components/macro-targeting/useCalculatorVoice";
import BodyCompositionSheet from "@/components/macro-targeting/BodyCompositionSheet";
import MetabolicConsiderations from "@/components/macro-targeting/MetabolicConsiderations";
import WaistRiskSection from "@/components/macro-targeting/WaistRiskSection";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { CopilotSystem } from "@/components/copilot/CopilotSystem";
import { useCopilot } from "@/components/copilot/CopilotContext";

const mockRequest = jest.fn(), mockToast = jest.fn();
let mockPath = "/macro-counter";
const mockCopilotMount = jest.fn(), mockExplanation = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => [mockPath, jest.fn()] }));
jest.mock("@/components/copilot/CopilotButton", () => ({ CopilotButton: () => null }));
jest.mock("@/components/copilot/CopilotSheet", () => ({ CopilotSheet: () => { mockCopilotMount(); return <div>Fixture Copilot</div>; } }));
jest.mock("@/components/copilot/CopilotCommandRegistry", () => ({ executeCommand: jest.fn(), setResponseHandler: jest.fn() }));
jest.mock("@/components/copilot/CopilotGuidedModeContext", () => ({ CopilotGuidedModeProvider: ({ children }: any) => children }));
jest.mock("@/components/copilot/useCopilotPageExplanation", () => ({ useCopilotPageExplanation: () => mockExplanation() }));
jest.mock("@/lib/auth", () => ({ getCurrentUser: () => ({ id: "synthetic-calculator" }), getAuthHeaders: () => ({}) }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => mockRequest(...args) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: false }));
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => false }));

const instance = createInstance();
function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
const files = [
  "client/src/pages/MacroCalculator.tsx", "client/src/components/MedicalSourcesInfo.tsx",
  ...["MetabolicConsiderations", "BodyCompositionSection", "BodyCompositionSheet", "WaistRiskSection"]
    .map(name => `client/src/components/macro-targeting/${name}.tsx`),
];
beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: "es", fallbackLng: "en", interpolation: { escapeValue: false },
    resources: {
      en: { ...en, translation: en, consumerJourney: consumerEnglish, macroCalculatorCopy: macroCalculatorEnglish },
      es: { ...es, translation: es, consumerJourney: consumerSpanish, macroCalculatorCopy: spanish },
    },
  });
});
beforeEach(async () => {
  await instance.changeLanguage("es"); localStorage.clear(); mockToast.mockClear();
  mockPath = "/macro-counter"; mockCopilotMount.mockClear(); mockExplanation.mockClear();
  mockRequest.mockReset().mockResolvedValue({ entry: { goalBodyFatPct: 18.5 } });
  global.fetch = jest.fn().mockRejectedValue(new Error("Unexpected external request"));
});
afterEach(cleanup);

test("every source-owned literal binding has a Spanish resource; numbers and placeholders retain their meaning", () => {
  const missing: string[] = [];
  for (const file of files) {
    const tree = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        if ((key.includes(" ") || /^[A-Z]/.test(key)) && !Object.hasOwn(spanish, key)) missing.push(`${file}: ${key}`);
      }
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) missing.push(`${file}: unbound JSX ${node.text.trim()}`);
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  expect(missing).toEqual([]);
  for (const [source, translated] of Object.entries(spanish)) {
    expect(translated.trim()).not.toBe("");
    expect(translated.match(/[0-9]+(?:\.[0-9]+)?/g) ?? []).toEqual(source.match(/[0-9]+(?:\.[0-9]+)?/g) ?? []);
    expect((translated.match(/\{\{[^}]+\}\}/g) ?? []).sort()).toEqual((source.match(/\{\{[^}]+\}\}/g) ?? []).sort());
  }
});

test("the actual hook handles source phrases, legacy namespaces, both languages and dynamic guide stages", async () => {
  const { result } = renderHook(() => useMacroCalculatorCopy("macroCalc"), { wrapper: Wrapper });
  expect(result.current.t("title")).toBe(es.macroCalc.title);
  expect(result.current.t("What is your biological sex?")).toBe(spanish["What is your biological sex?"]);
  expect(result.current.t("Stage 2 of 3 · Explanation replay")).toContain("2");
  expect(result.current.t("Stage 2 of 3 · Explanation replay")).not.toContain("Stage");
  await act(async () => { await instance.changeLanguage("en"); });
  expect(result.current.t("What is your biological sex?")).toBe("What is your biological sex?");
  expect(result.current.t("title")).toBe(en.macroCalc.title);
});

test("body-composition language switching preserves entries and the exact canonical save payload", async () => {
  await instance.changeLanguage("en");
  render(<BodyCompositionSheet open onOpenChange={jest.fn()} />, { wrapper: Wrapper });
  const current = screen.getByLabelText(instance.t("bodyComposition.bodyFatPct"));
  const goal = screen.getByLabelText(instance.t("bodyComposition.goalBodyFatPct"));
  await waitFor(() => expect(goal).toHaveValue(18.5));
  fireEvent.change(current, { target: { value: "22.5" } });
  fireEvent.change(screen.getByLabelText(instance.t("bodyComposition.date")), { target: { value: "2026-11-18" } });
  await act(async () => { await instance.changeLanguage("es"); });
  expect(current).toHaveValue(22.5); expect(goal).toHaveValue(18.5);
  expect(screen.getByRole("combobox")).toHaveTextContent("DEXA");
  fireEvent.click(screen.getByRole("button", { name: instance.t("bodyComposition.save") }));
  await waitFor(() => expect(mockRequest.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true));
  const [, options] = mockRequest.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(JSON.parse(options.body)).toEqual({
    currentBodyFatPct: 22.5, goalBodyFatPct: 18.5, scanMethod: "DEXA",
    source: "client", recordedAt: "2026-11-18T00:00:00.000Z",
  });
});

test("invalid body fat shows Spanish validation and makes no save request", async () => {
  render(<BodyCompositionSheet open onOpenChange={jest.fn()} />, { wrapper: Wrapper });
  fireEvent.change(screen.getByLabelText(instance.t("bodyComposition.bodyFatPct")), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: instance.t("bodyComposition.save") }));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: instance.t("bodyComposition.invalidBodyFat") }));
  expect(mockRequest.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

test("metabolic and waist-risk expanded explanations and preview controls render Spanish without applying changes", async () => {
  const apply = jest.fn();
  const metabolic = render(<MetabolicConsiderations baseTargets={{ protein: 130, carbs: 200, fat: 70 }} onApplyAdjustments={apply} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByText(spanish["Metabolic & Hormonal Considerations"]));
  expect(await screen.findByText(spanish["Menopause / Hormone Therapy"])).toBeInTheDocument();
  expect(screen.getByText(spanish["Suspected Insulin Resistance"])).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled(); metabolic.unmount();
  render(<WaistRiskSection waistCm={110} heightCm={175} baseTargets={{ protein: 130, carbs: 200, fat: 70 }} onApplyAdjustments={apply} onClearAdjustments={jest.fn()} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByText(spanish["Waist-to-Height Risk"]));
  expect(await screen.findByText(spanish["Suggested macro adjustments:"])).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: spanish["Preview Changes"] }));
  expect(screen.getByRole("button", { name: spanish["Apply"] })).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

test("the reachable scientific sources sheet renders Spanish headings and descriptions", async () => {
  render(<MedicalSourcesInfo asIconButton />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: spanish["View sources and methodology"] }));
  expect(await screen.findByText(spanish["Sources & Medical Information"])).toBeInTheDocument();
  expect(screen.queryByText("Sources & Medical Information")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("paused calculator narration cannot synthesize, preload or request microphone access", async () => {
  const onComplete = jest.fn(), setPlaying = jest.fn();
  const { result } = renderHook(() => useCalculatorVoice(setPlaying));
  await act(async () => { await result.current.preload(); await result.current.speak("Synthetic narration", onComplete); result.current.stop(); });
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(setPlaying).not.toHaveBeenCalledWith(true);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(fs.readFileSync("client/src/components/macro-targeting/useCalculatorVoice.ts", "utf8")).not.toMatch(/speechSynthesis|SpeechRecognition|getUserMedia|ttsService|voiceManager/);
});

test("calculator navigation cannot mount or reopen shared Copilot narration or microphone UI", () => {
  window.history.replaceState({}, "", "/macro-counter");
  let copilot: ReturnType<typeof useCopilot>;
  function Probe() { copilot = useCopilot(); return <p>Typed calculator remains available</p>; }
  const view = render(<CopilotSystem><Probe /></CopilotSystem>);
  act(() => { copilot.open(); copilot.toggle(); });
  expect(copilot!.isOpen).toBe(false);
  expect(mockCopilotMount).not.toHaveBeenCalled();
  expect(mockExplanation).not.toHaveBeenCalled();
  expect(screen.getByText("Typed calculator remains available")).toBeInTheDocument();
  mockPath = "/dashboard"; window.history.replaceState({}, "", "/dashboard");
  view.rerender(<CopilotSystem><Probe /></CopilotSystem>);
  expect(mockCopilotMount).toHaveBeenCalled();
  mockCopilotMount.mockClear(); mockExplanation.mockClear();
  mockPath = "/macro-counter"; window.history.replaceState({}, "", "/macro-counter");
  view.rerender(<CopilotSystem><Probe /></CopilotSystem>);
  expect(mockCopilotMount).not.toHaveBeenCalled();
  expect(mockExplanation).not.toHaveBeenCalled();
  window.history.replaceState({}, "", "/");
});
