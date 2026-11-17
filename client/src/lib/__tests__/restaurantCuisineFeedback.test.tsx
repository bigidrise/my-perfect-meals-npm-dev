/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, options: any) => options.defaultValue }),
}));
import RestaurantCuisineFeedback from "@/components/away-from-home/RestaurantCuisineFeedback";

const snapshot = { owner: "synthetic-member", saved: "chinese", explicit: null };
afterEach(cleanup);

test("matching cached context retains evidence disclosure without calling it changed", () => {
  render(<RestaurantCuisineFeedback previous={snapshot} current={snapshot}
    compositionNotice="Unverified suggestions, not confirmed menu items." onRegenerate={jest.fn()} />);
  expect(screen.queryByText(/Previous recommendations/)).toBeNull();
  expect(screen.getByText(/Unverified suggestions/)).toBeTruthy();
});
test("a cuisine change during an active session marks existing meals historical without deleting or regenerating", () => {
  const regenerate = jest.fn();
  const { rerender } = render(<RestaurantCuisineFeedback previous={snapshot} current={snapshot} onRegenerate={regenerate} />);
  rerender(<RestaurantCuisineFeedback previous={snapshot} current={{ ...snapshot, saved: "american" }} onRegenerate={regenerate} />);
  expect(screen.getByText(/Previous recommendations/)).toBeTruthy();
  expect(screen.getByText(/saved meals are unchanged/)).toBeTruthy();
  expect(regenerate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Review cuisine/ }));
  expect(regenerate).toHaveBeenCalledTimes(1);
});
test("legacy cache without preference provenance is never labeled fresh", () => {
  render(<RestaurantCuisineFeedback current={snapshot} onRegenerate={jest.fn()} />);
  expect(screen.getByText(/different or unknown cuisine preferences/)).toBeTruthy();
  expect(screen.getByText(/menu availability and ingredient evidence have not been rechecked/)).toBeTruthy();
});
test("an explicit cuisine change also marks cached results historical", () => {
  render(<RestaurantCuisineFeedback previous={snapshot} current={{ ...snapshot, explicit: "chinese-american" }}
    cuisineNotice="Chinese-American is distinct from Chinese." onRegenerate={jest.fn()} />);
  expect(screen.getByText(/Previous recommendations/)).toBeTruthy();
  expect(screen.getByText(/Chinese-American is distinct/)).toBeTruthy();
});
