import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Clock, ExternalLink } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NativeSettings, IOSSettings } from "capacitor-native-settings";
import {
  loadReminderSchedule,
  saveReminderSchedule,
  scheduleReminders,
  requestNotificationPermission,
  checkNotificationPermission,
  MealReminderSchedule,
} from "@/services/mealReminderService";
import { useToast } from "@/hooks/use-toast";

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function TimePicker({ label, value, onChange, disabled }: TimePickerProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-b-0">
      <div className="flex items-center gap-3">
        <Clock className="w-4 h-4 text-orange-400" />
        <span className="text-white text-sm">{label}</span>
      </div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
      />
    </div>
  );
}

export default function MealReminders() {
  const [schedule, setSchedule] = useState<MealReminderSchedule>({
    enabled: false,
    breakfast: "08:00",
    lunch: "13:00",
    dinner: "18:00",
  });
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const { toast } = useToast();

  const isNative = Capacitor.isNativePlatform();

  const openAppSettings = async () => {
    try {
      // iOS: opens the app's settings page directly (Apple-approved)
      await NativeSettings.openIOS({ option: IOSSettings.App });
    } catch (err) {
      console.error("Failed to open settings:", err);
    }
  };

  useEffect(() => {
    async function init() {
      const saved = await loadReminderSchedule();
      setSchedule(saved);
      if (isNative) {
        const perm = await checkNotificationPermission();
        setHasPermission(perm);
      }
      setLoading(false);
    }
    init();
  }, [isNative]);

  const handleToggle = async (enabled: boolean) => {
    if (enabled && isNative) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast({
          title: "Permission Required",
          description: "Enable notifications in Settings to get meal reminders.",
          variant: "destructive",
        });
        return;
      }
      setHasPermission(true);
    }

    const newSchedule = { ...schedule, enabled };
    setSchedule(newSchedule);
    await saveReminderSchedule(newSchedule);
    await scheduleReminders(newSchedule);

    toast({
      title: enabled ? "Reminders Enabled" : "Reminders Disabled",
      description: enabled
        ? "You'll get notifications at your scheduled meal times."
        : "Meal reminders have been turned off.",
    });
  };

  const handleTimeChange = async (meal: "breakfast" | "lunch" | "dinner", time: string) => {
    const newSchedule = { ...schedule, [meal]: time };
    setSchedule(newSchedule);
    await saveReminderSchedule(newSchedule);
    if (newSchedule.enabled) {
      await scheduleReminders(newSchedule);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-2xl p-4 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-white/10 rounded mb-2"></div>
        <div className="h-10 bg-white/10 rounded mb-2"></div>
        <div className="h-10 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (!isNative) {
    return (
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <BellOff className="w-5 h-5 text-gray-400" />
          <h3 className="text-white font-semibold">Meal Reminders</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Meal reminders are available on the iOS app. Download from the App Store to enable notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-orange-400" />
          <h3 className="text-white font-semibold">Meal Reminders</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="reminder-toggle" className="text-sm text-gray-400">
            {schedule.enabled ? "On" : "Off"}
          </Label>
          <Switch
            id="reminder-toggle"
            checked={schedule.enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      {schedule.enabled && (
        <p className="text-gray-400 text-xs mb-4">
          You'll receive a notification at each time to remind you to eat.
        </p>
      )}

      <div className={schedule.enabled ? "opacity-100" : "opacity-50"}>
        <TimePicker
          label="Breakfast"
          value={schedule.breakfast}
          onChange={(time) => handleTimeChange("breakfast", time)}
          disabled={!schedule.enabled}
        />
        <TimePicker
          label="Lunch"
          value={schedule.lunch}
          onChange={(time) => handleTimeChange("lunch", time)}
          disabled={!schedule.enabled}
        />
        <TimePicker
          label="Dinner"
          value={schedule.dinner}
          onChange={(time) => handleTimeChange("dinner", time)}
          disabled={!schedule.enabled}
        />
      </div>

      {!hasPermission && (
        <button
          onClick={openAppSettings}
          className="flex items-center gap-2 text-orange-400 text-xs mt-3 hover:text-orange-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Open Settings to enable notifications</span>
        </button>
      )}
    </div>
  );
}
