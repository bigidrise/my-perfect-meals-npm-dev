/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import HydrationInterventionCards from "@/components/HydrationInterventionCards";
import { createHydrationHandoff, recordHydrationInterventionEvent } from "@/lib/hydrationApi";

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/hydrationApi", () => ({
  createHydrationHandoff: jest.fn(),
  recordHydrationInterventionEvent: jest.fn(),
}));

const guidance = "Current tolerance guidance: Skip citrus, acidic or spicy flavoring; choose smooth, mild options.";
const options = [
  { id: "create-option", barrierCode: "taste" as const, optionKey: "flavor-forward", title: "Make it more appealing", description: `Try a fresh, unsweetened flavor direction. ${guidance}`, destinationType: "beverage_creator", createdAt: "2026-10-06T00:59:09Z" },
  { id: "try-option", barrierCode: "taste" as const, optionKey: "alternate-temperature", title: "Change the experience", description: `Try a different temperature. ${guidance}`, destinationType: "guidance", createdAt: "2026-10-06T00:59:09Z" },
];
const record = recordHydrationInterventionEvent as jest.Mock;
const handoff = createHydrationHandoff as jest.Mock;
let navigate: jest.Mock;
let reload: jest.Mock;

function setup() {
  render(<HydrationInterventionCards options={options} preferences={{ flavor: "mild", carbonation: "still", temperature: "no_preference" }} barrierLabel={() => "Taste"} navigate={navigate} reload={reload} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  record.mockReset().mockResolvedValue({ ok: true });
  handoff.mockReset().mockResolvedValue({ token: "signed-test-token" });
  navigate = jest.fn();
  reload = jest.fn().mockResolvedValue(undefined);
});

test("Create records accepted/opened and opens the existing Everyday handoff destination", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/lifestyle/beverage-creator?hydrationHandoff=signed-test-token"));
  expect(record.mock.calls).toEqual([
    ["create-option", "accepted"],
    ["create-option", "opened", { destination: "beverage_creator" }],
  ]);
  expect(handoff).toHaveBeenCalledWith({
    door: "everyday",
    description: `Practical Hydration support for barrier: taste. Flavor preference: mild. ${options[0].description}`,
  });
  expect(reload).not.toHaveBeenCalled();
});

test.each(["accepted event", "opened event", "handoff", "navigation"])("Create shows a visible error when %s fails", async (stage) => {
  const error = new Error("503: Please try again.");
  if (stage === "accepted event") record.mockRejectedValueOnce(error);
  if (stage === "opened event") record.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(error);
  if (stage === "handoff") handoff.mockRejectedValueOnce(error);
  if (stage === "navigation") navigate.mockImplementationOnce(() => { throw error; });
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not open Beverage Creator. Please try again.");
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled();
  if (stage !== "navigation") expect(navigate).not.toHaveBeenCalled();
  if (stage.endsWith("event")) expect(handoff).not.toHaveBeenCalled();
});

test("missing handoff token fails visibly rather than navigating", async () => {
  handoff.mockResolvedValueOnce({});
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The Hydration handoff was unavailable.");
  expect(navigate).not.toHaveBeenCalled();
});

test("Try it records only acceptance, confirms visibly, and reloads the counters", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Try it" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved as something to try.");
  await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  expect(record.mock.calls).toEqual([["try-option", "accepted"]]);
  expect(handoff).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Saved as something to try" }));
});

test("Try it failure is visible and never records completion or claims success", async () => {
  record.mockRejectedValueOnce(new Error("403: Access denied."));
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Try it" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save this strategy. Access denied.");
  expect(record.mock.calls).toEqual([["try-option", "accepted"]]);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(reload).not.toHaveBeenCalled();
});

test.each(["Create", "Try it"])("%s blocks duplicate and cross-card clicks while pending", async (label) => {
  let resolve!: (value: unknown) => void;
  record.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  setup();
  const clicked = screen.getByRole("button", { name: label });
  const other = screen.getByRole("button", { name: label === "Create" ? "Try it" : "Create" });
  // Same-turn dispatch checks the synchronous ref guard as well as disabled UI.
  act(() => { fireEvent.click(clicked); fireEvent.click(clicked); fireEvent.click(other); });
  expect(record).toHaveBeenCalledTimes(1);
  expect(clicked).toBeDisabled();
  expect(other).toBeDisabled();
  expect(clicked).toHaveAttribute("aria-busy", "true");
  expect(clicked).toHaveTextContent(label === "Create" ? "Opening…" : "Saving…");
  await act(async () => { resolve({ ok: true }); });
  await waitFor(() => expect(screen.getByRole("button", { name: label })).not.toBeDisabled());
  expect(record).not.toHaveBeenCalledWith("try-option", "completed");
});

test("the exact backend-projected Mouth sensitivity guidance stays visible in both cards", () => {
  setup();
  expect(screen.getByText(options[0].description)).toHaveTextContent(guidance);
  expect(screen.getByText(options[1].description)).toHaveTextContent(guidance);
});
