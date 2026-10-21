import { createIOSMealReminderScheduler } from "@/services/iosMealReminderScheduler";
import type { ReminderSlot } from "@/services/mealReminderService";
import type { LocalNotificationsPlugin, LocalNotificationSchema } from "@capacitor/local-notifications";

const slots: ReminderSlot[] = [
  { label: "Breakfast", time: "08:00", enabled: true },
  { label: "Lunch", time: "13:00", enabled: true },
  { label: "Dinner", time: "18:00", enabled: true },
];
function fixture() {
  let pending: LocalNotificationSchema[] = [{ id: 9000, title: "Unrelated", body: "Keep me" }];
  const load = jest.fn(async () => slots.map(slot => ({ ...slot })));
  const plugin = {
    checkPermissions: jest.fn(async () => ({ display: "granted" })),
    getPending: jest.fn(async () => ({ notifications: pending.map(n => ({ ...n })) })),
    schedule: jest.fn(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
      pending = pending.filter(n => !notifications.some(update => update.id === n.id)).concat(notifications);
      return { notifications: notifications.map(({ id }) => ({ id })) };
    }),
    cancel: jest.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
      pending = pending.filter(n => !notifications.some(old => old.id === n.id));
    }),
  };
  const scheduler = createIOSMealReminderScheduler({
    load, plugin: async () => plugin as unknown as LocalNotificationsPlugin,
  });
  scheduler.setOwner("synthetic-a");
  return { scheduler, plugin, load, pending: () => pending, seed: (items: LocalNotificationSchema[]) => { pending = items; } };
}

test("restores enabled reminders, verifies pending times and is idempotent on resume", async () => {
  const f = fixture();
  await f.scheduler.restore();
  expect(f.scheduler.getStatus()).toMatchObject({ state: "scheduled", count: 3 });
  expect(f.pending().filter(n => n.id !== 9000).map(n => n.schedule?.on)).toEqual([
    { hour: 8, minute: 0 }, { hour: 13, minute: 0 }, { hour: 18, minute: 0 },
  ]);
  await f.scheduler.restore();
  expect(f.plugin.schedule).toHaveBeenCalledTimes(1);
  expect(f.plugin.cancel).not.toHaveBeenCalled();
});

test("changing one time updates only that ID and preserves other meals and unrelated notifications", async () => {
  const f = fixture();
  await f.scheduler.restore();
  f.plugin.schedule.mockClear();
  await f.scheduler.sync(slots.map((s, i) => i === 1 ? { ...s, time: "13:45" } : s));
  expect(f.plugin.schedule.mock.calls[0][0].notifications).toHaveLength(1);
  expect(f.pending()).toHaveLength(4);
  expect(f.pending().find(n => n.id === 2001)?.schedule?.on).toEqual({ hour: 13, minute: 45 });
  expect(f.plugin.cancel).not.toHaveBeenCalled();
});

test("missing schedules are repaired without duplicating already confirmed reminders", async () => {
  const f = fixture();
  await f.scheduler.restore();
  f.seed(f.pending().filter(n => n.id !== 2002));
  f.plugin.schedule.mockClear();
  await f.scheduler.restore();
  expect(f.plugin.schedule.mock.calls[0][0].notifications.map(n => n.id)).toEqual([2002]);
});

test("disabling one slot removes only its notification; disabling all preserves unrelated IDs", async () => {
  const f = fixture();
  await f.scheduler.restore();
  await f.scheduler.sync(slots.map((s, i) => i === 1 ? { ...s, enabled: false } : s));
  expect(f.pending().map(n => n.id).sort()).toEqual([2000, 2002, 9000]);
  await f.scheduler.sync(slots.map(s => ({ ...s, enabled: false })));
  expect(f.pending().map(n => n.id)).toEqual([9000]);
  expect(f.scheduler.getStatus().state).toBe("off");
});

