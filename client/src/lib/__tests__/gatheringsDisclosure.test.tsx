/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { guardGatheringsCards } from "../gatheringsDisclosureGuard";
import { SAFE_RECIPE_FAILURE, CLINICAL_RECIPE_WITHHELD } from "@shared/recipeDraftSafety";
import { buildGatheringsValidationEvidence } from "../../../../server/services/gatheringsValidationEvidence";

const PRIVATE = "INTERNAL_PROMPT_SENTINEL PROFILE_DATA_SENTINEL";
const mockToast = jest.fn();
const mockDietaryRestrictions: string[] = [];
const previousFetch = global.fetch;
const valid = {
  id: "synthetic-card", name: "Baked Apples", description: "A complete recipe.",
  ingredients: [{ name: "apples", amount: 6, unit: "oz" }], instructions: ["Bake until tender."],
  courseType: "main", courseLabel: "Main", servings: 6, medicalBadges: [],
};
const malformed = [
  { ...valid, name: "" },
  { ...valid, description: "" },
  { ...valid, name: `I'm sorry, I cannot provide that meal. ${PRIVATE}` },
  { ...valid, description: `A healthy dinner.\nCOURSE POSITION: ${PRIVATE}` },
  { ...valid, ingredients: [] },
  { ...valid, ingredients: [{ name: "123" }] },
  { ...valid, instructions: [] },
  { ...valid, instructions: ["[step one]"] },
  { ...valid, ingredients: PRIVATE },
  { ...valid, _fallback: true, description: PRIVATE, ingredients: [] },
].map(row => ({ ...row, rawProviderResponse: PRIVATE }));

// Render the actual Gatherings page, replacing only environmental/child
// dependencies. No network, account access, AI generation or image generation.
const Wrapper = ({ children }: any) => <div>{children}</div>;
const Null = () => null;
const visualModules = [
  "@/components/ui/card", "@/components/glass", "@/components/ui/select",
  "@/components/ui/progress", "@/components/ui/pill-button", "@/components/ui/icon-pill-option",
  "@/components/MealGenerationProgress", "@/components/ThinkingDots", "@/components/ui/MealImageSlot",
  "@/components/badges/HealthBadgesPopover", "@/components/AddToMealPlanButton",
  "@/components/ShareRecipeButton", "@/components/TranslateToggle", "@/components/GlucoseGuardToggle",
  "@/components/FlavorToggle", "@/components/KeepItSimpleToggle", "@/components/StarchGuardIntercept",
  "@/components/DietGuardIntercept", "@/components/SafetyGuardBanner", "@/components/ShoppingAggregateBar",
  "@/components/GatheringsNutritionPanel", "@/components/ui/TrashButton", "@/components/FavoriteButton",
  "@/components/layout/MobileHeaderGuard", "@/components/ServingInstructionsBlock",
  "@/components/PhaseGate", "@/components/DietStyleBadge", "@/components/MealClassificationPill",
  "@/components/KosherProTip",
];
for (const path of visualModules) {
  jest.doMock(path, () => new Proxy({ __esModule: true, default: Wrapper }, {
    get: (target, key) => (target as any)[key] ?? Wrapper,
  }));
}
jest.doMock("@/components/glass", () => ({
  GlassButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));
jest.doMock("@/components/ui/icon-pill-option", () => ({
  IconPillOption: ({ label, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{label}</button>,
}));
jest.doMock("@/components/ui/pill-button", () => ({
  PillButton: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));
jest.doMock("lucide-react", () => new Proxy({}, { get: () => Null }));
jest.doMock("framer-motion", () => ({ motion: new Proxy({}, { get: () => Wrapper }) }));
jest.doMock("wouter", () => ({ useLocation: () => ["/gatherings", jest.fn()] }));
jest.doMock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "synthetic-owner", dietaryRestrictions: mockDietaryRestrictions } }) }));
jest.doMock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.doMock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.doMock("@/hooks/useMealImages", () => ({ useMealImages: () => ({ loadingImages: {}, hydrateImages: jest.fn() }) }));
jest.doMock("@/components/copilot/useCopilotPageExplanation", () => ({ useCopilotPageExplanation: () => {} }));
jest.doMock("@/hooks/useDietGuardPrecheck", () => ({ useDietGuardPrecheck: () => ({
  alert: { matchedTerms: [] }, checkDiet: () => true,
}) }));
jest.doMock("@/hooks/useSafetyGuardPrecheck", () => ({ useSafetyGuardPrecheck: () => ({
  alert: {}, checkSafety: () => true,
}) }));
jest.doMock("@/hooks/useStarchGuardPrecheck", () => ({ useStarchGuardPrecheck: () => ({
  alert: { matchedTerms: [] }, checkStarch: () => true,
}) }));
jest.doMock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.doMock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.doMock("@/lib/safeChefHandoff", () => ({ writeChefHandoffMeal: jest.fn() }));
jest.doMock("@/lib/macrosQuickView", () => ({ setQuickView: jest.fn() }));
jest.doMock("@/lib/mealMacroSnapshot", () => ({ creatorMealNutrition: () => ({}) }));
jest.doMock("@/lib/gatheringsNutrition", () => ({
  canUseGatheringsNutrition: () => false, gatheringsNutritionPilot: true,
}));
jest.doMock("@/utils/medicalPersonalization", () => ({ generateMedicalBadges: () => [], getUserMedicalProfile: () => ({}) }));
jest.doMock("@/utils/dietaryFilter", () => ({ normalizeDiet: () => "none", mealMatchesDiet: () => true }));
jest.doMock("@/data/holidayTraditionalDishes", () => ({
  getHolidayDishes: () => [], getPopularDishes: () => [], getAllDishes: () => [],
}));
const GatheringsPage = require("@/pages/lifestyle/GatheringsPage").default;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = jest.fn();
  mockToast.mockClear();
  mockDietaryRestrictions.splice(0);
  global.fetch = jest.fn();
});
afterEach(() => { cleanup(); global.fetch = previousFetch; });

