import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, CircleAlert, Clock3, Compass, Loader2, RefreshCw } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface PilotAssignment {
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

interface PilotGuidance {
  active: boolean;
  pilotId: string;
  organizationId: string;
  programVersion: string;
  assignmentPack: string;
  currentDay: number;
  currentWeek: number;
  title: string;
  goal: string;
  assignments: PilotAssignment[];
  completedCount: number;
  totalCount: number;
  nextAction: string | null;
  pilotReview: { bookingUrl: string | null; fallbackEmail: string | null };
  startsAt: string | null;
  endsAt: string | null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Skeleton() {
  return (
    <section aria-label="Loading business pilot" className="rounded-2xl border border-orange-300/20 bg-slate-950/70 p-5 shadow-xl shadow-black/10">
      <div className="animate-pulse space-y-4">
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="h-7 w-3/4 rounded bg-white/10" />
        <div className="h-16 rounded-xl bg-white/5" />
        <div className="h-12 rounded-xl bg-white/5" />
      </div>
    </section>
  );
}

export default function GuidedBusinessPilot() {
  const [guidance, setGuidance] = useState<PilotGuidance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadGuidance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business/pilot-guidance", {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Pilot guidance could not be loaded.");
      setGuidance(body as PilotGuidance);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pilot guidance could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) void loadGuidance();
  }, [loadGuidance]);

  const daysRemaining = useMemo(() => {
    if (!guidance?.endsAt) return null;
    const end = new Date(guidance.endsAt).getTime();
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }, [guidance?.endsAt]);

  const toggleAssignment = async (assignment: PilotAssignment) => {
    if (!guidance || savingKey) return;
    setSavingKey(assignment.key);
    try {
      const response = await fetch(`/api/business/pilot-guidance/assignments/${encodeURIComponent(assignment.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ completed: !assignment.completed }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "That assignment could not be updated.");
      setGuidance(body as PilotGuidance);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That assignment could not be updated.");
    } finally {
      setSavingKey(null);
    }
  };

  if (!import.meta.env.DEV) return null;
  if (loading) return <Skeleton />;
  if (error && !guidance) {
    return (
      <section role="alert" className="rounded-2xl border border-rose-300/25 bg-slate-950/70 p-5 text-white shadow-xl shadow-black/10">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Your pilot is temporarily unavailable</h2>
            <p className="mt-1 text-sm text-white/60">{error}</p>
            <button type="button" onClick={() => void loadGuidance()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      </section>
    );
  }
  if (!guidance?.active) return null;

  const progress = guidance.totalCount ? Math.round((guidance.completedCount / guidance.totalCount) * 100) : 0;
  const dates = guidance.startsAt || guidance.endsAt
    ? `${formatDate(guidance.startsAt) || "Start date pending"}${guidance.endsAt ? ` – ${formatDate(guidance.endsAt)}` : ""}`
    : null;

  return (
    <section aria-labelledby="guided-pilot-title" data-pilot-id={guidance.pilotId} data-organization-id={guidance.organizationId} className="overflow-hidden rounded-2xl border border-orange-300/25 bg-[linear-gradient(135deg,rgba(41,28,22,.97),rgba(8,18,25,.96))] text-white shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 px-5 pb-5 pt-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-300">
              <Compass className="h-4 w-4" /> Development pilot
            </div>
            <h2 id="guided-pilot-title" className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Your 30-Day Business Pilot</h2>
            <p className="mt-1 text-sm text-white/60">{guidance.title}</p>
          </div>
          <div className="shrink-0 rounded-xl border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-left sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-200/70">Week {guidance.currentWeek} of 4</p>
            <p className="mt-0.5 text-sm font-semibold text-orange-100">Day {guidance.currentDay} <span className="font-normal text-orange-100/60">of 30</span></p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">The goal</p>
            <p className="mt-1 text-sm leading-relaxed text-white/85">{guidance.goal}</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-3">
            <div className="relative h-11 w-11 shrink-0 rounded-full border-4 border-white/10" style={{ background: `conic-gradient(#fbbf24 ${progress}%, rgba(255,255,255,.08) 0)` }}>
              <div className="absolute inset-1 flex items-center justify-center rounded-full bg-[#1d1714] text-[11px] font-bold">{guidance.completedCount}/{guidance.totalCount}</div>
            </div>
            <div><p className="text-sm font-semibold">Progress</p><p className="text-xs text-white/50">{progress}% complete</p></div>
          </div>
        </div>
        {(dates || daysRemaining !== null) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
            {dates && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-orange-300/80" />{dates}</span>}
            {daysRemaining !== null && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-orange-300/80" />{daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining</span>}
          </div>
        )}
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-300/80">This week</p><h3 className="mt-1 text-base font-semibold">{guidance.assignmentPack.replaceAll("_", " ")}</h3><p className="mt-1 text-[11px] text-white/35">Program version {guidance.programVersion}</p></div>
          {error && <p role="alert" className="text-right text-xs text-rose-300">{error}</p>}
        </div>
        <div className="mt-3 space-y-2">
          {guidance.assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-sm text-white/55">Your assignments will appear here when this week is ready.</div>
          ) : guidance.assignments.map((assignment) => {
            const saving = savingKey === assignment.key;
            return (
              <label key={assignment.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${assignment.completed ? "border-emerald-300/25 bg-emerald-300/[0.07]" : "border-white/10 bg-white/[0.035] hover:border-orange-200/30"}`}>
                <input type="checkbox" checked={assignment.completed} disabled={Boolean(savingKey)} onChange={() => void toggleAssignment(assignment)} className="sr-only" />
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${assignment.completed ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-white/30 bg-transparent"}`}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : assignment.completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
                <span className={`text-sm ${assignment.completed ? "text-white/55 line-through" : "text-white/85"}`} title={assignment.completedAt ? `Completed ${formatDate(assignment.completedAt)}` : undefined}>{assignment.label}</span>
              </label>
            );
          })}
        </div>
        {guidance.nextAction && (
          <div className="mt-4 rounded-xl border border-orange-300/25 bg-orange-300/10 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-200/70">Recommended next</p>
            <p className="mt-1 text-sm font-medium text-orange-50">{guidance.nextAction}</p>
          </div>
        )}
        {guidance.pilotReview.bookingUrl && (
          <a href={guidance.pilotReview.bookingUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200">
            Schedule My Pilot Review <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
        {guidance.pilotReview.fallbackEmail && <p className="mt-3 text-center text-xs text-white/45">Questions about your review? Contact {guidance.pilotReview.fallbackEmail}.</p>}
      </div>
    </section>
  );
}