import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Download, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import VisualCertificate from "@/components/certification/VisualCertificate";

interface CertData {
  status: string;
  score: number;
  certificateNumber: string;
  certificateName: string | null;
  completedAt: string;
  certificationType: string;
}

export default function CertificationCertificateView() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = `affiliate_${pathId}`;

  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // apiRequest returns parsed JSON — do NOT call .json() on it
    apiRequest(`/api/certifications/${certType}/progress`)
      .then((data: any) => {
        if (data.certification) setCert(data.certification);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      // Must use raw fetch for blob — apiRequest only returns parsed JSON
      const token = localStorage.getItem("mpm_auth_token");
      const res = await fetch(`/api/certifications/${certType}/certificate`, {
        headers: token ? { "x-auth-token": token } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MPM-Certificate-${cert?.certificateNumber ?? "certificate"}.pdf`;
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

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-4"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 16px)" }}
      >
        <button
          onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification/complete`)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
        </button>
        <p className="text-white font-semibold text-sm">Certification Record</p>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pt-6 space-y-6 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
          </div>
        ) : !cert || cert.status !== "completed" ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40 text-sm text-center">
              No completed certification found.
            </p>
          </div>
        ) : (
          <>
            {/* Visual certificate */}
            <motion.div
              className="w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <VisualCertificate
                recipientName={cert.certificateName ?? ""}
                certType={certType}
                certificateNumber={cert.certificateNumber}
                completedAt={cert.completedAt}
              />
            </motion.div>

            {/* Scroll hint on mobile */}
            <p className="text-white/30 text-xs text-center -mt-2 md:hidden">
              Scroll left to view full certificate
            </p>

            {/* Actions */}
            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={handleDownload}
                disabled={downloading || !cert.certificateName}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 print:hidden"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download PDF Certificate
                  </>
                )}
              </button>

              <button
                onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
                className="w-full p-4 rounded-2xl bg-white/10 text-white font-bold text-sm active:scale-[0.98] transition-transform print:hidden"
              >
                Back to Certification Dashboard
              </button>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
