import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { getAuthHeaders } from "@/lib/auth";
import MemberClientAccountingModal from "@/components/business/MemberClientAccountingModal";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  RefreshCw,
  ChevronLeft,
  Building2,
  Pencil,
  Check,
  X,
  Loader2,
  CheckCircle,
  Crown,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Shield,
  FileText,
  DollarSign,
  AlertTriangle,
  Copy,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { FeatureUpgradeModal } from "@/components/modals/FeatureUpgradeModal";

interface BusinessData {
  workspace: {
    organizationId: string;
    locationId: string;
    locationName: string;
  };
  business: {
    id: string;
    name: string;
    status: string;
    plan: string;
    independentClientPolicy?: string;
  };
  pilot?: {
    id: string;
    status: string;
    professionalCapacity: number;
    clientCapacity: number;
    durationDays: number;
    pilotStartAt: string | null;
    pilotEndAt: string | null;
  } | null;
  members: {
    id: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string;
    name?: string;
    email?: string;
    planLost?: boolean;
  }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: string;
  }[];
  planLostCount?: number;
  signupSource?: string | null;
  clientInvitations?: {
    id: string;
    email: string;
    token: string;
    programName: string | null;
    trialDays: number | null;
    status: string;
    createdAt: string;
    expiresAt: string;
    acceptedAt: string | null;
    inviterName: string | null;
  }[];
  clients?: {
    id: string;
    name: string | null;
    email: string | null;
    status: string;
    joinedAt: string | null;
  }[];
  organizationPolicies?: {
    requireAcademy: boolean;
    requireProfessionalVerification: boolean;
  };
}

interface WorkspaceOption {
  id: string;
  name: string;
  role: string;
  locations: Array<{ id: string; name: string; role: string; isDefault: boolean }>;
}

interface ActiveWorkspace {
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
}

interface MembershipData {
  membership: {
    role: string;
    businessName: string;
    joinedAt: string;
    independentClientPolicy?: string;
  };
}

const DEFAULT_BUSINESS_NAME = "My Business Team";

