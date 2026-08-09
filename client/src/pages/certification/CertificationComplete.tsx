import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Award, CheckCircle2, ChevronRight, Copy, Download, ExternalLink, FileText, Link2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface AffiliateAccount {
  isActive: boolean;
  rewardfulReferralUrl: string | null;
  rewardfulReferralToken: string | null;
  affiliateTrack: string;
  requiredPhases: string | null;
  phase1CompletedAt: string | null;
  phase2CompletedAt: string | null;
  activatedAt: string | null;
}

interface CertData {
  status: string;
  score: number;
  certificateNumber: string;
  certificateName: string | null;
  completedAt: string;
}

export default function CertificationComplete() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = `affiliate_${pathId}`;

  // Practitioner roles require professional certification beyond the affiliate track.
  // business role and no role = affiliate-only path.
  const isPractitioner =
    !!user?.professionalRole &&
    user.professionalRole !== "business";

  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateAccount | null>(null);
  const [affiliateChecking, setAffiliateChecking] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);
  const MAX_POLLS = 5;

  const fetchAffiliateStatus = async (): Promise<AffiliateAccount | null> => {
    try {
      const data: any = await apiRequest("/api/affiliate/account");
      return data.account ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    apiRequest(`/api/certifications/${certType}/progress`)
      .then((data: any) => {
        if (data.certification) setCert(data.certification);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType]);

  useEffect(() => {
    const isSocialTrack = pathId === "social";

    fetchAffiliateStatus().then((account) => {
      setAffiliate(account);
      setAffiliateChecking(false);

      if (isSocialTrack && account && !account.isActive) {
        setActivating(true);
        pollRef.current = setInterval(async () => {
          pollCount.current += 1;
          const refreshed = await fetchAffiliateStatus();
          if (refreshed?.isActive) {
            setAffiliate(refreshed);
            setActivating(false);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (pollCount.current >= MAX_POLLS) {
            if (refreshed) setAffiliate(refreshed);
            setActivating(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 1800);
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pathId]);

  const handleSaveName = async () => {
    const name = nameInput.trim();
    if (!name || name.split(" ").length < 2) {
      setNameError("Please enter your first and last name.");
      return;
    }
    setNameError("");
    setNameSaving(true);
    try {
      await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
        body: JSON.stringify({ certificateName: name }),
        headers: { "Content-Type": "application/json" },
      });
      const data: any = await apiRequest(`/api/certifications/${certType}/progress`);
      if (data.certification) setCert(data.certification);
    } catch {
      setNameError("Failed to save. Please try again.");
    } finally {
      setNameSaving(false);
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("mpm_auth_token");
      const res = await fetch(`/api/certifications/${certType}/certificate`, {
        headers: token ? { "x-auth-token": token } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const certNum = cert?.certificateNumber ?? "certificate";
      a.download = `MPM-Certificate-${certNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[Cert] download error:", e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (!affiliate?.rewardfulReferralUrl) return;
    navigator.clipboard.writeText(affiliate.rewardfulReferralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleOpenDashboard = async () => {
    if (dashboardLoading) return;
    setDashboardLoading(true);
    try {
      const data: any = await apiRequest("/api/affiliate/dashboard-link");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setLocation("/business-center");
    } finally {
      setDashboardLoading(false);
    }
  };

  const isSocialTrack = pathId === "social";
  const isBusinessTrack = pathId === "coaching";
  const certPathLabel =
    isBusinessTrack ? "Business & Coaching Affiliate" : "Social & Referral Affiliate";

  const hasName = !!cert?.certificateName;
  const completedDate = cert?.completedAt
    ? new Date(cert.completedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const renderAffiliateBanner = () => {
    if (affiliateChecking) {
      return (
        <div className="flex items-center justify-center gap-2 py-3 text-gray-400 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking affiliate status…
        </div>
      );
    }

    if (!affiliate) return null;

    if (affiliate.isActive) {
      return (
        <div className="p-4 rounded-2xl bg-green-900/30 border border-green-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            <span className="text-sm font-bold text-green-400">
              Your Founding Affiliate account has been created.
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {isPractitioner
              ? "Your affiliate account is active. Continue to professional training to unlock Studio."
              : "Your referral link is ready. Head to your Affiliate Dashboard to share it and start earning commissions."}
          </p>
          {affiliate.rewardfulReferralUrl && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Link2 className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
              <p className="text-xs font-mono text-orange-400 truncate flex-1">
                {affiliate.rewardfulReferralUrl}
              </p>
            </div>
          )}
          {!affiliate.rewardfulReferralUrl && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Check your email — Rewardful will send you an invitation to confirm your payout account.
            </p>
          )}
        </div>
      );
    }

    if (isSocialTrack) {
      if (activating) {
        return (
          <div className="p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-orange-400 animate-spin flex-shrink-0" />
            <p className="text-xs text-orange-300 leading-relaxed">
              <span className="font-bold">Creating your Founding Affiliate account…</span>
            </p>
          </div>
        );
      }
      return (
        <div className="p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30">
          <p className="text-xs text-orange-300 leading-relaxed text-center">
            <span className="font-bold">Your affiliate account is being set up.</span> You'll receive
            an email from Rewardful to confirm your payout account. Your referral link will be ready
            shortly.
          </p>
        </div>
      );
    }

    if (isBusinessTrack) {
      const phase1Done = !!affiliate.phase1CompletedAt;
      const phase2Done = !!affiliate.phase2CompletedAt;
      if (phase1Done && !phase2Done) {
        return (
          <div className="p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30 space-y-1">
            <p className="text-xs text-orange-300 leading-relaxed text-center">
              <span className="font-bold">Phase 1 complete!</span> Complete your Platform
              Certification to activate your Business Affiliate account.
            </p>
          </div>
        );
      }
    }

    return null;
  };

  const renderPrimaryActions = () => {
    if (affiliateChecking || activating) return null;

    if (isBusinessTrack) {
      return (
        <button
          onClick={() => setLocation("/pro-launchpad")}
          className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <ChevronRight className="h-5 w-5" />
          Continue to Phase 2
        </button>
      );
    }

    if (isSocialTrack) {
      if (activating) return null;

      // Practitioner: affiliate certified, now continue to professional training
      if (isPractitioner) {
        return (
          <>
            <button
              onClick={() => setLocation("/procare-training")}
              className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ChevronRight className="h-5 w-5" />
              Continue Professional Training
            </button>
            <button
              onClick={() => setLocation("/business-center/affiliate/dashboard")}
              className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ExternalLink className="h-4 w-4" />
              View My Affiliate Dashboard
            </button>
          </>
        );
      }

      // Affiliate-only: go straight to dashboard
      return (
        <>
          <button
            onClick={() => setLocation("/business-center/affiliate/dashboard")}
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <ExternalLink className="h-4 w-4" />
            View My Affiliate Dashboard
          </button>

          {affiliate?.rewardfulReferralUrl && (
            <button
              onClick={handleCopyLink}
              className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Link Copied!" : "Copy Referral Link"}
            </button>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-28 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Back button */}
      <div
        className="sticky top-0 z-10 bg-black/55 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center max-w-2xl mx-auto">
          <button
            onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl mx-auto w-full text-center space-y-6"
        style={{ paddingTop: "1rem" }}
      >
        {loading ? (
          <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
        ) : (
          <>
            {/* Trophy */}
            <motion.div
              className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            >
              <Award className="h-12 w-12 text-orange-400" />
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl font-bold text-white">Certification Complete</h1>
              <p className="text-gray-400 text-sm">{certPathLabel} Certification</p>
            </motion.div>

            {/* Certificate card */}
            <motion.div
              className="w-full bg-white/5 border border-orange-500/30 rounded-2xl p-6 space-y-4 text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span className="text-sm font-semibold text-green-400">Certified</span>
              </div>

              {cert?.certificateName && (
                <div className="space-y-1 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                    Issued To
                  </p>
                  <p className="text-xl font-bold text-white">{cert.certificateName}</p>
                </div>
              )}

              {cert?.certificateNumber && (
                <div className="space-y-1 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                    Certificate Number
                  </p>
                  <p className="text-base font-bold text-white font-mono">{cert.certificateNumber}</p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                {cert?.score != null && (
                  <div className="space-y-0.5 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Score</p>
                    <p className="text-2xl font-bold text-orange-400">{cert.score}%</p>
                  </div>
                )}
                {completedDate && (
                  <div className="space-y-0.5 text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Issued</p>
                    <p className="text-sm font-semibold text-gray-300">{completedDate}</p>
                  </div>
                )}
              </div>

              {/* Inline name capture if missing */}
              {!hasName && cert && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    Enter your full name to enable certificate download.
                  </p>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setNameError(""); }}
                    placeholder="First and last name"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-400"
                  />
                  {nameError && <p className="text-xs text-red-400">{nameError}</p>}
                  <button
                    onClick={handleSaveName}
                    disabled={!nameInput.trim() || nameSaving}
                    className="w-full p-3 rounded-xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
                  >
                    {nameSaving ? "Saving…" : "Save Name"}
                  </button>
                </div>
              )}
            </motion.div>

            {/* What You've Learned — Phase 1 summary */}
            <motion.div
              className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-left"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest text-center">
                Phase 1 Complete — You Now Understand
              </p>
              <div className="space-y-2">
                {[
                  "What My Perfect Meals is and how it works",
                  "How the platform personalizes nutrition",
                  "How to represent the brand professionally",
                  "How to help clients succeed",
                  "The affiliate program and earning structure",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-300 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Affiliate activation banner */}
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {renderAffiliateBanner()}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              {renderPrimaryActions()}

              {hasName && (
                <>
                  <button
                    onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification/view`)}
                    className="w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    style={
                      isSocialTrack && affiliate?.isActive
                        ? { backgroundColor: "rgba(255,255,255,0.1)", color: "white" }
                        : { backgroundColor: "rgb(234,88,12)", color: "white" }
                    }
                  >
                    <FileText className="h-4 w-4" />
                    View Certificate
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {downloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Generating PDF…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download PDF
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={() => setLocation("/business-center")}
                className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Go to Business Suite
              </button>

              <button
                onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
                className="w-full p-3 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <FileText className="h-4 w-4" />
                View Certification Record
              </button>

              <p className="text-xs text-gray-400 leading-relaxed px-2 text-center">
                Your certificate is always available for download from this page.
              </p>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
