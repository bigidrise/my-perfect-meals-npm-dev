import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Droplets,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { useToast } from "@/hooks/use-toast";
import {
  addHydrationWater,
  getHydrationCenterState,
  type HydrationCenterState,
  type HydrationNumericPolicyState,
} from "@/lib/hydrationApi";

const ML_PER_OUNCE = 29.5735;

function localToday(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
}

function mlToOz(value: number) {
  return Math.round(value / ML_PER_OUNCE);
}

function displayVolume(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString()} mL`;
}

function policyCopy(policy: HydrationNumericPolicyState) {
  if (policy.status === "TRACK_ONLY") {
    return {
      title: "Tracking only",
      body: "No numeric hydration target has been set by an authorized clinician. Your water log still works normally.",
      tone: "sky",
    };
  }
  if (policy.status === "PLAN_WITHHELD") {
    return {
      title: "Numeric plan withheld",
      body: "Hydration planning is paused because a safety or access requirement is not satisfied.",
      tone: "amber",
    };
  }
  if (policy.status === "NEEDS_REVIEW") {
    return {
      title: "Clinician review needed",
      body: "The saved hydration directive is incomplete, expired, or due for review. Logged water remains available.",
      tone: "amber",
    };
  }
  if (policy.targetKind === "ceiling") {
    return {
      title: "Clinician-set ceiling",
      body: `${displayVolume(policy.headroomToMaximumMl)} remains before the clinician-set maximum. This is a limit, not a goal.`,
      tone: "violet",
    };
  }
  if (policy.targetKind === "range") {
    return {
      title: "Clinician-set range",
      body: `${displayVolume(policy.remainingToMinimumMl)} to the lower bound; ${displayVolume(policy.headroomToMaximumMl)} before the upper bound.`,
      tone: "emerald",
    };
  }
  if (policy.targetKind === "floor") {
    return {
      title: "Clinician-set minimum",
      body:
        policy.remainingToMinimumMl === 0
          ? "The clinician-set minimum has been reached."
          : `${displayVolume(policy.remainingToMinimumMl)} remains to the clinician-set minimum.`,
      tone: "emerald",
    };
  }
  return {
    title: "Clinician-set target",
    body:
      policy.remainingMl === 0
        ? "The clinician-set target has been reached."
        : `${displayVolume(policy.remainingMl)} remains today.`,
    tone: "emerald",
  };
}

function NumericDetails({ policy }: { policy: HydrationNumericPolicyState }) {
  if (policy.status !== "NUMERIC_ACTIVE") return null;
  const entries =
    policy.targetKind === "point"
      ? [["Target", policy.targetMl]]
      : policy.targetKind === "range"
        ? [["Minimum", policy.minimumMl], ["Maximum", policy.maximumMl]]
        : policy.targetKind === "floor"
          ? [["Minimum", policy.minimumMl]]
          : [["Maximum", policy.maximumMl]];
  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {entries.map(([label, value]) => (
        <div
          key={String(label)}
          className="rounded-xl bg-white/[0.05] border border-white/10 p-3"
        >
          <p className="text-[11px] uppercase tracking-wider text-white/45">
            {label}
          </p>
          <p className="text-sm font-semibold text-white mt-1">
            {displayVolume(value as number | null)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function HydrationCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  const localDate = useMemo(() => localToday(timezone), [timezone]);
  const [state, setState] = useState<HydrationCenterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<"oz" | "ml">("oz");

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await getHydrationCenterState({ date: localDate, timezone });
      setState(next);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message.replace(/^\d+:\s*/, "")
          : "Hydration data is unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, [localDate, timezone]);

  useEffect(() => {
    void load();
  }, [load]);

  const addWater = async (amount: number, unit: "oz" | "ml") => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await addHydrationWater({ amount, unit });
      await load();
      setCustomAmount("");
      toast({
        title: "Water logged",
        description: `${amount} ${unit} was added to today.`,
      });
    } catch (saveError) {
      toast({
        title: "Could not log water",
        description:
          saveError instanceof Error
            ? saveError.message.replace(/^\d+:\s*/, "")
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const policy = state?.numericPolicy;
  const copy = policy ? policyCopy(policy) : null;
  const progress =
    policy?.status === "NUMERIC_ACTIVE" && policy.progressPercent !== null
      ? policy.progressPercent
      : null;
  const ringDegrees = Math.round(((progress ?? 0) / 100) * 360);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[radial-gradient(circle_at_top,#0c4a6e_0%,#082f49_28%,#020617_68%)] text-white"
    >
      <MobileHeaderGuard>
        <header
          className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 pb-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/my-biometrics")}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold">Hydration Center</h1>
              <p className="text-xs text-sky-100/55">
                Server-backed water tracking
              </p>
            </div>
            <Badge className="border-sky-300/20 bg-sky-400/10 text-sky-100">
              Preview
            </Badge>
          </div>
        </header>
      </MobileHeaderGuard>

      <main
        className="mx-auto max-w-4xl space-y-4 px-4 pb-28"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.75rem)" }}
      >
        <section className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
          <Card className="overflow-hidden border-white/10 bg-slate-950/45 shadow-2xl backdrop-blur-xl">
            <CardContent className="p-5 sm:p-7">
              {loading ? (
                <div className="flex min-h-72 items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-sky-300" />
                </div>
              ) : error ? (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <Info className="mb-3 h-8 w-8 text-amber-300" />
                  <p className="font-semibold">Hydration is unavailable</p>
                  <p className="mt-1 max-w-sm text-sm text-white/55">{error}</p>
                  <Button onClick={() => void load()} className="mt-4">
                    Try again
                  </Button>
                </div>
              ) : state && policy && copy ? (
                <>
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                    <div
                      className="grid h-44 w-44 shrink-0 place-items-center rounded-full p-2 shadow-[0_0_70px_rgba(56,189,248,.18)]"
                      style={{
                        background:
                          progress === null
                            ? "conic-gradient(rgba(56,189,248,.25) 0deg, rgba(255,255,255,.07) 0deg)"
                            : `conic-gradient(#38bdf8 ${ringDegrees}deg, rgba(255,255,255,.08) ${ringDegrees}deg)`,
                      }}
                    >
                      <div className="grid h-full w-full place-items-center rounded-full bg-slate-950">
                        <div className="text-center">
                          <Droplets className="mx-auto mb-1 h-6 w-6 text-sky-300" />
                          <p className="text-3xl font-bold">
                            {mlToOz(state.totalLoggedMl)}
                          </p>
                          <p className="text-xs text-white/45">
                            oz today · {state.totalLoggedMl.toLocaleString()} mL
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <div className="flex items-center justify-center gap-2 sm:justify-start">
                        <ShieldCheck className="h-5 w-5 text-sky-300" />
                        <h2 className="text-xl font-semibold">{copy.title}</h2>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-sky-50/65">
                        {copy.body}
                      </p>
                      <NumericDetails policy={policy} />
                      <p className="mt-4 text-xs leading-relaxed text-white/40">
                        My Perfect Meals never creates an individual hydration
                        target from a population average or body-weight formula.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-950/45 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-sky-300" />
                <h2 className="font-semibold">Log water</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[8, 12, 16, 24].map((ounces) => (
                  <Button
                    key={ounces}
                    disabled={saving}
                    onClick={() => void addWater(ounces, "oz")}
                    className="border border-sky-300/20 bg-sky-500/15 text-sky-50 hover:bg-sky-500/25"
                    data-testid={`hydration-add-${ounces}oz`}
                  >
                    +{ounces} oz
                  </Button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="Custom amount"
                  className="border-white/10 bg-white/5 text-white"
                  data-testid="hydration-custom-amount"
                />
                <select
                  value={customUnit}
                  onChange={(event) =>
                    setCustomUnit(event.target.value as "oz" | "ml")
                  }
                  className="rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
                  aria-label="Water unit"
                >
                  <option value="oz">oz</option>
                  <option value="ml">mL</option>
                </select>
              </div>
              <Button
                disabled={saving || Number(customAmount) <= 0}
                onClick={() =>
                  void addWater(Number(customAmount), customUnit)
                }
                className="mt-2 w-full bg-sky-500 text-slate-950 hover:bg-sky-400"
                data-testid="hydration-add-custom"
              >
                {saving ? "Saving…" : "Add to today"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-slate-950/45 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-sky-300" />
                <h2 className="font-semibold">Today’s log</h2>
              </div>
              <div className="mt-4 space-y-2">
                {state?.history.length ? (
                  [...state.history].reverse().map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5"
                    >
                      <span className="text-sm text-white/65">
                        {new Intl.DateTimeFormat(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(item.intakeTime))}
                      </span>
                      <span className="font-medium">
                        {mlToOz(item.amountMl)} oz
                        <span className="ml-2 text-xs font-normal text-white/35">
                          {item.amountMl} mL
                        </span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/45">
                    No water logged yet today.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-950/45 backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-sky-300" />
                <h2 className="font-semibold">Policy & evidence</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                The Hydration evidence registry contains 32 reviewed sources.
                Population total-water references are educational and are not
                converted into a personal water target.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <MedicalSourcesInfo
                  trigger={
                    <Button className="w-full bg-white/10 text-white hover:bg-white/15">
                      View sources
                    </Button>
                  }
                />
                <Button
                  onClick={() => navigate("/learn?topic=hydration")}
                  variant="outline"
                  className="w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  App Library
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </motion.div>
  );
}