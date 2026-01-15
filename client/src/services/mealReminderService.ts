import { LocalNotifications, ScheduleOptions } from "@capacitor/local-notifications";
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
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display === "granted") {
      return true;
    }

    const request = await LocalNotifications.requestPermissions();
    return request.display === "granted";
  } catch (e) {
    console.error("Failed to request notification permission:", e);
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
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
  if (!Capacitor.isNativePlatform()) {
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

  const notifications: ScheduleOptions["notifications"] = [];

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
    await LocalNotifications.schedule({ notifications });
    console.log("Scheduled meal reminders:", notifications.length);
  } catch (e) {
    console.error("Failed to schedule reminders:", e);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
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

  const listener = LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (notification) => {
      const route = notification.notification.extra?.route;
      if (route) {
        navigate(route);
      }
    }
  );

  return () => {
    listener.then((l) => l.remove());
  };
}
