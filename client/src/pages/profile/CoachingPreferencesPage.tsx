import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Sparkles, ChevronLeft, Loader2 } from "lucide-react";

const STYLES = [
  {
    value: "supportive",
    label: "Supportive",
    description: "Gentle observations, low frequency, emphasis on encouragement",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Regular check-ins when patterns shift — the default experience",
  },
  {
    value: "high_accountability",
    label: "High Accountability",
    description: "More frequent nudges, tighter thresholds, direct language",
  },
] as const;

const FREQUENCIES = [
  {
    value: "light",
    label: "Light",
    description: "Only surface insights when something is clearly off",
  },
  {
    value: "regular",
    label: "Regular",
    description: "Daily check-in if a pattern is detected",
  },
  {
    value: "persistent",
    label: "Persistent",
    description: "Alert me even for small deviations — I want full visibility",
  },
] as const;

const FOCUS_AREAS = [
  "Meal compliance",
  "Weight consistency",
  "Grocery guidance",
  "Emotional eating",
  "Workout adherence",
] as const;

type CoachingStyle = typeof STYLES[number]["value"];
type FrequencyOption = typeof FREQUENCIES[number]["value"];

interface CoachingPrefs {
  style: CoachingStyle;
  frequency: FrequencyOption;
  focusAreas: string[];
}

const DEFAULTS: CoachingPrefs = {
  style: "balanced",
  frequency: "regular",
  focusAreas: [],
};

export default function CoachingPreferencesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<CoachingPrefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load existing prefs
  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/users/${user.id}/app-preferences`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (data?.coaching) {
          setPrefs({ ...DEFAULTS, ...data.coaching });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user?.id]);

  const toggleFocusArea = (area: string) => {
    setPrefs((p) => ({
      ...p,
      focusAreas: p.focusAreas.includes(area)
        ? p.focusAreas.filter((a) => a !== area)
        : [...p.focusAreas, area],
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/users/${user.id}/app-preferences`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ coaching: prefs }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Coaching preferences saved", description: "Your AI coach will adjust accordingly." });
    } catch {
      toast({ title: "Couldn't save preferences", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-orange-950/10 to-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/dashboard")}
          className="p-1.5 rounded-lg bg-white/5 text-white/60 active:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <h1 className="text-base font-bold text-white">AI Coaching Preferences</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Intro */}
        <div className="rounded-xl border border-orange-700/20 bg-orange-950/20 px-4 py-3">
          <p className="text-xs text-white/60 leading-relaxed">
            Your AI coach adapts to your habits — quietly observing patterns and offering guidance when it matters. 
            These settings let you control how much, how often, and what it pays attention to.
          </p>
        </div>

        {/* Coaching Style */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Coaching Style</h2>
            <p className="text-xs text-white/40 mt-0.5">How your coach communicates with you</p>
          </div>
          <div className="space-y-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => setPrefs((p) => ({ ...p, style: s.value }))}
                className={[
                  "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                  prefs.style === s.value
                    ? "border-orange-500/50 bg-orange-950/40"
                    : "border-white/10 bg-white/5 active:bg-white/10",
                ].join(" ")}
              >
                <p className={["text-sm font-semibold", prefs.style === s.value ? "text-orange-300" : "text-white"].join(" ")}>
                  {s.label}
                </p>
                <p className="text-xs text-white/50 mt-0.5">{s.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Focus Areas */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Focus Areas</h2>
            <p className="text-xs text-white/40 mt-0.5">What your coach pays closest attention to — leave blank to let it decide</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => (
              <PillButton
                key={area}
                active={prefs.focusAreas.includes(area)}
                onClick={() => toggleFocusArea(area)}
              >
                {area}
              </PillButton>
            ))}
          </div>
        </section>

        {/* Frequency */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Check-In Frequency</h2>
            <p className="text-xs text-white/40 mt-0.5">How often your coach surfaces insights</p>
          </div>
          <div className="space-y-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                onClick={() => setPrefs((p) => ({ ...p, frequency: f.value }))}
                className={[
                  "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                  prefs.frequency === f.value
                    ? "border-orange-500/50 bg-orange-950/40"
                    : "border-white/10 bg-white/5 active:bg-white/10",
                ].join(" ")}
              >
                <p className={["text-sm font-semibold", prefs.frequency === f.value ? "text-orange-300" : "text-white"].join(" ")}>
                  {f.label}
                </p>
                <p className="text-xs text-white/50 mt-0.5">{f.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-orange-600 text-white font-semibold text-sm py-3.5 active:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
