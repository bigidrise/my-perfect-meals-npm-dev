import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { computePartnerLifecycle, LifecycleResult } from "@shared/partnerLifecycle";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Search, User, Check, X, ChevronRight, Plus, Shield,
  Award, DollarSign, Calendar, Activity, Clock, Loader2, CheckCircle
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface PartnerRecord {
  id: number;
  userId: string;
  partnerName: string | null;
  partnerTypes: string[];
  promoCode: string | null;
  customerDiscount: number | null;
  commissionRate: number | null;
  commissionMonths: number | null;
  stripePromotionCodeId: string | null;
  rewardfulAffiliateId: string | null;
  status: string;
  notes: string | null;
  acceptedAt: string | null;
  rewardfulCreatedAt: string | null;
  promoCodeAssignedAt: string | null;
  orgActivatedAt: string | null;
  managedPayoutsAt: string | null;
  marketingKitReadyAt: string | null;
  campaignActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ActivityLogEntry {
  id: number;
  action: string;
  actorId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAPABILITY_LABELS: Record<string, string> = {
  referral: "Referral Program",
  organization: "Organization",
  product: "Product Integration (placeholder)",
  clinical: "Clinical Program (placeholder)",
};

const ACTION_LABELS: Record<string, string> = {
  partner_created: "Partner created",
  agreement_accepted: "Agreement accepted",
  rewardful_connected: "Rewardful connected",
  promo_assigned: "Promo code assigned",
  org_activated: "Organization activated",
  payouts_ready: "Managed Payouts ready",
  campaign_live: "Campaign live",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function userDisplayName(u: UserSearchResult) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || u.email;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartnerManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [partnerRecord, setPartnerRecord] = useState<PartnerRecord | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleResult | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    partnerName: "",
    partnerTypes: [] as string[],
    commissionRate: 40,
    commissionMonths: 60,
    customerDiscount: 10,
    notes: "",
  });

  const [actionInputs, setActionInputs] = useState<Record<string, string>>({});

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = "Partner Management | My Perfect Meals";
  }, []);

  // Admin guard
  useEffect(() => {
    if (user && !user.isAdmin) setLocation("/business-center/partners");
  }, [user, setLocation]);

  if (!user?.isAdmin) return null;

  // ── Search ────────────────────────────────────────────────────────────────

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiRequest(`/api/partner/admin/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults((data as any).users ?? []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  };

  // ── Load partner record ───────────────────────────────────────────────────

  const loadRecord = useCallback(async (userId: string) => {
    setLoadingRecord(true);
    setPartnerRecord(null);
    setLifecycle(null);
    setActivityLog([]);
    setShowCreateForm(false);
    try {
      const data = await apiRequest(`/api/partner/admin/users/${userId}/record`).catch(() => null);
      if (data && (data as any).partner) {
        setPartnerRecord((data as any).partner);
        setLifecycle((data as any).lifecycle ?? null);
        setActivityLog((data as any).log ?? []);
      } else {
        setShowCreateForm(true);
      }
    } finally {
      setLoadingRecord(false);
    }
  }, []);

  const handleSelectUser = (u: UserSearchResult) => {
    setSelectedUser(u);
    setSearchResults([]);
    setSearchQuery("");
    loadRecord(u.id);
  };

  // ── Create partner ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!selectedUser) return;
    if (createForm.partnerTypes.length === 0) {
      toast({ title: "Select at least one capability", variant: "destructive" }); return;
    }
    setActionLoading("create");
    try {
      const data = await apiRequest("/api/partner/admin/create", {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser.id, ...createForm }),
      });
      setPartnerRecord((data as any).partner);
      setLifecycle((data as any).lifecycle ?? null);
      setActivityLog((data as any).log ?? []);
      setShowCreateForm(false);
      toast({ title: "Partner record created" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Failed to create partner", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // ── Lifecycle actions ─────────────────────────────────────────────────────

  const handleAction = async (action: string, extraData?: Record<string, unknown>) => {
    if (!selectedUser) return;
    setActionLoading(action);
    try {
      const data = await apiRequest(`/api/partner/admin/users/${selectedUser.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(extraData ?? {}),
      });
      setPartnerRecord((data as any).partner);
      setLifecycle((data as any).lifecycle ?? null);
      setActivityLog((data as any).log ?? []);
      setActionInputs({});
      toast({ title: "Updated successfully" });
    } catch (e: any) {
      toast({ title: e?.message ?? "Action failed", variant: "destructive" });
    }
    setActionLoading(null);
  };

  // ── Render next-step action UI ────────────────────────────────────────────

  const renderNextStepAction = () => {
    if (!lifecycle?.nextStep) return null;
    const ns = lifecycle.nextStep;

    if (ns.action === "approve") {
      return (
        <ActionCard
          label="Record Agreement Accepted"
          description="Mark that the partner agreement has been signed. This is the first lifecycle step."
          onConfirm={() => handleAction("approve")}
          loading={actionLoading === "approve"}
        />
      );
    }

    if (ns.action === "connect-rewardful") {
      return (
        <ActionCard
          label="Connect Rewardful Account"
          description="Enter the affiliate's Rewardful ID to link their account."
          loading={actionLoading === "connect-rewardful"}
          onConfirm={() => handleAction("connect-rewardful", {
            rewardfulAffiliateId: actionInputs["rewardfulAffiliateId"] ?? "",
          })}
        >
          <input
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30 mb-1"
            placeholder="Rewardful Affiliate ID"
            value={actionInputs["rewardfulAffiliateId"] ?? ""}
            onChange={(e) => setActionInputs((p) => ({ ...p, rewardfulAffiliateId: e.target.value }))}
          />
        </ActionCard>
      );
    }

    if (ns.action === "assign-promo") {
      return (
        <ActionCard
          label="Assign Promo Code"
          description="Set the partner's public referral promo code."
          loading={actionLoading === "assign-promo"}
          onConfirm={() => handleAction("assign-promo", {
            promoCode: actionInputs["promoCode"] ?? "",
            customerDiscount: partnerRecord?.customerDiscount ?? undefined,
          })}
        >
          <input
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30 mb-1 uppercase"
            placeholder="e.g. METROPLEX"
            value={actionInputs["promoCode"] ?? ""}
            onChange={(e) => setActionInputs((p) => ({ ...p, promoCode: e.target.value.toUpperCase() }))}
          />
        </ActionCard>
      );
    }

    if (ns.action === "activate-org") {
      return (
        <ActionCard
          label="Mark Organization Activated"
          description="Confirm that the organization subscription is active and seats are confirmed."
          onConfirm={() => handleAction("activate-org")}
          loading={actionLoading === "activate-org"}
        />
      );
    }

    if (ns.action === "payouts-ready") {
      return (
        <ActionCard
          label="Mark Managed Payouts Ready"
          description="Record that Rewardful Managed Payouts onboarding is complete for this partner."
          onConfirm={() => handleAction("payouts-ready")}
          loading={actionLoading === "payouts-ready"}
        />
      );
    }

    if (ns.action === "go-live") {
      return (
        <ActionCard
          label="Mark Campaign Live"
          description="The partner is actively referring customers. Mark campaign as live."
          onConfirm={() => handleAction("go-live")}
          loading={actionLoading === "go-live"}
        />
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-32 overflow-x-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center/partners")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Partner Programs
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Partner Management</h1>
            <p className="text-xs text-orange-400/80">Admin only</p>
          </div>
          <Shield className="h-4 w-4 text-orange-400" />
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}>

        {/* ── User Search ──────────────────────────────────────────────────── */}
        <SectionCard icon={<Search className="h-4 w-4 text-orange-400" />} title="Find Partner">
          <div className="relative">
            <input
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30 pr-9"
              placeholder="Search by email or name…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {searching ? <Loader2 className="h-4 w-4 text-white/30 animate-spin" /> : <Search className="h-4 w-4 text-white/30" />}
            </div>
          </div>

          {/* Selected user badge */}
          {selectedUser && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600/20 border border-orange-500/30 mt-2">
              <User className="h-4 w-4 text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{userDisplayName(selectedUser)}</p>
                <p className="text-xs text-white/50 truncate">{selectedUser.email}</p>
              </div>
              <button onClick={() => { setSelectedUser(null); setPartnerRecord(null); setLifecycle(null); setShowCreateForm(false); }} className="text-white/40 active:text-white/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Search results dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="mt-1 rounded-xl bg-black/80 border border-white/15 overflow-hidden"
              >
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/10 last:border-0 active:bg-white/5"
                    onClick={() => handleSelectUser(u)}
                  >
                    <User className="h-4 w-4 text-white/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{userDisplayName(u)}</p>
                      <p className="text-xs text-white/40 truncate">{u.email}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </SectionCard>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loadingRecord && (
          <div className="flex items-center justify-center py-10 gap-3 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading partner record…</span>
          </div>
        )}

        {/* ── Create Form ──────────────────────────────────────────────────── */}
        {!loadingRecord && showCreateForm && selectedUser && (
          <SectionCard icon={<Plus className="h-4 w-4 text-orange-400" />} title="Create Partner Record">
            <p className="text-xs text-white/50 mb-4">
              No partner record found for this user. Configure their identity below.
            </p>

            <label className="block mb-3">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wide block mb-1">Partner / Organization Name</span>
              <input
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30"
                placeholder="e.g. Metroplex"
                value={createForm.partnerName}
                onChange={(e) => setCreateForm((p) => ({ ...p, partnerName: e.target.value }))}
              />
            </label>

            <label className="block mb-3">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wide block mb-2">Capabilities</span>
              <div className="flex flex-wrap gap-2">
                {(["referral", "organization", "product", "clinical"] as const).map((cap) => {
                  const isPlaceholder = cap === "product" || cap === "clinical";
                  const selected = createForm.partnerTypes.includes(cap);
                  return (
                    <button
                      key={cap}
                      disabled={isPlaceholder}
                      onClick={() => {
                        if (isPlaceholder) return;
                        setCreateForm((p) => ({
                          ...p,
                          partnerTypes: selected
                            ? p.partnerTypes.filter((t) => t !== cap)
                            : [...p.partnerTypes, cap],
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        isPlaceholder
                          ? "bg-white/5 border-white/10 text-white/25 cursor-not-allowed"
                          : selected
                          ? "bg-orange-600 border-orange-500 text-white"
                          : "bg-white/10 border-white/20 text-white/70"
                      }`}
                    >
                      {selected && !isPlaceholder && <Check className="h-3 w-3 inline mr-1" />}
                      {CAPABILITY_LABELS[cap]}
                    </button>
                  );
                })}
              </div>
            </label>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <label className="block">
                <span className="text-xs text-white/50 block mb-1">Commission %</span>
                <input
                  type="number" min="1" max="100"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400"
                  value={createForm.commissionRate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, commissionRate: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50 block mb-1">Months</span>
                <input
                  type="number" min="1" max="120"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400"
                  value={createForm.commissionMonths}
                  onChange={(e) => setCreateForm((p) => ({ ...p, commissionMonths: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/50 block mb-1">Customer Off %</span>
                <input
                  type="number" min="0" max="100"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400"
                  value={createForm.customerDiscount}
                  onChange={(e) => setCreateForm((p) => ({ ...p, customerDiscount: Number(e.target.value) }))}
                />
              </label>
            </div>

            <label className="block mb-4">
              <span className="text-xs text-white/50 font-medium uppercase tracking-wide block mb-1">Notes (optional)</span>
              <textarea
                rows={2}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-400 placeholder-white/30 resize-none"
                placeholder="Internal notes about this partner…"
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>

            <button
              onClick={handleCreate}
              disabled={actionLoading === "create"}
              className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
            >
              {actionLoading === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Partner
            </button>
          </SectionCard>
        )}

        {/* ── Partner Detail ───────────────────────────────────────────────── */}
        {!loadingRecord && partnerRecord && lifecycle && (
          <>
            {/* Status overview */}
            <SectionCard icon={<Award className="h-4 w-4 text-orange-400" />} title={partnerRecord.partnerName ?? "Partner"}>
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-xs font-bold text-orange-300">
                  {lifecycle.currentStatusLabel}
                </span>
                <span className="text-2xl font-black text-white">{lifecycle.readinessPct}%</span>
              </div>

              {/* Readiness bar */}
              <div className="w-full bg-white/10 rounded-full h-2 mb-1">
                <div
                  className="h-2 rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${lifecycle.readinessPct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 mb-4">
                {lifecycle.completedMilestones.length} of {lifecycle.applicableMilestones.length} milestones complete · equal weighting
              </p>

              {/* Per-capability track progress */}
              <div className="space-y-3">
                {lifecycle.tracks.map((track) => (
                  <div key={track.track}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white/70">{track.label}</span>
                      {track.totalCount > 0 && (
                        <span className="text-xs text-white/40">{track.completedCount}/{track.totalCount}</span>
                      )}
                      {track.totalCount === 0 && (
                        <span className="text-[10px] text-white/25 italic">placeholder</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {track.milestones.length === 0 && (
                        <p className="text-[10px] text-white/25 pl-1">No milestones defined yet</p>
                      )}
                      {track.milestones.map((m) => (
                        <div key={m.milestone.key} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${m.complete ? "bg-green-500/20 border border-green-500/40" : "bg-white/10 border border-white/20"}`}>
                            {m.complete && <Check className="h-2.5 w-2.5 text-green-400" />}
                          </div>
                          <span className={`text-xs ${m.complete ? "text-white" : "text-white/40"}`}>{m.milestone.label}</span>
                          {m.completedAt && (
                            <span className="text-[10px] text-white/30 ml-auto">{formatDate(m.completedAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Next Step Action */}
            {lifecycle.nextStep && (
              <div>
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-2 px-1">Next Step</p>
                {renderNextStepAction()}
              </div>
            )}

            {!lifecycle.nextStep && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">All milestones complete</p>
                  <p className="text-xs text-white/50">This partner's lifecycle is fully configured.</p>
                </div>
              </div>
            )}

            {/* Commission terms */}
            <SectionCard icon={<DollarSign className="h-4 w-4 text-orange-400" />} title="Commission Terms">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Commission", value: partnerRecord.commissionRate != null ? `${partnerRecord.commissionRate}%` : "—" },
                  { label: "Term", value: partnerRecord.commissionMonths === 60 ? "5 yr" : partnerRecord.commissionMonths ? `${partnerRecord.commissionMonths} mo` : "—" },
                  { label: "Customer Off", value: partnerRecord.customerDiscount != null ? `${partnerRecord.customerDiscount}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] text-gray-400 mb-1">{s.label}</p>
                    <p className="text-lg font-black text-white">{s.value}</p>
                  </div>
                ))}
              </div>
              {partnerRecord.promoCode && (
                <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-600/10 border border-orange-500/20">
                  <span className="text-xs text-white/50">Promo Code</span>
                  <span className="text-sm font-black text-orange-400 tracking-widest">{partnerRecord.promoCode}</span>
                </div>
              )}
              {partnerRecord.rewardfulAffiliateId && (
                <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-xs text-white/50">Rewardful ID</span>
                  <span className="text-xs font-mono text-white/70">{partnerRecord.rewardfulAffiliateId}</span>
                </div>
              )}
            </SectionCard>

            {/* Activity log */}
            {activityLog.length > 0 && (
              <SectionCard icon={<Activity className="h-4 w-4 text-orange-400" />} title="Activity Log">
                <div className="space-y-0">
                  {activityLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-white/10 last:border-0">
                      <Clock className="h-3.5 w-3.5 text-white/30 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {Object.entries(entry.details)
                              .filter(([, v]) => v != null)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-white/30 flex-shrink-0">{formatDate(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}

        {/* Empty state */}
        {!selectedUser && !loadingRecord && (
          <div className="text-center py-16 text-white/30">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Search for a user to view or create their partner record.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ActionCard({
  label, description, children, onConfirm, loading,
}: {
  label: string;
  description: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-orange-600/10 border border-orange-500/30 p-4">
      <p className="text-sm font-bold text-white mb-1">{label}</p>
      <p className="text-xs text-white/50 mb-3 leading-relaxed">{description}</p>
      {children}
      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all mt-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {label}
      </button>
    </div>
  );
}
