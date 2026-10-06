/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import HydrationEverydayCreatorButton from "@/components/HydrationEverydayCreatorButton";
import { createHydrationHandoff } from "@/lib/hydrationApi";

const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/hydrationApi", () => ({ createHydrationHandoff: jest.fn() }));
const handoff = createHydrationHandoff as jest.Mock;
const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  handoff.mockReset().mockResolvedValue({ token: "signed-everyday-token" });
});

test("direct drink entry needs no barrier or consent selection and uses the existing signed handoff", async () => {
  render(<HydrationEverydayCreatorButton navigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name: "Create a Hydration Beverage" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/lifestyle/beverage-creator?hydrationHandoff=signed-everyday-token"));
  expect(handoff).toHaveBeenCalledWith({
    door: "everyday",
    description: "Create a practical Everyday Hydration beverage. Preserve all saved dietary and safety constraints and do not invent a medical fluid target.",
  });
});

test("opening state prevents rapid duplicate submissions", async () => {
  let resolve!: (value: unknown) => void;
  handoff.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<HydrationEverydayCreatorButton navigate={navigate} />);
  const button = screen.getByRole("button");
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(handoff).toHaveBeenCalledTimes(1);
  expect(button).toHaveTextContent("Opening Creator…");
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(button).toBeDisabled();
  await act(async () => { resolve({ token: "signed-everyday-token" }); });
  expect(button).not.toBeDisabled();
});

test("failed handoff gives visible feedback and allows retry without bypassing the failure", async () => {
  handoff.mockRejectedValueOnce(new Error("403: Access denied."));
  render(<HydrationEverydayCreatorButton navigate={navigate} />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not open the Creator. Access denied.");
  expect(navigate).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("missing token never opens an unsigned Creator URL", async () => {
  handoff.mockResolvedValueOnce({});
  render(<HydrationEverydayCreatorButton navigate={navigate} />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("The Hydration handoff was unavailable.");
  expect(navigate).not.toHaveBeenCalled();
});

test("navigation failure is visible instead of silent", async () => {
  navigate.mockImplementationOnce(() => { throw new Error("Navigation unavailable."); });
  render(<HydrationEverydayCreatorButton navigate={navigate} />);
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Navigation unavailable.");
});

// Integration contracts for the page, whose DEV timing instrumentation uses
// import.meta.env and is intentionally not imported into CommonJS Jest.
test("options section always mounts the drink action outside barrier-dependent cards", () => {
  const source = readFileSync(join(process.cwd(), "client/src/pages/HydrationCenter.tsx"), "utf8");
  const section = source.slice(source.indexOf("<h2 className=\"font-semibold text-white\">Help Me Get It In"), source.indexOf("<HydrationInterventionCards") + 27);
  expect(section).toContain('<HydrationEverydayCreatorButton navigate={navigate} testId="hydration-options-creator"');
  expect(section).toContain("You can create a drink with any barrier—or without choosing one.");
  expect(section).not.toMatch(/selectedBarriers.*&&.*HydrationEverydayCreatorButton/);
});

test("setup and options own distinct pending states; saving setup never requests options", () => {
  const source = readFileSync(join(process.cwd(), "client/src/pages/HydrationCenter.tsx"), "utf8");
  const setup = source.slice(source.indexOf("const saveSetup"), source.indexOf("const optOut"));
  const help = source.slice(source.indexOf("const getHelp"), source.indexOf("const projections"));
  expect(setup).toContain('setPendingAction("setup")');
  expect(setup).not.toContain("createHydrationHelp(");
  expect(setup).not.toContain("getHelp(");
  expect(help).toContain('setPendingAction("options")');
  expect(help).toContain("createHydrationHelp(");
  expect(setup).toContain("setPendingAction(null)");
  expect(help).toContain("setPendingAction(null)");
  expect(source).toContain('pendingAction === "setup" ? "Saving setup…" : "Save setup"');
  expect(source).toContain('pendingAction === "options" ? "Getting options…" : "Get options"');
  expect(source).toContain("Get options will be available when saving finishes.");
});
