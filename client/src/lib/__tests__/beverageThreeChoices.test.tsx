/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockActions = jest.fn();
const mockToast = jest.fn();
let mockUser = { id: "beverage-test-account", dietaryRestrictions: [] };
const mockFetch = jest.fn();
const mockCheckStarch = jest.fn();
const mockTranslationCallbacks: Array<(translated: any) => void> = [];

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/contexts/PageTitleContext", () => ({ usePageTitle: jest.fn() }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("wouter", () => ({ useLocation: () => ["/", jest.fn()] }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/subscriptionCheck", () => ({ isProOrAbove: () => true }));
jest.mock("@/lib/hydrationApi", () => ({ resolveHydrationHandoff: jest.fn() }));
jest.mock("@/lib/safeChefHandoff", () => ({ writeChefHandoffMeal: jest.fn() }));
jest.mock("@/lib/safeLocalStorage", () => ({
  safeLocalStorageSet: (key: string, value: any) => localStorage.setItem(key, JSON.stringify(value)),
}));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("@/hooks/useQuickTour", () => ({ useQuickTour: () => ({ isOpen: false, close: jest.fn(), open: jest.fn() }) }));
jest.mock("@/hooks/useStarchGuardPrecheck", () => ({
  useStarchGuardPrecheck: () => ({
    alert: { show: false }, checkStarch: mockCheckStarch, clearAlert: jest.fn(),
  }),
}));
jest.mock("@/hooks/useDietGuardPrecheck", () => ({
  useDietGuardPrecheck: () => ({
    alert: { show: false }, activeDiet: null, checkDiet: () => true,
    clearAlert: jest.fn(), setDecision: jest.fn(), triggerAlert: jest.fn(),
  }),
}));
jest.mock("@/hooks/useSafetyGuardPrecheck", () => ({
  useSafetyGuardPrecheck: () => ({
    checking: false, alert: { show: false }, checkSafety: async () => true,
    clearAlert: jest.fn(), setAlert: jest.fn(), setOverrideToken: jest.fn(),
    hasActiveOverride: false, dietAdaptPayload: { current: null },
  }),
}));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, ...rest }: any) => <div>{children}</div> },
}));
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));
jest.mock("@/components/glass", () => ({
  GlassButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
jest.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) =>
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder || "Choose"}</option>,
}));
jest.mock("@/components/ui/MealImageSlot", () => ({
  MealImageSlot: ({ imageUrl, mealName }: any) => <img data-testid="selected-image" src={imageUrl} alt={mealName} />,
}));
jest.mock("@/components/FavoriteButton", () => ({
  __esModule: true,
  default: ({ mealData }: any) => <button onClick={() => mockActions("save", mealData)}>Save selected</button>,
}));
jest.mock("@/components/AddToMealPlanButton", () => ({
  __esModule: true,
  default: ({ meal }: any) => <button onClick={() => mockActions("add/log", meal)}>Add/log selected</button>,
}));
jest.mock("@/components/ShoppingAggregateBar", () => ({
  __esModule: true,
  default: ({ ingredients, source }: any) =>
    <button onClick={() => mockActions("shopping", { ingredients, source })}>Shop selected</button>,
}));
jest.mock("@/components/ShareRecipeButton", () => ({
  __esModule: true,
  default: ({ recipe }: any) => <button onClick={() => mockActions("share", recipe)}>Share selected</button>,
}));
jest.mock("@/components/TranslateToggle", () => ({
  __esModule: true,
  default: ({ onTranslate }: any) => <button onClick={() =>
    mockTranslationCallbacks.push(onTranslate)}>Translate selected</button>,
}));
jest.mock("@/components/PhaseGate", () => ({
  __esModule: true, default: ({ children }: any) => <>{children}</>,
}));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({
  __esModule: true, default: ({ children }: any) => <>{children}</>,
}));
jest.mock("@/components/copilot/useCopilotPageExplanation", () => ({ useCopilotPageExplanation: jest.fn() }));

// Keep unrelated presentation/preflight widgets out of this selection test.
for (const path of [
  "@/components/ProtocolVisibilityPanel", "@/components/badges/HealthBadgesPopover",
  "@/components/AlphaGalBadge", "@/components/DietStyleBadge", "@/components/MealClassificationPill",
  "@/components/KosherProTip", "@/components/ui/TrashButton", "@/components/ThinkingDots",
  "@/components/MealGenerationProgress",
]) {
  jest.doMock(path, () => ({ __esModule: true, default: () => null }));
}
jest.mock("@/components/SafetyGuardToggle", () => ({ SafetyGuardToggle: () => null }));
jest.mock("@/components/GlucoseGuardToggle", () => ({ GlucoseGuardToggle: () => null }));
jest.mock("@/components/FlavorToggle", () => ({ FlavorToggle: () => null }));
jest.mock("@/components/SafetyGuardBanner", () => ({ SafetyGuardBanner: () => null }));
jest.mock("@/components/DietGuardIntercept", () => ({ DietGuardIntercept: () => null, DietAdaptedNotice: () => null }));
jest.mock("@/components/guided/QuickTourModal", () => ({ QuickTourModal: () => null }));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("@/components/ui/DietCuisineControlRow", () => ({ DietCuisineControlRow: () => null }));
jest.mock("@/components/BeverageProtocolFailurePanel", () => ({
  BeverageProtocolFailurePanel: () => null, isBeverageProtocolFailure: () => false,
}));
jest.mock("@/components/GenerationFailureBanner", () => ({
  HIDDEN_FAILURE: { show: false },
  GenerationFailureBanner: ({ message }: any) => <p role="alert">{message}</p>,
}));

