import { useState, useEffect } from "react";
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
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-b-0">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-white text-xs">{label}</span>
      </div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
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

  const handleToggle = async () => {
    const enabled = !schedule.enabled;
    
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
      <div className="bg-white/5 rounded-xl p-3 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-1/2"></div>
      </div>
    );
  }

  if (!isNative) {
    return (
      <div className="bg-white/5 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <BellOff className="w-4 h-4 text-gray-400" />
          <span className="text-white text-sm font-medium">Meal Reminders</span>
          <span className="text-gray-500 text-xs ml-auto">iOS only</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-orange-400" />
          <span className="text-white text-sm font-medium">Meal Reminders</span>
        </div>
        <button
          onClick={handleToggle}
          aria-pressed={schedule.enabled}
          aria-label={`Meal reminders ${schedule.enabled ? "on" : "off"}`}
          className={`
            inline-flex items-center justify-center
            px-4 py-1 min-w-[44px] rounded-full
            text-xs font-semibold uppercase tracking-wide
            transition-all duration-150 ease-out
            ${schedule.enabled
              ? "bg-emerald-600/80 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] border border-emerald-400/40"
              : "bg-amber-500/20 text-amber-200 shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:bg-amber-500/30 border border-amber-400/40"
            }
          `}
        >
          {schedule.enabled ? "On" : "Off"}
        </button>
      </div>

      {schedule.enabled && (
        <div className="mt-3 pt-2 border-t border-white/10">
          <TimePicker
            label="Breakfast"
            value={schedule.breakfast}
            onChange={(time) => handleTimeChange("breakfast", time)}
          />
          <TimePicker
            label="Lunch"
            value={schedule.lunch}
            onChange={(time) => handleTimeChange("lunch", time)}
          />
          <TimePicker
            label="Dinner"
            value={schedule.dinner}
            onChange={(time) => handleTimeChange("dinner", time)}
          />
        </div>
      )}

      {!hasPermission && (
        <button
          onClick={openAppSettings}
          className="flex items-center gap-1.5 text-orange-400 text-xs mt-2 hover:text-orange-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Open Settings to enable notifications</span>
        </button>
      )}
    </div>
  );
}
