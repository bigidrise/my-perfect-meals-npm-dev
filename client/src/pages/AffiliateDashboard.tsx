import React, { useState, useEffect, useCallback } from "react";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, ExternalLink, Award, BarChart2,
  DollarSign, Link2, Shield, Package, Users, X, Send,
  UserPlus, Clock, RefreshCw, QrCode, Download, ChevronDown, ChevronUp,
  Smartphone, Mail, Youtube, Instagram, Presentation, Megaphone, AlertTriangle, Monitor, Calendar,
  CheckCircle, MapPin
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { computePartnerLifecycle, LifecycleResult } from "@shared/partnerLifecycle";
import { useAuth } from "@/contexts/AuthContext";
import { isProOrAbove } from "@/lib/subscriptionCheck";
import { ProActionLock } from "@/components/ProActionLock";

interface AffiliateAccount {
  affiliateTrack: string;
  requiredPhases: string;
  phase1CompletedAt: string | null;
  phase2CompletedAt: string | null;
  rewardfulState: string;
  rewardfulReferralUrl: string | null;
  rewardfulReferralToken: string | null;
  rewardfulCampaignId: string | null;
  activatedAt: string | null;
  isActive: boolean;
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
  acceptedAt: string | null;
  rewardfulCreatedAt: string | null;
  promoCodeAssignedAt: string | null;
  orgActivatedAt: string | null;
  managedPayoutsAt: string | null;
  marketingKitReadyAt: string | null;
  campaignActiveAt: string | null;
}

interface RewardfulStatus {
  emailConfirmed: boolean;
  signedIn: boolean;
  state: string;
  portalUrl: string;
}

