import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, BookOpen, Check, Clock3, Droplets, GlassWater, Info,
  Lightbulb, Plus, RefreshCw, RotateCcw, Settings2, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { useToast } from "@/hooks/use-toast";
import {
  addHydrationWater,
  createHydrationHelp,
  getHydrationHubState,
  recordHydrationInterventionEvent,
  saveHydrationHubBarriers,
  saveHydrationHubPreferences,
  type HydrationCenterState,
  type HydrationNumericPolicyState,
} from "@/lib/hydrationApi";

const ML_PER_OUNCE = 29.5735;
const BEVERAGES = [
  ["water", "Plain water"], ["sparkling", "Sparkling"], ["tea", "Tea"],
  ["coffee", "Coffee"], ["milk", "Milk"], ["juice", "Juice"], ["other", "Other"],
] as const;
const BARRIERS = [
  ["forgetting", "I forget"], ["taste", "Taste"], ["temperature", "Temperature"],
  ["carbonation", "I prefer bubbles"], ["access", "Access"], ["timing", "Timing"],
  ["bathroom_concerns", "Bathroom concerns"], ["nutrition_conflicts", "Nutrition conflicts"],
  ["low_appetite", "Low appetite"],
] as const;
const BARRIER_LABELS = Object.fromEntries(BARRIERS);

