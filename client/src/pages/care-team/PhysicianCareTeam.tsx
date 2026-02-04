import { useEffect, useMemo, useState } from "react";
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
  const quickTour = useQuickTour("care-team-physician");

  const [members, setMembers] = useState<CareMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [role, setRole] = useState<ProRole>("doctor");
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMS.doctor);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    if (!invEmail.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("/api/care-team/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail, role, permissions: perms }),
      });
      setMembers((prev) => [res.member, ...prev]);
      setInvEmail("");
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

  async function revokeMember(id: string) {
    await apiRequest(`/api/care-team/${id}/revoke`, { method: "POST" });
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m)),
    );
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

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
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

          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-orange-500" />
                <h2 className="text-xl font-bold text-white">
                  Connect with Access Code
                </h2>
              </div>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="MP-XXXX-XXX"
                className="bg-black/40 text-white border-white/20"
              />
              <Button
                disabled={loading}
                onClick={connectWithCode}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
              >
                <ClipboardEdit className="h-4 w-4 mr-2" />
                Link with Code
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>

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
              onClick={() => setLocation("/pro/clients")}
              className="w-full bg-lime-600 hover:bg-lime-600 text-white"
              data-testid="button-open-pro-portal"
            >
              <ClipboardEdit className="h-4 w-4 mr-2" />
              Open Pro Portal
            </Button>

            <Button
              onClick={() => revokeMember(m.id)}
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
    </motion.div>
  );
}