it.each(malformed.map((value, index) => [index, value] as const))(
  "renders rejected cached draft %s only as a privacy-safe retry card", (_index, course) => {
    localStorage.setItem("ultimateExperience.cache.v1", JSON.stringify({
      courses: [course], servings: 6, situation: "holiday", eventType: "christmas",
    }));
    const { container } = render(<GatheringsPage />);
    expect(screen.getByRole("heading", { name: "Main Course" })).toBeTruthy();
    expect(screen.getAllByText(SAFE_RECIPE_FAILURE).length).toBeGreaterThan(0);
    expect(screen.getByText(/— Needs retry/)).toBeTruthy();
    expect(screen.queryByText("Instructions:")).toBeNull();
    expect(container.textContent).not.toContain("INTERNAL_PROMPT_SENTINEL");
    expect(container.textContent).not.toContain("PROFILE_DATA_SENTINEL");
    expect(localStorage.getItem("ultimateExperience.cache.v1")).not.toContain("PROFILE_DATA_SENTINEL");
  },
);

it("preserves valid recipe fields, quantities and nutrition metadata by identity", () => {
  const meal = { ...valid, nutrition: { calories: 600 }, nutritionResult: { status: "available" } };
  expect(guardGatheringsCards([meal])[0]).toBe(meal);
});

it("normalizes existing translated/string instructions without inventing their content", () => {
  const meal = { ...valid, instructions: "1. Bake the apples. 2. Serve." };
  expect(guardGatheringsCards([meal])[0].instructions).toEqual(["Bake the apples.", "Serve."]);
});

it("preserves the existing clinical-withholding state unchanged", () => {
  const clinical = {
    ...valid, name: "Main Course", description: CLINICAL_RECIPE_WITHHELD,
    ingredients: [], instructions: [], _fallback: true, nutritionResult: { status: "needs_review" },
  };
  expect(guardGatheringsCards([clinical])[0]).toBe(clinical);
});

it("applies the same display boundary to fresh API-shaped results", () => {
  for (const course of guardGatheringsCards(malformed)) {
    expect((course as any)._fallback).toBe(true);
    expect(JSON.stringify(course)).not.toContain("PROFILE_DATA_SENTINEL");
  }
});

