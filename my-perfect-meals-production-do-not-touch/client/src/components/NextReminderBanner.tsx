import React, { useEffect, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Clock, BellOff } from "lucide-react";

interface NextReminderData {
  time: string;
  slot: string;
}

export default function NextReminderBanner({ userId }: { userId: string }) {
  const [next, setNext] = useState<NextReminderData | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchNextReminder();
  }, [userId]);

  const fetchNextReminder = async () => {
    try {
      const response = await fetch(apiUrl(`/api/notify/next?userId=${userId}`));
      if (response.ok) {
        const data = await response.json();
        setNext(data);
      }
    } catch (error) {
      console.error("Failed to fetch next reminder:", error);
    }
  };

  const turnOffToday = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl("/api/notify/disable-today"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setIsDisabled(true);
        setNext(null);
      }
    } catch (error) {
      console.error("Failed to disable reminders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isDisabled || !next) return null;

  const reminderTime = new Date(next.time);
  const timeString = reminderTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="rounded-lg border p-4 flex items-center justify-between bg-amber-50 dark:bg-amber-950">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-amber-600" />
        <div>
          <div className="text-sm font-medium">
            Next reminder: <strong>{next.slot}</strong> at <strong>{timeString}</strong>
          </div>
          <div className="text-xs text-muted-foreground">
            You'll receive a push notification with action buttons
          </div>
        </div>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={turnOffToday}
        disabled={isLoading}
        className="gap-2"
      >
        <BellOff className="h-4 w-4" />
        {isLoading ? "Disabling..." : "Turn off today"}
      </Button>
    </div>
  );
}