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
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import {
  Users,
  ShieldCheck,
  Mail,
  KeyRound,
  UserPlus2,
  ClipboardEdit,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { ProRole } from "@/lib/proData";

const CARE_TEAM_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Invite a Physician",
    description:
      "Invite licensed healthcare professionals to review nutrition data and clinical guardrails.",
  },
  {
    icon: "2",
    title: "Set Clinical Permissions",
    description:
      "Control which data your care team can review, including macros and biometrics.",
  },
  {
    icon: "3",
    title: "Secure Access Codes",
    description:
      "Use access codes to safely connect with your clinical care team.",
  },
  {
    icon: "4",
    title: "Manage Access",
    description:
      "Approve or revoke access at any time. You remain in full control.",
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

  const goToProClients = () => {
    setLocation("/pro/clients");
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h1 className="text-base font-bold text-white flex-1">
            Physician Care Team
          </h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GlassCard>
            <GlassCardContent className="p-6 space-y-4">
              <Label>Clinical Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="np">NP</SelectItem>
                  <SelectItem value="rn">RN</SelectItem>
                  <SelectItem value="pa">PA</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="provider@clinic.com"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
              />
              <Button onClick={inviteByEmail} disabled={loading}>
                <UserPlus2 className="h-4 w-4 mr-2" /> Send Invite
              </Button>
            </GlassCardContent>
          </GlassCard>

          <GlassCard>
            <GlassCardContent className="p-6 space-y-4">
              <Input
                placeholder="MP-XXXX-XXX"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
              <Button onClick={connectWithCode} disabled={loading}>
                <ClipboardEdit className="h-4 w-4 mr-2" /> Link with Code
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <h3 className="text-white font-bold text-lg">
          Active Physician Connections
        </h3>

        <div className="grid md:grid-cols-3 gap-4">
          {active.map((m) => (
            <GlassCard key={m.id}>
              <GlassCardContent className="p-4 space-y-3">
                <div className="font-bold text-white">{m.name}</div>
                {m.email && (
                  <div className="text-sm text-white/70">{m.email}</div>
                )}
                <Badge className="bg-green-600/20 text-green-300">
                  Active
                </Badge>

                <Button
                  onClick={goToProClients}
                  className="w-full bg-lime-600 text-white"
                >
                  Open Patient Portal
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => revokeMember(m.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Revoke
                </Button>
              </GlassCardContent>
            </GlassCard>
          ))}
        </div>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Physician Care Team Guide"
        steps={CARE_TEAM_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
