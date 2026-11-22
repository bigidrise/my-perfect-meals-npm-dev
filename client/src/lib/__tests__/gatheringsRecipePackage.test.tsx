/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import GatheringsPage, { saveExperienceCache, loadExperienceCache } from "@/pages/lifestyle/GatheringsPage";
import SavedMealRow from "@/components/SavedMealRow";
import { savedRecipePackage } from "@shared/recipePackage";

const mockHydrate = jest.fn();
const mockMutate = jest.fn();
const mockTranslation = jest.fn((..._args: unknown[]) => ({ data: null, isLoading: false }));
let mockLoadingImages: Record<string, boolean> = {};
let mockKeys: string[] = [];
let mockDevelopment = true;
jest.mock("@/lib/recipePackageGate", () => ({ get recipePackagesEnabled() { return mockDevelopment; } }));
jest.mock("@/hooks/useMealImages", () => ({
  useMealImages: () => ({ loadingImages: mockLoadingImages, hydrateImages: mockHydrate }),
}));
jest.mock("@/hooks/useSavedMeals", () => ({
  useSavedMealsCheck: () => ({ data: mockKeys }),
  useToggleSavedMeal: () => ({ mutate: mockMutate, isPending: false }),
  isMealSaved: (keys: string[], title: string, source: string, packageId?: string) =>
    keys.includes(`${title.toLowerCase()}|${source}${packageId ? `|recipe-package:${packageId}` : ""}`),
}));
jest.mock("@/hooks/useTranslatedMeal", () => ({ useTranslatedMeal: (...args: unknown[]) => mockTranslation(...args) }));
jest.mock("@/hooks/useMealShopping", () => ({ useMealShopping: () => ({ available: false }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "offline-user", dietaryRestrictions: [] } }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ hasActivePaidSubscription: () => true }));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => true }));
jest.mock("wouter", () => ({ useLocation: () => ["/lifestyle/my-perfect-gatherings", jest.fn()] }));
const translate = (key: string, values?: Record<string, unknown>) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? name));
jest.mock("@/i18n/useConsumerCopy", () => ({ useConsumerCopy: () => ({ t: translate }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate, i18n: { language: "en" } }) }));
jest.mock("@/i18n/useCreatorOptionLabels", () => ({ useCreatorOptionLabels: () => ({}) }));
jest.mock("@/components/copilot/useCopilotPageExplanation", () => ({ useCopilotPageExplanation: () => {} }));
jest.mock("@/hooks/useDietGuardPrecheck", () => ({ useDietGuardPrecheck: () => ({
  alert: { isOpen: false }, decision: "pending", checkDiet: jest.fn(), clearAlert: jest.fn(),
}) }));
jest.mock("@/hooks/useSafetyGuardPrecheck", () => ({ useSafetyGuardPrecheck: () => ({
  alert: { isOpen: false }, checkSafety: jest.fn(async () => true), clearAlert: jest.fn(),
}) }));
jest.mock("@/hooks/useStarchGuardPrecheck", () => ({ useStarchGuardPrecheck: () => ({
  alert: { isOpen: false, matchedTerms: [] }, decision: "pending", checkStarch: jest.fn(() => true), clearAlert: jest.fn(),
}) }));
jest.mock("@/components/StarchGuardIntercept", () => ({ StarchGuardIntercept: () => null, StarchSubstitutionNotice: () => null }));
jest.mock("@/components/DietGuardIntercept", () => ({ DietGuardIntercept: () => null, DietAdaptedNotice: () => null }));
jest.mock("@/components/SafetyGuardBanner", () => ({ SafetyGuardBanner: () => null }));
jest.mock("@/components/GlucoseGuardToggle", () => ({ GlucoseGuardToggle: () => null }));
jest.mock("@/components/badges/HealthBadgesPopover", () => () => null);
jest.mock("@/components/ShoppingAggregateBar", () => () => null);
jest.mock("@/components/TranslateToggle", () => () => null);
jest.mock("@/components/ShareRecipeButton", () => () => null);
jest.mock("@/components/AddToMealPlanButton", () => () => null);
jest.mock("@/components/DietStyleBadge", () => () => null);
jest.mock("@/components/MealClassificationPill", () => () => null);
jest.mock("@/components/KosherProTip", () => () => null);
jest.mock("@/components/PhaseGate", () => ({ children }: any) => children);
jest.mock("@/components/AlphaGalBadge", () => () => null);
jest.mock("@/components/DiabetesProtocolIndicator", () => () => null);
jest.mock("@/components/MealGenerationProgress", () => () => null);
jest.mock("@/components/ServingInstructionsBlock", () => () => null);
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("@/components/ui/MealImageSlot", () => ({
  MealImageSlot: ({ imageUrl, mealName }: any) => imageUrl ? <img src={imageUrl} alt={mealName} /> : null,
}));
jest.mock("@/components/IngredientDisplay", () => ({ IngredientDisplay: ({ legacyText }: any) => <>{legacyText}</> }));
jest.mock("@/components/MealCardActions", () => ({
  __esModule: true, default: ({ children }: any) => <div>{children}</div>,
  MealCardAction: ({ children }: any) => <>{children}</>,
}));
jest.mock("@/components/shopping/GroceryCoachMacroTiles", () => ({
  GroceryCoachMacroTiles: ({ macros, servings }: any) => <div>{macros.calories} calories per serving; serves {servings}</div>,
}));
jest.mock("@/utils/medicalPersonalization", () => ({ generateMedicalBadges: () => [], getUserMedicalProfile: () => ({}) }));

