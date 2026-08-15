import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PillButton } from "@/components/ui/pill-button";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, ClipboardList, Clock } from "lucide-react";
import { useGlp1HubCheckin } from "@/hooks/useGlp1HubCheckin";
import type { HubCheckinPayload } from "../../../../shared/glp1-schema";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Severity = "none" | "mild" | "moderate" | "severe";
type VomitingFreq = "none" | "once" | "multiple" | "cant_keep_fluids";
type FluidStatus = "yes" | "with_difficulty" | "no";
type EatStatus = "yes" | "partially" | "no";
type Trend = "improving" | "same" | "worsening" | "na";
type CareNotify = "none" | "coach" | "physician" | "both";
type AppetiteLevel = "suppressed" | "reduced" | "normal" | "increased";

interface CheckinForm {
  nausea: Severity;
  constipation: Severity;
  diarrhea: Severity;
  reflux: Severity;
  bloating: Severity;
  earlyFullness: Severity;
  foodAversions: Severity;
  fatigue: Severity;
  dizziness: Severity;
  headache: Severity;
  vomiting: VomitingFreq;
  canKeepFluidsDown: FluidStatus;
  canEatWithoutWorsening: EatStatus;
  reducedUrination: boolean;
  symptomTrend: Trend;
  symptomsAfterDose: "yes" | "no" | "unsure";
  appetiteLevel: AppetiteLevel;
  notifyCareTeam: CareNotify;
}