function mlToOz(value: number) { return Math.round(value / ML_PER_OUNCE); }
function displayVolume(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString()} mL`;
}
function policyCopy(policy: HydrationNumericPolicyState) {
  if (policy.status === "TRACK_ONLY") return {
    title: "Track without a formula",
    body: "No personal numeric target has been set by an authorized clinician. You can still track fluids and get practical help.",
  };
  if (policy.status === "PLAN_WITHHELD") return {
    title: "Numeric plan withheld",
    body: "A safety or access requirement is not satisfied. Practical, nonnumeric help is still available.",
  };
  if (policy.status === "NEEDS_REVIEW") return {
    title: "Clinician review needed",
    body: "The saved directive needs review. Your fluid history and practical support remain available.",
  };
  if (policy.targetKind === "ceiling") return {
    title: "Clinician-set ceiling",
    body: `${displayVolume(policy.headroomToMaximumMl)} remains before the clinician-set maximum. This is a limit, not a goal.`,
  };
  if (policy.targetKind === "range") return {
    title: "Clinician-set range",
    body: `${displayVolume(policy.remainingToMinimumMl)} to the lower bound; ${displayVolume(policy.headroomToMaximumMl)} before the upper bound.`,
  };
  if (policy.targetKind === "floor") return {
    title: "Clinician-set minimum",
    body: policy.remainingToMinimumMl === 0 ? "The clinician-set minimum has been reached." : `${displayVolume(policy.remainingToMinimumMl)} remains.`,
  };
  return {
    title: "Clinician-set target",
    body: policy.remainingMl === 0 ? "The clinician-set target has been reached." : `${displayVolume(policy.remainingMl)} remains today.`,
  };
}

type Intervention = NonNullable<HydrationCenterState["interventions"]>[number];

export default function HydrationCenter() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const initializedSetup = useRef(false);
  const [state, setState] = useState<HydrationCenterState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<"oz" | "ml">("oz");
  const [beverageClass, setBeverageClass] = useState("water");
  const [historyWindow, setHistoryWindow] = useState<"today" | "7" | "30">("today");
  const [consented, setConsented] = useState(false);
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);
  const [barrierNote, setBarrierNote] = useState("");
  const [preferences, setPreferences] = useState<Record<string, string>>({
    flavor: "no_preference", temperature: "no_preference", carbonation: "no_preference",
  });
  const [helpOptions, setHelpOptions] = useState<Intervention[]>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await getHydrationHubState({});
      setState(next);
      if (!initializedSetup.current && next.setup) {
        setConsented(next.setup.consented);
        setSelectedBarriers(next.setup.barriers.map((item) => item.barrierCode));
        setBarrierNote(next.setup.barriers.find((item) => item.note)?.note || "");
        setPreferences((current) => ({ ...current, ...(next.setup?.preferences as Record<string, string>) }));
        initializedSetup.current = true;
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message.replace(/^\d+:\s*/, "") : "Hydration data is unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addFluid = async (amount: number, unit: "oz" | "ml") => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await addHydrationWater({ amount, unit, beverageClass });
      setCustomAmount("");
      await load();
      toast({ title: "Fluid logged", description: `${amount} ${unit} of ${BEVERAGES.find(([value]) => value === beverageClass)?.[1].toLowerCase() || "fluid"} was added.` });
    } catch (saveError) {
      toast({ title: "Could not log fluid", description: saveError instanceof Error ? saveError.message.replace(/^\d+:\s*/, "") : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleBarrier = (code: string) => {
    setSelectedBarriers((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  };

  const saveSetup = async () => {
    if (!consented) {
      toast({ title: "Consent is required", description: "Choose consent to save optional preferences and barriers.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveHydrationHubPreferences({ consented: true, preferences });
      await saveHydrationHubBarriers({
        barriers: selectedBarriers.map((barrierCode, index) => ({
          barrierCode,
          ...(index === 0 && barrierNote.trim() ? { note: barrierNote.trim() } : {}),
        })),
      });
      await load();
      toast({ title: "Hydration setup saved", description: "You can reset or opt out at any time." });
    } catch (saveError) {
      toast({ title: "Could not save setup", description: saveError instanceof Error ? saveError.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const optOut = async () => {
    setSaving(true);
    try {
      await saveHydrationHubPreferences({ consented: false, optedOut: true, preferences: {} });
      await saveHydrationHubBarriers({ barriers: [] });
      setConsented(false); setSelectedBarriers([]); setBarrierNote("");
      setPreferences({ flavor: "no_preference", temperature: "no_preference", carbonation: "no_preference" });
      setHelpOptions([]);
      initializedSetup.current = false;
      await load();
      toast({ title: "Hydration setup cleared", description: "Fluid history was not deleted." });
    } finally { setSaving(false); }
  };

  const getHelp = async () => {
    if (!consented || !selectedBarriers.length) {
      toast({ title: "Choose and save a barrier first", description: "Practical options use only the preferences you consent to share." });
      return;
    }
    setSaving(true);
    try {
      const result = await createHydrationHelp({ barriers: selectedBarriers, preferences });
      setHelpOptions(result.options);
      await load();
    } catch (helpError) {
      toast({ title: "Could not create options", description: helpError instanceof Error ? helpError.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const chooseIntervention = async (option: Intervention) => {
    await recordHydrationInterventionEvent(option.id, "accepted");
    if (option.destinationType === "beverage_creator") {
      await recordHydrationInterventionEvent(option.id, "opened", { destination: "beverage_creator" });
      const params = new URLSearchParams({
        hydrationHandoff: "1", interventionId: option.id, barrier: option.barrierCode,
        flavor: preferences.flavor || "no_preference",
      });
      navigate(`/lifestyle/beverage-creator?${params.toString()}`);
      return;
    }
    await recordHydrationInterventionEvent(option.id, "completed");
    toast({ title: "Saved as something to try", description: "Come back to Hydration Hub and tell us what worked." });
    await load();
  };

  const projections = state?.projections;
  const today = projections?.today || { totalFluidsMl: state?.totalLoggedMl || 0, plainWaterMl: state?.totalLoggedMl || 0, beverageMix: [] };
  const policy = state?.numericPolicy;
  const copy = policy ? policyCopy(policy) : null;
  const options = helpOptions.length ? helpOptions : (state?.interventions || []).slice(0, 4);
  const dailyRows = (projections?.dailyTotals || []).filter((row) => {
    if (historyWindow === "30") return true;
    if (historyWindow === "7") return row.localDate >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return row.localDate === state?.localDate;
  }).reverse();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/hydration-hub-bg.png')" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(2,15,30,.86)_0%,rgba(3,31,54,.72)_38%,rgba(2,15,30,.9)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(14,116,144,.18),transparent_42%)]"
      />
      <div className="relative z-10 min-h-screen">
      <header data-testid="hydration-header" className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl lg:hidden" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-3 pt-2">
          <Button data-testid="hydration-back-button" variant="outline" size="sm" onClick={() => navigate("/my-biometrics")} className="border-slate-300 bg-white text-black shadow-sm hover:bg-slate-100 hover:text-black"><ArrowLeft className="mr-1.5 h-4 w-4" />Back to Biometrics</Button>
          <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold text-white">Hydration Hub</h1><p className="text-xs text-white">Track fluids, solve barriers, see what helps</p></div>
          <Badge className="border-sky-300/20 bg-sky-400/10 text-white">Everyday support</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-[calc(env(safe-area-inset-top,0px)+5.75rem)] text-white lg:pt-0">
        <button
          type="button"
          data-testid="desktop-hydration-back-button"
          onClick={() => navigate("/my-biometrics")}
          className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/10 lg:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Biometrics
        </button>
        {loading ? <div className="grid min-h-80 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-sky-300" /></div> : error ? (
          <Card className="border-white/10 bg-slate-950/45 text-white"><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><Info className="mb-3 h-8 w-8 text-amber-300" /><p className="font-semibold text-white">Hydration is unavailable</p><p className="mt-1 text-sm text-white">{error}</p><Button onClick={() => void load()} className="mt-4">Try again</Button></CardContent></Card>
        ) : state && policy && copy ? <>
          <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
            <Card className="overflow-hidden border-white/10 bg-slate-950/45 text-white shadow-2xl backdrop-blur-xl">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs uppercase tracking-[.2em] text-white">Today</p><h2 className="mt-1 text-xl font-semibold text-white">Total fluids and plain water</h2></div>
                  <Droplets className="h-7 w-7 text-sky-300" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-sky-300/15 bg-sky-400/10 p-4 text-white"><p className="text-xs text-white">Total fluids</p><p className="mt-1 text-3xl font-bold text-white">{mlToOz(today.totalFluidsMl)} <span className="text-sm font-medium text-white">oz</span></p><p className="text-xs text-white">{today.totalFluidsMl.toLocaleString()} mL</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-white"><p className="text-xs text-white">Plain water</p><p className="mt-1 text-3xl font-bold text-white">{mlToOz(today.plainWaterMl)} <span className="text-sm font-medium text-white">oz</span></p><p className="text-xs text-white">{today.plainWaterMl.toLocaleString()} mL</p></div>
                </div>
                {!!today.beverageMix.length && <div className="mt-4 flex flex-wrap gap-2">{today.beverageMix.map((item) => <Badge key={item.beverageClass} variant="outline" className="border-white/10 text-white">{BEVERAGES.find(([value]) => value === item.beverageClass)?.[1] || item.beverageClass}: {mlToOz(item.amountMl)} oz</Badge>)}</div>}
                <div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4 text-white"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-300" /><h3 className="font-semibold text-white">{copy.title}</h3></div><p className="mt-2 text-sm leading-relaxed text-white">{copy.body}</p><p className="mt-2 text-xs text-white">Preferences may change practical suggestions, never physiological requirements.</p></div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><CardContent className="p-5">
              <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-sky-300" /><h2 className="font-semibold text-white">Log a fluid</h2></div>
              <label className="mt-4 block text-xs text-white">Beverage</label>
              <select value={beverageClass} onChange={(event) => setBeverageClass(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" data-testid="hydration-beverage-class">{BEVERAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <div className="mt-3 grid grid-cols-2 gap-2">{[8, 12, 16, 24].map((ounces) => <Button key={ounces} disabled={saving} onClick={() => void addFluid(ounces, "oz")} className="border border-sky-300/20 bg-sky-500/15 text-sky-50 hover:bg-sky-500/25" data-testid={`hydration-add-${ounces}oz`}>+{ounces} oz</Button>)}</div>
              <div className="mt-3 flex gap-2"><Input inputMode="decimal" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Custom amount" className="border-white/10 bg-white/5 text-white" data-testid="hydration-custom-amount" /><select value={customUnit} onChange={(event) => setCustomUnit(event.target.value as "oz" | "ml")} className="rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="oz">oz</option><option value="ml">mL</option></select></div>
              <Button disabled={saving || Number(customAmount) <= 0} onClick={() => void addFluid(Number(customAmount), customUnit)} className="mt-2 w-full bg-sky-500 text-white hover:bg-sky-400 hover:text-white" data-testid="hydration-add-custom">{saving ? "Saving…" : "Add to today"}</Button>
              <p className="mt-3 text-xs leading-relaxed text-white">Fluid contribution is tracked separately from calories, sugar, sodium, and other nutrition.</p>
            </CardContent></Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><CardContent className="p-5">
              <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-violet-300" /><h2 className="font-semibold text-white">What gets in the way?</h2></div>
              <p className="mt-2 text-sm text-white">Optional setup helps choose practical strategies. It never changes a hydration requirement.</p>
              <div className="mt-4 flex flex-wrap gap-2">{BARRIERS.map(([code, label]) => <button key={code} onClick={() => toggleBarrier(code)} className={`rounded-full border px-3 py-2 text-xs text-white transition ${selectedBarriers.includes(code) ? "border-violet-300/50 bg-violet-400/20" : "border-white/30 bg-white/[.03] hover:bg-white/[.07]"}`}>{selectedBarriers.includes(code) && <Check className="mr-1 inline h-3 w-3" />}{label}</button>)}</div>
              <Textarea value={barrierNote} onChange={(event) => setBarrierNote(event.target.value)} maxLength={500} placeholder="Optional note about what makes this hard" className="mt-3 border-white/30 bg-white/5 text-white placeholder:text-white" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[["flavor", "Flavor", ["no_preference", "citrus", "berry", "mild"]], ["temperature", "Temperature", ["no_preference", "cold", "room", "warm"]], ["carbonation", "Bubbles", ["no_preference", "still", "sparkling"]]].map(([key, label, values]) => <label key={key as string} className="text-[11px] text-white">{label as string}<select value={preferences[key as string]} onChange={(event) => setPreferences((current) => ({ ...current, [key as string]: event.target.value }))} className="mt-1 w-full rounded-md border border-white/30 bg-slate-900 px-2 py-2 text-xs text-white">{(values as string[]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>)}
              </div>
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-white/30 bg-white/[.03] p-3 text-xs text-white"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} className="mt-0.5" /><span>I consent to saving these optional preferences and barriers for Hydration Hub suggestions.</span></label>
              <div className="mt-3 flex gap-2"><Button disabled={saving} onClick={() => void saveSetup()} className="flex-1 bg-violet-500 hover:bg-violet-400">Save setup</Button><Button disabled={saving} onClick={() => void optOut()} variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><RotateCcw className="mr-1.5 h-4 w-4" />Reset & opt out</Button></div>
            </CardContent></Card>

            <Card className="border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><CardContent className="p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-300" /><h2 className="font-semibold text-white">Help Me Get It In</h2></div><Button size="sm" disabled={saving} onClick={() => void getHelp()} className="bg-amber-400 text-white hover:bg-amber-300"><Sparkles className="mr-1.5 h-4 w-4" />Get options</Button></div>
              <p className="mt-2 text-sm text-white">Small, nonnumeric strategies based on the barrier you chose.</p>
              <div className="mt-4 space-y-2">{options.length ? options.map((option) => <div key={option.id} className="rounded-xl border border-white/30 bg-white/[.04] p-3 text-white"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="mb-2 border-white/30 text-[10px] text-white">{BARRIER_LABELS[option.barrierCode] || option.barrierCode}</Badge><h3 className="text-sm font-semibold text-white">{option.title}</h3><p className="mt-1 text-xs leading-relaxed text-white">{option.description}</p></div><Button size="sm" onClick={() => void chooseIntervention(option)} className="shrink-0 bg-white/10 text-white hover:bg-white/20">{option.destinationType === "beverage_creator" ? "Create" : "Try it"}</Button></div></div>) : <div className="rounded-xl border border-dashed border-white/30 p-6 text-center text-sm text-white">Save a barrier, then ask for practical options.</div>}</div>
            </CardContent></Card>
          </section>

          <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
            <Card className="border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-sky-300" /><h2 className="font-semibold text-white">Descriptive history</h2></div><div className="flex rounded-lg border border-white/30 bg-black/15 p-1">{(["today", "7", "30"] as const).map((window) => <button key={window} onClick={() => setHistoryWindow(window)} className={`rounded-md px-3 py-1.5 text-xs text-white ${historyWindow === window ? "bg-sky-400/20" : ""}`}>{window === "today" ? "Today" : `${window} days`}</button>)}</div></div>
              {historyWindow === "today" ? <div className="mt-4 space-y-2">{state.todayHistory?.length ? state.todayHistory.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/30 bg-white/[.04] px-3 py-2.5 text-white"><div><span className="text-sm text-white">{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(item.intakeTime))}</span><span className="ml-2 text-xs text-white">{BEVERAGES.find(([value]) => value === item.beverageClass)?.[1] || item.beverageClass}</span></div><span className="font-medium text-white">{mlToOz(item.amountMl)} oz <span className="ml-1 text-xs font-normal text-white">{item.amountMl} mL</span></span></div>) : <p className="rounded-xl border border-dashed border-white/30 p-5 text-center text-sm text-white">No fluids logged yet today.</p>}</div> : <div className="mt-4 space-y-2">{dailyRows.length ? dailyRows.map((row) => <div key={row.localDate} className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-xl border border-white/30 bg-white/[.04] px-3 py-2.5 text-sm text-white"><span className="text-white">{new Date(`${row.localDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><span className="text-white">{mlToOz(row.totalMl)} oz total</span><span className="text-white">{mlToOz(row.plainWaterMl)} oz water</span></div>) : <p className="rounded-xl border border-dashed border-white/30 p-5 text-center text-sm text-white">No entries in this window.</p>}</div>}
              <p className="mt-3 text-xs text-white">History describes what you logged. It does not diagnose hydration status or prescribe a target.</p>
            </CardContent></Card>

            <Card className="border-white/10 bg-slate-950/45 text-white backdrop-blur-xl"><CardContent className="p-5">
              <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-sky-300" /><h2 className="font-semibold text-white">Learn & reflect</h2></div>
              <p className="mt-3 text-sm leading-relaxed text-white">Reviewed sources explain hydration concepts without converting population references into a personal target.</p>
              <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/30 bg-white/[.04] p-3 text-white"><p className="text-xs text-white">Options tried</p><p className="mt-1 text-2xl font-semibold text-white">{state.outcomeCounts?.accepted || 0}</p></div><div className="rounded-xl border border-white/30 bg-white/[.04] p-3 text-white"><p className="text-xs text-white">Completed</p><p className="mt-1 text-2xl font-semibold text-white">{state.outcomeCounts?.completed || 0}</p></div></div>
              <div className="mt-4 flex flex-col gap-2"><MedicalSourcesInfo trigger={<Button className="w-full bg-white/10 text-white hover:bg-white/15"><GlassWater className="mr-2 h-4 w-4" />View hydration sources</Button>} /><Button onClick={() => navigate("/learn?topic=hydration")} variant="outline" className="w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white">Open learning library</Button></div>
              <p className="mt-4 text-xs leading-relaxed text-white">Products, sponsorships, and affiliate relationships never determine nutrition or clinical eligibility. Hydration Hub Phase 1 does not recommend products or supplements.</p>
            </CardContent></Card>
          </section>
        </> : null}
      </main>
      </div>
    </motion.div>
  );
}