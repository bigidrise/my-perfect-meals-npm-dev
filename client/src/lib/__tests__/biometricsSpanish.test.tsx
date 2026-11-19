/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import ts from "typescript";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { biometricsSpanish } from "@/i18n/biometricsCopy";
import { biometricsClinicalSpanish } from "@/i18n/biometricsClinicalCopy";
import { therapeuticModalBody } from "@/lib/therapeuticModalPresentation";
import TherapeuticNutritionCard from "@/components/biometrics/TherapeuticNutritionCard";
import Recommendation from "@/components/clinical/ProtocolRecommendationModal";
import Thyroid from "@/components/clinical/ThyroidRecommendationModal";
import Downgrade from "@/components/clinical/ProtocolDowngradeModal";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useEffectiveClinicalProtocols", () => ({ refreshClinicalProtocols: jest.fn() }));
jest.mock("@/components/ui/universal-modal", () => ({
  UniversalDialog: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("@/components/ui/dialog", () => ({
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

const i18n = createInstance();
const fetchMock = jest.fn();
const context = {
  peptides: [], hormones: [], therapies: [], recoveryGoals: [],
  medications: [
    { type: "metformin", dose: 500, unit: "mg/day" },
    { type: "custom-fixture", label: "My custom medication", dose: 2.75, unit: "mg/day", custom: true },
  ],
};
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "es", fallbackLng: "en", interpolation: { escapeValue: false },
    resources: {
      en: { translation: en, consumerJourney: consumerEnglish },
      es: { translation: es, consumerJourney: consumerSpanish },
    },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
  global.fetch = fetchMock;
  fetchMock.mockReset().mockImplementation(async (_url, options) => ({
    ok: true, json: async () => options?.method === "POST" ? {} : { context },
  }));
});
afterEach(cleanup);

test("the pictured medication section is Spanish, including examples and custom frequency controls", async () => {
  render(<TherapeuticNutritionCard />);
  await screen.findByText("Metformina");
  expect(screen.getByText("Prednisona / corticosteroides")).toBeInTheDocument();
  expect(screen.getByText("Semaglutida (Ozempic / Wegovy)")).toBeInTheDocument();
  expect(screen.getByText("Tamoxifeno")).toBeInTheDocument();
  expect(screen.getByText("Anastrozol (inhibidor de la aromatasa)")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("p. ej., 1000")).toHaveValue(500);
  expect(screen.getAllByText("mg/día").length).toBeGreaterThan(0);
  expect(screen.getAllByText("mg/semana").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Día" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Semana" })).toBeInTheDocument();
  expect(screen.getByText("por")).toBeInTheDocument();
  expect(screen.queryByText("Day")).not.toBeInTheDocument();
  expect(screen.queryByText("Week")).not.toBeInTheDocument();
});

test("changing language preserves entered names and doses; weekly selection saves canonical units", async () => {
  render(<TherapeuticNutritionCard />);
  await screen.findByText("Metformina");
  fireEvent.change(screen.getByDisplayValue("My custom medication"), { target: { value: "My unchanged custom name" } });
  fireEvent.change(screen.getByDisplayValue("2.75"), { target: { value: "3.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Semana" }));
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByText("Metformin")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Week" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("My unchanged custom name")).toBeInTheDocument();
  expect(screen.getByDisplayValue("3.25")).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  fireEvent.click(screen.getByRole("button", { name: "Guardar protocolo" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true));
  const [, options] = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
  const payload = JSON.parse(options.body);
  const saved = payload.context ?? payload;
  expect(saved.medications).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "metformin", dose: 500, unit: "mg/day" }),
    expect.objectContaining({ label: "My unchanged custom name", dose: 3.25, unit: "mg/week" }),
  ]));
  expect(options.body).not.toContain("Metformina");
  expect(options.body).not.toContain("mg/semana");
});

