/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RestaurantPortions from "@/components/away-from-home/RestaurantPortions";
import GetawayMealImage from "@/components/away-from-home/GetawayMealImage";
import { bindRestaurantServing } from "@shared/restaurantServing";
import { getQuickView, setQuickView } from "@/lib/macrosQuickView";
import { ChefHat } from "lucide-react";
import PlateItems from "@/components/away-from-home/PlateItems";

const meal = { name: "Salmon plate", calories: 490.5, protein: 40.1, carbs: 30, fat: 23 };
const serving = bindRestaurantServing({ buffetItems: [
  { food: "Salmon", portion: "170 g cooked" },
  { food: "Vegetables", portion: "240 ml" },
] }, meal)!;
afterEach(() => { cleanup(); localStorage.clear(); });
test("all restaurant consumers can render practical portions with honest nutrition disclosure", () => {
  render(<RestaurantPortions serving={serving} meal={meal} />);
  expect(screen.getByText("Your plate")).toBeTruthy();
  expect(screen.getByText(/about 6 oz cooked/)).toBeTruthy();
  expect(screen.getByText(/about 1 cup/)).toBeTruthy();
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
test("extracted Buffet plate markup preserves its existing portions, notes and translation behavior exactly", () => {
  const items = [{ food: "Chicken", portion: "1 cup shredded", note: "Lean protein source" },
    { food: "Corn", portion: "½ cup", note: "Moderate starchy carbs" }];
  const translatedFoods = ["Pollo", "Maíz"];
  // Reference markup from Buffet's previous shared card, unchanged by extraction.
  const reference = <div className="flex flex-col gap-1.5">
    {items.map((item, i) => <div key={i} className="flex items-start gap-2">
      <ChefHat className="w-3 h-3 text-orange-400/60 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-white font-medium">{translatedFoods[i] || item.food}</span>
        <span className="text-xs text-white/80"> · {item.portion}</span>
        {item.note && <p className="text-[10px] text-white/70 leading-snug">{item.note}</p>}
      </div>
    </div>)}
  </div>;
  const view = render(<PlateItems items={items} translatedFoods={translatedFoods} />);
  const extracted = view.container.innerHTML;
  view.rerender(reference);
  expect(view.container.innerHTML).toBe(extracted);
});
