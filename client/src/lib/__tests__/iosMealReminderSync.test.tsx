/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import IOSMealReminderSync from "@/components/IOSMealReminderSync";

let mockNative = true;
let mockAuth = { user: { id: "synthetic-a" } as { id: string } | null, loading: false };
let mockAppState: ((state: { isActive: boolean }) => void) | undefined;
const mockRestore = jest.fn(async () => {});
const mockSetOwner = jest.fn();
const mockRemove = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/services/mealReminderService", () => ({
  isIOSReminderDevice: () => mockNative,
  iosMealReminderScheduler: { setOwner: (...args: unknown[]) => mockSetOwner(...args), restore: () => mockRestore() },
}));
jest.mock("@capacitor/app", () => ({
  App: { addListener: jest.fn(async (_name, callback) => {
    mockAppState = callback;
    return { remove: mockRemove };
  }) },
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockNative = true;
  mockAuth = { user: { id: "synthetic-a" }, loading: false };
  mockAppState = undefined;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(cleanup);

test("restores at sign-in and native foreground, and after the permission prompt", async () => {
  await act(async () => { render(<IOSMealReminderSync />); });
  expect(mockSetOwner).toHaveBeenCalledWith("synthetic-a");
  expect(mockRestore).toHaveBeenCalledTimes(1);
  await act(async () => { mockAppState?.({ isActive: false }); });
  expect(mockRestore).toHaveBeenCalledTimes(1);
  await act(async () => { mockAppState?.({ isActive: true }); });
  await act(async () => { window.dispatchEvent(new Event("mpm:ios-reminders-refresh")); });
  expect(mockRestore).toHaveBeenCalledTimes(3);
});

test("waits for authentication, resets ownership on account changes and cleans up logout listeners", async () => {
  mockAuth.loading = true;
  const { rerender, unmount } = render(<IOSMealReminderSync />);
  expect(mockRestore).not.toHaveBeenCalled();
  mockAuth.loading = false;
  await act(async () => { rerender(<IOSMealReminderSync />); });
  mockAuth.user = { id: "synthetic-b" };
  await act(async () => { rerender(<IOSMealReminderSync />); });
  expect(mockSetOwner.mock.calls.map(args => args[0])).toEqual(["synthetic-a", null, "synthetic-b"]);
  mockAuth.user = null;
  await act(async () => { rerender(<IOSMealReminderSync />); });
  const count = mockRestore.mock.calls.length;
  await act(async () => {
    window.dispatchEvent(new Event("mpm:ios-reminders-refresh"));
    mockAppState?.({ isActive: true });
  });
  expect(mockRestore).toHaveBeenCalledTimes(count);
  unmount();
  expect(mockRemove).toHaveBeenCalled();
});

test("web does not load, schedule, cancel, or attach native listeners", async () => {
  mockNative = false;
  await act(async () => { render(<IOSMealReminderSync />); });
  expect(mockRestore).not.toHaveBeenCalled();
  expect(mockSetOwner).not.toHaveBeenCalled();
  const { App } = await import("@capacitor/app");
  expect(App.addListener).not.toHaveBeenCalled();
});