test.each(["primary", "thyroid", "removal"])("%s failures are Spanish and cannot report success", async variant => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  const success = jest.fn(), close = jest.fn();
  const reason = "Original clinical evidence retained in English";
  if (variant === "primary") render(<Recommendation open onClose={close} signal={{ protocol: "heart-failure", confidence: "moderate", triggerFields: ["ldl"], reason }} labId={7} physicianLocked={false} onAccepted={success} />);
  if (variant === "thyroid") render(<Thyroid open onClose={close} signal={{ hasThyroidIndicators: true, confidence: "moderate", triggerFields: ["free_t4_high"], subtypeConditions: [], isAutoimmune: false, reason } as any} labId={7} onAccepted={success} />);
  if (variant === "removal") render(<Downgrade open onClose={close} signal={{ protocol: "thyroid-support", protocolLabel: "Thyroid Support", normalFields: ["reverse_t3"], reason }} labId={7} onRemoved={success} />);
  fireEvent.click(screen.getByRole("button", { name: variant === "removal" ? /Desactivar/ : /Activar/ }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/No se pudo guardar|no se guardó/));
  expect(success).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).reason).toBe(reason);
});

test("all new copy preserves interpolation placeholders and numerical content", () => {
  const variables = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
  const numbers = (text: string) => text.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const [source, translated] of Object.entries({ ...biometricsSpanish, ...biometricsClinicalSpanish })) {
    expect(translated.trim()).not.toBe("");
    expect(variables(translated)).toEqual(variables(source));
    expect(numbers(translated)).toEqual(numbers(source));
    expect(consumerEnglish[source]).toBe(source);
  }
});

test("each current authored lab recommendation and thyroid explanation has an exact display translation", () => {
  const source = fs.readFileSync("server/services/resolveProtocolFromLabs.ts", "utf8");
  const ast = ts.createSourceFile("labs.ts", source, ts.ScriptTarget.Latest, true);
  function literal(node: ts.Node): string | null {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = literal(node.left), right = literal(node.right);
      return left !== null && right !== null ? left + right : null;
    }
    return null;
  }
  const explanations: string[] = [];
  function visit(node: ts.Node) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    if (line < 245 && ts.isPropertyAssignment(node) && node.name.getText(ast) === "reason") {
      const value = literal(node.initializer);
      if (value) explanations.push(value);
    }
    if (line > 650 && line < 690 && ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(ast) === "reason") {
      const value = literal(node.right);
      if (value) explanations.push(value);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(explanations.length).toBeGreaterThanOrEqual(10);
  for (const value of explanations) expect(biometricsClinicalSpanish[value]).toBeDefined();
});

test("therapeutic summaries translate only the exact owned template and preserve unknown clinical text", () => {
  const safety = "Clinical safety requirements always take priority when protocols conflict.";
  const source = {
    selectedItems: ["My medication (2.75 mg/day)"], activeProtocols: ["Thyroid Support"],
    priorities: ["thyroid-supportive nutrition"],
    body: `You entered My medication (2.75 mg/day). Because Thyroid Support is also active, your meals will be built to support: thyroid-supportive nutrition.\n\n${safety}`,
  };
  const copy = (key: string, options?: Record<string, unknown>) => Object.entries(options ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), biometricsClinicalSpanish[key] ?? key,
  );
  const translated = therapeuticModalBody(source, copy, "es");
  expect(translated).toContain("Introdujiste My medication (2.75 mg/day)");
  expect(translated).toContain("Apoyo tiroideo");
  expect(translated).toContain("nutrición de apoyo tiroideo");
  expect(translated).toContain(biometricsClinicalSpanish[safety]);
  const englishCopy = (key: string, options?: Record<string, unknown>) => Object.entries(options ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), key,
  );
  expect(therapeuticModalBody(source, englishCopy, "en")).toBe(source.body);
  const unknown = { ...source, body: "Original care-team note: do not rewrite." };
  expect(therapeuticModalBody(unknown, copy, "es")).toBe(unknown.body);
});
