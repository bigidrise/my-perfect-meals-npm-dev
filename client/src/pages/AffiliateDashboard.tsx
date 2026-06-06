import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Copy, Check, ExternalLink, Award, BarChart2,
  DollarSign, Link2, Shield, Package, Users, X, Send, ChevronRight,
  UserPlus, Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AffiliateAccount {
  affiliateTrack: string;
  requiredPhases: string;
  phase1CompletedAt: string | null;
  phase2CompletedAt: string | null;
  rewardfulState: string;
  rewardfulReferralUrl: string | null;
  rewardfulReferralToken: string | null;
  activatedAt: string | null;
  isActive: boolean;
}

function Card({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={`p-5 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 ${className}`}
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
  const [account, setAccount] = useState<AffiliateAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/api/affiliate/account") as { account: AffiliateAccount | null };
        if (!data.account?.isActive) {
          setLocation("/business-center/affiliate");
          return;
        }
        setAccount(data.account);
      } catch {
        setLocation("/business-center/affiliate");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyLink = useCallback(() => {
    if (!account?.rewardfulReferralUrl) return;
    navigator.clipboard.writeText(account.rewardfulReferralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    });
  }, [account, toast]);

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const data = await apiRequest("/api/affiliate/dashboard-link") as { url?: string };
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "Unavailable", description: "Could not generate portal link.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to open portal. Try again.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }, [toast]);

  const sendInvite = useCallback(async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({ title: "Required", description: "Enter both name and email.", variant: "destructive" });
      return;
    }
    setInviteSending(true);
    try {
      await apiRequest("/api/affiliate/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
      });
      toast({ title: "Invitation Sent!", description: `${inviteName.trim()} will receive your referral link.` });
      setInviteName("");
      setInviteEmail("");
      setShowInvite(false);
    } catch {
      toast({ title: "Error", description: "Failed to send invitation. Try again.", variant: "destructive" });
    } finally {
      setInviteSending(false);
    }
  }, [inviteName, inviteEmail, toast]);

  const trackLabel = account?.affiliateTrack === "business_affiliate"
    ? "Business & Coaching Affiliate"
    : "Social & Referral Affiliate";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) return null;

  return (
    <>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/business-center")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white">Affiliate Dashboard</h1>
              <p className="text-xs text-white/40 truncate">{trackLabel}</p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold active:scale-[0.95] transition-transform"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite Someone
            </button>
          </div>
        </div>

        <div
          className="px-4 max-w-2xl mx-auto space-y-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
        >
          {/* Card 1 — Account Status */}
          <Card delay={0.04}>
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <CardLabel>Account Status</CardLabel>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-white">{trackLabel}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-xs font-bold text-green-400">
                    ● Active
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                    Since {formatDate(account.activatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2 — Referral Link */}
          <Card delay={0.07}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Link2 className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Your Referral Link</CardLabel>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-3 mb-3">
              <p className="font-mono text-xs text-white/80 break-all leading-relaxed">
                {account.rewardfulReferralUrl ?? "Link not available"}
              </p>
              {account.rewardfulReferralToken && (
                <p className="text-[10px] text-white/30 mt-1.5">
                  Token: <span className="text-orange-400 font-bold">{account.rewardfulReferralToken}</span>
                </p>
              )}
            </div>
            <button
              onClick={copyLink}
              disabled={!account.rewardfulReferralUrl}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ backgroundColor: copied ? "rgb(34,197,94,0.15)" : "rgb(234,88,12)", color: copied ? "rgb(134,239,172)" : "white", border: copied ? "1px solid rgb(34,197,94,0.3)" : "none" }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </Card>

          {/* Card 3 — Certifications */}
          <Card delay={0.10}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Award className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Certifications</CardLabel>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div>
                  <p className="text-xs font-semibold text-white">Phase 1 — Business Success Cert</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Completed {formatDate(account.phase1CompletedAt)}</p>
                </div>
                <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Done
                </span>
              </div>

              {account.affiliateTrack === "business_affiliate" && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${account.phase2CompletedAt ? "bg-green-500/10 border-green-500/20" : "bg-white/5 border-white/10"}`}>
                  <div>
                    <p className="text-xs font-semibold text-white">Phase 2 — ProCare Certification</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
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
                      className="text-xs font-bold text-orange-400 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 active:scale-[0.97] transition-transform"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Card 4 — Commission Terms */}
          <Card delay={0.13}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Commission Terms</CardLabel>
            </div>
            <div className="space-y-0">
              {[
                { label: "Commission rate", value: "30% on qualifying payments" },
                { label: "Commission window", value: "First 24 months per customer" },
                { label: "Customer cap", value: "None" },
                { label: "Paid on", value: "Active subscriptions only" },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
                  <span className="text-xs text-white/40">{row.label}</span>
                  <span className="text-xs font-semibold text-orange-300 text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Card 5 — Affiliate Performance */}
          <Card delay={0.16}>
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
                <div key={stat.label} className="p-3 rounded-xl bg-black/30 border border-white/5">
                  <p className="text-[10px] text-white/40 mb-1">{stat.label}</p>
                  <p className="text-xl font-black text-white">{stat.value}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{stat.sublabel}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-3 text-center leading-relaxed">
              Live analytics available in your Rewardful portal below
            </p>
          </Card>

          {/* Card 6 — Open Rewardful Portal */}
          <Card delay={0.19}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="h-4 w-4 text-orange-400" />
              </div>
              <CardLabel>Affiliate Portal</CardLabel>
            </div>
            <p className="text-xs text-white/50 mb-4 leading-relaxed">
              Your Rewardful portal has real-time referral tracking, payout history, commission reports, and account management.
            </p>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {portalLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {portalLoading ? "Opening..." : "Open Rewardful Portal"}
            </button>
          </Card>

          {/* Card 7 — Marketing Resources */}
          <Card delay={0.22}>
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
                    <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{res.desc}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-medium flex-shrink-0">
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
                  className="p-1.5 rounded-xl bg-white/5 text-white/50 active:scale-[0.95] transition-transform"
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
