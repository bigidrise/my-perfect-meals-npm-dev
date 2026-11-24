/** @jest-environment jsdom */
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { BasicHydrationLogger } from "@/components/biometrics/BasicHydrationLogger";

let mockSystem: "imperial" | "metric" = "imperial";
const mockGetWaterLogs = jest.fn();
const mockCreateWaterLog = jest.fn();
const mockToast = jest.fn();

jest.mock("@/hooks/useMeasurementSystem", () => ({
  useMeasurementSystem: () => mockSystem,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock("@/lib/waterLogsApi", () => ({
  getWaterLogs: (...args: any[]) => mockGetWaterLogs(...args),
  createWaterLog: (...args: any[]) => mockCreateWaterLog(...args),
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockSystem = "imperial";
  jest.clearAllMocks();
  mockGetWaterLogs.mockResolvedValue({
    items: [],
    localDate: new Date().toISOString().slice(0, 10),
  });
  mockCreateWaterLog.mockResolvedValue({});
});

afterEach(cleanup);

async function renderLoaded() {
  render(<BasicHydrationLogger userId="offline-subject" />);
  await screen.findByTestId("basic-hydration-unit-oz");
}

test("Imperial preference defaults to ounces", async () => {
  await renderLoaded();

  expect(screen.getByTestId("basic-hydration-amount")).toHaveValue(8);
  expect(screen.getByTestId("basic-hydration-unit-oz")).toHaveClass("bg-sky-600/80");
});

test("Metric preference defaults to milliliters", async () => {
  mockSystem = "metric";
  await renderLoaded();

  expect(Number(
    (screen.getByTestId("basic-hydration-amount") as HTMLInputElement).value
  )).toBeCloseTo(236.588, 2);
  expect(screen.getByTestId("basic-hydration-unit-ml")).toHaveClass("bg-sky-600/80");
});

test("switching measurement preference preserves entered fluid volume", async () => {
  const view = render(<BasicHydrationLogger userId="offline-subject" />);
  await screen.findByTestId("basic-hydration-unit-oz");

  const input = screen.getByTestId("basic-hydration-amount");
  fireEvent.change(input, { target: { value: "8" } });

  mockSystem = "metric";
  view.rerender(<BasicHydrationLogger userId="offline-subject" />);

  await waitFor(() => {
    expect(screen.getByTestId("basic-hydration-unit-ml")).toHaveClass("bg-sky-600/80");
    expect(Number((input as HTMLInputElement).value)).toBeCloseTo(236.588, 2);
  });
});
