/** @jest-environment jsdom */
import {
  loadRemindersFromServer, saveRemindersToServer, isIOSReminderDevice,
} from "@/services/mealReminderService";

let mockPlatform = "ios";
jest.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mockPlatform !== "web", getPlatform: () => mockPlatform },
}));
const saved = [{ id: "synthetic", label: "Breakfast", time: "08:00", enabled: true }];
beforeEach(() => {
  mockPlatform = "ios";
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ slots: saved }) })) as any;
});
afterEach(() => jest.restoreAllMocks());

test("native reads fail explicitly while the existing website fallback remains unchanged", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("offline"));
  await expect(loadRemindersFromServer({ strict: true })).rejects.toThrow("offline");
  await expect(loadRemindersFromServer()).resolves.toMatchObject([
    { enabled: false }, { enabled: false }, { enabled: false },
  ]);
});
test("native malformed responses cannot be mistaken for an empty reminder list", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(loadRemindersFromServer({ strict: true })).rejects.toThrow("Invalid reminder response");
  await expect(saveRemindersToServer(saved, { strict: true })).rejects.toThrow("could not be confirmed");
});
test("native save responses cannot silently discard enabled slots", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ slots: [] }) });
  await expect(saveRemindersToServer(saved, { strict: true })).rejects.toThrow("could not be confirmed");
});
test("native normalizes database seconds without changing browser data or HTTP behavior", async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true, json: async () => ({ slots: [{ ...saved[0], time: "08:00:00" }] }),
  });
  expect((await loadRemindersFromServer({ strict: true }))[0].time).toBe("08:00");
  expect((await loadRemindersFromServer())[0].time).toBe("08:00:00");
  expect(fetch).toHaveBeenCalledWith("/api/user/reminders", { credentials: "include" });
});
test("repair selects only installed iOS, not Android or the public website", () => {
  expect(isIOSReminderDevice()).toBe(true);
  mockPlatform = "android";
  expect(isIOSReminderDevice()).toBe(false);
  mockPlatform = "web";
  expect(isIOSReminderDevice()).toBe(false);
});
