/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
const mockNavigate = jest.fn();
const mockRequest = jest.fn();
const mockQuickView = jest.fn();
const mockFavorite = jest.fn();
const mockKeys: string[] = [];
jest.mock("wouter", () => ({ useLocation: () => ["/lifestyle/my-perfect-getaway", mockNavigate] }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => mockRequest(...args) }));
jest.mock("@/lib/macrosQuickView", () => ({ setQuickView: (...args: any[]) => mockQuickView(...args) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "member" } }) }));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ hasActivePaidSubscription: () => true }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useSavedMeals", () => ({
  useSavedMealsCheck: () => ({ data: mockKeys }), isMealSaved: () => false,
  useToggleSavedMeal: () => ({ mutate: (...args: any[]) => mockFavorite(...args) }),
}));
jest.mock("@/components/away-from-home/AwayFromHomeMealCard", () => ({
  __esModule: true, default: ({ recommendation }: any) => <div data-testid="existing-restaurant-card">{recommendation.meal.name}</div>,
}));
import GetawayVenueMeals from "@/components/away-from-home/GetawayVenueMeals";
import { bindRestaurantServing } from "@shared/restaurantServing";
const payload = {
  restaurantName: "Guy's Burger Joint", cuisine: "Burger", compositionEvidence: "unverified",
  selectedVenue: { destinationName: "Carnival" },
  recommendations: [{ id: "meal-1", name: "Burger and vegetables", calories: 380,
    protein: 35, carbs: 18, fat: 12, ingredients: ["beef", "lettuce", "tomato"] }],
};
beforeEach(() => {
  jest.clearAllMocks();
  // apiRequest returns parsed JSON, not a fetch Response.
  mockRequest.mockResolvedValue(payload);
});
afterEach(cleanup);
async function chooseVenue() {
  fireEvent.change(screen.getByLabelText("Restaurant or dining venue"), { target: { value: "Guy's Burger Joint" } });
  fireEvent.click(screen.getByRole("button", { name: "Recommend meals for this venue" }));
  await screen.findByTestId("getaway-structured-meal");
}
test.each(["Disneyland Park", "Los Angeles International Airport"])(
  "%s uses a neutral dining placeholder and does not preselect a cruise restaurant", destinationName => {
    render(<GetawayVenueMeals destination={{ destinationName }} />);
    const field = screen.getByRole("textbox", { name: "Restaurant or dining venue" }) as HTMLInputElement;
    expect(field.placeholder).toBe("Enter a restaurant or dining location at this destination");
    expect(field.value).toBe("");
    expect(screen.queryByPlaceholderText("Guy's Burger Joint or Lido buffet")).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  },
);
test("one explicit selection reuses Guide, never the coach, without diet overrides or image generation", async () => {
  render(<GetawayVenueMeals destination={{ destinationName: "Carnival" }} />);
  expect(mockRequest).not.toHaveBeenCalled();
  await chooseVenue();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest.mock.calls[0][0]).toBe("/api/restaurants/guide");
  expect(JSON.parse(mockRequest.mock.calls[0][1].body)).toEqual({
    restaurantName: "Guy's Burger Joint", craving: "Help me choose a meal at Guy's Burger Joint.",
    getawayVenue: { destinationName: "Carnival" },
  });
  expect(screen.getByText(/Cuisine-based meal suggestions/)).toBeTruthy();
  expect(mockFavorite).not.toHaveBeenCalled();
  expect(mockQuickView).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
test("existing Favorites receives the actual meal and Biometrics requires an explicit review action", async () => {
  render(<GetawayVenueMeals destination={{ destinationName: "Carnival" }} />);
  await chooseVenue();
  fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
  expect(mockFavorite).toHaveBeenCalledWith(expect.objectContaining({
    sourceType: "restaurant", title: "Burger and vegetables",
    mealData: expect.objectContaining({ calories: 380, protein: 35, carbs: 18, fat: 12,
      ingredients: ["beef", "lettuce", "tomato"], nutritionStatus: "estimated" }),
  }), expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Review in Biometrics" }));
  expect(mockQuickView).toHaveBeenCalledWith(expect.objectContaining({ calories: 380, protein: 35, carbs: 18, fat: 12 }));
  expect(mockNavigate).toHaveBeenCalledWith("/biometrics?section=macros");
});
test("editing a venue immediately removes old actionable meals", async () => {
  const onRecommendationsChange = jest.fn();
  render(<GetawayVenueMeals destination={{ destinationName: "Carnival" }} onRecommendationsChange={onRecommendationsChange} />);
  await chooseVenue();
  expect(onRecommendationsChange).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText("Restaurant or dining venue"), { target: { value: "Lido buffet" } });
  expect(onRecommendationsChange).toHaveBeenLastCalledWith(false);
  expect(screen.queryByTestId("getaway-structured-meal")).toBeNull();
});

test("Favorites and explicit Biometrics review retain the Buffet-compatible plate and its nutrition", async () => {
  const meal = { ...payload.recommendations[0],
    buffetItems: [{ food: "Burger patty", portion: "4 oz cooked" },
      { food: "Vegetables", portion: "1 cup", note: "Steamed" }],
    portionGuidance: "This estimate includes the patty and side." };
  const serving = bindRestaurantServing(meal, meal)!;
  mockRequest.mockResolvedValueOnce({ ...payload, recommendations: [{ ...meal, serving }] });
  render(<GetawayVenueMeals destination={{ destinationName: "Carnival" }} />);
  await chooseVenue();
  fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
  expect(mockFavorite).toHaveBeenCalledWith(expect.objectContaining({
    mealData: expect.objectContaining({ serving, calories: meal.calories, protein: meal.protein,
      carbs: meal.carbs, fat: meal.fat }),
  }), expect.anything());
  expect(mockQuickView).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review in Biometrics" }));
  expect(mockQuickView).toHaveBeenCalledWith(expect.objectContaining({ restaurantServing: serving,
    calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }));
});
test("failed clinical validation and advice-only payloads never show saving or tracking controls", async () => {
  mockRequest.mockResolvedValueOnce({ bestChoices: payload.recommendations });
  render(<GetawayVenueMeals destination={{ destinationName: "Carnival" }} />);
  fireEvent.change(screen.getByLabelText("Restaurant or dining venue"), { target: { value: "Lido buffet" } });
  fireEvent.click(screen.getByRole("button", { name: "Recommend meals for this venue" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByTestId("existing-restaurant-card")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save to favorites" })).toBeNull();
  expect(mockFavorite).not.toHaveBeenCalled();
  expect(mockQuickView).not.toHaveBeenCalled();
});
