import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore, Targets, ClinicalContext, BuilderType, StarchStrategy } from "@/lib/proData";
import {
  PROFESSIONAL_BUILDER_MAP,
  getBuilderKeys,
  type ProfessionalBuilderKey,
} from "@/lib/professionalBuilderMap";
import { assignBuilderToClient } from "@/lib/assignBuilderToClient";
import { linkUserToClient, ensureClientMapping } from "@/lib/macroResolver";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  Settings,
  ClipboardList,
  ArrowLeft,
  Trophy,
  Dumbbell,
  Check,
  Ruler,
  CalendarCheck,
  Stethoscope,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { ProClientBanner } from "@/components/pro/ProClientBanner";
import WeeklyWeightTrendCard from "@/components/pro/WeeklyWeightTrendCard";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { resolveClinicalProtocolLabel } from "@shared/clinical/clinicalModeResolver";

const TRAINER_DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Trainer Studio",
    description:
      "Welcome to your coaching studio. Set macros, assign meal builders, and guide nutrition strategy here.",
  },
  {
    icon: "2",
    title: "Macro Targets",
    description:
      "Set protein, carbs, and fats for your client. These targets drive every meal they see in the app.",
  },
  {
    icon: "3",
    title: "Starch Game Plan",
    description:
      "Choose how starchy carbs are distributed. One Starch Meal concentrates all starch into one meal for appetite control. Flex Split divides across two meals. Fibrous carbs are always unlimited!",
  },
  {
    icon: "4",
    title: "Assigned Meal Builder",
    description:
      "Choose which meal builder your client will use. This determines their entire in-app experience.",
  },
  {
    icon: "5",
    title: "Client Meal Builder",
    description:
      "Open your client's assigned meal builder directly. The button updates automatically when you change the assigned builder above.",
  },
];

