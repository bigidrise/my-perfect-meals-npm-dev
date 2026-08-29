import { useEffect, useMemo, useState } from "react";
import { Droplets, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ClinicalDirective = {
  id: string;
  targetKind: "point" | "range" | "floor" | "ceiling";
  targetMl: number | null;
  minimumMl: number | null;
  maximumMl: number | null;
  reviewAt: string;
  expiresAt: string;
};

type AthleticGuidance = {
  id: string;
  trainingContext: string;
  emphasis: string[];
  reminderStrategy: string;
  beverageStrategy: string;
  athleteCreatorIntent: string;
  notes: string;
  startsOn: string;
  reviewOn: string;
};

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function ozToMl(value: string): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 29.5735) : null;
}

function mlToOz(value: number | null): string {
  return value ? String(Math.round(value / 29.5735)) : "";
}

export function ProHydrationControls({
  clientUserId,
  mode,
}: {
  clientUserId: string;
  mode: "clinical" | "trainer";
}) {
  const { toast } = useToast();
  const base = `/api/pro/clients/${encodeURIComponent(clientUserId)}`;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [directive, setDirective] = useState<ClinicalDirective | null>(null);
  const [guidance, setGuidance] = useState<AthleticGuidance | null>(null);
  const [targetKind, setTargetKind] = useState<ClinicalDirective["targetKind"]>("point");
  const [targetOz, setTargetOz] = useState("");
  const [minimumOz, setMinimumOz] = useState("");
  const [maximumOz, setMaximumOz] = useState("");
  const [reviewOn, setReviewOn] = useState(dateAfter(14));
  const [expiresOn, setExpiresOn] = useState(dateAfter(30));
  const [reason, setReason] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [consentReference, setConsentReference] = useState("");
  const [trainingContext, setTrainingContext] = useState("general_activity");
  const [emphasis, setEmphasis] = useState<string[]>(["before_training", "recovery"]);
  const [reminderStrategy, setReminderStrategy] = useState("");
  const [beverageStrategy, setBeverageStrategy] = useState("");
  const [athleteCreatorIntent, setAthleteCreatorIntent] = useState("");
  const [notes, setNotes] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));

  const endpoint = mode === "clinical"
    ? `${base}/hydration-directive`
    : `${base}/athletic-hydration-coaching`;

  useEffect(() => {
    setLoading(true);
    apiRequest(endpoint)
      .then((data) => {
        if (mode === "clinical") {
          const next = data?.directive ?? null;
          setDirective(next);
          if (next) {
            setTargetKind(next.targetKind);
            setTargetOz(mlToOz(next.targetMl));
            setMinimumOz(mlToOz(next.minimumMl));
            setMaximumOz(mlToOz(next.maximumMl));
            setReviewOn(next.reviewAt.slice(0, 10));
            setExpiresOn(next.expiresAt.slice(0, 10));
          }
        } else {
          const next = data?.guidance ?? null;
          setGuidance(next);
          if (next) {
            setTrainingContext(next.trainingContext);
            setEmphasis(next.emphasis);
            setReminderStrategy(next.reminderStrategy);
            setBeverageStrategy(next.beverageStrategy);
            setAthleteCreatorIntent(next.athleteCreatorIntent);
            setNotes(next.notes);
            setStartsOn(next.startsOn);
            setReviewOn(next.reviewOn);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [endpoint, mode]);

  const targetSummary = useMemo(() => {
    if (!directive) return null;
    if (directive.targetKind === "range") {
      return `${mlToOz(directive.minimumMl)}–${mlToOz(directive.maximumMl)} oz/day`;
    }
    if (directive.targetKind === "floor") return `At least ${mlToOz(directive.minimumMl)} oz/day`;
    if (directive.targetKind === "ceiling") return `Up to ${mlToOz(directive.maximumMl)} oz/day`;
    return `${mlToOz(directive.targetMl)} oz/day`;
  }, [directive]);

  async function saveClinical() {
    setSaving(true);
    try {
      const payload = {
        targetKind,
        targetMl: targetKind === "point" ? ozToMl(targetOz) : null,
        minimumMl: targetKind === "range" || targetKind === "floor" ? ozToMl(minimumOz) : null,
        maximumMl: targetKind === "range" || targetKind === "ceiling" ? ozToMl(maximumOz) : null,
        effectiveAt: new Date().toISOString(),
        reviewAt: new Date(`${reviewOn}T12:00:00.000Z`).toISOString(),
        expiresAt: new Date(`${expiresOn}T12:00:00.000Z`).toISOString(),
        reasonCode: reason,
        rationaleCode: reason,
        sourceReference,
        consentReference,
      };
      const result = await apiRequest(endpoint, { method: "PUT", body: JSON.stringify(payload) });
      setDirective(result.directive);
      toast({ title: "Hydration directive saved", description: "The measurable target is now available to Hydration and the Consistency Score." });
    } catch (error) {
      toast({ title: "Could not save directive", description: error instanceof Error ? error.message : "Check every required field.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveTrainer() {
    setSaving(true);
    try {
      const result = await apiRequest(endpoint, {
        method: "PUT",
        body: JSON.stringify({
          trainingContext,
          emphasis,
          reminderStrategy,
          beverageStrategy,
          athleteCreatorIntent,
          notes,
          startsOn,
          reviewOn,
        }),
      });
      setGuidance(result.guidance);
      toast({ title: "Athletic Hydration coaching saved", description: "Nonclinical guidance is available for this client." });
    } catch (error) {
      toast({ title: "Could not save coaching", description: error instanceof Error ? error.message : "Review the coaching boundary and try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrent() {
    const id = mode === "clinical" ? directive?.id : guidance?.id;
    if (!id) return;
    const url = mode === "clinical" ? `${endpoint}/${id}` : `${endpoint}/${id}`;
    await apiRequest(url, { method: "DELETE" });
    if (mode === "clinical") setDirective(null);
    else setGuidance(null);
    toast({ title: mode === "clinical" ? "Hydration directive removed" : "Athletic Hydration coaching removed" });
  }

  return (
    <Card className="border border-sky-400/25 bg-sky-500/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Droplets className="h-5 w-5 text-sky-300" />
          {mode === "clinical" ? "Clinical Hydration Directive" : "Athletic Hydration Coaching"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-white/55">Loading Hydration controls…</p>
        ) : mode === "clinical" ? (
          <>
            <p className="text-xs text-white/65">
              Establish a documented, time-bounded measurable target. This is the only professional control that can activate numeric Hydration adherence.
            </p>
            {directive && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-300">Active directive</p>
                  <p className="text-sm text-white">{targetSummary}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => void removeCurrent()} aria-label="Remove Hydration directive">
                  <Trash2 className="h-4 w-4 text-red-300" />
                </Button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-white/70">Target type
                <select value={targetKind} onChange={(event) => setTargetKind(event.target.value as ClinicalDirective["targetKind"])} className="mt-1 h-10 w-full rounded-md border border-white/20 bg-black/40 px-3 text-white">
                  <option value="point">Daily target</option>
                  <option value="range">Daily range</option>
                  <option value="floor">Daily minimum</option>
                  <option value="ceiling">Daily maximum</option>
                </select>
              </label>
              {targetKind === "point" && <label className="text-xs text-white/70">Target (oz)<Input value={targetOz} onChange={(e) => setTargetOz(e.target.value)} inputMode="decimal" className="mt-1 bg-black/30" /></label>}
              {(targetKind === "range" || targetKind === "floor") && <label className="text-xs text-white/70">Minimum (oz)<Input value={minimumOz} onChange={(e) => setMinimumOz(e.target.value)} inputMode="decimal" className="mt-1 bg-black/30" /></label>}
              {(targetKind === "range" || targetKind === "ceiling") && <label className="text-xs text-white/70">Maximum (oz)<Input value={maximumOz} onChange={(e) => setMaximumOz(e.target.value)} inputMode="decimal" className="mt-1 bg-black/30" /></label>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/70">Review date<Input type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} className="mt-1 bg-black/30" /></label>
              <label className="text-xs text-white/70">Expiration date<Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="mt-1 bg-black/30" /></label>
            </div>
            <Input placeholder="Clinical reason / rationale" value={reason} onChange={(e) => setReason(e.target.value)} className="bg-black/30" />
            <Input placeholder="Source reference" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className="bg-black/30" />
            <Input placeholder="Consent reference" value={consentReference} onChange={(e) => setConsentReference(e.target.value)} className="bg-black/30" />
            <Button onClick={() => void saveClinical()} disabled={saving}>{saving ? "Saving…" : "Save Hydration Directive"}</Button>
          </>
        ) : (
          <>
            <div className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-relaxed text-amber-100/80">
                Coaching only. Do not prescribe fluid volumes, sodium/electrolyte doses, restrictions, water cuts, sauna, diuretics/laxatives, dehydration, or weigh-in manipulation.
              </p>
            </div>
            {guidance && <p className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">Active coaching · review {new Date(`${guidance.reviewOn}T12:00:00`).toLocaleDateString()}</p>}
            <label className="text-xs text-white/70">Training context
              <select value={trainingContext} onChange={(e) => setTrainingContext(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/20 bg-black/40 px-3 text-white">
                <option value="strength">Strength</option><option value="endurance">Endurance</option><option value="team_sport">Team sport</option><option value="mixed_training">Mixed training</option><option value="general_activity">General activity</option>
              </select>
            </label>
            <div>
              <p className="mb-2 text-xs text-white/70">Coaching emphasis</p>
              <div className="flex flex-wrap gap-2">
                {["before_training", "during_training", "recovery"].map((value) => (
                  <button key={value} type="button" onClick={() => setEmphasis((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} className={`rounded-full border px-3 py-1 text-xs ${emphasis.includes(value) ? "border-sky-300 bg-sky-400/20 text-sky-100" : "border-white/20 text-white/55"}`}>
                    {value.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <Textarea placeholder="Reminder strategy (timing cues, routine anchors)" value={reminderStrategy} onChange={(e) => setReminderStrategy(e.target.value)} className="bg-black/30" />
            <Textarea placeholder="Beverage strategy (preferences and practical options, no prescriptions)" value={beverageStrategy} onChange={(e) => setBeverageStrategy(e.target.value)} className="bg-black/30" />
            <Textarea placeholder="Athlete Beverage Creator intent" value={athleteCreatorIntent} onChange={(e) => setAthleteCreatorIntent(e.target.value)} className="bg-black/30" />
            <Textarea placeholder="Coaching notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-black/30" />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/70">Starts<Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="mt-1 bg-black/30" /></label>
              <label className="text-xs text-white/70">Review date<Input type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} className="mt-1 bg-black/30" /></label>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void saveTrainer()} disabled={saving || emphasis.length === 0}>{saving ? "Saving…" : "Save Athletic Hydration Coaching"}</Button>
              {guidance && <Button variant="ghost" onClick={() => void removeCurrent()}><Trash2 className="mr-2 h-4 w-4" />Remove</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}