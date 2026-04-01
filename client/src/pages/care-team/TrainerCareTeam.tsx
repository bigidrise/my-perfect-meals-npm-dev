import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import {
  Users,
  Mail,
  UserPlus2,
  ExternalLink,
} from "lucide-react";
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

const CARE_TEAM_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Invite Your Clients",
    description:
      "Add clients by entering their email — they'll receive an invite to join your Studio.",
  },
  {
    icon: "2",
    title: "Set Availability",
    description: "Let your clients know when you're available or away.",
  },
  {
    icon: "3",
    title: "Pro Portal",
    description:
      "View and manage all active clients from your Pro Portal.",
  },
];

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
  dietitian: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  nutritionist: { canViewMacros: true, canAddMeals: true, canEditPlan: true },
  pa: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  np: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
  rn: { canViewMacros: true, canAddMeals: false, canEditPlan: false },
};

export default function CareTeamPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const quickTour = useQuickTour("care-team");

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === "admin";
    const isTrainer = user.professionalRole === "trainer";
    if (!isAdmin && !isTrainer) {
      setLocation("/more");
    }
  }, [user, setLocation]);

  const [members, setMembers] = useState<CareMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [role, setRole] = useState<ProRole>("trainer");
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMS["trainer"]);
  const [accessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequest("/api/care-team");
        if (mounted) setMembers(data.members);

        const urlParams = new URLSearchParams(window.location.search);
        const codeFromUrl = urlParams.get("code");

        if (codeFromUrl && mounted) {
          try {
            const response = await apiRequest("/api/care-team/connect", {
              method: "POST",
              body: JSON.stringify({ code: codeFromUrl }),
            });
            setMembers((prev) => [response.member, ...prev]);
            alert(`✅ Successfully accepted invitation! Welcome to the Studio.`);
            window.history.replaceState({}, "", "/care-team");
          } catch (e: any) {
            setError(e?.message ?? "Invalid or expired invitation code.");
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load studio.");
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
      setError("Enter an email to invite.");
      return;
    }
    try {
      setLoading(true);
      const response = await apiRequest("/api/care-team/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail, role, permissions: perms }),
      });
      setMembers((prev) => [response.member, ...prev]);
      const sentTo = invEmail;
      setInvEmail("");
      setError(null);
      setSuccessMsg(`✅ Invitation sent to ${sentTo}! They'll receive an email from support@myperfectmeals.com`);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send invite.");
    } finally {
      setLoading(false);
    }
  }

  // ── Availability ──────────────────────────────────────────────────────────
  type AvailStatus = "available" | "busy" | "away" | "offline";
  const [availStatus, setAvailStatus] = useState<AvailStatus>(
    (user?.availabilityStatus as AvailStatus) ?? "available",
  );
  const [backAtInput, setBackAtInput] = useState<string>(user?.backAt ? user.backAt.slice(0, 10) : "");
  const [availSaving, setAvailSaving] = useState(false);

  async function updateAvailability(status: AvailStatus) {
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
  }

  async function saveBackAt() {
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
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <ProfessionalIntroOverlay type="trainer" onEnter={() => {}} />

      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500 flex-shrink-0" />
          <h1 className="text-base font-bold text-white flex-1 min-w-0 truncate">
            Trainer Studio
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

        {/* Pro Portal CTA */}
        <GlassCard className="border border-orange-400/30 bg-orange-900/10">
          <GlassCardContent className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">Active clients</p>
              <p className="text-white/60 text-xs mt-0.5">View and manage all connected clients from your Pro Portal</p>
            </div>
            <Button
              onClick={() => setLocation("/pro/clients")}
              className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Pro Portal
            </Button>
          </GlassCardContent>
        </GlassCard>

        {/* Invite Client */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-bold text-white">
                  Invite Client to Your Studio
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ProRole)}
                  >
                    <SelectTrigger className="bg-black/40 border-white/20 text-white">
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainer">Trainer</SelectItem>
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
                    type="email"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="client@email.com"
                    autoComplete="off"
                    className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                    data-testid="input-invite-email"
                  />
                </div>
              </div>

              <Button
                disabled={loading}
                onClick={inviteByEmail}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
                data-testid="button-send-invite"
              >
                <UserPlus2 className="h-4 w-4 mr-2" />
                Send Invite
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
        title="Trainer Studio Guide"
        steps={CARE_TEAM_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}

function roleBadge(role: ProRole) {
  const map: Record<ProRole, { text: string; className: string }> = {
    trainer: {
      text: "Trainer",
      className: "bg-orange-600/20 text-orange-300 border-orange-400/40",
    },
    doctor: {
      text: "Doctor",
      className: "bg-sky-600/20 text-sky-300 border-sky-400/40",
    },
    np: {
      text: "Nurse Practitioner",
      className: "bg-indigo-600/20 text-indigo-300 border-indigo-400/40",
    },
    rn: {
      text: "RN",
      className: "bg-purple-600/20 text-purple-300 border-purple-400/40",
    },
    pa: {
      text: "PA",
      className: "bg-teal-600/20 text-teal-300 border-teal-400/40",
    },
    nutritionist: {
      text: "Nutritionist",
      className: "bg-amber-600/20 text-amber-300 border-amber-400/40",
    },
    dietitian: {
      text: "Dietitian",
      className: "bg-lime-600/20 text-lime-300 border-lime-400/40",
    },
  };
  const r = map[role];
  return <Badge className={`${r.className} border`}>{r.text}</Badge>;
}
