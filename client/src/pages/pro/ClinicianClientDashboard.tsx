import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore, Targets, ClinicalContext, ClinicalAdvisory, StarchStrategy } from "@/lib/proData";
import ClinicalAdvisoryDrawer from "@/components/pro/ClinicalAdvisoryDrawer";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  ArrowLeft,
  Stethoscope,
  Settings,
  ClipboardList,
  Ruler,
  Target,
  Check,
  Calendar,
  LayoutGrid,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { ProClientBanner } from "@/components/pro/ProClientBanner";

const CLINICIAN_DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Physicians Clinic",
    description:
      "Welcome to your clinical workspace. Set macro targets, clinical context, and guide patient nutrition with medical oversight.",
  },
  {
    icon: "2",
    title: "Macro Targets",
    description:
      "Set protein, carbs, and fats for your patient. These targets drive every meal they see in the app.",
  },
  {
    icon: "3",
    title: "Medical Directives",
    description:
      "Toggle clinical dietary flags like Diabetes-Friendly, Low-Sodium, GLP-1 Support, and more to guide meal generation.",
  },
  {
    icon: "4",
    title: "Clinical Context",
    description:
      "Document diagnosis, clinical tags, and patient notes for comprehensive medical nutrition therapy.",
  },
  {
    icon: "5",
    title: "Patient Meal Board",
    description:
      "View and edit your patient's weekly meal plan directly. Add meals, remove items, or repeat a day across the week. Every change is tracked so the patient knows who updated their plan.",
  },
  {
    icon: "6",
    title: "Medical Hubs",
    description:
      "Access condition-specific meal builders like Diabetic, GLP-1, and Anti-Inflammatory to guide patient nutrition safely.",
  },
];

