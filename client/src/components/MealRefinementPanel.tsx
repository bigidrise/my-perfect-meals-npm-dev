/**
 * MealRefinementPanel.tsx
 *
 * Floating "Swap a component" button + drawer for replacing one component of a
 * Weekly Meal Board meal card (day mode only; hidden in week/board mode).
 *
 * Supported slots: breakfast | lunch | dinner | snacks.
 * meal4/meal5/meal6 are intentionally unsupported (the API only accepts the
 * four standard slots) — callers must filter those out before rendering.
 *
 * Persistent Undo:
 *   After a confirmed swap the restore token (60-min TTL) is saved to
 *   localStorage keyed by slot coordinates.  On mount the panel checks for a
 *   live restore token and shows a dedicated "Undo last swap" section so the
 *   user can revert for the full 60 minutes — not just the 3-second toast.
 *
 * Flow:
 *   1. "Swap a component" → drawer opens
 *   2. Pick component + optional instruction → POST /api/refinement/preview
 *   3. Preview drawer shows macro diff → "Confirm swap"
 *   4. POST /api/refinement/confirm → board updates server-side
 *   5. restoreToken stored in localStorage; onRefined() fires for board refresh
 *   6. Panel re-mounts (new mealId after refresh) → shows Undo section from LS
 *   7. "Undo" → POST /api/refinement/restore → board reverts → LS cleared
 */

import React, { useState, useEffect } from "react";
import { Wand2, X, ArrowLeftRight, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useMealRefinement } from "@/hooks/useMealRefinement";
import type { SlotContext, MealComponent } from "../../../shared/refinement";
import { MEAL_COMPONENT_LABELS } from "../../../shared/refinement";

// ── Restore-token localStorage helpers ───────────────────────────────────────

const LS_KEY_PREFIX = "refinement_restore:";

interface StoredRestoreEntry {
  token: string;
  expiresAt: number; // unix ms
}

function lsKey(weekStartISO: string, dayISO: string, slot: string): string {
  return `${LS_KEY_PREFIX}${weekStartISO}:${dayISO}:${slot}`;
}

function saveRestoreToken(weekStartISO: string, dayISO: string, slot: string, token: string, ttlMinutes: number) {
  try {
    const entry: StoredRestoreEntry = {
      token,
      expiresAt: Date.now() + ttlMinutes * 60_000,
    };
    localStorage.setItem(lsKey(weekStartISO, dayISO, slot), JSON.stringify(entry));
  } catch { /* localStorage may be unavailable */ }
}

function loadRestoreToken(weekStartISO: string, dayISO: string, slot: string): StoredRestoreEntry | null {
  try {
    const raw = localStorage.getItem(lsKey(weekStartISO, dayISO, slot));
    if (!raw) return null;
    const entry: StoredRestoreEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(lsKey(weekStartISO, dayISO, slot));
      return null;
    }
    return entry;
  } catch { return null; }
}

function clearRestoreToken(weekStartISO: string, dayISO: string, slot: string) {
  try {
    localStorage.removeItem(lsKey(weekStartISO, dayISO, slot));
  } catch { /* ignore */ }
}

