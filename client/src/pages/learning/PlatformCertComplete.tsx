import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Award, Download, ArrowLeft, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

interface AffiliateAccount {
  isActive: boolean;
  rewardfulReferralUrl: string | null;
  rewardfulReferralToken: string | null;
  affiliateTrack: string;
}

interface CertData {
  status: string;
  certificateNumber: string;
  certificateName: string | null;
  completedAt: string;
  score: number;
}

const CERT_LABELS: Record<string, string> = {
  platform: "Platform Certification",
  business_success: "Business Success Certification",
};

function certBadge(score: number | null | undefined) {
  if (score == null) return null;
  if (score >= 95) return { label: "Master Professional", icon: "🥇", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  if (score >= 90) return { label: "Advanced Professional", icon: "🥈", color: "text-slate-200 border-slate-400/40 bg-slate-400/10" };
  return { label: "Certified Professional", icon: "🥉", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" };
}

export default function PlatformCertComplete() {
  const [, setLocation] = useLocation();
  const params = useParams<{ certType: string }>();
  const certType = params.certType ?? "platform";
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateAccount | null>(null);
  const [affiliateChecking, setAffiliateChecking] = useState(true);

  useEffect(() => {
    apiRequest(`/api/certifications/${certType}/progress?_t=${Date.now()}`)
      .then((d: { certification: CertData | null }) => {
        setCert(d.certification);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType]);

  useEffect(() => {
    apiRequest("/api/affiliate/account")
      .then((data: any) => {
        if (data.account) setAffiliate(data.account);
      })
      .catch(() => {})
      .finally(() => setAffiliateChecking(false));
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/certifications/${certType}/certificate`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MPM-Certificate-${cert?.certificateNumber ?? "cert"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Certificate download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} flex items-center justify-center`}>
        <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => setLocation(`/certifications/${certType}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-base font-bold text-white">{CERT_LABELS[certType] ?? "Certification"}</h1>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}>
        <motion.div className="flex flex-col items-center gap-4 py-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="h-24 w-24 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center">
            <Award className="h-12 w-12 text-orange-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">Certified!</h2>
            <p className="text-sm text-orange-400 font-semibold">{CERT_LABELS[certType] ?? "Certification"}</p>
            {cert && (() => {
              const badge = certBadge(cert.score);
              return badge ? (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${badge.color}`}>
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
                </div>
              ) : null;
            })()}
          </div>
        </motion.div>

        {cert && (
          <motion.div className="p-5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {cert.certificateName && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Certificate Issued To</p>
                <p className="text-lg font-bold text-white mt-1">{cert.certificateName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Certificate ID</p>
                <p className="text-sm font-mono text-orange-400 mt-1">{cert.certificateNumber}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Completed</p>
                <p className="text-sm text-white mt-1">{new Date(cert.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
            {cert.score != null && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Final Score</p>
                <p className="text-sm text-green-400 font-semibold mt-1">{cert.score}%</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Affiliate activation banner */}
        {!affiliateChecking && affiliate?.isActive && (
          <motion.div
            className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 space-y-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] text-white font-bold">✓</span>
              </div>
              <span className="text-sm font-bold text-green-400">Affiliate Account Activated!</span>
            </div>
            {affiliate.rewardfulReferralUrl && (
              <>
                <p className="text-xs text-white/50 leading-relaxed">Both certifications complete. Your referral link is live.</p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-white/10">
                  <Link2 className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                  <p className="text-xs font-mono text-orange-300 truncate">{affiliate.rewardfulReferralUrl}</p>
                </div>
                <button
                  onClick={() => setLocation("/business-center/affiliate/coaching")}
                  className="w-full mt-1 p-3 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 font-semibold text-sm active:scale-[0.98] transition-transform"
                >
                  Open Affiliate Dashboard
                </button>
              </>
            )}
          </motion.div>
        )}

        {!affiliateChecking && affiliate && !affiliate.isActive && (
          <motion.div
            className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <p className="text-xs text-orange-300 leading-relaxed text-center">
              <span className="font-bold">Affiliate pending —</span> complete your Affiliate Certification too to unlock your referral link.
            </p>
          </motion.div>
        )}

        <motion.button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Downloading…" : "Download Certificate (PDF)"}
        </motion.button>

        {certType === "platform" && (
          <motion.div
            className="p-5 rounded-2xl bg-orange-900/20 border border-orange-500/30 text-center space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <p className="text-sm font-bold text-white">
              Congratulations! You've Mastered Phase 1 — Platform Fundamentals.
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              Now let's learn how to build and grow your professional business using ProCare.
            </p>
            <button
              onClick={() => setLocation("/procare-training")}
              className="w-full p-4 rounded-xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Begin Phase 2 — Business & ProCare Success
              <span className="text-base">→</span>
            </button>
          </motion.div>
        )}

        <motion.button
          onClick={() => setLocation("/learning")}
          className="w-full p-4 rounded-2xl bg-white/10 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Back to Learning Hub
        </motion.button>
      </div>
    </motion.div>
  );
}
