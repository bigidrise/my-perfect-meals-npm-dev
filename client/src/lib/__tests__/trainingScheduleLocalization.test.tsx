/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { trainingScheduleSpanish } from "@/i18n/trainingScheduleCopy";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import GeneralNutritionTrainingPage from "@/pages/GeneralNutritionTrainingPage";
import { PageTitleProvider, useCurrentPageTitle } from "@/contexts/PageTitleContext";
import { setPerfSelectedDate } from "@/lib/macroResolver";
import fs from "node:fs";
import ts from "typescript";

const mockNavigate = jest.fn();
const mockUser: any = {
  id: "offline-training-fixture", timezone: "UTC", entitlements: ["FULL_ACCESS"],
  activeProtocolTrack: "athletic",
  performanceContext: {
    trainingType: "strength", primaryGoal: "maintenance", trainingPhase: "off_season",
    trainingFrequency: 3, cardioFocus: "none", twoADays: false,
  },
  weeklyTrainingSchedule: {
    sunday: "off", monday: "power", tuesday: "strength", wednesday: "off",
    thursday: "power", friday: "strength", saturday: "endurance",
  },
};
const targets = { calories: 2100, protein_g: 140, carbs_g: 240, fat_g: 70,
  starchy_carbs_g: 150, fibrous_carbs_g: 90 };
jest.mock("wouter", () => ({ useLocation: () => ["/general-nutrition/training", mockNavigate] }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => true }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (value: string) => value }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/macroResolver", () => ({
  getResolvedTargets: () => targets, setPerfSelectedDate: jest.fn(),
}));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, initial, animate, transition, ...props }: any) => <div {...props}>{children}</div> },
}));

function CurrentTitle() { return <div data-testid="page-title">{useCurrentPageTitle()}</div>; }
const openPage = () => render(<PageTitleProvider><CurrentTitle /><GeneralNutritionTrainingPage /></PageTitleProvider>);

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-11-16T12:00:00Z"));
  window.history.replaceState({}, "", "/general-nutrition/training");
  localStorage.clear();
  mockNavigate.mockClear();
  jest.mocked(setPerfSelectedDate).mockClear();
  global.fetch = jest.fn(async (url, options) => {
    if (options?.method && options.method !== "GET") throw Error("Mutation forbidden in offline localization tests");
    if (String(url).startsWith("/api/performance/today")) {
      return { ok: true, json: async () => ({
        configured: true, sessionType: "power", sessionLabel: "Power Training",
        trainingPhase: "off_season", calories: 2100, proteinG: 140, carbsG: 240,
        fatG: 70, starchyCarbsG: 150, fibrousCarbsG: 90,
        logged: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, starchyCarbsG: 0, fibrousCarbsG: 0 },
      }) } as Response;
    }
    if (url === "/api/performance/carb-cycle") return { ok: false } as Response;
    throw Error(`Unexpected request in offline test: ${url}`);
  }) as jest.MockedFunction<typeof fetch>;
});
afterEach(() => { cleanup(); jest.useRealTimers(); });

test.each(["en", "es"])("%s translates the screenshot's headings, controls, weekdays and server-owned session label", async language => {
  await i18n.changeLanguage(language);
  const before = JSON.stringify(mockUser);
  openPage();
  const spanish = language === "es";
  await screen.findByText(spanish ? "Entrenamiento de potencia" : "Power Training");
  expect(screen.getByTestId("page-title")).toHaveTextContent(spanish
    ? "Calendario de nutrición para entrenamientos" : "Training Nutrition Schedule");
  expect(screen.getByText(spanish ? "Calendario semanal de entrenamiento" : "Weekly Coaching Schedule")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: spanish ? "Actualizar configuración" : "Update Setup" })).toBeEnabled();
  expect(screen.getByRole("button", { name: spanish ? "Editar calendario" : "Edit Schedule" })).toBeEnabled();
  expect(screen.getAllByRole("button", { name: spanish
    ? /Abrir el creador de nutrición general/ : /Launch General Nutrition Builder/ }).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: spanish ? /lun.*Potencia/i : /Mon.*Power/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: spanish ? /dom.*Día de descanso/i : /Sun.*Rest Day/i })).toBeInTheDocument();
  expect(screen.getAllByText((2100).toLocaleString(spanish ? "es-US" : "en-US")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("140").length).toBeGreaterThan(0);
  expect(JSON.stringify(mockUser)).toBe(before);
});

test("mounted controls change language immediately and retain setup, launch and selected-date behavior", async () => {
  await i18n.changeLanguage("en");
  openPage();
  await screen.findByText("Power Training");
  await act(async () => { await i18n.changeLanguage("es"); });
  expect(screen.queryByText("Weekly Coaching Schedule")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar configuración" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar calendario" }));
  expect(mockNavigate.mock.calls.slice(0, 2)).toEqual([
    ["/performance/setup?returnTo=%2Fgeneral-nutrition%2Ftraining"],
    ["/performance/setup?returnTo=%2Fgeneral-nutrition%2Ftraining"],
  ]);
  fireEvent.click(screen.getAllByRole("button", { name: /Abrir el creador de nutrición general/ })[0]);
  expect(mockNavigate).toHaveBeenLastCalledWith("/general-nutrition-builder/build");
  fireEvent.click(screen.getByRole("button", { name: /mar.*fuerza/i }));
  expect(setPerfSelectedDate).toHaveBeenCalledWith("2026-11-17");
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/performance/today?date=2026-11-17", expect.anything()));
  expect(screen.getByText("martes")).toBeInTheDocument();
});

test("ordinary resources preserve variables and every shared builder launch label", async () => {
  const variables = (value: string) => value.match(/\{\{\w+\}\}/g) ?? [];
  for (const source of Object.keys(trainingScheduleSpanish)) {
    expect(consumerEnglish[source]).toBe(source);
    expect(consumerSpanish[source]).toBeTruthy();
    expect(variables(consumerSpanish[source])).toEqual(variables(source));
  }
  await i18n.changeLanguage("es");
  expect(i18n.t("Launch GLP-1 Meal Builder", { ns: "consumerJourney", keySeparator: false }))
    .toBe("Abrir el creador de comidas de GLP-1");
});

test("protected nutrition explanations are unchanged and are not registered for translation", () => {
  const file = "client/src/pages/TrainingNutritionHub.tsx";
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "PERF_SESSION_WHY") {
      function collect(child: ts.Node) {
        if (ts.isStringLiteral(child)) {
          count++;
          expect(trainingScheduleSpanish).not.toHaveProperty(child.text);
        }
        ts.forEachChild(child, collect);
      }
      collect(node.initializer!);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(count).toBe(21);
});
