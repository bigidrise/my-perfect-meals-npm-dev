import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { getModuleById } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";

export default function CertificationLesson() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string; moduleId: string }>();
  const pathId = params.pathId ?? "social";
  const moduleId = params.moduleId ?? "";
  const certType = `affiliate_${pathId}`;
  const module = getModuleById(moduleId);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current || !moduleId) return;
    viewedRef.current = true;
    apiRequest(`/api/certifications/${certType}/modules/${moduleId}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [certType, moduleId]);

  if (!module) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/50">Module not found.</p>
      </div>
    );
  }

  const isFinal = module.id === "final-assessment";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{module.title}</h1>
            <p className="text-xs text-white/40">~{module.estimatedMinutes} min</p>
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Module header */}
        <div className="flex items-start gap-4 pt-2">
          <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0">
            <BookOpen className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{module.title}</h2>
            <p className="text-sm text-white/60 mt-1">{module.description}</p>
          </div>
        </div>

        {/* Content sections */}
        {module.sections.map((section, i) => (
          <motion.div
            key={i}
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <h3 className="text-sm font-bold text-orange-300">{section.heading}</h3>
            {section.text && (
              <p className="text-sm text-white/80 leading-relaxed">{section.text}</p>
            )}
            {section.list && (
              <ul className="space-y-2">
                {section.list.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-white/75">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Start quiz CTA */}
        <motion.div
          className="space-y-3 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-xs text-white/40 text-center">
            {isFinal
              ? "When you're ready, start the final assessment. You need 80% to pass."
              : "When you're ready, take the short quiz to complete this module. You need 80% to pass."}
          </p>
          <button
            onClick={() =>
              setLocation(`/business-center/affiliate/${pathId}/certification/${moduleId}/quiz`)
            }
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {isFinal ? "Start Final Assessment" : "Start Module Quiz"}
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