// Jest is CommonJS; compile the real page with its Vite-only DEV branch off.
// No application source or shared feature-gate helper is changed.
function loadPage(name: string) {
  const fs = require("node:fs");
  const ts = require("typescript");
  const source = fs.readFileSync(`client/src/pages/${name}.tsx`, "utf8")
    .replace(/import\.meta\.env\.DEV/g, "false");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", output)(require, exports);
  return exports.default;
}

const BeverageCreator = loadPage("BeverageCreator");
const AthleteBeverageCreator = loadPage("AthleteBeverageCreator");

function drink(index: number) {
  return {
    id: `beverage-choice-${index}`, name: `Drink ${index}`, description: `Recipe description ${index}`,
    ingredients: [{ name: `Ingredient ${index}`, amount: `${index}`, unit: "cup" }],
    instructions: `Stir recipe ${index}.`, imageUrl: `/images/drink-${index}.jpg`,
    nutrition: { calories: index * 100, protein: index * 10, carbs: index * 5, fat: index },
    servings: 5, servingSize: "Pitcher (4–6 drinks)",
  };
}
const choices = [drink(1), drink(2), drink(3)];

beforeEach(() => {
  localStorage.clear();
  mockUser = { id: "beverage-test-account", dietaryRestrictions: [] };
  mockFetch.mockReset();
  mockActions.mockClear();
  mockToast.mockClear();
  mockTranslationCallbacks.length = 0;
  window.scrollTo = jest.fn();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices, requestedChoiceCount: 3 }) });
});

async function generate(Page: React.ComponentType) {
  const view = render(<Page />);
  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "A refreshing homemade drink" } });
  const pitcher = screen.getByRole("option", { name: "Pitcher (4–6 drinks)" });
  fireEvent.change(pitcher.closest("select")!, { target: { value: "pitcher" } });
  fireEvent.click(screen.getByRole("button", { name: /Create My.*Drink/ }));
  await screen.findByRole("region", { name: "Beverage choices" });
  return view;
}

