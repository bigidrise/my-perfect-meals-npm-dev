import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Briefcase, Crown, Loader2, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { getAuthHeaders } from "@/lib/auth";

interface WorkspaceChooserProps {
  onChoose: (choice: "personal" | "workspace") => void;
}

export function WorkspaceChooser({ onChoose }: WorkspaceChooserProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(false);
  const { t } = useTranslation();
  const { t: td } = useTranslation("desktopNav");
  const [organizationWorkspaces, setOrganizationWorkspaces] = useState<Array<{
    authorizationId: string | null;
    businessId: string | null;
    organizationName: string;
    action: "setup" | "open";
  }>>([]);
  const [organizationError, setOrganizationError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business/workspaces", {
      headers: getAuthHeaders(),
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return { workspaces: [] };
        return response.json();
      })
      .then((body) => setOrganizationWorkspaces(Array.isArray(body.workspaces) ? body.workspaces : []))
      .catch(() => setOrganizationWorkspaces([]));
  }, []);

  localStorage.removeItem("mpm_workspace_preference");

  const workspaceName = user?.professionalRole === "physician"
    ? "Physicians Clinic"
    : "Trainers Studio";

  const handleChoice = async (choice: "personal" | "workspace") => {
    if (choice !== "workspace") {
      onChoose(choice);
      return;
    }

    setChecking(true);
    try {
      const phase1Res = await apiRequest("/api/certifications/phase1-status");
      const phase1Complete = (phase1Res as any)?.phase1Complete === true;
      const proCareCertificationComplete =
        (phase1Res as any)?.proCareCertificationComplete === true;

      if (!phase1Complete) {
        sessionStorage.setItem(
          "mpm.launchpad.redirectMsg",
          "Complete the My Perfect Meals Academy — Phase 1 before accessing the Studio."
        );
        setLocation("/pro-launchpad");
        return;
      }

      if (user?.phase2GateEnabled && !proCareCertificationComplete) {
        sessionStorage.setItem(
          "mpm.launchpad.redirectMsg",
          "Complete Phase 3 ProCare Certification to access the ProCare Studio."
        );
        setLocation("/certifications/procare_certification");
        return;
      }

      onChoose("workspace");
    } catch {
      onChoose("workspace");
    } finally {
      setChecking(false);
    }
  };

  const handleOrganizationChoice = async (workspace: typeof organizationWorkspaces[number]) => {
    setChecking(true);
    setOrganizationError(null);
    try {
      if (workspace.action === "setup" && workspace.authorizationId) {
        const response = await fetch("/api/business/pilot-authorizations/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ authorizationId: workspace.authorizationId }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not claim this organization.");
        setLocation("/business/setup?pilot=1");
        return;
      }
      setLocation("/business-dashboard");
    } catch (error: any) {
      setOrganizationError(error?.message || "Could not open this organization.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm mx-6 space-y-5"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
              <Crown className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-300">{t("welcomeBack")}</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t("whereToTitle")}</h1>
            <p className="text-white/60 text-sm">{t("whereToSubtitle")}</p>
          </div>

          <button
            onClick={() => handleChoice("personal")}
            disabled={checking}
            className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg active:scale-[0.98] transition-transform text-left disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/20">
                <Home className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">{td("personalSpace")}</h3>
                <p className="text-white/50 text-sm mt-0.5">{t("personalSpaceDesc")}</p>
              </div>
            </div>
          </button>

          {organizationWorkspaces.map((workspace) => (
            <button
              key={workspace.authorizationId ?? workspace.businessId}
              onClick={() => handleOrganizationChoice(workspace)}
              disabled={checking}
              className="w-full p-5 rounded-2xl bg-orange-500/10 border border-orange-400/30 backdrop-blur-lg active:scale-[0.98] transition-transform text-left disabled:opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/20">
                  <Building2 className="h-5 w-5 text-orange-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base">Business / Organization</h3>
                  <p className="text-orange-200 text-sm mt-0.5">{workspace.organizationName}</p>
                  <p className="text-white/50 text-xs mt-1">
                    {workspace.action === "setup" ? "Set Up Organization" : "Open Business Suite"}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {organizationError && (
            <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
              {organizationError}
            </p>
          )}

          <button
            onClick={() => handleChoice("workspace")}
            disabled={checking}
            className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg active:scale-[0.98] transition-transform text-left disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/20">
                {checking ? (
                  <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                ) : (
                  <Briefcase className="h-5 w-5 text-orange-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">{td("workspaces")}</h3>
                <p className="text-white/50 text-sm mt-0.5">
                  {checking ? t("checkingAccess") : t("manageClientsIn", { name: workspaceName })}
                </p>
              </div>
            </div>
          </button>

          {false && <label className="flex items-center justify-center gap-2 cursor-pointer py-2 text-sm text-white/50 select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50"
            />
            Always start here
          </label>}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
