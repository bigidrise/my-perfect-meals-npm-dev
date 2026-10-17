/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import SavedMeals from "../../pages/SavedMeals";
import { withSavedMealBuilderOrigin } from "../savedMealSource";
import english from "../../i18n/locales/en.json";

const mockFeed = jest.fn();
jest.mock("@/hooks/useSavedMeals", () => ({
  useSavedMealsFeed: () => mockFeed(),
  useDeleteSavedMeal: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock("wouter", () => ({ useLocation: () => ["/saved-meals", jest.fn()] }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const labels: Record<string, string> = jest.requireActual("../../i18n/locales/en.json").savedMeals;
      return labels[key.replace("savedMeals.", "")] ?? options?.defaultValue ?? key;
    },
  }),
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/macrosQuickView", () => ({ setQuickView: jest.fn() }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({
  __esModule: true, default: () => null,
}));
// Keep this a screen/data-flow test; recipe actions and media are unchanged.
jest.mock("@/components/SavedMealRow", () => ({
  __esModule: true,
  default: ({ row, sourceLabel }: {
    row: { title: string; sourceType: string; mealData: unknown };
    sourceLabel: (source: string, data?: unknown) => string;
  }) => <article><h2>{row.title}</h2><span>{sourceLabel(row.sourceType, row.mealData)}</span></article>,
}));

describe("Saved Meals source labels on the loaded screen", () => {
  afterEach(cleanup);

  it("renders explicit origins, unchanged creator names, and neutral legacy labels together", () => {
    const meals = [
      {
        id: "anti", title: "New cheesecake", sourceType: "heart-failure",
        mealData: withSavedMealBuilderOrigin({ builderType: "heart-failure" }, "anti_inflammatory"),
      },
      {
        id: "diabetic", title: "Diabetic cheesecake", sourceType: "diabetic",
        savedFromDiabeticBuilder: true, bglBucket: "elevated",
        mealData: withSavedMealBuilderOrigin({}, "diabetic"),
      },
      {
        id: "metabolic", title: "New medication meal", sourceType: "glp1",
        mealData: withSavedMealBuilderOrigin({}, "metabolic_medication"),
      },
      { id: "legacy", title: "Older dessert", sourceType: "heart-failure", mealData: { builderType: "heart-failure" } },
      { id: "drink", title: "Drink", sourceType: "beverage-creator", mealData: {} },
      { id: "grocery", title: "Shopping meal", sourceType: "grocery-coach", mealData: {} },
    ];
    const snapshot = JSON.stringify(meals);
    mockFeed.mockReturnValue({
      data: { pages: [{ meals, total: meals.length }] }, isLoading: false,
      hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
    });
    render(<SavedMeals />);
    expect(screen.getAllByRole("article")).toHaveLength(meals.length);
    for (const label of ["Anti-Inflammatory", "Diabetic", "Metabolic Medication",
      "Saved Meal", "Beverage Creator", "Grocery Coach"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/heart failure|heart-failure/i)).not.toBeInTheDocument();
    expect(screen.getByText(english.savedMeals.elevatedBGL)).toBeInTheDocument();
    expect(JSON.stringify(meals)).toBe(snapshot);
  });
});
