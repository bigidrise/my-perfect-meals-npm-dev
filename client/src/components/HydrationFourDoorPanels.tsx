import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardList,
  Droplets,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  activateHydrationLiquidProtocol,
  createHydrationLiquidProtocol,
  createHydrationHandoff,
  type HydrationCenterState,
  type HydrationDoorKey,
  type HydrationProtocolRecord,
  type HydrationProtocolType,
} from "@/lib/hydrationApi";
import { sickDayHydrationRequiresEscalation } from "@shared/hydration/fourDoor";

type Props = {
  state: HydrationCenterState | null;
  navigate: (path: string) => void;
  onReload: () => Promise<void>;
};

const DOORS: Array<{
  key: HydrationDoorKey;
  title: string;
  description: string;
  icon: typeof Droplets;
}> = [
  {
    key: "everyday",
    title: "Everyday Hydration",
    description: "Track fluids and solve everyday barriers.",
    icon: Droplets,
  },
  {
    key: "athletic",
    title: "Athletic Hydration",
    description: "Organize support around activity—without a formula.",
    icon: Activity,
  },
  {
    key: "sick_day",
    title: "Sick-Day Hydration",
    description: "Find tolerable, low-effort support and escalation guidance.",
    icon: HeartPulse,
  },
  {
    key: "liquid_nutrition",
    title: "Liquid Nutrition Support",
    description: "Organize explicit temporary instructions without filling blanks.",
    icon: ClipboardList,
  },
];

const SICK_DAY_OPTIONS = [
  ["nausea", "Nausea"],
  ["vomiting", "Vomiting"],
  ["diarrhea", "Diarrhea"],
  ["low_appetite", "Low appetite"],
  ["sore_throat", "Sore throat"],
  ["feeling_unwell", "Feeling unwell"],
  ["unable_to_keep_fluids", "Unable to keep fluids down"],
  ["fainting_or_confusion", "Fainting or confusion"],
  ["trouble_breathing_or_chest_pain", "Trouble breathing or chest pain"],
  ["blood", "Blood in vomit or stool"],
] as const;

const LIQUID_PROTOCOL_TYPES: Array<[HydrationProtocolType, string]> = [
  ["clear_liquid", "Clear liquid"],
  ["full_liquid", "Full liquid"],
  ["modified_liquid", "Modified liquid"],
  ["other", "Other instruction"],
];

function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function nextLocalDate(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString().slice(0, 10);
}

function protocolStatusLabel(protocol: HydrationProtocolRecord) {
  if (protocol.status === "active") return "Active";
  if (protocol.status === "expired") return "Expired";
  if (protocol.status === "needs_review") return "Needs clarification";
  return "Draft review";
}

function unresolvedLabel(code: string) {
  if (code === "TIMING_NOT_STATED") return "Timing or frequency was not stated.";
  if (code === "CONFLICTING_ITEM_CATEGORIES") return "A category is both allowed and restricted.";
  return "Allowed or restricted categories were not provided.";
}

