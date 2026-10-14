/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioStarchGamePlan } from "../../components/pro/StudioStarchGamePlan";
import { apiRequest } from "../../lib/apiRequest";
import type { StudioStarchState } from "../../../../shared/starchPreferences";
import fs from "node:fs";
import path from "node:path";

let mockActor = "professional-a";
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: mockActor } }),
}));
jest.mock("../../lib/apiRequest", () => ({ apiRequest: jest.fn() }));
const api = apiRequest as jest.MockedFunction<typeof apiRequest>;

function state(id: string, count: number | null = 2): StudioStarchState {
  return {
    clientUserId: id,
    savedPreferences: { defaultStarchMealsPerDay: count, starchDistributionStrategy: "even", starchPlanDefined: count !== null },
    currentPrescription: { starchyCarbsTarget: 84, starchMealsAllowed: count ?? 2, starchDistributionStrategy: "even" },
    workoutTimingAvailable: false,
  };
}
beforeEach(() => { mockActor = "professional-a"; api.mockReset(); });

test.each(["Physician", "Trainer"])("%s uses the shared editor and saves only the selected client's two preferences", async studio => {
  const source = fs.readFileSync(path.join(process.cwd(), "client/src/pages/pro",
    studio === "Physician" ? "ClinicianClientDashboard.tsx" : "TrainerClientDashboard.tsx"), "utf8");
  expect(source).toMatch(/IS_DEVELOPMENT \? <StudioStarchGamePlan key=\{clientId\}/);
  expect(source).toMatch(/clientUserId=\{resolvedClientUserId\}/);
  let saved = state("client-a");
  api.mockImplementation(async (_url, options) => {
    if (options?.method === "PATCH") {
      const prefs = JSON.parse(String(options.body));
      saved = { ...saved, savedPreferences: { ...prefs, starchPlanDefined: true },
        currentPrescription: { ...saved.currentPrescription, starchMealsAllowed: prefs.defaultStarchMealsPerDay,
          starchDistributionStrategy: prefs.starchDistributionStrategy } };
    }
    return saved;
  });
  const view = render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  fireEvent.click(screen.getByRole("button", { name: "Earlier in day" }));
  expect(screen.getAllByText(/approximately 28g/)).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  await screen.findByText("Client starch plan saved and confirmed.");
  const patch = api.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(patch[0]).toBe("/api/pro/clients/client-a/starch-preferences");
  expect(JSON.parse(String(patch[1]?.body))).toEqual({
    defaultStarchMealsPerDay: 3, starchDistributionStrategy: "morning",
  });
  view.unmount();
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "3 meals" }).getAttribute("aria-pressed")).toBe("true"));
});

