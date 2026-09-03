/**
 * useMealRefinement.ts
 *
 * React hook that manages the preview → confirm → restore flow for
 * swapping one meal component on the Weekly Meal Board.
 *
 * Usage:
 *   const { state, preview, confirm, restore, reset } = useMealRefinement();
 *
 * State machine:
 *   idle → previewing → previewed → confirming → confirmed
 *                                              ↓
 *                                           restoring → idle
 */

import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/apiRequest";
import type {
  SlotContext,
  MealComponent,
  RefinementPreviewResponse,
  RefinementConfirmResponse,
  RefinementRestoreResponse,
} from "../../../shared/refinement";

// ── State shape ───────────────────────────────────────────────────────────────

export type RefinementPhase =
  | "idle"
  | "previewing"
  | "previewed"
  | "confirming"
  | "confirmed"
  | "restoring"
  | "error";

export interface MealRefinementState {
  phase:         RefinementPhase;
  previewResult: RefinementPreviewResponse | null;
  confirmResult: RefinementConfirmResponse | null;
  error:         string | null;
}

const IDLE_STATE: MealRefinementState = {
  phase:         "idle",
  previewResult: null,
  confirmResult: null,
  error:         null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMealRefinement() {
  const [state, setState] = useState<MealRefinementState>(IDLE_STATE);

  /** Request a preview of the component swap. */
  const preview = useCallback(async (
    slotContext:     SlotContext,
    componentTarget: MealComponent,
    userInstruction: string,
  ): Promise<void> => {
    setState(s => ({ ...s, phase: "previewing", error: null }));
    try {
      const result: RefinementPreviewResponse = await apiRequest(
        "/api/refinement/preview",
        { method: "POST", body: JSON.stringify({ slotContext, componentTarget, userInstruction }) },
      );
      setState({
        phase:         "previewed",
        previewResult: result,
        confirmResult: null,
        error:         null,
      });
    } catch (err: any) {
      const msg = err?.message ?? "Preview failed. Please try again.";
      setState(s => ({ ...s, phase: "error", error: msg }));
    }
  }, []);

  /** Confirm the previewed swap — atomically replaces the board slot. */
  const confirm = useCallback(async (
    confirmToken: string,
    onConfirmed?: (result: RefinementConfirmResponse) => void,
  ): Promise<void> => {
    setState(s => ({ ...s, phase: "confirming", error: null }));
    try {
      const result: RefinementConfirmResponse = await apiRequest(
        "/api/refinement/confirm",
        { method: "POST", body: JSON.stringify({ confirmToken }) },
      );
      setState(s => ({
        ...s,
        phase:         "confirmed",
        confirmResult: result,
      }));
      onConfirmed?.(result);
    } catch (err: any) {
      const msg = err?.message ?? "Confirm failed. Please try again.";
      setState(s => ({ ...s, phase: "error", error: msg }));
    }
  }, []);

  /** Restore the original meal using the restore token from confirm. */
  const restore = useCallback(async (
    restoreToken: string,
    onRestored?: (result: RefinementRestoreResponse) => void,
  ): Promise<void> => {
    setState(s => ({ ...s, phase: "restoring", error: null }));
    try {
      const result: RefinementRestoreResponse = await apiRequest(
        "/api/refinement/restore",
        { method: "POST", body: JSON.stringify({ restoreToken }) },
      );
      setState(IDLE_STATE);
      onRestored?.(result);
    } catch (err: any) {
      const msg = err?.message ?? "Restore failed. Please try again.";
      setState(s => ({ ...s, phase: "error", error: msg }));
    }
  }, []);

  /** Reset back to idle (e.g. when user cancels). */
  const reset = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  return { state, preview, confirm, restore, reset };
}
