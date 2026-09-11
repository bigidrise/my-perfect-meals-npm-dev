import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { readOrganizationQuickStartJourney } from "@/hooks/useOrganizationQuickStart";

const QUICK_START_DESTINATIONS = new Set([
  "/business-dashboard",
  "/business/dashboard",
  "/business-center/academy",
  "/business-center/affiliate/dashboard",
  "/care-team",
  "/care-team/trainer",
  "/care-team/physician",
]);

export function OrganizationQuickStartReturn() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const path = location.split("?")[0];

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const markedOrganizationId = params.get("organizationQuickStart");
    if (!user?.id || !markedOrganizationId || !QUICK_START_DESTINATIONS.has(path)) {
      setOrganizationId(null);
      return;
    }
    fetch("/api/business/workspace/active", { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return;
        const activeOrganizationId = payload?.workspace?.organizationId;
        const journey = activeOrganizationId === markedOrganizationId
          ? readOrganizationQuickStartJourney(
              sessionStorage,
              user.id,
              markedOrganizationId,
              path,
            )
          : null;
        setOrganizationId(journey ? markedOrganizationId : null);
      })
      .catch(() => {
        if (active) setOrganizationId(null);
      });
    return () => { active = false; };
  }, [path, user?.id]);

  if (!organizationId) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(`/business-organizations?organizationQuickStartReturn=${encodeURIComponent(organizationId)}`)}
      className="fixed left-3 top-3 z-[70] inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-zinc-950/95 px-3 py-2 text-xs font-semibold text-blue-200 shadow-xl backdrop-blur hover:bg-blue-950"
      data-testid="organization-quick-start-return"
    >
      <ArrowLeft className="h-4 w-4" />
      Return to Organization Quick Start
    </button>
  );
}