describe.each([
  ["Beverage Creator", BeverageCreator, "mpm_beverage_creator_result"],
  ["Athlete Beverage Creator", AthleteBeverageCreator, "mpm_athlete_beverage_result"],
] as const)("%s three choices", (_name, Page, resultKey) => {
  test("opts in without changing servings and waits for selection; all actions follow each chosen recipe", async () => {
    await generate(Page);
    expect(mockFetch).toHaveBeenCalledWith("/api/meals/beverage-creator", expect.objectContaining({
      body: expect.any(String),
    }));
    const request = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(request.choiceCount).toBe(3);
    expect(request.servingSize).toBe("pitcher");
    expect(request.customBeverageDescription).toContain("A refreshing homemade drink");
    expect(screen.getAllByTestId("beverage-choice-card")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Save selected" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shop selected" })).not.toBeInTheDocument();
    for (const choice of [choices[1], choices[0], choices[2]]) {
      fireEvent.click(screen.getByRole("button", { name: `Choose ${choice.name}` }));
      expect(screen.getByTestId("selected-image")).toHaveAttribute("src", choice.imageUrl);
      expect(screen.getByText(new RegExp(choice.ingredients[0].name))).toBeInTheDocument();
      expect(screen.getByText(`${choice.nutrition.calories}`)).toBeInTheDocument();
      expect(screen.getByText(choice.instructions)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Save selected" }));
      fireEvent.click(screen.getByRole("button", { name: "Add/log selected" }));
      fireEvent.click(screen.getByRole("button", { name: "Shop selected" }));
      fireEvent.click(screen.getByRole("button", { name: "Share selected" }));
      expect(mockActions).toHaveBeenCalledWith("save", choice);
      expect(mockActions).toHaveBeenCalledWith("add/log", choice);
      expect(mockActions).toHaveBeenCalledWith("share", expect.objectContaining({
        name: choice.name, nutrition: choice.nutrition, instructions: choice.instructions,
      }));
      expect(mockActions).toHaveBeenCalledWith("shopping", expect.objectContaining({
        ingredients: [{ name: choice.ingredients[0].name, qty: choice.ingredients[0].amount, unit: "cup" }],
      }));
      await waitFor(() => expect(JSON.parse(localStorage.getItem(resultKey)!)).toEqual(choice));
      expect(screen.getAllByTestId("beverage-choice-card")).toHaveLength(3);
    }
  });

  test("shows two surviving choices and the explanation without auto-selection", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({
      choices: choices.slice(0, 2), choiceNotice: "Only 2 distinct beverages passed the existing checks for this request.",
    }) });
    await generate(Page);
    expect(screen.getAllByTestId("beverage-choice-card")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Only 2 distinct beverages");
    expect(screen.queryByTestId("selected-image")).not.toBeInTheDocument();
  });

  test("restores the choice set and selected recipe, and Create New removes both", async () => {
    await generate(Page);
    fireEvent.click(screen.getByRole("button", { name: "Choose Drink 2" }));
    await waitFor(() => expect(localStorage.getItem(resultKey)).toContain("Drink 2"));
    const first = screen.getByRole("region", { name: "Beverage choices" });
    expect(within(first).getAllByTestId("beverage-choice-card")).toHaveLength(3);
    // Unmount without discarding the saved working set.
    const { cleanup } = require("@testing-library/react");
    cleanup();
    render(<Page />);
    expect(screen.getAllByTestId("beverage-choice-card")).toHaveLength(3);
    expect(screen.getByTestId("selected-image")).toHaveAttribute("src", choices[1].imageUrl);
    fireEvent.click(screen.getByRole("button", { name: "Create New" }));
    expect(screen.queryByRole("region", { name: "Beverage choices" })).not.toBeInTheDocument();
    expect(localStorage.getItem(resultKey)).toBeNull();
  });

  test("late translations cannot overwrite another choice or another account's selected recipe", async () => {
    const view = await generate(Page);
    fireEvent.click(screen.getByRole("button", { name: "Choose Drink 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Translate selected" }));
    const translateFirst = mockTranslationCallbacks[0];
    fireEvent.click(screen.getByRole("button", { name: "Choose Drink 2" }));
    await act(async () => translateFirst({
      name: "Drink 1 translated", ingredients: choices[0].ingredients, instructions: "Wrong recipe",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Save selected" }));
    expect(mockActions).toHaveBeenLastCalledWith("save", choices[1]);

    fireEvent.click(screen.getByRole("button", { name: "Translate selected" }));
    const translateSecond = mockTranslationCallbacks[1];
    const otherChoices = choices.map((choice) => ({ ...choice, id: `${choice.id}-other`, name: `Other ${choice.name}` }));
    mockUser = { id: "other-account", dietaryRestrictions: [] };
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: otherChoices }) });
    view.rerender(<Page />);
    expect(screen.queryByTestId("selected-image")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create My.*Drink/ }));
    await screen.findByRole("button", { name: "Choose Other Drink 1" });
    fireEvent.click(screen.getByRole("button", { name: "Choose Other Drink 1" }));
    await act(async () => translateSecond({
      name: "Drink 2 translated", ingredients: choices[1].ingredients, instructions: "Wrong account",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Save selected" }));
    expect(mockActions).toHaveBeenLastCalledWith("save", otherChoices[0]);
    // The first account restores its own selected ID, not the global last result.
    mockUser = { id: "beverage-test-account", dietaryRestrictions: [] };
    view.rerender(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Save selected" }));
    expect(mockActions).toHaveBeenLastCalledWith("save", choices[1]);
    expect(screen.getByTestId("selected-image")).toHaveAttribute("src", choices[1].imageUrl);
  });
});

test("beverage choice sets never write another account's options into the new account cache", async () => {
  await generate(BeverageCreator);
  const { cleanup } = require("@testing-library/react");
  cleanup();
  mockUser = { id: "different-account", dietaryRestrictions: [] };
  render(<BeverageCreator />);
  expect(screen.queryByRole("region", { name: "Beverage choices" })).not.toBeInTheDocument();
  expect(localStorage.getItem("mpm_beverage_beverage_choices:different-account")).toBeNull();
});

test("a late image response cannot attach the previous choice's image to the selected drink", async () => {
  let finishImage!: (response: any) => void;
  mockFetch.mockImplementation((path: string) => path === "/api/meals/generate-image"
    ? new Promise((resolve) => { finishImage = resolve; })
    : Promise.resolve({ ok: true, status: 200, json: async () => ({
        choices: [{ ...choices[0], imageUrl: null }, choices[1], choices[2]],
      }) }));
  await generate(BeverageCreator);
  fireEvent.click(screen.getByRole("button", { name: "Choose Drink 1" }));
  await waitFor(() => expect(finishImage).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "Choose Drink 2" }));
  await act(async () => finishImage({ json: async () => ({ imageUrl: "/wrong-drink-image.jpg" }) }));
  expect(screen.getByTestId("selected-image")).toHaveAttribute("src", choices[1].imageUrl);
  fireEvent.click(screen.getByRole("button", { name: "Save selected" }));
  expect(mockActions).toHaveBeenLastCalledWith("save", choices[1]);
});