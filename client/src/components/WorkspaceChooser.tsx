import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Briefcase, Crown, Loader2, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import type {
  WorkspaceAvailability,
  WorkspaceOrganizationAvailability,
} from "@shared/workspaceAvailability";
import { getAuthHeaders } from "@/lib/auth";
import {
  fetchWorkspaceAvailability,
  PERSONAL_ONLY_FALLBACK,
} from "@/lib/workspaceAvailability";

interface WorkspaceChooserProps {
  onSelected?: () => void;
}

export function WorkspaceChooser({
  onSelected,
}: WorkspaceChooserProps) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<WorkspaceAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { t: td } = useTranslation("desktopNav");

  useEffect(() => {
    fetchWorkspaceAvailability()
      .then(setAvailability)
      .catch(() => {
        setAvailability(PERSONAL_ONLY_FALLBACK);
        setError("Additional workspaces could not be loaded. Personal remains available.");
      })
      .finally(() => setLoading(false));
  }, []);

  const choosePersonal = () => {
    if (!availability) return;
    localStorage.setItem("mpm_active_space", "personal");
    sessionStorage.removeItem("mpm.welcomeGateDone");
    onSelected?.();
    setLocation(availability.personal.destination);
  };

  const chooseStudio = () => {
    if (!availability?.studio.available || !availability.studio.destination) return;
    localStorage.setItem("mpm_active_space", "workspace");
    onSelected?.();
    setLocation(availability.studio.destination);
  };

  const selectSingleOrganization = async (
    organization: WorkspaceOrganizationAvailability,
  ) => {
    const location = organization.locations[0];
    if (!location) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/business/workspace/select", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          organizationId: organization.id,
          locationId: location.id,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Could not open this Organization Location.");
      }
      onSelected?.();
      setLocation("/business-dashboard");
    } catch (selectionError: any) {
      setError(selectionError?.message || "Could not open this organization.");
    } finally {
      setChecking(false);
    }
  };

  const chooseOrganization = async () => {
    if (!availability?.organization.available) return;
    if (
      availability.organization.destination === "/business-organizations" ||
      availability.organization.organizations.length !== 1 ||
      availability.organization.organizations[0].locations.length !== 1
    ) {
      onSelected?.();
      setLocation("/business-organizations");
      return;
    }
    await selectSingleOrganization(availability.organization.organizations[0]);
  };

  const organizationCount = availability?.organization.organizations.length ?? 0;

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

          {availability && (
            <button
              onClick={choosePersonal}
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
          )}

          {availability?.organization.available && (
            <button
              onClick={chooseOrganization}
              disabled={checking}
              className="w-full p-5 rounded-2xl bg-orange-500/10 border border-orange-400/30 backdrop-blur-lg active:scale-[0.98] transition-transform text-left disabled:opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/20">
                  <Building2 className="h-5 w-5 text-orange-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base">Business / Organization</h3>
                  <p className="text-orange-200 text-sm mt-0.5">
                    {organizationCount > 1
                      ? `${organizationCount} available organizations`
                      : availability.organization.organizations[0]?.name}
                  </p>
                  <p className="text-white/50 text-xs mt-1">
                    {availability.organization.destination === "/business-organizations"
                      ? "Choose an organization"
                      : "Open Business Suite"}
                  </p>
                </div>
              </div>
            </button>
          )}

          {availability?.studio.available && (
            <button
              onClick={chooseStudio}
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
                  <h3 className="text-white font-semibold text-base">Studio</h3>
                  <p className="text-white/50 text-sm mt-0.5">
                    {availability.studio.readiness === "ready"
                      ? "Manage clients in your Studio"
                      : "Continue Studio setup"}
                  </p>
                </div>
              </div>
            </button>
          )}

          {(loading || error) && (
            <p className={`text-center text-sm ${error ? "text-amber-200" : "text-white/50"}`}>
              {loading ? "Loading workspaces…" : error}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}