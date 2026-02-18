import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

export interface MealReminderSchedule {
  enabled: boolean;
  breakfast: string; // "08:00" format
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

async function getLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return null;
  
  if (!LocalNotificationsModule) {
    try {
      const mod = await import("@capacitor/local-notifications");
      LocalNotificationsModule = mod.LocalNotifications;
    } catch (e) {
      console.error("Failed to load LocalNotifications module:", e);
      return null;
    }
  }
  
  return LocalNotificationsModule;
}

export async function loadReminderSchedule(): Promise<MealReminderSchedule> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      return { ...DEFAULT_SCHEDULE, ...JSON.parse(value) };
    }
  } catch (e) {
    console.error("Failed to load reminder schedule:", e);
  }
  return DEFAULT_SCHEDULE;
}

export async function saveReminderSchedule(schedule: MealReminderSchedule): Promise<void> {
  try {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(schedule),
    });
  } catch (e) {
    console.error("Failed to save reminder schedule:", e);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const LN = await getLocalNotifications();
  if (!LN) return false;

  try {
    const permission = await LN.checkPermissions();
    if (permission.display === "granted") {
      return true;
    }

    const request = await LN.requestPermissions();
    return request.display === "granted";
  } catch (e) {
    console.error("Failed to request notification permission:", e);
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  const LN = await getLocalNotifications();
  if (!LN) return false;

  try {
    const permission = await LN.checkPermissions();
    return permission.display === "granted";
  } catch (e) {
    return false;
  }
}

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}

export async function scheduleReminders(schedule: MealReminderSchedule): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) {
    console.log("Reminders only work on native platforms");
    return;
  }

  await cancelAllReminders();

  if (!schedule.enabled) {
    return;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted");
    return;
  }

  const notifications: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { on: { hour: number; minute: number }; repeats: boolean; allowWhileIdle: boolean };
    sound: string;
    extra: { route: string };
  }> = [];

  const meals: Array<{ key: keyof typeof NOTIFICATION_IDS; time: string; title: string }> = [
    { key: "breakfast", time: schedule.breakfast, title: "Time for breakfast!" },
    { key: "lunch", time: schedule.lunch, title: "Time for lunch!" },
    { key: "dinner", time: schedule.dinner, title: "Time for dinner!" },
  ];

  for (const meal of meals) {
    const { hour, minute } = parseTime(meal.time);

    notifications.push({
      id: NOTIFICATION_IDS[meal.key],
      title: meal.title,
      body: "Open Planner to see what's next",
      schedule: {
        on: {
          hour,
          minute,
        },
        repeats: true,
        allowWhileIdle: true,
      },
      sound: "default",
      extra: {
        route: "/planner",
      },
    });
  }

  try {
    await LN.schedule({ notifications });
    console.log("Scheduled meal reminders:", notifications.length);
  } catch (e) {
    console.error("Failed to schedule reminders:", e);
  }
}

export async function cancelAllReminders(): Promise<void> {
  const LN = await getLocalNotifications();
  if (!LN) return;

  try {
    const pending = await LN.getPending();
    if (pending.notifications.length > 0) {
      await LN.cancel({
        notifications: pending.notifications.map((n: { id: number }) => ({ id: n.id })),
      });
      console.log("Cancelled all meal reminders");
    }
  } catch (e) {
    console.error("Failed to cancel reminders:", e);
  }
}

export function setupNotificationListeners(navigate: (path: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let cleanup: (() => void) | null = null;

  getLocalNotifications().then((LN) => {
    if (!LN) return;

    const listener = LN.addListener(
      "localNotificationActionPerformed",
      (notification: { notification: { extra?: { route?: string } } }) => {
        const route = notification.notification.extra?.route;
        if (route) {
          navigate(route);
        }
      }
    );

    listener.then((l: { remove: () => void }) => {
      cleanup = () => l.remove();
    });
  });

  return () => {
    if (cleanup) cleanup();
  };
}
