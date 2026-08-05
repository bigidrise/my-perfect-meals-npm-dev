import { useState, useEffect, useRef } from "react";
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
  Settings,
  BookOpen,
  ChevronRight,
  Shield,
  FileText,
  DollarSign,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { FeatureUpgradeModal } from "@/components/modals/FeatureUpgradeModal";

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "trainer", label: "Trainer" },
  { value: "physician", label: "Physician" },
  { value: "staff", label: "Staff" },
];

const POLICY_OPTIONS = [
  {
    value: "org_only",
    label: "Organization Clients Only",
    description: "Members may not take personal clients outside this organization.",
  },
  {
    value: "allowed_with_disclosure",
    label: "Personal Clients Allowed — With Disclosure",
    description: "Members may have personal clients but must disclose the relationship to you.",
  },
  {
    value: "allowed",
    label: "Personal Clients Allowed",
    description: "Members may freely maintain personal clients without restriction.",
  },
];

interface BusinessData {
  business: {
    id: string;
    name: string;
    seatLimit: number;
    status: string;
    plan: string;
    independentClientPolicy?: string;
  };
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
  usedSeats: number;
  availableSeats: number;
  planLostCount?: number;
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
}

interface MembershipData {
  membership: {
    role: string;
    businessName: string;
    seatLimit: number;
    joinedAt: string;
    independentClientPolicy?: string;
  };
}

const DEFAULT_BUSINESS_NAME = "My Business Team";

