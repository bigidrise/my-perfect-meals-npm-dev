/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import DiabetesProtocolIndicator from "@/components/DiabetesProtocolIndicator";
import SavedMealRow from "@/components/SavedMealRow";
import { getPersistedDiabeticMemory, type DiabeticGenerationSnapshot } from "../diabeticMemory";
import { toMealCardMeal, fromMealCardMeal } from "../pickerMealCardAdapter";
import { savedMealToMeal } from "@/utils/savedMealToMeal";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      diabetesProtocol: "Diabetes Protocol",
      generatedForBGL: "Generated for BGL:",
      relevantRange: "Relevant range:",
    }[key] ?? key),
  }),
}));
jest.mock("@/hooks/useTranslatedMeal", () => ({
  useTranslatedMeal: () => ({ translation: null, isTranslating: false }),
}));
jest.mock("@/components/ui/MealImageSlot", () => ({ MealImageSlot: () => null }));
jest.mock("@/components/AddToMealPlanButton", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/MealCardActions", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/AlphaGalBadge", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/macrosQuickView", () => ({ setQuickView: jest.fn() }));
jest.mock("@/lib/biometricsNavigation", () => ({ buildBiometricsUrl: jest.fn() }));

function snapshot(bgl: number | null = 100, state: "IN_RANGE" | "NONE" | "STALE" = "IN_RANGE"): DiabeticGenerationSnapshot {
  return Object.freeze({
    version: 2,
    generatedBglMgdl: bgl,
    glucoseContext: "PRE_MEAL",
    protocolTypeLabel: bgl === null ? "Diabetic Protocol — Current Glucose Unavailable" : "Glucose Balance Protocol",
    bglBucket: bgl === null ? "unavailable" : "in-range",
    recommendedBglRange: bgl === null ? "No current reading used" : "70–120 mg/dL",
    generatedAt: "2026-10-01T12:00:00.000Z",
    source: "diabetic-builder",
    readingRecordedAt: bgl === null ? null : "2026-10-01T11:55:00.000Z",
    readingSource: bgl === null ? null : "LOG",
    glucoseState: state,
    policyVersion: "diabetic-generation-v2",
  });
}

describe("one meal-owned Diabetes Protocol display contract", () => {
  it("keeps consecutive breakfast/lunch at 100 while later dinner/snack use 115 independently", () => {
    const breakfast = snapshot(100);
    const lunch = snapshot(100);
    const meals = [
      { id: "breakfast", memory: breakfast },
      { id: "lunch", memory: lunch },
    ];
    const cards = (items: typeof meals) => (
      <React.StrictMode>
        {items.map(({ id, memory }) => (
          <article key={id} data-testid={id}>
            <DiabetesProtocolIndicator memory={memory} />
          </article>
        ))}
      </React.StrictMode>
    );
    const view = render(cards(meals));
    expect(screen.getAllByText("Diabetes Protocol")).toHaveLength(2);
    view.rerender(cards([...meals, { id: "dinner", memory: snapshot(115) }, { id: "snack", memory: snapshot(115) }]));
    expect(screen.getAllByText("Diabetes Protocol")).toHaveLength(4);
    for (const id of ["breakfast", "lunch"]) {
      expect(within(screen.getByTestId(id)).getByText("100 mg/dL")).toBeTruthy();
    }
    for (const id of ["dinner", "snack"]) {
      expect(within(screen.getByTestId(id)).getByText("115 mg/dL")).toBeTruthy();
    }
    expect(breakfast.generatedBglMgdl).toBe(100);
    expect(lunch.generatedBglMgdl).toBe(100);
  });

  it.each(["NONE", "STALE"] as const)("shows valid %s provenance without inventing a numeric glucose reading", (state) => {
    render(<DiabetesProtocolIndicator memory={snapshot(null, state)} />);
    expect(screen.getByText("Diabetes Protocol")).toBeTruthy();
    expect(screen.queryByText("Generated for BGL:")).toBeNull();
    expect(screen.getByText(state === "STALE" ? "No current glucose reading was used" : "No glucose reading was available")).toBeTruthy();
  });

  it.each([
    undefined,
    null,
    {},
    { hasDiabetes: true, builderType: "diabetic" },
    { version: 2, generatedBglMgdl: 100 },
    { ...snapshot(), source: "profile" },
    { ...snapshot(), policyVersion: "unknown" },
    { ...snapshot(), generatedBglMgdl: Number.NaN },
    { ...snapshot(), readingRecordedAt: null },
    { ...snapshot(), glucoseState: "STALE" },
    { ...snapshot(null, "NONE"), generatedBglMgdl: 115 },
  ])("does not badge missing or invalid persisted evidence (%#)", (memory) => {
    render(<DiabetesProtocolIndicator memory={memory} />);
    expect(screen.queryByTestId("diabetes-protocol-indicator")).toBeNull();
    expect(getPersistedDiabeticMemory(memory)).toBeNull();
  });

  it("retains complete historical v1 records without upgrading or changing them", () => {
    const { readingRecordedAt, readingSource, glucoseState, policyVersion, ...fields } = snapshot();
    const legacy = Object.freeze({ ...fields, version: 1 });
    expect(getPersistedDiabeticMemory(legacy)).toBe(legacy);
    render(<DiabetesProtocolIndicator memory={legacy} />);
    expect(screen.getByText("100 mg/dL")).toBeTruthy();
    expect(legacy.version).toBe(1);
    const restored = savedMealToMeal({
      id: "legacy-favorite", title: "Old meal", sourceType: "craving-creator",
      savedFromDiabeticBuilder: false, mealData: { diabeticMemory: legacy },
    } as any);
    expect(restored.diabeticMemory).toBe(legacy);
  });

  it("shows Favorites from canonical mealData, independent of builder flags or top-level current glucose", () => {
    const row = {
      id: "favorite",
      title: "Breakfast",
      sourceType: "craving-creator",
      savedFromDiabeticBuilder: false,
      generatedBglMgdl: 115,
      mealData: { diabeticMemory: snapshot(100), ingredients: [], instructions: [] },
    };
    render(<SavedMealRow row={row} sourceLabel={(s) => s} onRemove={jest.fn()} onAddToMacros={jest.fn()} />);
    expect(screen.getByText("Diabetes Protocol")).toBeTruthy();
    expect(screen.getByText("100 mg/dL")).toBeTruthy();
    expect(screen.queryByText("115 mg/dL")).toBeNull();
    fireEvent.click(screen.getByText("Breakfast").closest("button")!);
    expect(screen.getByText("Diabetes Protocol")).toBeTruthy();
    expect(screen.getByText("100 mg/dL")).toBeTruthy();
  });

  it("shows a null-reading protocol snapshot on a collapsed Favorite", () => {
    render(<SavedMealRow row={{
      id: "favorite-missing", title: "Dinner", sourceType: "create-dish",
      mealData: { diabeticMemory: snapshot(null, "NONE") },
    }} sourceLabel={(s) => s} onRemove={jest.fn()} onAddToMacros={jest.fn()} />);
    expect(screen.getByText("Diabetes Protocol")).toBeTruthy();
    expect(screen.getByText("No glucose reading was available")).toBeTruthy();
  });

  it("never fabricates Favorite provenance from flattened fields or diabetic-builder origin", () => {
    render(<SavedMealRow row={{
      id: "favorite-unproven", title: "Old meal", sourceType: "diabetic",
      savedFromDiabeticBuilder: true, generatedBglMgdl: 100, mealData: {},
    }} sourceLabel={(s) => s} onRemove={jest.fn()} onAddToMacros={jest.fn()} />);
    expect(screen.queryByText("Diabetes Protocol")).toBeNull();
    expect(savedMealToMeal({
      id: "unproven", title: "Old meal", sourceType: "diabetic",
      savedFromDiabeticBuilder: true, generatedBglMgdl: 100, mealData: {},
    } as any).diabeticMemory).toBeUndefined();
  });

  it("preserves picker provenance and uses the new operation snapshot after a confirmed edit", () => {
    const initial = {
      id: "picker", name: "Breakfast", ingredients: [], instructions: [], badges: [],
      diabeticMemory: snapshot(100),
    };
    const card = toMealCardMeal(initial);
    expect(card.diabeticMemory).toBe(initial.diabeticMemory);
    const refined = { ...card, diabeticMemory: snapshot(115) };
    expect(fromMealCardMeal(refined, initial).diabeticMemory).toBe(refined.diabeticMemory);
    expect(initial.diabeticMemory.generatedBglMgdl).toBe(100);
    expect(fromMealCardMeal(card, initial).diabeticMemory).toBe(initial.diabeticMemory);
  });
});