import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Bell, BellOff } from "lucide-react";

export function MealReminderStatus() {
  const [nextReminder, setNextReminder] = useState<{
    slot: string;
    time: string;
    enabled: boolean;
  } | null>(null);
  
  const [todayReminders, setTodayReminders] = useState({
    breakfast: { enabled: true, time: "08:00" },
    lunch: { enabled: true, time: "12:00" },
    dinner: { enabled: true, time: "18:00" }
  });

  useEffect(() => {
    // Find next upcoming reminder
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    for (const [slot, reminder] of Object.entries(todayReminders)) {
      if (reminder.enabled) {
        const reminderTime = new Date(`${today}T${reminder.time}:00`);
        if (reminderTime > now) {
          setNextReminder({
            slot: slot.charAt(0).toUpperCase() + slot.slice(1),
            time: reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            enabled: true
          });
          break;
        }
      }
    }
  }, [todayReminders]);

  const toggleTodayReminders = () => {
    setTodayReminders(prev => ({
      breakfast: { ...prev.breakfast, enabled: !prev.breakfast.enabled },
      lunch: { ...prev.lunch, enabled: !prev.lunch.enabled },
      dinner: { ...prev.dinner, enabled: !prev.dinner.enabled }
    }));
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Meal Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextReminder ? (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Next: {nextReminder.slot}</span>
            </div>
            <Badge variant="secondary">{nextReminder.time}</Badge>
          </div>
        ) : (
          <div className="text-center text-muted-foreground text-sm py-2">
            No more reminders today
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Today's Schedule</h4>
          {Object.entries(todayReminders).map(([slot, reminder]) => (
            <div key={slot} className="flex items-center justify-between text-sm">
              <span className="capitalize">{slot}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{reminder.time}</span>
                {reminder.enabled ? (
                  <Bell className="h-3 w-3 text-green-600" />
                ) : (
                  <BellOff className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleTodayReminders}
          className="w-full"
        >
          {todayReminders.breakfast.enabled ? "Turn Off Today" : "Turn On Today"}
        </Button>
      </CardContent>
    </Card>
  );
}