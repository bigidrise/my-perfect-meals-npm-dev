import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Utensils,
  Heart,
  Pill,
  Flame,
  MessageCircle,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Dumbbell,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PillButton } from "@/components/ui/pill-button";
import { MealBuilderType, getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useTranslation } from "react-i18next";

interface BuilderSwitchStatus {
  changesUsed: number;
  changesRemaining: number;
  changeLimit: number;
  canSwitch: boolean;
  isUnlimited: boolean;
}

interface BuilderOption {
  id: MealBuilderType;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
}

const BUILDER_CONFIG: BuilderOption[] = [
  {
    id: "diabetic",
    titleKey: "diabeticTitle",
    descKey: "diabeticDesc",
    icon: <Heart className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "glp1",
    titleKey: "metabolicTitle",
    descKey: "metabolicDesc",
    icon: <Pill className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "anti_inflammatory",
    titleKey: "antiInflamTitle",
    descKey: "antiInflamDesc",
    icon: <Flame className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "beach_body",
    titleKey: "performanceTitle",
    descKey: "performanceDesc",
    icon: <Trophy className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "general_nutrition",
    titleKey: "generalTitle",
    descKey: "generalDesc",
    icon: <Utensils className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
];

export default function MealBuilderSelection() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation("mealSelect");
  const [selected, setSelected] = useState<MealBuilderType | null>(null);
  const [confirmedBuilder, setConfirmedBuilder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchStatus, setSwitchStatus] = useState<BuilderSwitchStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const handleSelect = (id: MealBuilderType) => {
    setSelected(id);
    setTimeout(() => {
      saveButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const isProCareClient = user?.isProCare && !["admin", "coach", "physician", "trainer"].includes(user?.professionalRole || user?.role || "");
  const isUnlimited = switchStatus?.isUnlimited ?? false;

  const PRO_BUILDERS: string[] = [];

  const isProBuilderUnlocked = (builderId: string): boolean => {
    if (!PRO_BUILDERS.includes(builderId)) return true;
    if (isUnlimited) return true;
    return user?.activeBoard === builderId;
  };

  const BUILDER_OPTIONS = BUILDER_CONFIG.map((b) => ({
    ...b,
    title: t(b.titleKey),
    description: t(b.descKey),
  }));

  const availableBuilders =
    isProCareClient && user?.activeBoard
      ? BUILDER_OPTIONS.filter((opt) => opt.id === user.activeBoard)
      : BUILDER_OPTIONS;

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user?.selectedMealBuilder) {
      setSelected(user.selectedMealBuilder as MealBuilderType);
      setConfirmedBuilder(null);
    }
  }, [user?.selectedMealBuilder]);

  useEffect(() => {
    const fetchSwitchStatus = async () => {
      const authToken = getAuthToken();
      if (!authToken) {
        setLoadingStatus(false);
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/user/builder-switch-status"), {
          headers: { "x-auth-token": authToken },
        });
        if (response.ok) {
          const status = await response.json();
          setSwitchStatus(status);
        }
      } catch (error) {
        console.error("Failed to fetch switch status:", error);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchSwitchStatus();
  }, []);

  const handleContinue = async () => {
    if (!selected) {
      toast({
        title: t("errorSelect"),
        description: t("errorSelectDesc"),
        variant: "destructive",
      });
      return;
    }

    if (selected === user?.selectedMealBuilder) {
      toast({
        title: t("alreadyUsing"),
        description: t("alreadyUsingDesc"),
      });
      setLocation("/dashboard");
      return;
    }

    if (switchStatus && !switchStatus.canSwitch && !switchStatus.isUnlimited) {
      toast({
        title: t("usedUp"),
        description: t("usedUpDesc", { limit: switchStatus.changeLimit }),
        variant: "destructive",
      });
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to continue.",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(apiUrl("/api/user/meal-builder"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({
          selectedMealBuilder: selected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.switchStatus) {
          setSwitchStatus(data.switchStatus);
        }
        throw new Error(data.error || "Failed to save selection");
      }

      if (data.switchStatus) {
        setSwitchStatus(data.switchStatus);
      }

      setConfirmedBuilder(selected);
      await refreshUser();
      window.dispatchEvent(new CustomEvent("mpm:builderUpdated"));
      queryClient.invalidateQueries({ queryKey: ["nutrition-summary"] });

      toast({
        title: "Builder Updated",
        description: "Your meal builder has been changed. You're all set to continue.",
      });

      setLocation("/dashboard");
    } catch (error: any) {
      console.error("Failed to save meal builder selection:", error);
      toast({
        title: t("unableToSwitch"),
        description: error.message || "Failed to save your selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white p-4"
    >
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-3">
          <Utensils className="h-5 w-5 text-orange-400" />
          <h1 className="text-lg font-bold text-white">
            {t("title")}
          </h1>
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="pt-16 pb-24"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
        }}
      >
        {!loadingStatus && switchStatus && !switchStatus.isUnlimited && (
          <div className={`rounded-xl px-4 py-3 mb-5 flex items-center gap-3 ${
            switchStatus.canSwitch
              ? "bg-black/30 border border-white/10"
              : "bg-amber-900/30 border border-amber-500/50"
          }`}>
            {switchStatus.canSwitch ? (
              <RefreshCw className="w-4 h-4 text-orange-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              {switchStatus.canSwitch ? (
                <p className="text-white text-sm">
                  <span className="font-semibold text-orange-400">{switchStatus.changesRemaining}</span>
                  <span className="text-white/70"> {t("exchangesLeft", { limit: switchStatus.changeLimit })}</span>
                </p>
              ) : (
                <p className="text-amber-200 text-sm font-medium">
                  {t("exchangesUsed", { limit: switchStatus.changeLimit })}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/90 text-center leading-relaxed">
            {t("memberNote")}
          </p>
        </div>

        {user?.isProCare && (
          <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">
                  {t("procareHeading")}
                </p>
                <p className="text-indigo-300/80 text-xs leading-relaxed">
                  {t("procareDesc")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {isProCareClient && !user?.activeBoard && (
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Utensils className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t("awaitingTitle")}
              </h3>
              <p className="text-zinc-400 text-sm">
                {t("awaitingDesc")}
              </p>
            </div>
          )}

          {!(isProCareClient && !user?.activeBoard) &&
            availableBuilders.map((option) => {
              const isUnlocked = isProBuilderUnlocked(option.id);
              const isProBuilder = PRO_BUILDERS.includes(option.id);

              return (
              <div
                key={option.id}
                className={`w-full p-4 rounded-2xl border-2 transition-all ${
                  !isUnlocked
                    ? "border-zinc-700 bg-zinc-950 opacity-60"
                    : selected === option.id
                    ? "border-emerald-500/50 bg-emerald-950"
                    : "border-white/20 bg-zinc-950"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${option.color} ${isUnlocked ? "text-white" : "text-zinc-500"} flex-shrink-0`}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-base font-semibold leading-snug ${!isUnlocked ? "text-zinc-400" : ""}`}>{option.title}</h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-400/25 rounded-full text-[8px] font-semibold text-cyan-300 tracking-wide flex-shrink-0">
                          <span className="w-1 h-1 bg-cyan-400 rounded-full" />
                          Behavioral AI™
                        </span>
                        {!isUnlocked && isProBuilder && (
                          <Lock className="w-4 h-4 text-zinc-500" />
                        )}
                        {option.id === "beach_body" && (
                          <span className="text-xs px-2 py-0.5 bg-amber-600/30 text-amber-300 rounded-full border border-amber-500/30">
                            {t("badgeClinical", { ns: "builders" })}
                          </span>
                        )}
                        {(confirmedBuilder || user?.selectedMealBuilder) === option.id && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full border border-emerald-500/30">
                            {t("badgeCurrent", { ns: "builders" })}
                          </span>
                        )}
                      </div>
                      {isUnlocked ? (
                        <PillButton
                          active={selected === option.id}
                          onClick={() => handleSelect(option.id)}
                          className="flex-shrink-0"
                        >
                          {selected === option.id ? "On" : "Off"}
                        </PillButton>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">{t("trainerUnlock")}</span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${!isUnlocked ? "text-zinc-500" : "text-white/70"}`}>
                      {!isUnlocked ? t("trainerUnlockDesc") : option.description}
                    </p>
                  </div>
                </div>
              </div>
            );
            })}

        </div>

        <div className="bg-black/20 border border-white/5 rounded-xl p-3 mb-6">
          <p className="text-white/60 text-xs text-center italic">
            {t("guidanceHint")}
          </p>
        </div>

        {!(isProCareClient && !user?.activeBoard) && (
          <Button
            ref={saveButtonRef}
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full h-14 text-lg bg-lime-600 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50"
          >
            {saving ? t("saving") : selected ? t("saveBtn") : t("selectFirst")}
          </Button>
        )}
      </div>

    </motion.div>
  );
}