export default function TrainerClientDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:id/trainer");
  const clientId = params?.id as string;

  const quickTour = useQuickTour("trainer-client-dashboard");

  const [client, setClient] = useState(() => proStore.getClient(clientId));
  const resolvedClientUserId = client?.clientUserId || client?.userId || clientId;
  const [t, setT] = useState<Targets>(() => proStore.getTargets(clientId));
  const [ctx, setCtx] = useState<ClinicalContext>(() =>
    proStore.getContext(clientId),
  );
  const [assignedBuilder, setAssignedBuilder] = useState<
    BuilderType | undefined
  >(() => client?.assignedBuilder);

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

  interface KeyLabs {
    a1c: number | null;
    ldl: number | null;
  }
  const [labs, setLabs] = useState<KeyLabs | null>(null);

  const activeProtocolLabel = useMemo(() => {
    if (!assignedBuilder || !PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey]) return null;
    if (assignedBuilder === "anti_inflammatory") {
      return resolveClinicalProtocolLabel(t.flags);
    }
    return PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey].label;
  }, [assignedBuilder, t.flags]);

  useEffect(() => {
    setT(proStore.getTargets(clientId));
    setCtx(proStore.getContext(clientId));
    const c = proStore.getClient(clientId);
    if (c) {
      setClient(c);
      setAssignedBuilder(c.assignedBuilder);
    }
  }, [clientId]);

  const fetchBodyComp = useCallback(() => {
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
  }, [clientId]);

  useEffect(() => {
    fetchBodyComp();
  }, [fetchBodyComp]);

  useEffect(() => {
    const c = proStore.getClient(clientId);
    const uid = c?.clientUserId || c?.userId;
    if (!uid) return;
    fetch(apiUrl(`/api/users/${uid}/goal`), { headers: { ...getAuthHeaders() }, credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setClientGoal(data); })
      .catch(() => {});
    fetch(apiUrl(`/api/biometrics/labs/${uid}`), { headers: { ...getAuthHeaders() }, credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.labs) {
          setLabs({ a1c: data.labs.a1c ?? null, ldl: data.labs.ldl ?? null });
        }
      })
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    const handleResume = () => {
      const c = proStore.getClient(clientId);
      if (c) {
        setClient(c);
        setAssignedBuilder(c.assignedBuilder);
        setT(proStore.getTargets(clientId));
        setCtx(proStore.getContext(clientId));
      }
      fetchBodyComp();
    };

    window.addEventListener("mpm:visibility-resumed", handleResume);
    return () => window.removeEventListener("mpm:visibility-resumed", handleResume);
  }, [clientId, fetchBodyComp]);

  const saveTargets = async () => {
    proStore.setTargets(clientId, t);

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

    // Link both the proStore clientId and the real user ID so builders
    // can resolve targets regardless of which ID appears in the route
    linkUserToClient(clientId, clientId);
    if (resolvedClientUserId && resolvedClientUserId !== clientId) {
      linkUserToClient(resolvedClientUserId, clientId);
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
      title: "Notes saved",
      description: "Coaching notes saved.",
    });
  };

  const scheduleCheckIn = () => {
    const weeks = ctx.checkInWeeks;
    if (!weeks) {
      toast({ title: "Select weeks", description: "Choose 2, 4, 8, or 12 weeks for the check-in." });
      return;
    }
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + weeks * 7);
    const nextISO = nextDate.toISOString().split("T")[0];
    const label = nextDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    proStore.setContext(clientId, { ...ctx, nextCheckInISO: nextISO, checkInWeeks: weeks });
    setCtx({ ...ctx, nextCheckInISO: nextISO, checkInWeeks: weeks });
    toast({
      title: "Check-in scheduled",
      description: `Next check-in set for ${label} (${weeks} weeks).`,
    });
  };

  const TRAINER_BUILDER_KEYS = getBuilderKeys("trainer");

  const handleBuilderAssignment = async (builderKey: ProfessionalBuilderKey) => {
    if (!resolvedClientUserId) {
      toast({
        title: "Cannot Assign",
        description: "This client hasn't connected their account yet. They need to enter the access code first.",
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
      setAssignedBuilder(builderKey as BuilderType);
      toast({
        title: "Builder Assigned",
        description: `${PROFESSIONAL_BUILDER_MAP[builderKey].label} builder assigned to ${client?.name}.`,
      });
    } else {
      toast({
        title: "Assignment Failed",
        description: result.error || "Could not assign builder to client.",
        variant: "destructive",
      });
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
            onClick={() => setLocation("/care-team/trainer")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              Trainer Studio
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
          <p className="text-white/90 mt-3 text-lg">
            {client?.name || "Client"}
          </p>
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
        </div>

        {(activeProtocolLabel || labs) && (
          <Card className="bg-white/5 border border-teal-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-teal-400" /> Health Context
                <span className="ml-auto text-xs font-normal text-white/40 italic">read-only</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {activeProtocolLabel && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 w-28 shrink-0">Active Protocol</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-600/20 border border-teal-500/30 text-teal-300">
                    {activeProtocolLabel}
                  </span>
                </div>
              )}
              {labs && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/50 w-28 shrink-0">Key Labs</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    labs.a1c != null && labs.a1c >= 6.5
                      ? "bg-red-500/10 border-red-500/30 text-red-300"
                      : "bg-white/5 border-white/20 text-white/70"
                  }`}>
                    A1C: {labs.a1c != null ? `${labs.a1c}${labs.a1c >= 6.5 ? " ⚠" : ""}` : "N/A"}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    labs.ldl != null && labs.ldl >= 130
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                      : "bg-white/5 border-white/20 text-white/70"
                  }`}>
                    LDL: {labs.ldl != null ? `${labs.ldl}${labs.ldl >= 130 ? " ⚠" : ""}` : "N/A"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {bodyComp && (
          <Card className="bg-white/5 border border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Body Composition
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {parseFloat(bodyComp.currentBodyFatPct) > 0 && (
                <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-xs text-white/60">Body Fat</div>
                  <div className="text-lg font-bold text-white">{parseFloat(bodyComp.currentBodyFatPct).toFixed(1)}%</div>
                </div>
              )}
              <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                <div className="text-xs text-white/60">Target Body Fat</div>
                <div className="text-lg font-bold text-lime-400">{bodyComp.goalBodyFatPct ? `${parseFloat(bodyComp.goalBodyFatPct).toFixed(1)}%` : "—"}</div>
              </div>
              {parseFloat(bodyComp.currentBodyFatPct) > 0 && (
                <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-xs text-white/60">Method</div>
                  <div className="text-sm font-medium text-white">{bodyComp.scanMethod}</div>
                </div>
              )}
              {bodyCompSource && (
                <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-xs text-white/60">Source</div>
                  <div className="text-sm font-medium text-white capitalize">{bodyCompSource}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <WeeklyWeightTrendCard clientId={resolvedClientUserId} />

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5" /> Macro Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-white/70 mb-1 block">
                Protein (g)
              </label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.protein || ""}
                onChange={(e) =>
                  setT({
                    ...t,
                    protein: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                placeholder="protein"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">
                Starchy Carbs (g)
              </label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.starchyCarbs || ""}
                onChange={(e) =>
                  setT({
                    ...t,
                    starchyCarbs:
                      e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                placeholder="starchy carbs"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">
                Fibrous Carbs (g)
              </label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.fibrousCarbs || ""}
                onChange={(e) =>
                  setT({
                    ...t,
                    fibrousCarbs:
                      e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                placeholder="fibrous carbs"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 mb-1 block">
                Fat (g)
              </label>
              <Input
                inputMode="numeric"
                className="bg-black/30 border-white/30 text-white"
                value={t.fat || ""}
                onChange={(e) =>
                  setT({
                    ...t,
                    fat: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                placeholder="fat"
              />
            </div>

            {/* Performance Dietary Directives - hidden until properly wired */}

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
                      : 'bg-black/30 border-white/20 hover:bg-black/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🥔</span>
                    <span className="font-semibold text-white">One Starch Meal</span>
                    {(t.starchStrategy || 'one') === 'one' && (
                      <Check className="h-4 w-4 text-orange-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-white/70">
                    All starch in one meal. Best for appetite control and fat loss.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setT({ ...t, starchStrategy: 'flex' })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    t.starchStrategy === 'flex'
                      ? 'bg-yellow-600/30 border-yellow-400'
                      : 'bg-black/30 border-white/20 hover:bg-black/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🥗</span>
                    <span className="font-semibold text-white">Flex Split</span>
                    {t.starchStrategy === 'flex' && (
                      <Check className="h-4 w-4 text-yellow-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-white/70">
                    Divide starch across two meals for flexibility.
                  </p>
                </button>
              </div>
            </div>

            <div className="col-span-full flex gap-2">
              <Button
                onClick={saveTargets}
                className="bg-lime-600 border border-white/20 text-white active:bg-white/30"
              >
                Save Targets
              </Button>
              <Button
                onClick={async () => {
                  const totalCarbs =
                    (t.starchyCarbs || 0) + (t.fibrousCarbs || 0);
                  const calcKcal =
                    (t.protein || 0) * 4 + totalCarbs * 4 + (t.fat || 0) * 9;

                  if (calcKcal < 100) {
                    toast({
                      title: "Cannot Set Empty Macros",
                      description: "Please set macro targets first",
                      variant: "destructive",
                    });
                    return;
                  }

                  try {
                    const { setMacroTargets } = await import(
                      "@/lib/dailyLimits"
                    );
                    await setMacroTargets(
                      {
                        calories: calcKcal,
                        protein_g: t.protein,
                        carbs_g: totalCarbs,
                        fat_g: t.fat,
                      },
                      clientId,
                    );

                    linkUserToClient(clientId, clientId);

                    toast({
                      title: "Macros Set to Biometrics!",
                      description: `${calcKcal} kcal coach-set targets saved for ${client?.name}`,
                    });
                  } catch (error) {
                    console.error("Failed to set macros:", error);
                    toast({
                      title: "Failed to Set Macros",
                      description: "Please try again",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-black hover:bg-black text-white font-bold px-8 text-lg py-3 shadow-2xl transition-all duration-200 flash-border"
              >
                Send Macros to Biometrics
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-lime-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-lime-400" /> Assigned Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              Choose which meal builder this client will see in their app.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAINER_BUILDER_KEYS.map((key) => {
                const entry = PROFESSIONAL_BUILDER_MAP[key];
                const isActive = assignedBuilder === key;
                return (
                  <Button
                    key={key}
                    onClick={() => handleBuilderAssignment(key)}
                    className={`h-auto py-4 flex flex-col items-start gap-1 text-left transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? "bg-lime-600 border-2 border-lime-400"
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

        <Card className="bg-white/5 border border-lime-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-lime-400" /> Client Meal Builder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              {assignedBuilder && PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey]
                ? `Open the ${PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey].label} builder for ${client?.name || "this client"}.`
                : `Assign a builder above first, then open it here.`}
            </p>
            <Button
              onClick={() => {
                const key = assignedBuilder as ProfessionalBuilderKey;
                const entry = key ? PROFESSIONAL_BUILDER_MAP[key] : null;
                if (!entry) {
                  toast({
                    title: "No Builder Assigned",
                    description: "Please assign a meal builder to this client first.",
                    variant: "destructive",
                  });
                  return;
                }
                // Item 3: Guarantee mapping exists before builder loads
                ensureClientMapping(resolvedClientUserId, clientId);
                localStorage.setItem("pro-client-id", resolvedClientUserId);
                setLocation(`/pro/clients/${resolvedClientUserId}/${entry.proRoute}`);
              }}
              className="w-full sm:w-[400px] bg-lime-600 border border-lime-400/30 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              {assignedBuilder && PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey]
                ? `Open ${PROFESSIONAL_BUILDER_MAP[assignedBuilder as ProfessionalBuilderKey].label} Builder`
                : "Assign Builder First"}
            </Button>
          </CardContent>
        </Card>

        {/* Schedule Check-In */}
        <Card className="bg-white/5 border border-lime-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-lime-400" /> Schedule Check-In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ctx.nextCheckInISO && (
              <div className="p-3 rounded-xl bg-lime-900/20 border border-lime-400/30">
                <p className="text-xs text-lime-400 font-semibold">Next Check-In</p>
                <p className="text-sm text-white mt-0.5">
                  {new Date(ctx.nextCheckInISO + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
            <p className="text-white/70 text-sm">
              Set a check-in reminder for this client. Select how many weeks out and tap Schedule.
            </p>
            <div>
              <p className="text-xs text-white/50 mb-2">Weeks until check-in</p>
              <div className="grid grid-cols-4 gap-2">
                {([2, 4, 8, 12] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setCtx({ ...ctx, checkInWeeks: w })}
                    className={`py-2 rounded-xl border text-sm font-semibold transition-all active:scale-[0.97] ${
                      ctx.checkInWeeks === w
                        ? "bg-lime-600 border-lime-400 text-white"
                        : "bg-black/30 border-white/20 text-white/70"
                    }`}
                  >
                    {w}w
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Coaching notes for this check-in</p>
              <textarea
                value={ctx.coachNote || ""}
                onChange={(e) => setCtx({ ...ctx, coachNote: e.target.value })}
                placeholder="Goals, focus areas, or session notes..."
                className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none"
                rows={3}
              />
            </div>
            <Button
              onClick={scheduleCheckIn}
              className="bg-lime-600 border border-lime-400/30 text-white active:scale-[0.98]"
            >
              <CalendarCheck className="h-4 w-4 mr-2" />
              Schedule Check-In
            </Button>
          </CardContent>
        </Card>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Trainer Studio Guide"
        steps={TRAINER_DASHBOARD_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