const guide = { title: "Turkey Nature-to-Table Guide", sections: [
  { heading: "Preparation", text: "Clean, chill, and marinate the turkey overnight. Keep the reserved herbs." },
  { heading: "Outdoor methods", text: "Choose the grill OR Dutch oven." },
] };
const courses = [
  { id: "turkey", name: "Grilled wild turkey", description: "Herb-marinated turkey",
    ingredients: [{ name: "turkey", quantity: 2, unit: "lb" }], instructions: "Grill until safely cooked.",
    servings: 4, calories: 800, protein: 120, carbs: 8, fat: 30,
    nutrition: { calories: 800, protein: 120, carbs: 8, fat: 30 },
    imageUrl: "/public-objects/fixture/turkey.jpg", mediaAssetId: "original-turkey",
    courseType: "main", courseLabel: "Main", medicalBadges: [] },
  { id: "beans", name: "Campfire beans", description: "Warm beans", ingredients: [{ name: "beans", quantity: 1, unit: "cup" }],
    instructions: "Simmer the beans.", servings: 4, calories: 400, protein: 20, carbs: 60, fat: 5,
    imageUrl: "/public-objects/fixture/beans.jpg", mediaAssetId: "original-beans",
    courseType: "side", courseLabel: "Side", medicalBadges: [] },
];
const cached = {
  courses, harvestGuide: guide, servings: 4, situation: "outdoor" as const, eventType: null,
  generatedAtISO: "2026-11-22T15:00:00.000Z", proteinSource: "Wild Turkey",
  cookingMethod: "Grill", outdoorExperienceType: "complete" as const,
};
const key = "ultimateExperience.cache.v1";
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks(); mockKeys = []; mockDevelopment = true; mockLoadingImages = {};
  window.scrollTo = jest.fn();
  Element.prototype.scrollIntoView = jest.fn();
  global.fetch = jest.fn(() => Promise.reject(new Error("Unexpected network request"))) as any;
});
afterEach(cleanup);

test("navigation/remount and refresh restore the complete guide and original meal images without hydration or generation", () => {
  saveExperienceCache(cached);
  const page = render(<GatheringsPage />);
  expect(screen.getByText(guide.sections[0].text)).toBeInTheDocument();
  expect(screen.getByText(courses[0].name)).toBeInTheDocument();
  expect(screen.getByText(courses[1].name)).toBeInTheDocument();
  page.unmount();
  render(<GatheringsPage />);
  expect(screen.getByText(guide.sections[1].text)).toBeInTheDocument();
  expect(loadExperienceCache()?.courses).toEqual(courses);
  expect(loadExperienceCache()?.harvestGuide).toEqual(guide);
  expect(mockHydrate).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("Hide/Show changes only visibility and preserves the guide in the cache", () => {
  saveExperienceCache(cached);
  const page = render(<GatheringsPage />);
  fireEvent.click(screen.getByRole("button", { name: /Hide/ }));
  expect(screen.queryByText(guide.sections[0].text)).not.toBeInTheDocument();
  expect(loadExperienceCache()?.harvestGuide).toEqual(guide);
  page.unmount(); render(<GatheringsPage />);
  expect(screen.queryByText(guide.sections[0].text)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Show Guide/ }));
  expect(screen.getByText(guide.sections[0].text)).toBeInTheDocument();
});

test.each([0, 1, 2])("save control %s sends the identical complete package to the existing Favorites mutation", index => {
  saveExperienceCache(cached); render(<GatheringsPage />);
  fireEvent.click(screen.getAllByRole("button", { name: "Save to favorites" })[index]);
  const payload = mockMutate.mock.calls[0][0];
  expect(payload).toEqual(savedRecipePackage({
    version: 1, id: cached.generatedAtISO, source: "great-outdoors",
    preparationGuide: guide, meals: courses, servings: 4,
  }, "create-dish"));
  expect(JSON.parse(JSON.stringify(payload)).mealData.recipePackage.meals).toEqual(courses);
});

