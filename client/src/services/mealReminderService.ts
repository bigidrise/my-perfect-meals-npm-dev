import { Capacitor } from "@capacitor/core";

export interface MealReminderSchedule {
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
}

const STORAGE_KEY = "meal_reminder_schedule";
const NOTIFICATION_IDS = {
  breakfast: 1001,
  lunch: 1002,
  dinner: 1003,
};

const DEFAULT_SCHEDULE: MealReminderSchedule = {
  enabled: false,
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "18:00",
};

let LocalNotificationsModule: any = null;
let PreferencesModule: any = null;

async function getPlugins() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    if (!PreferencesModule) {
      const pref = await import("@capacitor/preferences");
      PreferencesModule = pref.Preferences;
    }

    if (!LocalNotificationsModule) {
      const mod = await import("@capacitor/local-notifications");
      LocalNotificationsModule = mod.LocalNotifications;
    }

    return {
      Preferences: PreferencesModule,
      LocalNotifications: LocalNotificationsModule,
    };
  } catch (e) {
    console.warn("Capacitor plugins unavailable:", e);
    return null;
  }
}

/* ---------------- LOAD & SAVE ---------------- */

export async function loadReminderSchedule(): Promise<MealReminderSchedule> {
  const plugins = await getPlugins();
  if (!plugins) return DEFAULT_SCHEDULE;

  try {
    const { value } = await plugins.Preferences.get({ key: STORAGE_KEY });
    if (value) {
      return { ...DEFAULT_SCHEDULE, ...JSON.parse(value) };
    }
  } catch (e) {
    console.error("Failed to load reminder schedule:", e);
  }

  return DEFAULT_SCHEDULE;
}

export async function saveReminderSchedule(
  schedule: MealReminderSchedule,
): Promise<void> {
  const plugins = await getPlugins();
  if (!plugins) return;

  try {
    await plugins.Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(schedule),
    });
  } catch (e) {
    console.error("Failed to save reminder schedule:", e);
  }
}

/* ---------------- PERMISSIONS ---------------- */

export async function requestNotificationPermission(): Promise<boolean> {
  const plugins = await getPlugins();
  if (!plugins) return false;

  try {
    const perm = await plugins.LocalNotifications.checkPermissions();
    if (perm.display === "granted") return true;

    const request = await plugins.LocalNotifications.requestPermissions();
    return request.display === "granted";
  } catch (e) {
    console.error("Permission request failed:", e);
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  const plugins = await getPlugins();
  if (!plugins) return false;

  try {
    const perm = await plugins.LocalNotifications.checkPermissions();
    return perm.display === "granted";
  } catch {
    return false;
  }
}

/* ---------------- SCHEDULING ---------------- */

function parseTime(timeStr: string) {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}

export async function scheduleReminders(
  schedule: MealReminderSchedule,
): Promise<void> {
  const plugins = await getPlugins();
  if (!plugins) {
    console.log("Reminders only work on native platforms");
    return;
  }

  await cancelAllReminders();

  if (!schedule.enabled) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted");
    return;
  }

  const notifications = [];

  const meals = [
    {
      key: "breakfast",
      time: schedule.breakfast,
      title: "Time for breakfast!",
    },
    { key: "lunch", time: schedule.lunch, title: "Time for lunch!" },
    { key: "dinner", time: schedule.dinner, title: "Time for dinner!" },
  ] as const;

  for (const meal of meals) {
    const { hour, minute } = parseTime(meal.time);

    notifications.push({
      id: NOTIFICATION_IDS[meal.key],
      title: meal.title,
      body: "Open Planner to see what's next",
      schedule: {
        on: { hour, minute },
        repeats: true,
        allowWhileIdle: true,
      },
      sound: "default",
      extra: { route: "/planner" },
    });
  }

  try {
    await plugins.LocalNotifications.schedule({ notifications });
    console.log("Scheduled reminders:", notifications.length);
  } catch (e) {
    console.error("Failed to schedule reminders:", e);
  }
}

export async function cancelAllReminders(): Promise<void> {
  const plugins = await getPlugins();
  if (!plugins) return;

  try {
    const pending = await plugins.LocalNotifications.getPending();

    if (pending.notifications.length > 0) {
      await plugins.LocalNotifications.cancel({
        notifications: pending.notifications.map((n: { id: number }) => ({
          id: n.id,
        })),
      });

      console.log("Cancelled all reminders");
    }
  } catch (e) {
    console.error("Failed to cancel reminders:", e);
  }
}

/* ---------------- LISTENERS ---------------- */

export function setupNotificationListeners(
  navigate: (path: string) => void,
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let cleanup: (() => void) | null = null;

  getPlugins().then((plugins) => {
    if (!plugins) return;

    plugins.LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (notification: { notification: { extra?: { route?: string } } }) => {
        const route = notification.notification.extra?.route;
        if (route) navigate(route);
      },
    ).then((listener: { remove: () => void }) => {
      cleanup = () => listener.remove();
    });
  });

  return () => {
    if (cleanup) cleanup();
  };
}
