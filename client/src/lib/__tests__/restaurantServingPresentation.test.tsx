/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RestaurantPortions from "@/components/away-from-home/RestaurantPortions";
import GetawayMealImage from "@/components/away-from-home/GetawayMealImage";
import { bindRestaurantServing } from "@shared/restaurantServing";
import { getQuickView, setQuickView } from "@/lib/macrosQuickView";

const meal = { name: "Salmon plate", calories: 490.5, protein: 40.1, carbs: 30, fat: 23 };
const serving = bindRestaurantServing({ label: "One suggested plate", items: [
  { food: "Salmon", quantity: 170, unit: "g", basis: "cooked" },
  { food: "Vegetables", quantity: 240, unit: "ml", basis: "as_served" },
] }, meal)!;
afterEach(() => { cleanup(); localStorage.clear(); });
test("all restaurant consumers can render practical portions with honest nutrition disclosure", () => {
  render(<RestaurantPortions serving={serving} meal={meal} />);
  expect(screen.getByText("Your plate")).toBeTruthy();
  expect(screen.getByText(/Salmon — about 6 oz cooked/)).toBeTruthy();
  expect(screen.getByText(/Vegetables — about 1 cup/)).toBeTruthy();
  expect(screen.getByText(/not independently calculated or verified/)).toBeTruthy();
});
test("cached portions disappear if nutrition changes; absence does not invent a plate", () => {
  const view = render(<RestaurantPortions serving={serving} meal={{ ...meal, carbs: 90 }} />);
  expect(view.container.textContent).toBe("");
  view.rerender(<RestaurantPortions meal={meal} />);
  expect(view.container.textContent).toBe("");
});
test("missing Getaway image uses a small neutral mascot without any request API", () => {
  render(<GetawayMealImage name={meal.name} />);
  const image = screen.getByRole("img");
  expect(image.getAttribute("src")).toBe("/assets/ChefBlackApron.png");
  expect(image.getAttribute("alt")).toMatch(/not a meal photograph/);
  expect(image.className).toMatch(/h-16 w-16/);
});
test("valid food URLs survive; delivery failure falls back without generation or repair", () => {
  render(<GetawayMealImage src="/public-objects/salmon.png" name={meal.name} />);
  const image = screen.getByRole("img");
  expect(image.getAttribute("src")).toBe("/public-objects/salmon.png");
  fireEvent.error(image);
  expect(image.getAttribute("src")).toBe("/assets/ChefBlackApron.png");
});
test("Biometrics preview round-trip preserves serving and decimal nutrition without consumption logging", () => {
  setQuickView({ ...meal, restaurantServing: serving, title: meal.name, dateISO: "2026-10-31" });
  expect(getQuickView()).toMatchObject({ restaurantServing: serving, calories: 490.5, protein: 40.1 });
  expect(localStorage.length).toBe(1);
});
