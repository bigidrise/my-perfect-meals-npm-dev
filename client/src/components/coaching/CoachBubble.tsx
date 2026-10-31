import React from "react";
import type { ConciergePresentation } from "@shared/coaching/types";
import { isCoachDestinationId } from "@shared/coaching/navigation";
import CoachFeatureAction from "./CoachFeatureAction";

interface PlanItem {
  text: string;
  horizon?: string;
  kind?: string;
  dueAt?: string;
  completionSignal?: string;
  featureTarget?: string;
  destinationId?: string;
}

export interface CoachStructuredResponse {
  presentation?: ConciergePresentation;
  meta?: { redFlag?: boolean };
  whatIFound: string;
  whatItCouldMean: string;
  todayPlan: {
    why: string;
    items: Array<PlanItem | string>;
    successMetric: string;
    nextCheckIn: string;
  } | null;
  learningOpportunity: string | null;
}

export function ProfessionalBoundaryNotice() {
  return (
    <p className="text-white/35 text-[11px] leading-snug">
      These are suggestions to help you make an informed choice right now. If you're working with
      a coach, dietitian, or physician, please follow their guidance and check with them about
      concerns or changes to your nutrition or health plan.
    </p>
  );
}

export function isConciergeMessage(structured: CoachStructuredResponse): boolean {
  return structured.presentation?.kind === "concierge" &&
    typeof structured.presentation.message === "string" &&
    structured.presentation.message.trim().length > 0 &&
    !structured.meta?.redFlag &&
    !structured.todayPlan?.items.some(item => typeof item !== "string" && item.kind === "contact_care");
}

/** Explicit presentation, not text heuristics, separates ordinary and coaching UI. */
export default function CoachBubble({
  structured, enableConcierge = false,
}: { structured: CoachStructuredResponse; enableConcierge?: boolean }) {
  const compact = enableConcierge && isConciergeMessage(structured);
  const planItems = structured.todayPlan?.items ?? [];
  const planWhy = structured.todayPlan?.why;
  const target = compact ? structured.presentation?.destinationId : undefined;
  const showButton = isCoachDestinationId(target) && planItems.some(item =>
    typeof item !== "string" && item.kind === "use_feature" && item.destinationId === target);
  const escalation = planItems.some(item => typeof item !== "string" && item.kind === "contact_care");
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <p className="text-[11px] font-semibold text-orange-400 mb-1.5 uppercase tracking-wider ml-1">
          Coach
        </p>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-white/90 leading-relaxed space-y-3">
          {compact ? <>
            <p className="whitespace-pre-wrap">{structured.presentation!.message}</p>
            {showButton && <CoachFeatureAction destinationId={target}
              creatorRequest={structured.presentation?.creatorRequest} />}
          </> : <>
            {[structured.whatIFound, structured.whatItCouldMean].filter(Boolean).map((text, i) => <p key={i}>{text}</p>)}
            {(planWhy || planItems.length > 0) && (
              <div className="space-y-2">
                {planWhy && <p>{planWhy}</p>}
                {planItems.length > 0 && <ul className="space-y-1.5 mt-1">
                  {planItems.map((item, i) => enableConcierge && typeof item !== "string" &&
                    item.kind === "use_feature" && isCoachDestinationId(item.destinationId) && !escalation
                    ? <li key={i}><CoachFeatureAction destinationId={item.destinationId} /></li>
                    : <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5 shrink-0 select-none">•</span>
                      <span className="min-w-0">{typeof item === "string" ? item : item.text}</span>
                    </li>)}
                </ul>}
              </div>
            )}
            {structured.learningOpportunity && <p className="text-white/60 italic text-[13px] border-t border-white/5 pt-3">
              {structured.learningOpportunity}
            </p>}
            <div className="border-t border-white/8 pt-3 mt-1"><ProfessionalBoundaryNotice /></div>
          </>}
        </div>
      </div>
    </div>
  );
}
