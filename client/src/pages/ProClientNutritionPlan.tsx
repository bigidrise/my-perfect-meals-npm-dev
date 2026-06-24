/**
 * ProClientNutritionPlan
 *
 * ProCare read-only view of a client's Nutrition Life Plan.
 * Route: /pro/clients/:id/nutrition-life-plan
 *
 * Fetches GET /api/pro/clients/:id/nutrition-summary and renders the
 * NutritionPersonalizationSummaryCard with the data prop so no user hook fires.
 */

import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, ShieldCheck, Eye } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { NutritionPersonalizationSummaryCard } from "@/components/protocol/NutritionPersonalizationSummaryCard";
import type { NutritionPersonalizationSummary } from "@/types/nutritionSummary";

export default function ProClientNutritionPlan() {
  const [, params] = useRoute("/pro/clients/:id/nutrition-life-plan");
  const [, navigate] = useLocation();
  const clientId = params?.id ?? "";

  const [summary, setSummary] = useState<NutritionPersonalizationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setIsLoading(true);
    setError(null);
    fetch(apiUrl(`/api/pro/clients/${clientId}/nutrition-summary`), {
      headers: getAuthHeaders(),
      credentials: "include",
    })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => {
        setSummary(data);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message === "403" ? "You don't have access to this client's plan." : "Failed to load nutrition plan.");
        setIsLoading(false);
      });
  }, [clientId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80">
      <div className="max-w-2xl mx-auto px-4 pb-12">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between py-5">
          <button
            onClick={() => navigate(`/pro/clients/${clientId}`)}
            className="flex items-center gap-2 text-white/70 active:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Client Dashboard</span>
          </button>
          <div className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-full px-3 py-1">
            <Eye className="w-3 h-3 text-white/40" />
            <span className="text-[11px] text-white/40 font-medium">Read-Only · Client View</span>
          </div>
        </div>

        {/* ── Page title ── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Nutrition Life Plan</h1>
            <p className="text-xs text-white/40 mt-0.5">
              What's shaping this client's AI-generated meals
            </p>
          </div>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-center">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ── Card ── */}
        {!error && (
          <NutritionPersonalizationSummaryCard
            summary={summary ?? undefined}
            isLoading={isLoading}
            defaultExpanded
          />
        )}

        {/* ── Footer note ── */}
        {!isLoading && !error && summary && (
          <p className="text-center text-[10px] text-white/25 mt-5 leading-relaxed">
            This plan is derived from the client's active health conditions, dietary identity,<br />
            and protocol inputs. It is read-only — changes must be made by the client.
          </p>
        )}
      </div>
    </div>
  );
}