export default function HydrationFourDoorPanels({ state, navigate, onReload }: Props) {
  const { toast } = useToast();
  const [door, setDoor] = useState<HydrationDoorKey>("everyday");

  const [athleticPhase, setAthleticPhase] = useState("before");
  const [athleticActivity, setAthleticActivity] = useState("training");
  const [athleticDuration, setAthleticDuration] = useState("");
  const [athleticEnvironment, setAthleticEnvironment] = useState("unknown");

  const [sickDaySymptoms, setSickDaySymptoms] = useState<string[]>([]);

  const [reason, setReason] = useState("");
  const [protocolType, setProtocolType] = useState<HydrationProtocolType>("clear_liquid");
  const [originalInstructionText, setOriginalInstructionText] = useState("");
  const [startsOn, setStartsOn] = useState(state?.localDate ?? "");
  const [endsOn, setEndsOn] = useState(state ? nextLocalDate(state.localDate) : "");
  const [reviewOn, setReviewOn] = useState("");
  const [allowedCategories, setAllowedCategories] = useState("");
  const [restrictedCategories, setRestrictedCategories] = useState("");
  const [textureRequirements, setTextureRequirements] = useState("");
  const [explicitTimingText, setExplicitTimingText] = useState("");
  const [protocol, setProtocol] = useState<HydrationProtocolRecord | null>(
    state?.liquidProtocol ?? null,
  );
  const [protocolSaving, setProtocolSaving] = useState(false);
  const [creatorOpening, setCreatorOpening] = useState(false);
  const [activationConfirmed, setActivationConfirmed] = useState(false);

  useEffect(() => {
    if (!state) return;
    setProtocol(state.liquidProtocol ?? null);
    setStartsOn(state.localDate);
    setEndsOn(nextLocalDate(state.localDate));
  }, [state]);

  const urgentSickDay = useMemo(
    () => sickDayHydrationRequiresEscalation(sickDaySymptoms),
    [sickDaySymptoms],
  );

  const toggleSickDaySymptom = (symptom: string) => {
    setSickDaySymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  };

  const openAthleticCreator = async () => {
    const details = [
      `Hydration context: ${athleticPhase} activity`,
      `Activity: ${athleticActivity}`,
      athleticDuration.trim() ? `Approximate duration supplied by user: ${athleticDuration.trim()}` : "",
      `Environment context: ${athleticEnvironment}`,
      "Do not invent hydration targets, electrolyte dosing, or medical treatment. Preserve all saved dietary and safety constraints.",
    ].filter(Boolean).join(". ");
    try {
      const handoff = await createHydrationHandoff({
        door: "athletic",
        description: details,
      });
      const params = new URLSearchParams({ hydrationHandoff: handoff.token });
      navigate(`/lifestyle/athlete-beverage-creator?${params.toString()}`);
    } catch (error) {
      toast({
        title: "Could not open the Creator",
        description: error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openEverydayCreator = async () => {
    setCreatorOpening(true);
    try {
      const handoff = await createHydrationHandoff({
        door: "everyday",
        description:
          "Create a practical Everyday Hydration beverage. Preserve all saved dietary and safety constraints and do not invent a medical fluid target.",
      });
      const params = new URLSearchParams({ hydrationHandoff: handoff.token });
      navigate(`/lifestyle/beverage-creator?${params.toString()}`);
    } catch (error) {
      toast({
        title: "Could not open the Creator",
        description:
          error instanceof Error
            ? error.message.replace(/^\d+:\s*/, "")
            : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatorOpening(false);
    }
  };

  const saveLiquidProtocol = async () => {
    if (!reason.trim() || !originalInstructionText.trim()) {
      toast({
        title: "More instruction is needed",
        description: "Add the reason and paste the original instruction so the review stays faithful.",
        variant: "destructive",
      });
      return;
    }
    setProtocolSaving(true);
    try {
      const result = await createHydrationLiquidProtocol({
        reason: reason.trim(),
        protocolType,
        originalInstructionText: originalInstructionText.trim(),
        startsOn,
        endsOn,
        reviewOn: reviewOn || null,
        allowedCategories: splitList(allowedCategories),
        restrictedCategories: splitList(restrictedCategories),
        textureRequirements: splitList(textureRequirements),
        explicitTimingText: explicitTimingText.trim(),
      });
      setProtocol(result.protocol);
      setActivationConfirmed(false);
      await onReload();
      toast({
        title: "Instructions ready for review",
        description: "Nothing becomes active until you confirm what was captured.",
      });
    } catch (error) {
      toast({
        title: "Could not save instructions",
        description: error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setProtocolSaving(false);
    }
  };

  const activateProtocol = async () => {
    if (!protocol || !activationConfirmed) return;
    setProtocolSaving(true);
    try {
      const result = await activateHydrationLiquidProtocol(protocol.id);
      setProtocol(result.protocol);
      await onReload();
      toast({
        title: "Temporary support activated",
        description: "The Hub will stop showing it after the supplied end date.",
      });
    } catch (error) {
      toast({
        title: "Clarification is needed",
        description: error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "This instruction could not be activated.",
        variant: "destructive",
      });
    } finally {
      setProtocolSaving(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="hydration-four-doors">
      <div className="rounded-2xl border border-white/15 bg-slate-950/55 p-4 shadow-xl backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-white">Choose a Hydration door</p>
            <p className="mt-1 text-sm leading-relaxed text-white">
              One Hub, four kinds of support. Everyday tools stay simple; the other doors add context without creating an automatic medical plan.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DOORS.map(({ key, title, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              data-testid={`hydration-door-${key}`}
              aria-pressed={door === key}
              onClick={() => setDoor(key)}
              className={`group rounded-xl border p-3 text-left transition ${
                door === key
                  ? "border-sky-200 bg-sky-400/20 shadow-[0_0_0_1px_rgba(186,230,253,0.9),0_0_18px_rgba(56,189,248,0.35)]"
                  : "border-white/15 bg-white/[.04] hover:border-sky-200/60 hover:bg-white/[.08]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-sky-200" />
                <ChevronRight className="h-4 w-4 text-white/60 transition group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white">{description}</p>
            </button>
          ))}
        </div>
      </div>

      {door === "everyday" && (
        <Card className="border-sky-300/20 bg-sky-950/35 text-white backdrop-blur-xl">
          <CardContent className="flex items-start gap-3 p-4">
            <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-white">Everyday support is ready below</h2>
              <p className="mt-1 text-sm leading-relaxed text-white">
                Log a fluid, save optional preferences, or ask for a practical barrier-based option. These tools never create a personal target.
              </p>
              <Button
                onClick={() => void openEverydayCreator()}
                disabled={creatorOpening}
                className="mt-4 bg-sky-400 text-slate-950 hover:bg-sky-300"
                data-testid="everyday-hydration-creator"
              >
                {creatorOpening ? "Opening Creator…" : "Create a Hydration Beverage"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {door === "athletic" && (
        <Card className="border-orange-300/20 bg-orange-950/30 text-white backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-orange-200" />
              <div>
                <h2 className="font-semibold text-white">Athletic Hydration</h2>
                <p className="mt-1 text-sm leading-relaxed text-white">
                  Capture context for a practical beverage idea. This does not calculate fluid replacement, electrolytes, sodium, or a sports-medicine prescription.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white">
                When
                <select value={athleticPhase} onChange={(event) => setAthleticPhase(event.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white" data-testid="athletic-hydration-phase">
                  <option value="before">Before activity</option>
                  <option value="during">During activity</option>
                  <option value="after">After activity</option>
                </select>
              </label>
              <label className="text-xs text-white">
                Activity
                <select value={athleticActivity} onChange={(event) => setAthleticActivity(event.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white" data-testid="athletic-hydration-activity">
                  <option value="training">Training</option>
                  <option value="competition">Competition</option>
                  <option value="outdoor">Outdoor activity</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs text-white">
                Approximate duration (optional)
                <Input value={athleticDuration} onChange={(event) => setAthleticDuration(event.target.value)} placeholder="e.g. 45 minutes" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="athletic-hydration-duration" />
              </label>
              <label className="text-xs text-white">
                Environment context
                <select value={athleticEnvironment} onChange={(event) => setAthleticEnvironment(event.target.value)} className="mt-1 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white" data-testid="athletic-hydration-environment">
                  <option value="unknown">Not sure / skip</option>
                  <option value="indoors">Indoors</option>
                  <option value="outdoors">Outdoors</option>
                  <option value="hot_or_humid">Hot or humid context</option>
                </select>
              </label>
            </div>
            <Button onClick={() => void openAthleticCreator()} className="mt-4 bg-orange-400 text-slate-950 hover:bg-orange-300" data-testid="athletic-hydration-creator">
              Create an Athletic Hydration Beverage
            </Button>
            <p className="mt-3 text-xs text-white">The Creator remains responsible for formulation and runs its normal safety checks.</p>
          </CardContent>
        </Card>
      )}

      {door === "sick_day" && (
        <Card className="border-rose-300/20 bg-rose-950/30 text-white backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
              <div>
                <h2 className="font-semibold text-white">Sick-Day Hydration</h2>
                <p className="mt-1 text-sm leading-relaxed text-white">
                  Choose what is making fluids difficult so the Hub can keep support practical and tolerable. This is not a diagnosis or a treatment calculator.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SICK_DAY_OPTIONS.map(([value, label]) => (
                <label key={value} className="flex items-start gap-2 rounded-lg border border-white/15 bg-white/[.04] p-3 text-sm text-white">
                  <input type="checkbox" checked={sickDaySymptoms.includes(value)} onChange={() => toggleSickDaySymptom(value)} className="mt-0.5" data-testid={`sick-day-${value}`} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {urgentSickDay ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-300/40 bg-rose-400/15 p-4 text-sm text-white" role="alert" data-testid="sick-day-escalation">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
                <p>If any selected warning sign is happening now, seek urgent medical help or local emergency guidance rather than relying on this Hub.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-white/15 bg-white/[.04] p-4 text-sm leading-relaxed text-white">
                Practical ideas: choose a familiar temperature, keep an easy-to-reach fluid nearby, and take comfortable sips as tolerated. Stop and seek care if you are getting worse or cannot keep fluids down.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {door === "liquid_nutrition" && !state && (
        <Card className="border-violet-300/20 bg-violet-950/30 text-white backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" />
              <div>
                <h2 className="font-semibold text-white">Liquid Nutrition Support</h2>
                <p className="mt-1 text-sm leading-relaxed text-white">
                  Your saved instructions are being checked. This section will open when their current status is available.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {door === "liquid_nutrition" && state && (
        <Card className="border-violet-300/20 bg-violet-950/30 text-white backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" />
              <div>
                <h2 className="font-semibold text-white">Liquid Nutrition Support</h2>
                <p className="mt-1 text-sm leading-relaxed text-white">
                  Paste the instruction you received and add only the categories and timing stated in it. User-entered instructions are stored as unverified.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white sm:col-span-2">
                Reason
                <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are you organizing this instruction?" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-reason" />
              </label>
              <label className="text-xs text-white">
                Instruction type
                <select value={protocolType} onChange={(event) => setProtocolType(event.target.value as HydrationProtocolType)} className="mt-1 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white" data-testid="liquid-protocol-type">
                  {LIQUID_PROTOCOL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="rounded-md border border-violet-200/20 bg-violet-300/10 p-3 text-xs text-white">
                <p className="font-semibold">Source</p>
                <p className="mt-1">User-entered · not professionally verified</p>
              </div>
              <label className="text-xs text-white sm:col-span-2">
                Original instruction text
                <Textarea value={originalInstructionText} onChange={(event) => setOriginalInstructionText(event.target.value)} placeholder="Paste the original instruction exactly as you received it." className="mt-1 min-h-24 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-original-text" />
              </label>
              <label className="text-xs text-white">
                Start date
                <Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="mt-1 border-white/20 bg-white/5 text-white" data-testid="liquid-protocol-start" />
              </label>
              <label className="text-xs text-white">
                End date
                <Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="mt-1 border-white/20 bg-white/5 text-white" data-testid="liquid-protocol-end" />
              </label>
              <label className="text-xs text-white">
                Review date (optional)
                <Input type="date" value={reviewOn} onChange={(event) => setReviewOn(event.target.value)} className="mt-1 border-white/20 bg-white/5 text-white" data-testid="liquid-protocol-review" />
              </label>
              <label className="text-xs text-white">
                Timing/frequency exactly stated (optional)
                <Input value={explicitTimingText} onChange={(event) => setExplicitTimingText(event.target.value)} placeholder="e.g. sip with meals" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-timing" />
              </label>
              <label className="text-xs text-white">
                Allowed categories exactly stated (comma-separated)
                <Input value={allowedCategories} onChange={(event) => setAllowedCategories(event.target.value)} placeholder="e.g. broth, clear juice" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-allowed" />
              </label>
              <label className="text-xs text-white">
                Restricted categories exactly stated (comma-separated)
                <Input value={restrictedCategories} onChange={(event) => setRestrictedCategories(event.target.value)} placeholder="e.g. solid food" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-restricted" />
              </label>
              <label className="text-xs text-white sm:col-span-2">
                Texture requirements exactly stated (optional)
                <Input value={textureRequirements} onChange={(event) => setTextureRequirements(event.target.value)} placeholder="e.g. strained, no pulp" className="mt-1 border-white/20 bg-white/5 text-white placeholder:text-white/60" data-testid="liquid-protocol-texture" />
              </label>
            </div>
            <Button onClick={() => void saveLiquidProtocol()} disabled={protocolSaving} className="mt-4 bg-violet-400 text-slate-950 hover:bg-violet-300" data-testid="liquid-protocol-save">
              {protocolSaving ? "Saving…" : "Review instructions"}
            </Button>

            {protocol && (
              <div className="mt-5 rounded-2xl border border-white/20 bg-black/20 p-4" data-testid="liquid-protocol-review-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-violet-200/40 text-white">{protocolStatusLabel(protocol)}</Badge>
                    <Badge variant="outline" className="border-white/20 text-white">{protocol.verificationStatus === "unverified" ? "Unverified source" : "Professionally verified"}</Badge>
                  </div>
                  <span className="text-xs text-white">{protocol.startsOn} → {protocol.endsOn}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white">Reason</p>
                    <p className="mt-1 text-sm text-white">{protocol.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white">Timing</p>
                    <p className="mt-1 text-sm text-white">{protocol.explicitTimingText || "Not stated — needs clarification"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white">Allowed categories</p>
                    <p className="mt-1 text-sm text-white">{protocol.allowedCategories.length ? protocol.allowedCategories.join(", ") : "Not stated"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white">Restricted categories</p>
                    <p className="mt-1 text-sm text-white">{protocol.restrictedCategories.length ? protocol.restrictedCategories.join(", ") : "Not stated"}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/[.04] p-3">
                  <p className="text-xs uppercase tracking-wide text-white">Original instruction preserved</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white">{protocol.originalInstructionText}</p>
                </div>
                {protocol.unresolvedItems.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200/30 bg-amber-300/10 p-3" data-testid="liquid-protocol-unresolved">
                    <p className="text-sm font-semibold text-white">Needs clarification</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-white">
                      {protocol.unresolvedItems.map((item) => <li key={item.code}>{unresolvedLabel(item.code)}</li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-4 rounded-xl border border-white/15 bg-white/[.04] p-3">
                  <p className="text-xs uppercase tracking-wide text-white">Execution checklist</p>
                  <p className="mt-1 text-sm text-white">
                    {protocol.executionPlan.status === "ready"
                      ? `Explicit instruction carried across ${protocol.executionPlan.days.length} dated day${protocol.executionPlan.days.length === 1 ? "" : "s"}.`
                      : "No complete schedule was invented. The unresolved item must stay visible until clarified."}
                  </p>
                </div>
                {protocol.status !== "active" && protocol.status !== "expired" && (
                  <>
                    <label className="mt-4 flex items-start gap-2 text-xs text-white">
                      <input type="checkbox" checked={activationConfirmed} onChange={(event) => setActivationConfirmed(event.target.checked)} className="mt-0.5" data-testid="liquid-protocol-confirm" />
                      <span>I reviewed the fields above and confirm they reflect the instruction I supplied. I understand this is not professional verification.</span>
                    </label>
                    <Button onClick={() => void activateProtocol()} disabled={protocolSaving || !activationConfirmed || !protocol.handoffAllowed && protocol.unresolvedItems.some((item) => item.code !== "TIMING_NOT_STATED")} className="mt-3 bg-white/15 text-white hover:bg-white/25" data-testid="liquid-protocol-activate">
                      {protocolSaving ? "Activating…" : "Confirm and activate"}
                    </Button>
                  </>
                )}
                {protocol.status === "active" && (
                  <p className="mt-4 flex items-start gap-2 text-xs text-emerald-100"><Check className="h-4 w-4 shrink-0" />Active only through the supplied end date. The Hub does not advance or reinterpret it automatically.</p>
                )}
                {protocol.status === "active" && !protocol.handoffAllowed && (
                  <p className="mt-3 text-xs text-white">Creator handoff is unavailable because this source is user-entered and unverified or still needs clarification.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}