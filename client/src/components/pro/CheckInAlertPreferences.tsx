// client/src/components/pro/CheckInAlertPreferences.tsx
// Settings panel for coaches/physicians to configure when they get check-in alerts.
// Embedded in ProClients.tsx behind the Bell icon.

import { useState, useEffect } from "react";
import { Bell, X, Check } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { useToast } from "@/hooks/use-toast";

const INTERVALS = [
  { key: "2h",  label: "2 hours before" },
  { key: "24h", label: "24 hours before" },
  { key: "48h", label: "48 hours before" },
  { key: "1w",  label: "1 week before" },
] as const;

type IntervalKey = typeof INTERVALS[number]["key"];

export default function CheckInAlertPreferences() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<IntervalKey>>(new Set(["24h", "1w"]));
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(apiUrl("/api/check-in-schedules/prefs"), {
      headers: getAuthHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.prefs) {
          setSelected(new Set(data.prefs.intervals ?? ["24h", "1w"]));
          setEnabled(data.prefs.enabled !== false);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  const toggle = (key: IntervalKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/check-in-schedules/prefs"), {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ intervals: Array.from(selected), enabled }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Saved", description: "Check-in alert preferences updated." });
      setOpen(false);
    } catch {
      toast({ title: "Error", description: "Could not save preferences.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-white/15 text-sm transition-colors"
        title="Check-in alert preferences"
      >
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">Alerts</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-white/15 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-400" />
                <h2 className="text-white font-semibold text-base">Check-in Alert Settings</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-white/60 mb-4">
              Choose when you (and your client) receive reminders about upcoming check-ins.
            </p>

            {/* Master toggle */}
            <div className="flex items-center justify-between mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-sm text-white/80">Alerts enabled</span>
              <button
                onClick={() => setEnabled((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? "bg-green-500" : "bg-white/20"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Interval checkboxes */}
            <div className="space-y-2 mb-6">
              {INTERVALS.map(({ key, label }) => {
                const isOn = selected.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggle(key)}
                    disabled={!enabled}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                      isOn && enabled
                        ? "bg-amber-500/15 border-amber-400/40 text-amber-300"
                        : "bg-white/5 border-white/10 text-white/50"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <span>{label}</span>
                    {isOn && enabled && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
