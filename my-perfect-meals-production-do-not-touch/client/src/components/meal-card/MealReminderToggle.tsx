import { useState } from "react";
import { useUpdateMealNotifications } from "@/hooks/useNotifications";

export default function MealReminderToggle({ mealId, initialEnabled, initialLead }: {
  mealId: string;
  initialEnabled?: boolean | null;
  initialLead?: number | null;
}) {
  const mutation = useUpdateMealNotifications(mealId);
  const [enabled, setEnabled] = useState<boolean>(!!initialEnabled);
  const [lead, setLead] = useState<number>(initialLead ?? 0);

  const save = async (nextEnabled = enabled, nextLead = lead) => {
    await mutation.mutateAsync({
      enabled: nextEnabled,
      leadTimeMinutes: nextLead || null,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className={`w-10 h-6 rounded-full ${enabled ? "bg-green-500" : "bg-gray-300"} relative`}
        onClick={async () => {
          const v = !enabled;
          setEnabled(v);
          await save(v, lead);
        }}
        aria-label="toggle meal reminder"
      >
        <span className={`absolute top-0.5 ${enabled ? "right-0.5" : "left-0.5"} w-5 h-5 bg-white rounded-full transition-all`} />
      </button>

      <select
        value={lead}
        onChange={async (e) => {
          const v = parseInt(e.target.value);
          setLead(v);
          await save(enabled, v);
        }}
        className="border rounded-lg p-1 text-sm bg-background"
        title="Lead time"
      >
        <option value={0}>Inherit</option>
        {[10,20,30,45,60].map(m => <option key={m} value={m}>{m}m</option>)}
      </select>
    </div>
  );
}