function Card({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={`p-5 rounded-2xl bg-white/5 border border-white/10 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-3">{children}</p>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AffiliateDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/business-center");
    }
  }, [setLocation]);
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const hasPro = isProOrAbove(user);
  const [copiedDesktopUrl, setCopiedDesktopUrl] = useState(false);
  const [account, setAccount] = useState<AffiliateAccount | null>(null);
  const [rewardfulStatus, setRewardfulStatus] = useState<RewardfulStatus | null>(null);
  const [partnerRecord, setPartnerRecord] = useState<PartnerRecord | null>(null);
  const [partnerLifecycle, setPartnerLifecycle] = useState<LifecycleResult | null>(null);
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    document.title = "Partner & Revenue Center | My Perfect Meals";
    Promise.all([
      apiRequest("/api/affiliate/dashboard").catch(() => null),
      apiRequest("/api/partner/identity").catch(() => null),
    ]).then(([affiliateData, partnerData]) => {
      if (affiliateData) setAccount(affiliateData as AffiliateAccount);
      if (partnerData && (partnerData as any).partner) {
        const rec = (partnerData as any).partner as PartnerRecord;
        setPartnerRecord(rec);
        // Use server-computed lifecycle or derive locally if missing
        if ((partnerData as any).lifecycle) {
          setPartnerLifecycle((partnerData as any).lifecycle as LifecycleResult);
        } else {
          setPartnerLifecycle(computePartnerLifecycle({
            partnerTypes: rec.partnerTypes ?? [],
            acceptedAt: rec.acceptedAt,
            rewardfulCreatedAt: rec.rewardfulCreatedAt,
            rewardfulAffiliateId: rec.rewardfulAffiliateId,
            promoCode: rec.promoCode,
            promoCodeAssignedAt: rec.promoCodeAssignedAt,
            orgActivatedAt: rec.orgActivatedAt,
            managedPayoutsAt: rec.managedPayoutsAt,
            campaignActiveAt: rec.campaignActiveAt,
          }));
        }
      }
      if (affiliateData) {
        apiRequest("/api/affiliate/rewardful-status")
          .then((s) => setRewardfulStatus(s as RewardfulStatus))
          .catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  const copyLink = useCallback(() => {
    if (!account?.rewardfulReferralUrl) return;
    navigator.clipboard.writeText(account.rewardfulReferralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [account]);

  const downloadQR = useCallback(() => {
    if (!account?.rewardfulReferralUrl) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(account.rewardfulReferralUrl)}`;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `mpm-referral-qr-${account.rewardfulReferralToken ?? "code"}.png`;
    a.click();
  }, [account]);

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const data = await apiRequest("/api/affiliate/dashboard-link") as { url?: string };
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setTimeout(() => {
          apiRequest("/api/affiliate/rewardful-status")
            .then((s) => setRewardfulStatus(s as RewardfulStatus))
            .catch(() => {});
        }, 3000);
      } else {
        toast({ title: "Unavailable", description: "Could not generate portal link.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to open portal. Try again.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }, [toast]);

  const syncLink = useCallback(async () => {
    setSyncLoading(true);
    try {
      const data = await apiRequest("/api/affiliate/sync-link", { method: "POST" }) as { referralUrl?: string; referralToken?: string };
      if (data.referralUrl) {
        setAccount((prev) => prev ? { ...prev, rewardfulReferralUrl: data.referralUrl!, rewardfulReferralToken: data.referralToken ?? null } : prev);
        toast({ title: "Link Synced!", description: "Your referral link has been updated." });
      } else {
        toast({ title: "Not Available Yet", description: "Rewardful hasn't generated your link yet. Check back in a few minutes.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Sync Failed", description: "Could not fetch your referral link. Try again shortly.", variant: "destructive" });
    } finally {
      setSyncLoading(false);
    }
  }, [toast]);

  const copyDesktopUrl = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedDesktopUrl(true);
      setTimeout(() => setCopiedDesktopUrl(false), 2500);
    });
  }, []);

  const sendInvite = useCallback(async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({ title: "Required", description: "Enter both name and email.", variant: "destructive" });
      return;
    }
    setInviteSending(true);
    try {
      await apiRequest("/api/affiliate/invite", {
        method: "POST",
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Invitation Sent!", description: `We sent ${inviteName} a personal invite with your referral link.` });
      setInviteName("");
      setInviteEmail("");
      setShowInvite(false);
    } catch {
      toast({ title: "Send Failed", description: "Could not send invitation. Try again.", variant: "destructive" });
    } finally {
      setInviteSending(false);
    }
  }, [inviteName, inviteEmail, toast]);

  const trackLabel = account?.affiliateTrack === "business_affiliate"
    ? "Business & Coaching Affiliate"
    : "Social & Referral Affiliate";

  // Derive program identity from the Rewardful campaign that was assigned at activation.
  // Founding affiliates are enrolled in the founding campaign (stored as rewardfulCampaignId).
  // Future strategic campaigns will resolve to a different label here without touching existing records.
  const programLabel = account?.rewardfulCampaignId
    ? "Founding Affiliate Program"
    : null;

  const needsRewardfulSetup = rewardfulStatus && (!rewardfulStatus.emailConfirmed || !rewardfulStatus.signedIn);

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) return null;

  // Operational page — all actions require Pro subscription
  if (!hasPro) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} flex flex-col`}>
        <div
          className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-base font-bold text-white">Partner & Revenue Center</h1>
          </div>
        </div>
        <div
          className="px-4 max-w-2xl mx-auto w-full"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
        >
          <ProActionLock feature="your Partner & Revenue Center">
            <div className="space-y-4">
              <div className="h-32 rounded-2xl bg-white/5 border border-white/10" />
              <div className="h-48 rounded-2xl bg-white/5 border border-white/10" />
              <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
            </div>
          </ProActionLock>
        </div>
      </div>
    );
  }

  const qrSrc = account.rewardfulReferralUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=16&color=000000&bgcolor=ffffff&data=${encodeURIComponent(account.rewardfulReferralUrl)}`
    : null;

  return (
    <>
      <motion.div
        className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-32 overflow-x-hidden`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div
          className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white">Partner & Revenue Center</h1>
              <p className="text-xs text-white/40 truncate">{partnerRecord?.partnerName ?? trackLabel}</p>
            </div>
            {hasPro && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold active:scale-[0.95] transition-transform"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </button>
            )}
          </div>
        </div>

        <div
          className="px-4 max-w-2xl mx-auto space-y-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
        >

          {isDesktop && (
            <button
              onClick={() => setLocation("/business-dashboard")}
              className="flex items-center gap-1.5 text-orange-400 text-sm font-medium mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Organization Dashboard
            </button>
          )}

          {/* ── REWARDFUL ACCOUNT SETUP CARD ── */}
          {needsRewardfulSetup && (
            <motion.div
              className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Add your payout account</p>
                  <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                    One step left before you can receive commissions. Click the button below — My Perfect Meals logs you in automatically. No email confirmation or verification code needed.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                <div className="flex items-start gap-3 p-3 rounded-xl border bg-white/5 border-white/10">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black bg-white/10 text-gray-400 border border-white/10">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Add your bank account inside Rewardful</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Go to Payout Settings in your Rewardful portal to connect your bank account or PayPal.
                    </p>
                  </div>
                </div>
              </div>

              {isDesktop ? (
                <>
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {portalLoading
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <ExternalLink className="h-4 w-4" />
                    }
                    {portalLoading ? "Opening..." : "Open Rewardful Portal →"}
                  </button>
                  <p className="text-[10px] text-gray-500 text-center mt-2">
                    My Perfect Meals signs you in directly — no password or verification code required.
                  </p>
                </>
              ) : (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Monitor className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">Complete this on your desktop</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Rewardful setup requires filling out paperwork — it's designed for a full browser. Copy this page link and open it on your computer to continue.
                      </p>
                      <button
                        onClick={copyDesktopUrl}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                      >
                        {copiedDesktopUrl
                          ? <Check className="h-3.5 w-3.5 text-green-400" />
                          : <Copy className="h-3.5 w-3.5" />
                        }
                        {copiedDesktopUrl ? "Link Copied!" : "Copy Page Link"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Partner Identity Card */}
          {partnerRecord && (
            <Card delay={0.02}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Award className="h-4 w-4 text-orange-400" />
                </div>
                <CardLabel>Partner Information</CardLabel>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {partnerRecord.customerDiscount != null && (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] text-gray-400 mb-1">Customer Off</p>
                    <p className="text-xl font-black text-green-400">{partnerRecord.customerDiscount}%</p>
                  </div>
                )}
                {partnerRecord.commissionRate != null && (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] text-gray-400 mb-1">Commission</p>
                    <p className="text-xl font-black text-orange-400">{partnerRecord.commissionRate}%</p>
                  </div>
                )}
                {partnerRecord.commissionMonths != null && (
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-[9px] text-gray-400 mb-1">Term</p>
                    <p className="text-xl font-black text-white">{partnerRecord.commissionMonths === 60 ? "5 yr" : `${partnerRecord.commissionMonths} mo`}</p>
                  </div>
                )}
              </div>
              {partnerRecord.partnerTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {partnerRecord.partnerTypes.map((type) => (
                    <span key={type} className="px-2.5 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-[10px] font-bold text-orange-300 uppercase tracking-wide">
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Card 1 — Account Status */}
          <Card delay={0.04}>
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${account.isActive ? "bg-green-500/20 border border-green-500/30" : "bg-orange-500/20 border border-orange-500/30"}`}>
                <Shield className={`h-5 w-5 ${account.isActive ? "text-green-400" : "text-orange-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <CardLabel>Account Status</CardLabel>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{trackLabel}</span>
                  {programLabel && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-400 uppercase tracking-wide">
                      {programLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {account.isActive ? (
                    <>
                      <span className="px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-xs font-bold text-green-400">
                        ● Active
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-gray-400">
                        Since {formatDate(account.activatedAt)}
                      </span>
                      {account.phase1CompletedAt && (
                        <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-gray-400">
                          Certified {formatDate(account.phase1CompletedAt)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-xs font-bold text-orange-400">
                        ◌ Activation Pending
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-gray-400">
                        Certified — link generating
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 — Share My Perfect Meals */}
          <Card delay={0.07}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Link2 className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Share My Perfect Meals</CardLabel>
            </div>

            {account.rewardfulReferralUrl ? (
              <>
                {/* Referral Link row */}
                <div className="mb-3">
                  <p className="text-[10px] text-gray-400 mb-1.5">Referral Link</p>
                  <div className="rounded-xl bg-white/10 border border-white/10 p-3 mb-2">
                    <p className="font-mono text-xs text-gray-300 break-all leading-relaxed">
                      {account.rewardfulReferralUrl}
                    </p>
                    {account.rewardfulReferralToken && (
                      <p className="text-[10px] text-gray-500 mt-1.5">
                        Your token: <span className="text-orange-400 font-bold">{account.rewardfulReferralToken}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={copyLink}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.97]"
                    style={{ backgroundColor: copied ? "rgba(34,197,94,0.15)" : "rgb(234,88,12)", color: copied ? "rgb(74,222,128)" : "white", border: copied ? "1px solid rgba(34,197,94,0.3)" : "none" }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>

                {/* Promo Code row — only when assigned */}
                {partnerRecord?.promoCode && (
                  <div className="mb-3 pt-3 border-t border-white/10">
                    <p className="text-[10px] text-gray-400 mb-1.5">Promo Code</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-orange-400 tracking-widest">{partnerRecord.promoCode}</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(partnerRecord!.promoCode!).then(() => {
                            setCopiedPromo(true);
                            setTimeout(() => setCopiedPromo(false), 2000);
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
                      >
                        {copiedPromo ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedPromo ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {/* QR Code toggle */}
                <div className={`${partnerRecord?.promoCode ? "" : "mt-0"} pt-3 border-t border-white/10`}>
                  <p className="text-[10px] text-gray-400 mb-1.5">QR Code</p>
                  <button
                    onClick={() => setShowQR((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm active:scale-[0.97] transition-all"
                  >
                    <QrCode className="h-4 w-4" />
                    {showQR ? "Hide QR" : "Show QR Code"}
                  </button>
                </div>

                {/* QR Code Panel */}
                <AnimatePresence>
                  {showQR && qrSrc && (
                    <motion.div
                      className="mt-4 flex flex-col items-center gap-3"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="rounded-2xl bg-white p-3 inline-block shadow-xl border border-white/10">
                        <img
                          src={qrSrc}
                          alt="Referral QR Code"
                          className="w-48 h-48 block"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 text-center">
                        Anyone who scans this goes to your referral link.
                        <br />Use on flyers, business cards, presentations, or in-person.
                      </p>
                      <button
                        onClick={downloadQR}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-sm active:scale-[0.97] transition-all"
                      >
                        <Download className="h-4 w-4" />
                        Download QR Code
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-orange-500/20 border border-orange-500/30 p-4 text-center">
                  <Clock className="h-5 w-5 text-orange-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white mb-1">Your referral link is being generated</p>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    Rewardful creates your personalized link after account setup. This usually takes a few minutes.
                  </p>
                </div>
                <button
                  onClick={syncLink}
                  disabled={syncLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-sm active:scale-[0.97] transition-all disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${syncLoading ? "animate-spin" : ""}`} />
                  {syncLoading ? "Checking..." : "Check for Link"}
                </button>
              </div>
            )}
          </Card>

          {/* Card 3 — How to Use Your Link */}
          <Card delay={0.10}>
            <button
              className="w-full flex items-center gap-3 text-left"
              onClick={() => setShowHowTo((v) => !v)}
            >
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Megaphone className="h-4 w-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <CardLabel>How to Use Your Link</CardLabel>
              </div>
              {showHowTo
                ? <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
              }
            </button>

            <AnimatePresence>
              {showHowTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      When someone clicks your link, they land on the normal MyPerfectMeals website. They have no idea they came from you — it looks totally natural. Rewardful tracks them silently. If they subscribe, you earn 30% for up to 24 months.
                    </p>

                    <div className="space-y-2">
                      {[
                        {
                          icon: Instagram,
                          label: "Instagram & social bio",
                          detail: "Put your link in your Instagram bio, TikTok bio, Facebook page, or LinkedIn About section. One placement, permanent traffic.",
                        },
                        {
                          icon: Youtube,
                          label: "YouTube & podcast descriptions",
                          detail: "Add it to every video description or episode show notes. Say: \"Start your free trial at [your link].\" Every video works for you forever.",
                        },
                        {
                          icon: Mail,
                          label: "Email and text messages",
                          detail: "Drop it into your email signature, newsletter, or a personal text to someone you know could benefit. Personal referrals convert highest.",
                        },
                        {
                          icon: QrCode,
                          label: "QR code for physical use",
                          detail: "Print the QR code on business cards, gym flyers, rack cards, or clinic handouts. Great for in-person conversations, events, and waiting rooms.",
                        },
                        {
                          icon: Presentation,
                          label: "Presentations and live demos",
                          detail: "If you speak, teach, or do webinars, put the QR code on your final slide. While you're talking, people can scan and sign up right then.",
                        },
                        {
                          icon: Smartphone,
                          label: "Link in bio tools (Linktree, etc.)",
                          detail: "If you use a link-in-bio page, add your referral link as one of the buttons. Label it: \"My Meal Planning Tool\" or \"Nutrition App I Recommend.\"",
                        },
                      ].map(({ icon: Icon, label, detail }) => (
                        <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                          <div className="h-7 w-7 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white">{label}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl bg-orange-500/20 border border-orange-500/30 p-3 mt-2">
                      <p className="text-[11px] text-orange-300 leading-relaxed font-medium">
                        💡 What counts as a conversion: Someone clicks your link, signs up for MPM, and starts a paid subscription. You earn 30% of their subscription payments for up to 24 months — automatically tracked and paid through Rewardful.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Card 4 — Certifications */}
          <Card delay={0.13}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Award className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Certifications</CardLabel>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-900/30 border border-green-500/30">
                <div>
                  <p className="text-xs font-semibold text-white">Phase 1 — Business Success Cert</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Completed {formatDate(account.phase1CompletedAt)}</p>
                </div>
                <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Done
                </span>
              </div>

              {account.affiliateTrack === "business_affiliate" && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${account.phase2CompletedAt ? "bg-green-900/30 border-green-500/30" : "bg-white/5 border-white/10"}`}>
                  <div>
                    <p className="text-xs font-semibold text-white">Phase 2 — ProCare Certification</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {account.phase2CompletedAt ? `Completed ${formatDate(account.phase2CompletedAt)}` : "Platform certification"}
                    </p>
                  </div>
                  {account.phase2CompletedAt ? (
                    <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  ) : (
                    <button
                      onClick={() => setLocation("/learning")}
                      className="text-xs font-bold text-orange-400 px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 active:scale-[0.97] transition-transform"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Card 5 — Commission Terms */}
          <Card delay={0.16}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Commission Terms</CardLabel>
            </div>
            <div className="space-y-0">
              {[
                {
                  label: "Commission rate",
                  value: partnerRecord?.commissionRate != null
                    ? `${partnerRecord.commissionRate}% on qualifying payments`
                    : "30% on qualifying payments",
                },
                {
                  label: "Commission window",
                  value: partnerRecord?.commissionMonths != null
                    ? partnerRecord.commissionMonths === 60
                      ? "5-year term per customer"
                      : `First ${partnerRecord.commissionMonths} months per customer`
                    : "First 24 months per customer",
                },
                {
                  label: "Customer discount",
                  value: partnerRecord?.promoCode
                    ? `${partnerRecord.customerDiscount ?? 0}% off — code ${partnerRecord.promoCode}`
                    : "N/A",
                },
                { label: "Paid on", value: "Active subscriptions only" },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 border-b border-white/10 last:border-0">
                  <span className="text-xs text-gray-400">{row.label}</span>
                  <span className="text-xs font-semibold text-orange-400 text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Partner Timeline Card */}
          {partnerRecord && (
            <Card delay={0.175}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-orange-400" />
                </div>
                <CardLabel>Partner Timeline</CardLabel>
              </div>
              <div className="space-y-0">
                {[
                  { label: "Agreement Accepted", value: partnerRecord.acceptedAt },
                  { label: "Rewardful Account", value: partnerRecord.rewardfulCreatedAt },
                  { label: "Promo Code Assigned", value: partnerRecord.promoCodeAssignedAt },
                  { label: "Org Access Activated", value: partnerRecord.orgActivatedAt },
                  { label: "Managed Payouts", value: partnerRecord.managedPayoutsAt },
                  { label: "Marketing Kit Ready", value: partnerRecord.marketingKitReadyAt },
                  { label: "Campaign Live", value: partnerRecord.campaignActiveAt },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 border-b border-white/10 last:border-0">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <span className={`text-xs font-semibold text-right ${row.value ? "text-green-400" : "text-white/25"}`}>
                      {row.value ? formatDate(row.value) : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Partner Playbook Card */}
          {partnerRecord && partnerLifecycle && (
            <Card delay={0.185}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-orange-400" />
                  </div>
                  <CardLabel>Partner Playbook</CardLabel>
                </div>
              </div>

              {/* Per-track progress bars */}
              <div className="space-y-2.5 mb-3">
                {partnerLifecycle.tracks
                  .filter((t) => t.totalCount > 0)
                  .map((track) => {
                    const pct = Math.round((track.completedCount / track.totalCount) * 100);
                    const full = pct === 100;
                    return (
                      <div key={track.track}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                            {track.label}
                          </span>
                          <span className={`text-xs font-black ${full ? "text-green-400" : "text-white/50"}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-700 ${full ? "bg-green-500" : pct > 0 ? "bg-orange-500" : "bg-white/15"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Overall summary */}
              <div className="flex items-center justify-between pt-2.5 border-t border-white/8 mb-4">
                <span className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">Overall</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-white/10 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-orange-500/60 transition-all duration-700"
                      style={{ width: `${partnerLifecycle.readinessPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/35 font-semibold tabular-nums">
                    {partnerLifecycle.completedMilestones.length}/{partnerLifecycle.applicableMilestones.length}
                  </span>
                </div>
              </div>

              {/* Per-track progress */}
              <div className="space-y-4">
                {partnerLifecycle.tracks.map((track) => (
                  <div key={track.track}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">{track.label}</p>
                      {track.totalCount > 0 && (
                        <span className="text-[10px] text-white/35">{track.completedCount}/{track.totalCount}</span>
                      )}
                      {track.totalCount === 0 && (
                        <span className="text-[10px] text-white/20 italic">coming soon</span>
                      )}
                    </div>
                    {track.milestones.length === 0 && (
                      <p className="text-[10px] text-white/20 pl-1">No milestones defined yet</p>
                    )}
                    <div className="space-y-1.5">
                      {track.milestones.map((m) => (
                        <div key={m.milestone.key} className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border ${
                            m.complete
                              ? "bg-green-500/20 border-green-500/40"
                              : "bg-white/8 border-white/20"
                          }`}>
                            {m.complete && <Check className="h-2.5 w-2.5 text-green-400" />}
                          </div>
                          <span className={`text-xs flex-1 ${m.complete ? "text-white" : "text-white/40"}`}>
                            {m.milestone.label}
                          </span>
                          {m.complete && m.completedAt && (
                            <span className="text-[10px] text-white/25">{formatDate(m.completedAt)}</span>
                          )}
                          {!m.complete && m.milestone.key === partnerLifecycle.nextStep?.key && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 font-semibold">
                              Next
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {partnerLifecycle.readinessPct === 100 && (
                <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-white">All milestones complete — you're fully live.</p>
                </div>
              )}
            </Card>
          )}

          {/* Card 6 — Affiliate Performance */}
          <Card delay={0.19}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Affiliate Performance</CardLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Referrals", value: "0", sublabel: "total signups" },
                { label: "Active Subscribers", value: "0", sublabel: "currently active" },
                { label: "Estimated Commissions", value: "$0.00", sublabel: "pending" },
                { label: "Last Activity", value: "N/A", sublabel: "no activity yet" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-gray-400 mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-white">{stat.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{stat.sublabel}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-3 text-center leading-relaxed">
              Live analytics available in your Rewardful portal below
            </p>
          </Card>

          {/* Card 7 — Open Rewardful Portal */}
          <Card delay={0.22}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Affiliate Portal</CardLabel>
            </div>

            {rewardfulStatus?.signedIn ? (
              /* ── COMPLETE STATE: they've already visited the portal ── */
              <>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-900/20 border border-green-500/20 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-400">Payout portal accessed</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      Your portal is set up. Open it anytime to check commissions, update payment info, or view payout history.
                    </p>
                  </div>
                </div>
                {isDesktop ? (
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {portalLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {portalLoading ? "Opening..." : "Open Rewardful Portal"}
                  </button>
                ) : (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Monitor className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Open on your desktop</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">The Rewardful portal works best on a full desktop browser.</p>
                        <button onClick={copyDesktopUrl} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold active:scale-[0.98] transition-all">
                          {copiedDesktopUrl ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedDesktopUrl ? "Link Copied!" : "Copy Page Link"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── SETUP STATE: first-timer, teach before they click ── */
              <>
                <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                  Your Rewardful account has already been created through your My Perfect Meals account. There are only two things you need to do to start earning commissions.
                </p>

                <div className="space-y-3 mb-4">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="h-6 w-6 rounded-full bg-orange-500/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-orange-300">1</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Set up your payouts</p>
                      <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                        When Rewardful opens, click the <span className="font-semibold text-white">Payout Information</span> tab and add your bank account or PayPal. That's where your commissions get deposited.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="h-6 w-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-gray-400">2</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Create a Rewardful password{" "}
                        <span className="text-gray-400 font-normal">(optional)</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        If you ever need to update your account info inside Rewardful, click <span className="text-white font-semibold">Forgot Password</span> on the Rewardful login page to create one. Since you signed in through My Perfect Meals, a password isn't created automatically. You only need to do this once.
                      </p>
                    </div>
                  </div>
                </div>

                {isDesktop ? (
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {portalLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {portalLoading ? "Opening..." : "Open Rewardful Portal (Set Up Payouts)"}
                  </button>
                ) : (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Monitor className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Complete this on your desktop</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          Rewardful payout setup is designed for a full browser. Copy this page link and open it on your computer to continue.
                        </p>
                        <button onClick={copyDesktopUrl} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-white text-xs font-semibold active:scale-[0.98] transition-all">
                          {copiedDesktopUrl ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedDesktopUrl ? "Link Copied!" : "Copy Page Link"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-gray-500 text-center mt-2.5 leading-relaxed">
                  My Perfect Meals signs you in automatically — no password or verification code required.
                </p>
              </>
            )}
          </Card>

          {/* Card 8 — Marketing Resources */}
          <Card delay={0.25}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Marketing Resources</CardLabel>
            </div>
            <div className="space-y-2">
              {[
                { title: "Brand Guidelines", desc: "Approved messaging, imagery, and compliance rules" },
                { title: "Monthly Marketing Packets", desc: "Pre-built social content, captions, and graphics" },
                { title: "Email Templates", desc: "Done-for-you outreach templates for your audience" },
              ].map((res) => (
                <div key={res.title} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-xs font-semibold text-white">{res.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{res.desc}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-medium flex-shrink-0">
                    Coming Soon
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Invite Someone Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowInvite(false); }}
          >
            <motion.div
              className="w-full max-w-sm bg-[#111] border border-orange-500/30 rounded-3xl overflow-hidden"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-500/20 border border-orange-500/30">
                    <Users className="h-4 w-4 text-orange-400" />
                  </div>
                  <h2 className="text-base font-bold text-white">Invite Someone</h2>
                </div>
                <button
                  onClick={() => setShowInvite(false)}
                  className="p-1.5 rounded-xl bg-black/40 text-white/60 active:scale-[0.95] transition-transform"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="px-5 text-xs text-white/50 leading-relaxed mb-4">
                We'll send them a personal invitation with your referral link.
              </p>

              <div className="px-5 space-y-3 pb-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Their Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Their Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <button
                  onClick={sendInvite}
                  disabled={inviteSending || !inviteName.trim() || !inviteEmail.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                >
                  {inviteSending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {inviteSending ? "Sending..." : "Send Invitation"}
                </button>

                <button
                  onClick={() => setShowInvite(false)}
                  className="w-full py-2.5 text-white/40 font-medium text-sm active:scale-[0.97] transition-transform"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
