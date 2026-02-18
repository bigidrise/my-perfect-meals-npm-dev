import { useState, useEffect } from "react";
import { Bell, Clock, AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { PillButton } from "@/components/ui/pill-button";

const STORAGE_KEY = "meal_reminder_schedule_v2";
const NOTIFICATION_IDS = {
  breakfast: 2001,
  lunch: 2002,
  dinner: 2003,
};

interface ReminderSchedule {
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
}

const DEFAULT_SCHEDULE: ReminderSchedule = {
  enabled: false,
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "18:00",
};

export default function IOSMealReminders() {
  const [schedule, setSchedule] = useState<ReminderSchedule>(DEFAULT_SCHEDULE);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) {
      setReady(true);
      return;
    }

    async function init() {
      try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        if (value) {
          setSchedule({ ...DEFAULT_SCHEDULE, ...JSON.parse(value) });
        }

        const perm = await LocalNotifications.checkPermissions();
        setPermissionStatus(perm.display === "granted" ? "granted" : "denied");
      } catch (e) {
        setError("Failed to initialize reminders");
        console.error("IOSMealReminders init error:", e);
      } finally {
        setReady(true);
      }
    }

    init();
  }, [isNative]);

  const saveSchedule = async (newSchedule: ReminderSchedule) => {
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(newSchedule),
    });
    setSchedule(newSchedule);
  };

  const scheduleNotifications = async (sched: ReminderSchedule) => {
    await LocalNotifications.cancel({
      notifications: Object.values(NOTIFICATION_IDS).map((id) => ({ id })),
    });

    if (!sched.enabled) return;

    const meals: Array<{ key: keyof typeof NOTIFICATION_IDS; time: string; title: string }> = [
      { key: "breakfast", time: sched.breakfast, title: "Time for breakfast!" },
      { key: "lunch", time: sched.lunch, title: "Time for lunch!" },
      { key: "dinner", time: sched.dinner, title: "Time for dinner!" },
    ];

    const notifications = meals.map((meal) => {
      const [hour, minute] = meal.time.split(":").map(Number);
      return {
        id: NOTIFICATION_IDS[meal.key],
        title: "🍽️ " + meal.title,
        body: "Open My Perfect Meals to see what's next",
        schedule: {
          on: { hour, minute },
          repeats: true,
          allowWhileIdle: true,
        },
        sound: "default",
        smallIcon: "ic_stat_icon_config_sample",
        iconColor: "#F97316",
        extra: { route: "/planner" },
      };
    });

    await LocalNotifications.schedule({ notifications });
  };

  const handleToggle = async () => {
    setError(null);

    if (!schedule.enabled) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const request = await LocalNotifications.requestPermissions();
        if (request.display !== "granted") {
          setPermissionStatus("denied");
          setError("Go to iPhone Settings > My Perfect Meals > Allow Notifications");
          return;
        }
      }
      setPermissionStatus("granted");
    }

    const newSchedule = { ...schedule, enabled: !schedule.enabled };
    await saveSchedule(newSchedule);
    await scheduleNotifications(newSchedule);
  };

  const handleTimeChange = async (meal: "breakfast" | "lunch" | "dinner", time: string) => {
    const newSchedule = { ...schedule, [meal]: time };
    await saveSchedule(newSchedule);
    if (newSchedule.enabled) {
      await scheduleNotifications(newSchedule);
    }
  };

  if (!isNative) {
    return (
      <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="text-white text-sm font-medium">Meal Reminders</span>
          <span className="text-gray-500 text-xs ml-auto">iOS App Only</span>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-orange-400 animate-pulse" />
          <span className="text-white text-sm font-medium">Loading Reminders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-orange-400" />
          <span className="text-white text-sm font-medium">Meal Reminders</span>
        </div>
        <PillButton active={schedule.enabled} onClick={handleToggle}>
          {schedule.enabled ? "On" : "Off"}
        </PillButton>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/20 border border-red-500/40 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-red-200 text-xs">{error}</span>
        </div>
      )}

      {permissionStatus === "denied" && !schedule.enabled && (
        <div className="flex items-start gap-2 bg-amber-500/20 border border-amber-500/40 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <span className="text-amber-200 text-xs">
            Notifications are disabled. Enable in iPhone Settings to use reminders.
          </span>
        </div>
      )}

      {schedule.enabled && (
        <div className="space-y-3 pt-2 border-t border-white/10">
          {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
            <div key={meal} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-white text-sm capitalize">{meal}</span>
              </div>
              <input
                type="time"
                value={schedule[meal]}
                onChange={(e) => handleTimeChange(meal, e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ))}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
            <p className="text-amber-200 text-xs leading-relaxed">
              <span className="font-semibold">Volume too low?</span> Go to iPhone Settings → Sounds & Haptics → turn up "Ringer and Alerts". Also check Settings → Notifications → My Perfect Meals → ensure "Sounds" is ON.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
