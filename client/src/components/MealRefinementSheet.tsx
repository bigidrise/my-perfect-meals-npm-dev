/**
 * MealRefinementSheet
 *
 * Universal bottom sheet for refining any generated meal.
 * Opens over any meal card. Shows quick-action chips + free-text input.
 * Calls POST /api/meal-refinement/refine, shows a preview of Version 2,
 * and fires onRefined(meal) when the user accepts.
 */

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Wand2,
  Send,
  Loader2,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { post } from "@/lib/api";

// ── Quick-action chips ────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  "Replace an ingredient",
  "More protein",
  "Less starch",
  "Smaller portion",
  "Sweeter",
  "Less sweet",
  "Thicker / creamier",
  "Less spicy",
  "Make it simpler",
  "Kid-friendly",
  "Dairy-free",
];

type Phase = "idle" | "loading" | "preview";

interface RefinedMealPreview {
  name: string;
  description?: string;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Current meal object — sent as-is to the API */
  meal: any;
  /** Optional builder type hint for the prompt */
  builderType?: string;
  /** Called when the user accepts the refined version */
  onRefined: (refinedMeal: any) => void;
}

export default function MealRefinementSheet({
  open,
  onOpenChange,
  meal,
  builderType,
  onRefined,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [refinedMeal, setRefinedMeal] = useState<any>(null);
  const [refinementLabel, setRefinementLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Close + reset
  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Defer reset so the close animation plays first
    setTimeout(() => {
      setPhase("idle");
      setInput("");
      setSelectedChip(null);
      setRefinedMeal(null);
      setRefinementLabel("");
      setError(null);
      setPreviewExpanded(false);
    }, 300);
  }, [onOpenChange]);

  const handleChipClick = useCallback((chip: string) => {
    setSelectedChip((prev) => (prev === chip ? null : chip));
    setInput("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const request = selectedChip || input.trim();
    if (!request) return;

    setPhase("loading");
    setError(null);

    try {
      const data = await post("/api/meal-refinement/refine", {
        meal,
        request,
        builderType,
      });

      if (data?.error) throw new Error(data.error);

      setRefinedMeal(data.meal);
      setRefinementLabel(data.refinementApplied ?? request);
      setPhase("preview");
    } catch (err: any) {
      setError(err?.message || "Refinement failed. Please try again.");
      setPhase("idle");
    }
  }, [meal, builderType, selectedChip, input]);

  const handleAccept = useCallback(() => {
    if (!refinedMeal) return;
    onRefined(refinedMeal);
    handleClose();
  }, [refinedMeal, onRefined, handleClose]);

  const handleTryAnother = useCallback(() => {
    setPhase("idle");
    setRefinedMeal(null);
    setRefinementLabel("");
    setPreviewExpanded(false);
  }, []);

  if (!open) return null;

  const canSubmit =
    phase === "idle" && !!(selectedChip || input.trim());

  const preview: RefinedMealPreview | null = refinedMeal
    ? {
        name: refinedMeal.name ?? refinedMeal.title ?? "Refined Meal",
        description: refinedMeal.description,
        nutrition: refinedMeal.nutrition ?? {
          calories: refinedMeal.calories,
          protein: refinedMeal.protein,
          carbs: refinedMeal.carbs,
          fat: refinedMeal.fat,
        },
      }
    : null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10001,
          maxHeight: "88dvh",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(to bottom, #0d0d0d, #111111)",
          borderTop: "1px solid rgba(139,92,246,0.4)",
          borderLeft: "1px solid rgba(139,92,246,0.25)",
          borderRight: "1px solid rgba(139,92,246,0.25)",
          borderRadius: "16px 16px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: 8,
              borderRadius: 12,
              background: "rgba(139,92,246,0.2)",
              border: "1px solid rgba(139,92,246,0.4)",
            }}
          >
            <Wand2 style={{ width: 20, height: 20, color: "#a78bfa" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 15,
                lineHeight: 1.2,
              }}
            >
              Refine Meal
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                marginTop: 1,
              }}
            >
              {meal?.name ?? meal?.title ?? "Your meal"} · Version 2
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: 8,
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            minHeight: 0,
          }}
        >
          <AnimatePresence mode="wait">
            {/* ── IDLE ── */}
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {error && (
                  <div
                    style={{
                      borderRadius: 10,
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      padding: "10px 14px",
                      color: "#f87171",
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Quick-action chips */}
                <div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 10,
                    }}
                  >
                    Quick changes
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleChipClick(chip)}
                        style={{
                          padding: "8px 13px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          background:
                            selectedChip === chip
                              ? "rgba(139,92,246,0.3)"
                              : "rgba(255,255,255,0.05)",
                          border:
                            selectedChip === chip
                              ? "1px solid rgba(139,92,246,0.7)"
                              : "1px solid rgba(255,255,255,0.1)",
                          color:
                            selectedChip === chip
                              ? "#c4b5fd"
                              : "rgba(255,255,255,0.7)",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free-text input */}
                <div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    Or describe the change
                  </div>
                  <div style={{ position: "relative" }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        if (e.target.value) setSelectedChip(null);
                        setError(null);
                      }}
                      placeholder={'Tell Coach what to change\u2026 e.g. \u201CI like everything except the quinoa\u201D'}
                      rows={3}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        padding: "12px 48px 12px 14px",
                        color: "white",
                        fontSize: 14,
                        lineHeight: 1.5,
                        resize: "none",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      style={{
                        position: "absolute",
                        right: 10,
                        bottom: 10,
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: canSubmit
                          ? "rgba(139,92,246,0.8)"
                          : "rgba(255,255,255,0.08)",
                        border: "none",
                        color: canSubmit
                          ? "white"
                          : "rgba(255,255,255,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: canSubmit ? "pointer" : "not-allowed",
                      }}
                    >
                      <Send style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>

                {/* Apply button (for chip selection) */}
                {selectedChip && (
                  <button
                    onClick={handleSubmit}
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      background: "rgba(139,92,246,0.75)",
                      border: "1px solid rgba(139,92,246,0.5)",
                      color: "white",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Wand2 style={{ width: 16, height: 16 }} />
                    Apply: {selectedChip}
                  </button>
                )}
              </motion.div>
            )}

            {/* ── LOADING ── */}
            {phase === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "80px 16px",
                  gap: 18,
                }}
              >
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "rgba(139,92,246,0.2)",
                      border: "2px solid rgba(139,92,246,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Wand2
                      style={{ width: 26, height: 26, color: "#a78bfa" }}
                    />
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "2px solid transparent",
                      borderTopColor: "#8b5cf6",
                    }}
                  />
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 14,
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  Refining your meal through the full protocol stack…
                </div>
              </motion.div>
            )}

            {/* ── PREVIEW ── */}
            {phase === "preview" && preview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {/* Version badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2
                    style={{ width: 16, height: 16, color: "#a78bfa" }}
                  />
                  <span
                    style={{
                      color: "#a78bfa",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Version 2 Ready · {refinementLabel}
                  </span>
                </div>

                {/* Refined meal card */}
                <div
                  style={{
                    borderRadius: 12,
                    background: "rgba(139,92,246,0.12)",
                    border: "1px solid rgba(139,92,246,0.35)",
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: 18,
                      lineHeight: 1.25,
                      marginBottom: 8,
                    }}
                  >
                    {preview.name}
                  </div>
                  {preview.description && (
                    <div
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 13,
                        lineHeight: 1.5,
                        marginBottom: 12,
                      }}
                    >
                      {preview.description}
                    </div>
                  )}

                  {/* Macro grid */}
                  {preview.nutrition && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {[
                        {
                          label: "Cal",
                          value: preview.nutrition.calories,
                          suffix: "",
                        },
                        {
                          label: "Protein",
                          value: preview.nutrition.protein,
                          suffix: "g",
                        },
                        {
                          label: "Carbs",
                          value: preview.nutrition.carbs,
                          suffix: "g",
                        },
                        {
                          label: "Fat",
                          value: preview.nutrition.fat,
                          suffix: "g",
                        },
                      ].map(({ label, value, suffix }) => (
                        <div
                          key={label}
                          style={{
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            padding: "8px 4px",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              color: "white",
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            {value != null ? Math.round(value) : "—"}
                            {suffix}
                          </div>
                          <div
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              fontSize: 10,
                              marginTop: 2,
                            }}
                          >
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expandable ingredients list */}
                  {Array.isArray(refinedMeal?.ingredients) &&
                    refinedMeal.ingredients.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() =>
                            setPreviewExpanded((v) => !v)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 12,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {previewExpanded ? (
                            <ChevronUp style={{ width: 13, height: 13 }} />
                          ) : (
                            <ChevronDown style={{ width: 13, height: 13 }} />
                          )}
                          {previewExpanded
                            ? "Hide ingredients"
                            : `See all ${refinedMeal.ingredients.length} ingredients`}
                        </button>
                        {previewExpanded && (
                          <ul
                            style={{
                              marginTop: 8,
                              listStyle: "none",
                              padding: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            {refinedMeal.ingredients.map(
                              (ing: any, i: number) => {
                                const name =
                                  typeof ing === "string"
                                    ? ing
                                    : (ing.name ?? ing.item ?? "");
                                const qty =
                                  typeof ing === "string"
                                    ? ""
                                    : `${ing.quantity ?? ing.amount ?? ""} ${ing.unit ?? ""}`.trim();
                                return (
                                  <li
                                    key={i}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 6,
                                      fontSize: 12,
                                      color: "rgba(255,255,255,0.7)",
                                    }}
                                  >
                                    <span style={{ color: "#a78bfa" }}>•</span>
                                    <span>
                                      {qty ? `${qty} ${name}` : name}
                                    </span>
                                  </li>
                                );
                              }
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                </div>

                {/* Action buttons */}
                <button
                  onClick={handleAccept}
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    borderRadius: 12,
                    background: "rgba(139,92,246,0.75)",
                    border: "1px solid rgba(139,92,246,0.5)",
                    color: "white",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2 style={{ width: 16, height: 16 }} />
                  Use This Version
                </button>

                <button
                  onClick={handleTryAnother}
                  style={{
                    width: "100%",
                    padding: "12px 0",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  Try a different change
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>,
    document.body
  );
}