export default function BusinessDashboard() {
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
  const [viewMode, setViewMode] = useState<"owner" | "member" | "none" | null>(null);
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(fromCheckout);

  // Setup screen state
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupRole, setSetupRole] = useState("coach");
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
  const [clientTrialOption, setClientTrialOption] = useState("30");
  const [clientCustomDays, setClientCustomDays] = useState("30");
  const [clientInviteLoading, setClientInviteLoading] = useState(false);

  const resolvedTrialDays = clientTrialOption === "custom"
    ? (parseInt(clientCustomDays) || 30)
    : parseInt(clientTrialOption);

  const resetClientForm = () => {
    setClientEmail("");
    setClientProgramName("");
    setClientTrialOption("30");
    setClientCustomDays("30");
  };

  // Actions
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [resendingToken, setResendingToken] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Manage seats modal
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [managedSeats, setManagedSeats] = useState(4);
  const [managingSeats, setManagingSeats] = useState(false);

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
        toast({ title: "Could not save policy", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Policy saved", description: `Organization policy updated successfully.` });
    } catch {
      setOrgPolicies(orgPolicies);
      toast({ title: "Error", description: "Could not save policy.", variant: "destructive" });
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
        toast({ title: "Could not save policy", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Policy updated", description: "Your client ownership policy has been saved." });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Could not save policy.", variant: "destructive" });
    } finally {
      setSavingPolicy(false);
    }
  };

  const fetchData = async (): Promise<boolean> => {
    try {
      // Try owner first
      const ownerRes = await fetch("/api/business/mine", {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (ownerRes.ok) {
        const json = await ownerRes.json();
        setOwnerData(json);
        setViewMode("owner");
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
      toast({ title: "Name too short", description: "Enter at least 2 characters.", variant: "destructive" });
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
      toast({ title: "Error", description: "Could not save. Please try again.", variant: "destructive" });
    } finally {
      setSavingSetup(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/business/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Invite failed", description: json.error, variant: "destructive" });
        return;
      }
      toast({ title: "Invitation sent!", description: `${inviteEmail} will receive an email with a link to join.` });
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

  const handleClientInvite = async (deliveryMethod: "email" | "link" | "mailto") => {
    if (!clientEmail.includes("@")) {
      toast({ title: "Valid email required", variant: "destructive" });
      return;
    }
    setClientInviteLoading(true);
    try {
      const res = await fetch("/api/business/invite", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: clientEmail,
          invitationType: "client",
          trialDays: resolvedTrialDays,
          programName: clientProgramName.trim() || null,
          sendEmail: deliveryMethod === "email",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Invite failed", description: json.error, variant: "destructive" });
        return;
      }
      const link: string = json.inviteLink;
      const programLabel = clientProgramName.trim() || "My Perfect Meals Complimentary Access";

      if (deliveryMethod === "email") {
        toast({ title: "Invitation sent!", description: `${clientEmail} will receive an email.` });
      } else if (deliveryMethod === "link") {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link copied!", description: "Share this link with your client." });
      } else {
        // Open Email: generate the same message the MPM email would send
        const subject = encodeURIComponent(`You're invited to ${programLabel}`);
        const body = encodeURIComponent(
          `Hi,\n\n` +
          `I'd like to invite you to ${programLabel} — ${resolvedTrialDays} days of complimentary access to My Perfect Meals.\n\n` +
          `Click the link below to activate your access:\n${link}\n\n` +
          `This invitation is reserved for ${clientEmail}. You'll create a free account to get started.\n`
        );
        window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`, "_blank");
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

  const handleManageSeats = async () => {
    setManagingSeats(true);
    try {
      const res = await fetch("/api/business/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ seats: managedSeats }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not update seats", description: data.error || "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: `Seats updated to ${managedSeats}`, description: "Your Stripe subscription has been adjusted." });
      setSeatModalOpen(false);
      fetchData();
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setManagingSeats(false);
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
            <h2 className="text-white text-lg font-bold mb-1">Setting up your business account…</h2>
            <p className="text-white/50 text-sm">Confirming payment and creating your team. This takes just a moment.</p>
          </>
        ) : (
          <p className="text-white/50 text-sm">Loading…</p>
        )}
      </div>
    );
  }

  // ── No business found (and not polling) ────────────────────────────────────
  if (viewMode === "none" || viewMode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/80 via-orange-900/60 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <Building2 className="w-14 h-14 text-orange-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">No Business Account Found</h2>
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
                <h1 className="text-white font-bold text-base leading-tight">My Business Team</h1>
                <p className="text-white/50 text-xs">Organization Member</p>
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
              <span className="text-green-300 text-sm font-medium">Organization Access Active</span>
            </div>
          </div>

          {/* Membership details */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Role</span>
              <Badge className="bg-orange-600/80 text-white border-0 text-xs">{roleLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Access</span>
              <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Organization Access
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Joined</span>
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
              <span className="text-white font-semibold">My Perfect Meals Academy</span>. The Academy walks you through the entire platform — meal builders, dietary protocols, clinical nutrition tools, client management, marketing, and how to get the most out of every feature for the people you coach.
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
              <h3 className="text-white font-bold text-base">Organization Policies</h3>
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
              <h3 className="text-white font-bold text-base">Client Ownership</h3>
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
            Seat management and billing are controlled by your team owner. Contact them with any questions.
          </p>
        </div>
      </div>
    );
  }

  // ── Owner view ──────────────────────────────────────────────────────────────
  if (!ownerData) return null;
  const { business, members, invitations, usedSeats, availableSeats } = ownerData;

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
              Your organization has been set up. Complete your subscription to activate team invites and seat management.
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              Once billing is confirmed, you can invite team members and manage your organization.
            </p>
          </div>
          <button
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
            onClick={() => setLocation("/pricing")}
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

  const seatsFull = availableSeats <= 0;

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
              Your {business.seatLimit}-seat team account is active. Let's get set up.
            </p>
          </div>

          <Card className="bg-white/5 border border-orange-500/20 text-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-orange-300 text-sm font-semibold">
              <CheckCircle className="w-4 h-4" />
              1 of {business.seatLimit} seats used (you)
            </div>

            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Business or Team Name
              </label>
              <input
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="e.g. Metroflex Performance Nutrition"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveSetup()}
                autoFocus
              />
            </div>

            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Your Role
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      setupRole === r.value
                        ? "bg-orange-600 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                    onClick={() => setSetupRole(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
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
              <p className="text-white/50 text-xs">Manage team members, seats &amp; invitations</p>
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
                    label: "Invite your first team member",
                    action: () => setInviteOpen(true),
                  },
                  {
                    done: false,
                    label: "Complete My Perfect Meals Academy",
                    link: "/business-center/academy",
                  },
                ].map(({ done, label, action, link }) => (
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
                    ) : link ? (
                      <button
                        onClick={() => setLocation(link)}
                        className="text-sm flex-1 text-left text-white/80 underline decoration-white/20"
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
                  I'm all set — show my dashboard
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
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
                  <span className="font-semibold text-sm">{business.name}</span>
                </div>
                <button
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                  onClick={() => { setNameInput(business.name); setEditingName(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Seat Counter */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-400" />
              <span className="font-semibold text-sm">Team Seats</span>
            </div>
            <span className={`text-lg font-bold ${seatsFull ? "text-red-400" : "text-orange-300"}`}>
              {usedSeats} / {business.seatLimit}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all ${seatsFull ? "bg-red-500" : "bg-orange-500"}`}
              style={{ width: `${Math.min((usedSeats / business.seatLimit) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            {seatsFull ? (
              <p className="text-red-400 text-xs">All seats are in use. Remove a member or add more seats.</p>
            ) : (
              <p className="text-white/50 text-xs">{availableSeats} seat{availableSeats !== 1 ? "s" : ""} available</p>
            )}
            <button
              className="text-orange-400 text-xs font-semibold flex items-center gap-1 active:opacity-60 transition-opacity"
              onClick={() => { setManagedSeats(business.seatLimit); setSeatModalOpen(true); }}
            >
              <Settings className="w-3 h-3" />
              Manage
            </button>
          </div>
        </Card>

        {/* Invite Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => setInviteOpen(true)}
            disabled={seatsFull || business.status !== "active"}
          >
            <UserPlus className="w-4 h-4" />
            {seatsFull ? "No Seats" : "Invite Team Member"}
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
            Invite Client
          </button>
        </div>

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

        {/* Organization Policies */}
        <Card className="bg-white/5 border border-orange-500/20 text-white p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="font-semibold text-sm">Organization Policies</span>
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
                These seats are occupied but the members no longer have a paid plan. Remove them to reclaim the seats.
              </p>
            </div>
          </div>
        )}

        {/* Active Members */}
        <div>
          <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
            Active Members ({members.length})
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
                    {m.role !== "owner" && (
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
              Pending Invitations ({invitations.length})
            </h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <Card key={inv.id} className="bg-white/5 border border-white/10 text-white p-3 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{inv.email}</p>
                      <p className="text-white/40 text-xs">
                        {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
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
        {(ownerData.clientInvitations?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
              Client Invitations ({ownerData.clientInvitations!.length})
            </h2>
            <div className="space-y-2">
              {ownerData.clientInvitations!.map((inv) => {
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
          </div>
        )}

      {/* Manage Seats Modal */}
      <Dialog open={seatModalOpen} onOpenChange={setSeatModalOpen}>
        <DialogContent className="bg-gray-900 border border-orange-500/20 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Manage Seats</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <p className="text-white/60 text-sm mb-4">
                Adjust your team size. Stripe will prorate the change immediately.
                You currently have <span className="text-white font-semibold">{ownerData?.usedSeats ?? 0}</span> active member{(ownerData?.usedSeats ?? 0) !== 1 ? "s" : ""} using seats.
              </p>
              <div className="flex items-center justify-between bg-white/5 border border-white/15 rounded-xl px-4 py-4">
                <button
                  onClick={() => setManagedSeats((s) => Math.max(ownerData?.usedSeats ?? 1, s - 1))}
                  className="w-10 h-10 rounded-full bg-white/10 text-white font-bold text-xl flex items-center justify-center active:bg-white/20 select-none"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-3xl font-bold text-white">{managedSeats}</span>
                  <p className="text-white/50 text-xs mt-1">seat{managedSeats !== 1 ? "s" : ""} · ${(44.99 * managedSeats).toFixed(2)}/mo</p>
                </div>
                <button
                  onClick={() => setManagedSeats((s) => Math.min(250, s + 1))}
                  className="w-10 h-10 rounded-full bg-white/10 text-white font-bold text-xl flex items-center justify-center active:bg-white/20 select-none"
                >
                  +
                </button>
              </div>
              {managedSeats >= 11 && managedSeats <= 50 && (
                <p className="text-amber-400/80 text-xs mt-2">For 11–50 seats, reach out to us for smooth team onboarding.</p>
              )}
              {managedSeats > 50 && (
                <p className="text-amber-400/80 text-xs mt-2">For 50+ seats, contact us for enterprise pricing.</p>
              )}
            </div>
            <button
              className="w-full py-3 rounded-lg bg-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:bg-orange-700"
              onClick={handleManageSeats}
              disabled={managingSeats || managedSeats === (ownerData?.business?.seatLimit ?? 0)}
            >
              {managingSeats ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
              ) : (
                managedSeats === (ownerData?.business?.seatLimit ?? 0)
                  ? "No change"
                  : `Update to ${managedSeats} seat${managedSeats !== 1 ? "s" : ""} — $${(44.99 * managedSeats).toFixed(2)}/mo`
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-gray-900 border border-orange-500/20 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Invite Team Member</DialogTitle>
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
                {ROLE_OPTIONS.map((r) => (
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
            <DialogTitle className="text-white">Invite Client</DialogTitle>
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
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Program Name <span className="text-white/30 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="My Perfect Meals Complimentary Access"
                value={clientProgramName}
                onChange={(e) => setClientProgramName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">Trial Length</label>
              <div className="flex flex-wrap gap-2">
                {["7", "14", "30", "60", "90"].map((d) => (
                  <button
                    key={d}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${clientTrialOption === d ? "bg-orange-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                    onClick={() => setClientTrialOption(d)}
                  >
                    {d} Days
                  </button>
                ))}
                <button
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${clientTrialOption === "custom" ? "bg-orange-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                  onClick={() => setClientTrialOption("custom")}
                >
                  Custom
                </button>
              </div>
              {clientTrialOption === "custom" && (
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="mt-2 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400"
                  placeholder="Days (1–365)"
                  value={clientCustomDays}
                  onChange={(e) => setClientCustomDays(e.target.value)}
                />
              )}
            </div>
            {/* Invitation Preview */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Invitation Preview</p>
              <div className="space-y-1.5">
                {[
                  `${resolvedTrialDays} days complimentary access`,
                  "Uses a secure invitation link",
                  "Must be redeemed using this email",
                  "No team seat consumed",
                  "Converts to Free plan when trial expires",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-white/70 text-xs">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Three delivery options */}
            <div className="space-y-2">
              <button
                className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => handleClientInvite("mailto")}
                disabled={clientInviteLoading}
              >
                <ExternalLink className="w-4 h-4" />
                Open Email
              </button>
              <button
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => handleClientInvite("email")}
                disabled={clientInviteLoading}
              >
                {clientInviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send from My Perfect Meals
              </button>
              <button
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => handleClientInvite("link")}
                disabled={clientInviteLoading}
              >
                <Copy className="w-4 h-4" />
                Copy Link
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