function minutesRemaining(expiresAt: number): number {
  return Math.max(0, Math.round((expiresAt - Date.now()) / 60_000));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MealRefinementPanelProps {
  /** YYYY-MM-DD — identifies the weekly board (week start). */
  weekStartISO: string;
  /** YYYY-MM-DD — the specific day being refined. */
  dayISO:       string;
  /** Meal slot within the day (only the 4 standard slots). */
  slot:         "breakfast" | "lunch" | "dinner" | "snacks";
  /** meal.id of the meal being refined. */
  mealId:       string;
  /** Called after a successful confirm or restore so the parent can refresh board state. */
  onRefined?:   () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const COMPONENTS: MealComponent[] = ["protein", "starch", "vegetable", "sauce", "side"];

export function MealRefinementPanel({
  weekStartISO,
  dayISO,
  slot,
  mealId,
  onRefined,
}: MealRefinementPanelProps) {
  const { toast } = useToast();
  const { state, preview, confirm, restore, reset } = useMealRefinement();

  const [open, setOpen]                           = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<MealComponent | null>(null);
  const [instruction, setInstruction]             = useState("");

  // Persistent restore entry — loaded from localStorage on mount
  const [pendingRestore, setPendingRestore]       = useState<StoredRestoreEntry | null>(null);

  const slotContext: SlotContext = { weekStartISO, dayISO, slot, mealId };

  // Check for a live restore token on mount (survives board refresh)
  useEffect(() => {
    const entry = loadRestoreToken(weekStartISO, dayISO, slot);
    setPendingRestore(entry);
  }, [weekStartISO, dayISO, slot, mealId]);

  const handleOpen = () => {
    setOpen(true);
    reset();
    setSelectedComponent(null);
    setInstruction("");
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handlePreview = async () => {
    if (!selectedComponent) return;
    await preview(
      slotContext,
      selectedComponent,
      instruction.trim() || `Give me a different ${selectedComponent}`,
    );
  };

  const handleConfirm = async () => {
    if (!state.previewResult) return;
    await confirm(
      state.previewResult.confirmToken,
      (result) => {
        setOpen(false);
        // Persist restore token for the full 60-minute TTL
        saveRestoreToken(weekStartISO, dayISO, slot, result.restoreToken, 60);
        setPendingRestore(loadRestoreToken(weekStartISO, dayISO, slot));
        onRefined?.();
        // Brief toast with no action — the persistent Undo section handles the rest
        toast({
          title:       "Meal component swapped ✓",
          description: 'Use "Undo last swap" on the card to revert within 60 minutes.',
          duration:    4000,
        });
      },
    );
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    await restore(
      pendingRestore.token,
      () => {
        clearRestoreToken(weekStartISO, dayISO, slot);
        setPendingRestore(null);
        onRefined?.();
        toast({ title: "Swap undone", description: "Original meal restored.", duration: 3000 });
      },
    );
  };

  const previewMeal = state.previewResult?.previewMeal;
  const macroDiff   = state.previewResult?.macroDiff;

  const diffLabel = (n: number) =>
    n === 0 ? null : (n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);

  return (
    <>
      {/* Persistent Undo — shown for up to 60 min after a confirmed swap */}
      {pendingRestore && (
        <div className="flex items-center gap-2 mt-2 p-2 rounded-xl bg-zinc-800/60 border border-zinc-700">
          <Clock className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-white/60 flex-1">
            Swap can be undone ({minutesRemaining(pendingRestore.expiresAt)} min left)
          </span>
          <button
            onClick={handleRestore}
            disabled={state.phase === "restoring"}
            className="text-xs text-yellow-400 hover:text-yellow-300 font-medium disabled:opacity-50 flex items-center gap-1"
          >
            {state.phase === "restoring" ? (
              <span className="animate-spin text-xs">↻</span>
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Undo
          </button>
        </div>
      )}

      {/* Swap trigger — always shown */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mt-2"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Swap a component
      </button>

      {/* Drawer */}
      <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
        <SheetContent side="bottom" className="bg-zinc-900 text-white border-zinc-700 rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white text-base font-medium">
                Swap a Meal Component
              </SheetTitle>
              <button onClick={handleClose} className="text-white/50 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Step 1 — pick component */}
          {state.phase === "idle" && (
            <div className="space-y-4">
              <p className="text-sm text-white/60">Which part would you like to swap?</p>
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedComponent(c)}
                    className={`rounded-xl border px-3 py-2 text-sm text-left transition-colors ${
                      selectedComponent === c
                        ? "border-blue-500 bg-blue-500/20 text-white"
                        : "border-zinc-700 bg-zinc-800 text-white/70 hover:border-zinc-500"
                    }`}
                  >
                    {MEAL_COMPONENT_LABELS[c]}
                  </button>
                ))}
              </div>

              {selectedComponent && (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      Instruction (optional)
                    </label>
                    <input
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder={`e.g. something lighter, no onion…`}
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handlePreview}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Preview swap
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Loading */}
          {state.phase === "previewing" && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
              <span className="ml-3 text-sm text-white/60">Generating preview…</span>
            </div>
          )}

          {/* Step 2 — preview */}
          {state.phase === "previewed" && previewMeal && (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-4 space-y-2">
                <p className="text-sm font-medium text-white">{previewMeal.title}</p>
                {previewMeal.changesSummary && (
                  <p className="text-xs text-white/60">{previewMeal.changesSummary}</p>
                )}
                {previewMeal.protocolNote && (
                  <p className="text-xs text-yellow-400/80">{previewMeal.protocolNote}</p>
                )}
              </div>

              {/* Macro diff */}
              {macroDiff && (
                <div className="flex gap-3 text-xs text-white/60">
                  {([["cal", macroDiff.calories], ["prot", macroDiff.protein], ["carbs", macroDiff.carbs], ["fat", macroDiff.fat]] as [string, number][]).map(([label, val]) => {
                    const d = diffLabel(val);
                    return d ? (
                      <span key={label} className={val > 0 ? "text-orange-400" : "text-green-400"}>
                        {d} {label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 text-white/70 hover:text-white"
                  onClick={() => reset()}
                >
                  Change selection
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleConfirm}
                >
                  Confirm swap
                </Button>
              </div>
            </div>
          )}

          {/* Confirming */}
          {state.phase === "confirming" && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
              <span className="ml-3 text-sm text-white/60">Saving…</span>
            </div>
          )}

          {/* Error */}
          {state.phase === "error" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-red-900/30 border border-red-800 p-4">
                <p className="text-sm text-red-300">{state.error ?? "Something went wrong."}</p>
              </div>
              <Button
                variant="outline"
                className="w-full border-zinc-700 text-white/70"
                onClick={() => reset()}
              >
                Try again
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
