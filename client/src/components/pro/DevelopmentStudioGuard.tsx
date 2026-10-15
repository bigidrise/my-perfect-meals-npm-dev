import { useEffect, useState, type ComponentType, type ComponentProps } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { canEnterStudio } from "@shared/studioAccess";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { useOrg } from "@/contexts/OrgContext";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { apiRequest } from "@/lib/queryClient";
import { createProfessionalLegalRecoveryUrl } from "@/lib/professionalLegalRecovery";
import { currentStudioNavigation, preloadStudioPage } from "@/lib/studioTransition";
import { StudioLoadingPanel } from "./StudioLoadingPanel";

type Check = "checking" | "passed" | "denied" | "error";
type Checks = { scope: string; code: Check; workspace: Check; agreements: Check; certification: Check };
const pending = (scope: string): Checks => ({ scope, code: "checking", workspace: "checking", agreements: "checking", certification: "checking" });

export function StudioTransitionPanel(props: ComponentProps<typeof StudioLoadingPanel>) {
  return <div className="min-h-[70dvh] bg-[#201c19] px-5 py-10 pb-28 text-white">
    <div className="mx-auto max-w-xl"><StudioLoadingPanel {...props} /></div>
  </div>;
}

/** DEV-only variant. Every navigation verifies afresh; no permission-result cache. */
export function DevelopmentStudioGuard({ component: Component }: { component: ComponentType }) {
  const { user, loading: authLoading } = useAuth();
  const { org, isLoading: orgLoading } = useOrg();
  const [location, navigate] = useLocation();
  const { requestUpgrade } = useUpgradeModal();
  const requireAcademy = org.featureFlags.requireAcademy !== false;
  // Identity stays local to React; timing records never contain this key.
  const scope = [user?.id, user?.professionalRole, user?.isAdmin, user?.phase2GateEnabled, org.id, requireAcademy, location].join("|");
  const [checks, setChecks] = useState(() => pending(scope));
  const [workspaceRestriction, setWorkspaceRestriction] = useState<{ scope: string; message: string } | null>(null);
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);
  const timing = currentStudioNavigation(location);
  const update = (key: keyof Omit<Checks, "scope">, value: Check) => {
    setChecks(previous => ({ ...(previous.scope === scope ? previous : pending(scope)), [key]: value }));
  };

  useEffect(() => {
    let active = true;
    update("code", "checking");
    timing?.start("code");
    timing?.selectCode("professional");
    preloadStudioPage(location).then(() => {
      if (!active) return;
      update("code", "passed"); timing?.codeLoaded("professional", "ready");
    }).catch(() => {
      if (!active) return;
      update("code", "error"); timing?.codeLoaded("professional", "error");
    });
    return () => { active = false; };
  }, [scope]);

  useEffect(() => {
    let active = true;
    update("workspace", "checking");
    setWorkspaceRestriction(null);
    if (!user?.id || authLoading) return () => { active = false; };
    timing?.start("workspace");
    apiRequest("/api/business/workspace/studio-access").then((result: any) => {
      if (!active) return;
      const disconnected = result?.studioAccess?.canReconnectAddon === true;
      const allowed = canEnterStudio(result?.studioAccess);
      update("workspace", allowed ? "passed" : "denied");
      if (!allowed) setWorkspaceRestriction({
        scope, message: result?.studioAccess?.restriction?.message ||
          "Studio access is not authorized or ready. Workspace recognition does not grant clinical access.",
      });
      timing?.finish("workspace", allowed ? "verified" : "denied");
      if (disconnected) navigate("/more");
    }).catch(() => {
      if (!active) return;
      update("workspace", "error"); timing?.finish("workspace", "error");
    });
    return () => { active = false; };
  }, [scope, authLoading]);

  useEffect(() => {
    let active = true;
    update("agreements", "checking");
    if (!user?.id || authLoading) return () => { active = false; };
    timing?.start("agreements");
    if (!user.professionalRole || user.professionalRole === "business") {
      update("agreements", "passed"); timing?.finish("agreements", "not-required");
      return () => { active = false; };
    }
    const flow = user.professionalRole === "physician" ? "physician" : "professional";
    Promise.all([
      apiRequest("/api/legal/status?flow=attestation"),
      apiRequest(`/api/legal/status?flow=${flow}`),
    ]).then(([attestation, professional]: any[]) => {
      if (!active) return;
      const accepted = attestation?.allAccepted === true && professional?.allAccepted === true;
      update("agreements", accepted ? "passed" : "denied");
      timing?.finish("agreements", accepted ? "verified" : "denied");
      if (!accepted) navigate(createProfessionalLegalRecoveryUrl(location, "professional-workspace"));
    }).catch(() => {
      if (!active) return;
      // A failed check is not agreement acceptance. Protected content stays hidden.
      update("agreements", "error"); timing?.finish("agreements", "error");
    });
    return () => { active = false; };
  }, [scope, authLoading]);

  useEffect(() => {
    let active = true;
    update("certification", "checking");
    timing?.start("certification"); // Includes the wait for authoritative Org policy.
    if (!user?.id || authLoading || orgLoading) return () => { active = false; };
    const notRequired = user.isAdmin || !user.professionalRole || user.professionalRole === "business" || !requireAcademy;
    if (notRequired) {
      update("certification", "passed"); timing?.finish("certification", "not-required");
      return () => { active = false; };
    }
    const verify = (initial: boolean) => {
      apiRequest("/api/certifications/phase1-status").then((result: any) => {
        if (!active) return;
        const phase1 = result?.phase1Complete === true;
        const accepted = phase1 && (!user.phase2GateEnabled || result?.proCareCertificationComplete === true);
        update("certification", accepted ? "passed" : "denied");
        if (initial) timing?.finish("certification", accepted ? "verified" : "denied");
        if (!accepted) navigate(phase1 ? "/certifications/procare_certification" : "/professional-onboarding-bridge");
      }).catch(() => {
        if (!active || !initial) return;
        update("certification", "error"); timing?.finish("certification", "error");
      });
    };
    verify(true);
    const interval = setInterval(() => verify(false), 5 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [scope, authLoading, orgLoading]);

  useEffect(() => {
    const handler = () => requestUpgrade({ requiredTier: "pro", featureName: "ProCare Studio" });
    window.addEventListener("mpm:pro-required", handler);
    return () => window.removeEventListener("mpm:pro-required", handler);
  }, [requestUpgrade]);

  const ready = !authLoading && Boolean(user?.id) && !orgLoading && checks.scope === scope &&
    [checks.code, checks.workspace, checks.agreements, checks.certification].every(value => value === "passed");
  // A commit of the authorized component precedes this marker, never vice versa.
  useEffect(() => {
    if (!ready) return;
    timing?.finish("authorized-page", "ready");
    timing?.finish("navigation", "ready");
  }, [ready, scope]);

  if (!authLoading && !user?.id) return <StudioTransitionPanel kind="denied" detail="Sign in to verify access to your Studio workspace." />;
  const current = checks.scope === scope ? checks : pending(scope);
  if ([current.code, current.workspace, current.agreements, current.certification].includes("error")) {
    return <StudioTransitionPanel kind="error" title="Unable to verify this workspace"
      detail="An access or agreement check could not be completed. Protected content remains hidden. Please reload to retry." />;
  }
  if ([current.workspace, current.agreements, current.certification].includes("denied")) {
    return <>
      <StudioTransitionPanel kind="denied" title="Studio access is unavailable"
        detail={workspaceRestriction?.scope === scope ? workspaceRestriction.message : "The required workspace access, agreements, or certification are not complete."} />
      <div className="px-4 pb-6 text-center">
        <button className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white"
          onClick={() => setShowWorkspaceChooser(true)}>View recognized workspaces</button>
      </div>
      {showWorkspaceChooser && <WorkspaceChooser onSelected={() => setShowWorkspaceChooser(false)} />}
    </>;
  }
  if (!ready) return <StudioTransitionPanel title="Opening your Studio workspace" detail="Checking access and preparing the page…" />;
  return <Component />;
}