const cache = (courses: unknown[]) => localStorage.setItem("ultimateExperience.cache.v1", JSON.stringify({
  courses, servings: 6, situation: "camping", eventType: null, requestedCourses: 3,
}));
const failed = { ...valid, _fallback: true, outcome: "generation_failed", instructions: [], description: SAFE_RECIPE_FAILURE };
it("renders historical cookingInstructions as real steps instead of blank instructions", () => {
  cache([{ ...valid, instructions: undefined, cookingInstructions: [{ step: 1, text: "Bake the apples." }, { step: 2, text: "Serve warm." }] }]);
  render(<GatheringsPage />);
  expect(screen.getByText("Bake the apples.")).toBeTruthy();
  expect(screen.getByText("Serve warm.")).toBeTruthy();
  expect(screen.getByText("Instructions:")).toBeTruthy();
});
it.each([
  { instructions: [], outcome: "success", _fallback: false },
  { instructions: ["Prepare all ingredients according to recipe", "Cook using appropriate methods for each ingredient", "Season to taste and serve hot"] },
  { instructions: "Prepare all ingredients according to recipe. Cook using appropriate methods for each ingredient. Season to taste and serve hot." },
])("never counts a cached incomplete or invented recipe as successful: %j", patch => {
  cache([{ ...valid, ...patch }]);
  render(<GatheringsPage />);
  expect(screen.getByRole("heading", { name: "No recipes are ready — please try again" })).toBeTruthy();
  expect(screen.queryByText("Instructions:")).toBeNull();
  expect(screen.queryByText("Cook using appropriate methods for each ingredient")).toBeNull();
});
it("renders clinical withholding with an explicit status and no cooking directions", () => {
  cache([{ ...valid, name: "Main Course", ingredients: [], instructions: [], _fallback: true,
    outcome: "clinical_withheld", description: CLINICAL_RECIPE_WITHHELD }]);
  render(<GatheringsPage />);
  expect(screen.getByRole("heading", { name: "Clinical review required" })).toBeTruthy();
  expect(screen.queryByText("Instructions:")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("No complete recipes");
});
it.each([
  { kind: "partial", courses: [valid, { ...valid, id: "third", name: "Baked Pears" }, failed], completed: 2,
    title: "Your experience is partially ready" },
  { kind: "failed", courses: [failed, failed, failed], completed: 0,
    title: "No recipes are ready — please try again" },
  { kind: "complete", courses: [valid, { ...valid, id: "second" }, { ...valid, id: "third" }], completed: 3,
    title: "Your experience is ready!" },
])("shows truthful fresh $kind completion in the actual page and toast", async ({ courses, completed, title }) => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ courses }) } as Response);
  render(<GatheringsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Camping" }));
  fireEvent.click(screen.getByRole("button", { name: /3/ }));
  fireEvent.click(screen.getByRole("button", { name: "Create My Experience" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalled());
  expect(mockToast.mock.calls.at(-1)?.[0].title).toBe(title);
  expect(screen.getByRole("status").textContent).toContain(completed ? `${completed} of 3 recipes are ready` : "No complete recipes");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it.each(["kosher", "halal", "vegan", "vegetarian"])("does not convert cached %s profile/classification flags into recipe verification", diet => {
  mockDietaryRestrictions.push(diet);
  cache([{ ...valid, medicalBadges: [diet, "cardiac"], dietaryComplianceVerified: true,
    dietClassification: { kosherCategory: "pareve", veganFlags: { plantBased: true } } }]);
  render(<GatheringsPage />);
  expect(screen.getByLabelText("Recipe validation evidence")).toBeTruthy();
  expect(screen.getByText(/selected preference, not recipe verification/)).toBeTruthy();
  expect(screen.queryByText(/ingredient\/protocol checks passed/)).toBeNull();
  expect(screen.queryByText("Medical Safety")).toBeNull();
});
it.each([false, true])("checks the exact cached recipe before showing supplied badge evidence; stale=%s", stale => {
  const recipe = { ...valid, medicalBadges: ["kosher"], outcome: "success" };
  const validationEvidence = buildGatheringsValidationEvidence(recipe, {
    passed: true, violations: [], instructionViolations: [], message: "passed",
  }, ["kosher"]);
  cache([{ ...recipe, validationEvidence, instructions: stale ? ["Add pork and bake."] : recipe.instructions }]);
  render(<GatheringsPage />);
  const badge = screen.queryByText("Kosher ingredient/protocol checks passed");
  if (stale) expect(badge).toBeNull();
  else expect(badge).toBeTruthy();
});
