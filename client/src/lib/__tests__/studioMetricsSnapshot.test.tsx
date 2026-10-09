/** @jest-environment jsdom */
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));

import React from "react";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { apiRequest } from "@/lib/apiRequest";
import StudioMetricsSnapshot from "@/components/pro/StudioMetricsSnapshot";

const targets = { calories: 1320, protein_g: 121, carbs_g: 101, starchyCarbs_g: "21", fibrousCarbs_g: "80", fat_g: 48, hasTargets: true };
const totals = { kcal: 734, protein: 74, carbs: "25", starchyCarbs: "10", fibrousCarbs: "15", fiber: 99, fat: 35 };
const mockApi = apiRequest as jest.Mock;
function replies(logged: object = totals, target: object = targets) {
  mockApi.mockImplementation((url: string) => Promise.resolve(
    url.includes("/macro-targets") ? target : url.includes("/macros?") ? logged : { entry: null },
  ));
}
function row(label: string) {
  return within(screen.getByRole("table")).getByText(label).closest("tr")!;
}
function cells(label: string) {
  return within(row(label)).getAllByRole("cell").map(cell => cell.textContent);
}
beforeEach(() => { mockApi.mockReset(); replies(); });

it("uses real API split values in targets, logged totals, and separate deltas", async () => {
  render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  expect(cells("Total Carbs")).toEqual(["Total Carbs", "101g", "25g", "-76"]);
  expect(cells("Starchy Carbs")).toEqual(["Starchy Carbs", "21g", "10g", "-11"]);
  expect(cells("Fibrous Carbs")).toEqual(["Fibrous Carbs", "80g", "15g", "-65"]);
  const activeTargets = screen.getByText("Active Macro Targets").parentElement!;
  expect(within(activeTargets).getByText("21g")).toBeInTheDocument();
  expect(within(activeTargets).getByText("80g")).toBeInTheDocument();
  expect(within(activeTargets).getByText("101g")).toBeInTheDocument();
  expect(mockApi.mock.calls.every(([url]) => url.includes("/api/users/client-a/"))).toBe(true);
});

it("refreshes targets and both logged carb categories from the selected client's APIs", async () => {
  render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  replies({ ...totals, carbs: 40, starchyCarbs: 20, fibrousCarbs: 20 }, { ...targets, starchyCarbs_g: 30, fibrousCarbs_g: 90 });
  fireEvent.click(screen.getByRole("button", { name: "Refresh nutrition metrics" }));
  await screen.findByText("-70");
  expect(cells("Starchy Carbs")).toEqual(["Starchy Carbs", "30g", "20g", "-10"]);
  expect(cells("Fibrous Carbs")).toEqual(["Fibrous Carbs", "90g", "20g", "-70"]);
});

it("distinguishes unavailable breakdowns from genuine zero values without guessing a split", async () => {
  replies({ ...totals, starchyCarbs: undefined, fibrousCarbs: undefined }, { ...targets, starchyCarbs_g: undefined, fibrousCarbs_g: undefined });
  const view = render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  expect(cells("Starchy Carbs")).toEqual(["Starchy Carbs", "—", "—", ""]);
  expect(cells("Fibrous Carbs")).toEqual(["Fibrous Carbs", "—", "—", ""]);
  expect(screen.getByText(/Some logged carbs/)).toBeInTheDocument();
  replies({ ...totals, carbs: 0, starchyCarbs: 0, fibrousCarbs: 0 }, { ...targets, starchyCarbs_g: 0 });
  view.rerender(<StudioMetricsSnapshot clientId="client-b" />);
  await screen.findByRole("table");
  expect(cells("Starchy Carbs")).toEqual(["Starchy Carbs", "0g", "0g", ""]);
  expect(screen.queryByText(/Some logged carbs/)).not.toBeInTheDocument();
});

it("flags logged carbs that have not been classified instead of assigning them to a category", async () => {
  replies({ ...totals, starchyCarbs: 0, fibrousCarbs: 0 });
  render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  expect(cells("Total Carbs")[2]).toBe("25g");
  expect(cells("Starchy Carbs")[2]).toBe("0g");
  expect(cells("Fibrous Carbs")[2]).toBe("0g");
  expect(screen.getByText(/Some logged carbs/)).toBeInTheDocument();
});

it("hides the old client's data immediately and rejects its late refresh response", async () => {
  const view = render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  const finishA: Array<(value: unknown) => void> = [];
  mockApi.mockImplementation((url: string) => url.includes("/client-a/")
    ? new Promise(resolve => finishA.push(resolve))
    : Promise.resolve(url.includes("/macro-targets") ? { ...targets, starchyCarbs_g: 55 }
      : url.includes("/macros?") ? { ...totals, starchyCarbs: 5 } : { entry: null }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh nutrition metrics" }));
  view.rerender(<StudioMetricsSnapshot clientId="client-b" />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await screen.findByRole("table");
  expect(cells("Starchy Carbs")[1]).toBe("55g");
  await act(async () => { finishA.forEach(resolve => resolve({ ...totals, ...targets, starchyCarbs_g: 999 })); });
  expect(cells("Starchy Carbs")[1]).toBe("55g");
  expect(cells("Starchy Carbs")[2]).toBe("5g");
});

it("reports a failed nutrition refresh and offers a working retry instead of stale numbers", async () => {
  render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  mockApi.mockRejectedValue(new Error("Access denied"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh nutrition metrics" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  replies();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("table");
  expect(cells("Fibrous Carbs")[2]).toBe("15g");
});

it("keeps targets unset rather than inventing targets for a client without a prescription", async () => {
  replies(totals, { ...targets, hasTargets: false });
  render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  expect(screen.getByText("No macro targets set yet")).toBeInTheDocument();
  expect(cells("Fibrous Carbs")).toEqual(["Fibrous Carbs", "—", "15g", ""]);
});

it("does not expose the previous client's values while retrying a malformed response", async () => {
  const view = render(<StudioMetricsSnapshot clientId="client-a" />);
  await screen.findByRole("table");
  mockApi.mockResolvedValue(null);
  view.rerender(<StudioMetricsSnapshot clientId="client-b" />);
  await screen.findByRole("alert");
  const pending: Array<(value: unknown) => void> = [];
  mockApi.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText("21g")).not.toBeInTheDocument();
  await act(async () => pending.forEach((resolve, index) => resolve(
    index === 0 ? totals : index === 2 ? { ...targets, starchyCarbs_g: 11 } : { entry: null },
  )));
  await screen.findByRole("table");
  expect(cells("Starchy Carbs")[1]).toBe("11g");
});
