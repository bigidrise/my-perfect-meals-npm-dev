/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { FontSizeProvider, useFontSize } from "../../contexts/FontSizeContext";

let mockUser: any = null;
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

function ExistingPreferenceActions() {
  const { fontSize, setFontSize } = useFontSize();
  return <div>
    <output aria-label="Selected text size">{fontSize}</output>
    {(["standard", "large", "xl"] as const).map((size, index) =>
      <button key={size} onClick={() => void setFontSize(size)}>{["A", "A+", "A++"][index]}</button>)}
  </div>;
}

beforeEach(() => {
  mockUser = null;
  localStorage.clear();
  document.documentElement.className = "";
  global.fetch = jest.fn(() => { throw new Error("No network is allowed in this test"); });
});
afterEach(cleanup);

test("the existing A/A+/A++ preference actions work before sign-in and retain the saved device setting", async () => {
  render(<FontSizeProvider><ExistingPreferenceActions /></FontSizeProvider>);
  for (const [label, preference] of [["A+", "large"], ["A++", "xl"], ["A", "standard"]]) {
    fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
    await waitFor(() => expect(document.documentElement.classList.contains(`font-size-${preference}`)).toBe(true));
    expect(localStorage.getItem("mpm_font_size_preference")).toBe(preference);
    expect(screen.getByLabelText("Selected text size").textContent).toBe(preference);
    expect(document.documentElement.classList.length).toBe(1);
  }
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a saved local preference is not overwritten by the account default on entry screens", async () => {
  const { rerender } = render(<FontSizeProvider><ExistingPreferenceActions /></FontSizeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "A+", exact: true }));
  mockUser = { id: "synthetic-font-member", fontSizePreference: "standard" };
  rerender(<FontSizeProvider><ExistingPreferenceActions /></FontSizeProvider>);
  await waitFor(() => expect(screen.getByLabelText("Selected text size").textContent).toBe("large"));
  expect(localStorage.getItem("mpm_font_size_preference")).toBe("large");
  expect(document.documentElement.classList.contains("font-size-large")).toBe(true);
  expect(global.fetch).not.toHaveBeenCalled();
});
