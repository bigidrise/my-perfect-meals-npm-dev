import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Award, ArrowLeft, CheckCircle2, Download } from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { apiRequest } from "@/lib/queryClient";

interface CertData {
  certificateNumber: string | null;
  certificateName: string | null;
  completedAt: string | null;
  isCertificationTrack: boolean;
}

export default function PlatformMasteryComplete() {
  const [, setLocation] = useLocation();
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiRequest("/api/academy/platform-mastery/status")
      .then((d: any) => {
        setCert({
          certificateNumber: d.certificateNumber ?? null,
          certificateName: d.certificateName ?? null,
          completedAt: d.completedAt ?? null,
          isCertificationTrack: d.isCertificationTrack ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("mpm_auth_token");
      const res = await fetch("/api/academy/platform-mastery/certificate/pdf", {
        headers: token ? { "x-auth-token": token } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Not available");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MPM-PlatformMastery-${cert?.certificateNumber ?? "certificate"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // PDF download not yet available — task #144
    } finally {
      setDownloading(false);
    }
  };

  const completedDate = cert?.completedAt
    ? new Date(cert.completedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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
      {/* Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/academy/platform-mastery")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-base font-bold text-white">Platform Mastery Certificate</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Trophy */}
        <motion.div
          className="flex flex-col items-center gap-4 py-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="h-24 w-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
            <Award className="h-12 w-12 text-emerald-400" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-white">Certified!</h2>
            <p className="text-sm text-emerald-400 font-semibold">Platform Mastery</p>
          </div>
        </motion.div>

        {/* Certificate card */}
        {cert?.certificateNumber && (
          <motion.div
            className="p-5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Certificate Issued</span>
            </div>

            {cert.certificateName && (
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                  Issued To
                </p>
                <p className="text-xl font-bold text-white">{cert.certificateName}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                  Certificate ID
                </p>
                <p className="text-sm font-mono text-orange-400">{cert.certificateNumber}</p>
              </div>
              {completedDate && (
                <div className="text-center">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">
                    Issued
                  </p>
                  <p className="text-sm text-white">{completedDate}</p>
                </div>
              )}
            </div>

            {cert.isCertificationTrack && (
              <div className="pt-2 border-t border-white/10 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold text-orange-400 border-orange-500/40 bg-orange-500/10">
                  Certification Mode Graduate
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Download PDF button */}
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
          {downloading ? "Generating…" : "Download Certificate (PDF)"}
        </motion.button>

        {/* Back to Academy */}
        <motion.button
          onClick={() => setLocation("/academy")}
          className="w-full p-4 rounded-2xl bg-white/10 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          Back to Academy
        </motion.button>
      </div>
    </motion.div>
  );
}
