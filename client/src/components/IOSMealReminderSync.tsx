import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useAuth } from "@/contexts/AuthContext";
import { iosMealReminderScheduler, isIOSReminderDevice } from "@/services/mealReminderService";

/** Mounted once inside AuthProvider, independent of opening Profile settings. */
export default function IOSMealReminderSync() {
  const { user, loading } = useAuth();
  const owner = user?.id ?? null;
  useEffect(() => {
    if (!isIOSReminderDevice() || loading) return;
    iosMealReminderScheduler.setOwner(owner);
    if (!owner) return;
    let active = true;
    const restore = () => {
      if (!active) return;
      void iosMealReminderScheduler.restore().catch(error => {
        console.warn("[iOS reminders] Could not verify saved reminders:", error);
      });
    };
    const visible = () => {
      if (document.visibilityState === "visible") restore();
    };
    restore();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("mpm:ios-reminders-refresh", restore);
    const listener = App.addListener("appStateChange", state => {
      if (state.isActive) restore();
    }).catch(error => {
      console.warn("[iOS reminders] App resume listener unavailable:", error);
      return null;
    });
    return () => {
      active = false;
      iosMealReminderScheduler.setOwner(null);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("mpm:ios-reminders-refresh", restore);
      void listener.then(handle => handle?.remove()).catch(() => {});
    };
  }, [owner, loading]);
  return null;
}