const DEFAULT_FORM: CheckinForm = {
  nausea: "none",
  constipation: "none",
  diarrhea: "none",
  reflux: "none",
  bloating: "none",
  earlyFullness: "none",
  foodAversions: "none",
  fatigue: "none",
  dizziness: "none",
  headache: "none",
  vomiting: "none",
  canKeepFluidsDown: "yes",
  canEatWithoutWorsening: "yes",
  reducedUrination: false,
  symptomTrend: "na",
  symptomsAfterDose: "unsure",
  appetiteLevel: "normal",
  notifyCareTeam: "none",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function severityLabelKey(s: Severity): string {
  return `glp1Checkin.severity.${s}`;
}

function timeAgo(d: Date | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!d) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return t("glp1Checkin.justNow");
  if (mins < 60) return t("glp1Checkin.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  return t("glp1Checkin.hoursAgo", { count: hrs });
}

function hasAnySymptomsInForm(form: CheckinForm): boolean {
  return (
    form.nausea !== "none" ||
    form.constipation !== "none" ||
    form.diarrhea !== "none" ||
    form.reflux !== "none" ||
    form.bloating !== "none" ||
    form.earlyFullness !== "none" ||
    form.foodAversions !== "none" ||
    form.fatigue !== "none" ||
    form.dizziness !== "none" ||
    form.headache !== "none" ||
    form.vomiting !== "none"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SeverityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  const { t } = useTranslation();
  const options: Severity[] = ["none", "mild", "moderate", "severe"];
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/80 min-w-[120px]">{label}</span>
      <div className="flex gap-1.5 flex-wrap justify-end">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              value === opt
                ? opt === "none"
                  ? "bg-white/20 text-white"
                  : opt === "mild"
                  ? "bg-yellow-500/80 text-black"
                  : opt === "moderate"
                  ? "bg-orange-500/80 text-white"
                  : "bg-red-500/80 text-white"
                : "bg-white/8 text-white/50 hover:bg-white/15"
            }`}
          >
            {t(severityLabelKey(opt))}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
              value === opt.value
                ? "bg-orange-500/80 text-white"
                : "bg-white/8 text-white/50 hover:bg-white/15"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATION DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function AdaptationCard({
  entries,
  escalations,
}: {
  entries: Array<{ adaptation: string; reason: string; evidenceRef: string }>;
  escalations: string[];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (escalations.length === 0 && entries.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl bg-black/30 border border-white/10 overflow-hidden">
      {escalations.length > 0 && (
        <div className="px-4 py-3 bg-red-500/15 border-b border-red-500/20 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Contact your healthcare provider</p>
            <p className="text-xs text-red-300/80 mt-0.5">
              {t("glp1Checkin.escalationCardBody")}
            </p>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-white/90">
              {t("glp1Checkin.nutritionAdjustments", { count: entries.length })}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/50" />
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3">
              {entries.map((entry, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-xs text-white/50 uppercase tracking-wide">{t("glp1Checkin.reason")}</p>
                  <p className="text-sm text-white/80">{entry.reason}</p>
                  <p className="text-xs text-white/50 uppercase tracking-wide mt-1.5">{t("glp1Checkin.adaptation")}</p>
                  <p className="text-sm text-white">{entry.adaptation}</p>
                  <p className="text-xs text-white/50 uppercase tracking-wide mt-1.5">{t("glp1Checkin.evidence")}</p>
                  <p className="text-xs text-white/50">{entry.evidenceRef}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function GLP1DailyCheckin() {
  const { t } = useTranslation();
  const { checkin, tolerance, isLoading, isSubmitting, lastUpdated, submit, error } =
    useGlp1HubCheckin();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CheckinForm>(DEFAULT_FORM);

  const toleranceExt = tolerance as (typeof tolerance & {
    adaptationEntries?: Array<{ adaptation: string; reason: string; evidenceRef: string }>;
  }) | null;

  const hasCheckinToday = checkin !== null;
  const hasEscalation = (tolerance?.shouldEscalate ?? false) || (tolerance?.safetyEscalations?.length ?? 0) > 0;
  const hasAdaptations = (toleranceExt?.adaptationEntries?.length ?? 0) > 0;
  const anyActiveSymptoms =
    tolerance?.nauseaLevel !== "none" ||
    tolerance?.hasVomiting ||
    tolerance?.hasDiarrhea ||
    tolerance?.hasConstipation ||
    tolerance?.hasReflux ||
    tolerance?.hydrationRisk !== "none";

  const set = <K extends keyof CheckinForm>(key: K, val: CheckinForm[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleOpen = () => {
    if (checkin) {
      setForm({
        nausea: (checkin.nausea as Severity) ?? "none",
        constipation: (checkin.constipation as Severity) ?? "none",
        diarrhea: (checkin.diarrhea as Severity) ?? "none",
        reflux: (checkin.reflux as Severity) ?? "none",
        bloating: (checkin.bloating as Severity) ?? "none",
        earlyFullness: (checkin.earlyFullness as Severity) ?? "none",
        foodAversions: (checkin.foodAversions as Severity) ?? "none",
        fatigue: (checkin.fatigue as Severity) ?? "none",
        dizziness: (checkin.dizziness as Severity) ?? "none",
        headache: (checkin.headache as Severity) ?? "none",
        vomiting: (checkin.vomiting as VomitingFreq) ?? "none",
        canKeepFluidsDown: (checkin.canKeepFluidsDown as FluidStatus) ?? "yes",
        canEatWithoutWorsening: (checkin.canEatWithoutWorsening as EatStatus) ?? "yes",
        reducedUrination: checkin.reducedUrination ?? false,
        symptomTrend: (checkin.symptomTrend as Trend) ?? "na",
        symptomsAfterDose: "unsure",
        appetiteLevel: (checkin.appetiteLevel as AppetiteLevel) ?? "normal",
        notifyCareTeam: (checkin.notifyCareTeam as CareNotify) ?? "none",
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    const ok = await submit(form as Partial<HubCheckinPayload>);
    if (ok) setOpen(false);
  };

  // ── Loading skeleton
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 animate-pulse">
        <div className="h-4 w-48 bg-white/10 rounded mb-2" />
        <div className="h-3 w-64 bg-white/5 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* ── Status Card ───────────────────────────────────────────── */}
      <div className="px-4 py-4">
        {!hasCheckinToday ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-orange-400" />
                <p className="text-sm font-semibold text-white">{t("glp1Checkin.howFeeling")}</p>
              </div>
              <p className="text-xs text-white/50">
                {t("glp1Checkin.noCheckinToday")}
              </p>
              <p className="text-xs text-orange-300/70 mt-1">
                {t("glp1Checkin.checkInPrompt")}
              </p>
            </div>
            <Button
              onClick={handleOpen}
              size="sm"
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
            >
              {t("glp1Checkin.checkIn")}
            </Button>
          </div>
        ) : hasEscalation ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Contact your healthcare provider</p>
                  <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t("glp1Checkin.updated", { time: timeAgo(lastUpdated, t) })}
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpen}
                className="text-xs text-white/50 hover:text-white underline underline-offset-2 flex-shrink-0"
              >
                {t("glp1Checkin.update")}
              </button>
            </div>
            <div className="mt-2 text-xs text-red-300/80 leading-relaxed">
              {t("glp1Checkin.escalationStatusBody")}
            </div>
          </div>
        ) : anyActiveSymptoms ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <p className="text-sm font-semibold text-white">
                  {t("glp1Checkin.mealsAdapting")}
                </p>
              </div>
              <p className="text-xs text-white/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t("glp1Checkin.updatedTapAdjustments", { time: timeAgo(lastUpdated, t) })}
              </p>
            </div>
            <button
              onClick={handleOpen}
              className="text-xs text-orange-300 hover:text-orange-200 underline underline-offset-2 flex-shrink-0"
            >
              {t("glp1Checkin.update")}
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-sm font-semibold text-white">{t("glp1Checkin.noSymptomsToday")}</p>
              </div>
              <p className="text-xs text-white/50 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t("glp1Checkin.updatedStandardProfile", { time: timeAgo(lastUpdated, t) })}
              </p>
            </div>
            <button
              onClick={handleOpen}
              className="text-xs text-white/40 hover:text-white underline underline-offset-2 flex-shrink-0"
            >
              {t("glp1Checkin.update")}
            </button>
          </div>
        )}

        {/* Adaptation detail card */}
        {hasCheckinToday && (
          <AdaptationCard
            entries={toleranceExt?.adaptationEntries ?? []}
            escalations={tolerance?.safetyEscalations ?? []}
          />
        )}
      </div>

      {/* ── Symptom Selector ──────────────────────────────────────── */}
      {open && (
        <div className="border-t border-white/10 px-4 py-4 space-y-5">

          {/* GI Symptoms */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              {t("glp1Checkin.giSymptomsHeader")}
            </p>
            <div className="space-y-0">
              <SeverityRow label={t("glp1Checkin.symptom.nausea")}       value={form.nausea}       onChange={v => set("nausea", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.constipation")}  value={form.constipation}  onChange={v => set("constipation", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.diarrhea")}      value={form.diarrhea}      onChange={v => set("diarrhea", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.reflux")}        value={form.reflux}        onChange={v => set("reflux", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.bloating")}      value={form.bloating}      onChange={v => set("bloating", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.earlyFullness")} value={form.earlyFullness} onChange={v => set("earlyFullness", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.foodAversions")} value={form.foodAversions} onChange={v => set("foodAversions", v)} />
            </div>
          </div>

          {/* Other Symptoms */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              {t("glp1Checkin.otherSymptomsHeader")}
            </p>
            <div className="space-y-0">
              <SeverityRow label={t("glp1Checkin.symptom.fatigue")}   value={form.fatigue}   onChange={v => set("fatigue", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.dizziness")} value={form.dizziness} onChange={v => set("dizziness", v)} />
              <SeverityRow label={t("glp1Checkin.symptom.headache")}  value={form.headache}  onChange={v => set("headache", v)} />
            </div>
          </div>

          {/* Vomiting */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              {t("glp1Checkin.vomitingHeader")}
            </p>
            <ChoiceRow
              label=""
              value={form.vomiting}
              onChange={v => set("vomiting", v)}
              options={[
                { value: "none",            label: t("glp1Checkin.vomiting.none") },
                { value: "once",            label: t("glp1Checkin.vomiting.once") },
                { value: "multiple",        label: t("glp1Checkin.vomiting.multiple") },
                { value: "cant_keep_fluids", label: t("glp1Checkin.vomiting.cantKeepFluids") },
              ]}
            />
          </div>

          {/* Functional Questions */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              {t("glp1Checkin.quickQuestionsHeader")}
            </p>
            <div className="space-y-0">
              <ChoiceRow
                label={t("glp1Checkin.q.keepFluids")}
                value={form.canKeepFluidsDown}
                onChange={v => set("canKeepFluidsDown", v)}
                options={[
                  { value: "yes",             label: t("glp1Checkin.opt.yes") },
                  { value: "with_difficulty", label: t("glp1Checkin.opt.withDifficulty") },
                  { value: "no",              label: t("glp1Checkin.opt.no") },
                ]}
              />
              <ChoiceRow
                label={t("glp1Checkin.q.eatWithoutWorsening")}
                value={form.canEatWithoutWorsening}
                onChange={v => set("canEatWithoutWorsening", v)}
                options={[
                  { value: "yes",      label: t("glp1Checkin.opt.yes") },
                  { value: "partially", label: t("glp1Checkin.opt.partially") },
                  { value: "no",       label: t("glp1Checkin.opt.no") },
                ]}
              />
              <ChoiceRow
                label={t("glp1Checkin.q.reducedUrination")}
                value={form.reducedUrination ? "yes" : "no"}
                onChange={v => set("reducedUrination", v === "yes")}
                options={[
                  { value: "no",  label: t("glp1Checkin.opt.no") },
                  { value: "yes", label: t("glp1Checkin.opt.yes") },
                ]}
              />
              <ChoiceRow
                label={t("glp1Checkin.q.symptomTrend")}
                value={form.symptomTrend}
                onChange={v => set("symptomTrend", v)}
                options={[
                  { value: "improving", label: t("glp1Checkin.trend.improving") },
                  { value: "same",      label: t("glp1Checkin.trend.same") },
                  { value: "worsening", label: t("glp1Checkin.trend.worsening") },
                  { value: "na",        label: t("glp1Checkin.trend.na") },
                ]}
              />
              <ChoiceRow
                label={t("glp1Checkin.q.appetite")}
                value={form.appetiteLevel}
                onChange={v => set("appetiteLevel", v)}
                options={[
                  { value: "suppressed", label: t("glp1Checkin.appetite.suppressed") },
                  { value: "reduced",    label: t("glp1Checkin.appetite.reduced") },
                  { value: "normal",     label: t("glp1Checkin.appetite.normal") },
                  { value: "increased",  label: t("glp1Checkin.appetite.increased") },
                ]}
              />
            </div>
          </div>

          {/* Care Team Notify */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">
              {t("glp1Checkin.notifyHeader")}
            </p>
            <p className="text-xs text-white/40 mb-3">
              {t("glp1Checkin.notifyHelp")}
            </p>
            <ChoiceRow
              label=""
              value={form.notifyCareTeam}
              onChange={v => set("notifyCareTeam", v)}
              options={[
                { value: "none",      label: t("glp1Checkin.notify.keepPrivate") },
                { value: "coach",     label: t("glp1Checkin.notify.coach") },
                { value: "physician", label: "Notify my physician" },
                { value: "both",      label: t("glp1Checkin.notify.both") },
              ]}
            />
          </div>

          {/* Situational note */}
          <div className="rounded-xl bg-orange-500/8 border border-orange-500/20 px-3 py-3">
            <p className="text-xs text-orange-200/70 leading-relaxed">
              <span className="font-semibold text-orange-300">{t("glp1Checkin.updatesThroughoutDay")}</span>{" "}
              {t("glp1Checkin.updatesThroughoutDayBody")}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 text-sm text-white/50 hover:text-white py-2.5 rounded-xl border border-white/10"
            >
              {t("glp1Checkin.cancel")}
            </button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              {isSubmitting ? t("glp1Checkin.saving") : t("glp1Checkin.saveCheckIn")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