export default function BusinessDashboard() {
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const ROLE_OPTIONS = [
    { value: "admin", label: "Organization Admin" },
    { value: "coach", label: t("businessDashboard.roles.coach") },
    { value: "trainer", label: t("businessDashboard.roles.trainer") },
    { value: "physician", label: t("businessDashboard.roles.physician") },
    { value: "staff", label: t("businessDashboard.roles.staff") },
  ];
  const PILOT_ROLE_OPTIONS = [
    { value: "nurse", label: "Nurse" },
    { value: "provider", label: "Provider" },
    { value: "coach", label: "Coach" },
    { value: "staff", label: "Staff" },
  ];

  const POLICY_OPTIONS = [
    {
      value: "org_only",
      label: t("businessDashboard.policies.orgOnly"),
      description: t("businessDashboard.policies.orgOnlyDesc"),
    },
    {
      value: "allowed_with_disclosure",
      label: t("businessDashboard.policies.withDisclosure"),
      description: t("businessDashboard.policies.withDisclosureDesc"),
    },
    {
      value: "allowed",
      label: t("businessDashboard.policies.free"),
      description: t("businessDashboard.policies.freeDesc"),
    },
  ];

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const fromCheckout = params.get("checkout") === "success";

  const [ownerData, setOwnerData] = useState<BusinessData | null>(null);
  const [memberData, setMemberData] = useState<MembershipData | null>(null);
  // viewMode === null means the membership API has not yet responded.
  // INVARIANT: no membership-status-dependent UI (removal notices, member
  // banners, etc.) may render while viewMode is null. The loading guard below
  // enforces this by showing only a generic spinner until fetchData() resolves
  // and sets viewMode to "owner" | "member" | "none". Do not add any
  // membership-dependent JSX above or outside that guard.
  const [viewMode, setViewMode] = useState<"owner" | "admin" | "member" | "none" | null>(null);
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(fromCheckout);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace | null>(null);
  const [workspaceSelectionRequired, setWorkspaceSelectionRequired] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  // Setup screen state
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);

  // Invite modal (team member)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Invite client modal + entitlement gate
  const [clientUpgradeModalOpen, setClientUpgradeModalOpen] = useState(false);
  const [clientInviteOpen, setClientInviteOpen] = useState(false);
  // A user can perform Pro business actions when their accessTier is PAID_FULL —
  // this matches requireProAccess exactly: covers active trials, paid Pro/Clinical,
  // and internal/founder accounts. Free or expired users are locked.
  const hasProAccess = user?.accessTier === "PAID_FULL";
  const [clientEmail, setClientEmail] = useState("");
  const [clientProgramName, setClientProgramName] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientTrialOption, setClientTrialOption] = useState("30");
  const [clientInviteLoading, setClientInviteLoading] = useState(false);

  const resolvedTrialDays = parseInt(clientTrialOption);

  const resetClientForm = () => {
    setClientEmail("");
    setClientProgramName("");
    setClientTrialOption("30");
  };

  // Actions
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [resendingToken, setResendingToken] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Client ownership policy
  const [policyValue, setPolicyValue] = useState<string>("allowed_with_disclosure");
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Organization Policies (requireAcademy, requireProfessionalVerification)
  const { org } = useOrg();
  const [orgPolicies, setOrgPolicies] = useState<{
    requireAcademy: boolean;
    requireProfessionalVerification: boolean;
  }>({
    requireAcademy: org.featureFlags.requireAcademy !== false,
    requireProfessionalVerification: org.featureFlags.requireProfessionalVerification !== false,
  });
  const [savingOrgPolicies, setSavingOrgPolicies] = useState(false);
  const [confirmVerifOff, setConfirmVerifOff] = useState(false);

  // Launch guide checklist
  const [launchGuideDismissed, setLaunchGuideDismissed] = useState(
    () => localStorage.getItem("mpm.dismiss.orgLaunchGuide") === "1"
  );
  const dismissLaunchGuide = () => {
    localStorage.setItem("mpm.dismiss.orgLaunchGuide", "1");
    setLaunchGuideDismissed(true);
  };

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    document.title = "Organization Dashboard | My Perfect Meals";
    return () => { document.title = "My Perfect Meals"; };
  }, []);

  useEffect(() => {
    if (ownerData?.business?.independentClientPolicy) {
      setPolicyValue(ownerData.business.independentClientPolicy);
    }
  }, [ownerData]);

  useEffect(() => {
    if (ownerData?.organizationPolicies) {
      setOrgPolicies(ownerData.organizationPolicies);
    }
  }, [
    ownerData?.workspace.organizationId,
    ownerData?.organizationPolicies?.requireAcademy,
    ownerData?.organizationPolicies?.requireProfessionalVerification,
  ]);

  const handleToggleOrgPolicy = async (flag: "requireAcademy" | "requireProfessionalVerification", value: boolean) => {
    setSavingOrgPolicies(true);
    const next = { ...orgPolicies, [flag]: value };
    setOrgPolicies(next); // optimistic
    try {
      const res = await fetch("/api/business/org-policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ [flag]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrgPolicies(orgPolicies); // revert on error
        toast({ title: t("businessDashboard.errors.couldNotSavePolicy"), description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: t("businessDashboard.success.policySaved"), description: t("businessDashboard.success.policyUpdated") });
    } catch {
      setOrgPolicies(orgPolicies);
      toast({ title: "Error", description: t("businessDashboard.errors.policyError"), variant: "destructive" });
    } finally {
      setSavingOrgPolicies(false);
    }
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const res = await fetch("/api/business/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ policy: policyValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("businessDashboard.errors.couldNotSavePolicy"), description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Policy updated", description: t("businessDashboard.success.policyUpdatedClient") });
      fetchData();
    } catch {
      toast({ title: "Error", description: t("businessDashboard.errors.policyError"), variant: "destructive" });
    } finally {
      setSavingPolicy(false);
    }
  };

  const fetchData = async (): Promise<boolean> => {
    try {
      const [optionsRes, activeRes] = await Promise.all([
        fetch("/api/business/workspace/options", {
          headers: { ...getAuthHeaders() },
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/business/workspace/active", {
          headers: { ...getAuthHeaders() },
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (optionsRes.ok) {
        const optionsJson = await optionsRes.json();
        setWorkspaceOptions(
          Array.isArray(optionsJson.organizations) ? optionsJson.organizations : [],
        );
      }
      if (!activeRes.ok) {
        const activeError = await activeRes.json().catch(() => ({}));
        if (activeError.code === "WORKSPACE_SELECTION_REQUIRED") {
          setWorkspaceSelectionRequired(true);
          setViewMode("none");
          return false;
        }
        throw new Error(activeError.error || "Could not resolve workspace.");
      }
      const activeJson = await activeRes.json();
      setActiveWorkspace(activeJson.workspace);
      setWorkspaceSelectionRequired(false);

      // Try owner first
      const ownerRes = await fetch("/api/business/mine", {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (ownerRes.ok) {
        const json = await ownerRes.json();
        setOwnerData(json);
        setViewMode(json.callerRole === "admin" ? "admin" : "owner");
        if (json.business?.name === DEFAULT_BUSINESS_NAME) {
          setSetupMode(true);
        }
        return true;
      }

      // Try member
      let memberRes = await fetch("/api/business/membership", {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });

      // A 403 here can happen when the client's auth session is stale right
      // after accepting a re-invite (access tier not yet updated). Refresh
      // the user profile once and retry before giving up.
      if (memberRes.status === 403) {
        try { await refreshUser(); } catch { /* non-fatal */ }
        await new Promise((r) => setTimeout(r, 300));
        memberRes = await fetch("/api/business/membership", {
          headers: { ...getAuthHeaders() },
          credentials: "include",
          cache: "no-store",
        });
      }

      if (memberRes.ok) {
        const json = await memberRes.json();
        setMemberData(json);
        setViewMode("member");
        return true;
      }

      setViewMode("none");
      return false;
    } catch {
      setViewMode("none");
      return false;
    }
  };

  const handleWorkspaceSwitch = async (organizationId: string, locationId: string) => {
    setSwitchingWorkspace(true);
    try {
      const response = await fetch("/api/business/workspace/select", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ organizationId, locationId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not switch workspace.");
      setActiveWorkspace(body.workspace);
      setOwnerData(null);
      setMemberData(null);
      setLoading(true);
      const found = await fetchData();
      if (!found) throw new Error("The selected workspace could not be loaded.");
    } catch (error: any) {
      toast({
        title: "Could not switch workspace",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSwitchingWorkspace(false);
    }
  };

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const init = async () => {
      const found = await fetchData();
      setLoading(false);

      // If came from checkout and business not ready yet, poll for up to 30s
      if (!found && fromCheckout) {
        setPolling(true);
        const tryAgain = async () => {
          pollCount.current += 1;
          if (pollCount.current > 15) {
            setPolling(false);
            return;
          }
          const ok = await fetchData();
          if (ok) {
            setPolling(false);
          } else {
            pollRef.current = setTimeout(tryAgain, 2000);
          }
        };
        pollRef.current = setTimeout(tryAgain, 2000);
      }
    };
    init();

    // Auto-refresh owner dashboard every 30s so accepted invites appear without manual reload
    refreshIntervalRef.current = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const handleSaveSetup = async () => {
    if (setupName.trim().length < 2) {
      toast({ title: t("businessDashboard.errors.nameTooShort"), description: t("businessDashboard.errors.enterTwoChars"), variant: "destructive" });
      return;
    }
    setSavingSetup(true);
    try {
      const res = await fetch("/api/business/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ name: setupName.trim() }),
      });
      if (res.ok) {
        setSetupMode(false);
        await fetchData();
        // Clean up URL without reload
        window.history.replaceState({}, "", "/business-dashboard");
      }
    } catch {
      toast({ title: "Error", description: t("businessDashboard.errors.couldNotSave"), variant: "destructive" });
    } finally {
      setSavingSetup(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.includes("@")) {
      toast({ title: t("businessDashboard.errors.invalidEmail"), description: t("businessDashboard.errors.enterValidEmail"), variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const pilotId = ownerData?.pilot?.id;
      const res = await fetch(pilotId ? `/api/business/pilots/${pilotId}/invitations` : "/api/business/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(pilotId
          ? { email: inviteEmail, populationType: "professional", participantRole: inviteRole }
          : { email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: t("businessDashboard.errors.inviteFailed"), description: json.error, variant: "destructive" });
        return;
      }
      toast({ title: t("businessDashboard.success.invitationSent"), description: `${inviteEmail} will receive an email with a link to join.` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("staff");
      fetchData();
    } catch {
      toast({ title: "Error", description: "Could not send invitation.", variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/business/members/${memberId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Member removed" });
        fetchData();
      } else {
        const json = await res.json();
        toast({ title: "Error", description: json.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not remove member.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleClientInvite = async (deliveryMethod: "email" | "link") => {
    if (!clientEmail.includes("@")) {
      toast({ title: "Valid email required", variant: "destructive" });
      return;
    }
    setClientInviteLoading(true);
    try {
      const pilotId = ownerData?.pilot?.id;
      const res = await fetch(pilotId ? `/api/business/pilots/${pilotId}/invitations` : "/api/business/invite", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(pilotId ? {
          email: clientEmail,
          populationType: "client",
          participantRole: "client",
          participantName: clientProgramName.trim() || null,
          sendEmail: deliveryMethod === "email",
        } : {
          email: clientEmail,
          invitationType: "client",
          trialDays: resolvedTrialDays,
          programName: clientProgramName.trim() || null,
          sendEmail: deliveryMethod === "email",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: t("businessDashboard.errors.inviteFailed"), description: json.error, variant: "destructive" });
        return;
      }
      const link: string = json.inviteLink;
      if (deliveryMethod === "email") {
        toast({ title: t("businessDashboard.success.invitationSent"), description: `${clientEmail} will receive an email.` });
      } else {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link copied!", description: "Share this link with your client." });
      }
      setClientInviteOpen(false);
      resetClientForm();
      fetchData();
    } catch {
      toast({ title: "Error", description: "Could not create invitation.", variant: "destructive" });
    } finally {
      setClientInviteLoading(false);
    }
  };

  const handleCancelInvite = async (token: string) => {
    setCancellingToken(token);
    try {
      const res = await fetch(`/api/business/invitations/${token}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) { toast({ title: "Invite cancelled" }); fetchData(); }
    } catch {
      toast({ title: "Error", description: "Could not cancel invite.", variant: "destructive" });
    } finally {
      setCancellingToken(null);
    }
  };

  const handleResendInvite = async (token: string) => {
    setResendingToken(token);
    try {
      const res = await fetch(`/api/business/invitations/${token}/resend`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Invite resent!" });
        fetchData();
      } else {
        const json = await res.json().catch(() => ({}));
        toast({ title: "Could not resend", description: json.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not resend invite.", variant: "destructive" });
    } finally {
      setResendingToken(null);
    }
  };

  const handleSaveName = async () => {
    if (nameInput.trim().length < 2) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/business/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (res.ok) { toast({ title: "Business name updated" }); setEditingName(false); fetchData(); }
    } catch {
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  // ── Polling / Loading screen ────────────────────────────────────────────────
  // INVARIANT: this guard must remain the first conditional render in this
  // component. It ensures that while `loading` is true (i.e. fetchData() has
  // not yet resolved) or while we are polling for a newly-created business,
  // only the generic spinner is displayed — never any UI that depends on
  // `viewMode`, `memberData`, or `ownerData`. This prevents a re-joined member
  // from briefly seeing stale removal-notice UI before the membership API
  // responds. Never hoist membership-status-dependent JSX above this block.
  if (loading || polling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-4" />
        {polling && fromCheckout ? (
          <>
            <h2 className="text-white text-lg font-bold mb-1">{t("businessDashboard.settingUp")}</h2>
            <p className="text-white/50 text-sm">{t("businessDashboard.confirmingPayment")}</p>
          </>
        ) : (
          <p className="text-white/50 text-sm">{t("businessDashboard.loading")}</p>
        )}
      </div>
    );
  }

  // ── No business found (and not polling) ────────────────────────────────────
  if (workspaceSelectionRequired) {
    const locations = workspaceOptions.flatMap((organization) =>
      organization.locations.map((location) => ({ organization, location })));
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-black/70 border border-orange-500/30 text-white p-5 space-y-4">
          <div>
            <h1 className="text-xl font-bold">Select your workspace</h1>
            <p className="text-white/60 text-sm mt-1">
              Choose the Organization and Location you want to manage.
            </p>
          </div>
          <div className="space-y-2">
            {locations.map(({ organization, location }) => (
              <button
                key={location.id}
                disabled={switchingWorkspace}
                onClick={() => handleWorkspaceSwitch(organization.id, location.id)}
                className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-orange-400/40 disabled:opacity-50"
              >
                <span className="block font-semibold">{organization.name}</span>
                <span className="block text-sm text-white/55">{location.name}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (viewMode === "none" || viewMode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <Building2 className="w-14 h-14 text-orange-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">{t("businessDashboard.noBusinessFound")}</h2>
        <p className="text-white/60 text-sm mb-6 max-w-xs">
          A business account is created automatically when you purchase an Organization plan.
        </p>
        <button
          className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors"
          onClick={() => setLocation("/pricing")}
        >
          View Plans
        </button>
      </div>
    );
  }

  // ── Member view (non-owner) ─────────────────────────────────────────────────
  if (viewMode === "member" && memberData) {
    const { membership } = memberData;
    const roleLabel = membership.role.charAt(0).toUpperCase() + membership.role.slice(1);

    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 pb-24" style={{ paddingBottom: "max(6rem, calc(env(safe-area-inset-bottom) + 5rem))" }}>
        {/* Header — mobile only; desktop uses DesktopLayout shell header */}
        {!isDesktop && (
          <div className="fixed top-0 left-0 right-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div className="px-4 py-3 flex items-center gap-3">
              <button onClick={() => setLocation("/more")} className="text-white/60 active:text-white transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">{t("businessDashboard.title")}</h1>
                <p className="text-white/50 text-xs">{t("businessDashboard.orgMember")}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-10 max-w-lg mx-auto space-y-4" style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}>

          {/* Welcome banner */}
          <div className="bg-gradient-to-r from-orange-900/50 to-orange-700/30 border border-orange-500/20 rounded-2xl p-5 text-center">
            <Building2 className="w-10 h-10 text-orange-400 mx-auto mb-3" />
            <h2 className="text-white font-bold text-xl">{membership.businessName}</h2>
            <p className="text-orange-200 text-sm mt-1">
              Welcome to the team as a <span className="text-white font-semibold">{roleLabel}</span>
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-sm font-medium">{t("businessDashboard.orgAccessActive")}</span>
            </div>
          </div>

          {/* Membership details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{t("businessDashboard.role")}</span>
              <Badge className="bg-orange-600/80 text-white border-0 text-xs">{roleLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{t("businessDashboard.access")}</span>
              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Organization Access
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{t("businessDashboard.joined")}</span>
              <span className="text-white/70 text-sm">
                {new Date(membership.joinedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Path to working with clients */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="text-white font-bold text-base">
              Your Path to Working with Clients
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Now that you're officially part of the team, your first step is to complete the{" "}
              <span className="text-white font-semibold">{t("businessDashboard.academy")}</span>. The Academy walks you through the entire platform — meal builders, dietary protocols, clinical nutrition tools, client management, marketing, and how to get the most out of every feature for the people you coach.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              Once you finish all the lessons, you'll earn your certification. At that point,{" "}
              <span className="text-white font-semibold">your ProCare Studio unlocks automatically</span> — no extra steps needed. Your Studio is where you'll manage your clients, track progress, communicate, and deliver your coaching programs.
            </p>
            <p className="text-white/70 text-sm leading-relaxed">
              After that, head to the{" "}
              <span className="text-white font-semibold">More page</span> to set up your Studio and get started. By the time you finish the Academy, you'll know exactly where the More page is and what everything does — because you just went through the whole app.
            </p>
          </div>

          {/* Organization Policies */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <h3 className="text-white font-bold text-base">{t("businessDashboard.orgPolicies")}</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Your organization has set a policy that governs how coaches and trainers may work with clients outside of{" "}
              <span className="text-white font-semibold">{membership.businessName}</span>. This policy applies to you as a team member.
            </p>
            {membership.independentClientPolicy === "org_only" && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-300 text-sm font-semibold mb-1">Organization Clients Only</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  You may not take on personal clients outside of this organization. All client relationships are managed through the organization, and any clients you work with belong to{" "}
                  <span className="text-white/80">{membership.businessName}</span>.
                </p>
              </div>
            )}
            {membership.independentClientPolicy === "allowed_with_disclosure" && (
              <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl p-3">
                <p className="text-yellow-300 text-sm font-semibold mb-1">Personal Clients Allowed — With Disclosure</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  You may maintain personal clients outside of this organization, but you must disclose the relationship to{" "}
                  <span className="text-white/80">{membership.businessName}</span>. Transparency keeps everyone aligned.
                </p>
              </div>
            )}
            {(membership.independentClientPolicy === "allowed" || !membership.independentClientPolicy) && (
              <div className="bg-green-900/20 border border-green-500/20 rounded-xl p-3">
                <p className="text-green-300 text-sm font-semibold mb-1">Personal Clients Freely Allowed</p>
                <p className="text-white/60 text-xs leading-relaxed">
                  You are free to maintain personal clients outside of this organization without any restriction or disclosure requirement.
                </p>
              </div>
            )}
          </div>

          {/* Client Ownership */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <h3 className="text-white font-bold text-base">{t("businessDashboard.clientOwnership")}</h3>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Understanding who owns a client relationship is important. Here's how it works inside{" "}
              <span className="text-white font-semibold">{membership.businessName}</span>:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                <p className="text-white/70 text-sm leading-relaxed">
                  <span className="text-white font-medium">Clients assigned through the organization</span> are considered organization clients. The organization retains the relationship if you leave the team.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                <p className="text-white/70 text-sm leading-relaxed">
                  <span className="text-white font-medium">Clients you bring personally</span> (if your organization's policy allows it) are your own. You keep those relationships regardless of your membership status.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                <p className="text-white/70 text-sm leading-relaxed">
                  <span className="text-white font-medium">If you ever leave the organization,</span> your personally-owned clients remain in your ProCare Studio. Organization-assigned clients stay with the organization. Your personal account and all your data remain intact.
                </p>
              </div>
            </div>
            <p className="text-white/40 text-xs leading-relaxed pt-1">
              Questions about client ownership or your organization's policies? Reach out to your team owner or administrator at{" "}
              <span className="text-white/60">{membership.businessName}</span>.
            </p>
          </div>

          {/* Studio unlock callout */}
          <div className="bg-black/60 border border-orange-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Crown className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">
                  Complete the Academy to unlock your ProCare Studio
                </p>
                <p className="text-orange-200/70 text-xs mt-1 leading-relaxed">
                  Your organization requires Academy certification before you can begin working with clients. Once you finish, your Studio activates automatically.
                </p>
                <button
                  className="mt-3 w-full py-2.5 rounded-xl bg-orange-600 border border-orange-500/30 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  onClick={() => setLocation("/academy")}
                >
                  Launch Academy
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-white/25 text-xs text-center px-4">
            Organization settings are controlled by your team owner. Contact them with any questions.
          </p>
        </div>
      </div>
    );
  }

  // ── Owner / Admin view ──────────────────────────────────────────────────────
  if (!ownerData) return null;
  // isAdminView: true when the caller is an Organization Admin (not the Owner).
  // Admins see the full day-to-day management dashboard.
  const isAdminView = viewMode === "admin";
  const { business, members, invitations } = ownerData;

  // ── Pending billing (org provisioned but Stripe not yet completed) ──────────
  if (business.status === "pending_billing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-sm space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-600/20 border border-orange-500/30">
            <Building2 className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h2 className="text-white text-xl font-bold mb-2">Organization Account Approved</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-1">
              Your organization has been set up. Complete your subscription to activate client and team management.
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              Once billing is confirmed, you can invite team members and manage your organization.
            </p>
          </div>
          <button
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
            onClick={() => setLocation("/business/setup")}
          >
            Complete Your Subscription
          </button>
          <button
            className="w-full py-2 rounded-xl bg-white/10 text-white/60 text-sm"
            onClick={() => setLocation("/dashboard")}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── First-time setup screen ─────────────────────────────────────────────────
  if (setupMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-600/20 border border-orange-500/20 mb-4">
              <Crown className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-white text-2xl font-bold">Welcome to Your Organization</h1>
            <p className="text-white/60 text-sm mt-2">
              Your Organization plan is active. Let's get set up.
            </p>
          </div>

          <Card className="bg-white/5 border border-orange-500/20 text-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-orange-300 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              Your Organization Dashboard is ready.
            </div>

            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Business or Team Name
              </label>
              <input
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="e.g. Apex Performance Nutrition"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveSetup()}
                autoFocus
              />
            </div>

          </Card>

          <button
            className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={handleSaveSetup}
            disabled={savingSetup || setupName.trim().length < 2}
          >
            {savingSetup ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : "Set Up My Business Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  // ── Full owner dashboard ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 pb-24" style={{ paddingBottom: "max(6rem, calc(env(safe-area-inset-bottom) + 5rem))" }}>
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
        <div className="fixed top-0 left-0 right-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setLocation("/more")} className="text-white/60 active:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-white font-bold text-base leading-tight">Organization Dashboard</h1>
              <p className="text-white/50 text-xs">Manage clients, team members &amp; invitations</p>
            </div>
            <button
              onClick={() => fetchData()}
              className="text-white/50 active:text-white transition-colors p-1.5 rounded-lg active:bg-white/10"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 space-y-4 max-w-2xl mx-auto" style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}>

        {workspaceOptions.reduce((count, option) => count + option.locations.length, 0) > 1 && activeWorkspace && (
          <Card className="bg-white/5 border border-orange-500/20 text-white p-4">
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-2">
              Organization / Location
            </label>
            <select
              value={`${activeWorkspace.organizationId}:${activeWorkspace.locationId}`}
              disabled={switchingWorkspace}
              onChange={(event) => {
                const [organizationId, locationId] = event.target.value.split(":");
                handleWorkspaceSwitch(organizationId, locationId);
              }}
              className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-white disabled:opacity-50"
            >
              {workspaceOptions.flatMap((organization) =>
                organization.locations.map((location) => (
                  <option key={location.id} value={`${organization.id}:${location.id}`}>
                    {organization.name} — {location.name}
                  </option>
                )))}
            </select>
          </Card>
        )}

        {/* Launch Guide Checklist — shown until dismissed */}
        {!launchGuideDismissed && (() => {
          const hasInvited = (ownerData?.invitations.length ?? 0) > 0 || (ownerData?.members.length ?? 1) > 1;
          return (
            <div className="bg-gradient-to-br from-orange-600/15 via-orange-600/8 to-transparent border border-orange-500/25 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-white font-bold text-sm">Launch Your Organization</h2>
                  <p className="text-white/50 text-xs mt-0.5">Complete these steps to get running</p>
                </div>
                <button
                  onClick={dismissLaunchGuide}
                  className="text-white/30 text-xs active:text-white/60 transition-colors ml-3 mt-0.5 flex-shrink-0"
                >
                  Dismiss
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { done: true, label: "Subscription activated" },
                  { done: true, label: "Organization named" },
                  {
                    done: hasInvited,
                    label: "Invite your team — add coaches, trainers, or staff",
                    action: () => setInviteOpen(true),
                  },
                  {
                    done: (ownerData?.clientInvitations?.length ?? 0) > 0,
                    label: "Invite your first client — give clients complimentary access",
                    action: () => setClientInviteOpen(true),
                  },
                  {
                    done: false,
                    label: "Partner & Revenue Center — unlocks after Academy certification",
                    action: () => setLocation("/business-center/affiliate"),
                  },
                ].map(({ done, label, action }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border ${
                      done ? "bg-green-500/20 border-green-500/40" : "bg-white/5 border-white/20"
                    }`}>
                      {done ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/20" />
                      )}
                    </div>
                    {action ? (
                      <button
                        onClick={action}
                        className={`text-sm flex-1 text-left ${done ? "text-white/40 line-through" : "text-white/80 underline decoration-white/20"}`}
                      >
                        {label}
                      </button>
                    ) : (
                      <span className={`text-sm ${done ? "text-white/40 line-through" : "text-white/80"}`}>
                        {label}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {hasInvited && (
                <button
                  onClick={dismissLaunchGuide}
                  className="mt-4 w-full py-2 rounded-xl bg-orange-600/30 border border-orange-500/30 text-orange-300 text-sm font-semibold active:opacity-80 transition-opacity"
                >
                  {t("businessDashboard.allSet")}
                </button>
              )}
            </div>
          );
        })()}

        {/* Business Name */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4">
          <div className="flex items-center justify-between">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm flex-1 outline-none focus:border-orange-400"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <button className="p-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50" onClick={handleSaveName} disabled={savingName}>
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white" onClick={() => setEditingName(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Building2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
                  <span className="font-semibold text-sm truncate">{business.name}</span>
                  {isAdminView && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-medium flex-shrink-0">
                      <Shield className="w-3 h-3" />
                      Organization Admin
                    </span>
                  )}
                </div>
                {!isAdminView && (
                  <button
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors flex-shrink-0"
                    onClick={() => { setNameInput(business.name); setEditingName(true); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Admin role explanation — shown only when viewing as admin */}
        {isAdminView && (
          <div className="flex items-start gap-2.5 px-1">
            <HelpCircle className="w-4 h-4 text-blue-400/70 flex-shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs leading-relaxed">
              Admins can invite members and manage day-to-day organization operations.
            </p>
          </div>
        )}

        {/* Organization overview */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-400" />
              <span className="font-semibold text-sm">Clients & Team Members</span>
            </div>
          </div>
          <p className="mt-2 text-white/60 text-xs leading-relaxed">
            Your flat $44.99/month Organization plan lets you manage client invitations and professional team members in one place.
          </p>
        </Card>

        <InfoCallout title="Professional team invitations">
          Invite coaches, trainers, physicians, and staff to join your organization. Each professional receives a one-time 30-day introductory entitlement; after it ends, they need another valid entitlement to continue professional access.
        </InfoCallout>

        {/* Invite Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setInviteOpen(true)}
            disabled={business.status !== "active"}
          >
            <UserPlus className="w-4 h-4" />
            {t("businessDashboard.inviteTeamMember")}
          </button>
          <button
            className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            onClick={() => {
              if (!hasProAccess) {
                setClientUpgradeModalOpen(true);
                return;
              }
              setClientInviteOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4" />
            {t("businessDashboard.inviteClient")}
          </button>
        </div>

        <InfoCallout title="Team Member vs. Client Invitation — what's the difference?">
          <p><span className="text-white/75 font-medium">Invite Team Member</span> is for your staff — coaches, trainers, physicians, and other professionals who work inside your organization. They sign in with their own account and receive a one-time 30-day introductory entitlement.</p>
          <p className="mt-1.5"><span className="text-white/75 font-medium">Invite Client</span> is for patients and end-users. They receive a link granting 7, 14, or 30 days of complimentary access. When that period ends, they keep a free account and can upgrade on their own.</p>
        </InfoCallout>

        {/* Partner & Revenue Center */}
        <button
          className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-orange-600/15 via-orange-600/10 to-transparent border border-orange-500/25 active:opacity-80 transition-opacity text-left"
          onClick={() => setLocation("/business-center/affiliate/dashboard")}
        >
          <div className="w-9 h-9 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Partner & Revenue Center</p>
            <p className="text-white/50 text-xs mt-0.5">Promo code · Commissions · Analytics</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
        </button>

        <InfoCallout title="What is the Partner & Revenue Center?">
          <p>This is where you manage your affiliate relationship with My Perfect Meals. You get a unique referral link — when someone signs up through it, you earn a commission tracked automatically.</p>
          <p className="mt-1.5">You can also create <span className="text-white/75 font-medium">promo codes</span> here. A promo code is a shareable shortcut that gives your clients a discount or trial extension. The outcome is the same as a direct Client Invitation, but promo codes can be handed out broadly (posted on a website, printed on a flyer) without entering each person's email one by one.</p>
        </InfoCallout>

        {/* Acquisition Source — shown only when recorded */}
        {ownerData?.signupSource && (
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-white/40" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-xs">Acquisition source</p>
              <p className="text-white/70 text-sm font-medium truncate">{ownerData.signupSource}</p>
            </div>
          </div>
        )}

        {/* Organization Success Center */}
        <button
          className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-orange-600/15 via-orange-600/10 to-transparent border border-orange-500/25 active:opacity-80 transition-opacity text-left"
          onClick={() => setLocation("/org-success-center")}
        >
          <div className="w-9 h-9 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Organization Success Center</p>
            <p className="text-white/50 text-xs mt-0.5">How-to guides · Read or listen</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
        </button>

        {/* Client Ownership Policy */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="font-semibold text-sm">Client Ownership Policy</span>
          </div>
          <p className="text-white/50 text-xs leading-relaxed">
            Sets the rules for whether members may maintain personal clients outside of this organization. Members see this when they accept their invitation.
          </p>
          <div className="space-y-2">
            {POLICY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors border ${
                  policyValue === opt.value
                    ? "bg-orange-600/25 border-orange-500/30"
                    : "bg-white/5 border-white/10"
                }`}
                onClick={() => setPolicyValue(opt.value)}
              >
                <span className={`block text-sm font-semibold ${policyValue === opt.value ? "text-white" : "text-white/60"}`}>
                  {opt.label}
                </span>
                <span className="block text-xs text-white/40 mt-0.5">{opt.description}</span>
              </button>
            ))}
          </div>
          {policyValue !== (ownerData?.business?.independentClientPolicy ?? "allowed_with_disclosure") && (
            <button
              className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleSavePolicy}
              disabled={savingPolicy}
            >
              {savingPolicy ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><Check className="w-4 h-4" /> Save Policy</>
              )}
            </button>
          )}
          {policyValue === (ownerData?.business?.independentClientPolicy ?? "allowed_with_disclosure") && (
            <p className="text-white/30 text-xs text-center">Policy is active — change a selection above to update</p>
          )}
          <button
            className="w-full text-xs text-orange-400 text-center py-1"
            onClick={() => setLocation("/org-success-center")}
          >
            Learn how policies work →
          </button>
        </Card>

        <InfoCallout title="What does Client Ownership Policy mean for your clinic?">
          <p>This setting tells your team members whether they can work with clients <span className="text-white/75 font-medium">outside</span> of your organization. For most clinics, <span className="text-white/75 font-medium">Allowed with Disclosure</span> is the right choice — your coaches can maintain private clients, but they must tell you about those relationships so there are no conflicts.</p>
          <p className="mt-1.5">If your clinic model depends on exclusive client relationships (e.g. a hospital referral program), choose <span className="text-white/75 font-medium">Organization Clients Only</span>. This setting appears in every team member's dashboard so they always know the rules.</p>
        </InfoCallout>

        {/* Organization Policies */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="font-semibold text-sm">{t("businessDashboard.orgPolicies")}</span>
          </div>
          <p className="text-white/50 text-xs leading-relaxed">
            These policies apply to every team member in your organization. Changes take effect immediately for new logins.
          </p>

          {/* Require Academy */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Require Academy before Studio access</p>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">
                  When active, team members must complete My Perfect Meals Academy before accessing Studio. When inactive, Studio is available immediately and Academy remains available from the menu.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={savingOrgPolicies}
                onClick={() => handleToggleOrgPolicy("requireAcademy", true)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${orgPolicies.requireAcademy ? "bg-orange-600 text-white" : "bg-white/5 text-white/50 border border-white/10"}`}
              >
                Active
              </button>
              <button
                disabled={savingOrgPolicies}
                onClick={() => handleToggleOrgPolicy("requireAcademy", false)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${!orgPolicies.requireAcademy ? "bg-white/15 text-white" : "bg-white/5 text-white/50 border border-white/10"}`}
              >
                Inactive
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Require Professional Verification */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Require professional credential verification</p>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">
                  When active, My Perfect Meals verifies professional licenses before granting access to professional tools. When inactive, your organization accepts responsibility for verifying credentials.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={savingOrgPolicies}
                onClick={() => handleToggleOrgPolicy("requireProfessionalVerification", true)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${orgPolicies.requireProfessionalVerification ? "bg-orange-600 text-white" : "bg-white/5 text-white/50 border border-white/10"}`}
              >
                Active
              </button>
              <button
                disabled={savingOrgPolicies}
                onClick={() => !orgPolicies.requireProfessionalVerification
                  ? undefined
                  : setConfirmVerifOff(true)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${!orgPolicies.requireProfessionalVerification ? "bg-white/15 text-white" : "bg-white/5 text-white/50 border border-white/10"}`}
              >
                Inactive
              </button>
            </div>
          </div>
        </Card>

        <InfoCallout title="What does My Perfect Meals handle vs. what your organization owns?">
          <p><span className="text-white/75 font-medium">My Perfect Meals</span> provides the nutrition platform, meal intelligence, coaching tools, and all the software infrastructure. When a client uses the app, MPM handles meal generation, dietary protocols, data storage, and platform support.</p>
          <p className="mt-1.5"><span className="text-white/75 font-medium">Your organization</span> owns the client relationship — the intake, the care plan, the coaching conversations, and the clinical decisions. MPM is the tool your team uses; you remain the professional of record. The Client Ownership Policy above determines what happens to those relationships if a team member leaves.</p>
        </InfoCallout>

        {/* Confirmation: disable professional verification */}
        <Dialog open={confirmVerifOff} onOpenChange={setConfirmVerifOff}>
          <DialogContent className="bg-black/90 border border-orange-500/30 text-white max-w-sm mx-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white text-base font-bold">Disable Professional Verification?</DialogTitle>
            </DialogHeader>
            <p className="text-white/70 text-sm leading-relaxed">
              By disabling My Perfect Meals Professional Verification, you confirm that your organization is responsible for verifying the credentials of all invited professionals.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold"
                onClick={() => setConfirmVerifOff(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold"
                onClick={() => {
                  setConfirmVerifOff(false);
                  handleToggleOrgPolicy("requireProfessionalVerification", false);
                }}
              >
                Confirm
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Plan-lost alert banner */}
        {(ownerData.planLostCount ?? 0) > 0 && (
          <div className="bg-yellow-900/25 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-300 text-sm font-semibold">
                {ownerData.planLostCount} member{(ownerData.planLostCount ?? 0) !== 1 ? "s have" : " has"} downgraded to Free
              </p>
              <p className="text-yellow-200/60 text-xs mt-0.5 leading-relaxed">
                These members no longer have a valid entitlement for professional access. Review their status or remove them from the organization as appropriate.
              </p>
            </div>
          </div>
        )}

        {/* Active Members */}
        <div>
          <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
            Team / People ({members.length})
          </h2>
          <div className="space-y-2">
            {members.map((m) => (
              <Card
                key={m.id}
                className={`text-white p-3 ${m.planLost ? "bg-yellow-900/15 border border-yellow-500/25" : "bg-white/5 border border-white/10"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.name || m.email || "Unknown"}</p>
                      {m.planLost && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 text-xs font-medium flex-shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          No Plan
                        </span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs truncate">{m.email || ""}</p>
                     <p className="text-green-400/80 text-xs mt-0.5">Active</p>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs border-0 ${m.role === "owner" ? "bg-orange-600/80 text-white" : "bg-white/10 text-white/70"}`}>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </Badge>
                    <button
                      className="p-1.5 rounded-lg bg-white/10 text-white/60 transition-colors"
                      onClick={() => setSelectedMemberId(m.id)}
                      title="View client accounting"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {m.role !== "owner" && !(viewMode === "admin" && m.role === "admin") && (
                      <button
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${m.planLost ? "bg-yellow-900/40 text-yellow-400" : "bg-red-900/30 text-red-400"}`}
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={removingId === m.id}
                        title={m.planLost ? "Remove member (no plan)" : "Remove member"}
                      >
                        {removingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {members.length === 0 && (
              <p className="text-white/40 text-sm text-center py-4">No members yet.</p>
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
              Invitation Pending ({invitations.length})
            </h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <Card key={inv.id} className="bg-white/5 border border-white/10 text-white p-3 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{inv.email}</p>
                      <p className="text-white/40 text-xs">
                         Name pending · {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)} · Invitation Pending
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors disabled:opacity-40"
                      onClick={() => handleResendInvite(inv.token)}
                      disabled={resendingToken === inv.token}
                      title="Resend invite"
                    >
                      {resendingToken === inv.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors disabled:opacity-40"
                      onClick={() => handleCancelInvite(inv.token)}
                      disabled={cancellingToken === inv.token}
                      title="Cancel invite"
                    >
                      {cancellingToken === inv.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>

        {/* Client Invitations */}
        {(ownerData.clients?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
              Clients ({ownerData.clients?.length ?? 0})
            </h2>
            <input
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Search clients"
              className="w-full mb-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
            />
            <div className="space-y-2">
              {ownerData.clients
                ?.filter((client) => {
                  const query = clientSearch.trim().toLowerCase();
                  if (!query) return true;
                  return `${client.name ?? ""} ${client.email ?? ""}`.toLowerCase().includes(query);
                })
                .map((client) => (
                <Card key={client.id} className="bg-white/5 border border-white/10 text-white p-3">
                  <p className="text-sm font-medium">{client.name || client.email || "Client"}</p>
                  <p className="text-white/50 text-xs">{client.email || ""}</p>
                  <p className="text-green-400/80 text-xs mt-0.5">Active</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const clientInvites = ownerData.clientInvitations ?? [];
          return (
          <div>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
              Client Invitations ({clientInvites.length})
            </h2>
            <div className="mb-3">
              <InfoCallout title="How does complimentary access work?">
                <p>When you invite a client, they receive a secure link granting them full platform access for 7, 14, or 30 days. This is completely free for them — no credit card, no commitment.</p>
                <p className="mt-1.5">When the trial expires, their account automatically <span className="text-white/75 font-medium">converts to a Free plan</span>. They keep their account and can continue using free features or upgrade on their own. They won't lose their data. You'll see the status of each invitation — Pending, Active, or Expired — in the list below.</p>
              </InfoCallout>
            </div>
            {clientInvites.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <UserPlus className="w-7 h-7 text-white/20 mx-auto mb-2" />
                <p className="text-white/60 text-sm font-medium">No client invitations yet</p>
                <p className="text-white/40 text-xs mt-1 leading-relaxed max-w-xs mx-auto">
                  Send a Client Invitation to give a patient or client complimentary access to My Perfect Meals.
                </p>
                <button
                  className="mt-3 px-4 py-2 rounded-lg bg-orange-600/80 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                  onClick={() => {
                    if (!hasProAccess) { setClientUpgradeModalOpen(true); return; }
                    setClientInviteOpen(true);
                  }}
                >
                  Invite a Client
                </button>
              </div>
            ) : (
            <div className="space-y-2">
              {clientInvites.map((inv) => {
                const isPending = inv.status === "pending" && new Date(inv.expiresAt) > new Date();
                const isExpired = (inv.status === "expired") || (inv.status === "pending" && new Date(inv.expiresAt) <= new Date());
                const statusColor =
                  inv.status === "accepted" ? "text-green-400" :
                  isPending ? "text-blue-400" : "text-white/30";
                const statusLabel =
                  inv.status === "accepted" ? "Active" :
                  isPending ? "Pending" :
                  isExpired ? "Expired" :
                  inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
                const programLabel = inv.programName || "My Perfect Meals Complimentary Access";
                return (
                  <Card key={inv.id} className="bg-white/5 border border-white/10 text-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{inv.email}</p>
                        <p className="text-white/60 text-xs mt-0.5 truncate">{programLabel} · {inv.trialDays ?? 30} days</p>
                        {inv.inviterName && (
                          <p className="text-white/30 text-xs mt-0.5">Sent by {inv.inviterName}</p>
                        )}
                        {isPending && (
                          <p className="text-white/30 text-xs mt-0.5">
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 mt-0.5 ${statusColor}`}>{statusLabel}</span>
                    </div>
                    {inv.acceptedAt && (
                      <p className="text-white/30 text-xs mt-1.5">
                        Accepted {new Date(inv.acceptedAt).toLocaleDateString()}
                      </p>
                    )}
                    {(isPending || isExpired) && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => handleResendInvite(inv.token)}
                          disabled={resendingToken === inv.token || cancellingToken === inv.token}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                        >
                          {resendingToken === inv.token ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Resend
                        </button>
                        {isPending && (
                          <>
                            <span className="text-white/20 text-xs">·</span>
                            <button
                              onClick={() => handleCancelInvite(inv.token)}
                              disabled={cancellingToken === inv.token || resendingToken === inv.token}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                            >
                              {cancellingToken === inv.token ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            )}
          </div>
          );
        })()}

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-gray-900 border border-orange-500/20 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t("businessDashboard.inviteTeamMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">Email Address</label>
              <input
                type="email"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="coach@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">Role</label>
              <div className="flex flex-wrap gap-2">
                {(ownerData?.pilot ? PILOT_ROLE_OPTIONS : ROLE_OPTIONS).map((r) => (
                  <button
                    key={r.value}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      inviteRole === r.value ? "bg-orange-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                    onClick={() => setInviteRole(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {!ownerData?.pilot && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-blue-100/80">
                  Team members receive one-time 30-day introductory My Perfect Meals access unless they already have valid access.
                </p>
              </div>
            )}
            <button
              className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleInvite}
              disabled={inviteLoading}
            >
              {inviteLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send Invitation</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pro-access gate for client invitations */}
      <FeatureUpgradeModal
        open={clientUpgradeModalOpen}
        onClose={() => setClientUpgradeModalOpen(false)}
        featureName="Invite Client"
        description="Upgrade to Pro to invite clients and grant complimentary access through your organization."
      />

      {/* Invite Client Modal */}
      <Dialog open={clientInviteOpen} onOpenChange={(open) => { setClientInviteOpen(open); if (!open) resetClientForm(); }}>
        <DialogContent className="bg-gray-900 border border-orange-500/20 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{t("businessDashboard.inviteClient")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">Client Email</label>
              <input
                type="email"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="patient@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            {!ownerData?.pilot && (
              <>
                <div>
                  <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    Business Name <span className="text-white/30 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                    placeholder={ownerData?.business?.name || "Your organization name"}
                    value={clientProgramName}
                    onChange={(e) => setClientProgramName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">Trial Length</label>
                  <div className="flex flex-wrap gap-2">
                    {["7", "14", "30"].map((d) => (
                      <button
                        key={d}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${clientTrialOption === d ? "bg-orange-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                        onClick={() => setClientTrialOption(d)}
                      >
                        {d} Days
                      </button>
                    ))}
                  </div>
                </div>
                {/* Invitation Preview */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Invitation Preview</p>
                  <div className="space-y-1.5">
                    {[
                      `${resolvedTrialDays} days complimentary access`,
                      "Uses a secure invitation link",
                      "Must be redeemed using this email",
                      "Does not affect team member invitations",
                      "Complimentary access ends when the trial expires",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        <span className="text-white/70 text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {/* Invitation delivery options */}
            <div className="space-y-2">
              <button
                className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => handleClientInvite("email")}
                disabled={clientInviteLoading}
              >
                {clientInviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Invitation
              </button>
              <button
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => handleClientInvite("link")}
                disabled={clientInviteLoading}
              >
                <Copy className="w-4 h-4" />
                Create &amp; Copy Link
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMemberId && (
        <MemberClientAccountingModal
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}

// ── Inline educational callout ───────────────────────────────────────────────
// Collapsed by default; expands on tap to reveal plain-language explanation.
function InfoCallout({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left active:opacity-70 transition-opacity"
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="w-3.5 h-3.5 text-orange-400/70 flex-shrink-0" />
        <span className="flex-1 text-xs font-medium text-white/50">{title}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-2 border-t border-white/8">
          <div className="text-xs text-white/55 leading-relaxed pt-2.5">{children}</div>
        </div>
      )}
    </div>
  );
}
