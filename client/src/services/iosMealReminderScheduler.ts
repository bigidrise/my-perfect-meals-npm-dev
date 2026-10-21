import type { LocalNotificationsPlugin, LocalNotificationSchema } from "@capacitor/local-notifications";

export interface ReminderSlot {
  id?: string;
  label: string;
  time: string;
  enabled: boolean;
}

export interface IOSReminderStatus {
  state: "idle" | "checking" | "scheduled" | "off" | "blocked" | "error";
  count: number;
  session: number;
}

const managedId = (id: number) =>
  (id >= 2000 && id <= 2005) || (id >= 1001 && id <= 1003);

/** One serialized, account-bound mirror of saved settings. No web push or DB writes. */
export function createIOSMealReminderScheduler(deps: {
  plugin: () => Promise<LocalNotificationsPlugin | null>;
  load: () => Promise<ReminderSlot[]>;
}) {
  let owner: string | null = null;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let status: IOSReminderStatus = { state: "idle", count: 0, session: 0 };
  const listeners = new Set<() => void>();
  const publish = (state: IOSReminderStatus["state"], count = 0) => {
    status = { state, count, session: generation };
    listeners.forEach(listener => listener());
  };
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };

  function reconcile(load: () => Promise<ReminderSlot[]>) {
    const token = generation;
    const account = owner;
    const current = () => token === generation && account === owner;
    return enqueue(async () => {
      if (!current()) return;
      publish("checking");
      try {
        const slots = account ? await load() : [];
        if (!current()) return;
        if (slots.length > 6 || slots.some(slot =>
          typeof slot.label !== "string" || typeof slot.enabled !== "boolean" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time))) {
          throw new Error("Invalid saved reminder settings");
        }
        const plugin = await deps.plugin();
        if (!current()) return;
        if (!plugin) throw new Error("iPhone notification plugin unavailable");
        const desired: LocalNotificationSchema[] = slots.flatMap((slot, index) => {
          if (!slot.enabled) return [];
          const [hour, minute] = slot.time.split(":").map(Number);
          return [{
            id: 2000 + index,
            title: `🍽️ ${slot.label}`,
            body: `Time for ${slot.label}. Tap to open My Perfect Meals.`,
            schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
            sound: "default",
            extra: { route: "/hub", kind: "meal_reminder", owner: account },
          }];
        });
        if (desired.length) {
          const permission = await plugin.checkPermissions();
          if (!current()) return;
          if (permission.display !== "granted") {
            publish("blocked");
            return;
          }
        }
        const pending = (await plugin.getPending()).notifications;
        if (!current()) return;
        const matches = (actual: typeof pending[number], expected: LocalNotificationSchema) =>
          actual.id === expected.id && actual.title === expected.title &&
          actual.body === expected.body &&
          actual.extra?.kind === "meal_reminder" && actual.extra?.owner === account &&
          actual.schedule?.repeats === true &&
          actual.schedule?.on?.hour === expected.schedule?.on?.hour &&
          actual.schedule?.on?.minute === expected.schedule?.on?.minute;
        const updates = desired.filter(expected => !pending.some(actual => matches(actual, expected)));
        // Schedule missing/changed IDs first; Capacitor replaces the same ID.
        // Never cancel a working schedule before attempting its replacement.
        if (updates.length) {
          await plugin.schedule({ notifications: updates });
          if (!current()) return;
        }
        const verified = (await plugin.getPending()).notifications;
        if (!current()) return;
        if (!desired.every(expected => verified.some(actual => matches(actual, expected)))) {
          throw new Error("iPhone did not confirm the requested reminder schedule");
        }
        const obsolete = verified.filter(notification =>
          managedId(notification.id) && !desired.some(expected => expected.id === notification.id));
        if (obsolete.length) {
          await plugin.cancel({ notifications: obsolete.map(({ id }) => ({ id })) });
          if (!current()) return;
          const remaining = (await plugin.getPending()).notifications;
          if (!current()) return;
          if (remaining.some(notification => obsolete.some(old => old.id === notification.id))) {
            throw new Error("iPhone did not confirm removal of old meal reminders");
          }
        }
        publish(desired.length ? "scheduled" : "off", desired.length);
      } catch (error) {
        if (current()) publish("error");
        throw error;
      }
    });
  }

  return {
    getStatus: () => status,
    captureSession: () => {
      const token = generation;
      return () => owner !== null && token === generation;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setOwner(account: string | null) {
      owner = account;
      generation++;
      publish("idle");
      // This queued logout cleanup must run even if another account signs in
      // while it waits. It precedes that account's queued restoration.
      if (!account) {
        const token = generation;
        void enqueue(async () => {
          const plugin = await deps.plugin();
          if (!plugin) throw new Error("iPhone notification plugin unavailable");
          const pending = (await plugin.getPending()).notifications.filter(n => managedId(n.id));
          if (pending.length) await plugin.cancel({ notifications: pending.map(({ id }) => ({ id })) });
          if (token === generation) publish("off");
        }).catch(() => { if (token === generation) publish("error"); });
      }
    },
    restore: () => reconcile(deps.load),
    sync: (slots: ReminderSlot[]) => {
      if (!owner) return Promise.reject(new Error("No signed-in iPhone reminder session"));
      // Capture a snapshot so subsequent UI edits cannot mutate a queued job.
      const snapshot = slots.map(slot => ({ ...slot }));
      return reconcile(async () => snapshot);
    },
  };
}
