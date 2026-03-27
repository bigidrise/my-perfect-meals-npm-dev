import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ClipboardEdit, XCircle, Users, ShieldCheck, Mail, KeyRound, UserPlus2 } from "lucide-react";
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
import NutritionStrategyCard from "@/components/pro/NutritionStrategyCard";
import SharedPlanLockedBanner from "@/components/pro/SharedPlanLockedBanner";

/* -------------------------------- TOUR -------------------------------- */

const CARE_TEAM_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Invite Your Care Team",
    description:
      "Invite physicians and licensed clinicians to review nutrition data and guardrails.",
  },
  {
    icon: "2",
    title: "Set Permissions",
    description: "Control what each clinician can review or edit.",
  },
  {
    icon: "3",
    title: "Access Codes",
    description: "Use secure access codes to connect care professionals.",
  },
  {
    icon: "4",
    title: "Manage Access",
    description: "Revoke access anytime. You stay in control.",
  },
];

/* -------------------------------- TYPES -------------------------------- */

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

/* --------------------------- DEFAULT PERMS ------------------------------ */

const DEFAULT_PERMS: Record<ProRole, Permissions> = {
  trainer: { canViewMacros: true, canAddMeals: true, canEditPlan: true }, // unused here
  doctor: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  np: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  rn: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  pa: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  nutritionist: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  dietitian: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
};

/* =============================== PAGE =================================== */

export default function PhysicianCareTeamPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const quickTour = useQuickTour("care-team-physician");

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
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ------------------------------ LOAD --------------------------------- */

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequest("/api/care-team");
        if (mounted) setMembers(data.members ?? []);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load care team.");
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

  const active = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  /* ----------------------------- ACTIONS ------------------------------- */

  async function inviteByEmail() {
    setError(null);
    setSuccessMsg(null);
    if (!invEmail.trim()) {
      setError("Enter an email to invite.");
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
      setSuccessMsg(`✅ Invitation sent to ${sentTo}! They'll receive an email from support@myperfectmeals.com`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e: any) {
      setError(e?.message ?? "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  async function connectWithCode() {
    if (!accessCode.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("/api/care-team/connect", {
        method: "POST",
        body: JSON.stringify({ code: accessCode }),
      });
      setMembers((prev) => [res.member, ...prev]);
      setAccessCode("");
    } catch (e: any) {
      setError(e?.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // ── Availability ──────────────────────────────────────────────────────────
  type AvailStatus = "available" | "busy" | "away" | "offline";
  const [availStatus, setAvailStatus] = useState<AvailStatus>(
    (user?.availabilityStatus as AvailStatus) ?? "available",
  );
  const [backAtInput, setBackAtInput] = useState<string>(user?.backAt ? user.backAt.slice(0, 10) : "");
  const [availSaving, setAvailSaving] = useState(false);

  const updateAvailability = useCallback(async (status: AvailStatus) => {
    setAvailStatus(status);
    setAvailSaving(true);
    try {
      await apiRequest("/api/professionals/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status, backAt: backAtInput || null }),
      });
    } catch {
      setError("Failed to update availability.");
    } finally {
      setAvailSaving(false);
    }
  }, [backAtInput]);

  const saveBackAt = useCallback(async () => {
    setAvailSaving(true);
    try {
      await apiRequest("/api/professionals/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status: availStatus, backAt: backAtInput || null }),
      });
    } catch {
      setError("Failed to save back date.");
    } finally {
      setAvailSaving(false);
    }
  }, [availStatus, backAtInput]);

  async function revokeMember(id: string) {
    await apiRequest(`/api/care-team/${id}/revoke`, { method: "POST" });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m)),
    );
    setRevokeConfirmId(null);
  }

  /* ------------------------------ RENDER ------------------------------- */

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <ProfessionalIntroOverlay type="physician" onEnter={() => {}} />

      {/* HEADER */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h1 className="text-base font-bold text-white flex-1 truncate">
            Physicians Clinic
          </h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Availability Status */}
        <GlassCard className="border border-white/10">
          <GlassCardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {availStatus === "offline" ? (
                <WifiOff className="h-4 w-4 text-white/50" />
              ) : (
                <Wifi className="h-4 w-4 text-orange-400" />
              )}
              <h2 className="text-base font-bold text-white">Your Availability</h2>
              {availSaving && <span className="text-xs text-white/40 ml-auto">Saving…</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["available", "busy", "away", "offline"] as const).map((s) => (
                <PillButton
                  key={s}
                  active={availStatus === s}
                  variant={s === "available" ? "emerald" : "amber"}
                  onClick={() => updateAvailability(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </PillButton>
              ))}
            </div>
            {(availStatus === "busy" || availStatus === "away") && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-white/60 whitespace-nowrap">Back on:</label>
                <Input
                  type="date"
                  value={backAtInput}
                  onChange={(e) => setBackAtInput(e.target.value)}
                  onBlur={saveBackAt}
                  className="h-7 text-xs text-white bg-white/10 border-white/20 max-w-[160px]"
                />
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Shared Plan Access status + Nutrition Strategy — client read-only */}
        <SharedPlanLockedBanner />
        <NutritionStrategyCard />

        {/* INVITE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-bold text-white">
                  Invite by Email
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">Professional Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ProRole)}
                  >
                    <SelectTrigger className="bg-black/40 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="np">Nurse Practitioner</SelectItem>
                      <SelectItem value="rn">RN</SelectItem>
                      <SelectItem value="pa">PA</SelectItem>
                      <SelectItem value="nutritionist">Nutritionist</SelectItem>
                      <SelectItem value="dietitian">Dietitian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white/80">Email</Label>
                  <Input
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="provider@clinic.com"
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
                Send Invite
              </Button>
            </GlassCardContent>
          </GlassCard>

          {/* Connect with Access Code — hidden: clients use ProCare landing page instead */}
          {false && (
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-orange-500" />
                <h2 className="text-xl font-bold text-white">
                  Connect With Your Provider
                </h2>
              </div>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Provider code (given by your coach or physician)"
                className="bg-black/40 text-white border-white/20"
              />
              <Button
                disabled={loading}
                onClick={connectWithCode}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
              >
                <ClipboardEdit className="h-4 w-4 mr-2" />
                Connect to Provider
              </Button>
            </GlassCardContent>
          </GlassCard>
          )}
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

        <h3 className="text-white font-bold text-lg">
          Active Physician Connections
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {active.map((m) => (
            <GlassCard key={m.id} className="max-w-xl">
        <GlassCardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 break-words">
              <div className="font-bold text-white break-words">{m.name}</div>
              {m.email && <div className="text-sm text-white/70 break-words">{m.email}</div>}
            </div>

            <Badge className="bg-green-600/20 text-green-300 border border-green-400/40 shrink-0">
              Active
            </Badge>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Button
              onClick={() => setLocation("/pro/physician-clients")}
              className="w-full bg-lime-600 hover:bg-lime-600 text-white"
              data-testid="button-open-pro-portal"
            >
              <ClipboardEdit className="h-4 w-4 mr-2" />
              Open Pro Portal
            </Button>

            <Button
              onClick={() => setRevokeConfirmId(m.id)}
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-700"
              data-testid="button-revoke-member"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Revoke
            </Button>
          </div>
        </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Physicians Clinic Guide"
        steps={CARE_TEAM_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />

      {revokeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Revoke Access?</h3>
            <p className="text-sm text-white/70">
              This will remove this professional's access to your health data. You can re-add them later with a new invite code.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setRevokeConfirmId(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => revokeMember(revokeConfirmId)}
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Revoke Access
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}