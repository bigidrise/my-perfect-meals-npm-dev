import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import { useGuidedJourneyDashboard } from "./useGuidedJourneyDashboard";
import { journeyDashboardContextKey } from "@/lib/guidedJourney/dashboardScope";
import { boardPlacementSignature, confirmPersonalBoard, personalGeneralBoardAllowed, type BoardSaveObservation } from "@/lib/guidedJourney/mealBoard";

export function useGuidedPersonalMealBoard(weekStartISO: string, board: unknown, proClientId?: string, householdProfileId?: string) {
  const { user, loading, refreshUser } = useAuth();
  const { activeProfileId } = useHousehold();
  const [path, navigate] = useLocation();
  function workspace() { try { return localStorage.getItem("mpm_active_space"); } catch { return "unknown"; } }
  function professionalSession() { try { return localStorage.getItem("pro-session") === "true"; } catch { return true; } }
  const context = { development: IS_DEVELOPMENT, path, workspace: workspace(),
    householdProfileId: householdProfileId || activeProfileId, weekStartISO, proClientId };
  const eligible = !loading && !professionalSession() && personalGeneralBoardAllowed(user, context);
  const key = journeyDashboardContextKey(user, context) + String(user?.performanceModeEnabled);
  const generation = useMemo(() => ({}), [key, eligible]);
  const live = useRef({ generation, eligible });
  live.current = { generation, eligible };
  const attempts = useRef({ generation, pending: new Set<object>(), failed: false, untagged: {} });
  if (attempts.current.generation !== generation) attempts.current = { generation, pending: new Set(), failed: false, untagged: {} };
  const [receipt, setReceipt] = useState<{ generation: object; state: BoardSaveObservation["state"] | "idle"; revision: number }>({
    generation, state: "idle", revision: 0,
  });
  const currentReceipt = receipt.generation === generation ? receipt : { generation, state: "idle", revision: 0 };
  const observeSave = useMemo(() => eligible ? (event: BoardSaveObservation) => {
    if (live.current.generation !== generation || !live.current.eligible || event.proClientId || event.householdProfileId
      || event.namespace !== "generalNutrition" || event.weekStartISO !== weekStartISO) return;
    const cycle = attempts.current;
    const operation = event.operation ?? cycle.untagged;
    if (event.state === "saving") {
      if (!cycle.pending.size) cycle.failed = false;
      cycle.pending.add(operation);
    } else {
      cycle.pending.delete(operation);
      if (event.state === "failed") cycle.failed = true;
    }
    setReceipt(previous => ({ generation, state: cycle.pending.size ? "saving" : cycle.failed ? "failed" : event.state,
      revision: (previous.generation === generation ? previous.revision : 0)
        + (event.state !== "saving" && !cycle.pending.size ? 1 : 0) }));
  } : undefined, [generation, eligible, weekStartISO]);
  const localSignature = eligible ? boardPlacementSignature(board, weekStartISO) : "";
  const journey = useGuidedJourneyDashboard({
    account: user, contextKey: key, eligible, refreshAccount: refreshUser, navigate,
    workflowBusy: currentReceipt.state === "saving",
    isCurrentContextPersonal: () => !loading && !professionalSession() && personalGeneralBoardAllowed(user, {
      ...context, workspace: workspace(), path: window.location.pathname,
    }),
    mealBoard: {
      localSignature, pending: currentReceipt.state === "saving", failed: currentReceipt.state === "failed",
      revision: currentReceipt.revision,
      confirm: (snapshot, signal) => confirmPersonalBoard(snapshot, weekStartISO, localSignature, signal),
      retry: () => {
        if (attempts.current.pending.size) return;
        attempts.current.failed = false;
        setReceipt(previous => ({ generation, state: "idle",
          revision: (previous.generation === generation ? previous.revision : 0) + 1 }));
      },
    },
  });
  return { ...journey, observeSave, unverifiedLocal: localSignature === "unverified",
    placed: !!localSignature && localSignature !== "unverified",
    pending: currentReceipt.state === "saving", failed: currentReceipt.state === "failed" };
}
