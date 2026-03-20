import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore, Targets, ClinicalContext, ClinicalAdvisory, StarchStrategy } from "@/lib/proData";
import { ensureClientMapping } from "@/lib/macroResolver";
import ClinicalAdvisoryDrawer from "@/components/pro/ClinicalAdvisoryDrawer";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
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
  Trophy,
  Dumbbell,
} from "lucide-react";
import {
  PROFESSIONAL_BUILDER_MAP,
  getBuilderKeys,
  type ProfessionalBuilderKey,
} from "@/lib/professionalBuilderMap";
import { resolveClinicalProtocolLabel } from "@shared/clinical/clinicalModeResolver";
import { assignBuilderToClient } from "@/lib/assignBuilderToClient";
import { useToast } from "@/hooks/use-toast";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { ProClientBanner } from "@/components/pro/ProClientBanner";
import WeeklyWeightTrendCard from "@/components/pro/WeeklyWeightTrendCard";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

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
  const PHYSICIAN_BUILDER_KEYS = getBuilderKeys("physician");
  const [assignedBuilder, setAssignedBuilder] = useState<ProfessionalBuilderKey | undefined>(
    () => client?.assignedBuilder as ProfessionalBuilderKey | undefined
  );

  // Resolves the human-readable protocol label.
  // For Anti-Inflammatory, this reads physician flags and returns the specific
  // clinical protocol (Kidney Disease, Cardiac Protocol, etc.) instead of just
  // "Anti-Inflammatory".  All other builders show their own map label.
  const activeProtocolLabel = useMemo(() => {
    if (!assignedBuilder || !PROFESSIONAL_BUILDER_MAP[assignedBuilder]) return null;
    if (assignedBuilder === 'anti_inflammatory') {
      return resolveClinicalProtocolLabel(t.flags);
    }
    return PROFESSIONAL_BUILDER_MAP[assignedBuilder].label;
  }, [assignedBuilder, t.flags]);

  interface LabsSummary {
    a1c: number | null;
    ldl: number | null;
    hdl: number | null;
    blood_pressure_systolic: number | null;
    blood_pressure_diastolic: number | null;
    ejection_fraction: number | null;
  }
  const [labs, setLabs] = useState<LabsSummary | null>(null);

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
  const [clientGoal, setClientGoal] = useState<{ goalType?: string | null; goalTarget?: string | null; goalTimelineWeeks?: number | null } | null>(null);

  useEffect(() => {
    setT(proStore.getTargets(clientId));
    setCtx(proStore.getContext(clientId));
    const c = proStore.getClient(clientId);
    if (c) {
      setClient(c);
      setAssignedBuilder(c.assignedBuilder as ProfessionalBuilderKey | undefined);
      const uid = c.clientUserId || c.userId;
      if (uid) ensureClientMapping(uid, clientId);
      ensureClientMapping(clientId, clientId);
    }
  }, [clientId]);

  useEffect(() => {
    const c = proStore.getClient(clientId);
    const uid = c?.clientUserId || c?.userId;
    if (!uid) return;
    apiRequest(`/api/users/${uid}/body-composition/latest`)
      .then((data) => {
        if (data?.entry) {
          setBodyComp(data.entry);
          setBodyCompSource(data.source);
        }
      })
      .catch(() => {});
    fetch(apiUrl(`/api/clinical-labs/${uid}/latest`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.labs) setLabs(data.labs);
      })
      .catch(() => {});
    fetch(apiUrl(`/api/users/${uid}/goal`), { headers: { ...getAuthHeaders() }, credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setClientGoal(data); })
      .catch(() => {});
  }, [clientId]);

  const saveTargets = async () => {
    proStore.setTargets(clientId, t);
    const _uid = client?.clientUserId || client?.userId || clientId;
    ensureClientMapping(_uid, clientId);

    const totalCarbs = (t.starchyCarbs || 0) + (t.fibrousCarbs || 0);
    const totalCal = (t.protein * 4) + (totalCarbs * 4) + (t.fat * 9);
    const dbUserId = client?.clientUserId || client?.userId;

    if (dbUserId) {
      try {
        const res = await fetch(apiUrl(`/api/users/${dbUserId}/macro-targets`), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({
            calories: totalCal,
            protein_g: t.protein,
            carbs_g: totalCarbs,
            fat_g: t.fat,
          }),
        });
        if (!res.ok) {
          console.error("Failed to sync macro targets to database:", res.status);
        }
      } catch (e) {
        console.error("Failed to sync macro targets to database:", e);
      }

      // Mirror to localStorage so RemainingMacrosFooter resolves targets
      // across sessions without needing "Send Macros to Biometrics" separately
      try {
        const { setMacroTargets } = await import("@/lib/dailyLimits");
        await setMacroTargets(
          { calories: totalCal, protein_g: t.protein, carbs_g: totalCarbs, fat_g: t.fat },
          dbUserId,
        );
      } catch (e) {
        console.error("Failed to mirror macro targets to localStorage:", e);
      }
    }

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

  const resolvedClientUserId = client?.clientUserId || client?.userId || clientId;

  const handlePhysicianBuilderAssignment = async (builderKey: ProfessionalBuilderKey) => {
    if (!resolvedClientUserId) {
      toast({
        title: "Cannot Assign",
        description: "This patient hasn't connected their account yet.",
        variant: "destructive",
      });
      return;
    }
    const result = await assignBuilderToClient({
      builderKey,
      clientId,
      clientUserId: resolvedClientUserId,
      studioId: client?.studioId,
      clientName: client?.name,
    });
    if (result.success) {
      setAssignedBuilder(builderKey);
      toast({
        title: "Builder Assigned",
        description: `${PROFESSIONAL_BUILDER_MAP[builderKey].label} assigned to ${client?.name || "patient"}.`,
      });
    } else {
      toast({ title: "Assignment Failed", description: result.error || "Could not assign builder.", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap">
          <button
            onClick={() => setLocation("/pro/physician-clients")}
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
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-6 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8rem)" }}
      >
        <div className="rounded-2xl p-6 bg-white/5 border border-white/20">
          <p className="text-white/90 text-lg font-semibold">
            {client?.name || "Patient"}
          </p>
          {activeProtocolLabel && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              Active Protocol: {activeProtocolLabel}
            </div>
          )}
          {clientGoal?.goalType && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-orange-500/10 border border-orange-500/30 px-4 py-3">
              <span className="text-2xl">
                {clientGoal.goalType === "lose" ? "🔥" : clientGoal.goalType === "gain" ? "💪" : "⚖️"}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  {clientGoal.goalType === "lose" ? "Lose Weight" : clientGoal.goalType === "gain" ? "Gain Muscle" : "Maintain Weight"}
                  {clientGoal.goalTarget ? ` — ${clientGoal.goalTarget}` : ""}
                  {clientGoal.goalTimelineWeeks ? ` in ${clientGoal.goalTimelineWeeks >= 52 ? "1 year" : clientGoal.goalTimelineWeeks >= 26 ? "6 months" : `${clientGoal.goalTimelineWeeks} weeks`}` : ""}
                </p>
                {!clientGoal.goalTimelineWeeks && (
                  <p className="text-xs text-white/50">No timeline set</p>
                )}
              </div>
            </div>
          )}
          <p className="text-sm text-white/60 mt-2">
            Set macro targets, clinical context, and physician notes for your patient.
          </p>
        </div>

        {(labs?.ldl != null || labs?.a1c != null || labs?.blood_pressure_systolic != null || labs?.ejection_fraction != null) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="text-xs text-red-300">LDL</div>
              <div className="text-lg font-semibold text-red-200">{labs?.ldl ?? "--"} <span className="text-xs font-normal text-red-300/70">mg/dL</span></div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="text-xs text-yellow-300">A1C</div>
              <div className="text-lg font-semibold text-yellow-200">{labs?.a1c ?? "--"} <span className="text-xs font-normal text-yellow-300/70">%</span></div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="text-xs text-blue-300">Blood Pressure</div>
              <div className="text-lg font-semibold text-blue-200">
                {labs?.blood_pressure_systolic ?? "--"} / {labs?.blood_pressure_diastolic ?? "--"}
                <span className="text-xs font-normal text-blue-300/70 ml-1">mmHg</span>
              </div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <div className="text-xs text-purple-300">Ejection Fraction</div>
              <div className="text-lg font-semibold text-purple-200">{labs?.ejection_fraction ?? "--"} <span className="text-xs font-normal text-purple-300/70">%</span></div>
            </div>
          </div>
        )}

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
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "renal",          label: "Renal-Friendly"   },
                  { key: "cardiac",        label: "Cardiac-Friendly" },
                  { key: "liverDisease",   label: "Liver Disease"    },
                  { key: "liverSupport",   label: "Liver Support"    },
                  { key: "lowSodium",      label: "Low-Sodium"       },
                  { key: "postBariatric",  label: "Post-Bariatric"   },
                ] as const).map(({ key, label }) => {
                  const isOn = !!(t.flags as Record<string, boolean> | undefined)?.[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setT({ ...t, flags: { ...t.flags, [key]: !isOn } })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.97] border ${
                        isOn
                          ? "bg-teal-600 border-teal-400 text-white"
                          : "bg-black/30 border-white/20 text-white/70 hover:bg-black/50 hover:text-white"
                      }`}
                    >
                      {isOn && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}
                      {label}
                    </button>
                  );
                })}
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
              <Button onClick={saveTargets} className="bg-lime-600 border border-white/20 text-white font-bold px-8 text-lg py-3 shadow-2xl transition-all duration-200 active:scale-[0.98] flex-1">
                Save Targets &amp; Dietary Directives
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

        <WeeklyWeightTrendCard clientId={client?.clientUserId || client?.userId || clientId} />

        <Card className="bg-white/5 border border-teal-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-teal-400" /> Assign Clinical Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              Choose which meal builder this patient will use. The assignment is saved to their record.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PHYSICIAN_BUILDER_KEYS.map((key) => {
                const entry = PROFESSIONAL_BUILDER_MAP[key];
                const isActive = assignedBuilder === key;
                return (
                  <Button
                    key={key}
                    onClick={() => handlePhysicianBuilderAssignment(key)}
                    className={`h-auto py-4 flex flex-col items-start gap-1 text-left transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? "bg-teal-600 border-2 border-teal-400"
                        : "bg-black/40 border border-white/20 hover:bg-black/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {isActive && <Check className="h-4 w-4 flex-shrink-0" />}
                      <span className="font-bold text-sm">{entry.label}</span>
                    </div>
                    <span className="text-xs text-white/60 font-normal leading-snug">{entry.description}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-amber-400" /> Open Patient Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              {activeProtocolLabel
                ? `Open the ${activeProtocolLabel} builder for ${client?.name || "this patient"}.`
                : "Assign a builder above, then open it here."}
            </p>
            <Button
              onClick={() => {
                const entry = assignedBuilder ? PROFESSIONAL_BUILDER_MAP[assignedBuilder] : null;
                if (!entry) {
                  toast({ title: "No Builder Assigned", description: "Please assign a builder above first.", variant: "destructive" });
                  return;
                }
                localStorage.setItem("pro-client-id", resolvedClientUserId);
                setLocation(`/pro/clients/${resolvedClientUserId}/${entry.proRoute}`);
              }}
              className="w-full sm:w-[400px] bg-amber-600 border border-amber-400/30 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              {activeProtocolLabel
                ? `Open ${activeProtocolLabel} Builder`
                : "Assign Builder First"}
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
