import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetUserNotifications, useUpdateUserNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";

export default function OnboardingMealReminders() {
  // Replace with your actual auth/user context
  const userId = "demo-user"; 
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetUserNotifications(userId);
  const update = useUpdateUserNotifications(userId);

  const [enabled, setEnabled] = useState(false);
  const [lead, setLead] = useState(30);

  useEffect(() => {
    if (data) {
      setEnabled(!!data.enabled);
      setLead(data.defaultLeadTimeMinutes ?? 30);
    }
  }, [data]);

  const onSave = async () => {
    await update.mutateAsync({
      enabled,
      defaultLeadTimeMinutes: lead,
    });
    navigate("/onboarding/next"); // TODO: set your real next route
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">Meal Reminders</h1>
      <p className="text-sm opacity-80 mb-4">Turn on reminders so we nudge you before meals.</p>

      {isLoading ? (
        <div>Loading…</div>
      ) : (
        <>
          <div className="flex items-center justify-between border rounded-xl p-3 mb-3">
            <div>
              <div className="font-medium">Enable meal reminders</div>
              <div className="text-xs opacity-70">You can change this anytime in Settings.</div>
            </div>
            <button
              className={`w-12 h-7 rounded-full ${enabled ? "bg-green-500" : "bg-gray-300"} relative`}
              onClick={() => setEnabled(v => !v)}
              aria-label="toggle reminders"
            >
              <span
                className={`absolute top-0.5 ${enabled ? "right-0.5" : "left-0.5"} w-6 h-6 bg-white rounded-full transition-all`}
              />
            </button>
          </div>

          <label className="text-sm mb-1 block">Lead time (minutes before meal)</label>
          <select
            value={lead}
            onChange={(e) => setLead(parseInt(e.target.value))}
            className="w-full border rounded-xl p-2 mb-6 bg-background"
          >
            {[10, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}
          </select>

          <Button onClick={onSave} disabled={update.isPending} className="w-full">
            {update.isPending ? "Saving…" : "Save & Continue"}
          </Button>
        </>
      )}
    </div>
  );
}