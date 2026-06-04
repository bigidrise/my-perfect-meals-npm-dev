import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Award, CheckCircle2, Download, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

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

  // Inline name capture (for certs issued without a name)
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    apiRequest(`/api/certifications/${certType}/progress`)
      .then((r) => r.json())
      .then((data) => {
        if (data.certification) {
          setCert(data.certification);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType]);

  const handleSaveName = async () => {
    const name = nameInput.trim();
    if (!name || name.split(" ").length < 2) {
      setNameError("Please enter your first and last name.");
      return;
    }
    setNameError("");
    setNameSaving(true);
    try {
      // Re-complete with name (idempotent — updates name on existing record)
      await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
        body: JSON.stringify({ certificateName: name }),
        headers: { "Content-Type": "application/json" },
      });
      // Reload progress
      const res = await apiRequest(`/api/certifications/${certType}/progress`);
      const data = await res.json();
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
      const res = await apiRequest(`/api/certifications/${certType}/certificate`);
      if (!res.ok) {
        console.error("[Cert] PDF download failed:", res.status);
        return;
      }
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

  const certPathLabel =
    pathId === "coaching" ? "Business & Coaching Affiliate" : "Social & Referral Affiliate";

  const hasName = !!cert?.certificateName;
  const completedDate = cert?.completedAt
    ? new Date(cert.completedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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

            {/* Action buttons */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              {hasName && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating PDF…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download Certificate
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => setLocation("/business-center")}
                className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Go to Business Center
              </button>

              <button
                onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
                className="w-full p-3 rounded-2xl bg-white/5 text-white/50 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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