test("switching clients rejects a late A load and discards A's draft before B saves", async () => {
  let finishA!: (value: StudioStarchState) => void;
  api.mockImplementation(async (url, options) => {
    if (url.includes("client-a")) return new Promise(resolve => { finishA = resolve; });
    if (options?.method === "PATCH") return state("client-b", 4);
    return state("client-b", 2);
  });
  const view = render(<StudioStarchGamePlan clientUserId="client-a" />);
  view.rerender(<StudioStarchGamePlan clientUserId="client-b" />);
  await screen.findByRole("button", { name: "4 meals" });
  fireEvent.click(screen.getByRole("button", { name: "4 meals" }));
  await act(async () => { finishA(state("client-a", 6)); });
  expect(screen.getByRole("button", { name: "4 meals" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  await screen.findByText("Client starch plan saved and confirmed.");
  const patches = api.mock.calls.filter(([, options]) => options?.method === "PATCH");
  expect(patches).toHaveLength(1);
  expect(patches[0][0]).toContain("client-b");
  expect(JSON.parse(String(patches[0][1]?.body)).defaultStarchMealsPerDay).toBe(4);
});

test("an in-flight A save remains A-scoped and its late result never replaces B", async () => {
  let finishSave!: (value: StudioStarchState) => void;
  api.mockImplementation(async (url, options) => {
    if (options?.method === "PATCH") return new Promise(resolve => { finishSave = resolve; });
    return state(url.includes("client-a") ? "client-a" : "client-b", 2);
  });
  const view = render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  view.rerender(<StudioStarchGamePlan clientUserId="client-b" />);
  await screen.findByRole("button", { name: "2 meals" });
  await act(async () => { finishSave(state("client-a", 3)); });
  expect(screen.getByRole("button", { name: "2 meals" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText("Client starch plan saved and confirmed.")).toBeNull();
  expect(api.mock.calls.find(([, options]) => options?.method === "PATCH")![0]).toContain("client-a");
});

test("failed save stays editable and unconfirmed, then an explicit retry succeeds", async () => {
  let fail = true;
  api.mockImplementation(async (_url, options) => {
    if (options?.method !== "PATCH") return state("client-a", 2);
    if (fail) { fail = false; throw new Error("fixture write failure"); }
    return state("client-a", 3);
  });
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Client starch plan saved and confirmed.")).toBeNull();
  expect(screen.getByRole("button", { name: "Save Starch Plan" }).hasAttribute("disabled")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  await screen.findByText("Client starch plan saved and confirmed.");
});

test("legacy One is explicitly unsaved, and reads do not auto-save it", async () => {
  api.mockResolvedValue(state("client-a", null));
  render(<StudioStarchGamePlan clientUserId="client-a" legacyStrategy="one" />);
  await screen.findByText(/Legacy One choice shown as an unsaved preview/);
  expect(api.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "1 meal" }).getAttribute("aria-pressed")).toBe("true");
});

test("macro target changes refresh this client's grams without discarding the pending count", async () => {
  let grams = 84;
  api.mockImplementation(async () => ({
    ...state("client-a", 2),
    currentPrescription: { ...state("client-a", 2).currentPrescription, starchyCarbsTarget: grams },
  }));
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  const before = api.mock.calls.length;
  act(() => { window.dispatchEvent(new CustomEvent("mpm:targetsUpdated", { detail: { userId: "client-b" } })); });
  expect(api.mock.calls).toHaveLength(before);
  grams = 120;
  act(() => { window.dispatchEvent(new CustomEvent("mpm:targetsUpdated")); });
  await waitFor(() => expect(screen.getAllByText(/approximately 40g/)).toHaveLength(3));
  expect(screen.getByRole("button", { name: "3 meals" }).getAttribute("aria-pressed")).toBe("true");
});

test.each([401, 403])("HTTP %s is explained as denied access, not a misleading retryable load failure", async status => {
  api.mockRejectedValueOnce(Object.assign(new Error(`Request failed (${status})`), {
    status, serverMessage: "An authorized Studio is required.",
  }));
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  expect((await screen.findByRole("alert")).textContent).toContain("Access to this client's starch plan was not approved.");
  expect(screen.getByRole("alert").textContent).toContain("An authorized Studio is required.");
  expect(screen.queryByRole("button", { name: "Retry Starch Plan" })).toBeNull();
  expect(screen.queryByRole("button", { name: "3 meals" })).toBeNull();
});

test("a late pre-save prescription refresh cannot overwrite the confirmed count", async () => {
  let finishRefresh!: (value: StudioStarchState) => void;
  let reads = 0;
  api.mockImplementation(async (_url, options) => {
    if (options?.method === "PATCH") return state("client-a", 3);
    if (++reads === 1) return state("client-a", 2);
    return new Promise(resolve => { finishRefresh = resolve; });
  });
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  act(() => { window.dispatchEvent(new CustomEvent("mpm:targetsUpdated")); });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  await screen.findByText("Client starch plan saved and confirmed.");
  await act(async () => { finishRefresh(state("client-a", 2)); });
  expect(screen.getByRole("button", { name: "3 meals" }).getAttribute("aria-pressed")).toBe("true");
});

test("a macro update during a pending starch save is refreshed after confirmation", async () => {
  let finishSave!: (value: StudioStarchState) => void;
  let reads = 0;
  api.mockImplementation(async (_url, options) => {
    if (options?.method === "PATCH") return new Promise(resolve => { finishSave = resolve; });
    if (++reads === 1) return state("client-a", 2);
    const updated = state("client-a", 3);
    updated.currentPrescription.starchyCarbsTarget = 120;
    return updated;
  });
  render(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Starch Plan" }));
  act(() => { window.dispatchEvent(new CustomEvent("mpm:targetsUpdated", { detail: { userId: "client-a" } })); });
  expect(reads).toBe(1);
  await act(async () => { finishSave(state("client-a", 3)); });
  await waitFor(() => expect(screen.getAllByText(/approximately 40g/)).toHaveLength(3));
  expect(screen.getByRole("button", { name: "3 meals" }).getAttribute("aria-pressed")).toBe("true");
});

test("unverified and unauthorized clients cannot edit; actor changes discard drafts", async () => {
  const view = render(<StudioStarchGamePlan clientUserId={null} />);
  expect(api).not.toHaveBeenCalled();
  api.mockRejectedValueOnce(new Error("403 fixture"));
  view.rerender(<StudioStarchGamePlan clientUserId="client-a" />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Save Starch Plan" })).toBeNull();
  api.mockResolvedValue(state("client-a", 2));
  fireEvent.click(screen.getByRole("button", { name: "Retry Starch Plan" }));
  await screen.findByRole("button", { name: "3 meals" });
  fireEvent.click(screen.getByRole("button", { name: "3 meals" }));
  mockActor = "professional-b";
  view.rerender(<StudioStarchGamePlan clientUserId="client-a" />);
  expect(screen.queryByRole("button", { name: "3 meals" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "2 meals" }).getAttribute("aria-pressed")).toBe("true"));
});
