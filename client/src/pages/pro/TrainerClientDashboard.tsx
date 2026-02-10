import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore, Targets, ClinicalContext, BuilderType, StarchStrategy } from "@/lib/proData";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  Settings,
  ClipboardList,
  ArrowLeft,
  Target,
  Trophy,
  Dumbbell,
  Check,
  Ruler,
  LayoutGrid,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { ProClientBanner } from "@/components/pro/ProClientBanner";

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
    title: "Client Meal Board",
    description:
      "View and edit your client's weekly meal plan directly. Add meals, remove items, or repeat a day across the week. Every change is tracked so the client knows who updated their plan.",
  },
  {
    icon: "5",
    title: "Assigned Meal Builder",
    description:
      "Choose which meal builder your client will use. This determines their entire in-app experience.",
  },
];

export default function TrainerClientDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:id/trainer");
  const clientId = params?.id as string;

  const quickTour = useQuickTour("trainer-client-dashboard");

  const [client, setClient] = useState(() => proStore.getClient(clientId));
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

  useEffect(() => {
    setT(proStore.getTargets(clientId));
    setCtx(proStore.getContext(clientId));
    const c = proStore.getClient(clientId);
    if (c) {
      setClient(c);
      setAssignedBuilder(c.assignedBuilder);
    }
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
      title: "Notes saved",
      description: "Coaching notes saved.",
    });
  };

  const handleBuilderAssignment = async (builder: BuilderType) => {
    const clientUid = client?.clientUserId || client?.userId;
    const studioId = client?.studioId;
    
    if (!clientUid) {
      toast({
        title: "Cannot Assign",
        description: "This client hasn't connected their account yet. They need to enter the access code first.",
        variant: "destructive",
      });
      return;
    }
    
    const apiBuilderName = builder === "general" ? "general_nutrition" : "performance_competition";
    
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["x-auth-token"] = token;

      if (studioId) {
        const studioRes = await fetch(`/api/studios/${studioId}/clients/${clientUid}/assign`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ assignedBuilder: apiBuilderName }),
        });
        if (!studioRes.ok) {
          const data = await studioRes.json();
          throw new Error(data.error || "Failed to assign builder");
        }
      }

      const proRes = await fetch("/api/pro/assign-builder", {
        method: "POST",
        headers,
        body: JSON.stringify({
          clientId: clientUid,
          builder: apiBuilderName,
        }),
      });
      
      if (!proRes.ok) {
        const data = await proRes.json();
        throw new Error(data.error || "Failed to assign builder");
      }
      
      setAssignedBuilder(builder);
      if (client) {
        proStore.upsertClient({
          ...client,
          assignedBuilder: builder,
        });
      }
      
      toast({
        title: "Builder Assigned",
        description: `${builder === "general" ? "General Nutrition" : "Performance & Competition"} builder assigned to ${client?.name}.`,
      });
    } catch (error: any) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign builder to client.",
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

      <div
        className="max-w-5xl mx-auto px-4 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8rem)" }}
      >
        <div className="rounded-2xl p-6 bg-white/5 border border-white/20">
          <p className="text-white/90 mt-3 text-lg">
            {client?.name || "Client"}
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

                    const { linkUserToClient } = await import(
                      "@/lib/macroResolver"
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

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> Coach Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              className="bg-black/30 border-white/30 text-white min-h-[100px]"
              placeholder="Training notes, progress tracking, observations..."
              value={ctx.coachNote || ""}
              onChange={(e) => setCtx({ ...ctx, coachNote: e.target.value })}
            />
            <Button
              onClick={saveContext}
              className="bg-lime-600 border border-white/20 text-white active:bg-white/30"
            >
              Save Coach Notes
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
                      <div className="text-lg font-bold text-lime-400">{parseFloat(bodyComp.goalBodyFatPct).toFixed(1)}%</div>
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
              <p className="text-white/50 text-sm">No body composition data recorded for this client yet.</p>
            )}
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
              <Button
                onClick={() => handleBuilderAssignment("general")}
                className={`h-auto py-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                  assignedBuilder === "general"
                    ? "bg-lime-600 border-2 border-lime-400"
                    : "bg-black/40 border border-white/20 hover:bg-black/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {assignedBuilder === "general" && (
                    <Check className="h-5 w-5" />
                  )}
                  <span className="font-bold">General Nutrition</span>
                </div>
                <span className="text-xs text-white/70 font-normal">
                  Balanced meals for everyday health
                </span>
              </Button>
              <Button
                onClick={() => handleBuilderAssignment("performance")}
                className={`h-auto py-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                  assignedBuilder === "performance"
                    ? "bg-lime-600 border-2 border-lime-400"
                    : "bg-black/40 border border-white/20 hover:bg-black/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {assignedBuilder === "performance" && (
                    <Check className="h-5 w-5" />
                  )}
                  <span className="font-bold">Performance & Competition</span>
                </div>
                <span className="text-xs text-white/70 font-normal">
                  High-protein, athletic-focused meals
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-amber-400" /> Client Meal Board
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm">
              View and edit {client?.name || "your client"}'s weekly meal plan directly.
            </p>
            <Button
              onClick={() => {
                const boardUserId = client?.clientUserId || client?.userId || clientId;
                setLocation(`/pro/clients/${boardUserId}/board/smart`);
              }}
              className="w-full sm:w-[400px] bg-amber-600 border border-amber-400/30 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              View Meal Board
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-bold text-white mb-2">Meal Builders</h2>
            
            <Button
              onClick={() => {
                localStorage.setItem("pro-client-id", clientId);
                setLocation(
                  `/pro/clients/${clientId}/general-nutrition-builder`,
                );
              }}
              className="w-full sm:w-[400px] bg-black backdrop-blur-md border border-white/20 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              General Nutrition Builder
            </Button>
            <Button
              onClick={() =>
                setLocation(
                  `/pro/clients/${clientId}/performance-competition-builder`,
                )
              }
              className="w-full sm:w-[400px] bg-black backdrop-blur-md border border-white/20 text-white font-semibold rounded-xl shadow-lg active:scale-[0.98]"
            >
              Performance & Competition Builder
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