test("read errors preserve the existing phone schedule rather than treating failure as disabled settings", async () => {
  const f = fixture();
  await f.scheduler.restore();
  const before = JSON.stringify(f.pending());
  f.load.mockRejectedValueOnce(new Error("offline"));
  await expect(f.scheduler.restore()).rejects.toThrow("offline");
  expect(JSON.stringify(f.pending())).toBe(before);
  expect(f.scheduler.getStatus().state).toBe("error");
});

test("denied permission never claims scheduling success or requests permission in the background", async () => {
  const f = fixture();
  f.plugin.checkPermissions.mockResolvedValueOnce({ display: "denied" });
  await f.scheduler.restore();
  expect(f.scheduler.getStatus().state).toBe("blocked");
  expect(f.plugin.schedule).not.toHaveBeenCalled();
  expect(f.plugin.cancel).not.toHaveBeenCalled();
});

test("schedule failure propagates without first deleting the working notifications", async () => {
  const f = fixture();
  await f.scheduler.restore();
  const before = JSON.stringify(f.pending());
  f.plugin.schedule.mockRejectedValueOnce(new Error("native failure"));
  await expect(f.scheduler.sync(slots.map(s => ({ ...s, time: "10:00" })))).rejects.toThrow("native failure");
  expect(JSON.stringify(f.pending())).toBe(before);
  expect(f.plugin.cancel).not.toHaveBeenCalled();
  expect(f.scheduler.getStatus().state).toBe("error");
});

test("a successful schedule call without pending confirmation is reported as an error", async () => {
  const f = fixture();
  f.plugin.schedule.mockImplementationOnce(async () => ({ notifications: [] }));
  await expect(f.scheduler.restore()).rejects.toThrow("did not confirm");
  expect(f.scheduler.getStatus().state).toBe("error");
});

test.each(["25:00", "10:99", "broken"])("invalid time %s never alters the phone schedule", async time => {
  const f = fixture();
  await expect(f.scheduler.sync([{ ...slots[0], time }])).rejects.toThrow("Invalid saved");
  expect(f.plugin.schedule).not.toHaveBeenCalled();
  expect(f.plugin.cancel).not.toHaveBeenCalled();
});

test("legacy meal IDs are removed only after replacement verification", async () => {
  const f = fixture();
  f.seed([...f.pending(), { id: 1001, title: "Old breakfast", body: "Legacy" }]);
  await f.scheduler.restore();
  expect(f.pending().some(n => n.id === 1001)).toBe(false);
  expect(f.pending().some(n => n.id === 9000)).toBe(true);
  expect(f.plugin.schedule.mock.invocationCallOrder[0]).toBeLessThan(f.plugin.cancel.mock.invocationCallOrder[0]);
});

test("stale account reads cannot schedule after an account switch", async () => {
  const f = fixture();
  let finish!: (value: ReminderSlot[]) => void;
  f.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const oldRead = f.scheduler.restore();
  await Promise.resolve();
  const oldSession = f.scheduler.captureSession();
  f.scheduler.setOwner("synthetic-b");
  finish(slots);
  await oldRead;
  expect(oldSession()).toBe(false);
  expect(f.plugin.schedule).not.toHaveBeenCalled();
  await f.scheduler.restore();
  expect(f.pending().find(n => n.id === 2000)?.extra.owner).toBe("synthetic-b");
});

test("logout cleans meal IDs even when a new account signs in before cleanup runs", async () => {
  const f = fixture();
  await f.scheduler.restore();
  f.scheduler.setOwner(null);
  f.scheduler.setOwner("synthetic-b");
  f.load.mockRejectedValueOnce(new Error("offline"));
  await expect(f.scheduler.restore()).rejects.toThrow("offline");
  expect(f.pending().map(n => n.id)).toEqual([9000]);
});

test("serialized restores finish with the latest queued settings", async () => {
  const f = fixture();
  await Promise.all([
    f.scheduler.sync(slots),
    f.scheduler.sync(slots.map(s => ({ ...s, time: "09:30" }))),
  ]);
  expect(f.pending().filter(n => n.id !== 9000).every(n =>
    n.schedule?.on?.hour === 9 && n.schedule?.on?.minute === 30)).toBe(true);
});
