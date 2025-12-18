// --- NEW: client/src/pages/onboarding/ai-voice-journal.tsx ---
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

async function fetchPrefs() {
  const r = await fetch("/api/ai-voice-journal/prefs");
  return r.json();
}
async function savePrefs(payload: any) {
  const r = await fetch("/api/ai-voice-journal/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return r.json();
}

export default function AIVoiceJournalOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["ai-voice-journal-prefs"], queryFn: fetchPrefs });
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  const mutation = useMutation({ mutationFn: savePrefs, onSuccess: () => {
    toast({ title: "Saved" });
    setLocation("/onboarding/next");
  }});

  return (
    <div className="p-4 max-w-md mx-auto space-y-3">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>AI Voice & Journaling Setup</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <label>AI Voice Assistant</label>
            <Switch checked={!!form.voiceEnabled} onCheckedChange={(v) => setForm((f:any)=>({ ...f, voiceEnabled: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <label>Enable Daily Journaling</label>
            <Switch checked={!!form.journalingEnabled} onCheckedChange={(v) => setForm((f:any)=>({ ...f, journalingEnabled: v }))} />
          </div>
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <label>Daily Journal Reminder</label>
              <Switch checked={!!form.dailyJournalReminderEnabled} onCheckedChange={(v) => setForm((f:any)=>({ ...f, dailyJournalReminderEnabled: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={form.dailyJournalReminderTime || "09:00"} onChange={(e)=>setForm((f:any)=>({ ...f, dailyJournalReminderTime: e.target.value }))} />
              <Select value={form.dailyJournalReminderChannel || "sms"} onValueChange={(v)=>setForm((f:any)=>({ ...f, dailyJournalReminderChannel: v }))}>
                <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="in-app">In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving..." : "Save & Continue"}
      </Button>
    </div>
  );
}