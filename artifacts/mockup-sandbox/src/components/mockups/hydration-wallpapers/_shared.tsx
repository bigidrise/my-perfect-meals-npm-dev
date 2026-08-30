import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, BookOpen, Check, Clock3, Droplets, GlassWater, Lightbulb, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles } from "lucide-react";

type Props = { image: string; name: string; eyebrow: string; accent: string; note: string };

const barriers = ["I forget", "Taste", "Temperature", "I prefer bubbles", "Access", "Timing", "Bathroom concerns"];
const beverages = ["Plain water", "Sparkling", "Tea", "Coffee", "Milk", "Juice", "Other"];

export function HydrationHubPreview({ image, name, eyebrow, accent, note }: Props) {
  const [ounces, setOunces] = useState(28);
  const [selected, setSelected] = useState<string[]>(["I forget"]);
  const [window, setWindow] = useState("Today");
  const [saved, setSaved] = useState(false);
  const [beverage, setBeverage] = useState("Plain water");
  const [custom, setCustom] = useState("");
  const add = (amount: number) => setOunces((v) => v + amount);
  const toggle = (item: string) => setSelected((v) => v.includes(item) ? v.filter((x) => x !== item) : [...v, item]);
  return (
    <div className="min-h-screen bg-[#061c24] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg,rgba(2,15,23,.38),rgba(3,19,26,.82) 55%,#06151c 100%),url(${image})` }} />
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#061920]/80 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <button className="hidden items-center gap-2 text-sm text-white/80 hover:text-white sm:flex"><ArrowLeft size={16} /> Back to Biometrics</button>
            <div className="sm:hidden"><p className="text-[10px] uppercase tracking-[.22em] text-white/60">My Perfect Meals</p><h1 className="text-lg font-semibold">Hydration Hub</h1></div>
            <div className="flex items-center gap-2"><span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 md:inline">{eyebrow}</span><span className="h-2 w-2 rounded-full bg-[#7bd8cf]" /><span className="text-xs text-white/65">Safe shell</span></div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 pb-14">
          <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="mb-1 text-xs uppercase tracking-[.25em]" style={{ color: accent }}>{name} / design study</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Hydration Hub</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{note} Track what you log, review descriptive history, and choose practical support without turning fluid into a prescription.</p></div>
            <div className="rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-right backdrop-blur-md"><p className="text-[10px] uppercase tracking-[.2em] text-white/55">Today</p><p className="mt-1 text-sm font-medium text-[#b9eee8]">Everyday support</p></div>
          </section>

          <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
            <Panel>
              <div className="flex items-start justify-between"><div><Kicker>Today</Kicker><h2 className="mt-1 text-xl font-semibold">Total fluids and plain water</h2></div><Droplets size={25} color={accent}/></div>
              <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Total fluids" value={`${ounces} oz`} sub={`${Math.round(ounces * 29.57).toLocaleString()} mL`} tint={accent}/><Metric label="Plain water" value={`${ounces - 4} oz`} sub={`${Math.round((ounces - 4) * 29.57).toLocaleString()} mL`}/></div>
              <div className="mt-4 flex flex-wrap gap-2"><Tag>Plain water: {ounces - 4} oz</Tag><Tag>Tea: 4 oz</Tag></div>
              <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-2"><ShieldCheck size={18} color={accent}/><h3 className="text-sm font-semibold">Track without a formula</h3></div><p className="mt-2 text-sm leading-relaxed text-white/75">No personal numeric target has been set by an authorized clinician. You can still track fluids and get practical help.</p><p className="mt-2 text-xs text-white/45">Preferences may change practical suggestions, never physiological requirements.</p></div>
            </Panel>
            <Panel>
              <div className="flex items-center gap-2"><Plus size={19} color={accent}/><h2 className="font-semibold">Log a fluid</h2></div>
              <label className="mt-4 block text-xs text-white/60">Beverage</label><select value={beverage} onChange={(e) => setBeverage(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a2730] px-3 py-2.5 text-sm text-white">{beverages.map((x) => <option key={x}>{x}</option>)}</select>
              <div className="mt-3 grid grid-cols-2 gap-2">{[8,12,16,24].map((x) => <button key={x} onClick={() => add(x)} className="rounded-lg border border-[#79d8d0]/25 bg-[#79d8d0]/10 py-2.5 text-sm text-[#d4fffa] transition hover:bg-[#79d8d0]/20">+{x} oz</button>)}</div>
              <div className="mt-3 flex gap-2"><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom amount" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/35" /><span className="rounded-lg border border-white/15 bg-[#0a2730] px-3 py-2.5 text-sm text-white/70">oz</span></div>
              <button onClick={() => { if (Number(custom) > 0) { add(Number(custom)); setCustom(""); } }} className="mt-2 w-full rounded-lg bg-[#71d6cc] py-2.5 text-sm font-semibold text-[#062128] hover:bg-[#93e6de]">Add to today</button>
              <p className="mt-3 text-xs leading-relaxed text-white/50">Fluid contribution is tracked separately from calories, sugar, sodium, and other nutrition.</p>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel><div className="flex items-center gap-2"><Settings2 size={19} color="#c4a7f9"/><h2 className="font-semibold">What gets in the way?</h2></div><p className="mt-2 text-sm text-white/65">Optional setup helps choose practical strategies. It never changes a hydration requirement.</p><div className="mt-4 flex flex-wrap gap-2">{barriers.map((x) => <button key={x} onClick={() => toggle(x)} className={`rounded-full border px-3 py-2 text-xs transition ${selected.includes(x) ? "border-[#c5a9fa]/60 bg-[#a980e8]/25 text-white" : "border-white/15 bg-white/[.03] text-white/70 hover:bg-white/10"}`}>{selected.includes(x) && <Check size={12} className="mr-1 inline" />}{x}</button>)}</div><textarea placeholder="Optional note about what makes this hard" className="mt-3 h-20 w-full resize-none rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/35"/><div className="mt-3 grid grid-cols-3 gap-2">{["Flavor","Temperature","Bubbles"].map((x) => <label key={x} className="text-[11px] text-white/60">{x}<select className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a2730] px-2 py-2 text-xs text-white"><option>No preference</option><option>Cold</option><option>Warm</option></select></label>)}</div><label className="mt-4 flex gap-2 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs leading-relaxed text-white/65"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 accent-[#a980e8]"/>I consent to saving these optional preferences and barriers for Hydration Hub suggestions.</label><div className="mt-3 flex gap-2"><button onClick={() => setSaved(true)} className="flex-1 rounded-lg bg-[#a980e8] py-2.5 text-sm font-semibold text-[#20152e]">Save setup</button><button onClick={() => {setSaved(false);setSelected([])}} className="rounded-lg border border-white/15 bg-transparent px-3 text-sm text-white/75 hover:bg-white/10"><RotateCcw size={15} className="mr-1 inline"/>Reset & opt out</button></div></Panel>
            <Panel><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Lightbulb size={19} color="#f4c76d"/><h2 className="font-semibold">Help Me Get It In</h2></div><button onClick={() => setSelected(["I forget","Taste"])} className="rounded-lg bg-[#f3c46c] px-3 py-2 text-xs font-semibold text-[#2e2514]"><Sparkles size={14} className="mr-1 inline"/>Get options</button></div><p className="mt-2 text-sm text-white/65">Small, nonnumeric strategies based on the barrier you chose.</p><div className="mt-4 space-y-2">{["Keep a filled bottle where you already pause.","Try a chilled, lightly flavored option with your next meal.","Pair a few sips with an existing routine."].map((x, i) => <div key={x} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[.04] p-3"><div><Tag>{i === 0 ? "I forget" : "Taste"}</Tag><h3 className="mt-2 text-sm font-semibold">{x}</h3><p className="mt-1 text-xs text-white/55">A practical experiment, not a requirement.</p></div><button onClick={() => setSaved(true)} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20">{saved ? "Saved" : "Try it"}</button></div>)}</div></Panel>
          </section>

          <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
            <Panel><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Clock3 size={19} color={accent}/><h2 className="font-semibold">Descriptive history</h2></div><div className="flex rounded-lg border border-white/10 bg-black/20 p-1">{["Today","7 days","30 days"].map((x) => <button key={x} onClick={() => setWindow(x)} className={`rounded-md px-3 py-1.5 text-xs ${window === x ? "bg-[#79d8d0]/20 text-white" : "text-white/55"}`}>{x}</button>)}</div></div><div className="mt-4 space-y-2">{[["9:10 AM","Plain water","12 oz"],["11:45 AM","Tea","4 oz"],["1:20 PM","Plain water","8 oz"]].map((r) => <div key={r[0]} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-3 py-3 text-sm"><span><span className="text-white/80">{r[0]}</span><span className="ml-3 text-xs text-white/50">{r[1]}</span></span><span className="font-medium text-[#c7f4ef]">{r[2]}</span></div>)}</div><p className="mt-3 text-xs text-white/45">History describes what you logged. It does not diagnose hydration status or prescribe a target.</p></Panel>
            <Panel><div className="flex items-center gap-2"><BookOpen size={19} color={accent}/><h2 className="font-semibold">Learn & reflect</h2></div><p className="mt-3 text-sm leading-relaxed text-white/65">Reviewed sources explain hydration concepts without converting population references into a personal target.</p><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Options tried" value="4"/><Metric label="Completed" value="2"/></div><button className="mt-4 w-full rounded-lg bg-white/10 py-2.5 text-sm hover:bg-white/15"><GlassWater size={15} className="mr-2 inline" />View hydration sources</button><button className="mt-2 w-full rounded-lg border border-white/15 py-2.5 text-sm text-white/75 hover:bg-white/10">Open learning library</button><p className="mt-4 text-xs leading-relaxed text-white/40">Products, sponsorships, and affiliate relationships never determine nutrition or clinical eligibility.</p></Panel>
          </section>
        </main>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) { return <div className="rounded-2xl border border-white/10 bg-[#071b24]/65 p-5 shadow-2xl backdrop-blur-xl sm:p-6">{children}</div>; }
function Kicker({ children }: { children: ReactNode }) { return <p className="text-[10px] uppercase tracking-[.22em] text-white/50">{children}</p>; }
function Metric({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint?: string }) { return <div className="rounded-xl border border-white/10 bg-white/[.05] p-4"><p className="text-xs text-white/55">{label}</p><p className="mt-1 text-2xl font-semibold" style={tint ? { color: tint } : undefined}>{value}</p>{sub && <p className="text-xs text-white/45">{sub}</p>}</div>; }
function Tag({ children }: { children: ReactNode }) { return <span className="inline-block rounded-full border border-white/15 bg-white/[.04] px-2.5 py-1 text-[11px] text-white/65">{children}</span>; }