test("the guide Save control cannot toggle an already saved package off", () => {
  saveExperienceCache(cached);
  mockKeys = [`${guide.title.toLowerCase()}|create-dish|recipe-package:${cached.generatedAtISO}`];
  render(<GatheringsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Saved to Favorites" }));
  expect(mockMutate).not.toHaveBeenCalled();
});

test("saving waits for initial image completion rather than freezing an unfinished package", () => {
  saveExperienceCache(cached); mockLoadingImages = { turkey: true };
  render(<GatheringsPage />);
  screen.getAllByRole("button", { name: "Save to favorites" }).forEach(button => expect(button).toBeDisabled());
});

test("a guide without meal cards is still restored and can be saved", () => {
  saveExperienceCache({ ...cached, courses: [] });
  render(<GatheringsPage />);
  expect(screen.getByText(guide.sections[0].text)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
  expect(mockMutate.mock.calls[0][0].mealData.recipePackage.meals).toEqual([]);
});

test("legacy courses-only caches remain usable, and malformed caches fail safely", () => {
  const { harvestGuide, ...legacy } = cached;
  saveExperienceCache(legacy);
  expect(loadExperienceCache()?.courses).toEqual(courses);
  localStorage.setItem(key, "not-json");
  expect(loadExperienceCache()).toBeNull();
  localStorage.setItem(key, JSON.stringify({ courses: "bad" }));
  expect(loadExperienceCache()).toBeNull();
});

test("cache storage failures are reported rather than treated as success", () => {
  const fail = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
  expect(saveExperienceCache(cached)).toBe(false);
  fail.mockRestore();
});

test("a restored missing image never authorizes image hydration or generation", () => {
  saveExperienceCache({ ...cached, courses: [{ ...courses[0], imageUrl: undefined }] });
  render(<GatheringsPage />);
  expect(mockHydrate).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("fresh generation writes the complete guide and cards to the existing cache before leaving", async () => {
  saveExperienceCache(cached);
  const freshGuide = { title: "New outdoor preparation", sections: [{ heading: "Chill", text: "Keep the food cold." }] };
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true, json: async () => ({ courses, harvestGuide: freshGuide }),
  } as Response);
  render(<GatheringsPage />);
  fireEvent.click(screen.getByRole("button", { name: /Generate New Experience/ }));
  await waitFor(() => expect(loadExperienceCache()?.harvestGuide).toEqual(freshGuide));
  expect(loadExperienceCache()?.courses).toEqual(courses);
  expect(mockHydrate).toHaveBeenCalledWith(courses, { initialGeneration: true });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("Saved Meals reopens the serialized guide before all recipe cards and preserves their original data", () => {
  const payload = savedRecipePackage({
    version: 1, id: "stored", source: "great-outdoors", preparationGuide: guide, meals: courses, servings: 4,
  }, "create-dish");
  const row = JSON.parse(JSON.stringify({ id: "favorite", ...payload }));
  const before = JSON.stringify(row);
  render(<SavedMealRow row={row} sourceLabel={() => "Great Outdoors"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  const preparation = screen.getByRole("region", { name: "Preparation guide" });
  expect(within(preparation).getByText("Preparation")).toBeInTheDocument();
  const turkeyTitle = screen.getByText(courses[0].name);
  expect(preparation.compareDocumentPosition(turkeyTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText(courses[1].name)).toBeInTheDocument();
  expect(screen.getByText(courses[0].instructions)).toBeInTheDocument();
  expect(screen.getByText(courses[1].instructions)).toBeInTheDocument();
  expect(screen.getByText("2 lb turkey")).toBeInTheDocument();
  expect(screen.getByText(/200 calories per serving; serves 4/)).toBeInTheDocument();
  expect(screen.getByAltText(courses[0].name)).toHaveAttribute("src", courses[0].imageUrl);
  expect(screen.getByAltText(courses[1].name)).toHaveAttribute("src", courses[1].imageUrl);
  expect(mockTranslation.mock.calls.every(([, enabled]) => !enabled)).toBe(true);
  expect(JSON.stringify(row)).toBe(before);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("Production keeps its existing individual meal rendering and does not expose package saving", () => {
  mockDevelopment = false;
  saveExperienceCache(cached);
  render(<GatheringsPage />);
  expect(screen.queryByText(guide.title)).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Save to favorites" })[0]);
  expect(mockMutate.mock.calls[0][0].title).toBe(courses[0].name);
  expect(mockMutate.mock.calls[0][0].mealData.recipePackage).toBeUndefined();
});

test("package cards display cookingInstructions when that is the original recipe instruction field", () => {
  const meal = { ...courses[0], instructions: "", cookingInstructions: ["Grill the turkey.", "Rest before slicing."] };
  const payload = savedRecipePackage({
    version: 1, id: "array-instructions", source: "great-outdoors",
    preparationGuide: guide, meals: [meal], servings: 4,
  }, "create-dish");
  render(<SavedMealRow row={{ id: "favorite", ...payload }} sourceLabel={() => "Great Outdoors"}
    onRemove={jest.fn()} onAddToMacros={jest.fn()} initialExpanded />);
  expect(screen.getByText("Grill the turkey.")).toBeInTheDocument();
  expect(screen.getByText("Rest before slicing.")).toBeInTheDocument();
});