export default function ClinicianClientDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:id/clinician");
  const clientId = params?.id as string;

  const quickTour = useQuickTour("clinician-client-dashboard");

  const [client, setClient] = useState(() => proStore.getClient(clientId));
  const [t, setT] = useState<Targets>(() => proStore.getTargets(clientId));
  const [ctx, setCtx] = useState<ClinicalContext>(() => proStore.getContext(clientId));

  interface BodyCompEntry {
    id: number;
    currentBodyFatPct: string;
    goalBodyFatPct: string | null;
    scanMethod: string;
    source: string;
    recordedAt: string;
  }
  const [bodyComp, setBodyComp] = useState<BodyCompEntry | null>(null);
  const [bodyCompSource, setBodyCompSource] = useState<string | null>(null);

  useEffect(() => {
    setT(proStore.getTargets(clientId));
    setCtx(proStore.getContext(clientId));
    const c = proStore.getClient(clientId);
    if (c) setClient(c);
  }, [clientId]);

  useEffect(() => {
    const c = proStore.getClient(clientId);
    const uid = c?.userId;
    if (!uid) return;
    fetch(apiUrl(`/api/users/${uid}/body-composition/latest`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.entry) {
          setBodyComp(data.entry);
          setBodyCompSource(data.source);
        }
      })
      .catch(() => {});
  }, [clientId]);

  const saveTargets = () => {
    proStore.setTargets(clientId, t);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));
    }
    toast({
      title: "Targets saved",
      description: "Macro targets updated successfully.",
    });
  };

  const saveContext = () => {
    proStore.setContext(clientId, ctx);
    toast({
      title: "Clinical context saved",
      description: "Diagnosis, tags, and notes saved.",
    });
  };

  const toggleClinicalTag = (
    tag: "GLP-1" | "Cardiac" | "Renal" | "Bariatric" | "Post-Op" | "Diabetes" | "General"
  ) => {
    const current = ctx.clinicalTags || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setCtx({ ...ctx, clinicalTags: next });
  };

  const scheduleFollowUp = () => {
    if (!ctx.followupWeeks) {
      toast({ title: "Select weeks", description: "Choose 4, 8, or 12 weeks for follow-up." });
      return;
    }
    proStore.scheduleFollowUp(clientId, ctx.followupWeeks, ctx.patientNote || "Follow-up scheduled");
    toast({ title: "Follow-up scheduled", description: `${ctx.followupWeeks}-week follow-up added.` });
    setCtx({ ...ctx, followupWeeks: undefined });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap">
          <button
            onClick={() => setLocation("/care-team/physician")}
            className="flex items-center gap-1 text-white transition-all duration-200 p-2 rounded-lg flex-shrink-0 active:scale-[0.98]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              Physicians Clinic
            </h1>
          </div>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
        <ProClientBanner />
      </div>

      <div
        className="max-w-5xl mx-auto px-4 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8rem)" }}
      >
        <div className="rounded-2xl p-6 bg-white/5 border border-white/20">
          <p className="text-md text-white/70 mt-1">
            Set macro targets, clinical context, and physician notes for your patient.
          </p>
          <p className="text-white/90 mt-3 text-lg">
            {client?.name || "Patient"}
          </p>
        </div>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" /> Macro Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-white/70 mb-1 block">Protein (g)</label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.protein || ""}
                onChange={(e) => setT({ ...t, protein: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="protein"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">Starchy Carbs (g)</label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.starchyCarbs || ""}
                onChange={(e) => setT({ ...t, starchyCarbs: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="starchy carbs"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">Fibrous Carbs (g)</label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.fibrousCarbs || ""}
                onChange={(e) => setT({ ...t, fibrousCarbs: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="fibrous carbs"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">Fat (g)</label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.fat || ""}
                onChange={(e) => setT({ ...t, fat: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="fat"
              />
            </div>

            <div className="col-span-full mt-3">
              <label className="text-sm font-medium text-white/90 mb-2 block">
                Medical Dietary Directives
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.diabetesFriendly} onChange={(e) => setT({ ...t, flags: { ...t.flags, diabetesFriendly: e.target.checked } })} />
                  Diabetes-Friendly
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.lowSodium} onChange={(e) => setT({ ...t, flags: { ...t.flags, lowSodium: e.target.checked } })} />
                  Low-Sodium
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.glp1} onChange={(e) => setT({ ...t, flags: { ...t.flags, glp1: e.target.checked } })} />
                  GLP-1 Support
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.cardiac} onChange={(e) => setT({ ...t, flags: { ...t.flags, cardiac: e.target.checked } })} />
                  Cardiac-Friendly
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.renal} onChange={(e) => setT({ ...t, flags: { ...t.flags, renal: e.target.checked } })} />
                  Renal-Friendly
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input type="checkbox" checked={!!t.flags?.postBariatric} onChange={(e) => setT({ ...t, flags: { ...t.flags, postBariatric: e.target.checked } })} />
                  Post-Bariatric
                </label>
              </div>
            </div>

            <div className="col-span-full mt-3">
              <label className="text-sm font-medium text-white/90 mb-2 block">
                Starch Game Plan
              </label>
              <p className="text-xs text-white/60 mb-3">
                Control how starchy carbs are distributed throughout the day. Fibrous carbs (vegetables) are always unlimited.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setT({ ...t, starchStrategy: 'one' })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    (t.starchStrategy || 'one') === 'one'
                      ? 'bg-orange-600/30 border-orange-400'
                      : 'bg-black/30 border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🥔</span>
                    <span className="font-semibold text-white">One Starch Meal</span>
                    {(t.starchStrategy || 'one') === 'one' && <Check className="h-4 w-4 text-orange-400 ml-auto" />}
                  </div>
                  <p className="text-xs text-white/70">All starch in one meal. Best for appetite control and fat loss.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setT({ ...t, starchStrategy: 'flex' })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    t.starchStrategy === 'flex'
                      ? 'bg-yellow-600/30 border-yellow-400'
                      : 'bg-black/30 border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🥗</span>
                    <span className="font-semibold text-white">Flex Split</span>
                    {t.starchStrategy === 'flex' && <Check className="h-4 w-4 text-yellow-400 ml-auto" />}
                  </div>
                  <p className="text-xs text-white/70">Divide starch across two meals for flexibility.</p>
                </button>
              </div>
            </div>

            <div className="col-span-full mt-4">
              <ClinicalAdvisoryDrawer
                advisory={ctx.advisory}
                targets={t}
                onAdvisoryChange={(advisory: ClinicalAdvisory) => {
                  setCtx({ ...ctx, advisory });
                  proStore.setContext(clientId, { ...ctx, advisory });
                }}
                onApplySuggestions={(deltas) => {
                  const totalCarbs = (t.starchyCarbs || 0) + (t.fibrousCarbs || 0);
                  const newTotalCarbs = Math.max(0, totalCarbs + deltas.carbs);
                  const starchyRatio = totalCarbs > 0 ? (t.starchyCarbs || 0) / totalCarbs : 0.5;
                  setT({
                    ...t,
                    protein: Math.max(0, (t.protein || 0) + deltas.protein),
                    starchyCarbs: Math.round(newTotalCarbs * starchyRatio),
                    fibrousCarbs: Math.round(newTotalCarbs * (1 - starchyRatio)),
                    fat: Math.max(0, (t.fat || 0) + deltas.fat),
                  });
                  toast({ title: "Advisory Applied", description: "Macro targets adjusted. Review and save when ready." });
                }}
              />
            </div>

            <div className="col-span-full flex gap-2">
              <Button onClick={saveTargets} className="bg-lime-600 border border-white/20 text-white active:scale-[0.98]">
                Save Targets
              </Button>
              <Button
                onClick={async () => {
                  const totalCarbs = (t.starchyCarbs || 0) + (t.fibrousCarbs || 0);
                  const calcKcal = (t.protein || 0) * 4 + totalCarbs * 4 + (t.fat || 0) * 9;
                  if (calcKcal < 100) {
                    toast({ title: "Cannot Set Empty Macros", description: "Please set macro targets first", variant: "destructive" });
                    return;
                  }
                  try {
                    const { setMacroTargets } = await import("@/lib/dailyLimits");
                    await setMacroTargets({ calories: calcKcal, protein_g: t.protein, carbs_g: totalCarbs, fat_g: t.fat }, clientId);
                    const { linkUserToClient } = await import("@/lib/macroResolver");
                    linkUserToClient(clientId, clientId);
                    toast({ title: "Macros Set to Biometrics!", description: `${calcKcal} kcal physician-set targets saved for ${client?.name}` });
                  } catch (error) {
                    console.error("Failed to set macros:", error);
                    toast({ title: "Failed to Set Macros", description: "Please try again", variant: "destructive" });
                  }
                }}
                className="bg-black text-white font-bold px-8 text-lg py-3 shadow-2xl transition-all duration-200 flash-border active:scale-[0.98]"
              >
                <Target className="h-5 w-5 mr-2" />
                Send Macros to Biometrics
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Stethoscope className="h-5 w-5" /> Clinical Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm text-white/70 mb-1 block">Diagnosis</label>
              <Input
                className="bg-black/30 border-white/30 text-white"
                placeholder="e.g., Type 2 Diabetes, Post-Bariatric"
                value={ctx.diagnosis || ""}
                onChange={(e) => setCtx({ ...ctx, diagnosis: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-white/70 mb-2 block">Clinical Tags</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["GLP-1", "Cardiac", "Renal", "Bariatric", "Post-Op", "Diabetes", "General"] as const).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleClinicalTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-[0.98] ${
                      (ctx.clinicalTags || []).includes(tag)
                        ? "bg-blue-600 border-blue-400 text-white"
                        : "bg-black/30 border-white/20 text-white/70"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-white/70 mb-1 block">Patient Note</label>
              <Textarea
                className="bg-black/30 border-white/30 text-white min-h-[80px]"
                placeholder="Clinical observations, medication notes, dietary restrictions..."
                value={ctx.patientNote || ""}
                onChange={(e) => setCtx({ ...ctx, patientNote: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-white/70 mb-1 block">Physician Note</label>
              <Textarea
                className="bg-black/30 border-white/30 text-white min-h-[80px]"
                placeholder="Internal physician notes for this patient..."
                value={ctx.coachNote || ""}
                onChange={(e) => setCtx({ ...ctx, coachNote: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-white/70">Follow-up</label>
              <select
                className="bg-black/30 border border-white/30 text-white rounded-lg px-3 py-1.5 text-sm"
                value={ctx.followupWeeks || ""}
                onChange={(e) => setCtx({ ...ctx, followupWeeks: e.target.value ? (Number(e.target.value) as 4 | 8 | 12) : undefined })}
              >
                <option value="">Select</option>
                <option value="4">4 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
              </select>
              <Button onClick={scheduleFollowUp} className="bg-blue-600 text-white text-sm active:scale-[0.98]">
                <Calendar className="h-4 w-4 mr-1" />
                Schedule
              </Button>
            </div>

            <Button onClick={saveContext} className="bg-lime-600 border border-white/20 text-white active:scale-[0.98]">
              Save Clinical Context
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Ruler className="h-5 w-5" /> Body Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bodyComp ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                    <div className="text-xs text-white/60">Body Fat</div>
                    <div className="text-lg font-bold text-white">{parseFloat(bodyComp.currentBodyFatPct).toFixed(1)}%</div>
                  </div>
                  {bodyComp.goalBodyFatPct && (
                    <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                      <div className="text-xs text-white/60">Goal</div>
                      <div className="text-lg font-bold text-blue-400">{parseFloat(bodyComp.goalBodyFatPct).toFixed(1)}%</div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                    <div className="text-xs text-white/60">Scan Method</div>
                    <div className="text-sm font-medium text-white">{bodyComp.scanMethod}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span>Last scan: {new Date(bodyComp.recordedAt).toLocaleDateString()}</span>
                  {bodyCompSource && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      recorded by {bodyCompSource}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-white/50 text-sm">No body composition data recorded for this patient yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-amber-400" /> Patient Meal Board
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              View and edit {client?.name || "your patient"}'s weekly meal plan directly.
            </p>
            <Button
              onClick={() => setLocation(`/pro/clients/${clientId}/board/smart`)}
              className="w-full sm:w-[400px] bg-amber-600 border border-amber-400/30 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              View Meal Board
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Medical Hubs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm mb-4">
              Access specialized medical meal guidance for your patient.
            </p>
            <Button
              onClick={() => setLocation(`/pro/clients/${clientId}/diabetic-builder`)}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              Diabetic Meal Builder
            </Button>
            <Button
              onClick={() => setLocation(`/pro/clients/${clientId}/glp1-builder`)}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              GLP-1 Meal Builder
            </Button>
            <Button
              onClick={() => setLocation(`/pro/clients/${clientId}/anti-inflammatory-builder`)}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              Anti-Inflammatory Meal Builder
            </Button>
          </CardContent>
        </Card>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Physicians Clinic Guide"
        steps={CLINICIAN_DASHBOARD_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
