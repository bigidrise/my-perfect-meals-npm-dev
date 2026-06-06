import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Award, CheckCircle2, Copy, Download, ExternalLink, FileText, Link2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

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
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = `affiliate_${pathId}`;

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
      // fall back to business center if magic link fails
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

  // ── Affiliate banner logic ─────────────────────────────────────────────────
  const renderAffiliateBanner = () => {
    if (affiliateChecking) {
      return (
        <div className="flex items-center justify-center gap-2 py-3 text-white/30 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking affiliate status…
        </div>
      );
    }

    if (!affiliate) return null;

    if (affiliate.isActive) {
      return (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
            <span className="text-sm font-bold text-green-400">Affiliate Account Activated!</span>
          </div>
          {affiliate.rewardfulReferralUrl && (
            <>
              <p className="text-xs text-white/50 leading-relaxed">
                Your referral link is ready. Share it to start earning commissions.
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-white/10">
                <Link2 className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                <p className="text-xs font-mono text-orange-300 truncate flex-1">
                  {affiliate.rewardfulReferralUrl}
                </p>
              </div>
            </>
          )}
        </div>
      );
    }

    // Social affiliate — cert is complete (only cert needed), activation is in progress
    if (isSocialTrack) {
      if (activating) {
        return (
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-orange-400 animate-spin flex-shrink-0" />
            <p className="text-xs text-orange-300 leading-relaxed">
              <span className="font-bold">Activating your affiliate account…</span>
            </p>
          </div>
        );
      }
      // Polling exhausted — activation still pending (e.g. Rewardful campaign requires approval)
      return (
        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <p className="text-xs text-orange-300 leading-relaxed text-center">
            <span className="font-bold">Your account is being set up.</span> You'll receive an email
            when your affiliate account is fully activated and your referral link is ready.
          </p>
        </div>
      );
    }

    // Business affiliate — phase 2 still needed
    if (isBusinessTrack) {
      const phase1Done = !!affiliate.phase1CompletedAt;
      const phase2Done = !!affiliate.phase2CompletedAt;
      if (phase1Done && !phase2Done) {
        return (
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-1">
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

  // ── Primary action buttons (track-aware) ────────────────────────────────────
  const renderPrimaryActions = () => {
    if (affiliateChecking || activating) return null;

    if (isSocialTrack && affiliate?.isActive) {
      return (
        <>
          <button
            onClick={handleOpenDashboard}
            disabled={dashboardLoading}
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {dashboardLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4" />
                Open Affiliate Dashboard
              </>
            )}
          </button>

          {affiliate.rewardfulReferralUrl && (
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
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 max-w-2xl mx-auto w-full text-center space-y-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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
              <p className="text-white/60 text-sm">{certPathLabel} Certification</p>
            </motion.div>

            {/* Certificate card */}
            <motion.div
              className="w-full bg-black/40 backdrop-blur-lg border border-orange-500/30 rounded-2xl p-6 space-y-4 text-left"
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
                  <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">
                    Issued To
                  </p>
                  <p className="text-xl font-bold text-white">{cert.certificateName}</p>
                </div>
              )}

              {cert?.certificateNumber && (
                <div className="space-y-1 text-center">
                  <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">
                    Certificate Number
                  </p>
                  <p className="text-base font-bold text-white font-mono">{cert.certificateNumber}</p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                {cert?.score != null && (
                  <div className="space-y-0.5 text-center">
                    <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">Score</p>
                    <p className="text-2xl font-bold text-orange-400">{cert.score}%</p>
                  </div>
                )}
                {completedDate && (
                  <div className="space-y-0.5 text-center">
                    <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">Issued</p>
                    <p className="text-sm font-semibold text-white/70">{completedDate}</p>
                  </div>
                )}
              </div>

              {/* Inline name capture if missing */}
              {!hasName && cert && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <p className="text-xs text-white/50 text-center leading-relaxed">
                    Enter your full name to enable certificate download.
                  </p>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setNameError(""); }}
                    placeholder="First and last name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
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
              {/* Track-aware primary actions (dashboard / copy link) */}
              {renderPrimaryActions()}

              {/* Certificate actions — always shown once name is set */}
              {hasName && (
                <>
                  <button
                    onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification/view`)}
                    className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    style={isSocialTrack && affiliate?.isActive ? { background: "rgba(255,255,255,0.10)" } : {}}
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
                Go to Business Center
              </button>

              <button
                onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
                className="w-full p-3 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <FileText className="h-4 w-4" />
                View Certification Record
              </button>

              <p className="text-xs text-white/30 leading-relaxed px-2 text-center">
                Your certificate is always available for download from this page.
              </p>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
