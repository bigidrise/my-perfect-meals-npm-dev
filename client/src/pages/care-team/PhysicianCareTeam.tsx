import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Mail, UserPlus2, ExternalLink } from "lucide-react";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { apiRequest } from "@/lib/queryClient";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { ProRole } from "@/lib/proData";
import { ProfessionalIntroOverlay } from "@/components/pro/ProfessionalIntroOverlay";
import { useAuth } from "@/contexts/AuthContext";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { PillButton } from "@/components/ui/pill-button";
import { Wifi, WifiOff } from "lucide-react";

type Permissions = {
  canViewMacros: boolean;
  canAddMeals: boolean;
  canEditPlan: boolean;
};

type CareMember = {
  id: string;
  name: string;
  email?: string;
  role: ProRole;
  status: "pending" | "active" | "revoked";
  permissions: Permissions;
};

const DEFAULT_PERMS: Record<ProRole, Permissions> = {
  trainer: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  doctor: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  np: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  rn: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  pa: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  nutritionist: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  dietitian: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
};

export default function PhysicianCareTeamPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const quickTour = useQuickTour("care-team-physician");

  const CARE_TEAM_TOUR_STEPS: TourStep[] = [
    {
      icon: "1",
      title: t("physicianCareTeam.tour.invitePatients"),
      description: t("physicianCareTeam.tour.invitePatientsDesc"),
    },
    {
      icon: "2",
      title: t("physicianCareTeam.tour.setAvailability"),
      description: t("physicianCareTeam.tour.setAvailabilityDesc"),
    },
    {
      icon: "3",
      title: t("physicianCareTeam.tour.physicianPortal"),
      description: t("physicianCareTeam.tour.physicianPortalDesc"),
    },
  ];

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const isPhysician = user.professionalRole === "physician";
    if (!isAdmin && !isPhysician) {
      setLocation("/more");
    }
  }, [user, setLocation]);

  const [members, setMembers] = useState<CareMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [role, setRole] = useState<ProRole>("doctor");
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMS.doctor);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequest("/api/care-team");
        if (mounted) setMembers(data.members ?? []);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? t("physicianCareTeam.errors.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPerms(DEFAULT_PERMS[role]);
  }, [role]);

  async function inviteByEmail() {
    setError(null);
    setSuccessMsg(null);
    if (!invEmail.trim()) {
      setError(t("physicianCareTeam.errors.emailRequired"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("/api/care-team/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail, role, permissions: perms }),
      });
      setMembers((prev) => [res.member, ...prev]);
      const sentTo = invEmail;
      setInvEmail("");
      setSuccessMsg(t("physicianCareTeam.toast.invitationSent", { email: sentTo }));
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e: any) {
      setError(e?.message ?? t("physicianCareTeam.errors.inviteFailed"));
    } finally {
      setLoading(false);
    }
  }

  // ── Availability ──────────────────────────────────────────────────────────
  type AvailStatus = "available" | "away" | "offline";
  const [availStatus, setAvailStatus] = useState<AvailStatus>(() => {
    const s = user?.availabilityStatus;
    return (s === "available" || s === "away" || s === "offline") ? s : "available";
  });
  const [awayFromInput, setAwayFromInput] = useState<string>("");
  const [backAtInput, setBackAtInput] = useState<string>(user?.backAt ? user.backAt.slice(0, 10) : "");
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  const updateAvailability = useCallback(async (status: AvailStatus) => {
    setAvailStatus(status);
    setAvailSaving(true);
    try {
      await apiRequest("/api/professionals/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status, backAt: backAtInput || null, awayFrom: awayFromInput || null }),
      });
      setAvailSaved(true);
      setTimeout(() => setAvailSaved(false), 3000);
    } catch {
      setError(t("physicianCareTeam.errors.availabilityFailed"));
    } finally {
      setAvailSaving(false);
    }
  }, [backAtInput, awayFromInput]);

  const saveBackAt = useCallback(async () => {
    setAvailSaving(true);
    try {
      await apiRequest("/api/professionals/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status: availStatus, backAt: backAtInput || null, awayFrom: awayFromInput || null }),
      });
      setAvailSaved(true);
      setTimeout(() => setAvailSaved(false), 3000);
    } catch {
      setError(t("physicianCareTeam.errors.saveDatesFailed"));
    } finally {
      setAvailSaving(false);
    }
  }, [availStatus, backAtInput, awayFromInput]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <ProfessionalIntroOverlay type="physician" onEnter={() => {}} />

      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h1 className="text-base font-bold text-white flex-1 truncate">
            {t("physicianCareTeam.title")}
          </h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Platform Features */}
        <GlassCard className="border border-orange-500/20">
          <GlassCardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{t("physicianCareTeam.platform.explore")}</p>
                <p className="text-xs text-white/50 mt-0.5 leading-snug">{t("physicianCareTeam.platform.description")}</p>
              </div>
              <PillButton onClick={() => setLocation('/learn')} className="shrink-0">
                {t("physicianCareTeam.platform.button")}
              </PillButton>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Availability Status */}
        <GlassCard className="border border-white/10">
          <GlassCardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {availStatus === "offline" ? (
                <WifiOff className="h-4 w-4 text-white/50" />
              ) : (
                <Wifi className="h-4 w-4 text-orange-400" />
              )}
              <h2 className="text-base font-bold text-white">{t("physicianCareTeam.availability.title")}</h2>
              {availSaving && <span className="text-xs text-white/40 ml-auto">{t("physicianCareTeam.availability.saving")}</span>}
              {!availSaving && availSaved && <span className="text-xs text-green-400 ml-auto">{t("physicianCareTeam.availability.saved")}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["available", "away", "offline"] as const).map((s) => (
                <PillButton
                  key={s}
                  active={availStatus === s}
                  variant={s === "available" ? "emerald" : "amber"}
                  onClick={() => updateAvailability(s)}
                >
                  {s === "available"
                    ? t("physicianCareTeam.availability.available")
                    : s === "away"
                    ? t("physicianCareTeam.availability.away")
                    : t("physicianCareTeam.availability.offline")}
                </PillButton>
              ))}
            </div>
            {availStatus === "away" && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/60 w-12 shrink-0">{t("physicianCareTeam.availability.from")}</label>
                  <Input
                    type="date"
                    value={awayFromInput}
                    onChange={(e) => setAwayFromInput(e.target.value)}
                    onBlur={saveBackAt}
                    className="h-7 text-xs text-white bg-white/10 border-white/20 max-w-[160px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/60 w-12 shrink-0">{t("physicianCareTeam.availability.until")}</label>
                  <Input
                    type="date"
                    value={backAtInput}
                    onChange={(e) => setBackAtInput(e.target.value)}
                    onBlur={saveBackAt}
                    className="h-7 text-xs text-white bg-white/10 border-white/20 max-w-[160px]"
                  />
                </div>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Physician Portal CTA */}
        <GlassCard className="border border-orange-400/30 bg-orange-900/10">
          <GlassCardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">{t("physicianCareTeam.clinic.activePatients")}</p>
              <p className="text-white/60 text-xs mt-0.5">{t("physicianCareTeam.clinic.viewAndManage")}</p>
            </div>
            <Button
              onClick={() => setLocation("/pro/physician-clients")}
              className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-open-pro-portal"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("physicianCareTeam.clinic.portalButton")}
            </Button>
          </GlassCardContent>
        </GlassCard>

        {/* Invite Patient */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-bold text-white">
                  {t("physicianCareTeam.invite.title")}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">{t("physicianCareTeam.invite.roleLabel")}</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ProRole)}
                  >
                    <SelectTrigger className="bg-black/40 border-white/20 text-white">
                      <SelectValue placeholder={t("physicianCareTeam.invite.rolePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">{t("physicianCareTeam.roles.doctor")}</SelectItem>
                      <SelectItem value="np">{t("physicianCareTeam.roles.np")}</SelectItem>
                      <SelectItem value="rn">{t("physicianCareTeam.roles.rn")}</SelectItem>
                      <SelectItem value="pa">{t("physicianCareTeam.roles.pa")}</SelectItem>
                      <SelectItem value="nutritionist">{t("physicianCareTeam.roles.nutritionist")}</SelectItem>
                      <SelectItem value="dietitian">{t("physicianCareTeam.roles.dietitian")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white/80">{t("physicianCareTeam.invite.emailLabel")}</Label>
                  <Input
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder={t("physicianCareTeam.invite.emailPlaceholder")}
                    className="bg-black/40 text-white border-white/20"
                  />
                </div>
              </div>

              <Button
                disabled={loading}
                onClick={inviteByEmail}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
              >
                <UserPlus2 className="h-4 w-4 mr-2" />
                {t("physicianCareTeam.invite.sendInvite")}
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>

        {successMsg && (
          <div className="rounded-xl border border-green-500/50 bg-green-900/30 text-green-100 p-3">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-900/30 text-red-100 p-3">
            {error}
          </div>
        )}

        <div className="h-8" />
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title={t("physicianCareTeam.tourTitle")}
        steps={CARE_TEAM_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
