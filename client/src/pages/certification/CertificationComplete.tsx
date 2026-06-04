import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Award, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

export default function CertificationComplete() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = `affiliate_${pathId}`;

  const [certNumber, setCertNumber] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/api/certifications/${certType}/progress`)
      .then((r) => r.json())
      .then((data) => {
        if (data.certification) {
          setCertNumber(data.certification.certificateNumber);
          setScore(data.certification.score);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType]);

  const certPathLabel =
    pathId === "coaching" ? "Business & Coaching Affiliate" : "Social & Referral Affiliate";

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
            {/* Trophy animation */}
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
              className="w-full bg-black/40 backdrop-blur-lg border border-orange-500/30 rounded-2xl p-6 space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span className="text-sm font-semibold text-green-400">Certified</span>
              </div>

              {certNumber && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">
                    Certificate Number
                  </p>
                  <p className="text-lg font-bold text-white font-mono">{certNumber}</p>
                </div>
              )}

              {score != null && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">
                    Final Score
                  </p>
                  <p className="text-2xl font-bold text-orange-400">{score}%</p>
                </div>
              )}
            </motion.div>

            <motion.div
              className="w-full space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <p className="text-xs text-white/40 leading-relaxed px-2">
                Your Affiliate Dashboard and marketing resources are now available in the Business Center.
              </p>

              <button
                onClick={() => setLocation("/business-center")}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Go to Business Center
              </button>
              <button
                onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
                className="w-full p-3 rounded-2xl bg-white/10 text-white/70 text-sm active:scale-[0.98] transition-transform"
              >
                View Certification Record
              </button>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
