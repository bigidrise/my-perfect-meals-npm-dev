import { useEffect, useMemo, useState } from "react";
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
  Home,
  Users,
  ShieldCheck,
  Mail,
  KeyRound,
  UserPlus2,
  ClipboardEdit,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { ProRole } from "@/lib/proData";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

// Types
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

// Default permissions by role
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
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("care-team");

  const CARE_TEAM_TOUR_STEPS: TourStep[] = [
    {
      icon: "1",
      title: t("careTeam.tour.inviteYourTeam"),
      description: t("careTeam.tour.inviteYourTeamDesc"),
    },
    {
      icon: "2",
      title: t("careTeam.tour.setPermissions"),
      description: t("careTeam.tour.setPermissionsDesc"),
    },
    {
      icon: "3",
      title: t("careTeam.tour.accessCodes"),
      description: t("careTeam.tour.accessCodesDesc"),
    },
    {
      icon: "4",
      title: t("careTeam.tour.manageMembers"),
      description: t("careTeam.tour.manageMembersDesc"),
    },
  ];

  const roleBadgeMap: Record<ProRole, { text: string; className: string }> = {
    trainer: {
      text: t("careTeam.roles.trainer"),
      className: "bg-orange-600/20 text-orange-300 border-orange-400/40",
    },
    doctor: {
      text: t("careTeam.roles.doctor"),
      className: "bg-sky-600/20 text-sky-300 border-sky-400/40",
    },
    np: {
      text: t("careTeam.roles.np"),
      className: "bg-indigo-600/20 text-indigo-300 border-indigo-400/40",
    },
    rn: {
      text: t("careTeam.roles.rn"),
      className: "bg-purple-600/20 text-purple-300 border-purple-400/40",
    },
    pa: {
      text: t("careTeam.roles.pa"),
      className: "bg-teal-600/20 text-teal-300 border-teal-400/40",
    },
    nutritionist: {
      text: t("careTeam.roles.nutritionist"),
      className: "bg-amber-600/20 text-amber-300 border-amber-400/40",
    },
    dietitian: {
      text: t("careTeam.roles.dietitian"),
      className: "bg-lime-600/20 text-lime-300 border-lime-400/40",
    },
  };

  // UI state
  const [members, setMembers] = useState<CareMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [role, setRole] = useState<ProRole>("trainer");
  const [perms, setPerms] = useState<Permissions>(DEFAULT_PERMS["trainer"]);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load existing connections AND check for invite code in URL
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequest("/api/care-team");
        if (mounted) setMembers(data.members);

        // Check for invite code in URL (e.g., /care-team?code=MP-XXXX-XXX)
        const urlParams = new URLSearchParams(window.location.search);
        const codeFromUrl = urlParams.get("code");

        if (codeFromUrl && mounted) {
          // Auto-accept invitation from URL
          try {
            const response = await apiRequest("/api/care-team/connect", {
              method: "POST",
              body: JSON.stringify({ code: codeFromUrl }),
            });
            setMembers((prev) => [response.member, ...prev]);
            alert(t("careTeam.toast.invitationAccepted"));
            // Clear the code from URL
            window.history.replaceState({}, "", "/care-team");
          } catch (e: any) {
            setError(e?.message ?? t("careTeam.errors.invalidInvitationCode"));
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? t("careTeam.errors.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep perms synced to role unless user toggles manually
  useEffect(() => {
    setPerms(DEFAULT_PERMS[role]);
  }, [role]);

  const pending = useMemo(
    () => members.filter((m) => m.status === "pending"),
    [members],
  );
  const active = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members],
  );

  async function inviteByEmail() {
    setError(null);
    if (!invEmail.trim()) {
      setError(t("careTeam.errors.emailRequired"));
      return;
    }
    try {
      setLoading(true);
      const response = await apiRequest("/api/care-team/invite", {
        method: "POST",
        body: JSON.stringify({ email: invEmail, role, permissions: perms }),
      });
      setMembers((prev) => [response.member, ...prev]);
      setInvEmail("");
      setError(null);
      alert(`${t("careTeam.toast.invitationSent", { email: invEmail })}`);
    } catch (e: any) {
      setError(e?.message ?? t("careTeam.errors.sendInviteFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function connectWithCode() {
    setError(null);
    if (!accessCode.trim()) {
      setError(t("careTeam.errors.providerCodeRequired"));
      return;
    }
    try {
      setLoading(true);
      const response = await apiRequest("/api/care-team/connect", {
        method: "POST",
        body: JSON.stringify({ code: accessCode }),
      });
      setMembers((prev) => [response.member, ...prev]);
      setAccessCode("");
      alert(t("careTeam.toast.providerConnected"));
    } catch (e: any) {
      setError(e?.message ?? t("careTeam.errors.invalidProviderCode"));
    } finally {
      setLoading(false);
    }
  }

  const togglePerm = (key: keyof Permissions) => {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  };

  async function approveMember(id: string) {
    try {
      await apiRequest(`/api/care-team/${id}/approve`, { method: "POST" });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "active" as const } : m,
        ),
      );
      alert(t("careTeam.toast.memberApproved"));
    } catch {
      setError(t("careTeam.errors.approveFailed"));
    }
  }

  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  async function revokeMember(id: string) {
    try {
      await apiRequest(`/api/care-team/${id}/revoke`, { method: "POST" });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "revoked" as const } : m,
        ),
      );
      setRevokeConfirmId(null);
      alert(t("careTeam.toast.accessRevoked"));
    } catch {
      setError(t("careTeam.errors.revokeFailed"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500 flex-shrink-0" />
          <h1 className="text-base font-bold text-white flex-1 min-w-0 truncate">
            Care Team & Pro Access
          </h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Invite Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invite by Email */}
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-bold text-white">
                  {t("careTeam.invite.title")}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80">{t("careTeam.invite.roleLabel")}</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as ProRole)}
                  >
                    <SelectTrigger className="bg-black/40 border-white/20 text-white">
                      <SelectValue placeholder={t("careTeam.invite.rolePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trainer">{t("careTeam.roles.trainer")}</SelectItem>
                      <SelectItem value="doctor">{t("careTeam.roles.doctor")}</SelectItem>
                      <SelectItem value="np">{t("careTeam.roles.np")}</SelectItem>
                      <SelectItem value="rn">{t("careTeam.roles.rn")}</SelectItem>
                      <SelectItem value="pa">{t("careTeam.roles.pa")}</SelectItem>
                      <SelectItem value="nutritionist">{t("careTeam.roles.nutritionist")}</SelectItem>
                      <SelectItem value="dietitian">{t("careTeam.roles.dietitian")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-white/80">{t("careTeam.invite.emailLabel")}</Label>
                  <Input
                    type="email"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder={t("careTeam.invite.emailPlaceholder")}
                    autoComplete="off"
                    className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                    data-testid="input-invite-email"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-white/80">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-semibold">{t("careTeam.invite.permissionsTitle")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <PermToggle
                    label={t("careTeam.invite.viewMacros")}
                    checked={perms.canViewMacros}
                    onChange={() => togglePerm("canViewMacros")}
                  />
                  <PermToggle
                    label={t("careTeam.invite.addMeals")}
                    checked={perms.canAddMeals}
                    onChange={() => togglePerm("canAddMeals")}
                  />
                  <PermToggle
                    label={t("careTeam.invite.editPlan")}
                    checked={perms.canEditPlan}
                    onChange={() => togglePerm("canEditPlan")}
                  />
                </div>
                <div className="text-xs text-white/60">
                  {t("careTeam.invite.permissionsHint")}
                </div>
              </div>

              <Button
                disabled={loading}
                onClick={inviteByEmail}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
                data-testid="button-send-invite"
              >
                <UserPlus2 className="h-4 w-4 mr-2" />
                {t("careTeam.invite.sendInvite")}
              </Button>
            </GlassCardContent>
          </GlassCard>

          {/* Connect With Your Provider */}
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-orange-500" />
                <h2 className="text-xl font-bold text-white">
                  {t("careTeam.connect.title")}
                </h2>
              </div>
              <p className="text-sm text-white/70">
                {t("careTeam.connect.description")}
              </p>
              <div>
                <Label className="text-white/80">{t("careTeam.connect.codeLabel")}</Label>
                <Input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder={t("careTeam.connect.codePlaceholder")}
                  className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                  data-testid="input-careteam-code"
                />
              </div>
              <Button
                disabled={loading}
                onClick={connectWithCode}
                className="w-full bg-lime-600 hover:bg-lime-600 text-white"
                data-testid="button-submit-code"
              >
                <ClipboardEdit className="h-4 w-4 mr-2" />
                {t("careTeam.connect.button")}
              </Button>
              <p className="text-xs text-white/40 text-center">
                {t("careTeam.connect.disclaimer")}
              </p>
            </GlassCardContent>
          </GlassCard>

          {/* How it Works */}
          <GlassCard className="border-2 border-orange-500/40">
            <GlassCardContent className="p-6 space-y-3">
              <h2 className="text-xl font-bold text-white">{t("careTeam.howItWorks.title")}</h2>
              <ul className="list-disc pl-5 text-white/80 text-sm space-y-2">
                <li>{t("careTeam.howItWorks.step1")}</li>
                <li>{t("careTeam.howItWorks.step2")}</li>
                <li>{t("careTeam.howItWorks.step3")}</li>
                <li>{t("careTeam.howItWorks.step4")}</li>
              </ul>
              <div className="text-xs text-white/60">
                {t("careTeam.howItWorks.disclaimer")}
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-900/30 text-red-100 p-3">
            {error}
          </div>
        )}

        {/* Active Connections */}
        <SectionHeader
          title={t("careTeam.members.title")}
          subtitle={t("careTeam.members.subtitle")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.length === 0 && (
            <EmptyCard label={t("careTeam.members.empty")} />
          )}
          {active.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onApprove={undefined}
              onRevoke={() => setRevokeConfirmId(m.id)}
              setLocation={setLocation}
              roleBadgeMap={roleBadgeMap}
              t={t}
            />
          ))}
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title={t("careTeam.tourTitle")}
        steps={CARE_TEAM_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />

      {revokeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-white">{t("careTeam.members.revokeTitle")}</h3>
            <p className="text-sm text-white/70">
              This will remove this professional's access to your nutrition data. You can re-add them later with a new invite code.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setRevokeConfirmId(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                {t("careTeam.members.cancel")}
              </Button>
              <Button
                onClick={() => revokeMember(revokeConfirmId)}
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {t("careTeam.members.revokeConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---------- Small Components ----------
function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-white font-bold text-lg">{title}</h3>
      {subtitle && <div className="text-white/60 text-sm">{subtitle}</div>}
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card className="bg-black/30 border border-white/10">
      <CardContent className="p-6">
        <div className="text-white/70 text-sm">{label}</div>
      </CardContent>
    </Card>
  );
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/70 text-xs font-medium">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-indigo-500 scale-75"
      />
    </div>
  );
}

function roleBadge(role: ProRole, map: Record<ProRole, { text: string; className: string }>) {
  const r = map[role];
  return <Badge className={`${r.className} border`}>{r.text}</Badge>;
}

function statusBadge(status: CareMember["status"]) {
  if (status === "active")
    return (
      <Badge className="bg-green-600/20 text-green-300 border border-green-400/40">
        Active
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge className="bg-yellow-600/20 text-yellow-300 border border-yellow-400/40">
        Pending
      </Badge>
    );
  return (
    <Badge className="bg-red-600/20 text-red-300 border border-red-400/40">
      Revoked
    </Badge>
  );
}

function MemberCard({
  member,
  onApprove,
  onRevoke,
  setLocation,
  roleBadgeMap,
  t,
}: {
  member: CareMember;
  onApprove?: () => void;
  onRevoke?: () => void;
  setLocation: (path: string) => void;
  roleBadgeMap: Record<ProRole, { text: string; className: string }>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <GlassCard className="overflow-hidden">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">
            {member.name ?? t("careTeam.members.unnamedPro")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {statusBadge(member.status)}
          </div>
        </div>
        {member.email && (
          <CardDescription className="text-white/70 mt-1">
            {member.email}
          </CardDescription>
        )}
      </CardHeader>

      <GlassCardContent className="p-4">
        <div className="flex items-center gap-2">
          {member.status === "active" && (
            <Button
              onClick={() => setLocation("/pro/clients")}
              className="bg-lime-600 hover:bg-lime-600 text-white"
              data-testid="button-open-pro-portal"
            >
              <ClipboardEdit className="h-4 w-4 mr-2" />
              {t("careTeam.members.openProPortal")}
            </Button>
          )}
          {member.status === "pending" && onApprove && (
            <Button
              onClick={onApprove}
              className="bg-orange-600/20 hover:bg-orange-600/20 text-white"
              data-testid="button-approve-member"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t("careTeam.members.approve")}
            </Button>
          )}
          {onRevoke && (
            <Button
              onClick={onRevoke}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-revoke-member"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t("careTeam.members.revoke")}
            </Button>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
